import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary=vi.hoisted(()=>({session:vi.fn(),month:vi.fn(),people:vi.fn(),create:vi.fn(),decline:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:boundary.session}));
vi.mock("../../src/features/visits/shared-calendar",async original=>({
 ...await original<typeof import("../../src/features/visits/shared-calendar")>(),sharedMonth:boundary.month,calendarPeople:boundary.people,createMinistry:boundary.create,declineVisit:boundary.decline,
}));
import { GET as calendar } from "../../app/api/visits/calendar/route";
import { GET as people } from "../../app/api/visits/people/route";
import { POST as ministry } from "../../app/api/admin/ministry-schedules/route";
import { POST as decline } from "../../app/api/admin/visits/[id]/decline/route";
const input={title:"목요전도대",startDate:"2026-11-05",time:"14:00",repeat:"weekly",location:"교회"};
const post=(body:unknown,origin="https://example.test")=>new Request("https://example.test/api/admin/ministry-schedules",{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();boundary.month.mockResolvedValue([]);boundary.create.mockResolvedValue({id:"created"});});
describe("shared calendar authorization",()=>{
 it("requires login but permits ordinary members to see the shared month",async()=>{
  boundary.session.mockResolvedValue(null);expect((await calendar(new Request("https://example.test/api/visits/calendar?month=2026-11"))).status).toBe(401);expect(boundary.month).not.toHaveBeenCalled();
  boundary.session.mockResolvedValue({id:"member",role:"member"});
  const response=await calendar(new Request("https://example.test/api/visits/calendar?month=2026-11"));
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(boundary.month).toHaveBeenCalledWith("2026-11");
 });
 it("rejects invalid month values before querying storage",async()=>{
  boundary.session.mockResolvedValue({id:"member",role:"member"});
  for(const month of ["2026-13","2026-1","garbage"])expect((await calendar(new Request("https://example.test/api/visits/calendar?month="+month))).status).toBe(400);
  expect(boundary.month).not.toHaveBeenCalled();
 });
 it.each([null,{id:"member",role:"member"}])("prevents non-pastors from creating ministry events or declining visits",async user=>{
  boundary.session.mockResolvedValue(user);expect((await ministry(post(input))).status).toBe(403);
  expect((await decline(post({}),{params:Promise.resolve({id:"00000000-0000-4000-8000-000000000501"})})).status).toBe(403);
  expect(boundary.create).not.toHaveBeenCalled();expect(boundary.decline).not.toHaveBeenCalled();
 });
 it("uses the authenticated pastor and validates recurring bounds and time",async()=>{
  boundary.session.mockResolvedValue({id:"pastor",role:"admin"});
  expect((await ministry(post(input))).status).toBe(201);expect(boundary.create).toHaveBeenCalledWith("pastor",{...input,endDate:null});
  boundary.create.mockClear();
  for(const patch of [{time:"25:00"},{endDate:"2026-11-01"},{repeat:"daily"},{ownerUserId:"forged"}])expect((await ministry(post({...input,...patch}))).status).toBe(400);
  expect(boundary.create).not.toHaveBeenCalled();
 });
 it("blocks cross-site writes",async()=>{
  boundary.session.mockResolvedValue({id:"pastor",role:"admin"});expect((await ministry(post(input,"https://other.test"))).status).toBe(403);expect(boundary.create).not.toHaveBeenCalled();
 });
 it("exposes only name and known sam in the pastor's recipient picker",async()=>{
  boundary.session.mockResolvedValue({id:"member",role:"member"});expect((await people()).status).toBe(403);expect(boundary.people).not.toHaveBeenCalled();
  boundary.session.mockResolvedValue({id:"pastor",role:"admin"});boundary.people.mockResolvedValue([{id:"person",name:"김믿음",sam:"1-2샘",sourceName:"internal"}]);
  expect(await (await people()).json()).toEqual({people:[{id:"person",name:"김믿음",sam:"1-2샘"}]});
 });
});
