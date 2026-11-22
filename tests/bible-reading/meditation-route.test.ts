import {beforeEach,describe,it,expect,vi} from "vitest";
const b=vi.hoisted(()=>({user:vi.fn(),mutate:vi.fn(),state:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:b.user}));
vi.mock("../../src/features/bible-reading/service",()=>({getBibleReadingState:b.state}));
vi.mock("../../src/features/bible-reading/meditations",()=>({mutateMeditation:b.mutate,withMeditations:async(s:unknown)=>s}));
vi.mock("../../src/features/push/wakeup",()=>({schedulePushDelivery:()=>{}}));
import {POST,PATCH,DELETE} from "../../app/api/bible-reading/shares/route";
const id="00000000-0000-4000-8000-000000000001",date="2026-11-05",url="https://app.test/api/bible-reading/shares";
const req=(body:unknown,origin="https://app.test")=>new Request(url,{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();b.user.mockResolvedValue({id:"actor"});b.state.mockResolvedValue({date});});
describe("meditation mutation HTTP boundary",()=>{
 it("requires authentication and same-origin writes",async()=>{b.user.mockResolvedValue(null);for(const fn of [POST,PATCH,DELETE])expect((await fn(req({id,date}))).status).toBe(401);b.user.mockResolvedValue({id:"actor"});expect((await POST(req({id,date,sharing:"예시",sharingAnonymous:false},"https://else.test"))).status).toBe(403);expect(b.mutate).not.toHaveBeenCalled();});
 it("accepts multiple posts, long paragraphs and only the server actor",async()=>{for(const text of ["첫 글","가".repeat(10000)+"\n기도하며 읽습니다."]){expect((await POST(req({id,date,sharing:text,sharingAnonymous:true}))).status).toBe(200);expect(b.mutate).toHaveBeenLastCalledWith("actor","POST",{id,date,sharing:text,sharingAnonymous:true});}expect((await PATCH(req({id,date,sharing:"수정",sharingAnonymous:false,userId:"other"}))).status).toBe(400);});
 it("permits explicit own deletion input and rejects forged aliases",async()=>{expect((await DELETE(req({id,date}))).status).toBe(200);expect(b.mutate).toHaveBeenLastCalledWith("actor","DELETE",{id,date});expect((await POST(req({id,date,sharing:"예시",sharingAnonymous:true,anonymousNumber:1}))).status).toBe(400);});
});
