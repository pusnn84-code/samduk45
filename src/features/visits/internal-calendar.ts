import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { visitRequests } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { todayInSeoul } from "../challenge/date";
import { safeVisitTime } from "../email/policy";
import { withinBookingPeriod } from "./booking-period";
import { evaluateVisitDate } from "./date-policy";
import { dbVisitRepository, type SubmitVisitInput, type VisitRepository } from "./service";
import type { VisitStatus } from "./types";
import { recipientForVisit } from "./shared-calendar";
import { visitRange,validateRange,shiftDate } from "./schedule-range";

export const VisitDetailsInput = z.object({
  visitDate: z.iso.date(),
  endDate: z.iso.date().nullable().optional(),
  allDay: z.boolean().optional(),
  visitType: z.enum(["personal", "sam"]),
  attendees: z.string().trim().max(3000).default(""),
  location: z.string().trim().max(500).default(""),
  preferredTime: z.string().trim().max(200).default(""),
  reason: z.string().trim().max(10000).default(""),
});
export const VisitDetailsPatch = VisitDetailsInput.extend({recipientName:z.string().trim().min(1).max(120).optional()}).partial().strict()
  .refine(value => Object.keys(value).length > 0);
export type InternalVisitPatch = z.infer<typeof VisitDetailsPatch>;

export type InternalVisitRepository = {
  insert(input: SubmitVisitInput, status: "requested" | "confirmed"): Promise<{ id: string }>;
  update(id: string, patch: InternalVisitPatch): Promise<boolean>;
  transition(id: string, from: VisitStatus[], to: VisitStatus, adminId?: string): Promise<boolean>;
  delete(id: string): Promise<void>;
};

export const dbInternalVisits: InternalVisitRepository = {
  async insert(input, status) {
    return getDb().transaction(async tx => {
      const [row] = await tx.insert(visitRequests).values({
        ...input, status, calendarSyncStatus: "synced", googleEventId: null,
        confirmedAt: status === "confirmed" ? new Date() : null,
        confirmedByUserId: status === "confirmed" ? input.requesterUserId : null,
      }).returning({ id: visitRequests.id });
      // The historical DB trigger captures Google-event updates. App-only requests
      // enqueue the same minimal receipt atomically, respecting the existing opt-in.
      if (status === "requested" && process.env.VERCEL_ENV === "production" && process.env.NODE_ENV === "production") {
        await tx.execute(sql`with cfg as (select * from prayer_app.email_notification_settings where id=1 for share)
          insert into prayer_app.email_notification_outbox(kind,source_id,generation,recipient,sam_label,requester_name,visit_date,visit_time)
          select 'visit',v.id,cfg.generation,cfg.recipient,left(coalesce(nullif(r.sam_label,''),s.name),100),
            left(u.display_name,80),v.visit_date,${safeVisitTime(input.preferredTime)}
          from cfg join prayer_app.visit_requests v on v.id=${row.id}::uuid
          join prayer_app.users u on u.id=v.requester_user_id
          left join prayer_app.member_roster r on r.id=u.roster_id left join prayer_app.sams s on s.id=u.sam_id
          where cfg.enabled and cfg.verified_at is not null and cfg.refresh_token_ciphertext is not null
            and cfg.recipient<>'' and cfg.google_email=cfg.recipient
            and (cfg.enabled_at is null or v.created_at>=cfg.enabled_at)
          on conflict(kind,source_id) do nothing`);
      }
      return row;
    });
  },
  async update(id, patch) {
    const [current] = await getDb().select({recipientName:visitRequests.recipientName,visitDate:visitRequests.visitDate,endDate:visitRequests.endDate,allDay:visitRequests.allDay,preferredTime:visitRequests.preferredTime})
      .from(visitRequests).where(eq(visitRequests.id,id)).limit(1);
    if(!current)return false;
    const start=patch.visitDate??current.visitDate;
    const end=patch.endDate!==undefined?patch.endDate:patch.visitDate&&(current.endDate??current.visitDate)===current.visitDate?start:current.endDate;
    validateRange(start,end??start);
    const allDay=patch.allDay??current.allDay;
    const timing={...(patch.visitDate?{endDate:end??start}:{}),...(patch.endDate!==undefined?{endDate:patch.endDate}:{}),...(allDay?{preferredTime:''}:{})};
    const changedName=patch.recipientName !== undefined && patch.recipientName !== current.recipientName;
    const resolved=changedName?await recipientForVisit({id:"",role:"admin",displayName:""},{attendees:"",recipientName:patch.recipientName}):null;
    const recipient=resolved?{...resolved,recipientLeaderName:'recipientLeaderName' in resolved?resolved.recipientLeaderName:null}:{};
    const rows = await getDb().update(visitRequests).set({ ...patch, ...recipient, ...timing, updatedAt: new Date() })
      .where(and(eq(visitRequests.id, id), inArray(visitRequests.status, ["requested", "confirmed"])))
      .returning({ id: visitRequests.id });
    return rows.length > 0;
  },
  async transition(id, from, to, adminId) {
    const rows = await getDb().update(visitRequests).set({
      status: to, updatedAt: new Date(), calendarSyncStatus: "synced",
      ...(to === "confirmed" ? { confirmedAt: new Date(), confirmedByUserId: adminId } : {}),
    }).where(and(eq(visitRequests.id, id), inArray(visitRequests.status, from)))
      .returning({ id: visitRequests.id });
    return rows.length > 0;
  },
  async delete(id) { await getDb().delete(visitRequests).where(eq(visitRequests.id, id)); },
};

/** The app database is the only calendar. Multiple requests and appointments may share a date. */
export async function getInternalMonthAvailability(month: string, repository: VisitRepository = dbVisitRepository) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new DomainError("INVALID_VISIT_MONTH", 400);
  const [year, number] = month.split("-").map(Number);
  const start = month + "-01";
  const end = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
  const [blocked, weekdays, enabled, bookingPeriod] = await Promise.all([
    repository.listBlockedDates(start, end), repository.listBlockedWeekdays(),
    repository.listEnabledDates(start, end), repository.getBookingPeriod(),
  ]);
  return Array.from({ length: new Date(Date.UTC(year, number, 0)).getUTCDate() }, (_, index) =>
    evaluateVisitDate({ date: month + "-" + String(index + 1).padStart(2, "0"), calendarHealthy: true,
      googleBlockedDates: new Set(), blockedDates: new Set(blocked), blockedWeekdays: new Set(weekdays),
      activeVisitDates: new Set(), enabledDates: new Set(enabled), bookingPeriod }));
}

export async function submitInternalVisit(input: SubmitVisitInput, repository: VisitRepository = dbVisitRepository,
  writer: InternalVisitRepository = dbInternalVisits, today = todayInSeoul()) {
  input=visitRange(input);
  if (input.visitDate < today) throw new DomainError("VISIT_DATE_UNAVAILABLE", 409);
  const period=await repository.getBookingPeriod();
  const last=input.endDate??input.visitDate;
  if (!withinBookingPeriod(input.visitDate, period)||!withinBookingPeriod(last,period)) throw new DomainError("VISIT_OUTSIDE_BOOKING_PERIOD", 409);
  const enabled = await repository.isDateEnabled(input.visitDate);
  const weekday = new Date(input.visitDate + "T00:00:00Z").getUTCDay();
  if (!enabled && (await repository.isDateBlocked(input.visitDate) || await repository.isWeekdayBlocked(weekday)))
    throw new DomainError("VISIT_DATE_UNAVAILABLE", 409);
  if(last>input.visitDate){
    const [blocked,enabledDates,weekdays]=await Promise.all([repository.listBlockedDates(input.visitDate,shiftDate(last,1)),repository.listEnabledDates(input.visitDate,shiftDate(last,1)),repository.listBlockedWeekdays()]);
    for(let date=shiftDate(input.visitDate,1);date<=last;date=shiftDate(date,1)){
      if(!enabledDates.includes(date)&&(blocked.includes(date)||weekdays.includes(new Date(date+'T00:00:00Z').getUTCDay())))throw new DomainError("VISIT_DATE_UNAVAILABLE",409);
    }
  }
  return writer.insert(input, "requested");
}

/** Route handlers must verify the authenticated admin role before direct confirmation. */
export async function createInternalAppointment(input: SubmitVisitInput, writer: InternalVisitRepository = dbInternalVisits) {
  return writer.insert(visitRange(input), "confirmed");
}

export async function updateInternalVisit(id: string, patch: InternalVisitPatch, writer: InternalVisitRepository = dbInternalVisits) {
  const updated = await writer.update(id, patch);
  if (!updated) throw new DomainError("VISIT_NOT_EDITABLE", 409);
}

export async function transitionInternalVisit(id: string, to: "confirmed" | "completed" | "cancelled", adminId?: string,
  writer: InternalVisitRepository = dbInternalVisits) {
  const from: VisitStatus[] = to === "confirmed" ? ["requested"] : to === "completed" ? ["confirmed"] : ["requested", "confirmed"];
  if (!await writer.transition(id, from, to, adminId)) throw new DomainError("INVALID_VISIT_STATUS_TRANSITION", 409);
}

export async function listOwnVisits(userId: string) {
  return getDb().select({ id: visitRequests.id, visitDate: visitRequests.visitDate, status: visitRequests.status,
    endDate:visitRequests.endDate,allDay:visitRequests.allDay,
    preferredTime: visitRequests.preferredTime, location: visitRequests.location })
    .from(visitRequests).where(eq(visitRequests.requesterUserId, userId)).orderBy(asc(visitRequests.visitDate));
}
