import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ setup: vi.fn(), save: vi.fn(), session: vi.fn(), set: vi.fn(), remove: vi.fn(), remember: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mock.set, delete: mock.remove }) }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentPasswordSetupSession: mock.setup }));
vi.mock("../../src/features/auth/session", () => ({ createSession: mock.session, PASSWORD_SETUP_COOKIE_NAME: "prayer_password_setup", SESSION_COOKIE_NAME: "prayer_session", sessionCookieOptions: () => ({ httpOnly: true }) }));
vi.mock("../../src/features/profile/service", () => ({ changeProfilePassword: mock.save }));
vi.mock("../../src/features/auth/pin-device", () => ({ rememberPinDevice: mock.remember }));
import { POST } from "../../app/api/auth/set-password/route";
import { DomainError } from "../../src/lib/http";
const origin = "https://samduk45.vercel.app";
const password = "864209";
const request = (body: unknown = { password, confirmation: password }, source = origin) => new Request(origin + "/api/auth/set-password", { method: "POST", headers: { origin: source, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mock.setup.mockResolvedValue({ user: { id: "verified-viewer" }, token: "pending-proof" }); mock.session.mockResolvedValue({ token: "new-normal-token" }); mock.remember.mockResolvedValue("signed-device"); });
describe("required password setup", () => {
  it("issues a fresh normal session only after the verified account's password is saved", async () => {
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(mock.save).toHaveBeenCalledExactlyOnceWith("verified-viewer", password, "pending-proof");
    expect(mock.session.mock.invocationCallOrder[0]).toBeGreaterThan(mock.save.mock.invocationCallOrder[0]);
    expect(mock.set).toHaveBeenCalledWith("prayer_session", "new-normal-token", { httpOnly: true });
    expect(mock.set).toHaveBeenCalledWith("prayer_pin_device", "signed-device", { httpOnly: true });
    expect(mock.remember).toHaveBeenCalledExactlyOnceWith("verified-viewer", password);
    expect(mock.remove).toHaveBeenCalledWith("prayer_password_setup");
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
  it("requires unexpired initial-credential proof before changing a password", async () => {
    mock.setup.mockResolvedValue(null); expect((await POST(request())).status).toBe(401); expect(mock.save).not.toHaveBeenCalled();
  });
  it.each([
    { password, confirmation: "different-password" }, { password: "short", confirmation: "short" },
    { password: "12345", confirmation: "12345" }, { password: "1234567", confirmation: "1234567" },
    { password: "12345a", confirmation: "12345a" },
    { password, confirmation: password, userId: "someone-else" },
  ])("rejects invalid passwords, mismatched confirmations and impersonated identities", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mock.save).not.toHaveBeenCalled();
  });
  it("does not create a normal session if saving the password fails", async () => {
    mock.save.mockRejectedValue(new DomainError("PASSWORD_IS_PHONE", 400));
    expect((await POST(request())).status).toBe(400); expect(mock.session).not.toHaveBeenCalled(); expect(mock.set).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and oversized requests", async () => {
    expect((await POST(request(undefined, "https://untrusted.invalid"))).status).toBe(403);
    expect((await POST(request({ password: "x".repeat(20000), confirmation: "x".repeat(20000) }))).status).toBe(413);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("does not leak private errors or passwords", async () => {
    mock.save.mockRejectedValue(new Error("private details"));
    const response = await POST(request()); expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: "PASSWORD_SETUP_UNAVAILABLE" });
  });
});
