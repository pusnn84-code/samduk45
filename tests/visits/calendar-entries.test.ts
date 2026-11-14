import { describe, expect, it } from "vitest";
import { calendarEntriesForDate } from "../../components/admin/visits/calendar-entries";

describe("multiple calendar appointments", () => {
  it("retains every same-day appointment while keeping pending/cancelled requests out of the confirmed calendar", () => {
    const date = "2099-10-08";
    const visits = [
      { id: "morning", visitDate: date, status: "confirmed" },
      { id: "afternoon", visitDate: date, status: "confirmed" },
      { id: "done", visitDate: date, status: "completed" },
      { id: "pending", visitDate: date, status: "requested" },
      { id: "cancelled", visitDate: date, status: "cancelled" },
      { id: "tomorrow", visitDate: "2099-10-09", status: "confirmed" },
    ];
    expect(calendarEntriesForDate(visits, date).map(visit => visit.id)).toEqual(["morning", "afternoon", "done"]);
    expect(calendarEntriesForDate(visits, "2099-10-10")).toEqual([]);
  });
});
