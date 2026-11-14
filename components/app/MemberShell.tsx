"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PrayerMenuProvider } from "./PrayerMenuProvider";
import type { PrayerMenuSetting } from "../../src/features/prayer-menu/settings";
import type { SessionUser } from "../../src/features/auth/session";
import { LogoutButton } from "../auth/LogoutButton";

import { MemberSidebar } from "./MemberSidebar";
import { MenuIcon } from "./MenuIcon";
import { MenuActivityProvider, useMenuActivity } from "./MenuActivityProvider";
import { MenuUpdateBadge } from "./MenuUpdateBadge";

import { COMMUNITY_2027 } from "../../src/content/community-2027";

export function MemberShell({
  user,
  initialPrayerMenuSettings,
  children,
}: {
  user: SessionUser;
  initialPrayerMenuSettings: PrayerMenuSetting;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <MenuActivityProvider><PrayerMenuProvider initial={initialPrayerMenuSettings} menuOpen={menuOpen}>
    <MemberShellContent user={user} menuOpen={menuOpen} setMenuOpen={setMenuOpen}>{children}</MemberShellContent>
  </PrayerMenuProvider></MenuActivityProvider>;
}

function MemberShellContent({ user, menuOpen, setMenuOpen, children }: {
  user: SessionUser; menuOpen: boolean; setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>; children: React.ReactNode;
}) {
  const { counts } = useMenuActivity();


  const isMenuHome = usePathname() === "/";

  return (
    <div className={`community-app${isMenuHome ? " is-menu-home" : ""}`}>
      <aside className={`community-sidebar${menuOpen ? " is-open" : ""}`}>
        <Link href="/" className="sidebar-brand" onClick={() => setMenuOpen(false)} aria-label="삼덕사오 메뉴 선택">
          <img src="/brand/samduk45-logo-v3.png" alt="삼덕사오" width={104} height={101} />
        </Link>

        <MemberSidebar unreadCount={counts.notices} communityCount={counts.community} readingCount={counts.reading} memberCount={counts.members} onNavigate={() => setMenuOpen(false)} />

        <div className="sidebar-footer">
          <Link href="/profile" onClick={() => setMenuOpen(false)}>내 정보</Link>
          {user.role === "admin" && (
            <Link href="/admin" onClick={() => setMenuOpen(false)}>관리자</Link>
          )}
          {user.role !== "admin" && user.isDeputyAdmin && <Link href="/leadership" onClick={() => setMenuOpen(false)}>부관리자</Link>}
          <LogoutButton />
        </div>
      </aside>

      {menuOpen && (
        <button
          className="community-drawer-overlay"
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="community-main">
        <header className="community-header">
          <button
            className="community-menu-button"
            type="button"
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <MenuIcon name="menu" />
            {<MenuUpdateBadge count={counts.notices + counts.community + (counts.reading ?? 0)} label="새 소식" />}
          </button>
          <div>
            <p className="brand-kicker">삼덕교회 45공동체 · {COMMUNITY_2027.year}년</p><h1>{COMMUNITY_2027.motto}</h1>
            <p className="community-verse">{COMMUNITY_2027.verseExcerpt} ({COMMUNITY_2027.verseRef})</p>
          </div>
        </header>
        <div className="community-content">{children}</div>
      </div>
    </div>
  );
}
