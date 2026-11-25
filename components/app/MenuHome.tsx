"use client";
import Link from "next/link";
import { useMenuActivity } from "./MenuActivityProvider";
import { MenuUpdateBadge } from "./MenuUpdateBadge";
import { countForMenu } from "../../src/features/menu-activity/types";
import { MEMBER_NAVIGATION } from "../../src/content/member-navigation";
import { MenuIcon } from "./MenuIcon";
import "./menu-home.css";

export function MenuHome() {
  const { counts } = useMenuActivity();
  return <main className="menu-home" aria-labelledby="menu-home-title">
    <header className="menu-home-heading">
      <h2 id="menu-home-title">메뉴 선택<span aria-hidden="true">.</span></h2>
      <Link href="/profile#push-settings-title" className="text-button" style={{fontSize:14,display:"inline-flex",alignItems:"center",gap:6}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flex:"none"}}><path d="m9.5 3-.5 2.2-1.6.9-2.2-.6L3 9.3l1.6 1.6v2.2L3 14.7l2.2 3.8 2.2-.6 1.6.9.5 2.2h5l.5-2.2 1.6-.9 2.2.6 2.2-3.8-1.6-1.6v-2.2L21 9.3l-2.2-3.8-2.2.6-1.6-.9-.5-2.2Z"/><circle cx="12" cy="12" r="3"/></svg>설정</Link>
    </header>
    <nav className={`menu-home-grid${MEMBER_NAVIGATION.length > 8 ? " is-extended" : ""}${MEMBER_NAVIGATION.length > 10 ? " is-tall" : ""}${MEMBER_NAVIGATION.length > 12 ? " is-dense" : ""}`} aria-label="메뉴 선택">
      {MEMBER_NAVIGATION.map((item,index) =>
        <Link key={item.href} href={item.href} className="menu-home-card" data-icon={item.icon} data-tone={["red","amber","blue","pink"][Math.floor(index / 3) % 4]}>
          <span className="menu-home-card-content"><span className="menu-home-icon" aria-hidden="true"><MenuIcon name={item.icon} /></span>
          <span className="menu-home-label"><strong>{item.label}</strong><MenuUpdateBadge count={countForMenu(item.href, counts)} label={item.href === "/our-community" ? "새 구성원" : "읽지 않은 새 글"} unit={item.href === "/our-community" ? "명" : "개"} /></span></span>
        </Link>,
      )}
    </nav>
  </main>;
}
