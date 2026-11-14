import { describe, expect, it } from "vitest";
import { BIBLE_READING_END, BIBLE_READING_PLAN, BIBLE_READING_START, getBibleReadingDay } from "../../src/content/bible-reading-plan";

describe("2026 Bible reading schedule", () => {
  it("covers the 44-week plan with no duplicate or Sunday reading dates", () => {
    const dates = BIBLE_READING_PLAN.map(day => day.date);
    expect(dates).toHaveLength(264);
    expect(new Set(dates).size).toBe(264);
    expect(dates[0]).toBe(BIBLE_READING_START);
    expect(dates.at(-1)).toBe(BIBLE_READING_END);
    expect(dates.every(date => new Date(date).getUTCDay() !== 0)).toBe(true);
    expect(getBibleReadingDay("2027-01-17")).toBeUndefined();
    expect(getBibleReadingDay("2027-02-30")).toBeUndefined();
  });

  it("preserves source passages that span book boundaries", () => {
    expect(BIBLE_READING_PLAN.find(day => day.passage === "요엘 1–3장 · 아모스 1–3장")).toBeDefined();
    expect(getBibleReadingDay("2026-11-07")?.passage).toBe("디도서 1–3장 · 빌레몬서");
    expect(getBibleReadingDay("2026-11-20")?.passage).toBe("요한이서 · 요한삼서");
  });
  it("matches the supplied November timetable", () => {
    expect(getBibleReadingDay("2026-11-02")?.passage).toBe("골로새서 1–4장");
    expect(getBibleReadingDay("2026-11-05")?.passage).toBe("디모데전서 1–6장");
    expect(getBibleReadingDay("2026-11-16")?.passage).toBe("베드로전서 1–5장");
    expect(getBibleReadingDay("2026-11-21")?.passage).toBe("유다서");
    expect(getBibleReadingDay("2026-11-28")?.passage).toBe("요한계시록 19–22장");
    expect(getBibleReadingDay("2026-11-15")).toBeUndefined();
  });
});
