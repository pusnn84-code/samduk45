import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), directory: vi.fn(), rows: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mocks.db }));
vi.mock("../../src/features/pastoral/access", () => ({ directory: mocks.directory }));
vi.mock("../../src/features/pastoral/db", () => ({ rows: mocks.rows }));
import { confirmNotice } from "../../src/features/notices/confirmations";

const noticeId = "11111111-1111-4111-8111-111111111111", revision = "a".repeat(32), next = "b".repeat(32);
const at = new Date("2027-01-02T03:04:05Z");
const leader = { id: "leader", sourceName: "가상리더", canonicalName: "가상리더", samLabel: "1-1", village: "1", isActive: true };
const base = { roster: [leader], sams: [{ id: "sam", name: "1-1", village: "1", leaderName: "가상리더", leaderRosterId: "leader", isActive: true }], heads: [] };

function storage(current = revision, records: unknown[] = [], authorized = true) {
  const events: string[] = [];
  const selection = vi.fn().mockResolvedValueOnce([{ id: noticeId }]).mockResolvedValueOnce([{ revision: current }]);
  const builder = { from: vi.fn(), where: vi.fn(), leftJoin: vi.fn(), for: vi.fn(), limit: vi.fn() };
  for (const method of ["from", "where", "leftJoin"] as const) builder[method].mockReturnValue(builder);
  builder.for.mockImplementation(() => { events.push("lock"); return builder; });
  builder.limit.mockImplementation(() => selection());
  const save = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate: save });
  const tx = { select: vi.fn().mockReturnValue(builder), insert: vi.fn(() => { events.push("insert"); return { values }; }) };
  const db = { transaction: vi.fn(async callback => callback(tx)) };
  mocks.db.mockReturnValue(db);
  mocks.directory.mockResolvedValue(authorized ? base : { ...base, sams: [] });
  mocks.rows.mockResolvedValueOnce([{ id: "leader", isAdmin: false, isNoticeOfficer: false }])
    .mockResolvedValueOnce([{ id: "account", rosterId: "leader", role: "member", isActive: true }])
    .mockResolvedValueOnce(records);
  return { selection, values, save, tx, events };
}

beforeEach(() => vi.resetAllMocks());
describe("manual notice confirmation transaction", () => {
  it("rejects a page showing an older revision before writing any confirmation", async () => {
    const db = storage(next);
    await expect(confirmNotice(noticeId, { id: "account" }, revision, at)).rejects.toMatchObject({ code: "NOTICE_CHANGED", status: 409 });
    expect(db.tx.insert).not.toHaveBeenCalled();
  });
  it("uses the authenticated roster identity and locks the notice before recording", async () => {
    const db = storage();
    const state = await confirmNotice(noticeId, { id: "account" }, revision, at);
    expect(db.values).toHaveBeenCalledWith({ noticeId, rosterId: "leader", noticeRevision: revision, confirmedAt: at, confirmedByUserId: "account" });
    expect(db.events).toEqual(["lock", "insert"]);
    expect(state.ownConfirmedAt).toBe(at.toISOString());
  });
  it("repeating an acknowledgement of the current revision preserves the first time and performs no write", async () => {
    const db = storage(revision, [{ rosterId: "leader", revision, confirmedAt: at.toISOString() }]);
    const state = await confirmNotice(noticeId, { id: "account" }, revision, new Date("2027-01-03T00:00:00Z"));
    expect(state.ownConfirmedAt).toBe(at.toISOString());
    expect(db.tx.insert).not.toHaveBeenCalled();
  });
  it("records a fresh confirmation after a content edit instead of treating the old one as current", async () => {
    const db = storage(next, [{ rosterId: "leader", revision, confirmedAt: "2026-12-01T00:00:00Z" }]);
    const state = await confirmNotice(noticeId, { id: "account" }, next, at);
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ noticeRevision: next, confirmedAt: at }));
    expect(state.confirmed).toHaveLength(1);
    expect(state.ownConfirmedAt).toBe(at.toISOString());
  });
  it("prevents an ordinary member from confirming even if the page caller is manipulated", async () => {
    const db = storage(revision, [], false);
    await expect(confirmNotice(noticeId, { id: "account" }, revision, at)).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(db.tx.insert).not.toHaveBeenCalled();
  });
  it("rejects unpublished or missing notices before loading the leadership directory", async () => {
    const db = storage(); db.selection.mockReset().mockResolvedValue([]);
    await expect(confirmNotice(noticeId, { id: "account" }, revision, at)).rejects.toMatchObject({ code: "NOTICE_NOT_FOUND", status: 404 });
    expect(mocks.directory).not.toHaveBeenCalled(); expect(db.tx.insert).not.toHaveBeenCalled();
  });
});
