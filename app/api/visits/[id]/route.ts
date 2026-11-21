import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { getEditableVisit, MemberVisitPatch, saveVisitEdit } from "../../../../src/features/visits/edit-service";
import { VisitDetailsPatch } from "../../../../src/features/visits/internal-calendar";
import { checkOrigin, readReportJson, ReportError } from "../../../../src/features/pastoral/policy";
import { DomainError } from "../../../../src/lib/http";
const headers = { "Cache-Control": "private, no-store" };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });
function failure(error: unknown) {
  if (error instanceof DomainError || error instanceof ReportError) return json({ code: error.code }, error.status);
  throw error;
}
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return json({ code: "UNAUTHORIZED" }, 401);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return json({ code: "INVALID_INPUT" }, 400);
    const { requesterUserId: _owner, ...visit } = await getEditableVisit(user, id);
    return json({ visit });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return json({ code: "UNAUTHORIZED" }, 401);
    checkOrigin(request);
    const { id } = await context.params;
    const parsed = (user.role === "admin" ? VisitDetailsPatch : MemberVisitPatch).safeParse(await readReportJson(request));
    if (!z.uuid().safeParse(id).success || !parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    await saveVisitEdit(user, id, parsed.data);
    return json({ status: "ok" });
  } catch (error) { return failure(error); }
}
