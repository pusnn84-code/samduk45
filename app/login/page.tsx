import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PinLogin } from "../../components/auth/PinLogin";
import { getCurrentPasswordSetupSession, getCurrentSessionUser } from "../../src/features/auth/http-session";
import { getPinDeviceAccount } from "../../src/features/auth/pin-device";
import { PIN_DEVICE_COOKIE_NAME } from "../../src/features/auth/pin-device-cookie";
import { COMMUNITY_2027 } from "../../src/content/community-2027";
import "../../components/auth/pin.css";

export default async function LoginPage() {
  if (await getCurrentSessionUser()) redirect("/");
  if (await getCurrentPasswordSetupSession()) redirect("/set-password");
  const remembered = Boolean(await getPinDeviceAccount((await cookies()).get(PIN_DEVICE_COOKIE_NAME)?.value));
  return <main className="pin-auth-page">
    <img className="pin-auth-logo" src="/brand/samduk45-logo-v3.png" alt="삼덕사오" width={104} height={101} />
    <PinLogin remembered={remembered} />
    <nav className="pin-auth-links" aria-label="앱 안내"><Link href="/2027">2027 사역 안내</Link><Link href="/about">앱 소개</Link><Link href="/privacy">개인정보처리방침</Link></nav>
    <footer className="pin-auth-theme"><strong>{COMMUNITY_2027.motto}</strong><p>{COMMUNITY_2027.verseExcerpt}<br />{COMMUNITY_2027.verseRef}</p></footer>
  </main>;
}
