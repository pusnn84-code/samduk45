import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mocks.db }));
import { updateBibleReadingState } from "../../src/features/bible-reading/service";
const date = "2026-11-05";
beforeEach(() => vi.resetAllMocks());
function setup(existingNumber: number | null) {
  const entries = [{ userId: "viewer", name: "표시하면안되는실명", completed: false, sharing: "기도하며 읽어요", sharingAnonymous: true, anonymousNumber: existingNumber ?? 3 }, { userId: "other", name: "다른비공개실명", completed: false, sharing: "함께 읽어요", sharingAnonymous: true, anonymousNumber: 4 }];
  const select = vi.fn().mockReturnValueOnce({ from: () => ({ where: async () => [{ number: existingNumber }] }) });
  if (existingNumber === null) select.mockReturnValueOnce({ from: () => ({ where: async () => [{ next: 3 }] }) });
  select.mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: async () => entries }) }) }) })
    .mockReturnValueOnce({ from: () => ({ where: async () => [{ completedDays: 0 }] }) });
  const values = vi.fn(() => ({ onConflictDoUpdate: async () => {} }));
  const execute = vi.fn(); const db = { select, execute, insert: () => ({ values }) };
  mocks.db.mockReturnValue({ transaction: async (work: (tx: typeof db) => Promise<unknown>) => work(db) });
  return { values, execute };
}
describe("anonymous reading sharing", () => {
  it("allocates an alias under the date lock and never returns anonymous authors' real names", async () => {
    const db = setup(null);
    const result = await updateBibleReadingState("viewer", { date, sharing: "기도하며 읽어요", sharingAnonymous: true });
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ userId: "viewer", sharingAnonymous: true, anonymousNumber: 3 }));
    expect(result.sharedLines).toEqual([{ name: "무명3", text: "기도하며 읽어요", isOwn: true,empathyCount:0,hasEmpathized:false }, { name: "무명4", text: "함께 읽어요", isOwn: false,empathyCount:0,hasEmpathized:false }]);
    expect(JSON.stringify(result)).not.toContain("실명"); expect(result.sharingAnonymous).toBe(true);
  });
  it("keeps the same anonymous number when the author edits the line", async () => {
    const db = setup(3); await updateBibleReadingState("viewer", { date, sharing: "기도하며 읽어요", sharingAnonymous: true });
    expect(db.values).toHaveBeenCalledWith(expect.objectContaining({ anonymousNumber: 3 }));
  });
});
