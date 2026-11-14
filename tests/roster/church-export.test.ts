import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { parseRosterWorkbookBuffer, RosterWorkbookError, validateRosterCandidates } from "../../src/features/roster/import";

const headers = ["교구", "그룹", "그룹직책", "이름", "교회직분", "핸드폰", "나이", "성별", "신앙세대주", "세대주와의관계", "가족관계(세대주,배우자제외)"];

function workbook(rows: string[][]) {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "가상 명단");
  return Buffer.from(write(book, { type: "buffer", bookType: "xlsx" }));
}

describe("church export roster parsing", () => {
  it("retains valid birth dates and rejects impossible calendar dates", () => {
    const birthHeaders = [...headers, "생년월일"];
    const row = ["가상교구", "1샘 가상리더", "샘원", "가상생일자", "성도", "01000000004", "26", "여", "", "", "", "2000-02-29"];
    expect(parseRosterWorkbookBuffer(workbook([birthHeaders, row]))[0].birthDate).toBe("2000-02-29");
    expect(() => parseRosterWorkbookBuffer(workbook([birthHeaders, [...row.slice(0, -1), "2001-02-29"]])))
      .toThrow(expect.objectContaining({ message: "ROSTER_BIRTH_DATE_INVALID", sourceRows: [2] }));
  });
  it("locates the export header after a title and retains source identities and directory fields", () => {
    const rows = parseRosterWorkbookBuffer(workbook([
      ["테스트 전용 가상 명단"], headers,
      ["가상교구", "01샘 가상리더", "샘리더", " 가상회원A ", "집사", "010-0000-0001", "45세", "여", "가상세대주", "배우자", "가상가족"],
      [],
      ["가상교구", "03마을", "마을리더", "가상회원B", "장로", "미등록", "", "남"],
    ]));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      sourceGroup: "01샘 가상리더", sourceRow: 3, sourceName: "가상회원A", canonicalName: "가상회원",
      position: "집사", phone: "01000000001", village: null, sam: "01샘 가상리더", samLabel: "01샘 가상리더",
      directoryAge: 45, directoryGender: "여", directoryFamily: "신앙세대주: 가상세대주 · 세대주와의 관계: 배우자 · 가상가족", directoryGroupRole: "샘리더",
    });
    expect(rows[1]).toMatchObject({ sourceRow: 5, phone: null, village: "03", sam: null, samLabel: null, directoryAge: null, directoryFamily: null });
  });

  it("supports reordered columns and missing optional directory columns", () => {
    const rows = parseRosterWorkbookBuffer(workbook([
      ["핸드폰", "이름", "그룹직책", "교회직분", "그룹", "교구"],
      ["01000000002", "가상다온", "샘원", "성도", "2샘 가상인도자", "가상교구"],
    ]));
    expect(rows[0]).toMatchObject({ canonicalName: "가상다온", phone: "01000000002", sourceGroup: "2샘 가상인도자", directoryAge: null, directoryGender: null, directoryFamily: null, directoryGroupRole: "샘원" });
  });

  it("counts known missing-phone markers without inventing login credentials", () => {
    const markers = ["", "없음", "미상", "미등록", "핸드폰 없음", "-", "—"];
    const rows = parseRosterWorkbookBuffer(workbook([headers, ...markers.map((phone, index) => ["가상교구", "3마을", "샘원", `가상회원${index}`, "성도", phone])]));
    expect(rows.every(row => row.phone === null)).toBe(true);
    expect(validateRosterCandidates(rows)).toEqual({ missingPhone: markers.length, errors: [] });
  });

  it("reports every malformed numeric phone by its worksheet row", () => {
    try {
      parseRosterWorkbookBuffer(workbook([headers,
        ["가상교구", "3마을", "샘원", "가상가람", "성도", "123"],
        ["가상교구", "3마을", "샘원", "가상나래", "성도", "010-0000-0002"],
        ["가상교구", "3마을", "샘원", "가상다온", "성도", "010000000000"],
      ]));
      expect.fail("Malformed phone numbers must reject the workbook");
    } catch (error) {
      expect(error).toBeInstanceOf(RosterWorkbookError);
      expect(error).toMatchObject({ message: "ROSTER_PHONE_INVALID", sourceRows: [2, 4] });
    }
  });

  it.each(["나이 미상", "131", "-1", "20.5"])("rejects invalid directory age %s with the source row", age => {
    expect(() => parseRosterWorkbookBuffer(workbook([headers, ["가상교구", "3마을", "샘원", "가상가람", "성도", "", age]])))
      .toThrow(expect.objectContaining({ message: "ROSTER_DIRECTORY_AGE_INVALID", sourceRows: [2] }));
  });

  it("detects duplicate canonical name and normalized phone while retaining namesake suffixes", () => {
    const rows = parseRosterWorkbookBuffer(workbook([headers,
      ["가상교구", "1샘 가상리더", "샘원", "가상회원A", "성도", "010-0000-0001"],
      ["가상교구", "2샘 가상리더", "샘원", "가상회원B", "집사", "01000000001"],
    ]));
    expect(rows.map(row => row.sourceName)).toEqual(["가상회원A", "가상회원B"]);
    expect(validateRosterCandidates(rows).errors).toEqual([{ code: "DUPLICATE_CREDENTIAL", sourceRows: [2, 3] }]);
  });
});
