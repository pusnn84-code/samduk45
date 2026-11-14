import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import { UnreadNoticeBadge } from "../../components/notices/UnreadNoticeBadge";

describe("in-app unread notice marker", () => {
  it("shows the unread count next to the menu", () => {
    const html = renderToStaticMarkup(createElement(UnreadNoticeBadge, { count: 3 }));
    expect(html).toContain('aria-label="안 읽은 공지 3개"');
    expect(html).toContain(">3</span>");
  });
  it("caps the visible number without losing the accessible total", () => {
    const html = renderToStaticMarkup(createElement(UnreadNoticeBadge, { count: 140 }));
    expect(html).toContain(">99+</span>");
    expect(html).toContain("안 읽은 공지 140개");
  });
  it("hides the marker after all notices are read", () => {
    expect(renderToStaticMarkup(createElement(UnreadNoticeBadge, { count: 0 }))).toBe("");
  });
});
