import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ db: vi.fn(), verify: vi.fn(), reserve: vi.fn(), clear: vi.fn(), session: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mock.db }));
vi.mock("../../src/features/auth/crypto", () => ({ verifyPassword: mock.verify }));
vi.mock("../../src/features/auth/rate-limit", () => ({ reserveAccountLoginAttempt: mock.reserve, clearAccountLoginFailures: mock.clear }));
vi.mock("../../src/features/auth/session", () => ({ createSession: mock.session, SESSION_MAX_AGE_SECONDS: 15552000 }));
import { authenticatePinDevice, getPinDeviceAccount, rememberPinDevice } from "../../src/features/auth/pin-device";
import { signPinDevice, readPinDevice } from "../../src/features/auth/pin-device-cookie";
const row = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "가상성도", passwordHash: "synthetic-hash" };
function database(result: unknown[]) {
  const query = { innerJoin: () => query, where: () => query, limit: async () => result };
  mock.db.mockReturnValue({ select: () => ({ from: () => query }) });
}
beforeEach(() => {
  vi.resetAllMocks(); process.env.DATABASE_URL = "postgres://example"; process.env.SESSION_SECRET = "s".repeat(32); process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
  database([row]); mock.reserve.mockResolvedValue(true); mock.verify.mockResolvedValue(true); mock.session.mockResolvedValue({ token: "new-session" });
});
describe("device PIN authentication", () => {
  it("issues a session only for the account in the signed proof after checking the PIN", async () => {
    const result = await authenticatePinDevice(signPinDevice(row.id, row.passwordHash), "864209");
    expect(mock.verify).toHaveBeenCalledExactlyOnceWith(row.passwordHash, "864209");
    expect(mock.reserve).toHaveBeenCalledExactlyOnceWith(row.name);
    expect(mock.session).toHaveBeenCalledExactlyOnceWith(row.id);
    expect(result.token).toBe("new-session");
    expect(readPinDevice(result.device)?.userId).toBe(row.id);
  });
  it("does not issue a session for a wrong number", async () => {
    mock.verify.mockResolvedValue(false);
    await expect(authenticatePinDevice(signPinDevice(row.id, row.passwordHash), "864209")).rejects.toMatchObject({ code: "PIN_MISMATCH" });
    expect(mock.session).not.toHaveBeenCalled(); expect(mock.clear).not.toHaveBeenCalled();
  });
  it("blocks guessing regardless of the incoming IP before invoking the password hasher", async () => {
    mock.reserve.mockResolvedValue(false);
    await expect(authenticatePinDevice(signPinDevice(row.id, row.passwordHash), "864209")).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    expect(mock.verify).not.toHaveBeenCalled(); expect(mock.session).not.toHaveBeenCalled();
  });
  it("rejects unregistered devices, invalid PINs and invalidated accounts", async () => {
    await expect(authenticatePinDevice(undefined, "864209")).rejects.toMatchObject({ code: "PIN_DEVICE_EXPIRED" });
    await expect(authenticatePinDevice(signPinDevice(row.id, row.passwordHash), "12345x")).rejects.toMatchObject({ code: "INVALID_PIN" });
    expect(mock.db).not.toHaveBeenCalled();
    database([]);
    await expect(authenticatePinDevice(signPinDevice(row.id, row.passwordHash), "864209")).rejects.toMatchObject({ code: "PIN_DEVICE_EXPIRED" });
    expect(mock.session).not.toHaveBeenCalled();
  });
  it("invalidates the remembered proof immediately after a password reset or change", async () => {
    const token = signPinDevice(row.id, row.passwordHash);
    database([{ ...row, passwordHash: "replacement-hash" }]);
    expect(await getPinDeviceAccount(token)).toBeNull();
    await expect(authenticatePinDevice(token, "864209")).rejects.toMatchObject({ code: "PIN_DEVICE_EXPIRED" });
    expect(mock.verify).not.toHaveBeenCalled();
  });
  it("does not register a stale setup if another password change won the race", async () => {
    mock.verify.mockResolvedValue(false);
    await expect(rememberPinDevice(row.id, "864209")).rejects.toMatchObject({ code: "PIN_SETUP_RETRY" });
  });
});
