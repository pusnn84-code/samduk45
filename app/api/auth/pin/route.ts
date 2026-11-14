import { cookies } from "next/headers";
import { z } from "zod";
import { authenticatePinDevice, rememberPinDevice } from "../../../../src/features/auth/pin-device";
import { PIN_DEVICE_COOKIE_NAME, pinDeviceCookieOptions } from "../../../../src/features/auth/pin-device-cookie";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { PASSWORD_SETUP_COOKIE_NAME, SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../src/features/auth/session";
import { isLoginBlocked, recordLoginFailure, clearLoginFailures } from "../../../../src/features/auth/rate-limit";
import { changeProfilePassword } from "../../../../src/features/profile/service";
import { boundedBytes, json, sameOrigin } from "../../../../src/features/pastoral/http";
import { ReportError } from "../../../../src/features/pastoral/policy";
import { DomainError } from "../../../../src/lib/http";

const PinInput = z.object({ pin: z.string().regex(/^[0-9]{6}$/) }).strict();
const SetupInput = z.object({ password: z.string().regex(/^[0-9]{6}$/), confirmation: z.string().max(6) }).strict()
  .refine(input => input.password === input.confirmation);

async function body(request: Request) {
  if (request.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json") throw new DomainError("INVALID_CONTENT_TYPE", 415);
  try { return JSON.parse((await boundedBytes(request, 2048)).toString("utf8")) as unknown; }
  catch (error) { if (error instanceof ReportError) throw error; throw new DomainError("INVALID_PIN", 400); }
}

function failure(error: unknown) {
  if (error instanceof DomainError || error instanceof ReportError) return json({ code: error.code }, error.status);
  return json({ code: "PIN_UNAVAILABLE" }, 503);
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = PinInput.safeParse(await body(request));
    if (!input.success) return json({ code: "INVALID_PIN" }, 400);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (await isLoginBlocked("device-pin", ip)) return json({ code: "TOO_MANY_ATTEMPTS" }, 429);
    const store = await cookies();
    let result: Awaited<ReturnType<typeof authenticatePinDevice>>;
    try { result = await authenticatePinDevice(store.get(PIN_DEVICE_COOKIE_NAME)?.value, input.data.pin); }
    catch (error) {
      if (error instanceof DomainError && (error.code === "PIN_MISMATCH" || error.code === "PIN_DEVICE_EXPIRED")) await recordLoginFailure("device-pin", ip);
      if (error instanceof DomainError && error.code === "PIN_DEVICE_EXPIRED") store.delete(PIN_DEVICE_COOKIE_NAME);
      throw error;
    }
    await clearLoginFailures("device-pin", ip);
    store.delete(PASSWORD_SETUP_COOKIE_NAME);
    store.set(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
    store.set(PIN_DEVICE_COOKIE_NAME, result.device, pinDeviceCookieOptions());
    return json({ status: "ok" });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const user = await getCurrentSessionUser();
    if (!user) return json({ code: "UNAUTHORIZED" }, 401);
    const input = SetupInput.safeParse(await body(request));
    if (!input.success) return json({ code: "INVALID_PIN" }, 400);
    await changeProfilePassword(user.id, input.data.password);
    const device = await rememberPinDevice(user.id, input.data.password);
    (await cookies()).set(PIN_DEVICE_COOKIE_NAME, device, pinDeviceCookieOptions());
    return json({ status: "ok" });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    (await cookies()).delete(PIN_DEVICE_COOKIE_NAME);
    return json({ status: "ok" });
  } catch (error) { return failure(error); }
}
