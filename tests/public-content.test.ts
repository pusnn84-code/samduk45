import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import AboutPage, { metadata as aboutMetadata } from "../app/(public)/about/page";
import PrivacyPage, { metadata as privacyMetadata } from "../app/(public)/privacy/page";
import { CONTACT_INSTRUCTION, getBranding, publicPageMetadata } from "../src/lib/branding";

const about = () => renderToStaticMarkup(createElement(AboutPage));
const privacy = () => renderToStaticMarkup(createElement(PrivacyPage));
afterEach(() => vi.unstubAllEnvs());

describe("public information content", () => {
  it("describes the real features and links the policy and app entry", () => {
    const html = about();
    for (const feature of ["공지", "성경통독", "심방신청", "기도요청", "도란도란", "목양지"]) expect(html).toContain(feature);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/login"');
    expect(html).toContain("Google 계정 연결 없이 이용할 수 있습니다.");
    expect(aboutMetadata.alternates?.canonical).toBe(publicPageMetadata("/about").alternates?.canonical);
  });
  it("documents the exact Google scopes and limits instead of promising no third parties", () => {
    const html = privacy();
    for (const text of ["앱 데이터베이스", "Google Calendar 연결·조회·일정 전송 기능은 종료", "Supabase", "Vercel", "가족관계는 제공하지 않습니다"]) expect(html).toContain(text);
    expect(html).toContain("gmail.send");
    expect(html).toContain("기존 메일 본문·목록을 읽거나 수정하는 권한은 요청하지 않습니다");
  });
  it("explains deletion limits and gives a usable revocation and contact path", () => {
    const html = privacy();
    expect(html).toContain("연결 해제만으로 자동 삭제되지 않습니다");
    expect(html).toContain("자동 삭제 기한은 설정되어 있지 않습니다");
    expect(html).toContain('href="https://myaccount.google.com/connections"');
    const { supportEmail } = getBranding();
    expect(html).toContain(supportEmail ? `href="mailto:${supportEmail}"` : CONTACT_INSTRUCTION);
    expect(html).toContain("180일");
    expect(html).not.toContain("TODO");
    expect(privacyMetadata.alternates?.canonical).toBe(publicPageMetadata("/privacy").alternates?.canonical);
  });
  it("does not invent an operator email before one is configured", () => {
    vi.stubEnv("SUPPORT_EMAIL", "");
    for (const html of [about(), privacy()]) {
      expect(html).toContain(CONTACT_INSTRUCTION);
      expect(html).not.toContain('href="mailto:');
    }
  });
  it("uses the configured operator email for public support and rights requests", () => {
    vi.stubEnv("SUPPORT_EMAIL", "care+45@example.org");
    for (const html of [about(), privacy()]) expect(html).toContain('href="mailto:care+45@example.org"');
    expect(privacy()).toContain("본인 정보의 열람·정정·삭제");
  });
  it("has working section destinations for every policy contents link including Gmail", () => {
    const html = privacy();
    const links = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
    expect(links).toHaveLength(10);
    expect(links).toContain("email-notifications");
    expect(new Set(links).size).toBe(links.length);
    for (const id of links) expect(html).toContain(`id="${id}"`);
    expect((html.match(/<h1[ >]/g) ?? [])).toHaveLength(1);
  });
});
