import {schedulePushDelivery} from "../../../src/features/push/wakeup";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { acknowledgeMenuActivity, getMenuActivityCounts } from "../../../src/features/menu-activity/service";
import { boundedBytes, json, sameOrigin } from "../../../src/features/pastoral/http";
import { ReportError } from "../../../src/features/pastoral/policy";
import { DomainError } from "../../../src/lib/http";

const Seen = z.object({ kind: z.enum(["community", "members", "reading"]), observedAt: z.iso.datetime().max(40), date:z.iso.date().optional() }).strict();
function failure(error: unknown) {
  if (error instanceof DomainError || error instanceof ReportError) return json({ code: error.code }, error.status);
  return json({ code: "MENU_ACTIVITY_UNAVAILABLE" }, 503);
}
export async function GET() {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return json({ code: "UNAUTHORIZED" }, 401);
    schedulePushDelivery();
    return json(await getMenuActivityCounts(user.id));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return json({ code: "UNAUTHORIZED" }, 401);
    sameOrigin(request);
    if (request.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json") return json({ code: "INVALID_CONTENT_TYPE" }, 415);
    let body: unknown;
    try { body = JSON.parse((await boundedBytes(request, 1024)).toString("utf8")); }
    catch (error) { if (error instanceof ReportError) throw error; return json({ code: "INVALID_INPUT" }, 400); }
    const parsed = Seen.safeParse(body);
    if (!parsed.success) return json({ code: "INVALID_INPUT" }, 400);
    if(parsed.data.kind === "reading" && !parsed.data.date) return json({code:"INVALID_INPUT"},400);
    if(parsed.data.kind === "reading") await acknowledgeMenuActivity(user.id, parsed.data.kind, parsed.data.observedAt, undefined, parsed.data.date); else await acknowledgeMenuActivity(user.id, parsed.data.kind, parsed.data.observedAt);
    return json({ status: "ok" });
  } catch (error) { return failure(error); }
}
