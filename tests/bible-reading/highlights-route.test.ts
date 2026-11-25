import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),get:vi.fn(),save:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:mocks.session}));
vi.mock("../../src/features/pastoral/db",()=>({getDb:vi.fn(),rows:vi.fn(),sql:vi.fn()}));
import {VerseReference,HighlightInput} from "../../src/features/scripture/highlights";
vi.mock("../../src/features/scripture/highlights",async original=>({...await original<object>(),getHighlights:mocks.get,saveHighlights:mocks.save}));
import {GET,PUT} from "../../app/api/scripture/highlights/route";
const url="https://app.test/api/scripture/highlights";
const request=(body:unknown)=>new Request(url,{method:"PUT",headers:{origin:"https://app.test","Content-Type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.session.mockResolvedValue({id:"owner"});mocks.get.mockResolvedValue([]);});
it("validates the actual chapter and verse bounds of all 66 books",()=>{
 expect(VerseReference.safeParse({book:19,chapter:119,verse:176}).success).toBe(true);
 expect(VerseReference.safeParse({book:19,chapter:54,verse:100}).success).toBe(false);
 expect(VerseReference.safeParse({book:67,chapter:1,verse:1}).success).toBe(false);
 expect(HighlightInput.safeParse({verses:[{book:1,chapter:1,verse:1}],color:"red"}).success).toBe(false);
});
it("scopes reads and writes to the session owner and allows removing highlights",async()=>{
 expect((await GET(new Request(url+"?references=19:54,1:1"))).status).toBe(200);
 expect(mocks.get).toHaveBeenCalledWith("owner",[{book:19,chapter:54},{book:1,chapter:1}]);
 const input={verses:[{book:19,chapter:54,verse:1}],color:null};
 expect((await PUT(request(input))).status).toBe(200);expect(mocks.save).toHaveBeenCalledWith("owner",input);
 expect((await PUT(request({...input,userId:"other"}))).status).toBe(400);
 mocks.session.mockResolvedValue(null);expect((await GET(new Request(url+"?references=1:1"))).status).toBe(401);
});
