import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ session: vi.fn(), db: vi.fn(), execute: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: mock.session }));
vi.mock("../../src/db/client", () => ({ getDb: mock.db }));
import { getBirthdays } from "../../src/features/birthdays/service";
beforeEach(() => { vi.resetAllMocks(); mock.session.mockResolvedValue({ id: "viewer", role: "member" }); mock.db.mockReturnValue({ execute: mock.execute }); });
describe("private birthday listing", () => {
  it("rejects anonymous access before querying member data", async () => {
    mock.session.mockResolvedValue(null); await expect(getBirthdays()).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 }); expect(mock.db).not.toHaveBeenCalled();
  });
  it("hides village 6 and unassigned records while keeping all visible birthday names without birth years", async () => {
    const person = { id: "visible", name: "가상생일자", churchOffice: "집사", village: "5", sam: "5-6", birthDate: "1980-11-05" };
    mock.execute.mockResolvedValue({ rows: [person, { ...person, id: "hidden-six", village: "6" }, { ...person, id: "hidden-none", village: null }] });
    const data = await getBirthdays(new Date("2026-11-05T06:00:00Z"));
    expect(data.current.people).toEqual([{ id: "visible", name: "가상생일자", churchOffice: "집사", village: "5마을", sam: "5-6샘" }]);
    expect(data.history).toHaveLength(3); expect(data.upcoming.date).toBe("2026-11-06"); expect(JSON.stringify(data)).not.toContain("1980");
  });
});
