import { afterEach, describe, expect, it, vi } from "vitest";
import { DIRECTORY_SAMPLE_MEMBERS, DIRECTORY_SAMPLE_PHONE, DIRECTORY_SAMPLE_SAMS } from "../src/content/community-directory-sample";
import { copyDirectoryPhone, DIRECTORY_CLIPBOARD_TIMEOUT_MS, EMPTY_DIRECTORY_FILTERS, filterDirectoryMembers, selectDirectorySam, selectDirectoryVillage } from "../components/directory/directory-state";

describe("sample community directory selection", () => {
  it("clears the old sam when moving to another village", () => {
    const filters = selectDirectoryVillage(selectDirectorySam(EMPTY_DIRECTORY_FILTERS, "sample-sam-4"), "sample-village-1");
    const results = filterDirectoryMembers(filters);
    expect(filters.samId).toBe("all");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(member => member.villageId === "sample-village-1")).toBe(true);
  });

  it("selecting a sam also selects its village and preserves role/search filters", () => {
    const filters = selectDirectorySam({ ...EMPTY_DIRECTORY_FILTERS, role: "샘리더", query: " 가상라 온 " }, "sample-sam-2");
    expect(filters.villageId).toBe("sample-village-1");
    expect(filterDirectoryMembers(filters).map(member => member.id)).toEqual(["sample-person-4"]);
  });

  it("searches names within the selected scope", () => {
    const filters = { ...EMPTY_DIRECTORY_FILTERS, query: "가상가람" };
    expect(filterDirectoryMembers(filters).map(member => member.id)).toEqual(["sample-person-1"]);
    expect(filterDirectoryMembers(selectDirectorySam(filters, "sample-sam-4"))).toEqual([]);
  });

  it("keeps sample sam memberships within the sample directory", () => {
    for (const member of DIRECTORY_SAMPLE_MEMBERS) {
      expect(member.phone).toBe(DIRECTORY_SAMPLE_PHONE);
      expect(DIRECTORY_SAMPLE_SAMS.find(sam => sam.id === member.samId)?.villageId).toBe(member.villageId);
    }
  });
});

describe("directory phone copy", () => {
  afterEach(() => vi.useRealTimers());

  it("copies only the digits of the placeholder phone", async () => {
    const writes: string[] = [];
    const copied = await copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: async value => { writes.push(value); } });
    expect(copied).toBe(true);
    expect(writes).toEqual(["01000000000"]);
  });

  it("does not report success before the clipboard write completes", async () => {
    let complete!: () => void;
    let settled = false;
    const pending = copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: () => new Promise<void>(resolve => { complete = resolve; }) }).then(result => { settled = true; return result; });
    await Promise.resolve();
    expect(settled).toBe(false);
    complete();
    expect(await pending).toBe(true);
  });

  it("reports unavailable or rejected clipboard access as a failure for manual copying", async () => {
    expect(await copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE)).toBe(false);
    expect(await copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: async () => { throw new Error("clipboard denied"); } })).toBe(false);
  });

  it("returns failure after five seconds when the browser never completes its clipboard request", async () => {
    vi.useFakeTimers();
    let settled = false;
    const pending = copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: () => new Promise<void>(() => {}) }).then(result => { settled = true; return result; });
    await vi.advanceTimersByTimeAsync(DIRECTORY_CLIPBOARD_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up the timeout immediately after a successful clipboard write", async () => {
    vi.useFakeTimers();
    const pending = copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: async () => {} });
    expect(vi.getTimerCount()).toBe(1);
    expect(await pending).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles a late clipboard rejection after timeout without leaving a timer or reporting success", async () => {
    vi.useFakeTimers();
    let rejectWrite!: (reason: Error) => void;
    const pending = copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: () => new Promise<void>((_, reject) => { rejectWrite = reject; }) });
    await vi.advanceTimersByTimeAsync(DIRECTORY_CLIPBOARD_TIMEOUT_MS);
    expect(await pending).toBe(false);
    rejectWrite(new Error("clipboard permission rejected late"));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(await pending).toBe(false);
  });

  it("cleans up its timer for synchronous and asynchronous clipboard rejections", async () => {
    vi.useFakeTimers();
    expect(await copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: () => { throw new Error("clipboard unavailable"); } })).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(await copyDirectoryPhone(DIRECTORY_SAMPLE_PHONE, { writeText: async () => { throw new Error("clipboard denied"); } })).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
