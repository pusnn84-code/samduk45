import { beforeAll, describe, expect, it, vi } from "vitest";
import { utils, write } from "xlsx";
import { importRosterUploadBuffer } from "../../src/features/admin/roster-import-service";
import { phoneLookupHash } from "../../src/features/auth/crypto";
import type { PreparedRosterRow } from "../../src/features/roster/import";

const headers = ["교구", "그룹", "그룹직책", "이름", "교회직분", "핸드폰", "나이", "성별", "신앙세대주", "세대주와의관계", "가족관계(세대주,배우자제외)"];

function workbook(rows: string[][]) {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet([headers, ...rows]), "가상 명단");
  return Buffer.from(write(book, { type: "buffer", bookType: "xlsx" }));
}

describe("church export admin import boundary", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "postgres://example";
    process.env.SESSION_SECRET = "s".repeat(32);
    process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
    process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString("base64");
  });

  const adminCredential = () => ({ canonicalName: "가상관리자", phoneLookupHash: phoneLookupHash("01000000001") });

  it("maps every SAM before persistence and returns only aggregate preservation counts", async () => {
    const prepared: PreparedRosterRow[] = [];
    const replaceXlsRoster = vi.fn(async (rows: PreparedRosterRow[]) => {
      prepared.push(...rows);
      return { created: 1, updated: 1, preservedAuth: 1 };
    });
    const summary = await importRosterUploadBuffer({
      buffer: workbook([
        ["가상교구", "01샘 가상리더", "샘리더", "가상관리자A", "집사", "010-0000-0001", "45", "여", "가상세대주", "배우자", "가상가족"],
        ["가상교구", "02샘 가상리더", "샘원", "가상회원", "성도", "미등록", "", "남"],
      ]),
      adminCredential: adminCredential(),
      groupAssignments: [
        { group: "01샘 가상리더", village: "3", sam: "1" },
        { group: "02샘 가상리더", village: "4", sam: "2" },
      ],
      repository: { replaceXlsRoster },
    });
    expect(replaceXlsRoster).toHaveBeenCalledOnce();
    expect(prepared[0]).toMatchObject({ sourceName: "가상관리자A", canonicalName: "가상관리자", isAdmin: true, village: "3", sam: "1", samLabel: "3-1", directoryAge: 45, directoryGender: "여", directoryGroupRole: "샘리더", directoryFamily: "신앙세대주: 가상세대주 · 세대주와의 관계: 배우자 · 가상가족" });
    expect(prepared[0].phoneCiphertext).toBeTruthy();
    expect(prepared[0]).not.toHaveProperty("phone");
    expect(prepared[1]).toMatchObject({ isAdmin: false, phoneLookupHash: null, phoneCiphertext: null, samLabel: "4-2" });
    expect(summary).toEqual({ total: 2, imported: 2, missingPhone: 1, errors: 0, created: 1, updated: 1, preservedAuth: 1 });
  });

  it("rejects incomplete group mapping before invoking the repository", async () => {
    const replaceXlsRoster = vi.fn();
    await expect(importRosterUploadBuffer({
      buffer: workbook([["가상교구", "1샘 가상리더", "샘리더", "가상관리자", "집사", "01000000001"]]),
      adminCredential: adminCredential(), groupAssignments: [], repository: { replaceXlsRoster },
    })).rejects.toThrow("ROSTER_GROUP_MAPPING_REQUIRED");
    expect(replaceXlsRoster).not.toHaveBeenCalled();
  });

  it("allows an authenticated staff administrator omitted from the church member export", async () => {
    const prepared: PreparedRosterRow[] = [];
    const replaceXlsRoster = vi.fn(async (rows: PreparedRosterRow[]) => { prepared.push(...rows); });
    const summary = await importRosterUploadBuffer({
      buffer: workbook([["가상교구", "3마을", "마을리더", "가상회원", "집사", "01000000002"]]),
      adminCredential: adminCredential(), groupAssignments: [], repository: { replaceXlsRoster },
    });
    expect(replaceXlsRoster).toHaveBeenCalledOnce();
    expect(prepared).toEqual([expect.objectContaining({ canonicalName: "가상회원", isAdmin: false })]);
    expect(summary).toEqual({ total: 1, imported: 1, missingPhone: 0, errors: 0 });
  });

  it("rejects malformed source contact data before invoking the repository", async () => {
    const replaceXlsRoster = vi.fn();
    await expect(importRosterUploadBuffer({
      buffer: workbook([["가상교구", "3마을", "마을리더", "가상관리자", "집사", "123"]]),
      adminCredential: adminCredential(), groupAssignments: [], repository: { replaceXlsRoster },
    })).rejects.toMatchObject({ message: "ROSTER_PHONE_INVALID", sourceRows: [2] });
    expect(replaceXlsRoster).not.toHaveBeenCalled();
  });
});
