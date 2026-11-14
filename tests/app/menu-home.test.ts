import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MenuHome } from "../../components/app/MenuHome";

const memberLinks = ["/notices", "/birthdays", "/bible-reading", "/scripture", "/prayer-requests", "/visits", "/community", "/our-community", "/pastoral-reports", "/autumn-light", "/ministry-plan"];

function renderMenu() {
  const html = renderToStaticMarkup(createElement(MenuHome));
  return { html, links: [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => match[1]) };
}

describe("compact login landing menu", () => {
  it("renders each ordinary member destination as one labeled, full-card link", () => {
    const { html, links } = renderMenu();
    expect(links).toEqual(memberLinks);
    expect(html.match(/class="menu-home-card"/g)).toHaveLength(11);
    expect(html).toContain('aria-label="메뉴 선택"');
    expect(html).toContain("홈 화면에 추가</button>");
    for (const label of ["공지", "성경통독", "기도요청", "심방요청", "도란도란", "마을과 샘", "샘목양지", "2027 사역안내"]) expect(html).toContain(`<strong>${label}</strong>`);
    expect(html).not.toContain("menu-home-description");
  });

  it("budgets the phone grid against the compact shell and retains usable touch targets", () => {
    const css = readFileSync("components/app/menu-home.css", "utf8");
    expect(css).toContain("100svh - var(--menu-home-shell-height, 88px)");
    expect(css).toContain("repeat(4, minmax(72px, 1fr))");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(css).not.toContain("min-height: 190px");
    expect(css).not.toContain("overflow: hidden");
  });
});
