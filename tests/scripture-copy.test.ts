import { describe, expect, it } from "vitest";
import { copyPassage, copyVerse, type VerseRow } from "../src/content/scripture-library";

describe("scripture selection copy", () => {
  it("appends one range after several consecutive verses in reading order", () => {
    const verses: VerseRow[] = [[7, 7, "일곱"], [3, 3, "셋"], [4, 4, "넷"], [5, 6, "다섯과 여섯"]];
    expect(copyPassage([{ abbreviation: "창", chapter: 1, verses }])).toBe("셋\n넷\n다섯과 여섯\n일곱 (창 1:3-7)");
  });
  it("does not falsely include unselected verses in a range", () => {
    expect(copyPassage([{ abbreviation: "창", chapter: 1, verses: [[3, 3, "셋"], [7, 7, "일곱"]] }])).toBe("셋\n일곱 (창 1:3,7)");
  });
  it("keeps chapter and book references accurate within one final citation", () => {
    expect(copyPassage([
      { abbreviation: "창", chapter: 1, verses: [[31, 31, "마지막"]] },
      { abbreviation: "창", chapter: 2, verses: [[1, 2, "다음 장"]] },
      { abbreviation: "출", chapter: 1, verses: [[1, 1, "다음 책"]] },
    ])).toBe("마지막\n다음 장\n다음 책 (창 1:31; 2:1-2; 출 1:1)");
  });
  it("retains single verse format and strips section headings", () => {
    expect(copyVerse([1, 1, "<제목> 본문"], "마", 1)).toBe("본문 (마 1:1)");
    expect(copyPassage([{ abbreviation: "창", chapter: 1, verses: [] }])).toBe("");
  });
});
