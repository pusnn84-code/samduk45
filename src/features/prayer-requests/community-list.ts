import { getDb, rows, sql, type Executor } from "../pastoral/db";
import type { PrayerVisibility } from "./visibility";
export type ListedPrayer = { id:string; content:string; authorName:string; visibility:PrayerVisibility; createdAt:string };
export async function listCommunityPrayers(actor:{role:"member"|"admin"},page=0,db:Executor=getDb()) {
  const admin=actor.role==="admin";
  const items=await rows<ListedPrayer>(db,sql`
    select p.id,p.content,p.visibility,
      case when p.visibility='anonymous' and not ${admin} then '무명' else u.display_name end as "authorName",
      to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
    from prayer_app.prayer_requests p join prayer_app.users u on u.id=p.user_id
    where ${admin} or p.visibility in ('public','anonymous')
    order by p.created_at desc,p.id desc limit 21 offset ${page*20}`);
  return {items:items.slice(0,20),hasMore:items.length>20};
}
