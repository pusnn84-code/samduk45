"use client";
import {safeNotificationDestination} from "../../src/features/push/destination";
import {autumnDestination,rememberAutumnDestination,takeLoginDestination} from "../../src/features/auth/prayer-return";
import { useEffect,useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../../src/lib/fetch-json";
import { isSixDigitPin } from "../../src/features/auth/pin-policy";
import { LogoutButton } from "./LogoutButton";
import { PinPad } from "./PinPad";

export function PinSetupForm({ initial = false }: { initial?: boolean }) {
  const router = useRouter();
  useEffect(()=>{const params=new URLSearchParams(location.search);const target=safeNotificationDestination(params.get("next"))??autumnDestination(params.get("autumnCard"));if(target)rememberAutumnDestination(target);},[]);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function finish(pin: string) {
    if (pending.current) return;
    if (pin !== password) {
      setMessage("번호가 서로 다릅니다. 다시 정해 주세요."); setPassword(""); setConfirmation(""); setConfirming(false); return;
    }
    pending.current = true; setBusy(true); setMessage("");
    try {
      await fetchJson(initial ? "/api/auth/set-password" : "/api/auth/pin", { method: initial ? "POST" : "PUT",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ password, confirmation: pin }) });
      setPassword(""); setConfirmation(""); router.replace(takeLoginDestination()); router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const messages: Record<string, string> = {
        PASSWORD_CONFLICT_SAME_NAME: "같은 이름의 다른 구성원과 번호가 겹칩니다. 다른 번호를 정해 주세요.",
        PASSWORD_SETUP_EXPIRED: "확인 시간이 만료되었습니다. 처음으로 돌아가 다시 로그인해 주세요.",
        UNAUTHORIZED: "다시 로그인한 후 번호를 설정해 주세요.",
        INVALID_INPUT: "숫자 6자리를 두 번 동일하게 입력해 주세요.",
        INVALID_PIN: "숫자 6자리를 두 번 동일하게 입력해 주세요.",
      };
      setMessage(messages[code] ?? "설정을 마치지 못했습니다. 다시 시도해 주세요. 번호가 이미 저장되었다면 이름과 새 번호로 로그인할 수 있습니다.");
      setPassword(""); setConfirmation(""); setConfirming(false);
    } finally { pending.current = false; setBusy(false); }
  }
  function complete(value: string) {
    if (confirming) void finish(value);
    else { setPassword(value); setConfirmation(""); setConfirming(true); setMessage(""); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = confirming ? confirmation : password;
    if (isSixDigitPin(value)) complete(value);
  }
  return <section className="pin-setup">
    <h2>{confirming ? "한 번 더 입력해 주세요" : "6자리 번호를 정해 주세요"}</h2>
    <p>{confirming ? "방금 정한 번호를 다시 입력해 주세요." : "이 휴대폰에서 사용할 숫자 6자리"}</p>
    <div className="pin-brand-colors" aria-hidden="true"><i /><i /><i /><i /></div>
    <form onSubmit={submit}>
      <PinPad key={confirming ? "confirmation" : "password"} value={confirming ? confirmation : password}
        onChange={confirming ? setConfirmation : setPassword} onComplete={complete} busy={busy}
        label={confirming ? "6자리 번호 확인" : "새 6자리 번호"} />
      {message && <p role="alert" className="error-text">{message}</p>}
      {busy && <p role="status">설정 중…</p>}
      <button className="primary-button pin-submit" type="submit" disabled={busy || !isSixDigitPin(confirming ? confirmation : password)}>{confirming ? "설정하고 시작하기" : "다음"}</button>
    </form>
    {confirming && <button className="pin-text-button" type="button" disabled={busy} onClick={() => { setConfirming(false); setPassword(""); setConfirmation(""); setMessage(""); }}>번호 다시 정하기</button>}
    <p className="helper-text">같은 휴대폰에서는 이름 없이 6자리 번호로 로그인합니다.<br />새 휴대폰에서는 이름과 설정한 6자리 번호로 로그인해 주세요.</p>
    {!initial && <p className="helper-text">기존 비밀번호도 새 6자리 번호로 변경됩니다.</p>}
    <LogoutButton label="처음으로 돌아가기" />
  </section>;
}
