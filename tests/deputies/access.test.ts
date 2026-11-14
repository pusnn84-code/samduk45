import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), save: vi.fn(), input: vi.fn(), create: vi.fn(), notices: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: mock.session }));
vi.mock("../../src/features/deputies/service", () => ({ listDeputyCandidates: mock.list, saveDeputyPermissions: mock.save }));
vi.mock("../../src/features/notices/input", () => ({ parseNoticeRequest: mock.input }));
vi.mock("../../src/features/notices/service", () => ({ createNotice: mock.create, listNoticesForAdmin: mock.notices, updateNotice: mock.update, deleteNotice: mock.remove }));
vi.mock("../../src/features/push/service", () => ({ sendNoticePush: vi.fn() }));
import { GET, PATCH } from "../../app/api/admin/deputies/route";
import { GET as listNotices, POST as createNotice } from "../../app/api/admin/notices/route";
import { PATCH as updateNotice, DELETE as deleteNotice } from "../../app/api/admin/notices/[id]/route";
import { canDeletePublishedPost } from "../../src/features/deputies/policy";
const origin = "https://samduk45.vercel.app";
const deputy = { id: "deputy", role: "member", isDeputyAdmin: true };
const body = { changes: [{ id: "10000000-0000-4000-8000-000000000001", enabled: true }] };
const request = (data: unknown = body, source = origin) => new Request(origin + "/api/admin/deputies", { method: "PATCH", headers: { origin: source, "content-type": "application/json" }, body: JSON.stringify(data) });
beforeEach(() => { vi.resetAllMocks(); mock.input.mockResolvedValue({ title: "가상 공지", body: "가상 내용", status: "published" }); mock.create.mockResolvedValue({ notice: { id: "notice" }, didPublish: false }); });
describe("limited deputy administration", () => {
  it.each([null, { id: "member", role: "member" }, deputy])("does not let non-administrators list or grant deputy permissions", async user => {
    mock.session.mockResolvedValue(user); expect((await GET()).status).toBe(403); expect((await PATCH(request())).status).toBe(403); expect(mock.save).not.toHaveBeenCalled(); expect(mock.list).not.toHaveBeenCalled();
  });
  it("lets the administrator save only validated, same-origin permission changes", async () => {
    mock.session.mockResolvedValue({ id: "admin", role: "admin" });
    expect((await PATCH(request())).status).toBe(200); expect(mock.save).toHaveBeenCalledWith(body.changes);
    mock.save.mockClear(); expect((await PATCH(request(body, "https://untrusted.invalid"))).status).toBe(403);
    expect((await PATCH(request({ ...body, isAdmin: true }))).status).toBe(400); expect(mock.save).not.toHaveBeenCalled();
  });
  it("allows deputies to publish notices under their own identity", async () => {
    mock.session.mockResolvedValue(deputy); const response = await createNotice(new Request(origin + "/api/admin/notices", { method: "POST" }));
    expect(response.status).toBe(201); expect(mock.create).toHaveBeenCalledWith("deputy", expect.objectContaining({ status: "published" }));
  });
  it("does not expose notice drafts or permit notice editing/deletion to deputies", async () => {
    mock.session.mockResolvedValue(deputy); const context = { params: Promise.resolve({ id: "notice" }) };
    expect((await listNotices()).status).toBe(403); expect((await updateNotice(request(), context)).status).toBe(403); expect((await deleteNotice(request(), context)).status).toBe(403);
    expect(mock.notices).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled(); expect(mock.remove).not.toHaveBeenCalled();
    mock.input.mockResolvedValue({ title: "가상", body: "가상", status: "draft" });
    expect((await createNotice(new Request(origin + "/api/admin/notices", { method: "POST" }))).status).toBe(403);
  });
  it("does not let ordinary members publish notices", async () => {
    mock.session.mockResolvedValue({ id: "member", role: "member" }); expect((await createNotice(request())).status).toBe(403); expect(mock.create).not.toHaveBeenCalled();
  });
  it("limits deputy deletion to published posts, while preserving author-only draft control", () => {
    expect(canDeletePublishedPost(deputy, { authorId: "other", publishedAt: "2026-11-05" })).toBe(true);
    expect(canDeletePublishedPost(deputy, { authorId: "other", publishedAt: null })).toBe(false);
    expect(canDeletePublishedPost({ id: "member", role: "member" }, { authorId: "other", publishedAt: "2026-11-05" })).toBe(false);
    expect(canDeletePublishedPost(deputy, { authorId: "deputy", publishedAt: null })).toBe(true);
  });
});
