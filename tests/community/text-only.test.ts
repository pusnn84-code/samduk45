import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mock.db }));
import { publishPost, saveDraft, movePost } from "../../src/features/community/posts";
import { commitEdit } from "../../src/features/community/edits";
const photo = { slot: 0, name: "synthetic.jpg", size: 1024, sha256: "a".repeat(64) };
const post = { id: "post", authorId: "viewer", publishedAt: null, folderId: "prayer", version: 1, textOnly: true };
function db(responses: unknown[][]) {
  const execute = vi.fn(); for (const rows of responses) execute.mockResolvedValueOnce({ rows });
  const tx = { execute }; mock.db.mockReturnValue({ transaction: async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx) }); return execute;
}
beforeEach(() => vi.resetAllMocks());
describe("text-only prayer category", () => {
  it("rejects photo metadata before a draft is saved", async () => {
    const execute = db([[], [], [{ textOnly: true }]]);
    await expect(saveDraft({ id: "viewer", role: "member" }, { id: "post", folderId: "prayer", title: "가상", body: "가상 기도", files: [photo] })).rejects.toMatchObject({ code: "TEXT_ONLY_FOLDER" });
    expect(execute).toHaveBeenCalledTimes(3);
  });
  it("blocks publication of an old photo draft in a text-only category", async () => {
    db([[post], [photo]]); await expect(publishPost({ id: "viewer", role: "member" }, "post")).rejects.toMatchObject({ code: "TEXT_ONLY_FOLDER" });
  });
  it("blocks staged edit photos even if an upload began before the category changed", async () => {
    db([[post], [{ id: "edit", postId: "post", authorId: "viewer", baseVersion: 1, appliedAt: null, files: [photo], keepSlots: [] }], []]);
    await expect(commitEdit({ id: "viewer", role: "member" }, "post", "edit")).rejects.toMatchObject({ code: "TEXT_ONLY_FOLDER" });
  });
  it("does not allow administrators to move photo posts into a text-only category", async () => {
    db([[{ textOnly: true }], [post], [{}]]); await expect(movePost({ id: "admin", role: "admin" }, "post", "prayer")).rejects.toMatchObject({ code: "TEXT_ONLY_FOLDER" });
  });
});
