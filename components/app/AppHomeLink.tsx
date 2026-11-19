import Link from "next/link";
import { MenuIcon } from "./MenuIcon";
import "./compact-header.css";

export function AppHomeLink({ onNavigate }: { onNavigate?: () => void }) {
  return <Link href="/" prefetch={false} className="app-home-link"
    aria-label="첫 메뉴 화면으로" title="첫 메뉴 화면으로" onClick={onNavigate}>
    <MenuIcon name="home" />
  </Link>;
}
