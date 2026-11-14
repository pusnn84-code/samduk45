import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "../../lib/env";
import { sessionCookieOptions, SESSION_MAX_AGE_SECONDS } from "./session";

export const PIN_DEVICE_COOKIE_NAME = "prayer_pin_device";
type DeviceProof = { version: 1; userId: string; credential: string; nonce: string; expires: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mac(value: string) {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(`pin-device-v1:${value}`).digest("hex");
}

export function pinCredentialTag(passwordHash: string) {
  return mac(`credential:${passwordHash}`);
}

export function pinDeviceCookieOptions() {
  return sessionCookieOptions();
}

export function signPinDevice(userId: string, passwordHash: string, now = new Date()): string {
  const proof: DeviceProof = { version: 1, userId, credential: pinCredentialTag(passwordHash),
    nonce: randomBytes(24).toString("base64url"), expires: now.getTime() + SESSION_MAX_AGE_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(proof)).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function readPinDevice(value: string | undefined, now = new Date()): DeviceProof | null {
  if (!value || value.length > 1024) return null;
  const [body, signature, extra] = value.split(".");
  if (!body || extra !== undefined || !/^[0-9a-f]{64}$/.test(signature ?? "")) return null;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(mac(body), "hex"))) return null;
  try {
    const proof = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as DeviceProof;
    if (proof.version !== 1 || !uuid.test(proof.userId) || !/^[0-9a-f]{64}$/.test(proof.credential)
      || !/^[A-Za-z0-9_-]{32}$/.test(proof.nonce) || !Number.isSafeInteger(proof.expires)
      || proof.expires <= now.getTime() || proof.expires > now.getTime() + SESSION_MAX_AGE_SECONDS * 1000) return null;
    return proof;
  } catch { return null; }
}
