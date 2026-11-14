import Link from "next/link";
import { MenuIcon } from "../../../components/app/MenuIcon";

export const metadata = { title: "성경 찬송가" };

export default function ScripturePage() {
  return <>
    <h2>성경 찬송가</h2>
    <p className="scripture-hint">읽을 말씀이나 찬송가 악보를 선택하세요.</p>
    <nav className="scripture-sections" aria-label="성경 찬송가 메뉴">
      <Link className="card" href="/scripture/bible"><span className="scripture-section-icon"><MenuIcon name="book" /></span><span className="scripture-section-copy"><strong>성경</strong><small>개역개정 · 책과 장·절 선택</small></span><span className="scripture-section-arrow" aria-hidden="true">›</span></Link>
      <Link className="card" href="/scripture/hymns"><span className="scripture-section-icon"><MenuIcon name="reading" /></span><span className="scripture-section-copy"><strong>찬송가</strong><small>번호·제목 검색 · 악보 보기</small></span><span className="scripture-section-arrow" aria-hidden="true">›</span></Link>
    </nav>
  </>;
}
