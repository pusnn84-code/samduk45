"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UnreadNoticeBadge } from "../notices/UnreadNoticeBadge";
import { MenuIcon } from "./MenuIcon";
import { MEMBER_NAVIGATION } from "../../src/content/member-navigation";
import { MenuUpdateBadge } from "./MenuUpdateBadge";
import { useMenuActivity } from "./MenuActivityProvider";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MemberSidebar({ onNavigate, unreadCount, communityCount = 0, readingCount = 0 }: { onNavigate?: () => void; unreadCount: number; communityCount?: number; readingCount?: number; memberCount?: number; pastoralCount?: number; prayerMenuEnabled?: boolean; prayerMenuName?: string; prayerHasUnread?: boolean }) {
  const pathname = usePathname();
  const { counts } = useMenuActivity();
  return (
    <nav className="member-nav" aria-label="삼덕사오 메뉴">
      {MEMBER_NAVIGATION.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className={`member-nav-link${active ? " is-active" : ""}`} data-nav-icon={item.icon} aria-current={active ? "page" : undefined} onClick={onNavigate}>
            <span className="member-nav-icon" aria-hidden="true"><MenuIcon name={item.icon} /></span>
            <span>{item.label}</span>

            {item.href === "/notices" && <UnreadNoticeBadge count={unreadCount} />}
            {item.href === "/community" && <MenuUpdateBadge count={communityCount} label="새 이야기" />}
            {item.href === "/bible-reading" && <MenuUpdateBadge count={readingCount} label="새 묵상 나눔" />}
            {item.href === "/questions" && <MenuUpdateBadge count={counts.questions ?? 0} label="새 비공개 대화" />}

          </Link>
        );
      })}
    </nav>
  );
}
