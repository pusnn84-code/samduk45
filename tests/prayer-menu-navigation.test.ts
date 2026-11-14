import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MemberSidebar } from "../components/app/MemberSidebar";

vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => React.createElement("a", props, children),
}));
vi.mock("../components/pastoral/ReportStatusBadge", () => ({ ReportBadge: () => null }));
vi.mock("../components/notices/UnreadNoticeBadge", () => ({ UnreadNoticeBadge: () => null }));

function renderMenu(prayerMenuEnabled: boolean) {
  const props = { unreadCount: 0, prayerMenuEnabled };
  return renderToStaticMarkup(React.createElement(MemberSidebar, props));
}

describe("member prayer menu visibility", () => {
  it("uses the requested member menu order", () => {
    const html = renderMenu(true);
    const labels = ["공지", "오늘의 생일", "성경통독", "기도요청", "심방요청", "도란도란", "마을과 샘", "샘목양지", "2027 사역안내"];
    const positions = labels.map((label) => html.indexOf(`>${label}<`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps the pastoral link with other menus when the old prayer setting is disabled", () => {
    const html = renderMenu(false);
    expect(html).not.toContain(">말씀 묵상<");
    expect(html).toContain(">공지<");
    expect(html).toContain(">심방요청<");
    expect(html).toContain(">기도요청<");
    expect(html).toContain(">도란도란<");
    expect(html).toContain(">샘목양지<");
  });

  it("removes the meditation menu for existing callers", () => {
    const html = renderToStaticMarkup(React.createElement(MemberSidebar, { unreadCount: 0 }));
    expect(html).not.toContain('href="/"');
    expect(html).not.toContain(">말씀 묵상<");
  });

  it.each([false, true])("keeps prayer comments out of the three designated new-post menu indicators (%s)", (prayerHasUnread) => {
    const html = renderToStaticMarkup(React.createElement(MemberSidebar, { unreadCount: 0, prayerHasUnread }));
    const prayerLink = html.match(/<a href="\/prayer-requests"[\s\S]*?<\/a>/)?.[0];
    expect(prayerLink).toBeDefined();
    expect(prayerLink!.includes('aria-label="읽지 않은 기도요청 댓글"')).toBe(false);
    expect(html.match(/읽지 않은 기도요청 댓글/g)?.length ?? 0).toBe(0);
  });
});
