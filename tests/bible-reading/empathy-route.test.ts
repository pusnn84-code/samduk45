import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),set:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:mocks.session}));
vi.mock("../../src/features/bible-reading/empathy",()=>({setSharingEmpathy:mocks.set}));
import { PUT } from "../../app/api/bible-reading/empathy/route";
const url="https://samduk45.vercel.app/api/bible-reading/empathy";
const input={date:"2026-11-13",sharingId:"00000000-0000-4000-8000-000000000001",reacted:true};
const request=(body:unknown=input,origin=new URL(url).origin,type="application/json")=>new Request(url,{method:"PUT",headers:{origin,"content-type":type},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue({id:"viewer"});mocks.set.mockResolvedValue({sharingId:input.sharingId,count:1,reacted:true});});
describe("sharing empathy API boundary",()=>{
 it("requires login",async()=>{mocks.session.mockResolvedValue(null);expect((await PUT(request())).status).toBe(401);expect(mocks.set).not.toHaveBeenCalled();});
 it("uses the session identity and private cache headers",async()=>{const response=await PUT(request());expect(response.status).toBe(200);expect(mocks.set).toHaveBeenCalledWith("viewer",input);expect(response.headers.get("Cache-Control")).toBe("private, no-store");});
 it.each([{...input,userId:"someone-else"},{...input,sharingId:"not-a-uuid"},{...input,reacted:"yes"},{...input,date:"2026-02-30"}])("rejects malformed or forged bodies %j",async body=>{expect((await PUT(request(body))).status).toBe(400);expect(mocks.set).not.toHaveBeenCalled();});
 it("rejects cross-origin and non-JSON writes",async()=>{expect((await PUT(request(input,"https://other.example"))).status).toBe(403);expect((await PUT(request(input,undefined,"text/plain"))).status).toBe(415);expect(mocks.set).not.toHaveBeenCalled();});
});
