import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), counts: vi.fn(), seen: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: mock.session }));
vi.mock("../../src/features/menu-activity/service", () => ({ getMenuActivityCounts: mock.counts, acknowledgeMenuActivity: mock.seen }));
import { GET, POST } from "../../app/api/menu-activity/route";
const origin = "https://samduk45.vercel.app";
const observedAt = "2026-11-05T06:00:00.123456Z";
const request = (body: unknown, source = origin) => new Request(origin + "/api/menu-activity", { method: "POST", headers: { origin: source, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mock.session.mockResolvedValue({ id: "authenticated-viewer", role: "member" }); mock.counts.mockResolvedValue({ community: 2, members: 1 }); });
describe("private menu activity API", () => {
  it("authenticates reads and writes before accessing data", async () => {
    mock.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ kind: "members", observedAt }))).status).toBe(401);
    expect(mock.counts).not.toHaveBeenCalled(); expect(mock.seen).not.toHaveBeenCalled();
  });
  it("returns aggregate counts for the signed-in viewer with private caching", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ community: 2, members: 1 });
    expect(mock.counts).toHaveBeenCalledWith("authenticated-viewer");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
  it.each(["community", "members"])("marks only the current viewer's %s cursor, preserving microseconds", async kind => {
    expect((await POST(request({ kind, observedAt }))).status).toBe(200);
    expect(mock.seen).toHaveBeenCalledWith("authenticated-viewer", kind, observedAt);
  });
  it.each([
    { kind: "members", observedAt, userId: "another-viewer" },
    { kind: "notices", observedAt }, { kind: "members", observedAt: "invalid" },
    { kind: "members" },
  ])("rejects invalid or impersonated cursor writes", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mock.seen).not.toHaveBeenCalled();
  });
  it("rejects cross-origin, malformed and oversized writes", async () => {
    expect((await POST(request({ kind: "members", observedAt }, "https://untrusted.invalid"))).status).toBe(403);
    expect((await POST(new Request(origin + "/api/menu-activity", { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{" }))).status).toBe(400);
    expect((await POST(request({ kind: "members", observedAt, padding: "x".repeat(2048) }))).status).toBe(413);
    expect(mock.seen).not.toHaveBeenCalled();
  });
  it("does not disclose database error details", async () => {
    mock.counts.mockRejectedValue(new Error("private database details"));
    const response = await GET(); expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "MENU_ACTIVITY_UNAVAILABLE" });
  });
});
