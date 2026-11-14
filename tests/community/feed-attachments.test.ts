import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mocks.db }));
import { listCommunityFeed } from "../../src/features/community/feed";

const firstPostId = "10000000-0000-4000-8000-000000000001";
const secondPostId = "10000000-0000-4000-8000-000000000002";
const photo = { slot: 1, name: "synthetic-photo.png", size: 1024, sha256: "a".repeat(64) };
const document = { slot: 0, name: "synthetic-notes.txt", size: 20, sha256: "b".repeat(64) };

beforeEach(() => vi.resetAllMocks());

describe("community feed attachments", () => {
  it("keeps each published post's attachment slots and hashes in the same read snapshot", async () => {
    const posts = [
      { id: firstPostId, title: "사진과 글", body: "가상 게시글의 본문" },
      { id: secondPostId, title: "글만 있는 게시글", body: "다른 가상 게시글" },
    ];
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 2, activityObservedAt: "2026-11-05T06:00:00.123456Z" }] })
      .mockResolvedValueOnce({ rows: posts })
      .mockResolvedValueOnce({ rows: [{ postId: firstPostId, ...document }, { postId: firstPostId, ...photo }] });
    const transaction = vi.fn(async (work: (tx: { execute: typeof execute }) => Promise<unknown>) => work({ execute }));
    mocks.db.mockReturnValue({ transaction });

    const result = await listCommunityFeed({ id: "synthetic-viewer", role: "member" }, 1);

    expect(result.items[0]).toMatchObject({ id: firstPostId, body: posts[0].body, files: [document, photo] });
    expect(result.items[1]).toMatchObject({ id: secondPostId, files: [] });
    expect(result.items[0].files[1]).not.toHaveProperty("postId");
    expect(result.activityObservedAt).toBe("2026-11-05T06:00:00.123456Z");
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "repeatable read", accessMode: "read only" });
  });

  it("returns an empty feed without issuing an attachment query", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    mocks.db.mockReturnValue({ transaction: async (work: (tx: { execute: typeof execute }) => Promise<unknown>) => work({ execute }) });
    expect((await listCommunityFeed({ id: "synthetic-viewer", role: "member" }, 1)).items).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
