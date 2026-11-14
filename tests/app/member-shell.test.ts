import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMMUNITY_2027 } from "../../src/content/community-2027";

describe("삼덕사오 member shell", () => {
  it("pins the required menu order", () => {
    const source = readFileSync("src/content/member-navigation.ts", "utf8");
    const labels = ["공지", "오늘의 생일", "성경통독", "기도요청", "심방요청", "도란도란", "마을과 샘", "샘목양지", "2027 사역안내"];
    let cursor = -1;
    for (const label of labels) {
      const next = source.indexOf(label);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }
  });

  it("provides a page for every member tab", () => {
    const pages = [
      ["app/(member)/page.tsx", "MenuHome"],
      ["app/(member)/visits/page.tsx", "심방·목회일정"],
      ["app/(member)/prayer-requests/page.tsx", "기도요청"],
      ["app/(member)/notices/page.tsx", "공지"],
    ] as const;

    for (const [path, marker] of pages) {
      expect(readFileSync(path, "utf8")).toContain(marker);
    }
  });

  it("uses the documented 2027 community theme in the member header and login", () => {
    const source = readFileSync("components/app/MemberShell.tsx", "utf8");
    expect(source).toContain("45공동체");
    const login = readFileSync("app/login/page.tsx", "utf8");
    expect(COMMUNITY_2027).toMatchObject({
      year: 2027,
      motto: "너른 사랑의 해",
      verseRef: "에스겔 47:9",
      verseExcerpt: "이 강이 이르는 각처에 모든 것이 살 것이며",
    });
    for (const page of [source, login]) {
      expect(page).toContain("COMMUNITY_2027.motto");
      expect(page).toContain("COMMUNITY_2027.verseExcerpt");
      expect(page).toContain("COMMUNITY_2027.verseRef");
    }
    expect(login).toContain('<Link href="/2027">2027 사역 안내</Link>');
  });

  it("keeps each feature on its own route instead of one combined screen", () => {
    for (const path of [
      "app/(member)/page.tsx",
      "app/(member)/visits/page.tsx",
      "app/(member)/prayer-requests/page.tsx",
      "app/(member)/notices/page.tsx",
    ]) {
      expect(readFileSync(path, "utf8").length).toBeGreaterThan(0);
    }
  });
});
