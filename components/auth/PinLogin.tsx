"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../../src/lib/fetch-json";
import { LoginForm } from "./LoginForm";
import { PinPad } from "./PinPad";

export function PinLogin({ remembered }: { remembered: boolean }) {
  const router = useRouter();
  const [usePin, setUsePin] = useState(remembered);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function login(value: string) {
    if (pending.current || value.length !== 6) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      await fetchJson("/api/auth/pin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: value }) });
      setPin(""); router.replace("/"); router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "PIN_DEVICE_EXPIRED") { setUsePin(false); setMessage("휴대폰 등록이 만료되었습니다. 이름과 비밀번호로 다시 로그인해 주세요."); }
      else setMessage(code === "TOO_MANY_ATTEMPTS" ? "입력 횟수를 초과했습니다. 15분 후 다시 시도해 주세요."
        : code === "PIN_MISMATCH" ? "번호가 맞지 않습니다. 다시 입력해 주세요." : "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setPin("");
    } finally { pending.current = false; setBusy(false); }
  }
  async function forget() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      await fetchJson("/api/auth/pin", { method: "DELETE" });
      setPin(""); setUsePin(false);
    } catch { setMessage("다시 시도해 주세요."); }
    finally { pending.current = false; setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void login(pin); }
  if (!usePin) return <><h1>삼덕사오에 오신 것을<br />환영해요</h1><p>처음에는 기존 계정으로 로그인해 주세요.</p><div className="pin-brand-colors" aria-hidden="true"><i /><i /><i /><i /></div>{message && <p role="alert" className="error-text">{message}</p>}<LoginForm /></>;
  return <section className="pin-login">
    <h1>간편하게 로그인하세요</h1>
    <p>간편비밀번호 6자리를 입력해 주세요.</p>
    <div className="pin-brand-colors" aria-hidden="true"><i /><i /><i /><i /></div>
    <form onSubmit={submit}>
      <p className="pin-input-label">간편비밀번호 6자리</p>
      <PinPad label="간편비밀번호 6자리" value={pin} onChange={setPin} onComplete={value => void login(value)} busy={busy} />
      {message && <p role="alert" className="error-text">{message}</p>}
      {busy && <p role="status">확인 중…</p>}
      <button className="primary-button pin-submit" type="submit" disabled={busy || pin.length !== 6}>로그인</button>
    </form>
    <button className="pin-text-button" type="button" disabled={busy} onClick={() => void forget()}>다른 계정으로 로그인</button>
    <p className="helper-text">번호를 잊었다면 관리자에게 문의해 주세요.</p>
  </section>;
}
