import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session:vi.fn(), strict:vi.fn(), broad:vi.fn(), ownTarget:vi.fn(), ownMembers:vi.fn(), adminMembers:vi.fn(), access:vi.fn(),
  submit:vi.fn(), getReport:vi.fn(), listReports:vi.fn(), txt:vi.fn(), status:vi.fn(), revision:vi.fn(), wakeup:vi.fn(),
}));
vi.mock("../../src/features/auth/http-session",()=>({getCurrentSessionUser:mocks.session}));
vi.mock("../../src/features/pastoral/access",()=>({
  requireMemberLeaderReportAccess:mocks.strict,requireReportAccess:mocks.broad,requireOwnReportTarget:mocks.ownTarget,
  getOwnReportSamMembers:mocks.ownMembers,getReportSamMembers:mocks.adminMembers,memberLeaderReportAccess:mocks.access,
}));
vi.mock("../../src/features/pastoral/member-submissions",()=>({submitMemberReport:mocks.submit}));
vi.mock("../../src/features/pastoral/schedules",()=>({pastoralStatus:mocks.status}));
vi.mock("../../src/features/pastoral/edit-http",()=>({revisionResponse:mocks.revision}));
vi.mock("../../src/features/email/wakeup",()=>({scheduleEmailDelivery:mocks.wakeup}));
vi.mock("../../src/features/pastoral/reports",()=>({
  cancelDraft:vi.fn(),getReport:mocks.getReport,getReportChunk:vi.fn(),getReportImage:vi.fn(),getReportText:mocks.txt,
  listReports:mocks.listReports,publishReport:vi.fn(),putReportChunk:vi.fn(),
}));
import { GET, POST, DELETE } from "../../app/api/pastoral/[...path]/route";
import { ReportError } from "../../src/features/pastoral/policy";

const actor={id:"account",role:"member",displayName:"가상리더"};
const context=(...path:string[])=>({params:Promise.resolve({path})});
const request=(method="GET",body?:unknown,headers:Record<string,string>={})=>new Request("https://app.example/api/pastoral/submit",{
  method,headers:{...(body===undefined?{}:{"content-type":"application/json"}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),
});
beforeEach(()=>{
  vi.resetAllMocks();mocks.session.mockResolvedValue(actor);mocks.strict.mockResolvedValue({visible:true});mocks.broad.mockResolvedValue({visible:true});
  mocks.submit.mockResolvedValue({id:"report",submitted:true});mocks.revision.mockResolvedValue(null);
});

describe("member pastoral route boundary",()=>{
  it("requires a session and actual leader permission before accepting submissions",async()=>{
    mocks.session.mockResolvedValue(null);
    expect((await POST(request("POST",{}),context("submit"))).status).toBe(401);
    mocks.session.mockResolvedValue({...actor,role:"admin"});mocks.strict.mockRejectedValue(new ReportError("FORBIDDEN",403));
    expect((await POST(request("POST",{}),context("submit"))).status).toBe(403);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("passes only the authenticated actor and bounded JSON into atomic submission",async()=>{
    const payload={id:"report",form:{}};
    const response=await POST(request("POST",payload),context("submit"));
    expect(response.status).toBe(201);expect(await response.json()).toEqual({id:"report",submitted:true});
    expect(mocks.submit).toHaveBeenCalledWith(actor,payload);expect(mocks.wakeup).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects cross-origin and non-JSON submissions before the service runs",async()=>{
    expect((await POST(request("POST",{}, {origin:"https://unrelated.example"}),context("submit"))).status).toBe(403);
    expect((await POST(request("POST",{}, {"content-type":"text/plain"}),context("submit"))).status).toBe(415);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("does not expose the retired draft-creation path to a leader",async()=>{
    const response=await POST(request("POST",{}),context("reports"));
    expect(response.status).toBe(409);expect(await response.json()).toEqual({code:"FORM_SUBMISSION_REQUIRED"});
  });
  it("resolves composition identity on the server and does not request any schedule",async()=>{
    const sam={id:"sam",name:"3-1"};mocks.ownTarget.mockResolvedValue({sam,identity:{sourceName:"가상리더A"}});
    const response=await GET(request(),context("compose"));
    expect(response.status).toBe(200);expect(await response.json()).toMatchObject({sam,authorName:"가상리더A"});
    expect(mocks.ownTarget).toHaveBeenCalledWith(actor);expect(mocks.status).not.toHaveBeenCalled();
  });
  it("keeps administrator review detail and TXT readable without granting member submission access",async()=>{
    mocks.session.mockResolvedValue({...actor,role:"admin"});mocks.strict.mockRejectedValue(new ReportError("FORBIDDEN",403));
    mocks.getReport.mockResolvedValue({id:"report",submittedAt:"2027-01-01"});
    expect((await GET(request(),context("reports","report"))).status).toBe(200);
    mocks.txt.mockResolvedValue({text:"가상 과거 목양지",filename:"가상목양지.txt"});
    const txt=await GET(request(),context("reports","report","txt"));
    expect(txt.status).toBe(200);expect(await txt.text()).toBe("가상 과거 목양지");expect(mocks.strict).not.toHaveBeenCalled();
    expect((await DELETE(request("DELETE"),context("reports","report"))).status).toBe(403);
  });
});
