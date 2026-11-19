import type { ReactNode } from "react";
import { AppHomeLink } from "./AppHomeLink";
import { MenuIcon } from "./MenuIcon";

export function AppPageHeader({ menuOpen, onToggleMenu, onHome, admin = false, children }: {
  menuOpen: boolean; onToggleMenu: () => void; onHome: () => void;
  admin?: boolean; children?: ReactNode;
}) {
  const label = admin
    ? menuOpen ? "관리자 메뉴 접기" : "관리자 메뉴 열기"
    : menuOpen ? "메뉴 접기" : "메뉴 열기";
  return <header className="app-page-header">
    <AppHomeLink onNavigate={onHome} />
    <strong className="app-header-brand">삼덕사오</strong>
    <button className="app-header-menu" type="button" aria-label={label}
      aria-expanded={menuOpen} aria-controls={admin ? "admin-app-sidebar" : "member-app-sidebar"}
      onClick={onToggleMenu}>
      <MenuIcon name="menu" />
      {children}
    </button>
  </header>;
}
