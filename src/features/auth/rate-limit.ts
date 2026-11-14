import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { authRateLimits } from "../../db/schema";
import { getEnv } from "../../lib/env";
import { normalizeName } from "./crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export type FailureState = {
  windowStartedAt: Date;
  failureCount: number;
  blockedUntil: Date | null;
};

export function nextFailureState(
  previous: FailureState | null,
  now = new Date(),
): FailureState {
  const expired =
    !previous || now.getTime() - previous.windowStartedAt.getTime() >= WINDOW_MS;

  if (expired) {
    return { windowStartedAt: now, failureCount: 1, blockedUntil: null };
  }

  const failureCount = previous.failureCount + 1;
  return {
    windowStartedAt: previous.windowStartedAt,
    failureCount,
    blockedUntil:
      failureCount >= MAX_FAILURES
        ? new Date(now.getTime() + WINDOW_MS)
        : previous.blockedUntil,
  };
}

function keyHash(name: string, ip: string): string {
  return createHmac("sha256", getEnv().SESSION_SECRET)
    .update(`${normalizeName(name)}\n${ip || "unknown"}`)
    .digest("hex");
}

export async function isLoginBlocked(name: string, ip: string, now = new Date()): Promise<boolean> {
  const [row] = await getDb()
    .select({ blockedUntil: authRateLimits.blockedUntil })
    .from(authRateLimits)
    .where(eq(authRateLimits.keyHash, keyHash(name, ip)))
    .limit(1);
  return Boolean(row?.blockedUntil && row.blockedUntil > now);
}

export async function recordLoginFailure(
  name: string,
  ip: string,
  now = new Date(),
): Promise<FailureState> {
  const hash = keyHash(name, ip);
  const [row] = await getDb()
    .select({
      windowStartedAt: authRateLimits.windowStartedAt,
      failureCount: authRateLimits.failureCount,
      blockedUntil: authRateLimits.blockedUntil,
    })
    .from(authRateLimits)
    .where(eq(authRateLimits.keyHash, hash))
    .limit(1);

  const next = nextFailureState(row ?? null, now);
  await getDb()
    .insert(authRateLimits)
    .values({ keyHash: hash, ...next })
    .onConflictDoUpdate({
      target: authRateLimits.keyHash,
      set: next,
    });
  return next;
}

export async function clearLoginFailures(name: string, ip: string): Promise<void> {
  await getDb().delete(authRateLimits).where(eq(authRateLimits.keyHash, keyHash(name, ip)));
}

/** Reserve before verification, under a row lock, so parallel requests and IP changes cannot bypass the PIN limit. */
export async function reserveAccountLoginAttempt(name: string, now = new Date()): Promise<boolean> {
  const hash = keyHash(name, "account-global");
  return getDb().transaction(async tx => {
    await tx.insert(authRateLimits).values({ keyHash: hash, windowStartedAt: now, failureCount: 0, blockedUntil: null }).onConflictDoNothing();
    const [row] = await tx.select().from(authRateLimits).where(eq(authRateLimits.keyHash, hash)).for("update");
    if (!row || (row.blockedUntil && row.blockedUntil > now)) return false;
    await tx.update(authRateLimits).set(nextFailureState(row, now)).where(eq(authRateLimits.keyHash, hash));
    return true;
  });
}

export async function clearAccountLoginFailures(name: string): Promise<void> {
  await clearLoginFailures(name, "account-global");
}
