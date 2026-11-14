import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordSetupForm } from "../../components/auth/PasswordSetupForm";
import { getCurrentPasswordSetupSession, getCurrentSessionUser } from "../../src/features/auth/http-session";
import "../../components/auth/pin.css";

export const metadata: Metadata = { title: "6자리 비밀번호 설정" };
export const dynamic = "force-dynamic";
export default async function PasswordSetupPage() {
  if (await getCurrentSessionUser()) redirect("/");
  if (!await getCurrentPasswordSetupSession()) redirect("/login");
  return <main className="pin-auth-page">
    <img className="pin-auth-logo" src="/brand/samduk45-logo-v3.png" alt="삼덕사오" width={104} height={101} />
    <h1 className="sr-only">6자리 비밀번호 설정</h1>
    <PasswordSetupForm />
  </main>;
}
