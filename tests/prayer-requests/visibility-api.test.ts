import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({session:vi.fn(),create:vi.fn(),list:vi.fn()}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:mocks.session}));
vi.mock("../../src/features/prayer-requests/service",()=>({createPrayerRequest:mocks.create,listOwnPrayerRequests:vi.fn()}));
vi.mock("../../src/features/prayer-requests/community-list",()=>({listCommunityPrayers:mocks.list}));
vi.mock("../../src/features/email/wakeup",()=>({scheduleEmailDelivery:vi.fn()}));
import {POST} from "../../app/api/prayer-requests/route";
import {GET} from "../../app/api/prayer-requests/list/route";
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({id:"member",role:"member"});mocks.create.mockResolvedValue("saved");mocks.list.mockResolvedValue({items:[],hasMore:false})});
const request=(data:unknown)=>new Request("https://example.test/api/prayer-requests",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
describe("prayer visibility HTTP",()=>{
 it("keeps old clients private by default",async()=>{expect((await POST(request({content:"기도"}))).status).toBe(201);expect(mocks.create).toHaveBeenCalledWith("member","기도","private")});
 it.each(["public","anonymous","private"])("saves explicit %s selection with verified author",async visibility=>{await POST(request({content:"기도",visibility,userId:"other"}));expect(mocks.create).toHaveBeenCalledWith("member","기도",visibility)});
 it("rejects unknown visibility instead of broadening publication",async()=>{expect((await POST(request({content:"기도",visibility:"all"}))).status).toBe(400);expect(mocks.create).not.toHaveBeenCalled()});
 it("requires sign-in for the prayer list",async()=>{mocks.session.mockResolvedValue(null);expect((await GET(new Request("https://example.test/api/prayer-requests/list"))).status).toBe(401);expect(mocks.list).not.toHaveBeenCalled()});
 it("ignores a forged admin query and sends private no-store headers",async()=>{const response=await GET(new Request("https://example.test/api/prayer-requests/list?role=admin"));expect(mocks.list).toHaveBeenCalledWith({id:"member",role:"member"},0);expect(response.headers.get("cache-control")).toContain("no-store")});
});
