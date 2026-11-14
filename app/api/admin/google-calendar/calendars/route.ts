import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { DomainError } from "../../../../../src/lib/http";
/** Calendar integration was retired. Do not acquire or use Google permissions. */
export async function GET(_request?: Request) {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json({ code: "GOOGLE_CALENDAR_RETIRED" }, { status: 410 });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ code: error.code }, { status: error.status });
    throw error;
  }
}
