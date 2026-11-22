import { getDb, rows, sql, type Executor } from "../pastoral/db";
import { DomainError } from "../../lib/http";
import type { MenuActivityKind } from "./types";

export async function activityObservationTime(db: Executor = getDb()): Promise<string> {
 const [row]=await rows<{observedAt:string}>(db,sql`select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "observedAt"`);
 return row.observedAt;
}
export async function getMenuActivityCounts(userId:string,db:Executor=getDb()) {
 const [row]=await rows<{community:number;reading:number;readingDates:string[]}>(db,sql`
 with unread as (
 select e.reading_date from prayer_app.bible_reading_shares e
 join prayer_app.users author on author.id=e.user_id and author.is_active
 left join prayer_app.bible_sharing_views v on v.user_id=${userId}::uuid and v.reading_date=e.reading_date
 where e.user_id<>${userId}::uuid and e.sharing is not null and e.sharing_updated_at>coalesce(v.viewed_at,'-infinity'::timestamptz)
 ) select (select count(*)::int from prayer_app.community_posts p where p.published_at>u.community_menu_seen_at and p.author_user_id is distinct from u.id) as community,
 (select count(*)::int from unread) as reading,
 (select coalesce(array_agg(distinct reading_date::text),'{}') from unread) as "readingDates"
 from prayer_app.users u where u.id=${userId}::uuid and u.is_active`);
 if(!row)throw new DomainError("UNAUTHORIZED",401);
 return {community:Number(row.community),members:0,reading:Number(row.reading),readingDates:row.readingDates};
}
export async function acknowledgeMenuActivity(userId:string,kind:MenuActivityKind,observedAt:string,db:Executor=getDb(),date?:string):Promise<void> {
 if(kind==="reading") {
 if(!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))throw new DomainError("INVALID_INPUT",400);
 await rows(db,sql`insert into prayer_app.bible_sharing_views(user_id,reading_date,viewed_at) values(${userId}::uuid,${date}::date,least(${observedAt}::timestamptz,clock_timestamp())) on conflict(user_id,reading_date) do update set viewed_at=greatest(prayer_app.bible_sharing_views.viewed_at,excluded.viewed_at) returning user_id`);return;
 }
 const column=kind==="community"?sql`community_menu_seen_at`:sql`directory_menu_seen_at`;
 const updated=await rows(db,sql`update prayer_app.users set ${column}=greatest(${column},least(${observedAt}::timestamptz,clock_timestamp())) where id=${userId}::uuid and is_active returning id`);
 if(!updated.length)throw new DomainError("UNAUTHORIZED",401);
}
