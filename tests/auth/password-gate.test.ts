import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ db: vi.fn(), state: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mock.db }));
vi.mock("../../src/features/auth/password-state", () => ({ rosterPasswordState: mock.state }));
import { createSession, getPasswordSetupUser, getSessionUser, PASSWORD_SETUP_MAX_AGE_SECONDS } from "../../src/features/auth/session";
const row = { id: "synthetic-viewer", displayName: "가상성도", samId: null, role: "member", passwordHash: "private-hash", phoneCiphertext: "private-cipher" };
beforeEach(() => {
  vi.resetAllMocks(); process.env.DATABASE_URL = "postgres://example"; process.env.SESSION_SECRET = "s".repeat(32); process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
  mock.state.mockResolvedValue("initial");
  const query = { innerJoin: () => query, where: () => query, limit: async () => [row] };
  mock.db.mockReturnValue({ select: () => ({ from: () => query }) });
});
describe("initial password session boundary", () => {
  it("rejects old phone-password sessions for member access, even if the token exists", async () => {
    expect(await getSessionUser("existing-token")).toBeNull();
    expect(await getPasswordSetupUser("existing-token")).toEqual({ id: row.id, displayName: row.displayName, samId: null, role: "member" });
  });
  it("permits only custom-password sessions and strips credential fields", async () => {
    mock.state.mockResolvedValue("custom");
    const user = await getSessionUser("custom-token");
    expect(user).toEqual({ id: row.id, displayName: row.displayName, samId: null, role: "member" });
    expect(user).not.toHaveProperty("passwordHash"); expect(user).not.toHaveProperty("phoneCiphertext");
    expect(await getPasswordSetupUser("custom-token")).toBeNull();
  });
  it("fails closed when credential checks cannot be completed", async () => {
    mock.state.mockResolvedValue("unavailable");
    expect(await getSessionUser("token")).toBeNull(); expect(await getPasswordSetupUser("token")).toBeNull();
  });
  it("does not query for missing tokens", async () => {
    expect(await getSessionUser("")).toBeNull(); expect(await getPasswordSetupUser("")).toBeNull(); expect(mock.db).not.toHaveBeenCalled();
  });
  it("creates a 15-minute setup proof without recording a completed first login", async () => {
    const values = vi.fn(); const update = vi.fn();
    mock.db.mockReturnValue({ transaction: async (work: (tx: unknown) => Promise<void>) => work({ insert: () => ({ values }), update }) });
    const now = new Date("2026-11-05T07:00:00Z");
    const session = await createSession("viewer", now, { passwordSetup: true });
    expect(session.expiresAt.getTime() - now.getTime()).toBe(PASSWORD_SETUP_MAX_AGE_SECONDS * 1000);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: "viewer", expiresAt: session.expiresAt }));
    expect(values.mock.calls[0][0].tokenHash).not.toBe(session.token);
    expect(update).not.toHaveBeenCalled();
  });
});
