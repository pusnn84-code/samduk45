import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const mocks=vi.hoisted(()=>({db:vi.fn()}));
vi.mock("../../src/db/client",()=>({getDb:mocks.db}));
import { setSharingEmpathy } from "../../src/features/bible-reading/empathy";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const date="2026-11-13",sharingId=id(1),viewer=id(2),other=id(3);
const dialect=new PgDialect();
function storage(missing=false){
 const reacted=new Set<string>();const statements:{sql:string;params:unknown[]}[]=[];
 const execute=vi.fn(async(query:SQL)=>{const statement=dialect.sqlToQuery(query);statements.push(statement);
  if(statement.sql.includes("for share of entry,author"))return {rows:missing?[]:[{sharing_id:sharingId}]};
  if(statement.sql.includes("pg_advisory_xact_lock"))return {rows:[]};
  if(statement.sql.includes("insert into")){reacted.add(String(statement.params[1]));return {rows:[]};}
  if(statement.sql.includes("delete from")){reacted.delete(String(statement.params[1]));return {rows:[]};}
  if(statement.sql.includes("count(*)"))return {rows:[{count:reacted.size,reacted:reacted.has(String(statement.params[0]))}]};
  throw new Error("UNEXPECTED_QUERY");
 });
 const tx={execute};mocks.db.mockReturnValue({transaction:async(fn:(tx:typeof tx)=>unknown)=>fn(tx)});
 return {reacted,statements};
}
beforeEach(()=>vi.resetAllMocks());
describe("one-line sharing empathy",()=>{
 it("adds once per member, permits another member and idempotently cancels only the viewer",async()=>{
  const state=storage();
  expect(await setSharingEmpathy(viewer,{date,sharingId,reacted:true})).toEqual({sharingId,count:1,reacted:true});
  expect(await setSharingEmpathy(viewer,{date,sharingId,reacted:true})).toEqual({sharingId,count:1,reacted:true});
  expect(await setSharingEmpathy(other,{date,sharingId,reacted:true})).toEqual({sharingId,count:2,reacted:true});
  expect(await setSharingEmpathy(viewer,{date,sharingId,reacted:false})).toEqual({sharingId,count:1,reacted:false});
  expect(await setSharingEmpathy(viewer,{date,sharingId,reacted:false})).toEqual({sharingId,count:1,reacted:false});
  expect(state.reacted.has(other)).toBe(true);
  expect(state.statements.find(s=>s.sql.includes("insert into"))!.sql).toContain("on conflict(sharing_id,user_id) do nothing");
 });
 it("rejects deleted, inactive-author or wrong-date targets before writing",async()=>{
  const state=storage(true);
  await expect(setSharingEmpathy(viewer,{date,sharingId,reacted:true})).rejects.toMatchObject({code:"SHARING_NOT_FOUND",status:404});
  expect(state.statements).toHaveLength(1);
  expect(state.statements[0].sql).toContain("author.is_active");expect(state.statements[0].sql).toContain("entry.sharing is not null");expect(state.statements[0].params).toEqual([sharingId,date]);
 });
 it("returns only opaque target ID, own reaction and count",async()=>{
  storage();const result=await setSharingEmpathy(viewer,{date,sharingId,reacted:true});
  expect(Object.keys(result).sort()).toEqual(["count","reacted","sharingId"]);expect(JSON.stringify(result)).not.toContain(viewer);
 });
 it("rejects unscheduled dates before opening a transaction",async()=>{
  await expect(setSharingEmpathy(viewer,{date:"2026-11-15",sharingId,reacted:true})).rejects.toMatchObject({code:"INVALID_READING_DATE"});
  expect(mocks.db).not.toHaveBeenCalled();
 });
});
