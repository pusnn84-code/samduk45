import { scheduleCalendarExport } from "../../../../../src/features/google-calendar/export-wakeup";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { dbVisitAdminRepository } from "../../../../../src/features/visits/admin-service";
import { VisitDetailsPatch, updateInternalVisit, dbInternalVisits } from "../../../../../src/features/visits/internal-calendar";
import { DomainError } from "../../../../../src/lib/http";
function errorResponse(error: unknown) {
  if (error instanceof DomainError) return NextResponse.json({ code: error.code }, { status: error.status });
  throw error;
}
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    const visit = await dbVisitAdminRepository.getById(id);
    if (!visit) return NextResponse.json({ code: "VISIT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ visit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = VisitDetailsPatch.safeParse(await request.json().catch(() => null));
    const { id } = await context.params;
    if (!parsed.success || !z.uuid().safeParse(id).success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    await updateInternalVisit(id, parsed.data);
    scheduleCalendarExport();
    return NextResponse.json({ status: "ok" });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const parsed = z.uuid().safeParse((await context.params).id);
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    await dbInternalVisits.delete(parsed.data);
    scheduleCalendarExport();
    return NextResponse.json({ status: "ok" });
  } catch (error) { return errorResponse(error); }
}
