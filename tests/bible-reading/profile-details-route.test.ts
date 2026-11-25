import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),update:vi.fn(),get:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:mocks.session}));
vi.mock("../../src/features/profile/service",()=>({getProfile:mocks.get}));
vi.mock("../../src/features/profile/details",async original=>({...await original<object>(),updateProfileDetails:mocks.update}));
import {PATCH} from "../../app/api/profile/details/route";
const url="https://app.test/api/profile/details",valid={birthDate:"1984-07-18",phone:"010-0000-0025",phonePrivate:true};
const request=(body:unknown,origin="https://app.test")=>new Request(url,{method:"PATCH",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue({id:"session-owner"});mocks.get.mockResolvedValue({phonePrivate:true});});
it("saves normalized contacts for the session owner without accepting identity or role changes",async()=>{
 const response=await PATCH(request(valid));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
 expect(mocks.update).toHaveBeenCalledWith("session-owner",{...valid,phone:"01000000025"});
 expect((await PATCH(request({...valid,userId:"other"}))).status).toBe(400);
 expect((await PATCH(request({...valid,role:"admin"}))).status).toBe(400);
});
it("rejects invalid dates, future birth dates, malformed phone numbers and cross-site writes",async()=>{
 for(const input of [{...valid,birthDate:"2026-02-30"},{...valid,birthDate:"2999-01-01"},{...valid,phone:"123"}])expect((await PATCH(request(input))).status).toBe(400);
 expect((await PATCH(request(valid,"https://evil.test"))).status).toBe(403);
 expect(mocks.update).not.toHaveBeenCalled();mocks.session.mockResolvedValue(null);expect((await PATCH(request(valid))).status).toBe(401);
});
