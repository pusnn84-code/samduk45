import {beforeEach,describe,it,expect,vi} from "vitest";
import {PgDialect} from "drizzle-orm/pg-core";
const mock=vi.hoisted(()=>({execute:vi.fn()}));
vi.mock("../../src/db/client",()=>({getDb:()=>({execute:mock.execute,transaction:async(fn:(db:unknown)=>Promise<unknown>)=>fn({execute:mock.execute})})}));
import {getAutumnDaily,createAutumnCard,updateAutumnCard,setAutumnPrayer,listAutumnSams,listAutumnParticipants} from "../../src/features/autumn-light/service";
const actor={id:"00000000-0000-4000-8000-000000000001",role:"member" as const},id="00000000-0000-4000-8000-000000000002";
const card={id,name:"예시",count:0,prayed:false};
const queries=()=>mock.execute.mock.calls.map(c=>new PgDialect().sqlToQuery(c[0]));
beforeEach(()=>{mock.execute.mockReset();mock.execute.mockResolvedValue({rows:[]})});
describe("autumn daily and mutations",()=>{
 it("stores one shared pick per Seoul date, avoiding a reroll on revisits",async()=>{
  mock.execute.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id}]}).mockResolvedValueOnce({rows:[card]});
  expect(await getAutumnDaily(actor,{execute:mock.execute},"2026-11-12")).toEqual({date:"2026-11-12",card});
  expect(queries()[0].sql).toContain("on conflict(prayer_date) do nothing");
  expect(queries()[0].params).toContain("2026-11-12");expect(queries()[0].params).toContain("2026-11-11");
 });
 it("makes a timed-out registration retry return the existing card",async()=>{
  mock.execute.mockResolvedValueOnce({rows:[{id}]}).mockResolvedValueOnce({rows:[card]});
  await createAutumnCard(actor,{name:"예시",prayer:"기도",samId:id,submissionKey:id,allowDuplicate:false});
  expect(queries().some(q=>q.sql.includes("insert into"))).toBe(false);
 });
 it("rejects duplicate names without inserting until explicitly confirmed",async()=>{
  mock.execute.mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{id} ]});
  await expect(createAutumnCard(actor,{name:"예시",prayer:"기도",samId:id,submissionKey:id,allowDuplicate:false})).rejects.toMatchObject({code:"AUTUMN_POSSIBLE_DUPLICATE"});
  expect(queries().some(q=>q.sql.includes("insert into"))).toBe(false);
 });
 it("rejects a forged status edit before any update, even for the owner",async()=>{
  mock.execute.mockResolvedValueOnce({rows:[{creator:actor.id,version:1}]});
  await expect(updateAutumnCard(actor,id,{visited:true,expectedVersion:1})).rejects.toMatchObject({code:"FORBIDDEN"});
  expect(queries().some(q=>q.sql.startsWith("update"))).toBe(false);
 });
 it("protects admin saves from stale versions",async()=>{
  mock.execute.mockResolvedValueOnce({rows:[{creator:null,version:2}]});
  await expect(updateAutumnCard({...actor,role:"admin"},id,{registered:true,expectedVersion:1})).rejects.toMatchObject({code:"AUTUMN_CONFLICT"});
 });
 it("inserts one explicit prayer state and confines removal to the session user",async()=>{
  mock.execute.mockResolvedValue({rows:[card]});
  await setAutumnPrayer(actor,id,true);
  expect(queries()[1].sql).toContain("on conflict(person_id,user_id) do nothing");
  mock.execute.mockClear();await setAutumnPrayer(actor,id,false);
  expect(queries()[1].sql).toContain("and user_id=");expect(queries()[1].params).toContain(actor.id);
 });
 it("returns only active participant names, without phone numbers or member IDs",async()=>{
  mock.execute.mockResolvedValueOnce({rows:[card]}).mockResolvedValueOnce({rows:[{name:"예시"}]});
  expect(await listAutumnParticipants(actor,id)).toEqual({names:["예시"],hasMore:false});
  expect(queries()[1].sql).toContain("u.is_active");expect(queries()[1].sql).not.toContain("phone");
 });
 it("uses actual active sams and excludes village six at query time",async()=>{
  await listAutumnSams({execute:mock.execute});expect(queries()[0].sql).toContain("^[1-5]-[1-9][0-9]*$");expect(queries()[0].sql).toContain("s.is_active");
 });
});
