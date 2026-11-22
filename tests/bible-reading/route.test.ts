import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../../src/lib/http";

const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), update: vi.fn() }));
vi.mock("../../src/features/auth/http-session", () => ({ getCurrentSessionUser: mocks.session }));
vi.mock("../../src/features/bible-reading/service", () => ({
  getBibleReadingState: mocks.get,
  updateBibleReadingState: mocks.update,
}));
vi.mock("../../src/features/bible-reading/meditations",()=>({withMeditations:async(state:unknown)=>state}));
import { GET, PUT } from "../../app/api/bible-reading/route";

const url = "https://samduk45.vercel.app/api/bible-reading";
const date = "2026-01-26";
const state = { date, completed: false, completedPeople: [], sharing: null, sharedLines: [], progress: { completedDays: 0, totalDays: 264 } };

function update(body: unknown, origin = new URL(url).origin) {
  return PUT(new Request(url, {
    method: "PUT",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ id: "signed-in-member" });
  mocks.get.mockResolvedValue(state);
  mocks.update.mockResolvedValue(state);
});

describe("member Bible reading API", () => {
  it("accepts an anonymous share only for the authenticated actor and rejects client-chosen aliases", async () => {
    expect((await update({ date, sharing: "가상 나눔", sharingAnonymous: true })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("signed-in-member", { date, sharing: "가상 나눔", sharingAnonymous: true });
    for (const body of [{ date, completed: true, sharingAnonymous: true }, { date, sharing: "가상", sharingAnonymous: "true" }, { date, sharing: "가상", sharingAnonymous: true, anonymousNumber: 1 }]) expect((await update(body)).status).toBe(400);
  });
  it("requires a member session before accessing shared names or updating records", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(new Request(url))).status).toBe(401);
    expect((await update({ date, completed: true })).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns the day's member state without shared caching", async () => {
    const response = await GET(new Request(url + "?date=" + date));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(state);
    expect(mocks.get).toHaveBeenCalledWith("signed-in-member", date);
  });

  it("updates only the authenticated actor and preserves explicit uncheck and delete values", async () => {
    expect((await update({ date, completed: false })).status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith("signed-in-member", { date, completed: false });
    expect((await update({ date, sharing: null })).status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith("signed-in-member", { date, sharing: null });
  });

  it("accepts long, multiline meditations while rejecting empty text and NUL",async()=>{
    for(const sharing of ["  묵상 나눔  ","첫째 줄\n둘째 줄","가".repeat(5000)]){
      expect((await update({date,sharing})).status).toBe(200);
      expect(mocks.update).toHaveBeenLastCalledWith("signed-in-member",{date,sharing:sharing.trim()});
    }
    for(const sharing of [" ","가\u0000나"])expect((await update({date,sharing})).status).toBe(400);
  });

  it("rejects actor overrides and cross-site mutations", async () => {
    expect((await update({ date, userId: "someone-else", completed: true })).status).toBe(400);
    expect((await update({ date, completed: true }, "https://unrelated.example")).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("preserves schedule validation errors", async () => {
    mocks.get.mockRejectedValue(new DomainError("INVALID_READING_DATE", 400));
    const response = await GET(new Request(url + "?date=2027-01-17"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "INVALID_READING_DATE" });
  });
});
