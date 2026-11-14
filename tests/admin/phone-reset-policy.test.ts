import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mocks.getDb }));

import { resetRosterPassword } from "../../src/features/admin/roster-service";
import { phoneLookupHash } from "../../src/features/auth/crypto";

const rosterId = "11111111-1111-4111-8111-111111111111";

function databaseFor(passwordHash: string | null) {
  const query = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{
      id: rosterId,
      canonicalName: "테스트회원",
      phoneLookupHash: phoneLookupHash("01012345678"),
      phoneCiphertext: "private-ciphertext-not-needed-for-rejection",
      passwordHash,
      userId: "22222222-2222-4222-8222-222222222222",
    }]),
  };
  const db = {
    select: vi.fn().mockReturnValue(query),
    transaction: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };
  mocks.getDb.mockReturnValue(db);
  return db;
}

function expectNoWrites(db: ReturnType<typeof databaseFor>) {
  expect(db.transaction).not.toHaveBeenCalled();
  expect(db.update).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.delete).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.DATABASE_URL = "postgres://example";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
});

describe("admin phone password reset policy", () => {
  it("rejects a direct phone reset for a custom-password account before any write", async () => {
    const db = databaseFor("existing-custom-password-hash");

    await expect(resetRosterPassword(rosterId, null)).rejects.toMatchObject({
      code: "PHONE_RESET_DISABLED", status: 409,
    });

    expect(db.select).toHaveBeenCalledTimes(1);
    expectNoWrites(db);
  });

  it.each([null, "existing-custom-password-hash"])("rejects setting an own-phone custom password with stored hash %s", async passwordHash => {
    const db = databaseFor(passwordHash);

    await expect(resetRosterPassword(rosterId, "(010) 1234-5678")).rejects.toMatchObject({
      code: "PASSWORD_IS_PHONE", status: 400,
    });

    expect(db.select).toHaveBeenCalledTimes(1);
    expectNoWrites(db);
  });
});
