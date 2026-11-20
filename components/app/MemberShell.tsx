"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PrayerMenuProvider } from "./PrayerMenuProvider";
import type { PrayerMenuSetting } from "../../src/features/prayer-menu/settings";
import type { SessionUser } from "../../src/features/auth/session";
import { LogoutButton } from "../auth/LogoutButton";

import { MemberSidebar } from "./MemberSidebar";
import { AppPageHeader } from "./AppPageHeader";
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
      <aside id="member-app-sidebar" className={`community-sidebar${menuOpen ? " is-open" : ""}`}>
        <Link href="/" className="sidebar-brand" onClick={() => setMenuOpen(false)} aria-label="삼덕사오 메뉴 선택">
          <img src="/brand/samduk45-logo-v4.png" alt="삼덕사오" width={104} height={101} />
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
        <AppPageHeader menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(value => !value)} onHome={() => setMenuOpen(false)}>
          <MenuUpdateBadge count={counts.notices + counts.community + (counts.reading ?? 0)} label="새 소식" />
        </AppPageHeader>
        {isMenuHome && <section className="menu-home-intro" aria-label="45공동체 목회표어">
          <p>삼덕교회 45공동체 · {COMMUNITY_2027.year}년</p>
          <h1>{COMMUNITY_2027.motto}</h1>
        </section>}
        <div className="community-content">{children}</div>
      </div>
    </div>
  );
}
