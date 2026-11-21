import { describe, expect, it, vi } from "vitest";
import { createInternalAppointment, getInternalMonthAvailability, submitInternalVisit, transitionInternalVisit, updateInternalVisit,
  type InternalVisitRepository } from "../../src/features/visits/internal-calendar";
import type { VisitRepository } from "../../src/features/visits/service";

const input = { requesterUserId: "member", visitDate: "2099-10-08", visitType: "personal" as const, attendees: "", location: "", preferredTime: "", reason: "" };
function writer(): InternalVisitRepository {
  return { insert: vi.fn(async () => ({ id: "saved" })), update: vi.fn(async () => true), transition: vi.fn(async () => true), delete: vi.fn() };
}
function repository(patch: Partial<VisitRepository> = {}): VisitRepository {
  return { getBookingPeriod: async () => ({ startDate: null, endDate: null }), listBlockedDates: async () => [],
    listEnabledDates: async () => [], listBlockedWeekdays: async () => [], listActiveVisitDates: async () => [],
    isDateBlocked: async () => false, isDateEnabled: async () => false, isWeekdayBlocked: async () => false,
    hasActiveVisit: async () => false, getRequester: async () => null, createPending: vi.fn(), markSynced: vi.fn(),
    cancelAfterSyncFailure: vi.fn(), ...patch };
}
describe("app-only visit calendar", () => {
  it("stores a pastor's tentative appointment as requested when explicitly selected", async () => {
    const db = writer();
    await createInternalAppointment(input, db, "requested");
    expect(db.insert).toHaveBeenCalledWith(input, "requested");
  });
  it("saves member requests as waiting for approval without creating an external event", async () => {
    const db = writer();
    await expect(submitInternalVisit(input, repository(), db)).resolves.toEqual({ id: "saved" });
    expect(db.insert).toHaveBeenCalledWith(input, "requested");
  });
  it("creates pastor-entered appointments already confirmed", async () => {
    const db = writer();
    await createInternalAppointment({ ...input, requesterUserId: "pastor", attendees: "가상대상" }, db);
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ requesterUserId: "pastor" }), "confirmed");
  });
  it.each([
    [{ isDateBlocked: async () => true }, "VISIT_DATE_UNAVAILABLE"],
    [{ isWeekdayBlocked: async () => true }, "VISIT_DATE_UNAVAILABLE"],
    [{ getBookingPeriod: async () => ({ startDate: "2099-11-01", endDate: "2099-11-30" }) }, "VISIT_OUTSIDE_BOOKING_PERIOD"],
  ] as const)("retains booking restrictions and never inserts an invalid request", async (patch, code) => {
    const db = writer();
    await expect(submitInternalVisit(input, repository(patch), db)).rejects.toMatchObject({ code });
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("allows repeated requests on an occupied date and leaves each waiting for approval", async () => {
    const db = writer(); const occupied = vi.fn(async () => true);
    await submitInternalVisit(input, repository({ hasActiveVisit: occupied }), db);
    await submitInternalVisit({ ...input, requesterUserId: "another-member" }, repository({ hasActiveVisit: occupied }), db);
    expect(occupied).not.toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(vi.mocked(db.insert).mock.calls.every(([, status]) => status === "requested")).toBe(true);
  });
  it("allows multiple pastor appointments on the same date and moving one to an occupied date", async () => {
    const db = writer();
    await createInternalAppointment(input, db);
    await createInternalAppointment({ ...input, attendees: "다른 대상", preferredTime: "오후 4시" }, db);
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(vi.mocked(db.insert).mock.calls.every(([, status]) => status === "confirmed")).toBe(true);
    await updateInternalVisit("another-appointment", { visitDate: input.visitDate }, db);
    expect(db.update).toHaveBeenCalledWith("another-appointment", { visitDate: input.visitDate });
  });
  it("does not disguise an unrelated storage failure as a date collision", async () => {
    const db = writer();
    vi.mocked(db.insert).mockRejectedValue(new Error("STORAGE_FAILURE"));
    await expect(submitInternalVisit(input, repository(), db)).rejects.toThrow("STORAGE_FAILURE");
  });
  it("uses atomic expected-status transitions and records the accepting pastor", async () => {
    const db = writer();
    await transitionInternalVisit("saved", "confirmed", "pastor", db);
    expect(db.transition).toHaveBeenLastCalledWith("saved", ["requested"], "confirmed", "pastor");
    vi.mocked(db.transition).mockResolvedValue(false);
    await expect(transitionInternalVisit("saved", "confirmed", "pastor", db)).rejects.toMatchObject({ code: "INVALID_VISIT_STATUS_TRANSITION" });
  });
  it("does not silently edit a cancelled or completed appointment", async () => {
    const db = writer(); vi.mocked(db.update).mockResolvedValue(false);
    await expect(updateInternalVisit("saved", { location: "교회" }, db)).rejects.toMatchObject({ code: "VISIT_NOT_EDITABLE" });
  });
  it("lists availability from app reservations without exposing requester details", async () => {
    const dates = await getInternalMonthAvailability("2099-10", repository({ listActiveVisitDates: async () => [input.visitDate] }));
    expect(dates).toHaveLength(31);
    expect(dates.find(day => day.date === input.visitDate)).toEqual({ date: input.visitDate, available: true });
    expect(dates.find(day => day.date === "2099-10-09")).toEqual({ date: "2099-10-09", available: true });
    expect(JSON.stringify(dates)).not.toContain("requester");
  });
});
