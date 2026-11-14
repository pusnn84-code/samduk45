import Image from "next/image";
import Link from "next/link";
import { APP_NAME, COMMUNITY_NAME, CONTACT_INSTRUCTION, getBranding } from "../../src/lib/branding";
import "./public.css";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { supportEmail } = getBranding();
  return (
    <div className="public-site">
      <a className="public-skip" href="#public-main">본문으로 바로가기</a>
      <header className="public-header">
        <Link className="public-brand" href="/about">
          <Image src="/icons/45-logo-192.png" alt="" width={48} height={48} unoptimized />
          <span><strong>{APP_NAME}</strong><small>{COMMUNITY_NAME}</small></span>
        </Link>
        <nav className="public-nav" aria-label="공개 안내 메뉴">
          <Link href="/2027">2027 사역 안내</Link>
          <Link href="/about">앱 소개</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/login" prefetch={false}>로그인</Link>
        </nav>
      </header>
      <main id="public-main" className="public-main" tabIndex={-1}>{children}</main>
      <footer className="public-footer">
        <p><strong>{APP_NAME}</strong> · {COMMUNITY_NAME}</p>
        <p><Link href="/privacy">개인정보처리방침</Link> · {supportEmail ? <a href={`mailto:${supportEmail}`}>운영 담당자에게 문의</a> : <span>{CONTACT_INSTRUCTION}</span>}</p>
      </footer>
    </div>
  );
}
