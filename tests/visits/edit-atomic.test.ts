import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const boundary=vi.hoisted(()=>({where:vi.fn(),set:vi.fn(),status:"confirmed"}));
vi.mock("../../src/db/client",()=>({getDb:()=>({
 select:()=>({from:()=>({where:()=>({limit:async()=>[{recipientName:"가상 대상",visitDate:"2026-11-24",endDate:"2026-11-24",allDay:false,preferredTime:"오후 2시"}]})})}),
 update:()=>({set:(patch:unknown)=>{boundary.set(patch);return {where:(condition:unknown)=>{boundary.where(condition);return {returning:async()=>[]};}};}}),
})}));
import { dbInternalVisits } from "../../src/features/visits/internal-calendar";
beforeEach(()=>vi.clearAllMocks());
describe("atomic visit edit storage guard",()=>{
 it("checks record ID, applicant ID, waiting status, and unavailability in the same write",async()=>{
  expect(await dbInternalVisits.update("visit-id",{location:"가정"},"owner-id")).toBe(false);
  const query=new PgDialect().sqlToQuery(boundary.where.mock.calls[0][0]);
  expect(query.params).toEqual(["visit-id","owner-id","requested",false]);
  expect(query.sql).toContain('"requester_user_id"');expect(query.sql).toContain('"status"');
 });
 it("does not constrain administrator corrections by ownership or workflow status",async()=>{
  await dbInternalVisits.update("visit-id",{location:"가정"});
  const query=new PgDialect().sqlToQuery(boundary.where.mock.calls[0][0]);expect(query.params).toEqual(["visit-id"]);
  expect(boundary.set).toHaveBeenCalledWith({location:"가정",updatedAt:expect.any(Date)});
 });
});
