import {schedulePushDelivery} from "../../../src/features/push/wakeup";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getBibleReadingState, updateBibleReadingState } from "../../../src/features/bible-reading/service";
import { checkOrigin, readLimited, ReportError } from "../../../src/features/pastoral/policy";
import { DomainError } from "../../../src/lib/http";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sharingSchema = z.string()
  .refine(value => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value), "Sharing must be one line")
  .transform(value => value.trim())
  .pipe(z.string().min(1).max(150))
  .nullable();
const updateSchema = z.union([
  z.object({ date: dateSchema, completed: z.boolean(), sharing: sharingSchema.optional(), sharingAnonymous: z.boolean().optional() }).strict(),
  z.object({ date: dateSchema, completed: z.boolean().optional(), sharing: sharingSchema, sharingAnonymous: z.boolean().optional() }).strict(),
]).refine(value => value.sharingAnonymous === undefined || value.sharing !== undefined)
  .refine(value => value.sharingAnonymous !== true || typeof value.sharing === "string");

function errorResponse(error: unknown) {
  if (error instanceof DomainError || error instanceof ReportError) {
    return NextResponse.json({ code: error.code }, { status: error.status, headers });
  }
  throw error;
}

async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new DomainError("INVALID_CONTENT_TYPE", 415);
  }
  const bytes = await readLimited(request, 4096);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DomainError("INVALID_INPUT", 400);
  }
}

export async function GET(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });

  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  if (date !== undefined && !dateSchema.safeParse(date).success) {
    return NextResponse.json({ code: "INVALID_READING_DATE" }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await getBibleReadingState(user.id, date), { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });

  try {
    checkOrigin(request);
    const parsed = updateSchema.safeParse(await readJson(request));
    if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400, headers });

    const result=await updateBibleReadingState(user.id, parsed.data);
    schedulePushDelivery();
    return NextResponse.json(result, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
