import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/lib/env", () => ({ getEnv: () => ({ SESSION_SECRET: process.env.SESSION_SECRET }) }));
import { signPinDevice, readPinDevice, pinCredentialTag, pinDeviceCookieOptions } from "../../src/features/auth/pin-device-cookie";
import { isSixDigitPin } from "../../src/features/auth/pin-policy";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = new Date("2026-11-11T00:00:00Z");
beforeEach(() => { process.env.DATABASE_URL = "postgres://example"; process.env.SESSION_SECRET = "s".repeat(32); process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32); });
describe("remembered PIN device proof", () => {
  it("binds a random opaque proof to one account and credential version without storing a PIN", () => {
    const token = signPinDevice(id, "synthetic-argon-hash", now);
    const proof = readPinDevice(token, now)!;
    expect(proof.userId).toBe(id);
    expect(proof.credential).toBe(pinCredentialTag("synthetic-argon-hash"));
    expect(proof).not.toHaveProperty("pin");
    expect(Buffer.from(token.split(".")[0], "base64url").toString()).not.toContain("synthetic-argon-hash");
    expect(signPinDevice(id, "synthetic-argon-hash", now)).not.toBe(token);
    expect(pinCredentialTag("replacement-hash")).not.toBe(proof.credential);
  });
  it("rejects altered signatures, altered accounts, expired cookies and signing-key changes", () => {
    const token = signPinDevice(id, "hash", now);
    const [body, signature] = token.split(".");
    const modified = Buffer.from(JSON.stringify({ ...readPinDevice(token, now), userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).toString("base64url");
    expect(readPinDevice(modified + "." + signature, now)).toBeNull();
    expect(readPinDevice(body + "." + "0".repeat(64), now)).toBeNull();
    expect(readPinDevice(token + ".extra", now)).toBeNull();
    expect(readPinDevice(token, new Date("2027-06-01"))).toBeNull();
    process.env.SESSION_SECRET = "x".repeat(32);
    expect(readPinDevice(token, now)).toBeNull();
  });
  it.each([undefined, "", "not-a-cookie", ".", "x".repeat(2000)])("rejects malformed proofs without throwing", value => expect(readPinDevice(value, now)).toBeNull());
  it("uses an HttpOnly, same-site, secure production cookie", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(pinDeviceCookieOptions()).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 15552000 });
    vi.unstubAllEnvs();
  });
  it("accepts exactly six ASCII digits including a leading zero", () => {
    expect(isSixDigitPin("012345")).toBe(true);
    for (const pin of ["12345", "1234567", "12345a", " 123456", "１２３４５６", "123 45", ""]) expect(isSixDigitPin(pin)).toBe(false);
  });
});
