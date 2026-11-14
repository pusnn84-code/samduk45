import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { CalendarMonth, sharedMonth } from "../../../../src/features/visits/shared-calendar";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!await getCurrentSessionUser()) return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
  const month = new URL(request.url).searchParams.get("month");
  if (!CalendarMonth.safeParse(month).success) return NextResponse.json({code:"INVALID_INPUT"},{status:400,headers});
  return NextResponse.json({ entries: await sharedMonth(month!) }, {headers});
}
