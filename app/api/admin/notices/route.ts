import { NextResponse } from "next/server";
import { parseNoticeRequest } from "../../../../src/features/notices/input";
import { requireAdmin } from "../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  createNotice,
  listNoticesForAdmin,
} from "../../../../src/features/notices/service";
import { DomainError } from "../../../../src/lib/http";
import { sendNoticePush } from "../../../../src/features/push/service";
import { requireNoticePublisher } from "../../../../src/features/deputies/policy";

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  throw error;
}

export async function GET() {
  try {
    requireAdmin(await getCurrentSessionUser());
    return NextResponse.json({
      notices: await listNoticesForAdmin(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    requireNoticePublisher(user);
    if ((request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new DomainError("FORBIDDEN", 403);
    const input = await parseNoticeRequest(request);
    if (user.role !== "admin" && input.status !== "published") throw new DomainError("FORBIDDEN", 403);
    const result = await createNotice(user.id, input);
    if (result.didPublish) {
      try {
        await sendNoticePush({
          id: result.notice.id,
          title: result.notice.title,
          body: result.notice.body,
        });
      } catch {
        // Notice publication succeeds even if push is unavailable.
      }
    }
    return NextResponse.json(
      {
        status: "ok",
        notice: result.notice,
        didPublish: result.didPublish,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
