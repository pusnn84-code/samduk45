import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ db: vi.fn(), state: vi.fn() }));
vi.mock("../../src/db/client", () => ({ getDb: mock.db }));
vi.mock("../../src/features/auth/password-state", () => ({ rosterPasswordState: mock.state }));
vi.mock("../../src/features/auth/crypto", () => ({ hashPassword: async () => "new-password-hash", isPhonePassword: () => false, sessionTokenHash: () => "proof-hash", verifyPassword: async () => false }));
import { changeProfilePassword } from "../../src/features/profile/service";

function fake(proof: boolean, active = true) {
  const update = vi.fn(() => ({ set: () => ({ where: async () => [] }) }));
  const forUpdate = vi.fn(async () => [{ passwordHash: null, phoneCiphertext: "cipher", isActive: active }]);
  const tx = { update, select: vi.fn()
    .mockReturnValueOnce({ from: () => ({ where: () => ({ for: forUpdate }) }) })
    .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => proof ? [{ id: "proof" }] : [] }) }) }) };
  mock.db.mockReturnValue({
    select: vi.fn()
      .mockReturnValueOnce({ from: () => ({ leftJoin: () => ({ where: () => ({ limit: async () => [{ rosterId: "roster", canonicalName: "가상성도", phoneLookupHash: "lookup" }] }) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: async () => [] }) }),
    transaction: async (work: (transaction: typeof tx) => Promise<void>) => work(tx),
  });
  return { update, forUpdate };
}
beforeEach(() => { vi.resetAllMocks(); mock.state.mockResolvedValue("initial"); });
describe("single-use initial password proof", () => {
  it("locks the roster row and revokes every old proof when saving the new password", async () => {
    const db = fake(true);
    await changeProfilePassword("viewer", "new-password", "pending-token");
    expect(db.forUpdate).toHaveBeenCalledWith("update");
    expect(db.update).toHaveBeenCalledTimes(3); // roster, participant, then all old sessions
  });
  it("rejects an expired or consumed proof without changing credentials", async () => {
    const db = fake(false);
    await expect(changeProfilePassword("viewer", "new-password", "old-proof")).rejects.toMatchObject({ code: "PASSWORD_SETUP_EXPIRED" });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("rejects a second setup after a parallel request already changed the password", async () => {
    const db = fake(true); mock.state.mockResolvedValue("custom");
    await expect(changeProfilePassword("viewer", "new-password", "pending-token")).rejects.toMatchObject({ code: "PASSWORD_SETUP_EXPIRED" });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("does not reactivate an inactive member during setup", async () => {
    const db = fake(true, false);
    await expect(changeProfilePassword("viewer", "new-password", "pending-token")).rejects.toMatchObject({ code: "PASSWORD_SETUP_EXPIRED" });
    expect(db.update).not.toHaveBeenCalled();
  });
});
