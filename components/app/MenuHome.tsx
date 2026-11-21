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
      <Link href="/profile#push-settings-title" className="text-button" style={{fontSize:14}}>알림 설정</Link>
    </header>
    <nav className={`menu-home-grid${MEMBER_NAVIGATION.length > 8 ? " is-extended" : ""}${MEMBER_NAVIGATION.length > 10 ? " is-tall" : ""}`} aria-label="메뉴 선택">
      {MEMBER_NAVIGATION.map((item,index) =>
        <Link key={item.href} href={item.href} className="menu-home-card" data-icon={item.icon} data-tone={["red","amber","blue","pink"][Math.floor(index / 3) % 4]}>
          <span className="menu-home-card-content"><span className="menu-home-icon" aria-hidden="true"><MenuIcon name={item.icon} /></span>
          <span className="menu-home-label"><strong>{item.label}</strong><MenuUpdateBadge count={countForMenu(item.href, counts)} label={item.href === "/our-community" ? "새 구성원" : "읽지 않은 새 글"} unit={item.href === "/our-community" ? "명" : "개"} /></span></span>
        </Link>,
      )}
    </nav>
  </main>;
}
