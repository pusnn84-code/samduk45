import { DIRECTORY_SAMPLE_MEMBERS, DIRECTORY_SAMPLE_SAMS, DIRECTORY_SAMPLE_VILLAGES, type DirectoryGroupRole, type DirectorySampleMember } from "../../src/content/community-directory-sample";

export type DirectoryFilters = { villageId: string; samId: string; role: DirectoryGroupRole | "all"; query: string };
export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = { villageId: "all", samId: "all", role: "all", query: "" };
export const DIRECTORY_CLIPBOARD_TIMEOUT_MS = 5000;

export function directoryMemberName(id: string) {
  return DIRECTORY_SAMPLE_MEMBERS.find(member => member.id === id)?.name ?? "가상 구성원";
}

export function directoryVillageName(id: string) {
  return DIRECTORY_SAMPLE_VILLAGES.find(village => village.id === id)?.name ?? "";
}

export function directorySamName(id: string) {
  return DIRECTORY_SAMPLE_SAMS.find(sam => sam.id === id)?.name ?? "";
}

const normalize = (text: string) => text.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

export function filterDirectoryMembers(filters: DirectoryFilters, members: readonly DirectorySampleMember[] = DIRECTORY_SAMPLE_MEMBERS) {
  const query = normalize(filters.query);
  return members.filter(member => {
    if (filters.villageId !== "all" && member.villageId !== filters.villageId) return false;
    if (filters.samId !== "all" && member.samId !== filters.samId) return false;
    if (filters.role !== "all" && member.groupRole !== filters.role) return false;
    if (!query) return true;
    return normalize([member.name, member.groupRole, member.churchOffice, directoryVillageName(member.villageId), directorySamName(member.samId)].join(" ")).includes(query);
  });
}

export function selectDirectoryVillage(filters: DirectoryFilters, villageId: string): DirectoryFilters {
  return { ...filters, villageId, samId: "all" };
}

export function selectDirectorySam(filters: DirectoryFilters, samId: string): DirectoryFilters {
  const sam = DIRECTORY_SAMPLE_SAMS.find(item => item.id === samId);
  return sam ? { ...filters, villageId: sam.villageId, samId: sam.id } : filters;
}

export async function copyDirectoryPhone(phone: string, clipboard?: { writeText: (text: string) => Promise<void> }): Promise<boolean> {
  const digits = phone.replace(/\D/g, "");
  if (!clipboard || !digits) return false;
  return new Promise<boolean>(resolve => {
    let finished = false;
    const timeout = setTimeout(() => finish(false), DIRECTORY_CLIPBOARD_TIMEOUT_MS);
    function finish(copied: boolean) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(copied);
    }
    try {
      // A browser may leave its permission request pending indefinitely.
      // Keep the rejection handler attached even after the timeout completes.
      void Promise.resolve(clipboard.writeText(digits)).then(() => finish(true), () => finish(false));
    } catch {
      finish(false);
    }
  });
}
