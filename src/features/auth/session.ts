import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { memberRoster, sessions, users } from "../../db/schema";
import { newSessionToken, sessionTokenHash } from "./crypto";
import { rosterPasswordState } from "./password-state";

export const SESSION_COOKIE_NAME = "prayer_session";
export const PASSWORD_SETUP_COOKIE_NAME = "prayer_password_setup";
export const PASSWORD_SETUP_MAX_AGE_SECONDS = 15 * 60;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const SESSION_ROLL_AFTER_MS = 60 * 60 * 24 * 1000;

export type SessionUser = {
  id: string;
  displayName: string;
  samId: string | null;
  role: "member" | "admin";
  isDeputyAdmin?: boolean;
};

export function sessionCookieOptions(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function sessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
}

export function shouldRollSession(lastSeenAt: Date, now = new Date()): boolean {
  return now.getTime() - lastSeenAt.getTime() >= SESSION_ROLL_AFTER_MS;
}

export async function createSession(userId: string, now = new Date(), options?: { passwordSetup: true }) {
  const token = newSessionToken();
  const expiresAt = options?.passwordSetup ? new Date(now.getTime() + PASSWORD_SETUP_MAX_AGE_SECONDS * 1000) : sessionExpiry(now);
  await getDb().transaction(async (tx) => {
    await tx.insert(sessions).values({
      userId,
      tokenHash: sessionTokenHash(token),
      expiresAt,
      lastSeenAt: now,
      createdAt: now,
    });
    // Persist login history only if session creation succeeds. Never reset it on logout.
    if (!options?.passwordSetup) await tx.update(users).set({ firstLoginAt: sql`coalesce(${users.firstLoginAt}, ${now.toISOString()}::timestamptz)` })
      .where(eq(users.id, userId));
  });
  return { token, expiresAt };
}

async function lookupSession(token: string, now: Date) {
  if (!token) return null;
  const [row] = await getDb()
    .select({
      id: users.id,
      displayName: users.displayName,
      samId: users.samId,
      role: users.role,
      passwordHash: memberRoster.passwordHash,
      phoneCiphertext: memberRoster.phoneCiphertext,
      isDeputyAdmin: memberRoster.isDeputyAdmin,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(memberRoster, eq(memberRoster.id, users.rosterId))
    .where(
      and(
        eq(sessions.tokenHash, sessionTokenHash(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(users.isActive, true),
        eq(memberRoster.isActive, true),
      ),
    )
    .limit(1);

  return row ?? null;
}

function publicSessionUser(row: SessionUser): SessionUser {
  return { id: row.id, displayName: row.displayName, samId: row.samId, role: row.role, ...(row.isDeputyAdmin ? { isDeputyAdmin: true } : {}) };
}

export async function getSessionUser(token: string, now = new Date()): Promise<SessionUser | null> {
  const row = await lookupSession(token, now);
  // This also blocks old phone-password sessions on every protected API.
  if (!row || await rosterPasswordState(row) !== "custom") return null;
  return publicSessionUser(row);
}

export async function getPasswordSetupUser(token: string, now = new Date()): Promise<SessionUser | null> {
  const row = await lookupSession(token, now);
  if (!row || await rosterPasswordState(row) !== "initial") return null;
  return publicSessionUser(row);
}

export async function refreshSession(token: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const hash = sessionTokenHash(token);
  const [row] = await getDb()
    .select({ id: sessions.id, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, hash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row || !shouldRollSession(row.lastSeenAt, now)) return false;

  await getDb()
    .update(sessions)
    .set({ lastSeenAt: now, expiresAt: sessionExpiry(now) })
    .where(eq(sessions.id, row.id));

  return true;
}

export async function revokeSession(token: string, now = new Date()): Promise<void> {
  if (!token) return;
  await getDb()
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.tokenHash, sessionTokenHash(token)), isNull(sessions.revokedAt)));
}

export async function revokeAllSessionsForUser(userId: string, now = new Date()): Promise<void> {
  await getDb()
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
