import { createHash } from "node:crypto";
import { verifyPasswordOrThrow } from "./crypto";
import { decryptRosterPhone } from "../roster/crypto";
import { formatPhoneForDisplay } from "../roster/normalize";

export type RosterPasswordState = "initial" | "custom" | "unavailable";
const checked = new Map<string, RosterPasswordState>();

/** Server-only credential check shared by session access and contact disclosure. */
export async function rosterPasswordState(person: { passwordHash: string | null; phoneCiphertext: string | null }, decrypt = decryptRosterPhone, verify = verifyPasswordOrThrow, rawPhone?: string): Promise<RosterPasswordState> {
  if (!person.passwordHash) return "initial";
  if (!person.phoneCiphertext) return "unavailable";
  const cacheable = decrypt === decryptRosterPhone && verify === verifyPasswordOrThrow;
  const key = createHash("sha256").update(person.passwordHash).update(person.phoneCiphertext).digest("hex");
  const cached = cacheable ? checked.get(key) : undefined;
  if (cached) return cached;
  try {
    const raw = rawPhone ?? decrypt(person.phoneCiphertext);
    const formatted = formatPhoneForDisplay(raw);
    const initial = await verify(person.passwordHash, raw) || (formatted !== raw && await verify(person.passwordHash, formatted));
    const result = initial ? "initial" : "custom";
    if (cacheable) {
      if (checked.size >= 512) checked.delete(checked.keys().next().value!);
      checked.set(key, result);
    }
    return result;
  } catch { return "unavailable"; }
}
