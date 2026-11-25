import { describe, expect, it } from "vitest";
import { BIBLE_READING_END, BIBLE_READING_PLAN, BIBLE_READING_START, getBibleReadingDay, PSALM_READING_PLAN, readingCycle } from "../../src/content/bible-reading-plan";

describe("2026 Bible reading schedule", () => {
  it("preserves the 44-week plan and appends Psalms with no duplicate or Sunday reading dates", () => {
    const dates = BIBLE_READING_PLAN.map(day => day.date);
    expect(dates).toHaveLength(361);
    expect(new Set(dates).size).toBe(361);
    expect(dates[0]).toBe(BIBLE_READING_START);
    expect(dates.at(-1)).toBe(BIBLE_READING_END);
    expect(dates.every(date => new Date(date).getUTCDay() !== 0)).toBe(true);
    expect(getBibleReadingDay("2027-01-17")).toBeUndefined();
    expect(getBibleReadingDay("2027-02-30")).toBeUndefined();
  });

  it("reads Psalm 54 through 150 Monday to Saturday across the new year",()=>{
    expect(PSALM_READING_PLAN).toHaveLength(97);
    expect(getBibleReadingDay("2026-11-30")?.passage).toBe("시편 54편");
    expect(getBibleReadingDay("2026-12-05")?.passage).toBe("시편 59편");
    expect(getBibleReadingDay("2026-12-06")).toBeUndefined();
    expect(getBibleReadingDay("2026-12-07")?.passage).toBe("시편 60편");
    expect(getBibleReadingDay("2027-03-22")?.passage).toBe("시편 150편");
    expect(readingCycle("2026-11-28")).toHaveLength(264);
    expect(readingCycle("2026-11-30")).toHaveLength(97);
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
