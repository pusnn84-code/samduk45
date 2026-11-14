export type BootstrapInput = {
  name: string;
  phone: string;
  sam: { name: string; leaderName: string } | null;
};

export type PreparedBootstrapAdmin = {
  sourceName: string;
  canonicalName: string;
  normalizedName: string;
  phoneLookupHash: string;
  phoneCiphertext: string;
  phonePasswordHash: string;
  sam: BootstrapInput["sam"];
};

export type BootstrapTransaction = {
  lockAccounts(): Promise<void>;
  hasUserAdministrator(): Promise<boolean>;
  hasRosterAdministrator(): Promise<boolean>;
  hasUserIdentity(normalizedName: string, phoneLookupHash: string): Promise<boolean>;
  hasRosterIdentity(canonicalName: string, phoneLookupHash: string): Promise<boolean>;
  ensureSam(sam: NonNullable<BootstrapInput["sam"]>): Promise<string>;
  insertRoster(admin: PreparedBootstrapAdmin): Promise<string>;
  insertUser(admin: PreparedBootstrapAdmin, rosterId: string, samId: string | null): Promise<void>;
};

export type BootstrapRepository = {
  transaction<T>(run: (tx: BootstrapTransaction) => Promise<T>): Promise<T>;
};

export function readBootstrapInput(env: Record<string, string | undefined>): BootstrapInput {
  const name = env.BOOTSTRAP_ADMIN_NAME?.trim();
  const phone = env.BOOTSTRAP_ADMIN_PHONE?.trim();
  const samName = env.BOOTSTRAP_SAM_NAME?.trim();
  const samLeader = env.BOOTSTRAP_SAM_LEADER?.trim();

  if (!name || !phone) throw new Error("BOOTSTRAP_ENV_REQUIRED");
  if (Boolean(samName) !== Boolean(samLeader)) {
    throw new Error("BOOTSTRAP_SAM_PAIR_REQUIRED");
  }
  if (name.length > 80 || (samName?.length ?? 0) > 100 || (samLeader?.length ?? 0) > 100) {
    throw new Error("BOOTSTRAP_INPUT_TOO_LONG");
  }

  return {
    name,
    phone,
    sam: samName && samLeader ? { name: samName, leaderName: samLeader } : null,
  };
}

export async function createFirstAdministrator(
  repository: BootstrapRepository,
  admin: PreparedBootstrapAdmin,
): Promise<void> {
  await repository.transaction(async (tx) => {
    // Hold the guard and both inserts in one transaction, including concurrent bootstraps.
    await tx.lockAccounts();
    if (await tx.hasUserAdministrator() || await tx.hasRosterAdministrator()) {
      throw new Error("ADMIN_ALREADY_EXISTS");
    }
    if (
      await tx.hasUserIdentity(admin.normalizedName, admin.phoneLookupHash) ||
      await tx.hasRosterIdentity(admin.canonicalName, admin.phoneLookupHash)
    ) {
      throw new Error("ACCOUNT_ALREADY_EXISTS");
    }

    const samId = admin.sam ? await tx.ensureSam(admin.sam) : null;
    const rosterId = await tx.insertRoster(admin);
    await tx.insertUser(admin, rosterId, samId);
  });
}

export function bootstrapErrorCode(error: unknown): string {
  const safeCodes = new Set([
    "BOOTSTRAP_ENV_REQUIRED",
    "BOOTSTRAP_SAM_PAIR_REQUIRED",
    "BOOTSTRAP_INPUT_TOO_LONG",
    "ADMIN_ALREADY_EXISTS",
    "ACCOUNT_ALREADY_EXISTS",
    "INVALID_NAME",
    "INVALID_PHONE",
    "MISSING_ROSTER_ENCRYPTION_KEY",
  ]);
  return error instanceof Error && safeCodes.has(error.message)
    ? error.message
    : "BOOTSTRAP_FAILED";
}
