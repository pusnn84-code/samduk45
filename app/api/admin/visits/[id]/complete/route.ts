import { scheduleCalendarExport } from "../../../../../../src/features/google-calendar/export-wakeup";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../../src/features/auth/http-session";
import { transitionInternalVisit } from "../../../../../../src/features/visits/internal-calendar";
import { DomainError } from "../../../../../../src/lib/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
    await transitionInternalVisit(id, "completed");
    scheduleCalendarExport();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
