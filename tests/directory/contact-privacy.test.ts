import { beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../../src/features/auth/crypto";
import {
  buildCommunityDirectory,
  getCommunityDirectory,
  resolveDirectoryPhone,
  type DirectoryRosterRow,
} from "../../src/features/directory/service";

const database = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: database.getDb }));
vi.mock("../../src/features/auth/http-session", () => ({
  getCurrentSessionUser: async () => null,
}));
vi.mock("../../src/features/pastoral/access", () => ({
  directory: () => { throw new Error("No database access is allowed in this test."); },
}));
vi.mock("../../src/features/roster/crypto", () => ({
  decryptRosterPhone: () => { throw new Error("Tests must inject their synthetic phone decryptor."); },
}));

const phone = "01000000000";
const formattedPhone = "010-0000-0000";
const ciphertext = "synthetic-encrypted-phone";
const decrypt = () => phone;
let phonePasswordHash: string;
let formattedPasswordHash: string;
let independentPasswordHash: string;

beforeAll(async () => {
  phonePasswordHash = await hashPassword(phone);
  formattedPasswordHash = await hashPassword(formattedPhone);
  independentPasswordHash = await hashPassword("synthetic-directory-passphrase");
});

function person(overrides: Partial<DirectoryRosterRow> = {}): DirectoryRosterRow {
  return {
    id: "synthetic-person",
    sourceName: "가상구성원",
    canonicalName: "가상구성원",
    village: "1",
    sam: "1",
    samLabel: "1-1",
    isActive: true,
    position: "성도",
    phoneCiphertext: ciphertext,
    passwordHash: independentPasswordHash,
    isNoticeOfficer: false,
    directoryAge: null,
    directoryGender: null,
    directoryFamily: null,
    directoryGroupRole: null,
    ...overrides,
  };
}

describe("directory contact privacy", () => {
 it("removes private phone numbers before producing member DTOs",async()=>{const decoder=vi.fn(decrypt);const result=await buildCommunityDirectory([person({phonePrivate:true})],[],[],decoder);expect(result.members[0].phone).toBeNull();expect(result.members[0].contactStatus).toBe("private");expect(decoder).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toContain(ciphertext);});
  it("displays registered contacts even before their owner sets a new password", async () => {
    const decryptInitial = vi.fn(decrypt);
    const contact = await resolveDirectoryPhone(person({ passwordHash: null }), decryptInitial);
    expect(contact).toEqual({ phone: formattedPhone, phoneUnavailable: false, contactStatus: "available" });
    expect(decryptInitial).toHaveBeenCalledOnce();
  });

  it("does not use a raw-phone password to filter contact visibility", async () => {
    const contact = await resolveDirectoryPhone(person({ passwordHash: phonePasswordHash }), decrypt);
    expect(contact).toEqual({ phone: formattedPhone, phoneUnavailable: false, contactStatus: "available" });
  });

  it("does not use a formatted-phone password to filter contact visibility", async () => {
    const contact = await resolveDirectoryPhone(person({ passwordHash: formattedPasswordHash }), decrypt);
    expect(contact).toEqual({ phone: formattedPhone, phoneUnavailable: false, contactStatus: "available" });
  });

  it("displays the phone after a change to a phone-independent password", async () => {
    const contact = await resolveDirectoryPhone(person(), decrypt);
    expect(contact).toEqual({ phone: formattedPhone, phoneUnavailable: false, contactStatus: "available" });
  });

  it("does not inspect password hashes when displaying contacts", async () => {
    const contact = await resolveDirectoryPhone(person({ passwordHash: "invalid-password-hash" }), decrypt);
    expect(contact.phone).toBe(formattedPhone);
    expect(contact.contactStatus).toBe("available");
  });

  it("keeps failed decryption hidden and distinguishes missing numbers", async () => {
    const decryptFailed = await resolveDirectoryPhone(person(), () => { throw new Error("Synthetic decryption failure"); });
    expect(decryptFailed.phone).toBeNull();
    expect(decryptFailed.contactStatus).toBe("unavailable");
    expect(await resolveDirectoryPhone(person({ phoneCiphertext: null }), decrypt)).toEqual({ phone: null, phoneUnavailable: false, contactStatus: "missing" });
  });

  it("excludes inactive people before decrypting their contacts", async () => {
    const decryptContact = vi.fn(decrypt);
    const inactive = person({ id: "inactive-person", sourceName: "가상비활성", isActive: false, phoneCiphertext: "inactive-ciphertext" });
    const result = await buildCommunityDirectory([inactive, person()], [], [], decryptContact);
    expect(result.members.map(member => member.id)).toEqual(["synthetic-person"]);
    expect(decryptContact).toHaveBeenCalledTimes(1);
    expect(decryptContact).not.toHaveBeenCalledWith("inactive-ciphertext");
  });

  it("sends display contacts for all members without exposing credentials or family details", async () => {
    const result = await buildCommunityDirectory([
      person({ id: "initial-person", passwordHash: null }),
      person({ id: "changed-person" }),
    ], [], [], decrypt);
    const initial = result.members.find(member => member.id === "initial-person");
    const changed = result.members.find(member => member.id === "changed-person");
    expect(initial?.phone).toBe(formattedPhone);
    expect(changed?.phone).toBe(formattedPhone);
    for (const member of result.members) {
      expect(member).not.toHaveProperty("passwordHash");
      expect(member).not.toHaveProperty("phoneCiphertext");
      expect(member).not.toHaveProperty("canonicalName");
      expect(member).not.toHaveProperty("family");
      expect(member).not.toHaveProperty("directoryFamily");
    }
    expect(JSON.stringify(result)).not.toContain(independentPasswordHash);
    expect(JSON.stringify(result)).not.toContain(ciphertext);
  });

  it("rejects anonymous directory access before touching the database", async () => {
    await expect(getCommunityDirectory()).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(database.getDb).not.toHaveBeenCalled();
  });

  it("includes a registered unmatched leader as group metadata without creating a member or granting a role", async () => {
    const result = await buildCommunityDirectory([
      person({ village: "5", sam: "6", samLabel: "5-6", passwordHash: null }),
    ], [
      { id: "registered-sam", name: "5-6", village: "5", leaderName: "가상미등록리더", isActive: true, leaderRosterId: null, leaderBindingLocked: true },
      { id: "inactive-sam", name: "5-7", village: "5", leaderName: "가상지난리더", isActive: false },
    ], [], decrypt);
    expect(result.sams).toEqual([{ name: "5-6샘", village: "5마을", leaderName: "가상미등록리더" }]);
    expect(result.members).toHaveLength(1);
    expect(result.members[0].name).toBe("가상구성원");
    expect(result.members[0].roles).toEqual(["샘원"]);
    expect(result.sams[0]).not.toHaveProperty("leaderRosterId");
    expect(result.sams[0]).not.toHaveProperty("leaderBindingLocked");
  });
  it("hides village 6 in the display DTO while preserving Sam 5-6 and skipping hidden contacts", async () => {
    const decryptContact = vi.fn(decrypt);
    const result = await buildCommunityDirectory([
      person({ id: "visible-five-six", village: "5", samLabel: "5-6" }),
      person({ id: "hidden-six", village: "6", samLabel: "6-1" }),
      person({ id: "hidden-six-label", village: "6 마을", samLabel: "6-2" }),
    ], [
      { id: "five-six", name: "5-6", village: "5", leaderName: "가상리더", isActive: true },
      { id: "six-one", name: "6-1", village: "6마을", leaderName: "가상리더", isActive: true },
    ], [], decryptContact);
    expect(result.members.map(member => member.id)).toEqual(["visible-five-six"]);
    expect(result.sams.map(sam => sam.name)).toEqual(["5-6샘"]);
    expect(decryptContact).toHaveBeenCalledTimes(1);
  });

});
