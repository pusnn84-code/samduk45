import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { DomainError } from "../../../../../src/lib/http";
/** The callback URL is also used by the separate Gmail notification feature. */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("state")?.startsWith("mail.")) {
    const { emailOAuthCallback } = await import("../../../../../src/features/email/oauth");
    return emailOAuthCallback(request);
  }
  try { requireAdmin(await getCurrentSessionUser()); } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ code: error.code }, { status: error.status });
    throw error;
  }
  const response = NextResponse.json({ code: "GOOGLE_CALENDAR_RETIRED" }, { status: 410 });
  response.cookies.delete("google_calendar_oauth_state");
  return response;
}
