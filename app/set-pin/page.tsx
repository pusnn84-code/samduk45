import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { PinSetupForm } from "../../components/auth/PinSetupForm";
import "../../components/auth/pin.css";

export const metadata = { title: "6자리 간편 로그인 설정" };
export default async function SetPinPage() {
  if (!await getCurrentSessionUser()) redirect("/login");
  return <main className="pin-auth-page">
    <img className="pin-auth-logo" src="/brand/samduk45-logo-v4.png" alt="삼덕사오" width={104} height={101} />
    <h1 className="sr-only">6자리 간편 로그인 설정</h1>
    <PinSetupForm />
  </main>;
}
