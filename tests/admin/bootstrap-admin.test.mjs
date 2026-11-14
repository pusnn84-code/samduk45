import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapErrorCode,
  createFirstAdministrator,
  readBootstrapInput,
} from "../../src/features/admin/bootstrap.ts";

const admin = {
  sourceName: "검증관리자",
  canonicalName: "검증관리자",
  normalizedName: "검증관리자",
  phoneLookupHash: "lookup-hash",
  phoneCiphertext: "encrypted-phone",
  phonePasswordHash: "argon-password-hash",
  sam: null,
};

function repository(options = {}) {
  const calls = [];
  const state = { roster: [], users: [], sams: [] };
  const repo = {
    async transaction(run) {
      const pending = structuredClone(state);
      calls.push("begin");
      try {
        const result = await run({
          async lockAccounts() { calls.push("lock"); },
          async hasUserAdministrator() {
            calls.push("user-admin");
            return options.userAdmin ?? false;
          },
          async hasRosterAdministrator() {
            calls.push("roster-admin");
            return options.rosterAdmin ?? false;
          },
          async hasUserIdentity(name, hash) {
            calls.push("user-identity");
            assert.equal(name, admin.normalizedName);
            assert.equal(hash, admin.phoneLookupHash);
            return options.userIdentity ?? false;
          },
          async hasRosterIdentity(name, hash) {
            calls.push("roster-identity");
            assert.equal(name, admin.canonicalName);
            assert.equal(hash, admin.phoneLookupHash);
            return options.rosterIdentity ?? false;
          },
          async ensureSam(sam) {
            calls.push("sam");
            pending.sams.push(sam);
            return "sam-id";
          },
          async insertRoster(value) {
            calls.push("insert-roster");
            pending.roster.push(value);
            return "roster-id";
          },
          async insertUser(value, rosterId, samId) {
            calls.push("insert-user");
            if (options.failUser) throw new Error("simulated insert failure");
            pending.users.push({ ...value, rosterId, samId });
          },
        });
        Object.assign(state, pending);
        calls.push("commit");
        return result;
      } catch (error) {
        calls.push("rollback");
        throw error;
      }
    },
  };
  return { repo, state, calls };
}

test("bootstrap accepts name and phone without a sam", () => {
  assert.deepEqual(readBootstrapInput({
    BOOTSTRAP_ADMIN_NAME: " 검증관리자 ",
    BOOTSTRAP_ADMIN_PHONE: " 01012345678 ",
  }), { name: "검증관리자", phone: "01012345678", sam: null });
});

test("bootstrap rejects missing identity and incomplete sam pairs", () => {
  assert.throws(() => readBootstrapInput({}), /BOOTSTRAP_ENV_REQUIRED/);
  const identity = { BOOTSTRAP_ADMIN_NAME: "검증관리자", BOOTSTRAP_ADMIN_PHONE: "01012345678" };
  for (const extra of [{ BOOTSTRAP_SAM_NAME: "검증샘" }, { BOOTSTRAP_SAM_LEADER: "리더" }]) {
    assert.throws(() => readBootstrapInput({ ...identity, ...extra }), /BOOTSTRAP_SAM_PAIR_REQUIRED/);
  }
  assert.deepEqual(readBootstrapInput({
    ...identity, BOOTSTRAP_SAM_NAME: " 검증샘 ", BOOTSTRAP_SAM_LEADER: " 리더 ",
  }).sam, { name: "검증샘", leaderName: "리더" });
});

test("bootstrap rejects names exceeding database field limits", () => {
  assert.throws(() => readBootstrapInput({
    BOOTSTRAP_ADMIN_NAME: "가".repeat(81), BOOTSTRAP_ADMIN_PHONE: "01012345678",
  }), /BOOTSTRAP_INPUT_TOO_LONG/);
});

test("first admin creates linked roster and user after locking and checking both tables", async () => {
  const fake = repository();
  await createFirstAdministrator(fake.repo, admin);
  assert.deepEqual(fake.calls, [
    "begin", "lock", "user-admin", "roster-admin", "user-identity", "roster-identity",
    "insert-roster", "insert-user", "commit",
  ]);
  assert.equal(fake.state.roster.length, 1);
  assert.equal(fake.state.users[0].rosterId, "roster-id");
  assert.equal(fake.state.users[0].samId, null);
  assert.deepEqual(fake.state.sams, []);
});

test("complete optional sam pair is passed to the transaction and linked to the user", async () => {
  const fake = repository();
  const sam = { name: "검증샘", leaderName: "리더" };
  await createFirstAdministrator(fake.repo, { ...admin, sam });
  assert.deepEqual(fake.state.sams, [sam]);
  assert.equal(fake.state.users[0].samId, "sam-id");
});

for (const source of ["userAdmin", "rosterAdmin"]) {
  test(`existing ${source} blocks bootstrap before any insert`, async () => {
    const fake = repository({ [source]: true });
    await assert.rejects(createFirstAdministrator(fake.repo, admin), /ADMIN_ALREADY_EXISTS/);
    assert.deepEqual(fake.state, { roster: [], users: [], sams: [] });
    assert.equal(fake.calls.includes("insert-roster"), false);
  });
}

for (const source of ["userIdentity", "rosterIdentity"]) {
  test(`existing ${source} is preserved without promotion or overwrite`, async () => {
    const fake = repository({ [source]: true });
    await assert.rejects(createFirstAdministrator(fake.repo, admin), /ACCOUNT_ALREADY_EXISTS/);
    assert.deepEqual(fake.state, { roster: [], users: [], sams: [] });
    assert.equal(fake.calls.includes("insert-roster"), false);
  });
}

test("failure inserting the linked user rolls back staged roster and sam writes", async () => {
  const fake = repository({ failUser: true });
  await assert.rejects(createFirstAdministrator(fake.repo, {
    ...admin, sam: { name: "검증샘", leaderName: "리더" },
  }), /simulated insert failure/);
  assert.equal(fake.calls.at(-1), "rollback");
  assert.deepEqual(fake.state, { roster: [], users: [], sams: [] });
});

test("CLI error output hides raw credentials and database errors", () => {
  assert.equal(bootstrapErrorCode(new Error("ADMIN_ALREADY_EXISTS")), "ADMIN_ALREADY_EXISTS");
  assert.equal(bootstrapErrorCode(new Error("postgres://user:secret@example.invalid/db")), "BOOTSTRAP_FAILED");
  assert.equal(bootstrapErrorCode({ message: "raw credential" }), "BOOTSTRAP_FAILED");
});
