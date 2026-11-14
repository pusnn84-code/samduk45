import { automaticLeaders, automaticVillageLeaders, type Identity, type SamTarget, type VillageLeader } from "../pastoral/policy";
import type { NoticeConfirmationState } from "./types";

export type ConfirmationRoster = Identity & { isAdmin: boolean; isNoticeOfficer: boolean };
export type ConfirmationUser = { id: string; rosterId: string | null; role: "member" | "admin"; isActive: boolean };
export type ConfirmationDirectory = { roster: ConfirmationRoster[]; users: ConfirmationUser[]; sams: SamTarget[]; heads: VillageLeader[] };
export type ConfirmationRecord = { rosterId: string; revision: string; confirmedAt: string };

function displayName(person: ConfirmationRoster) {
  // Keep A/B namesake suffixes, but do not expose church ranks from imports.
  return person.sourceName.trim().replace(/(?:\s+(?:담임목사|부목사|목사|전도사|장로|권사|안수집사|집사|성도)(?:님)?|\s*[([](?:담임목사|부목사|목사|전도사|장로|권사|안수집사|집사|성도)(?:님)?[)\]])$/u, "").trim() || person.canonicalName;
}

export function confirmationAudience(directory: ConfirmationDirectory) {
  const samLeaders = automaticLeaders(directory.sams, directory.roster);
  const villageLeaders = automaticVillageLeaders(directory.heads, directory.roster);
  return directory.roster.filter(person => person.isActive).flatMap(person => {
    const responsibilities: string[] = [];
    if (person.isAdmin || directory.users.some(user => user.isActive && user.rosterId === person.id && user.role === "admin")) responsibilities.push("관리자");
    if (person.isNoticeOfficer) responsibilities.push("임원");
    for (const leader of samLeaders.filter(leader => leader.rosterId === person.id)) {
      const sam = directory.sams.find(sam => sam.id === leader.samId)!;
      responsibilities.push(`${sam.name.replace(/샘$/u, "")}샘 리더`);
    }
    for (const leader of villageLeaders.filter(leader => leader.rosterId === person.id)) responsibilities.push(`${leader.village}마을 리더`);
    return responsibilities.length ? [{ id: person.id, name: displayName(person), responsibilities: [...new Set(responsibilities)] }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id));
}

export function confirmationAccess(userId: string, directory: ConfirmationDirectory) {
  const user = directory.users.find(user => user.id === userId && user.isActive);
  const audience = confirmationAudience(directory);
  const own = user?.rosterId ? audience.find(person => person.id === user.rosterId) : undefined;
  return { authenticated: Boolean(user), visible: Boolean(user && (user.role === "admin" || own)), rosterId: own?.id ?? null, audience };
}

export function confirmationState(userId: string, directory: ConfirmationDirectory, revision: string, records: ConfirmationRecord[]): NoticeConfirmationState | null {
  const access = confirmationAccess(userId, directory);
  if (!access.visible) return null;
  const current = new Map(records.filter(record => record.revision === revision).map(record => [record.rosterId, record.confirmedAt]));
  const people = access.audience.map(person => ({ ...person, confirmedAt: current.get(person.id) ?? null }));
  return {
    revision,
    canConfirm: access.rosterId !== null,
    ownConfirmedAt: access.rosterId ? current.get(access.rosterId) ?? null : null,
    confirmed: people.filter(person => person.confirmedAt !== null),
    unconfirmed: people.filter(person => person.confirmedAt === null),
  };
}

export function needsConfirmation(existing: ConfirmationRecord | undefined, revision: string) {
  return existing?.revision !== revision;
}
