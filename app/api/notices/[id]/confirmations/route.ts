import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import { confirmNotice, getNoticeConfirmations } from "../../../../../src/features/notices/confirmations";
import { checkOrigin, readReportJson, ReportError } from "../../../../../src/features/pastoral/policy";
import { DomainError } from "../../../../../src/lib/http";

export const dynamic = "force-dynamic";
const paramsSchema = z.object({ id: z.string().uuid() });
const inputSchema = z.object({ revision: z.string().regex(/^[a-f0-9]{32}$/) }).strict();
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof DomainError || error instanceof ReportError) return NextResponse.json({ code: error.code }, { status: error.status, headers });
  return NextResponse.json({ code: "NOTICE_CONFIRMATION_FAILED" }, { status: 500, headers });
}

export async function GET(_request: Request, context: Context) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400, headers });
    const state = await getNoticeConfirmations(params.data.id, user);
    if (!state) return NextResponse.json({ code: "FORBIDDEN" }, { status: 403, headers });
    return NextResponse.json(state, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });
    checkOrigin(request);
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400, headers });
    const input = inputSchema.safeParse(await readReportJson(request));
    if (!input.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400, headers });
    return NextResponse.json(await confirmNotice(params.data.id, user, input.data.revision), { headers });
  } catch (error) { return errorResponse(error); }
}
