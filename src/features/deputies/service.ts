import { getDb, rows, sql } from "../pastoral/db";
import { DomainError } from "../../lib/http";
export type DeputyCandidate = { id: string; name: string; village: string | null; sam: string | null; enabled: boolean; isAdmin: boolean };
export async function listDeputyCandidates() {
  return rows<DeputyCandidate>(getDb(), sql`select id,source_name as name,village,sam_label as sam,is_deputy_admin as enabled,is_admin as "isAdmin" from prayer_app.member_roster where is_active order by is_deputy_admin desc,source_name,id`);
}
export async function saveDeputyPermissions(changes: { id: string; enabled: boolean }[]) {
  if (new Set(changes.map(change => change.id)).size !== changes.length) throw new DomainError("INVALID_INPUT", 400);
  await getDb().transaction(async tx => {
    for (const change of [...changes].sort((a, b) => a.id.localeCompare(b.id))) {
      const updated = await rows(tx, sql`update prayer_app.member_roster set is_deputy_admin=${change.enabled},updated_at=now() where id=${change.id}::uuid and is_active and not is_admin returning id`);
      if (updated.length !== 1) throw new DomainError("INVALID_DEPUTY_TARGET", 409);
    }
  });
}
