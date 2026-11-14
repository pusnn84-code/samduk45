import { and, eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";
import { memberRoster, sams, users } from "../src/db/schema";
import {
  bootstrapErrorCode,
  createFirstAdministrator,
  readBootstrapInput,
  type BootstrapRepository,
} from "../src/features/admin/bootstrap";
import { prepareAdminRosterValues } from "../src/features/admin/roster-service";
import { hashPhonePassword, normalizeName } from "../src/features/auth/crypto";

const repository: BootstrapRepository = {
  async transaction(run) {
    return getDb().transaction(async (tx) => run({
      async lockAccounts() {
        // Also serialize roster imports and other account writes with the guard.
        await tx.execute(sql`lock table prayer_app.member_roster, prayer_app.users in share row exclusive mode`);
      },
      async hasUserAdministrator() {
        const [admin] = await tx.select({ id: users.id }).from(users)
          .where(eq(users.role, "admin")).limit(1);
        return Boolean(admin);
      },
      async hasRosterAdministrator() {
        const [admin] = await tx.select({ id: memberRoster.id }).from(memberRoster)
          .where(eq(memberRoster.isAdmin, true)).limit(1);
        return Boolean(admin);
      },
      async hasUserIdentity(normalizedName, lookupHash) {
        const [existing] = await tx.select({ id: users.id }).from(users)
          .where(and(eq(users.normalizedName, normalizedName), eq(users.phoneLookupHash, lookupHash)))
          .limit(1);
        return Boolean(existing);
      },
      async hasRosterIdentity(canonicalName, lookupHash) {
        const [existing] = await tx.select({ id: memberRoster.id }).from(memberRoster)
          .where(and(eq(memberRoster.canonicalName, canonicalName), eq(memberRoster.phoneLookupHash, lookupHash)))
          .limit(1);
        return Boolean(existing);
      },
      async ensureSam(sam) {
        const [existing] = await tx.select({ id: sams.id }).from(sams)
          .where(eq(sams.name, sam.name)).limit(1);
        if (existing) return existing.id;
        const [created] = await tx.insert(sams)
          .values({ ...sam, isActive: true }).returning({ id: sams.id });
        return created.id;
      },
      async insertRoster(admin) {
        const [created] = await tx.insert(memberRoster).values({
          sourceName: admin.sourceName,
          canonicalName: admin.canonicalName,
          phoneLookupHash: admin.phoneLookupHash,
          phoneCiphertext: admin.phoneCiphertext,
          // A null custom hash keeps the documented initial phone password.
          passwordHash: null,
          isActive: true,
          isAdmin: true,
          source: "admin",
          sourceRow: null,
        }).returning({ id: memberRoster.id });
        return created.id;
      },
      async insertUser(admin, rosterId, samId) {
        await tx.insert(users).values({
          displayName: admin.canonicalName,
          normalizedName: admin.normalizedName,
          phoneLookupHash: admin.phoneLookupHash,
          phonePasswordHash: admin.phonePasswordHash,
          rosterId,
          samId,
          role: "admin",
          isActive: true,
        });
      },
    }));
  },
};

async function main() {
  try {
    const input = readBootstrapInput(process.env);
    const roster = prepareAdminRosterValues({
      name: input.name,
      phone: input.phone,
      position: null,
      village: null,
      sam: null,
      isActive: true,
      isAdmin: true,
    });
    if (!roster.phoneLookupHash || !roster.phoneCiphertext) throw new Error("INVALID_PHONE");

    await createFirstAdministrator(repository, {
      sourceName: roster.sourceName,
      canonicalName: roster.canonicalName,
      normalizedName: normalizeName(roster.canonicalName),
      phoneLookupHash: roster.phoneLookupHash,
      phoneCiphertext: roster.phoneCiphertext,
      phonePasswordHash: await hashPhonePassword(input.phone),
      sam: input.sam,
    });
    console.log("Bootstrap administrator created.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  // Database/validation errors can contain connection details or input values.
  console.error(bootstrapErrorCode(error));
  process.exitCode = 1;
});
