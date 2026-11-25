import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PREVIOUS_READING_PLAN as BIBLE_READING_PLAN } from "../../src/content/bible-reading-plan";
import { getBibleReadingChapters, getBibleReadingLinks } from "../../src/content/bible-reading-links";

describe("Bible reading chapter links", () => {
  it("links every chapter of the complete plan once, including single-chapter books", () => {
    const chapters = BIBLE_READING_PLAN.flatMap(day => getBibleReadingLinks(day.passage));
    expect(chapters).toHaveLength(1189);
    expect(new Set(chapters.map(chapter => chapter.href)).size).toBe(1189);
    expect(new Set(chapters.map(chapter => chapter.href.split("/")[3])).size).toBe(66);
    expect(chapters.every(chapter => /^\/scripture\/bible\/\d+\/\d+$/.test(chapter.href))).toBe(true);
    const content = new Map<number, unknown[][]>();
    for (const part of BIBLE_READING_PLAN.flatMap(day => getBibleReadingChapters(day.passage))) {
      if (!content.has(part.book)) content.set(part.book, JSON.parse(readFileSync(path.join(process.cwd(), "data/scripture-library/bible", `${part.book}.json`), "utf8")));
      expect(content.get(part.book)?.[part.chapter - 1]?.length).toBeGreaterThan(0);
    }
  });

  it("keeps mixed-book days and single-chapter books in their reading order", () => {
    expect(getBibleReadingLinks("디도서 1–3장 · 빌레몬서").map(chapter => chapter.label)).toEqual(["디도서 1장", "디도서 2장", "디도서 3장", "빌레몬서 1장"]);
    expect(getBibleReadingLinks("요한이서 · 요한삼서").map(chapter => chapter.href)).toEqual(["/scripture/bible/63/1", "/scripture/bible/64/1"]);
    expect(getBibleReadingLinks("디모데전서 1–6장")[0].href).toBe("/scripture/bible/54/1");
    expect(getBibleReadingLinks("시편 54편")[0].href).toBe("/scripture/bible/19/54");
    expect(getBibleReadingLinks("임의의 내용")).toEqual([]);
    expect(getBibleReadingLinks("창세기 51–52장")).toEqual([]);
    expect(getBibleReadingLinks("창세기 4–1장")).toEqual([]);
  });
});
