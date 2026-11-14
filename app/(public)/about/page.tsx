import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_INSTRUCTION, getBranding, publicPageMetadata } from "../../../src/lib/branding";

export const metadata: Metadata = {
  title: "앱 소개",
  description: "삼덕교회 45공동체의 기도, 심방, 소통을 돕는 삼덕사오 앱과 심방 일정 안내입니다.",
  ...publicPageMetadata("/about"),
};

const features = [
  ["01", "공지", "공동체의 안내와 소식을 확인하고, 선택한 기기에서 새 공지 알림을 받을 수 있습니다."],
  ["02", "성경통독", "날짜별 읽을 분량을 확인하고, 완료 체크와 진행률, 한 줄 나눔을 기록합니다."],
  ["03", "심방신청", "신청 가능한 날짜를 확인하고 개인 또는 샘 심방을 신청합니다."],
  ["04", "기도요청", "함께 기도할 내용을 운영 담당자에게 전달합니다."],
  ["05", "도란도란", "사진과 짤막한 글로 일상을 나누고, 좋아요와 댓글로 마음을 전합니다."],
  ["06", "목양지", "권한이 부여된 리더가 목양지를 제출하고 관리자가 확인합니다."],
] as const;

export default function AboutPage() {
  const { supportEmail } = getBranding();
  return (
    <>
      <section className="public-hero" aria-labelledby="about-title">
        <p className="public-eyebrow">삼덕교회 45공동체를 위한 앱</p>
        <h1 id="about-title">함께 기도하고,<br />서로를 돌보는 <span>삼덕사오</span></h1>
        <p className="public-lead">기도의 일상을 기록하고, 만남을 준비하고, 공동체의 소식을 나눕니다.</p>
        <div className="public-actions">
          <Link className="public-button" href="/login" prefetch={false}>삼덕사오 시작하기</Link>
          <Link className="public-text-link" href="/privacy">개인정보처리방침 읽기 →</Link>
        </div>
        <p className="public-caption">앱 소개와 개인정보처리방침은 누구나 볼 수 있습니다. 공동체 기능은 등록된 회원만 이용할 수 있습니다.</p>
      </section>
      <section className="public-section" aria-labelledby="features-title">
        <p className="public-eyebrow">공동체의 일상을 한곳에서</p>
        <h2 id="features-title">삼덕사오에서 할 수 있는 일</h2>
        <div className="public-feature-grid">
          {features.map(([number, title, text]) => (
            <article className="public-feature" key={title}>
              <span className="public-number" aria-hidden="true">{number}</span>
              <h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-callout" aria-labelledby="calendar-title">
        <p className="public-eyebrow">심방 캘린더</p>
        <h2 id="calendar-title">신청부터 만남까지</h2>
        <p>성도는 가능한 날짜를 선택해 심방을 신청합니다. 목사님이 내용을 확인하고 수락하면 앱 안의 심방 캘린더에 확정 일정으로 표시됩니다.</p>
        <p>목사님은 직접 일정을 등록하고 날짜, 시간과 장소를 조정할 수 있습니다. 성도는 자신의 신청 상태를 확인할 수 있으며 다른 성도의 신청 내용은 볼 수 없습니다.</p>
        <p>Google 계정 연결 없이 이용할 수 있습니다.</p>
      </section>
      <section className="public-section public-contact" aria-labelledby="contact-title">
        <h2 id="contact-title">이용 중 도움이 필요하신가요?</h2>
        <p>{supportEmail ? "로그인, 회원 정보 또는 개인정보 관련 문의는 45공동체 운영 담당자에게 보내 주세요." : CONTACT_INSTRUCTION}</p>
        {supportEmail && <a className="public-text-link" href={`mailto:${supportEmail}`}>{supportEmail}</a>}
      </section>
    </>
  );
}
