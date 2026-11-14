import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { DomainError } from "../../../../src/lib/http";
import { getInternalMonthAvailability } from "../../../../src/features/visits/internal-calendar";

const MonthQuery = z.string().regex(/^\d{4}-\d{2}$/);
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
  }

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!MonthQuery.safeParse(month).success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400, headers });
  }

  try {
    const dates = await getInternalMonthAvailability(month);
    return NextResponse.json({ dates }, { headers });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status, headers });
    }
    throw error;
  }
}
