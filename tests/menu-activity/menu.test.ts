import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { MenuHome } from "../../components/app/MenuHome";
import { MemberSidebar } from "../../components/app/MemberSidebar";
import { MenuActivityContext } from "../../components/app/MenuActivityProvider";
import { MenuUpdateBadge } from "../../components/app/MenuUpdateBadge";
describe("menu update indicators", () => {
  it("shows independent counts beside the three corresponding home menus", () => {
    const html = renderToStaticMarkup(createElement(MenuActivityContext.Provider, { value: { counts: { notices: 3, community: 2, members: 0, reading: 1 }, markViewed: async () => {} } }, createElement(MenuHome)));
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(match => ({ href: match[1], html: match[2] }));
    expect(links.find(link => link.href === "/notices")?.html).toContain(">3</span>");
    expect(links.find(link => link.href === "/community")?.html).toContain(">2</span>");
    expect(links.find(link => link.href === "/bible-reading")?.html).toContain(">1</span>");
    expect(links.find(link => link.href === "/visits")?.html).not.toContain("menu-update-badge");
  });
  it("also shows numeric updates in the sidebar", () => {
    const html = renderToStaticMarkup(createElement(MemberSidebar, { unreadCount: 3, communityCount: 2, readingCount: 1 }));
    expect(html).toContain("안 읽은 공지 3개"); expect(html).toContain("새 이야기 2개"); expect(html).toContain("새 한 줄 나눔 1개");
  });
  it("hides zero counts and caps large badges while announcing the full count", () => {
    expect(renderToStaticMarkup(createElement(MenuUpdateBadge, { count: 0, label: "새 이야기" }))).toBe("");
    const html = renderToStaticMarkup(createElement(MenuUpdateBadge, { count: 120, label: "새 이야기" }));
    expect(html).toContain(">99+</span>"); expect(html).toContain("새 이야기 120개");
  });
});
