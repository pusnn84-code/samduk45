import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getPasswordSetupUser, getSessionUser, PASSWORD_SETUP_COOKIE_NAME, SESSION_COOKIE_NAME } from "./session";

// Request-local only: layouts and pages share a read, never another user's session.
export const getCurrentSessionUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? getSessionUser(token) : null;
});

/** A verified initial credential permits password setup only, never member APIs. */
export const getCurrentPasswordSetupSession = cache(async () => {
  const store = await cookies();
  const pending = store.get(PASSWORD_SETUP_COOKIE_NAME)?.value;
  if (!pending) return null;
  const user = await getPasswordSetupUser(pending);
  return user ? { user, token: pending } : null;
});
