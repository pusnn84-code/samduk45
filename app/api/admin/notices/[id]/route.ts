import { NextResponse } from "next/server";
import { parseNoticeRequest } from "../../../../../src/features/notices/input";
import { requireAdmin } from "../../../../../src/features/admin/service";
import { getCurrentSessionUser } from "../../../../../src/features/auth/http-session";
import {
  deleteNotice,
  updateNotice,
} from "../../../../../src/features/notices/service";
import { DomainError } from "../../../../../src/lib/http";
import { schedulePushDelivery } from "../../../../../src/features/push/wakeup";

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  throw error;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(await getCurrentSessionUser());
    if ((request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new DomainError("FORBIDDEN",403);
    const input = await parseNoticeRequest(request);
    const { id } = await context.params;
    const result = await updateNotice(id, input);
    if (result.didPublish) schedulePushDelivery();
    return NextResponse.json({
      status: "ok",
      notice: result.notice,
      didPublish: result.didPublish,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(await getCurrentSessionUser());
    const { id } = await context.params;
    await deleteNotice(id);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return errorResponse(error);
  }
}

