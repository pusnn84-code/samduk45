import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../src/lib/http";
const boundary=vi.hoisted(()=>({session:vi.fn(),get:vi.fn(),save:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:boundary.session}));
vi.mock("../../src/features/visits/edit-service",async original=>({...await original<typeof import("../../src/features/visits/edit-service")>(),getEditableVisit:boundary.get,saveVisitEdit:boundary.save}));
import { GET, PATCH } from "../../app/api/visits/[id]/route";
const id="00000000-0000-4000-8000-000000000599",context={params:Promise.resolve({id})};
const request=(body:unknown,origin="https://example.test")=>new Request("https://example.test/api/visits/"+id,{method:"PATCH",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();boundary.session.mockResolvedValue({id:"owner",role:"member"});boundary.get.mockResolvedValue({id,requesterUserId:"owner",reason:"개인 기도제목"});boundary.save.mockResolvedValue(undefined);});
describe("visit edit HTTP boundary",()=>{
 it("requires a full login session",async()=>{
  boundary.session.mockResolvedValue(null);expect((await GET(new Request("https://example.test"),context)).status).toBe(401);expect((await PATCH(request({reason:"수정"}),context)).status).toBe(401);expect(boundary.get).not.toHaveBeenCalled();expect(boundary.save).not.toHaveBeenCalled();
 });
 it("returns only an authorized applicant's form with private no-store caching",async()=>{
  const response=await GET(new Request("https://example.test"),context);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(await response.json()).toEqual({visit:{id,reason:"개인 기도제목"}});expect(boundary.get).toHaveBeenCalledWith({id:"owner",role:"member"},id);
 });
 it("does not turn another person's private visit into a readable edit form",async()=>{
  boundary.get.mockRejectedValue(new DomainError("VISIT_NOT_FOUND",404));const response=await GET(new Request("https://example.test"),context);expect(response.status).toBe(404);expect(JSON.stringify(await response.json())).not.toContain("개인 기도제목");
 });
 it("blocks cross-site edits before changing storage",async()=>{expect((await PATCH(request({reason:"수정"},"https://other.test"),context)).status).toBe(403);expect(boundary.save).not.toHaveBeenCalled();});
 it.each([{status:"confirmed"},{requesterUserId:"other"},{recipientName:"다른 대상"},{allDay:"true"},{visitDate:"2026-02-30"},{}])("rejects forged or malformed member edits %j",async body=>{expect((await PATCH(request(body),context)).status).toBe(400);expect(boundary.save).not.toHaveBeenCalled();});
 it("passes the authenticated identity rather than a caller-supplied owner",async()=>{expect((await PATCH(request({location:"교회",reason:"소식 정정"}),context)).status).toBe(200);expect(boundary.save).toHaveBeenCalledWith({id:"owner",role:"member"},id,{location:"교회",reason:"소식 정정"});});
 it("lets the admin change the intended recipient as well as details",async()=>{boundary.session.mockResolvedValue({id:"pastor",role:"admin"});expect((await PATCH(request({recipientName:"김믿음",location:"가정"}),context)).status).toBe(200);expect(boundary.save).toHaveBeenCalledWith({id:"pastor",role:"admin"},id,{recipientName:"김믿음",location:"가정"});});
 it("returns a state conflict if the visit was confirmed while its form was open",async()=>{boundary.save.mockRejectedValue(new DomainError("VISIT_NOT_EDITABLE",409));const response=await PATCH(request({location:"교회"}),context);expect(response.status).toBe(409);expect(await response.json()).toEqual({code:"VISIT_NOT_EDITABLE"});});
 it("rejects malformed IDs before reading storage",async()=>{expect((await GET(new Request("https://example.test"),{params:Promise.resolve({id:"bad-id"})})).status).toBe(400);expect(boundary.get).not.toHaveBeenCalled();});
});
