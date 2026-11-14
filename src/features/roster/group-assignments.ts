import { getDb } from "../../db/client";
import { sams } from "../../db/schema";
import { makeSamLabel } from "./normalize";
import type { ImportCandidate } from "./import";

export type GroupAssignment = { group: string; village: string; sam: string };
const groupKey = (value: string) => value.normalize("NFC").replace(/\s+/gu, "");

export function parseGroupAssignments(value: unknown): GroupAssignment[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("ROSTER_GROUP_MAPPING_INVALID");
  const seen = new Set<string>();
  return value.map(item => {
    const row = item as Record<string, unknown>;
    if (!row || typeof row.group !== "string" || typeof row.village !== "string" || typeof row.sam !== "string"
      || !row.group.trim() || row.group.length > 150 || !/^[1-9]\d{0,2}$/.test(row.village) || !/^[1-9]\d{0,2}$/.test(row.sam)) {
      throw new Error("ROSTER_GROUP_MAPPING_INVALID");
    }
    const key = groupKey(row.group);
    if (seen.has(key)) throw new Error("ROSTER_GROUP_MAPPING_INVALID");
    seen.add(key);
    return { group: row.group, village: row.village, sam: row.sam };
  });
}

export async function existingGroupAssignments(): Promise<GroupAssignment[]> {
  const rows = await getDb().select({ name: sams.name, leader: sams.leaderName }).from(sams);
  return rows.flatMap(row => {
    const match = /^(\d+)-(\d+)$/.exec(row.name);
    return match && row.leader ? [{ group: match[2] + "샘 " + row.leader, village: match[1], sam: match[2] }] : [];
  });
}

export function assignRosterGroups(rows: ImportCandidate[], assignments: GroupAssignment[]): ImportCandidate[] {
  const byGroup = new Map(parseGroupAssignments(assignments).map(item => [groupKey(item.group), item]));
  return rows.map(row => {
    if (!row.sourceGroup) return row;
    const assigned = byGroup.get(groupKey(row.sourceGroup));
    if (assigned) return { ...row, village: assigned.village, sam: assigned.sam, samLabel: makeSamLabel(assigned.village, assigned.sam) };
    if (/^\d+\s*샘/u.test(row.sourceGroup)) throw new Error("ROSTER_GROUP_MAPPING_REQUIRED");
    return row;
  });
}
