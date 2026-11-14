import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { requireAdmin } from "../../../../src/features/admin/service";
import { listDeputyCandidates, saveDeputyPermissions } from "../../../../src/features/deputies/service";
import { boundedJson, json, sameOrigin } from "../../../../src/features/pastoral/http";
import { DomainError } from "../../../../src/lib/http";
import { ReportError } from "../../../../src/features/pastoral/policy";
const Input = z.object({ changes: z.array(z.object({ id: z.uuid(), enabled: z.boolean() }).strict()).min(1).max(100) }).strict();
function failure(error: unknown) { return error instanceof DomainError || error instanceof ReportError ? json({ code: error.code }, error.status) : json({ code: "DEPUTY_UPDATE_UNAVAILABLE" }, 503); }
export async function GET() { try { requireAdmin(await getCurrentSessionUser()); return json({ members: await listDeputyCandidates() }); } catch (error) { return failure(error); } }
export async function PATCH(request: Request) {
  try { requireAdmin(await getCurrentSessionUser()); sameOrigin(request);
    const parsed = Input.safeParse(await boundedJson(request)); if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    await saveDeputyPermissions(parsed.data.changes); return json({ status: "ok" });
  } catch (error) { return failure(error); }
}
