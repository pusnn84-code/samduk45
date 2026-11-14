import { sql } from "drizzle-orm";
import { getBibleReadingDay } from "../../content/bible-reading-plan";
import { getDb } from "../../db/client";
import { DomainError } from "../../lib/http";

export type SharingEmpathyInput = { date:string; sharingId:string; reacted:boolean };
export type SharingEmpathyState = { sharingId:string; reacted:boolean; count:number };

/** Desired-state writes are idempotent; a shared row lock serializes deletion against reactions. */
export async function setSharingEmpathy(userId:string, input:SharingEmpathyInput):Promise<SharingEmpathyState> {
  if (!getBibleReadingDay(input.date)) throw new DomainError("INVALID_READING_DATE",400);
  return getDb().transaction(async tx => {
    const target=await tx.execute(sql`select entry.sharing_id from prayer_app.bible_reading_entries entry
      join prayer_app.users author on author.id=entry.user_id and author.is_active
      where entry.sharing_id=${input.sharingId}::uuid and entry.reading_date=${input.date}::date
        and entry.sharing is not null for share of entry,author`);
    if (!target.rows.length) throw new DomainError("SHARING_NOT_FOUND",404);
    // Serialize one member's changes for this line; different members remain independent.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.sharingId}),hashtext(${userId}))`);
    if(input.reacted) await tx.execute(sql`insert into prayer_app.bible_sharing_empathy(sharing_id,user_id)
      values(${input.sharingId}::uuid,${userId}::uuid) on conflict(sharing_id,user_id) do nothing`);
    else await tx.execute(sql`delete from prayer_app.bible_sharing_empathy where sharing_id=${input.sharingId}::uuid and user_id=${userId}::uuid`);
    const result=await tx.execute(sql`select count(*)::int as count,
      coalesce(bool_or(e.user_id=${userId}::uuid),false) as reacted
      from prayer_app.bible_sharing_empathy e join prayer_app.users reactor on reactor.id=e.user_id and reactor.is_active
      where e.sharing_id=${input.sharingId}::uuid`);
    const state=result.rows[0] as {count:number;reacted:boolean};
    return {sharingId:input.sharingId,count:Number(state.count),reacted:state.reacted};
  });
}
