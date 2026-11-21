import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { users, visitRequests } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { canEditVisit, type VisitEditor } from "./edit-policy";
import { dbInternalVisits, validateMemberVisitSchedule, VisitEditableFields, type InternalVisitPatch } from "./internal-calendar";

export const MemberVisitPatch = VisitEditableFields.partial().strict()
  .refine(value => Object.keys(value).length > 0);
export type EditableVisit = {
  id: string; requesterUserId: string; requesterName: string; status: string; isUnavailable: boolean;
  recipientName: string | null; recipientSam: string | null; recipientLeaderName: string | null;
  visitDate: string; endDate: string | null; allDay: boolean; visitType: "personal" | "sam";
  attendees: string; location: string; preferredTime: string; reason: string;
};
export type VisitEditRepository = {
  getById(id: string): Promise<EditableVisit | null>;
  update(id: string, patch: InternalVisitPatch, requesterUserId?: string): Promise<boolean>;
};
export const dbVisitEdits: VisitEditRepository = {
  async getById(id) {
    const [row] = await getDb().select({
      id: visitRequests.id, requesterUserId: visitRequests.requesterUserId,
      requesterName: users.displayName, status: visitRequests.status, isUnavailable: visitRequests.isUnavailable,
      recipientName: visitRequests.recipientName, recipientSam: visitRequests.recipientSam,
      recipientLeaderName: visitRequests.recipientLeaderName, visitDate: visitRequests.visitDate,
      endDate: visitRequests.endDate, allDay: visitRequests.allDay, visitType: visitRequests.visitType,
      attendees: visitRequests.attendees, location: visitRequests.location,
      preferredTime: visitRequests.preferredTime, reason: visitRequests.reason,
    }).from(visitRequests).innerJoin(users, eq(users.id, visitRequests.requesterUserId))
      .where(eq(visitRequests.id, id)).limit(1);
    return row ? { ...row, visitType: row.visitType as "personal" | "sam" } : null;
  },
  update: (id, patch, requesterUserId) => dbInternalVisits.update(id, patch, requesterUserId),
};

export async function getEditableVisit(actor: VisitEditor, id: string, repository = dbVisitEdits) {
  const visit = await repository.getById(id);
  if (!visit || (actor.role !== "admin" && visit.requesterUserId !== actor.id)) {
    throw new DomainError("VISIT_NOT_FOUND", 404);
  }
  if (!canEditVisit(actor, visit)) throw new DomainError("VISIT_NOT_EDITABLE", 409);
  return visit;
}

export async function saveVisitEdit(actor: VisitEditor, id: string, patch: InternalVisitPatch,
  repository = dbVisitEdits, validateSchedule = validateMemberVisitSchedule) {
  const visit = await getEditableVisit(actor, id, repository);
  const isAdmin = actor.role === "admin";
  if (!isAdmin && !MemberVisitPatch.safeParse(patch).success) throw new DomainError("INVALID_INPUT", 400);
  if (!isAdmin && (patch.visitDate !== undefined || patch.endDate !== undefined)) {
    const start = patch.visitDate ?? visit.visitDate;
    const end = patch.endDate !== undefined ? patch.endDate :
      patch.visitDate && (visit.endDate ?? visit.visitDate) === visit.visitDate ? start : visit.endDate;
    if (start !== visit.visitDate || (end ?? start) !== (visit.endDate ?? visit.visitDate)) {
      await validateSchedule({ ...visit, ...patch, visitDate: start, endDate: end, requesterUserId: actor.id });
    }
  }
  // Ownership and waiting status are checked again in the UPDATE itself. A concurrent
  // confirmation cannot be overwritten by an applicant who opened the form earlier.
  const updated = await repository.update(id, patch, isAdmin ? undefined : actor.id);
  if (!updated) throw new DomainError("VISIT_NOT_EDITABLE", 409);
}
