import { describe, expect, it } from "vitest";
import { scriptureSegments, scriptureVerseText } from "../src/content/scripture-segments";
import { copyPassage } from "../src/content/scripture-library";

describe("editorial headings and selectable Bible text", () => {
  it("keeps titles separate from the verse body, including headings inside a row", () => {
    expect(scriptureSegments("<첫 소제목> 첫 본문 <두 번째 소제목> 다음 본문")).toEqual([
      { kind: "heading", text: "첫 소제목" }, { kind: "text", text: "첫 본문" },
      { kind: "heading", text: "두 번째 소제목" }, { kind: "text", text: "다음 본문" },
    ]);
    expect(scriptureVerseText("<첫 소제목> 첫 본문 <두 번째 소제목> 다음 본문")).toBe("첫 본문 다음 본문");
  });
  it("has no selectable content for heading-only or whitespace-only rows", () => {
    expect(scriptureVerseText(" <소제목만 있습니다> ")).toBe("");
    expect(scriptureSegments("   ")).toEqual([]);
    expect(copyPassage([{ abbreviation: "계", chapter: 7, verses: [[1, 1, "<소제목>"], [2, 2, "실제 본문"]] }])).toBe("실제 본문 (계 7:2)");
  });
  it("copies only scripture while preserving the existing accurate final reference", () => {
    expect(copyPassage([{ abbreviation: "계", chapter: 7, verses: [[1, 1, "<소제목> 첫 본문"], [2, 2, "다음 본문"]] }])).toBe("첫 본문\n다음 본문 (계 7:1-2)");
  });
});
