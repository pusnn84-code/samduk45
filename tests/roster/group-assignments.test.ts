import { describe, expect, it } from "vitest";
import { assignRosterGroups, parseGroupAssignments } from "../../src/features/roster/group-assignments";
import type { ImportCandidate } from "../../src/features/roster/import";

const candidate = (group: string): ImportCandidate => ({ sourceRow: 2, sourceGroup: group, sourceName: "가상회원", canonicalName: "가상회원", position: null, phone: null, village: null, sam: group, samLabel: group });

describe("explicit church group assignments", () => {
  it("matches NFC and whitespace variants while preserving original source fields", () => {
    const row = candidate(" 01샘  가상리더 ");
    const mapping = parseGroupAssignments([{ group: "01샘 가상리더".normalize("NFD"), village: "3", sam: "1" }]);
    expect(assignRosterGroups([row], mapping)).toEqual([{ ...row, village: "3", sam: "1", samLabel: "3-1" }]);
    expect(row.village).toBeNull();
  });

  it("requires complete mapping coverage for numeric SAM labels, including labels without a leader", () => {
    for (const group of ["1샘 가상리더", "1샘", "01 샘"]) {
      expect(() => assignRosterGroups([candidate(group)], [])).toThrow("ROSTER_GROUP_MAPPING_REQUIRED");
    }
  });

  it("rejects conflicting fallback mappings instead of assigning the last village silently", () => {
    const rows = [candidate("1샘 가상리더")];
    expect(() => assignRosterGroups(rows, [
      { group: "1샘 가상리더", village: "3", sam: "1" },
      { group: "1샘  가상리더", village: "4", sam: "1" },
    ])).toThrow("ROSTER_GROUP_MAPPING_INVALID");
  });

  it("keeps legacy separate-column rows and village-only church rows unchanged", () => {
    const legacy = { ...candidate("unused"), sourceGroup: undefined, village: "3", sam: "2", samLabel: "3-2" };
    const village = { ...candidate("3마을"), village: "3", sam: null, samLabel: null };
    expect(assignRosterGroups([legacy, village], [])).toEqual([legacy, village]);
  });

  it.each([null, {}, [{ group: "", village: "3", sam: "1" }], [{ group: "   ", village: "3", sam: "1" }], [{ group: "1샘 가상리더", village: 3, sam: "1" }], [{ group: "1샘 가상리더", village: "3마을", sam: "1" }], [{ group: "1샘 가상리더", village: "0", sam: "1" }], [{ group: "1샘 가상리더", village: "03", sam: "1" }], [{ group: "1샘 가상리더", village: "3", sam: "0" }], [{ group: "1샘 가상리더", village: "3", sam: "가상샘" }]])("rejects malformed mapping input %j", input => {
    expect(() => parseGroupAssignments(input)).toThrow("ROSTER_GROUP_MAPPING_INVALID");
  });

  it("rejects duplicate normalized group names and excessive mapping counts", () => {
    const mapping = { group: "1샘 가상리더", village: "3", sam: "1" };
    expect(() => parseGroupAssignments([mapping, { ...mapping, group: "1샘  가상리더" }])).toThrow("ROSTER_GROUP_MAPPING_INVALID");
    expect(() => parseGroupAssignments(Array.from({ length: 201 }, (_, index) => ({ ...mapping, group: `가상${index}` })))).toThrow("ROSTER_GROUP_MAPPING_INVALID");
  });
});
