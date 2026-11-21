export type VisitEditor = { id: string; role: string };
export type VisitEditState = { requesterUserId: string; status: string; isUnavailable?: boolean };

export function canEditVisit(actor: VisitEditor, visit: VisitEditState): boolean {
  return actor.role === "admin" || (
    actor.id === visit.requesterUserId && visit.status === "requested" && !visit.isUnavailable
  );
}
