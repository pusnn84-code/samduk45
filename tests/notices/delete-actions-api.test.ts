import {beforeEach,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({session:vi.fn(),remove:vi.fn()}));vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:m.session}));vi.mock("../../src/features/notices/service",()=>({deleteNotice:m.remove,updateNotice:vi.fn()}));vi.mock("../../src/features/push/wakeup",()=>({schedulePushDelivery:vi.fn()}));
vi.mock("../../src/features/notices/input",()=>({parseNoticeRequest:vi.fn()}));
import {DELETE} from "../../app/api/admin/notices/[id]/route";
const id="11111111-1111-4111-8111-111111111111",context={params:Promise.resolve({id})};
const request=(origin="https://app.test",site="same-origin")=>new Request("https://app.test/api/admin/notices/"+id,{method:"DELETE",headers:{origin,"sec-fetch-site":site}});
beforeEach(()=>{vi.resetAllMocks();m.session.mockResolvedValue({id:"pastor",role:"admin"});});
it("requires an administrator and rejects cross-site deletion before accessing records",async()=>{for(const user of [null,{id:"member",role:"member"}]){m.session.mockResolvedValue(user);expect((await DELETE(request(),context)).status).toBe(403);}m.session.mockResolvedValue({id:"pastor",role:"admin"});expect((await DELETE(request("https://evil.test"),context)).status).toBe(403);expect((await DELETE(request("https://app.test","cross-site"),context)).status).toBe(403);expect(m.remove).not.toHaveBeenCalled();});
it("removes only the requested notice for an authenticated administrator",async()=>{expect((await DELETE(request(),context)).status).toBe(200);expect(m.remove).toHaveBeenCalledExactlyOnceWith(id);});
