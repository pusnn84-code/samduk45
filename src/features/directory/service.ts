import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { memberRoster } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { getCurrentSessionUser } from "../auth/http-session";
import { directory } from "../pastoral/access";
import { automaticLeaders, automaticVillageLeaders, type Identity, type SamTarget, type VillageLeader } from "../pastoral/policy";
import { decryptRosterPhone } from "../roster/crypto";
import { formatPhoneForDisplay } from "../roster/normalize";
import { activityObservationTime } from "../menu-activity/service";
import { COMMUNITY_VILLAGE_LEADERS } from "../../content/community-village-leaders";
import { visibleDirectoryVillage } from "./visibility";
import { ageOnDate, seoulDate } from "../birthdays/dates";

export type DirectoryMember = {
  id: string;
  name: string;
  village: string | null;
  sam: string | null;
  churchOffice: string | null;
  phone: string | null;
  phoneUnavailable: boolean;
  contactStatus: "available" | "missing" | "password_required" | "unavailable";
  roles: string[];
  age: number | null;
  gender: string | null;
};
export type DirectorySam = { name: string; village: string | null; leaderName: string };
export type DirectoryVillageLeader = { village: string; name: string };
export type CommunityDirectoryData = { members: DirectoryMember[]; sams: DirectorySam[]; villageLeaders?: DirectoryVillageLeader[]; activityObservedAt?: string };

export type DirectoryRosterRow = Identity & {
  position: string | null;
  sam: string | null;
  phoneCiphertext: string | null;
  isNoticeOfficer: boolean;
  directoryAge: number | null;
  directoryGender: string | null;
  directoryFamily?: string | null;
  directoryGroupRole: string | null;
  passwordHash?: string | null;
  birthDate?: string | null;
};

// Directory presentation only: do not delete or reassign the underlying member accounts.

export async function resolveDirectoryPhone(person: Pick<DirectoryRosterRow, "phoneCiphertext">, decrypt = decryptRosterPhone): Promise<Pick<DirectoryMember, "phone" | "phoneUnavailable" | "contactStatus">> {
  if (!person.phoneCiphertext) return { phone: null, phoneUnavailable: false, contactStatus: "missing" };
  try {
    const raw = decrypt(person.phoneCiphertext);
    const formatted = formatPhoneForDisplay(raw);
    return { phone: formatted, phoneUnavailable: false, contactStatus: "available" };
  } catch {
    return { phone: null, phoneUnavailable: true, contactStatus: "unavailable" };
  }
}

/** Return a display DTO only; private identity/credential fields never cross the server boundary. */
export async function buildCommunityDirectory(roster: DirectoryRosterRow[], sams: SamTarget[], heads: VillageLeader[], decrypt = decryptRosterPhone): Promise<CommunityDirectoryData> {
  const today = seoulDate();
  const leaders = new Set(automaticLeaders(sams, roster).map(binding => binding.rosterId));
  const villageHeads = new Set(automaticVillageLeaders(heads, roster).map(binding => binding.rosterId));
  const people = roster.filter(person => person.isActive && visibleDirectoryVillage(person.village) && !!(person.village?.trim() || person.samLabel?.trim()));
  const contacts = new Map<string, Awaited<ReturnType<typeof resolveDirectoryPhone>>>();
  // Contact visibility is independent of password setup; authenticated membership is checked above.
  for (let offset = 0; offset < people.length; offset += 4) {
    await Promise.all(people.slice(offset, offset + 4).map(async person => contacts.set(person.id, await resolveDirectoryPhone(person, decrypt))));
  }
  const registeredSams = sams.filter(sam => sam.isActive && visibleDirectoryVillage(sam.village)).map(sam => ({
    name: /^\d+-\d+$/.test(sam.name.trim()) ? sam.name.trim() + "샘" : sam.name.trim(),
    village: sam.village.trim() ? (/^\d+$/.test(sam.village.trim()) ? sam.village.trim() + "마을" : sam.village.trim()) : null,
    leaderName: sam.leaderName.trim(),
  }));
  const villageLeaders = heads.filter(head => head.isActive && visibleDirectoryVillage(head.village) && head.leaderName.trim()).map(head => ({
    village: /^\d+$/.test(head.village.trim()) ? head.village.trim() + "마을" : head.village.trim(), name: head.leaderName.trim(),
  }));
  for (const head of COMMUNITY_VILLAGE_LEADERS) if (!villageLeaders.some(registered => registered.village === head.village)) villageLeaders.push(head);
  return { sams: registeredSams, villageLeaders, members: people.map(person => {
    // Imported display roles do not modify notice/pastoral/admin authorization.
    const roles = [...new Set([
      ...(villageHeads.has(person.id) || villageLeaders.some(head => head.village === (/^\d+$/.test(person.village?.trim() ?? "") ? person.village!.trim() + "마을" : person.village?.trim()) && head.name === person.sourceName.trim()) ? ["마을장"] : []),
      ...(leaders.has(person.id) ? ["샘리더"] : []),
      ...(person.isNoticeOfficer ? ["임원"] : []),
      ...(person.directoryGroupRole?.trim() ? [person.directoryGroupRole.trim()] : []),
    ])];
    return {
      id: person.id, name: person.sourceName,
      village: person.village && /^\d+$/.test(person.village) ? person.village + "마을" : person.village,
      sam: person.samLabel && /^\d+-\d+$/.test(person.samLabel) ? person.samLabel + "샘" : person.samLabel || person.sam,
      churchOffice: person.position, ...contacts.get(person.id)!, roles: roles.length ? roles : ["샘원"],
      age: ageOnDate(person.birthDate, today) ?? person.directoryAge, gender: person.directoryGender,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id)) };
}

/** Read on the server for an authenticated member; never cache this directory publicly. */
export async function getCommunityDirectory(): Promise<CommunityDirectoryData> {
  if (!await getCurrentSessionUser()) throw new DomainError("UNAUTHORIZED", 401);
  const db = getDb();
  const activityObservedAt = await activityObservationTime(db);
  const [roster, groups] = await Promise.all([
    db.select({ id: memberRoster.id, sourceName: memberRoster.sourceName, canonicalName: memberRoster.canonicalName,
      village: memberRoster.village, sam: memberRoster.sam, samLabel: memberRoster.samLabel, isActive: memberRoster.isActive,
      position: memberRoster.position, phoneCiphertext: memberRoster.phoneCiphertext, isNoticeOfficer: memberRoster.isNoticeOfficer,
      birthDate: memberRoster.birthDate,
      directoryAge: memberRoster.directoryAge, directoryGender: memberRoster.directoryGender,
      directoryGroupRole: memberRoster.directoryGroupRole,
    }).from(memberRoster).where(eq(memberRoster.isActive, true)),
    directory(db),
  ]);
  return { ...await buildCommunityDirectory(roster, groups.sams, groups.heads), activityObservedAt };
}
