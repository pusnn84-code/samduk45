import {describe,it,expect,vi} from "vitest";
import {PgDialect} from "drizzle-orm/pg-core";
import {listCommunityPrayers} from "../../src/features/prayer-requests/community-list";
import {PrayerVisibility} from "../../src/features/prayer-requests/visibility";
describe("prayer sharing privacy boundary",()=>{
 it("restricts member SQL to shared content and masks anonymous authors in the projection",async()=>{
  const execute=vi.fn().mockResolvedValue({rows:[]});
  await listCommunityPrayers({role:"member"},0,{execute});
  const q=new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(q.sql).toContain("p.visibility in ('public','anonymous')");
  expect(q.sql).toContain("case when p.visibility='anonymous' and not");
  expect(q.sql).toContain("then '무명' else u.display_name end");
  expect(q.params).toEqual([false,false,0]);
  expect(q.sql.split("from prayer_app")[0]).not.toContain("p.user_id");
 });
 it("uses the authenticated admin role for private content and true names",async()=>{
  const execute=vi.fn().mockResolvedValue({rows:[]});
  await listCommunityPrayers({role:"admin"},2,{execute});
  const q=new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(q.params).toEqual([true,true,40]);
 });
 it("paginates without returning the extra sentinel record",async()=>{
  const execute=vi.fn().mockResolvedValue({rows:Array.from({length:21},(_,id)=>({id:String(id)}))});
  const result=await listCommunityPrayers({role:"member"},0,{execute});
  expect(result.items).toHaveLength(20);expect(result.hasMore).toBe(true);
 });
 it("rejects unknown disclosure modes",()=>{expect(PrayerVisibility.safeParse("everyone-admin").success).toBe(false)});
});
