import { describe, expect, it } from "vitest";
import { planRosterIdentityMatches, rosterImportProfile, type ExistingImportIdentity, type PreparedRosterRow } from "../../src/features/roster/import";

const hash = (character: string) => character.repeat(64);
const imported = (overrides: Partial<PreparedRosterRow> = {}): PreparedRosterRow => ({
  sourceRow: 2, sourceName: "가상회원A", canonicalName: "가상회원", position: "집사",
  phoneLookupHash: hash("a"), phoneCiphertext: "synthetic-encrypted-value", village: "3", sam: "1", samLabel: "3-1",
  isActive: true, isAdmin: false, source: "xls", ...overrides,
});

describe("roster import identity preservation", () => {
  it.each(["xls", "admin", "manual"])("retains the exact roster ID for existing %s identities", source => {
    const existing = { id: "stable-roster-id", canonicalName: "가상회원", phoneLookupHash: hash("a"), source };
    const [match] = planRosterIdentityMatches([imported({ sourceName: "가상회원B", village: "4", samLabel: "4-2" })], [existing]);
    expect(match.existing).toBe(existing);
    expect(match.existing!.id).toBe("stable-roster-id");
  });

  it("requires both canonical name and phone hash and never falls back to name or phone alone", () => {
    const existing: ExistingImportIdentity[] = [
      { id: "same-name", canonicalName: "가상회원", phoneLookupHash: hash("b"), source: "xls" },
      { id: "same-phone", canonicalName: "다른가상회원", phoneLookupHash: hash("a"), source: "admin" },
      { id: "no-phone", canonicalName: "가상회원", phoneLookupHash: null, source: "manual" },
    ];
    expect(planRosterIdentityMatches([imported(), imported({ phoneLookupHash: null })], existing).map(match => match.existing)).toEqual([null, null]);
  });

  it("fails before choosing an arbitrary existing ID when stored credentials conflict", () => {
    const existing = { canonicalName: "가상회원", phoneLookupHash: hash("a"), source: "xls" };
    expect(() => planRosterIdentityMatches([imported()], [{ ...existing, id: "first" }, { ...existing, id: "second" }])).toThrow("ROSTER_IDENTITY_CONFLICT");
  });

  it("updates profile fields without overwriting stored credentials, roles, active state or assignment flags", () => {
    const profile = rosterImportProfile(imported({ directoryAge: 45, directoryGender: "여", directoryFamily: "가상 가족", directoryGroupRole: "샘리더", isAdmin: true }));
    const existing = { id: "stable-roster-id", source: "admin", passwordHash: "custom-password-hash", isActive: false, isAdmin: true, isNoticeOfficer: true };
    const updated = { ...existing, ...profile };
    expect(updated).toMatchObject(existing);
    expect(updated).toMatchObject({ samLabel: "3-1", directoryAge: 45, directoryGroupRole: "샘리더" });
    for (const field of ["id", "source", "passwordHash", "isActive", "isAdmin", "isNoticeOfficer"]) expect(Object.hasOwn(profile, field)).toBe(false);
  });

  it("preserves existing directory metadata when an older workbook omits it and permits explicit clearing", () => {
    const existing = { directoryAge: 60, directoryGender: "남", directoryFamily: "기존 가상 가족", directoryGroupRole: "임원" };
    expect({ ...existing, ...rosterImportProfile(imported()) }).toMatchObject(existing);
    expect(rosterImportProfile(imported({ directoryAge: null, directoryGender: null, directoryFamily: null, directoryGroupRole: null })))
      .toMatchObject({ directoryAge: null, directoryGender: null, directoryFamily: null, directoryGroupRole: null });
  });
});
