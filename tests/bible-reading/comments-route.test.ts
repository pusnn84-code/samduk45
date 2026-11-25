import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),list:vi.fn(),mutate:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:mocks.session}));
vi.mock("../../src/features/bible-reading/comments",()=>({listMeditationComments:mocks.list,mutateMeditationComment:mocks.mutate}));
import {GET,POST,DELETE,PATCH} from "../../app/api/bible-reading/comments/route";
const sharingId="11111111-1111-4111-8111-111111111111",id="22222222-2222-4222-8222-222222222222",url="https://app.test/api/bible-reading/comments";
const request=(body:unknown,origin="https://app.test")=>new Request(url,{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue({id:"actual-member"});mocks.list.mockResolvedValue([]);});
it("requires a session and rejects cross-origin comments and client-chosen identities",async()=>{
 expect((await POST(request({sharingId,id,body:"나눔",userId:"other"}))).status).toBe(400);
 expect((await POST(request({sharingId,id,body:"나눔"},"https://evil.test"))).status).toBe(403);
 expect(mocks.mutate).not.toHaveBeenCalled();mocks.session.mockResolvedValue(null);
 expect((await GET(new Request(`${url}?sharingId=${sharingId}`))).status).toBe(401);
 expect((await DELETE(request({sharingId,id}))).status).toBe(401);
});
it("accepts multiple long multiline comments using the server-side actor",async()=>{
 const body="감사합니다.\n".repeat(100);
 expect((await POST(request({sharingId,id,body}))).status).toBe(200);
 expect(mocks.mutate).toHaveBeenCalledWith("actual-member",sharingId,{id,sharingId,body:body.trim()},false);
 expect((await GET(new Request(`${url}?sharingId=${sharingId}`))).headers.get("cache-control")).toContain("no-store");
});

it("validates edits and passes the authenticated actor to the ownership-checked update",async()=>{
 expect((await PATCH(request({sharingId,id,body:"수정한 댓글"}))).status).toBe(200);
 expect(mocks.mutate).toHaveBeenCalledWith("actual-member",sharingId,{id,sharingId,body:"수정한 댓글"},true);
 mocks.mutate.mockClear();
 expect((await PATCH(request({sharingId,id,body:" "}))).status).toBe(400);
 expect((await PATCH(request({sharingId,id,body:"수정",userId:"other"}))).status).toBe(400);
 expect((await PATCH(request({sharingId,id,body:"수정"},"https://evil.test"))).status).toBe(403);
 expect(mocks.mutate).not.toHaveBeenCalled();
});
