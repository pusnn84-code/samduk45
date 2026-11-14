import { beforeAll, describe, expect, it, vi } from "vitest";
import { phoneLookupHash } from "../../src/features/auth/crypto";
import { importRosterCandidates, type ImportCandidate, type PreparedRosterRow } from "../../src/features/roster/import";

const candidate = (overrides: Partial<ImportCandidate> = {}): ImportCandidate => ({
  sourceRow: 2, sourceName: "가상회원", canonicalName: "가상회원", position: "성도", phone: "01000000002", village: "3", sam: "1", samLabel: "3-1", ...overrides,
});

describe("existing administrator preservation during roster import", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "postgres://example";
    process.env.SESSION_SECRET = "s".repeat(32);
    process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
    process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString("base64");
  });

  const adminCredential = () => ({ canonicalName: "가상관리자", phoneLookupHash: phoneLookupHash("01000000001") });

  it("requires the administrator in an initial import unless preservation is explicitly enabled", async () => {
    const replaceXlsRoster = vi.fn();
    await expect(importRosterCandidates([candidate()], {
      adminCredential: adminCredential(), repository: { replaceXlsRoster },
    })).rejects.toThrow("INITIAL_ADMIN_NOT_FOUND");
    expect(replaceXlsRoster).not.toHaveBeenCalled();
  });

  it("allows an established administrator to remain outside the roster without promoting a partial credential match", async () => {
    const prepared: PreparedRosterRow[] = [];
    const replaceXlsRoster = vi.fn(async (rows: PreparedRosterRow[]) => { prepared.push(...rows); });
    const summary = await importRosterCandidates([
      candidate({ sourceName: "가상관리자A", canonicalName: "가상관리자" }),
      candidate({ sourceRow: 3, phone: "01000000001" }),
    ], {
      adminCredential: adminCredential(), preserveExistingAdmin: true, repository: { replaceXlsRoster },
    });
    expect(replaceXlsRoster).toHaveBeenCalledOnce();
    expect(prepared.map(row => row.isAdmin)).toEqual([false, false]);
    expect(summary).toEqual({ total: 2, imported: 2, missingPhone: 0, errors: 0 });
  });

  it("still validates duplicate identities before persistence when existing administrators are preserved", async () => {
    const replaceXlsRoster = vi.fn();
    await expect(importRosterCandidates([candidate(), candidate({ sourceRow: 3 })], {
      adminCredential: adminCredential(), preserveExistingAdmin: true, repository: { replaceXlsRoster },
    })).rejects.toThrow("ROSTER_VALIDATION_FAILED");
    expect(replaceXlsRoster).not.toHaveBeenCalled();
  });
});
