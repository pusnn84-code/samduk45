import { DomainError } from "../../lib/http";
import { assignRosterGroups, existingGroupAssignments, type GroupAssignment } from "../roster/group-assignments";
import {
  importRosterCandidates,
  parseRosterWorkbookBuffer,
  type ImportSummary,
  type RosterImportRepository,
} from "../roster/import";

export const MAX_ROSTER_FILE_BYTES = 2 * 1024 * 1024;

export function validateRosterUploadMeta({
  name,
  size,
}: {
  name: string;
  size: number;
}): void {
  if (!/\.xlsx?$/i.test(name)) {
    throw new DomainError("ROSTER_FILE_TYPE", 400);
  }
  if (size <= 0 || size > MAX_ROSTER_FILE_BYTES) {
    throw new DomainError("ROSTER_FILE_TOO_LARGE", 413);
  }
}

export async function importRosterUploadBuffer({
  buffer,
  adminCredential,
  repository,
  groupAssignments,
}: {
  buffer: Buffer;
  adminCredential: {
    canonicalName: string;
    phoneLookupHash: string;
  };
  repository?: RosterImportRepository;
  groupAssignments?: GroupAssignment[];
}): Promise<ImportSummary> {
  const parsed = parseRosterWorkbookBuffer(buffer);
  const assignments = groupAssignments ?? (parsed.some(row => row.sourceGroup) ? await existingGroupAssignments() : []);
  const rows = assignRosterGroups(parsed, assignments);
  return importRosterCandidates(rows, {
    adminCredential,
    repository,
    // An authenticated administrator can be staff omitted from the congregation export.
    preserveExistingAdmin: true,
  });
}
