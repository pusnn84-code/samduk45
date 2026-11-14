import { describe, expect, it } from "vitest";
import { ageOnDate, birthdayDays, groupBirthdays, seoulDate, validBirthDate } from "../../src/features/birthdays/dates";
const person = (id: string, birthDate: string) => ({ id, name: "가상성도" + id, village: "1마을", sam: "1-1샘", churchOffice: "집사", birthDate });
describe("Korean birthday calendar", () => {
  it("uses the Korean date across UTC midnight", () => {
    expect(seoulDate(new Date("2026-11-05T14:59:59Z"))).toBe("2026-11-05");
    expect(seoulDate(new Date("2026-11-05T15:00:00Z"))).toBe("2026-11-06");
  });
  it("lists today and exactly three previous days in descending order across year boundaries", () => {
    expect(birthdayDays("2027-01-02")).toEqual(["2027-01-02", "2027-01-01", "2026-12-31", "2026-12-30"]);
  });
  it("includes all names sharing a birthday and strips birth years from the display DTO", () => {
    const groups = groupBirthdays([person("2", "1970-11-05"), person("1", "1980-11-05"), person("3", "1985-11-04"), person("4", "1990-10-30")], "2026-11-05");
    expect(groups[0].people.map(p => p.id)).toEqual(["1", "2"]); expect(groups[1].people.map(p => p.id)).toEqual(["3"]);
    expect(groups.flatMap(g => g.people).map(p => p.id)).not.toContain("4");
    expect(groups[0].people[0]).not.toHaveProperty("birthDate"); expect(JSON.stringify(groups)).not.toContain("1980");
  });
  it("observes leap-day birthdays on February 28 in ordinary years and February 29 in leap years", () => {
    expect(groupBirthdays([person("1", "2000-02-29")], "2027-02-28")[0].people).toHaveLength(1);
    expect(groupBirthdays([person("1", "2000-02-29")], "2028-02-28")[0].people).toHaveLength(0);
    expect(groupBirthdays([person("1", "2000-02-29")], "2028-02-29")[0].people).toHaveLength(1);
  });
  it("calculates age on each birthday and across a new year, preserving missing data", () => {
    expect(ageOnDate("1980-11-06", "2026-11-05")).toBe(45); expect(ageOnDate("1980-11-06", "2026-11-06")).toBe(46);
    expect(ageOnDate("1980-11-06", "2027-01-01")).toBe(46); expect(ageOnDate(null, "2026-11-05")).toBeNull();
    expect(ageOnDate("2027-11-06", "2026-11-05")).toBeNull();
  });
  it.each(["2026-02-29", "2001-13-01", "1980-11-31", "not-a-date"])("rejects invalid source date %s", date => expect(validBirthDate(date)).toBe(false));
});
