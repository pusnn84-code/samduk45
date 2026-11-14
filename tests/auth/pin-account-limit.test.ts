import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mock.db }));
import { reserveAccountLoginAttempt } from "../../src/features/auth/rate-limit";
let state: { windowStartedAt: Date; failureCount: number; blockedUntil: Date | null };
let lock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  process.env.DATABASE_URL = "postgres://example"; process.env.SESSION_SECRET = "s".repeat(32); process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
  state = { windowStartedAt: new Date("2026-11-11T00:00:00Z"), failureCount: 0, blockedUntil: null };
  lock = vi.fn(async () => [state]);
  const tx = { insert: () => ({ values: () => ({ onConflictDoNothing: async () => [] }) }),
    select: () => ({ from: () => ({ where: () => ({ for: lock }) }) }),
    update: () => ({ set: (next: typeof state) => ({ where: async () => { state = next; } }) }),
  };
  mock.db.mockReturnValue({ transaction: async (work: (arg: typeof tx) => Promise<boolean>) => work(tx) });
});
describe("account-wide PIN attempt reservation", () => {
  it("reserves only eight checks in the same window, under a database row lock", async () => {
    const now = new Date("2026-11-11T00:00:00Z");
    for (let attempt = 0; attempt < 8; attempt++) expect(await reserveAccountLoginAttempt("가상성도", now)).toBe(true);
    expect(await reserveAccountLoginAttempt("가상성도", now)).toBe(false);
    expect(state.failureCount).toBe(8);
    expect(lock).toHaveBeenCalledWith("update");
  });
  it("allows a fresh window after the 15-minute lock expires", async () => {
    state.failureCount = 8; state.blockedUntil = new Date("2026-11-11T00:15:00Z");
    expect(await reserveAccountLoginAttempt("가상성도", new Date("2026-11-11T00:15:01Z"))).toBe(true);
    expect(state.failureCount).toBe(1); expect(state.blockedUntil).toBeNull();
  });
});
