import {beforeEach,describe,it,expect,vi} from "vitest";
const mock=vi.hoisted(()=>({session:vi.fn(),daily:vi.fn(),sams:vi.fn(),create:vi.fn(),update:vi.fn(),reaction:vi.fn(),card:vi.fn(),list:vi.fn(),names:vi.fn(),comments:vi.fn(),commentCreate:vi.fn(),commentDelete:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:mock.session}));
vi.mock("../../src/features/autumn-light/service",()=>({getAutumnDaily:mock.daily,listAutumnSams:mock.sams,listAutumnCards:mock.list,getAutumnCard:mock.card,createAutumnCard:mock.create,updateAutumnCard:mock.update,setAutumnPrayer:mock.reaction,listAutumnParticipants:mock.names,listAutumnComments:mock.comments,createAutumnComment:mock.commentCreate,deleteAutumnComment:mock.commentDelete}));
import {GET,POST,PUT,PATCH} from "../../app/api/autumn-light/[[...path]]/route";
const id="00000000-0000-4000-8000-000000000111",ctx=(path:string[]=[])=>({params:Promise.resolve({path})});
const request=(method="GET",body?:unknown,origin?:string)=>new Request("https://example.test/api/autumn-light",{method,headers:{"content-type":"application/json",...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
beforeEach(()=>{vi.clearAllMocks();mock.session.mockResolvedValue({id,role:"member"});mock.daily.mockResolvedValue({date:"2026-11-12",card:null});mock.sams.mockResolvedValue([])});
describe("autumn HTTP access",()=>{
 it("requires login before all content and mutations",async()=>{mock.session.mockResolvedValue(null);for(const fn of [GET,POST,PUT,PATCH])expect((await fn(request(),ctx())).status).toBe(401);expect(mock.daily).not.toHaveBeenCalled();expect(mock.create).not.toHaveBeenCalled()});
 it("rejects cross-site changes before calling services",async()=>{expect((await PUT(request("PUT",{prayed:true},"https://other.test"),ctx(["cards",id,"prayers"]))).status).toBe(403);expect(mock.reaction).not.toHaveBeenCalled()});
 it("does not accept another actor or forged admin statuses in a new card",async()=>{expect((await POST(request("POST",{name:"예시",samId:id,prayer:"기도",submissionKey:id,visited:true}),ctx(["cards"]))).status).toBe(400);expect(mock.create).not.toHaveBeenCalled()});
 it("uses private no-store headers on daily content",async()=>{const response=await GET(request(),ctx());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("vary")).toBe("Cookie")});
 it("passes only the authenticated identity to idempotent reaction writes",async()=>{mock.reaction.mockResolvedValue({id});expect((await PUT(request("PUT",{prayed:true}),ctx(["cards",id,"prayers"]))).status).toBe(200);expect(mock.reaction).toHaveBeenCalledWith({id,role:"member"},id,true)});
 it("rejects village six filtering",async()=>{expect((await GET(new Request("https://example.test/api/autumn-light/cards?village=6"),ctx(["cards"]))).status).toBe(400);expect(mock.list).not.toHaveBeenCalled()});
});

it("comments reject cross-site writes and spoofed identities",async()=>{expect((await POST(request('POST',{body:'내용',submissionKey:id},'https://other.test'),ctx(['cards',id,'comments']))).status).toBe(403);expect(mock.commentCreate).not.toHaveBeenCalled();expect((await POST(request('POST',{body:'내용',submissionKey:id,userId:id}),ctx(['cards',id,'comments']))).status).toBe(400);expect(mock.commentCreate).not.toHaveBeenCalled();});
it("comment writes use only the signed-in actor",async()=>{mock.commentCreate.mockResolvedValue({card:{id}});expect((await POST(request('POST',{body:'내용',submissionKey:id}),ctx(['cards',id,'comments']))).status).toBe(201);expect(mock.commentCreate).toHaveBeenCalledWith({id,role:'member'},id,{body:'내용',submissionKey:id});});
