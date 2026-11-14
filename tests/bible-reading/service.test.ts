import { beforeEach, describe, expect, it, vi } from "vitest";
import { BIBLE_READING_PLAN } from "../../src/content/bible-reading-plan";

const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mocks.db }));
import { getBibleReadingState, updateBibleReadingState } from "../../src/features/bible-reading/service";

const ownId = "signed-in-member";
const date = "2026-01-26";

function storage() {
  const dailyEntries = [
    { userId: ownId, sharingId:"line-1", name: "가상회원", completed: true, sharing: "말씀을 마음에 새깁니다.", empathyCount:"3",hasEmpathized:true },
    { userId: "another-member", sharingId:"line-2", name: "다른회원", completed: true, sharing: "함께 읽었습니다." },
    { userId: "sharing-only", sharingId:"line-3", name: "나눔회원", completed: false, sharing: "오늘의 한줄 나눔" },
  ];
  const select = vi.fn()
    .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: async () => dailyEntries }) }) }) })
    .mockReturnValueOnce({ from: () => ({ where: async () => [{ completedDays: 3 }] }) });
  const upsert = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate: upsert });
  const db = { select, insert: vi.fn().mockReturnValue({ values }) };
  mocks.db.mockReturnValue({ ...db, transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db) });
  return { values, upsert };
}

beforeEach(() => vi.resetAllMocks());

describe("Bible reading records", () => {
  it("returns separate personal progress, completed names, and authored lines without user IDs", async () => {
    storage();
    expect(await getBibleReadingState(ownId, date)).toEqual({
      date,
      completed: true,
      completedPeople: [{ name: "가상회원" }, { name: "다른회원" }],
      progress: { completedDays: 3, totalDays: BIBLE_READING_PLAN.length },
      sharing: "말씀을 마음에 새깁니다.",
      sharingAnonymous: false,
      sharedLines: [
        { id:"line-1", name: "가상회원", text: "말씀을 마음에 새깁니다.", isOwn: true,empathyCount:3,hasEmpathized:true },
        { id:"line-2", name: "다른회원", text: "함께 읽었습니다.", isOwn: false,empathyCount:0,hasEmpathized:false },
        { id:"line-3", name: "나눔회원", text: "오늘의 한줄 나눔", isOwn: false,empathyCount:0,hasEmpathized:false },
      ],
    });
  });

  it("unchecking preserves existing sharing and deleting sharing preserves completion", async () => {
    const completion = storage();
    await updateBibleReadingState(ownId, { date, completed: false });
    expect(completion.values).toHaveBeenCalledWith({ userId: ownId, readingDate: date, completed: false });
    expect(completion.upsert).toHaveBeenCalledWith(expect.objectContaining({ set: { completed: false } }));
    const sharing = storage();
    await updateBibleReadingState(ownId, { date, sharing: null });
    expect(sharing.values).toHaveBeenCalledWith({ userId: ownId, readingDate: date, sharing: null });
    expect(sharing.upsert).toHaveBeenCalledWith(expect.objectContaining({ set: { sharing: null } }));
  });

  it.each(["2026-01-11", "2027-01-17", "2027-02-30"])("rejects the unscheduled date %s before database access", async invalidDate => {
    await expect(getBibleReadingState(ownId, invalidDate)).rejects.toMatchObject({ code: "INVALID_READING_DATE", status: 400 });
    await expect(updateBibleReadingState(ownId, { date: invalidDate, completed: true })).rejects.toMatchObject({ code: "INVALID_READING_DATE", status: 400 });
    expect(mocks.db).not.toHaveBeenCalled();
  });
});
