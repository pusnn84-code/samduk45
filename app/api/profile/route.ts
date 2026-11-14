import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import {
  changeProfilePassword,
  getProfile,
} from "../../../src/features/profile/service";
import { DomainError } from "../../../src/lib/http";
import { cookies } from "next/headers";
import { rememberPinDevice } from "../../../src/features/auth/pin-device";
import { PIN_DEVICE_COOKIE_NAME, pinDeviceCookieOptions } from "../../../src/features/auth/pin-device-cookie";
import { sameOrigin } from "../../../src/features/pastoral/http";
import { ReportError } from "../../../src/features/pastoral/policy";

const PasswordUpdateSchema = z.object({
  password: z.string().regex(/^[0-9]{6}$/),
});

export async function GET() {
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ profile: await getProfile(user.id) });
}

export async function PATCH(request: Request) {
  try { sameOrigin(request); }
  catch (error) { return NextResponse.json({ code: "FORBIDDEN" }, { status: error instanceof ReportError ? error.status : 403 }); }
  const user = await getCurrentSessionUser();
  if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const parsed = PasswordUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    await changeProfilePassword(user.id, parsed.data.password);
    (await cookies()).set(PIN_DEVICE_COOKIE_NAME, await rememberPinDevice(user.id, parsed.data.password), pinDeviceCookieOptions());
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ code: error.code }, { status: error.status });
    }
    throw error;
  }
}
