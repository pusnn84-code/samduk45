"use client";
import { DIRECTORY_SAMPLE_MEMBERS, DIRECTORY_SAMPLE_SAMS, DIRECTORY_SAMPLE_VILLAGES } from "../../src/content/community-directory-sample";
import { directoryMemberName, directorySamName, directoryVillageName } from "./directory-state";
import { CommunityDirectory } from "./CommunityDirectory";
import type { DirectoryMember } from "../../src/features/directory/service";

const members: DirectoryMember[] = DIRECTORY_SAMPLE_MEMBERS.map(member => ({
  id: member.id, name: member.name, village: directoryVillageName(member.villageId), sam: directorySamName(member.samId),
  churchOffice: member.churchOffice, phone: member.phone, phoneUnavailable: false, contactStatus: "available",
  roles: [member.groupRole], age: member.age, gender: member.gender,
}));
const sams = DIRECTORY_SAMPLE_SAMS.map(sam => ({ name: sam.name,
  village: DIRECTORY_SAMPLE_VILLAGES.find(village => village.id === sam.villageId)?.name ?? null,
  leaderName: directoryMemberName(sam.leaderId),
}));
export function CommunityDirectorySample() { return <CommunityDirectory members={members} sams={sams} isSample />; }
