import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkOrigin, ReportError } from "../../../../src/features/pastoral/policy";
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
  reserveAccountLoginAttempt,
  clearAccountLoginFailures,
} from "../../../../src/features/auth/rate-limit";
import { rememberPinDevice } from "../../../../src/features/auth/pin-device";
import { PIN_DEVICE_COOKIE_NAME, pinDeviceCookieOptions } from "../../../../src/features/auth/pin-device-cookie";
import { isSixDigitPin } from "../../../../src/features/auth/pin-policy";
import { authenticateRosterLogin } from "../../../../src/features/auth/service";
import {
  SESSION_COOKIE_NAME,
  PASSWORD_SETUP_COOKIE_NAME,
  PASSWORD_SETUP_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from "../../../../src/features/auth/session";

const LoginSchema = z.object({
  name: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(1024).optional(),
  phone: z.string().min(1).max(80).optional(),
}).refine((value) => Boolean(value.password ?? value.phone), {
  message: "PASSWORD_REQUIRED",
});

function requestIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try { checkOrigin(request); }
  catch (error) { return NextResponse.json({ code: "FORBIDDEN" }, { status: error instanceof ReportError ? error.status : 403 }); }
  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  const name = parsed.data.name;
  const password = parsed.data.password ?? parsed.data.phone!;
  const ip = requestIp(request);

  if (await isLoginBlocked(name, ip)) {
    return NextResponse.json(
      {
        code: "TOO_MANY_ATTEMPTS",
        message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 429 },
    );
  }

  if (!await reserveAccountLoginAttempt(name)) return NextResponse.json({ code: "TOO_MANY_ATTEMPTS", message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요." }, { status: 429 });
  const result = await authenticateRosterLogin(name, password);
  if (!result) {
    const failure = await recordLoginFailure(name, ip);
    if (failure.blockedUntil) {
      return NextResponse.json({ code: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }
    return NextResponse.json(
      {
        code: "ROSTER_MISMATCH",
        message: "등록된 이름과 비밀번호를 확인해 주세요.",
      },
      { status: 401 },
    );
  }

  await clearLoginFailures(name, ip);
  await clearAccountLoginFailures(name);
  const store = await cookies();
  if (result.requiresPasswordChange) {
    store.delete(PIN_DEVICE_COOKIE_NAME);
    store.delete(SESSION_COOKIE_NAME);
    store.set(PASSWORD_SETUP_COOKIE_NAME, result.token, { ...sessionCookieOptions(), maxAge: PASSWORD_SETUP_MAX_AGE_SECONDS });
    return NextResponse.json({ status: "password_change_required" }, { headers: { "Cache-Control": "private, no-store" } });
  }
  store.delete(PASSWORD_SETUP_COOKIE_NAME);
  store.set(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
  if (isSixDigitPin(password)) {
    store.set(PIN_DEVICE_COOKIE_NAME, await rememberPinDevice(result.user.id, password), pinDeviceCookieOptions());
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "private, no-store" } });
  }
  store.delete(PIN_DEVICE_COOKIE_NAME);
  return NextResponse.json({ status: "pin_setup_required" }, { headers: { "Cache-Control": "private, no-store" } });
}
