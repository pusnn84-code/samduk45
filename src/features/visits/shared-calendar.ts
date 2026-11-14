import { and, asc, eq, gte, lt, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db/client";
import { memberRoster, ministrySchedules, users, visitRequests } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { expandMinistry, legacyRecipient, samSuffix, timeSortKey, type CalendarEntry } from "./shared-calendar-policy";

export const CalendarMonth = z.string().regex(/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/);
export const MinistryInput = z.object({ title: z.string().trim().min(1).max(120),
  startDate: z.iso.date(), endDate: z.iso.date().nullable().default(null),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), location: z.string().trim().max(500).default(""),
  repeat: z.enum(["none", "weekly"]).default("none") }).strict()
  .refine(x => !x.endDate || x.endDate >= x.startDate);
export async function calendarPeople() {
  const rows = await getDb().select({ id: memberRoster.id, name: memberRoster.canonicalName,
    sourceName: memberRoster.sourceName, sam: memberRoster.samLabel }).from(memberRoster)
    .where(eq(memberRoster.isActive, true)).orderBy(asc(memberRoster.canonicalName));
  return rows.map(row => ({ ...row, sam: samSuffix(row.sam) }));
}
export async function recipientForVisit(user: { id: string; role: string; displayName: string }, input: { recipientRosterId?: string; recipientName?: string; attendees: string }) {
  if (user.role !== "admin") {
    const [row] = await getDb().select({ name: memberRoster.canonicalName, sam: memberRoster.samLabel })
      .from(users).leftJoin(memberRoster, eq(memberRoster.id, users.rosterId)).where(eq(users.id, user.id));
    return { recipientName: row?.name || user.displayName, recipientSam: samSuffix(row?.sam) };
  }
  if (input.recipientRosterId) {
    const [row] = await getDb().select({ name: memberRoster.canonicalName, sam: memberRoster.samLabel })
      .from(memberRoster).where(and(eq(memberRoster.id, input.recipientRosterId), eq(memberRoster.isActive, true)));
    if (!row) throw new DomainError("INVALID_VISIT_RECIPIENT", 400);
    return { recipientName: row.name, recipientSam: samSuffix(row.sam) };
  }
  const name = input.recipientName?.trim() || input.attendees.trim();
  if (!name || name.length > 120) throw new DomainError("INVALID_VISIT_RECIPIENT", 400);
  const matches = await getDb().select({ name: memberRoster.canonicalName, sam: memberRoster.samLabel }).from(memberRoster)
    .where(and(eq(memberRoster.isActive, true), or(eq(memberRoster.canonicalName, name), eq(memberRoster.sourceName, name)))).limit(2);
  return { recipientName: name, recipientSam: matches.length === 1 ? samSuffix(matches[0].sam) : null };
}
export async function sharedMonth(month: string): Promise<CalendarEntry[]> {
  if (!CalendarMonth.safeParse(month).success) throw new DomainError("INVALID_VISIT_MONTH", 400);
  const start = month + "-01";
  const [year, number] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
  const [visits, series, people] = await Promise.all([
    getDb().select({ id: visitRequests.id, date: visitRequests.visitDate, recipientName: visitRequests.recipientName,
      recipientSam: visitRequests.recipientSam, attendees: visitRequests.attendees, time: visitRequests.preferredTime,
      location: visitRequests.location, status: visitRequests.status, isUnavailable: visitRequests.isUnavailable,
      requesterName: users.displayName, requesterRole: users.role, requesterSam: memberRoster.samLabel })
      .from(visitRequests).innerJoin(users, eq(users.id, visitRequests.requesterUserId))
      .leftJoin(memberRoster, eq(memberRoster.id, users.rosterId))
      .where(and(gte(visitRequests.visitDate, start), lt(visitRequests.visitDate, end),
        or(sql`${visitRequests.status} <> 'cancelled'`, eq(visitRequests.isUnavailable, true)))),
    getDb().select().from(ministrySchedules).where(and(eq(ministrySchedules.isActive, true),
      lt(ministrySchedules.startDate, end), or(isNull(ministrySchedules.endDate), gte(ministrySchedules.endDate, start)))),
    calendarPeople(),
  ]);
  const entries: CalendarEntry[] = visits.map(row => ({ id: row.id, date: row.date,
    ...legacyRecipient(row, people), time: row.time, location: row.location, kind: "visit",
    status: row.isUnavailable ? "unavailable" : row.status === "completed" ? "completed" : row.status === "confirmed" ? "confirmed" : "requested" }));
  return [...entries, ...expandMinistry(series, month)].sort((a,b) => a.date.localeCompare(b.date) || timeSortKey(a.time)-timeSortKey(b.time) || a.title.localeCompare(b.title, "ko"));
}
export async function createMinistry(ownerUserId: string, input: z.infer<typeof MinistryInput>) {
  const [row] = await getDb().insert(ministrySchedules).values({ ...input, ownerUserId }).returning({ id: ministrySchedules.id });
  return row;
}
export async function declineVisit(id: string) {
  const rows = await getDb().update(visitRequests).set({ status: "cancelled", isUnavailable: true, updatedAt: new Date() })
    .where(and(eq(visitRequests.id, id), eq(visitRequests.status, "requested"))).returning({ id: visitRequests.id });
  if (!rows.length) throw new DomainError("INVALID_VISIT_STATUS_TRANSITION", 409);
}
