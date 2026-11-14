import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentPasswordSetupSession } from "../../../../src/features/auth/http-session";
import { createSession, PASSWORD_SETUP_COOKIE_NAME, SESSION_COOKIE_NAME, sessionCookieOptions } from "../../../../src/features/auth/session";
import { changeProfilePassword } from "../../../../src/features/profile/service";
import { boundedBytes, json, sameOrigin } from "../../../../src/features/pastoral/http";
import { ReportError } from "../../../../src/features/pastoral/policy";
import { DomainError } from "../../../../src/lib/http";
import { rememberPinDevice } from "../../../../src/features/auth/pin-device";
import { PIN_DEVICE_COOKIE_NAME, pinDeviceCookieOptions } from "../../../../src/features/auth/pin-device-cookie";

const Input = z.object({ password: z.string().regex(/^[0-9]{6}$/), confirmation: z.string().max(6) }).strict()
  .refine(value => value.password === value.confirmation, { message: "PASSWORD_CONFIRMATION_MISMATCH" });

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const setup = await getCurrentPasswordSetupSession();
    if (!setup) return json({ code: "PASSWORD_SETUP_EXPIRED" }, 401);
    if (request.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json") return json({ code: "INVALID_CONTENT_TYPE" }, 415);
    let body: unknown;
    try { body = JSON.parse((await boundedBytes(request, 16 * 1024)).toString("utf8")); }
    catch (error) { if (error instanceof ReportError) throw error; return json({ code: "INVALID_INPUT" }, 400); }
    const parsed = Input.safeParse(body);
    if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    await changeProfilePassword(setup.user.id, parsed.data.password, setup.token);
    const device = await rememberPinDevice(setup.user.id, parsed.data.password);
    const session = await createSession(setup.user.id);
    const store = await cookies();
    store.delete(PASSWORD_SETUP_COOKIE_NAME);
    store.set(SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
    store.set(PIN_DEVICE_COOKIE_NAME, device, pinDeviceCookieOptions());
    return json({ status: "ok" });
  } catch (error) {
    if (error instanceof DomainError || error instanceof ReportError) return json({ code: error.code }, error.status);
    return json({ code: "PASSWORD_SETUP_UNAVAILABLE" }, 503);
  }
}
