import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ login: vi.fn(), set: vi.fn(), remove: vi.fn(), blocked: vi.fn(), failure: vi.fn(), clear: vi.fn(), reserve: vi.fn(), clearAccount: vi.fn(), remember: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mock.set, delete: mock.remove }) }));
vi.mock("../../src/features/auth/service", () => ({ authenticateRosterLogin: mock.login }));
vi.mock("../../src/features/auth/rate-limit", () => ({ isLoginBlocked: mock.blocked, recordLoginFailure: mock.failure, clearLoginFailures: mock.clear, reserveAccountLoginAttempt: mock.reserve, clearAccountLoginFailures: mock.clearAccount }));
vi.mock("../../src/features/auth/pin-device", () => ({ rememberPinDevice: mock.remember }));
import { POST } from "../../app/api/auth/login/route";
const origin = "https://samduk45.vercel.app";
const request = (source = origin) => new NextRequest(origin + "/api/auth/login", { method: "POST", headers: { origin: source, "content-type": "application/json" }, body: JSON.stringify({ name: "가상성도", password: "synthetic-password" }) });
beforeEach(() => { vi.resetAllMocks(); mock.reserve.mockResolvedValue(true); mock.remember.mockResolvedValue("device-proof"); mock.login.mockResolvedValue({ user: { id: "viewer" }, token: "opaque-proof", requiresPasswordChange: true }); mock.failure.mockResolvedValue({}); });
describe("two-step first login", () => {
  it("sets only the short setup cookie after an initial credential match", async () => {
    const response = await POST(request());
    expect(await response.json()).toEqual({ status: "password_change_required" });
    expect(mock.set).toHaveBeenCalledExactlyOnceWith("prayer_password_setup", "opaque-proof", expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 900 }));
    expect(mock.remove).toHaveBeenCalledWith("prayer_session");
  });
  it("lets an existing password authenticate before offering the 6-digit setup", async () => {
    mock.login.mockResolvedValue({ token: "normal-token", requiresPasswordChange: false });
    expect(await (await POST(request())).json()).toEqual({ status: "pin_setup_required" });
    expect(mock.set).toHaveBeenCalledExactlyOnceWith("prayer_session", "normal-token", expect.objectContaining({ maxAge: 60 * 60 * 24 * 180 }));
    expect(mock.remove).toHaveBeenCalledWith("prayer_password_setup");
  });
  it("blocks parallel or distributed account guessing before credential verification", async () => {
    mock.reserve.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(429);
    expect(mock.login).not.toHaveBeenCalled();
  });
  it("remembers a verified six-digit credential on the current device", async () => {
    mock.login.mockResolvedValue({ user: { id: "viewer" }, token: "normal-token", requiresPasswordChange: false });
    const input = new NextRequest(origin + "/api/auth/login", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ name: "가상성도", password: "864209" }) });
    expect(await (await POST(input)).json()).toEqual({ status: "ok" });
    expect(mock.remember).toHaveBeenCalledExactlyOnceWith("viewer", "864209");
    expect(mock.set).toHaveBeenCalledWith("prayer_pin_device", "device-proof", expect.objectContaining({ httpOnly: true }));
  });
  it("does not issue either cookie for incorrect credentials or a blocked login", async () => {
    mock.login.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
    mock.blocked.mockResolvedValue(true); expect((await POST(request())).status).toBe(429);
    expect(mock.set).not.toHaveBeenCalled();
  });
  it("blocks cross-origin login attempts before checking credentials", async () => {
    expect((await POST(request("https://untrusted.invalid"))).status).toBe(403); expect(mock.login).not.toHaveBeenCalled();
  });
});
