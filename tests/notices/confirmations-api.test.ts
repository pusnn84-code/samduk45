import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../src/lib/http";
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), confirm: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: mocks.session }));
vi.mock("../../src/features/notices/confirmations", () => ({ getNoticeConfirmations: mocks.get, confirmNotice: mocks.confirm }));
import { GET, POST } from "../../app/api/notices/[id]/confirmations/route";

const id = "11111111-1111-4111-8111-111111111111", revision = "a".repeat(32);
const context = { params: Promise.resolve({ id }) };
const user = { id: "leader-account", displayName: "가상리더", role: "member" };
const state = { revision, canConfirm: true, ownConfirmedAt: null, confirmed: [], unconfirmed: [] };
const request = (body: unknown = { revision }, origin = "https://samduk45.vercel.app") => new Request(`https://samduk45.vercel.app/api/notices/${id}/confirmations`, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });

beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue(user); mocks.get.mockResolvedValue(state); mocks.confirm.mockResolvedValue(state); });
describe("notice explicit confirmation routes", () => {
  it.each(["GET", "POST"])("requires a session before accessing %s records", async method => {
    mocks.session.mockResolvedValue(null);
    const response = method === "GET" ? await GET(request(), context) : await POST(request(), context);
    expect(response.status).toBe(401); expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("does not expose names to ordinary members", async () => {
    mocks.get.mockResolvedValue(null);
    const response = await GET(request(), context);
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ code: "FORBIDDEN" });
  });
  it("allows an authorized member leader, without requiring the admin role", async () => {
    const response = await GET(request(), context);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.get).toHaveBeenCalledWith(id, user);
  });
  it("records only the authenticated actor and the revision actually read", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200); expect(mocks.confirm).toHaveBeenCalledWith(id, user, revision);
  });
  it("rejects a forged target identity instead of confirming for somebody else", async () => {
    const response = await POST(request({ revision, rosterId: "another-person" }), context);
    expect(response.status).toBe(400); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("rejects cross-site requests before any write", async () => {
    const response = await POST(request({ revision }, "https://unrelated.example"), context);
    expect(response.status).toBe(403); expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it("returns a reconfirmation conflict when notice content changed", async () => {
    mocks.confirm.mockRejectedValue(new DomainError("NOTICE_CHANGED", 409));
    const response = await POST(request(), context);
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ code: "NOTICE_CHANGED" });
  });
  it("does not reveal draft/nonexistent notices", async () => {
    mocks.get.mockRejectedValue(new DomainError("NOTICE_NOT_FOUND", 404));
    expect((await GET(request(), context)).status).toBe(404);
  });
  it("validates UUIDs and revision tokens", async () => {
    expect((await GET(request(), { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(400);
    expect((await POST(request({ revision: "old" }), context)).status).toBe(400);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
