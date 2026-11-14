import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://example";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
});

describe("authentication crypto", () => {
  it("normalizes formatted and unformatted Korean phone numbers identically", async () => {
    const { normalizePhone } = await import("../../src/features/auth/crypto");
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone("01012345678")).toBe("01012345678");
  });

  it("rejects values that are not plausible phone numbers", async () => {
    const { normalizePhone } = await import("../../src/features/auth/crypto");
    expect(() => normalizePhone("abc")).toThrow("INVALID_PHONE");
    expect(() => normalizePhone("123")).toThrow("INVALID_PHONE");
  });

  it("uses a stable secret lookup hash without storing the phone itself", async () => {
    const { phoneLookupHash } = await import("../../src/features/auth/crypto");
    const a = phoneLookupHash("010-1234-5678");
    const b = phoneLookupHash("01012345678");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).not.toContain("01012345678");
  });

  it.each([
    "01012345678",
    "010-1234-5678",
    " 010 1234 5678 ",
    "(010) 1234-5678",
    "010.1234.5678",
  ])("recognizes the account's own phone as an unsafe custom password: %s", async password => {
    const { isPhonePassword, phoneLookupHash } = await import("../../src/features/auth/crypto");
    expect(isPhonePassword(password, phoneLookupHash("01012345678"))).toBe(true);
  });

  it("keeps a different number or a passphrase containing digits distinct from the account phone", async () => {
    const { isPhonePassword, phoneLookupHash } = await import("../../src/features/auth/crypto");
    const lookup = phoneLookupHash("01012345678");
    expect(isPhonePassword("01099999999", lookup)).toBe(false);
    expect(isPhonePassword("우리집01012345678!", lookup)).toBe(false);
    expect(isPhonePassword("my-password-2027", lookup)).toBe(false);
  });

  it("handles missing credentials and malformed numeric passwords without throwing", async () => {
    const { isPhonePassword, phoneLookupHash } = await import("../../src/features/auth/crypto");
    expect(isPhonePassword("01012345678", null)).toBe(false);
    expect(isPhonePassword("01012345678", undefined)).toBe(false);
    const lookup = phoneLookupHash("01012345678");
    for (const password of ["", "123", " ", "---", "01234567890123456789"]) {
      expect(isPhonePassword(password, lookup)).toBe(false);
    }
  });

  it("hashes and verifies the phone with Argon2id", async () => {
    const { hashPhonePassword, verifyPhonePassword } = await import("../../src/features/auth/crypto");
    const hash = await hashPhonePassword("01012345678");
    expect(hash).not.toContain("01012345678");
    expect(hash).toContain("$argon2id$");
    await expect(verifyPhonePassword(hash, "01012345678")).resolves.toBe(true);
    await expect(verifyPhonePassword(hash, "01099999999")).resolves.toBe(false);
  });
});
