import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary=vi.hoisted(()=>({rows:[] as unknown[],db:vi.fn()}));
vi.mock("../../src/db/client",()=>({getDb:boundary.db}));
import { recipientForVisit } from "../../src/features/visits/shared-calendar";
beforeEach(()=>{const query={from:()=>query,leftJoin:()=>query,where:()=>query,limit:async()=>boundary.rows,then:(resolve:(rows:unknown[])=>unknown)=>Promise.resolve(boundary.rows).then(resolve)};boundary.db.mockReturnValue({select:()=>query});boundary.rows=[];});
describe("trusted recipient identity",()=>{
 it("ignores another recipient supplied by a member",async()=>{
  boundary.rows=[{name:"본인이름",sam:"1-2"}];
  expect(await recipientForVisit({id:"member",role:"member",displayName:"본인이름"},{recipientName:"다른사람",recipientRosterId:"forged",attendees:"다른참석자"})).toEqual({recipientName:"본인이름",recipientSam:"1-2샘"});
 });
 it("resolves an explicitly selected roster ID rather than trusting typed sam/name",async()=>{
  boundary.rows=[{name:"실제대상자",sam:"3-1"}];
  expect(await recipientForVisit({id:"pastor",role:"admin",displayName:"목사"},{recipientRosterId:"selected",recipientName:"위조",attendees:""})).toEqual({recipientName:"실제대상자",recipientSam:"3-1샘"});
 });
 it("rejects a missing selected recipient and avoids ambiguous sam attribution",async()=>{
  await expect(recipientForVisit({id:"pastor",role:"admin",displayName:"목사"},{recipientRosterId:"missing",attendees:""})).rejects.toMatchObject({code:"INVALID_VISIT_RECIPIENT"});
  boundary.rows=[{name:"동명이인",sam:"1-1"},{name:"동명이인",sam:"2-1"}];
  expect(await recipientForVisit({id:"pastor",role:"admin",displayName:"목사"},{recipientName:"동명이인",attendees:""})).toEqual({recipientName:"동명이인",recipientSam:null});
 });
});
