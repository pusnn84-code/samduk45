import { createHash } from "node:crypto";
import { requireOwnReportTarget, resolveReportMemberNotes } from "./access";
import { getDb, rows, sql } from "./db";
import { parseMemberSubmission, ReportError, reportSamMembers, seoulToday, type Actor } from "./policy";

/** Form-only member submission; no monthly schedule or reminder is enabled here. */
export async function submitMemberReport(actor: Actor, value: unknown) {
  const input = parseMemberSubmission(value);
  // Keep retries stable across midnight: the server's date is not client input.
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return getDb().transaction(async tx => {
    await tx.execute(sql`select id from prayer_app.users where id=${actor.id} for update`);
    const { sam, roster, identity } = await requireOwnReportTarget(actor, tx);
    // Prevent a concurrent identity/binding change during creation. Never trust a client SAM or author.
    const locked = await rows<{ id: string }>(tx, sql`select s.id from prayer_app.sams s
      join prayer_app.users u on u.roster_id=s.leader_roster_id
      join prayer_app.member_roster r on r.id=u.roster_id
      where u.id=${actor.id} and s.id=${sam.id} and u.is_active and r.is_active and s.is_active
        and s.name=${sam.name} and r.sam_label is not distinct from ${identity.samLabel}
        and r.village is not distinct from ${identity.village}
      for share of s,r`);
    if (!locked.length) throw new ReportError("FORBIDDEN", 403);
    const [existing] = await rows<{ id: string; authorId: string | null; fingerprint: string; submitted: boolean }>(tx,
      sql`select id,author_user_id as "authorId",fingerprint,(submitted_at is not null) as submitted
        from prayer_app.pastoral_reports where id=${input.id}`);
    if (existing) {
      if (existing.authorId !== actor.id || existing.fingerprint !== fingerprint || !existing.submitted) throw new ReportError("ID_CONFLICT", 409);
      return { id: existing.id, submitted: true };
    }
    const [moment] = await rows<{ at: Date }>(tx, sql`select clock_timestamp() as at`);
    const today = seoulToday(moment.at);
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    // This row only satisfies the historic report FK. Existing enabled flags are untouched.
    await tx.execute(sql`insert into prayer_app.pastoral_requests(year,month,enabled,created_by)
      values(${year},${month},false,${actor.id}) on conflict(year,month) do nothing`);
    const [request] = await rows<{ id: string }>(tx,
      sql`select id from prayer_app.pastoral_requests where year=${year} and month=${month} for share`);
    const form = await resolveReportMemberNotes(input.form, null, () => reportSamMembers(sam, roster));
    await tx.execute(sql`insert into prayer_app.pastoral_reports(id,request_id,sam_id,author_user_id,sam_name,village,leader_name,submitted_by,written_date,method,form,files,fingerprint)
      values(${input.id},${request.id},${sam.id},${actor.id},${sam.name},${sam.village},${identity.sourceName},${identity.sourceName},${today},'form',${JSON.stringify({ ...form, entryMode: "leader" })}::jsonb,'[]'::jsonb,${fingerprint})`);
    // Preserve the existing configured receipt-email trigger while finalizing atomically.
    await tx.execute(sql`update prayer_app.pastoral_reports set submitted_at=${moment.at} where id=${input.id}`);
    return { id: input.id, submitted: true };
  });
}
