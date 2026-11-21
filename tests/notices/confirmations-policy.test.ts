import { describe, expect, it } from "vitest";
import { confirmationAccess, confirmationAudience, confirmationState, needsConfirmation, type ConfirmationDirectory, type ConfirmationRoster } from "../../src/features/notices/confirmation-policy";

const person = (id: string, name = id): ConfirmationRoster => ({ id, sourceName: name, canonicalName: name, village: "1", samLabel: "1-1", isActive: true, isAdmin: false, isNoticeOfficer: false });
function data(): ConfirmationDirectory {
  return {
    roster: [person("leader", "김리더A"), person("officer", "박임원 집사"), person("ordinary", "일반성도"), person("admin", "관리자"), person("head", "마을리더"), person("not-joined", "미로그인리더")],
    users: ["leader", "officer", "ordinary", "admin", "head"].map(id => ({ id: `user-${id}`, rosterId: id, role: id === "admin" ? "admin" : "member", isActive: true })),
    sams: [{ id: "sam", name: "1-1", village: "1", leaderName: "김리더A", leaderRosterId: "leader", leaderBindingLocked: true, isActive: true }, { id: "sam2", name: "1-2", village: "1", leaderName: "미로그인리더", leaderRosterId: "not-joined", isActive: true }],
    heads: [{ id: "head", name: "1마을장", village: "1", leaderName: "마을리더", leaderRosterId: "head", leaderBindingLocked: true, isActive: true }],
  };
}

describe("leader notice confirmation audience", () => {
  it("allows sam and village leaders to see all current leadership confirmations", () => {
    const directory = data();
    expect(confirmationAudience(directory).find(person => person.id === "head")?.responsibilities).toEqual(["1마을장"]);
    directory.roster.find(person => person.id === "not-joined")!.samLabel = "1-2";
    for (const id of ["user-leader", "user-head", "user-admin"]) expect(confirmationAccess(id, directory).visible).toBe(true);
    expect(confirmationAccess("user-leader", directory).audience.map(person => person.id)).toContain("not-joined");
  });
  it("does not infer officers from a church rank or ordinary membership", () => {
    const directory = data();
    directory.roster.find(person => person.id === "ordinary")!.sourceName = "일반성도 장로";
    expect(confirmationAccess("user-ordinary", directory).visible).toBe(false);
    expect(confirmationAccess("user-officer", directory).visible).toBe(false);
  });
  it("explicit notice officer assignment permits confirmations without granting admin or pastoral roles", () => {
    const directory = data(); directory.roster.find(person => person.id === "officer")!.isNoticeOfficer = true;
    const access = confirmationAccess("user-officer", directory);
    expect(access.visible).toBe(true);
    expect(access.audience.find(person => person.id === "officer")).toEqual({ id: "officer", name: "박임원", responsibilities: ["임원"] });
    expect(directory.users.find(user => user.id === "user-officer")!.role).toBe("member");
  });
  it("never grants a role by matching a display name", () => {
    const directory = data();
    directory.roster.find(person => person.id === "ordinary")!.sourceName = "김리더A";
    expect(confirmationAccess("user-ordinary", directory).visible).toBe(false);
    directory.sams[0].leaderRosterId = null;
    expect(confirmationAccess("user-leader", directory).visible).toBe(false);
  });
  it("excludes disabled identities, disabled accounts and disabled leader registrations", () => {
    const directory = data(); directory.roster[0].isActive = false;
    expect(confirmationAudience(directory).some(person => person.id === "leader")).toBe(false);
    directory.users.find(user => user.id === "user-admin")!.isActive = false;
    expect(confirmationAccess("user-admin", directory).visible).toBe(false);
    directory.heads[0].isActive = false;
    expect(confirmationAccess("user-head", directory).visible).toBe(false);
  });
  it("does not retain sam authority after someone moves to a different sam", () => {
    const directory = data(); directory.roster[0].samLabel = "2-2";
    expect(confirmationAccess("user-leader", directory).visible).toBe(false);
  });
  it("deduplicates people with several leadership responsibilities", () => {
    const directory = data(); directory.roster[0].isNoticeOfficer = true; directory.roster[0].isAdmin = true;
    const audience = confirmationAudience(directory);
    expect(audience.filter(person => person.id === "leader")).toHaveLength(1);
    expect(audience.find(person => person.id === "leader")!.responsibilities).toEqual(["관리자", "임원", "1-1샘 리더"]);
  });
  it("returns only identity, display name and responsibilities, never church rank/contact details", () => {
    const directory = data(); directory.roster[0].sourceName = "김리더A 집사";
    const audience = confirmationAudience(directory);
    expect(Object.keys(audience[0]).sort()).toEqual(["id", "name", "responsibilities"]);
    expect(audience.find(person => person.id === "leader")!.name).toBe("김리더A");
  });
  it("keeps real name syllables that happen to match a church rank", () => {
    const directory = data(); directory.roster[0].sourceName = "김성도"; directory.roster[0].canonicalName = "김성도";
    expect(confirmationAudience(directory).find(person => person.id === "leader")!.name).toBe("김성도");
    directory.roster[0].sourceName = "김성도 (집사)";
    expect(confirmationAudience(directory).find(person => person.id === "leader")!.name).toBe("김성도");
  });
});

describe("explicit confirmation and notice revisions", () => {
  const revision = "a".repeat(32), nextRevision = "b".repeat(32), at = "2027-01-02T03:04:05.000Z";
  it("opening the notice without a separate confirmation keeps the viewer unconfirmed", () => {
    const state = confirmationState("user-leader", data(), revision, []);
    expect(state!.confirmed).toHaveLength(0);
    expect(state!.unconfirmed.map(person => person.id)).toContain("leader");
    expect(state!.ownConfirmedAt).toBeNull();
  });
  it("only current-revision confirmations count, so editing a notice requires reconfirmation", () => {
    const records = [{ rosterId: "leader", revision, confirmedAt: at }];
    expect(confirmationState("user-head", data(), revision, records)!.confirmed.map(person => person.id)).toEqual(["leader"]);
    expect(confirmationState("user-leader", data(), nextRevision, records)!.ownConfirmedAt).toBeNull();
    expect(confirmationState("user-leader", data(), nextRevision, records)!.confirmed).toHaveLength(0);
    expect(needsConfirmation(records[0], revision)).toBe(false);
    expect(needsConfirmation(records[0], nextRevision)).toBe(true);
  });
  it("ignores former leaders' receipts without including inactive/ordinary names in the board", () => {
    const directory = data(); directory.sams[0].isActive = false;
    const state = confirmationState("user-admin", directory, revision, [{ rosterId: "leader", revision, confirmedAt: at }]);
    expect([...state!.confirmed, ...state!.unconfirmed].some(person => person.id === "leader")).toBe(false);
  });
  it("ordinary members cannot get even an empty confirmation board", () => expect(confirmationState("user-ordinary", data(), revision, [])).toBeNull());
});
