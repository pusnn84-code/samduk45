import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), feed: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: mocks.session }));
vi.mock("../../src/features/community/feed", () => ({ listCommunityFeed: mocks.feed }));
import { GET } from "../../app/api/community/feed/route";

const origin = "https://samduk45.vercel.app";
const actor = { id: "signed-in-member", role: "member" };
const folderId = "11111111-1111-4111-8111-111111111111";
const emptyPage = { items: [], total: 0, page: 1, pageSize: 20 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.feed.mockResolvedValue(emptyPage);
});

describe("private member community feed", () => {
  it("requires a session before loading posts", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await GET(new Request(origin + "/api/community/feed"));
    expect(response.status).toBe(401);
    expect(mocks.feed).not.toHaveBeenCalled();
  });

  it("uses the authenticated viewer for personal like state and disables shared caching", async () => {
    const response = await GET(new Request(origin + "/api/community/feed?userId=someone-else"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(emptyPage);
    expect(mocks.feed).toHaveBeenCalledWith(actor, 1, undefined);
  });

  it("accepts validated pagination and optional folder filtering", async () => {
    expect((await GET(new Request(origin + "/api/community/feed?page=2&folder=" + folderId))).status).toBe(200);
    expect(mocks.feed).toHaveBeenCalledWith(actor, 2, folderId);
  });

  it.each(["page=0", "page=1.5", "page=100001", "folder=not-a-uuid"])("rejects invalid selection %s before querying posts", async query => {
    expect((await GET(new Request(origin + "/api/community/feed?" + query))).status).toBe(400);
    expect(mocks.feed).not.toHaveBeenCalled();
  });

  it("returns a safe error when the data source fails", async () => {
    mocks.feed.mockRejectedValue(new Error("private database details"));
    const response = await GET(new Request(origin + "/api/community/feed"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "COMMUNITY_UNAVAILABLE" });
  });
});
