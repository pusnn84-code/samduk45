import { getDb, rows, sql, type Executor } from "./db";
import { deriveAccess, deriveMemberLeaderAccess, ReportError, reportId, reportSamMembers, samKey, villageKey, type Actor, type VillageLeader, type Identity, type SamTarget, type ReportForm } from "./policy";
export function requireReportAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new ReportError("FORBIDDEN", 403);
}
export async function directory(db: Executor = getDb()) {
  const [roster, samRows, heads] = await Promise.all([
    rows<Identity>(db, sql`select id,source_name as "sourceName",canonical_name as "canonicalName",sam_label as "samLabel",village,is_active as "isActive" from prayer_app.member_roster`),
    rows<Omit<SamTarget, "village">>(db, sql`select id,name,leader_name as "leaderName",leader_roster_id as "leaderRosterId",leader_binding_locked as "leaderBindingLocked",is_active as "isActive" from prayer_app.sams order by name,id`),
    rows<VillageLeader>(db, sql`select id,name,village,leader_name as "leaderName",leader_roster_id as "leaderRosterId",leader_binding_locked as "leaderBindingLocked",is_active as "isActive" from prayer_app.village_leaders order by village,id`),
  ]);
  const sams: SamTarget[] = samRows.map(sam => {
    const key = samKey(sam.name);
    const villages = [...new Set(roster.filter(r => samKey(r.samLabel) === key).map(r => villageKey(r.village)).filter(Boolean))];
    return { ...sam, village: villages.length === 1 ? villages[0] : key.includes("-") ? key.split("-")[0] : "" };
  });
  return { roster, sams, heads };
}
async function reportDirectoryAccess(actor: Actor, db: Executor) {
  const [user] = await rows<{ rosterId: string | null }>(db, sql`select roster_id as "rosterId" from prayer_app.users where id=${actor.id} and is_active=true`);
  if (!user) throw new ReportError("UNAUTHORIZED", 401);
  const data = await directory(db);
  const access = deriveAccess(actor, data.roster.find(r => r.id === user.rosterId) ?? null, data.sams, data.roster, data.heads);
  return { access, roster: data.roster };
}
export async function reportAccess(actor: Actor, db: Executor = getDb()) {
  return (await reportDirectoryAccess(actor, db)).access;
}
export async function memberLeaderReportAccess(actor: Actor, db: Executor = getDb()) {
  return deriveMemberLeaderAccess(await reportAccess(actor, db));
}
export async function requireMemberLeaderReportAccess(actor: Actor, db: Executor = getDb()) {
  const access = await memberLeaderReportAccess(actor, db);
  if (!access.visible) throw new ReportError("FORBIDDEN", 403);
  return access;
}
export async function requireOwnReportTarget(actor: Actor, db: Executor = getDb()) {
  const { access: broad, roster } = await reportDirectoryAccess(actor, db);
  const access = deriveMemberLeaderAccess(broad);
  if (!access.visible) throw new ReportError("FORBIDDEN", 403);
  if (access.sams.length !== 1) throw new ReportError("SAM_BINDING_AMBIGUOUS", 409);
  const identity = roster.find(person => person.id === access.rosterId);
  if (!identity?.isActive) throw new ReportError("FORBIDDEN", 403);
  return { access, sam: access.sams[0], roster, identity };
}
export async function requireReportAccess(actor: Actor, db: Executor = getDb()) {
  const access = await reportAccess(actor, db);
  if (!access.visible) throw new ReportError("FORBIDDEN", 403);
  return access;
}
export async function requireReportTarget(actor: Actor, samId: string, db: Executor = getDb()) {
  const { access, roster } = await reportDirectoryAccess(actor, db);
  if (!access.visible) throw new ReportError("FORBIDDEN", 403);
  const sam = access.sams.find(s => s.id === samId);
  if (!sam) throw new ReportError("FORBIDDEN", 403);
  return { access, sam, roster };
}

export async function getReportSamMembers(actor: Actor, samId: string, db: Executor = getDb()) {
  const { sam, roster } = await requireReportTarget(actor, reportId(samId), db);
  return reportSamMembers(sam, roster);
}
export async function getOwnReportSamMembers(actor: Actor, samId: string, db: Executor = getDb()) {
  const { sam, roster } = await requireOwnReportTarget(actor, db);
  if (sam.id !== reportId(samId)) throw new ReportError("FORBIDDEN", 403);
  return reportSamMembers(sam, roster);
}

export async function resolveReportMemberNotes(
  form: ReportForm | null,
  previous: ReportForm | null,
  loadMembers: () => ReturnType<typeof reportSamMembers> | Promise<ReturnType<typeof reportSamMembers>>,
) {
  if (!form) return form;
  if (form.entryKind === "meeting") {
    if (previous?.entryKind === "meeting" && JSON.stringify(previous.attendeeIds) === JSON.stringify(form.attendeeIds)) {
      form = { ...form, meetings: [{ ...form.meetings[0], attendees: previous.meetings[0].attendees }] };
    } else {
      const members = new Map((await loadMembers()).map(person => [person.rosterId, person.member]));
      const attendees = (form.attendeeIds ?? []).map(id => {
        const name = members.get(id);
        if (!name) throw new ReportError("MEMBER_NOT_IN_SAM", 409);
        return name;
      }).join(", ");
      if (!attendees || attendees.length > 1200) throw new ReportError("ATTENDEES_REQUIRED");
      form = { ...form, meetings: [{ ...form.meetings[0], attendees }] };
    }
  }
  if (!form.memberNotes?.length) return form;
  const names = new Map(previous?.memberNotes?.map(note => [note.rosterId, note.member]));
  if (form.memberNotes.some(note => !names.has(note.rosterId))) {
    for (const person of await loadMembers()) {
      if (!names.has(person.rosterId)) names.set(person.rosterId, person.member);
    }
  }
  return { ...form, memberNotes: form.memberNotes.map(note => {
    const member = names.get(note.rosterId);
    if (!member) throw new ReportError("MEMBER_NOT_IN_SAM", 409);
    return { ...note, member };
  }) };
}
