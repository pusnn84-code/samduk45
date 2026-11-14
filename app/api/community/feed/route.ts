import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { listCommunityFeed } from "../../../../src/features/community/feed";
import { CommunityError, pageNumber, uuid } from "../../../../src/features/community/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  try {
    const user = await getCurrentSessionUser();
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers });

    const url = new URL(request.url);
    const folder = url.searchParams.get("folder");
    const folderId = folder ? uuid(folder) : undefined;
    const page = pageNumber(url.searchParams.get("page"));
    return NextResponse.json(await listCommunityFeed(user, page, folderId), { headers });
  } catch (error) {
    if (error instanceof CommunityError) {
      return NextResponse.json({ code: error.code }, { status: error.status, headers });
    }
    return NextResponse.json({ code: "COMMUNITY_UNAVAILABLE" }, { status: 500, headers });
  }
}
