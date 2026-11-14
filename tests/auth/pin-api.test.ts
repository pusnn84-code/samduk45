import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ authenticate: vi.fn(), remember: vi.fn(), user: vi.fn(), save: vi.fn(), set: vi.fn(), remove: vi.fn(), blocked: vi.fn(), failure: vi.fn(), clear: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "opaque-device" }), set: mock.set, delete: mock.remove }) }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: mock.user }));
vi.mock("../../src/features/auth/pin-device", () => ({ authenticatePinDevice: mock.authenticate, rememberPinDevice: mock.remember }));
vi.mock("../../src/features/profile/service", () => ({ changeProfilePassword: mock.save }));
vi.mock("../../src/features/auth/rate-limit", () => ({ isLoginBlocked: mock.blocked, recordLoginFailure: mock.failure, clearLoginFailures: mock.clear }));
import { POST, PUT, DELETE } from "../../app/api/auth/pin/route";
import { DomainError } from "../../src/lib/http";
const origin = "https://samduk45.vercel.app";
const request = (method: string, body?: unknown, from = origin) => new Request(origin + "/api/auth/pin", { method, headers: { origin: from, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => {
  vi.resetAllMocks(); mock.user.mockResolvedValue({ id: "verified-user" }); mock.remember.mockResolvedValue("signed-device"); mock.authenticate.mockResolvedValue({ token: "new-session", device: "renewed-device" });
});
describe("PIN API boundaries", () => {
  it("sets HttpOnly cookies after a successful device PIN check and never returns credentials", async () => {
    const response = await POST(request("POST", { pin: "864209" }));
    expect(await response.json()).toEqual({ status: "ok" });
    expect(mock.authenticate).toHaveBeenCalledExactlyOnceWith("opaque-device", "864209");
    expect(mock.set).toHaveBeenCalledWith("prayer_session", "new-session", expect.objectContaining({ httpOnly: true }));
    expect(mock.set).toHaveBeenCalledWith("prayer_pin_device", "renewed-device", expect.objectContaining({ httpOnly: true }));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("requires an active full session to enroll a PIN; a setup proof alone is insufficient", async () => {
    mock.user.mockResolvedValue(null);
    expect((await PUT(request("PUT", { password: "864209", confirmation: "864209" }))).status).toBe(401);
    expect(mock.save).not.toHaveBeenCalled(); expect(mock.set).not.toHaveBeenCalled();
  });
  it("enrolls only the current session account after saving and rechecking the new credential", async () => {
    expect((await PUT(request("PUT", { password: "864209", confirmation: "864209" }))).status).toBe(200);
    expect(mock.save).toHaveBeenCalledExactlyOnceWith("verified-user", "864209");
    expect(mock.remember).toHaveBeenCalledExactlyOnceWith("verified-user", "864209");
    expect(mock.remember.mock.invocationCallOrder[0]).toBeGreaterThan(mock.save.mock.invocationCallOrder[0]);
  });
  it.each([{ pin: "12345" }, { pin: "1234567" }, { pin: "12345x" }, { pin: "864209", userId: "someone-else" }])("rejects malformed or identity-bearing login input", async body => {
    expect((await POST(request("POST", body))).status).toBe(400); expect(mock.authenticate).not.toHaveBeenCalled();
  });
  it("rejects mismatched confirmation and chosen account IDs during setup", async () => {
    for (const body of [{ password: "864209", confirmation: "864210" }, { password: "864209", confirmation: "864209", userId: "another" }]) {
      expect((await PUT(request("PUT", body))).status).toBe(400);
    }
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes, including forgetting the device", async () => {
    for (const [method, handler] of [["POST", POST], ["PUT", PUT], ["DELETE", DELETE]] as const) expect((await handler(request(method, undefined, "https://untrusted.invalid"))).status).toBe(403);
    expect(mock.set).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
  });
  it("preserves the remembered device during normal login failures, and clears expired registration", async () => {
    mock.authenticate.mockRejectedValue(new DomainError("PIN_MISMATCH", 401));
    expect((await POST(request("POST", { pin: "864209" }))).status).toBe(401);
    expect(mock.remove).not.toHaveBeenCalled(); expect(mock.set).not.toHaveBeenCalled();
    mock.authenticate.mockRejectedValue(new DomainError("PIN_DEVICE_EXPIRED", 401));
    await POST(request("POST", { pin: "864209" }));
    expect(mock.remove).toHaveBeenCalledWith("prayer_pin_device");
  });
  it("blocks requests from a throttled source and hides internal errors", async () => {
    mock.blocked.mockResolvedValue(true); expect((await POST(request("POST", { pin: "864209" }))).status).toBe(429);
    expect(mock.authenticate).not.toHaveBeenCalled();
    mock.blocked.mockResolvedValue(false); mock.authenticate.mockRejectedValue(new Error("private data"));
    const response = await POST(request("POST", { pin: "864209" })); expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: "PIN_UNAVAILABLE" });
  });
  it("allows returning to account selection without granting a session", async () => {
    expect((await DELETE(request("DELETE"))).status).toBe(200);
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith("prayer_pin_device"); expect(mock.set).not.toHaveBeenCalled();
  });
});
