import { reconcileUnboundLeaders } from "../sams/identity-service";
import { validBirthDate } from "../birthdays/dates";
import * as fs from "node:fs";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.full.mjs";

XLSX.set_fs(fs);
XLSX.set_cptable(cptable);
import { getDb } from "../../db/client";
import { memberRoster, users } from "../../db/schema";
import { phoneLookupHash } from "../auth/crypto";
import { encryptRosterPhone } from "./crypto";
import {
  canonicalizeRosterName,
  makeSamLabel,
  normalizeOptionalPhone,
  normalizeRosterPhone,
} from "./normalize";

export type ImportCandidate = {
  sourceGroup?: string;
  sourceRow: number;
  sourceName: string;
  canonicalName: string;
  position: string | null;
  phone: string | null;
  village: string | null;
  sam: string | null;
  samLabel: string | null;
  directoryAge?: number | null;
  birthDate?: string | null;
  directoryGender?: string | null;
  directoryFamily?: string | null;
  directoryGroupRole?: string | null;
};

export type ImportValidationError = {
  code: "DUPLICATE_CREDENTIAL" | "MISSING_NAME";
  sourceRows: number[];
};

export type ImportValidation = {
  missingPhone: number;
  errors: ImportValidationError[];
};

export type PreparedRosterRow = {
  sourceRow: number;
  sourceName: string;
  canonicalName: string;
  position: string | null;
  phoneLookupHash: string | null;
  phoneCiphertext: string | null;
  village: string | null;
  sam: string | null;
  samLabel: string | null;
  isActive: boolean;
  isAdmin: boolean;
  source: "xls";
  directoryAge?: number | null;
  birthDate?: string | null;
  directoryGender?: string | null;
  directoryFamily?: string | null;
  directoryGroupRole?: string | null;
};

export type ImportSummary = {
  total: number;
  imported: number;
  missingPhone: number;
  errors: number;
  created?: number;
  updated?: number;
  preservedAuth?: number;
};

export type RosterImportCounts = { created: number; updated: number; preservedAuth: number };
export type RosterImportRepository = {
  replaceXlsRoster(rows: PreparedRosterRow[]): Promise<RosterImportCounts | void>;
};

export class RosterWorkbookError extends Error {
  constructor(code: string, readonly sourceRows: number[]) { super(code); }
}

const MISSING_PHONE_MARKERS = new Set(["", "없음", "미상", "미등록", "미입력", "미확인", "해당없음", "미보유", "휴대폰없음", "핸드폰없음", "전화없음", "번호없음", "연락처없음", "-", "—"]);

const HEADER_ALIASES = {
  name: ["이름"],
  position: ["교회직분", "직분"],
  phone: ["핸드폰", "핸드폰 번호", "핸드폰번호", "전화번호"],
  village: ["마을"],
  sam: ["샘"],
} as const;

function cellText(value: unknown): string {
  return String(value ?? "").trim().normalize("NFC");
}

function findHeaderIndex(row: string[], aliases: readonly string[]): number {
  return row.findIndex((value) => aliases.includes(value));
}

function parseWorkbook(workbook: XLSX.WorkBook): ImportCandidate[] {
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("ROSTER_SHEET_MISSING");

  const sheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }).map((row) => row.map(cellText));

  const churchHeader = matrix.slice(0, 20).findIndex(row => ["교구", "그룹", "그룹직책", "이름", "교회직분", "핸드폰"].every(header => row.includes(header)));
  if (churchHeader >= 0) return parseChurchExport(matrix, churchHeader);

  let headerRow = -1;
  let columns:
    | { name: number; position: number; phone: number; village: number; sam: number }
    | undefined;

  for (let index = 0; index < Math.min(20, matrix.length); index += 1) {
    const row = matrix[index];
    const candidate = {
      name: findHeaderIndex(row, HEADER_ALIASES.name),
      position: findHeaderIndex(row, HEADER_ALIASES.position),
      phone: findHeaderIndex(row, HEADER_ALIASES.phone),
      village: findHeaderIndex(row, HEADER_ALIASES.village),
      sam: findHeaderIndex(row, HEADER_ALIASES.sam),
    };
    if (Object.values(candidate).every((value) => value >= 0)) {
      headerRow = index;
      columns = candidate;
      break;
    }
  }

  if (headerRow < 0 || !columns) throw new Error("ROSTER_HEADERS_MISSING");

  const result: ImportCandidate[] = [];
  for (let index = headerRow + 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (row.every((value) => !value)) continue;

    const sourceName = row[columns.name] ?? "";
    const position = row[columns.position] || null;
    const phoneText = row[columns.phone] ?? "";
    const village = row[columns.village] || null;
    const sam = row[columns.sam] || null;

    let canonicalName = "";
    try {
      canonicalName = canonicalizeRosterName(sourceName);
    } catch {
      canonicalName = "";
    }

    result.push({
      sourceRow: index + 1,
      sourceName,
      canonicalName,
      position,
      phone: normalizeOptionalPhone(phoneText),
      village,
      sam,
      samLabel: makeSamLabel(village, sam),
    });
  }

  return result;
}

/** Church exports have a full group label, rather than separate village/sam columns. */
function parseChurchExport(matrix: string[][], headerRow: number): ImportCandidate[] {
  const headers = matrix[headerRow];
  const at = (row: string[], label: string) => row[headers.indexOf(label)]?.trim() ?? "";
  const invalidPhones: number[] = [];
  const invalidAges: number[] = [];
  const invalidBirthDates: number[] = [];
  const result = matrix.slice(headerRow + 1).flatMap((row, offset) => {
    if (row.every(value => !value)) return [];
    const sourceName = at(row, "이름");
    let canonicalName = "";
    try { canonicalName = canonicalizeRosterName(sourceName); } catch { /* Validation reports its source row. */ }
    const group = at(row, "그룹");
    const villageMatch = /^(\d+)마을$/u.exec(group.replace(/\s+/gu, ""));
    const village = villageMatch?.[1] ?? null;
    const sam = group.includes("샘") ? group : null;
    const phoneText = at(row, "핸드폰");
    let phone: string | null = null;
    if (/\d/u.test(phoneText) && !MISSING_PHONE_MARKERS.has(phoneText.replace(/\s+/gu, ""))) {
      try { phone = normalizeOptionalPhone(phoneText); } catch { invalidPhones.push(headerRow + offset + 2); }
    }
    const ageText = at(row, "나이");
    const ageMatch = /^(\d{1,3})(?:세)?$/u.exec(ageText);
    const age = ageMatch ? Number(ageMatch[1]) : null;
    if (ageText && (!ageMatch || age! > 130)) invalidAges.push(headerRow + offset + 2);
    const birthText = at(row, "생년월일");
    if (birthText && !validBirthDate(birthText)) invalidBirthDates.push(headerRow + offset + 2);
    const family = [
      at(row, "신앙세대주") ? `신앙세대주: ${at(row, "신앙세대주")}` : "",
      at(row, "세대주와의관계") ? `세대주와의 관계: ${at(row, "세대주와의관계")}` : "",
      at(row, "가족관계(세대주,배우자제외)"),
    ].filter(Boolean).join(" · ") || null;
    return [{ sourceGroup: group, sourceRow: headerRow + offset + 2, sourceName, canonicalName, position: at(row, "교회직분") || null, phone, village, sam, samLabel: sam || (!village ? group || null : null),
      ...(headers.includes("생년월일") ? { birthDate: birthText || null } : {}),
      directoryAge: age, directoryGender: at(row, "성별") || null, directoryFamily: family, directoryGroupRole: at(row, "그룹직책") || null }];
  });
  if (invalidPhones.length) throw new RosterWorkbookError("ROSTER_PHONE_INVALID", invalidPhones);
  if (invalidAges.length) throw new RosterWorkbookError("ROSTER_DIRECTORY_AGE_INVALID", invalidAges);
  if (invalidBirthDates.length) throw new RosterWorkbookError("ROSTER_BIRTH_DATE_INVALID", invalidBirthDates);
  return result;
}

export function parseRosterWorkbook(filePath: string): ImportCandidate[] {
  return parseWorkbook(XLSX.readFile(filePath, { cellText: true }));
}

export function parseRosterWorkbookBuffer(buffer: Buffer): ImportCandidate[] {
  return parseWorkbook(XLSX.read(buffer, { type: "buffer", cellText: true }));
}

export function validateRosterCandidates(rows: ImportCandidate[]): ImportValidation {
  const errors: ImportValidationError[] = [];
  const byCredential = new Map<string, number[]>();
  let missingPhone = 0;

  for (const row of rows) {
    if (!row.canonicalName) {
      errors.push({ code: "MISSING_NAME", sourceRows: [row.sourceRow] });
      continue;
    }
    if (!row.phone) {
      missingPhone += 1;
      continue;
    }

    const key = `${row.canonicalName}\u0000${row.phone}`;
    const list = byCredential.get(key) ?? [];
    list.push(row.sourceRow);
    byCredential.set(key, list);
  }

  for (const sourceRows of byCredential.values()) {
    if (sourceRows.length > 1) {
      errors.push({ code: "DUPLICATE_CREDENTIAL", sourceRows });
    }
  }

  return { missingPhone, errors };
}

function credentialKey(name: string, hash: string): string {
  return `${name}\u0000${hash}`;
}

export type ExistingImportIdentity = { id: string; canonicalName: string; phoneLookupHash: string | null; source: string };

/** A name alone must never inherit another person's ID or stored permissions. */
export function planRosterIdentityMatches(rows: PreparedRosterRow[], existing: ExistingImportIdentity[]) {
  const byCredential = new Map<string, ExistingImportIdentity>();
  for (const person of existing) {
    if (!person.phoneLookupHash) continue;
    const key = credentialKey(person.canonicalName, person.phoneLookupHash);
    if (byCredential.has(key)) throw new Error("ROSTER_IDENTITY_CONFLICT");
    byCredential.set(key, person);
  }
  return rows.map(row => ({ row, existing: row.phoneLookupHash ? byCredential.get(credentialKey(row.canonicalName, row.phoneLookupHash)) ?? null : null }));
}

/** Imports refresh profile data, while all authentication and assignment flags remain stored. */
export function rosterImportProfile(row: PreparedRosterRow) {
  return {
    sourceName: row.sourceName,
    canonicalName: row.canonicalName,
    position: row.position,
    phoneLookupHash: row.phoneLookupHash,
    phoneCiphertext: row.phoneCiphertext,
    village: row.village,
    sam: row.sam,
    samLabel: row.samLabel,
    sourceRow: row.sourceRow,
    ...("directoryAge" in row ? { directoryAge: row.directoryAge } : {}),
    ...("birthDate" in row ? { birthDate: row.birthDate } : {}),
    ...("directoryGender" in row ? { directoryGender: row.directoryGender } : {}),
    ...("directoryFamily" in row ? { directoryFamily: row.directoryFamily } : {}),
    ...("directoryGroupRole" in row ? { directoryGroupRole: row.directoryGroupRole } : {}),
    updatedAt: new Date(),
  };
}

export const dbRosterImportRepository: RosterImportRepository = {
  async replaceXlsRoster(rows) {
    const db = getDb();

    return db.transaction(async (tx) => {
      const existingRows = await tx
        .select({
          id: memberRoster.id,
          canonicalName: memberRoster.canonicalName,
          phoneLookupHash: memberRoster.phoneLookupHash,
          source: memberRoster.source,
        })
        .from(memberRoster);

      const existingXls = existingRows.filter((row) => row.source === "xls");
      const matches = planRosterIdentityMatches(rows, existingRows);
      let created = 0;
      let updated = 0;

      const linkedUsers = await tx
        .select({
          id: users.id,
          displayName: users.displayName,
          phoneLookupHash: users.phoneLookupHash,
          rosterId: users.rosterId,
          isActive: users.isActive,
        })
        .from(users);
      const linkedRosterIds = new Set(
        linkedUsers.flatMap((row) => (row.rosterId ? [row.rosterId] : [])),
      );

      const processedIds = new Set<string>();
      const importedByCredential = new Map<
        string,
        { id: string; row: PreparedRosterRow }
      >();

      for (const { row, existing } of matches) {
        const key = row.phoneLookupHash
          ? credentialKey(row.canonicalName, row.phoneLookupHash)
          : null;
        const existingId = existing?.id;

        if (existingId) {
          await tx
            .update(memberRoster)
            .set(rosterImportProfile(row))
            .where(eq(memberRoster.id, existingId));
          updated += 1;
          processedIds.add(existingId);
          if (key) importedByCredential.set(key, { id: existingId, row });
          continue;
        }

        const [inserted] = await tx
          .insert(memberRoster)
          .values(row)
          .returning({ id: memberRoster.id });
        created += 1;
        processedIds.add(inserted.id);
        if (key) importedByCredential.set(key, { id: inserted.id, row });
      }

      for (const oldRow of existingXls) {
        if (!processedIds.has(oldRow.id) && !linkedRosterIds.has(oldRow.id)) {
          await tx.delete(memberRoster).where(eq(memberRoster.id, oldRow.id));
        }
      }

      for (const user of linkedUsers) {
        if (user.rosterId) continue;
        const canonicalName = canonicalizeRosterName(user.displayName);
        const match = importedByCredential.get(
          credentialKey(canonicalName, user.phoneLookupHash),
        );
        if (!match) continue;

        await tx
          .update(users)
          .set({
            rosterId: match.id,
            displayName: match.row.canonicalName,
            normalizedName: match.row.canonicalName.toLocaleLowerCase("ko-KR"),
            phoneLookupHash: match.row.phoneLookupHash!,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
      }

      const activeUsers = await tx
        .select({ id: users.id, rosterId: users.rosterId })
        .from(users)
        .where(eq(users.isActive, true));

      await reconcileUnboundLeaders(tx);

      if (activeUsers.some((row) => !row.rosterId)) {
        throw new Error("UNMAPPED_ACTIVE_USER");
      }
      return { created, updated, preservedAuth: updated };
    });
  },
};

export async function importRosterCandidates(
  rows: ImportCandidate[],
  options:
    | {
        adminName: string;
        adminPhone: string;
        adminCredential?: never;
        preserveExistingAdmin?: boolean;
        repository?: RosterImportRepository;
      }
    | {
        adminName?: never;
        adminPhone?: never;
        adminCredential: {
          canonicalName: string;
          phoneLookupHash: string;
        };
        preserveExistingAdmin?: boolean;
        repository?: RosterImportRepository;
      },
): Promise<ImportSummary> {
  const validation = validateRosterCandidates(rows);
  if (validation.errors.length > 0) {
    throw new Error("ROSTER_VALIDATION_FAILED");
  }

  const rawAdmin =
    "adminCredential" in options && options.adminCredential
      ? {
          canonicalName: canonicalizeRosterName(options.adminCredential.canonicalName),
          phoneLookupHash: options.adminCredential.phoneLookupHash,
        }
      : {
          canonicalName: canonicalizeRosterName(options.adminName),
          phoneLookupHash: phoneLookupHash(normalizeRosterPhone(options.adminPhone)),
        };
  let adminMatches = 0;

  const prepared: PreparedRosterRow[] = rows.map((row) => {
    const lookupHash = row.phone ? phoneLookupHash(row.phone) : null;
    const isAdmin =
      row.canonicalName === rawAdmin.canonicalName &&
      lookupHash !== null &&
      lookupHash === rawAdmin.phoneLookupHash;
    if (isAdmin) adminMatches += 1;

    return {
      sourceRow: row.sourceRow,
      sourceName: row.sourceName,
      canonicalName: row.canonicalName,
      position: row.position,
      phoneLookupHash: lookupHash,
      phoneCiphertext: row.phone ? encryptRosterPhone(row.phone) : null,
      village: row.village,
      sam: row.sam,
      samLabel: row.samLabel,
      isActive: true,
      isAdmin,
      source: "xls" as const,
      ...("directoryAge" in row ? { directoryAge: row.directoryAge } : {}),
      ...("birthDate" in row ? { birthDate: row.birthDate } : {}),
      ...("directoryGender" in row ? { directoryGender: row.directoryGender } : {}),
      ...("directoryFamily" in row ? { directoryFamily: row.directoryFamily } : {}),
      ...("directoryGroupRole" in row ? { directoryGroupRole: row.directoryGroupRole } : {}),
    };
  });

  if (adminMatches > 1 || (adminMatches === 0 && !options.preserveExistingAdmin)) throw new Error("INITIAL_ADMIN_NOT_FOUND");

  const counts = await (options.repository ?? dbRosterImportRepository).replaceXlsRoster(prepared);

  return {
    total: rows.length,
    imported: prepared.length,
    missingPhone: validation.missingPhone,
    errors: 0,
    ...(counts ?? {}),
  };
}
