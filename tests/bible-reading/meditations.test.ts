import {beforeEach,describe,it,expect,vi} from "vitest";
import {PgDialect} from "drizzle-orm/pg-core";
import type {SQL} from "drizzle-orm";
const b=vi.hoisted(()=>({db:vi.fn()}));vi.mock("../../src/db/client",()=>({getDb:b.db}));
import {mutateMeditation,withMeditations} from "../../src/features/bible-reading/meditations";
const id="00000000-0000-4000-8000-000000000001",date="2026-11-05",dialect=new PgDialect();
beforeEach(()=>vi.resetAllMocks());
function store(existing:unknown=null){const queries:{sql:string;params:unknown[]}[]=[];const execute=vi.fn(async(q:SQL)=>{const st=dialect.sqlToQuery(q);queries.push(st);return {rows:st.sql.includes("for update")?(existing?[existing]:[]):st.sql.includes("coalesce(max(n)")?[{next:7}]:[]};});const tx={execute};b.db.mockReturnValue({...tx,transaction:async(fn:(v:typeof tx)=>unknown)=>fn(tx)});return queries;}
describe("independent meditation posts",()=>{
 it("inserts a new post ID and allocates its anonymous alias without replacing a daily record",async()=>{
  const queries=store();await mutateMeditation("actor","POST",{id,date,sharing:"가".repeat(5000)+"\n두 번째 문단",sharingAnonymous:true});
  expect(queries.some(q=>q.sql.includes("pg_advisory_xact_lock"))).toBe(true);
  const insert=queries.find(q=>q.sql.startsWith("insert into"))!;expect(insert.sql).toContain("bible_reading_shares");expect(insert.params).toEqual([id,"actor",date,"가".repeat(5000)+"\n두 번째 문단",true,7]);
  expect(queries.some(q=>q.sql.includes("update prayer_app.bible_reading_entries"))).toBe(false);
 });
 it("denies editing or deleting another member's post",async()=>{
  for(const method of ["PATCH","DELETE"] as const){const queries=store({id,owner:"other",date,text:"기존",anonymous:false,number:null});await expect(mutateMeditation("actor",method,{id,date,sharing:"변경",sharingAnonymous:false})).rejects.toMatchObject({code:"SHARING_NOT_FOUND"});expect(queries.some(q=>q.sql.startsWith("update"))).toBe(false);}
 });
 it("treats retrying the same submission ID as success and rejects replacing its content",async()=>{
  const queries=store({id,owner:"actor",date,text:"기존",anonymous:false,number:null});await mutateMeditation("actor","POST",{id,date,sharing:"기존",sharingAnonymous:false});expect(queries.some(q=>q.sql.startsWith("insert"))).toBe(false);
  await expect(mutateMeditation("actor","POST",{id,date,sharing:"다른 글",sharingAnonymous:false})).rejects.toMatchObject({code:"MEDITATION_CONFLICT"});
 });
 it("rejects unscheduled dates before accessing storage",async()=>{await expect(mutateMeditation("actor","POST",{id,date:"2026-11-15",sharing:"예시",sharingAnonymous:false})).rejects.toMatchObject({code:"INVALID_READING_DATE"});expect(b.db).not.toHaveBeenCalled();});
 it("returns all independent lines through a database-side anonymous display name",async()=>{
  const execute=vi.fn(async(q:SQL)=>{const st=dialect.sqlToQuery(q);expect(st.sql).toContain("case when s.sharing_anonymous");expect(st.sql).toContain("u.is_active");return {rows:[{id,name:"무명7",text:"첫 글",isOwn:true,anonymous:true,empathyCount:2,hasEmpathized:false,observedAt:"now"}]};});b.db.mockReturnValue({execute});
  const result=await withMeditations({date,completed:false,completedPeople:[],sharing:null,sharingAnonymous:false,sharedLines:[],progress:{completedDays:0,totalDays:200}},"actor");expect(result.sharedLines[0]).toEqual({id,name:"무명7",text:"첫 글",isOwn:true,anonymous:true,empathyCount:2,hasEmpathized:false});expect(result.observedAt).toBe("now");
 });
});
