vi.mock("../../src/features/visits/shared-calendar", () => ({ recipientForVisit: vi.fn(async () => ({recipientName:"검증대상",recipientSam:"1-2샘"})) }));
import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ session: vi.fn(), create: vi.fn(), submit: vi.fn(), own: vi.fn(), transition: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: boundary.session }));
vi.mock("../../src/features/email/wakeup", () => ({ scheduleEmailDelivery: vi.fn() }));
vi.mock("../../src/features/visits/internal-calendar", async original => ({
  ...await original<typeof import("../../src/features/visits/internal-calendar")>(),
  createInternalAppointment: boundary.create, submitInternalVisit: boundary.submit, listOwnVisits: boundary.own, transitionInternalVisit: boundary.transition,
}));
import { POST as create } from "../../app/api/admin/visits/route";
import { POST as submit, GET as own } from "../../app/api/visits/route";
import { POST as confirm } from "../../app/api/admin/visits/[id]/confirm/route";

const details = { visitDate: "2099-10-08", visitType: "personal", attendees: "가상대상" };
const request = (body: unknown = details) => new Request("https://example.test/api/visits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); boundary.create.mockResolvedValue({ id: "created" }); boundary.submit.mockResolvedValue({ id: "requested" }); });
describe("pastor-only scheduling", () => {
  it.each([null, { id: "member", role: "member" }])("denies direct creation and confirmation for non-admin %j", async user => {
    boundary.session.mockResolvedValue(user);
    expect((await create(request())).status).toBe(403);
    expect((await confirm(request(), { params: Promise.resolve({ id: "saved" }) })).status).toBe(403);
    expect(boundary.create).not.toHaveBeenCalled(); expect(boundary.transition).not.toHaveBeenCalled();
  });
  it("uses the authenticated pastor identity for direct registration", async () => {
    boundary.session.mockResolvedValue({ id: "pastor", role: "admin" });
    expect((await create(request())).status).toBe(201);
    expect(boundary.create).toHaveBeenCalledWith(expect.objectContaining({ requesterUserId: "pastor", attendees: "가상대상" }));
  });
  it("immediately confirms an admin's entry through the shared visit screen", async () => {
    boundary.session.mockResolvedValue({ id: "pastor", role: "admin" });
    const response = await submit(request());
    expect(response.status).toBe(201);
    expect(boundary.create).toHaveBeenCalledWith({ ...details, recipientName:"검증대상",recipientSam:"1-2샘", requesterUserId: "pastor", location: "", preferredTime: "", reason: "" }, undefined, "confirmed");
    expect(boundary.submit).not.toHaveBeenCalled();
  });
  it("does not allow a member to forge a confirmed appointment or another requester", async () => {
    boundary.session.mockResolvedValue({ id: "member", role: "member" });
    const body = { ...details, status: "confirmed", requesterUserId: "someone-else", role: "admin" };
    expect((await submit(request(body))).status).toBe(201);
    expect(boundary.submit).toHaveBeenCalledWith({ ...details, recipientName:"검증대상",recipientSam:"1-2샘", requesterUserId: "member", location: "", preferredTime: "", reason: "" });
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("accepts an admin's pending selection and rejects a member's status choice", async () => {
    boundary.session.mockResolvedValue({id:"pastor",role:"admin"});
    expect((await submit(request({...details,appointmentStatus:"requested"}))).status).toBe(201);
    expect(boundary.create).toHaveBeenCalledWith(expect.objectContaining({requesterUserId:"pastor"}),undefined,"requested");
    boundary.create.mockClear();boundary.session.mockResolvedValue({id:"member",role:"member"});
    expect((await submit(request({...details,appointmentStatus:"confirmed"}))).status).toBe(403);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("returns only the current user's requests with private cache headers", async () => {
    boundary.session.mockResolvedValue({ id: "member", role: "member" }); boundary.own.mockResolvedValue([]);
    const response = await own(); expect(response.status).toBe(200);
    expect(boundary.own).toHaveBeenCalledWith("member");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("requires login before reading request history", async () => {
    boundary.session.mockResolvedValue(null); expect((await own()).status).toBe(401); expect(boundary.own).not.toHaveBeenCalled();
  });
});
