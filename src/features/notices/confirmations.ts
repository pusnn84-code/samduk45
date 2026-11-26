import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { noticeConfirmations, noticeImages, notices } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { directory } from "../pastoral/access";
import { rows, type Executor } from "../pastoral/db";
import { confirmationAccess, confirmationState, needsConfirmation, type ConfirmationDirectory, type ConfirmationRecord } from "./confirmation-policy";
import { noticeRevisionSql } from "./revision";

type Actor = { id: string };

async function confirmationDirectory(db: Executor): Promise<ConfirmationDirectory> {
  const [base, flags, allUsers] = await Promise.all([
    directory(db),
    rows<{ id: string; isAdmin: boolean; isNoticeOfficer: boolean; noticeOfficerTitle: string; position: string }>(db, sql`select id,position,is_admin as "isAdmin",is_notice_officer as "isNoticeOfficer",notice_officer_title as "noticeOfficerTitle" from prayer_app.member_roster`),
    rows<ConfirmationDirectory["users"][number]>(db, sql`select id,roster_id as "rosterId",role,is_active as "isActive" from prayer_app.users`),
  ]);
  const byId = new Map(flags.map(flag => [flag.id, flag]));
  return { ...base, users: allUsers, roster: base.roster.map(person => ({ ...person, isAdmin: byId.get(person.id)?.isAdmin ?? false, isNoticeOfficer: byId.get(person.id)?.isNoticeOfficer ?? false, noticeOfficerTitle: byId.get(person.id)?.noticeOfficerTitle ?? "", position: byId.get(person.id)?.position ?? "" })) };
}

async function recordsForNotice(noticeId: string, db: Executor): Promise<ConfirmationRecord[]> {
  const records = await rows<{ rosterId: string; revision: string; confirmedAt: Date | string }>(db, sql`select roster_id as "rosterId",notice_revision as revision,confirmed_at as "confirmedAt" from prayer_app.notice_confirmations where notice_id=${noticeId}`);
  return records.map(record => ({ ...record, confirmedAt: new Date(record.confirmedAt).toISOString() }));
}

async function publishedNoticeRevision(noticeId: string, db: Pick<ReturnType<typeof getDb>, "select"> = getDb()) {
  const [notice] = await db.select({ revision: noticeRevisionSql }).from(notices)
    .leftJoin(noticeImages, eq(noticeImages.noticeId, notices.id))
    .where(and(eq(notices.id, noticeId), eq(notices.status, "published"))).limit(1);
  if (!notice) throw new DomainError("NOTICE_NOT_FOUND", 404);
  return notice.revision;
}

export async function getNoticeConfirmations(noticeId: string, actor: Actor) {
  const db = getDb();
  const revision = await publishedNoticeRevision(noticeId, db);
  const data = await confirmationDirectory(db);
  if (!confirmationAccess(actor.id, data).visible) return null;
  return confirmationState(actor.id, data, revision, await recordsForNotice(noticeId, db));
}

export async function confirmNotice(noticeId: string, actor: Actor, expectedRevision: string, now = new Date()) {
  return getDb().transaction(async tx => {
    // Serialize confirmation with notice edits; a stale page cannot acknowledge a
    // revision the person has not read. The content hash also covers image edits.
    const [locked] = await tx.select({ id: notices.id }).from(notices).where(and(eq(notices.id, noticeId), eq(notices.status, "published"))).for("update").limit(1);
    if (!locked) throw new DomainError("NOTICE_NOT_FOUND", 404);
    const revision = await publishedNoticeRevision(noticeId, tx);
    const data = await confirmationDirectory(tx);
    const access = confirmationAccess(actor.id, data);
    if (!access.visible || !access.rosterId) throw new DomainError("FORBIDDEN", 403);
    if (revision !== expectedRevision) throw new DomainError("NOTICE_CHANGED", 409);
    const records = await recordsForNotice(noticeId, tx);
    const existing = records.find(record => record.rosterId === access.rosterId);
    if (needsConfirmation(existing, revision)) {
      await tx.insert(noticeConfirmations).values({ noticeId, rosterId: access.rosterId, noticeRevision: revision, confirmedAt: now, confirmedByUserId: actor.id })
        .onConflictDoUpdate({ target: [noticeConfirmations.noticeId, noticeConfirmations.rosterId], set: { noticeRevision: revision, confirmedAt: now, confirmedByUserId: actor.id } });
      const record = { rosterId: access.rosterId, revision, confirmedAt: now.toISOString() };
      return confirmationState(actor.id, data, revision, [...records.filter(record => record.rosterId !== access.rosterId), record])!;
    }
    return confirmationState(actor.id, data, revision, records)!;
  });
}
