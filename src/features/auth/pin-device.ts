import { and, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { memberRoster, users } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { verifyPassword } from "./crypto";
import { pinCredentialTag, readPinDevice, signPinDevice } from "./pin-device-cookie";
import { isSixDigitPin } from "./pin-policy";
import { clearAccountLoginFailures, reserveAccountLoginAttempt } from "./rate-limit";
import { createSession } from "./session";

async function account(userId: string) {
  const [row] = await getDb().select({ id: users.id, name: memberRoster.canonicalName, passwordHash: memberRoster.passwordHash })
    .from(users).innerJoin(memberRoster, eq(users.rosterId, memberRoster.id))
    .where(and(eq(users.id, userId), eq(users.isActive, true), eq(memberRoster.isActive, true))).limit(1);
  return row?.passwordHash ? row : null;
}

export async function getPinDeviceAccount(cookie: string | undefined) {
  const proof = readPinDevice(cookie);
  if (!proof) return null;
  const row = await account(proof.userId);
  return row?.passwordHash && pinCredentialTag(row.passwordHash) === proof.credential ? row : null;
}

export async function rememberPinDevice(userId: string, pin: string) {
  if (!isSixDigitPin(pin)) throw new DomainError("INVALID_PIN", 400);
  const row = await account(userId);
  if (!row?.passwordHash || !await verifyPassword(row.passwordHash, pin)) throw new DomainError("PIN_SETUP_RETRY", 409);
  return signPinDevice(userId, row.passwordHash);
}

export async function authenticatePinDevice(cookie: string | undefined, pin: string) {
  if (!isSixDigitPin(pin)) throw new DomainError("INVALID_PIN", 400);
  const row = await getPinDeviceAccount(cookie);
  if (!row?.passwordHash) throw new DomainError("PIN_DEVICE_EXPIRED", 401);
  if (!await reserveAccountLoginAttempt(row.name)) throw new DomainError("TOO_MANY_ATTEMPTS", 429);
  if (!await verifyPassword(row.passwordHash, pin)) throw new DomainError("PIN_MISMATCH", 401);
  await clearAccountLoginFailures(row.name);
  const session = await createSession(row.id);
  return { token: session.token, device: signPinDevice(row.id, row.passwordHash) };
}
