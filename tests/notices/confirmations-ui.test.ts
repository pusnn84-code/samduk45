import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NoticeConfirmations } from "../../components/notices/NoticeConfirmations";
import type { NoticeConfirmationState } from "../../src/features/notices/types";
vi.stubGlobal("React", React);

const revision = "a".repeat(32);
const initial: NoticeConfirmationState = { revision, canConfirm: true, ownConfirmedAt: null, confirmed: [], unconfirmed: [{ id: "leader", name: "가상리더", responsibilities: ["1-1샘 리더"], confirmedAt: null }] };
const render = (state = initial, readRevision = revision) => renderToStaticMarkup(React.createElement(NoticeConfirmations, { noticeId: "notice", initial: state, readRevision }));

describe("notice manual acknowledgement panel", () => {
  it("offers the explicit confirmation action and both named groups to member leaders", () => {
    const html = render();
    expect(html).toContain(">확인했습니다</button>");
    expect(html).toContain('aria-label="확인한 리더"');
    expect(html).toContain('aria-label="미확인 리더"');
    expect(html).toContain("가상리더");
    expect(html).toContain("버튼을 누른 기준");
  });
  it("shows an already confirmed action as disabled", () => {
    const html = render({ ...initial, ownConfirmedAt: "2027-01-02T03:04:05Z" });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>확인 완료<\/button>/);
  });
  it("requires reading the changed notice before any acknowledgement", () => {
    const html = render({ ...initial, revision: "b".repeat(32) });
    expect(html).toContain("공지 다시 읽기");
    expect(html).not.toContain(">확인했습니다</button>");
  });
  it("handles an empty leadership audience without claiming everybody confirmed", () => {
    const html = render({ ...initial, canConfirm: false, unconfirmed: [] });
    expect(html).toContain("현재 등록된 확인 대상 리더가 없습니다.");
    expect(html).not.toContain("모든 대상 리더가 확인했습니다");
  });
});
