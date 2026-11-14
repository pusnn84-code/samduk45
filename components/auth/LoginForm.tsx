"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        router.replace(body.status === "password_change_required" ? "/set-password" : body.status === "pin_setup_required" ? "/set-pin" : "/");
        router.refresh();
        return;
      }

      setMessage(
        body.message ??
          (response.status === 429
            ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "등록된 이름과 비밀번호를 확인해 주세요."),
      );
    } catch {
      setMessage("연결을 확인한 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-card" onSubmit={submit}>
      <label>
        <span>이름 (아이디)</span>
        <input
          required
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="이름을 입력하세요"
        />
      </label>
      <label>
        <span>비밀번호</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="처음: 휴대폰 번호 / 이후: 간편비밀번호 6자리"
          aria-describedby="login-password-help"
        />
      </label>
      <p id="login-password-help" className="login-password-help"><strong>처음이신가요? 비밀번호 칸에 휴대폰 번호를 입력하세요.</strong><span>번호는 ‘-’ 없이 입력해 주세요. 설정을 마친 분은 간편비밀번호 6자리를 입력하세요.</span></p>
      {message && <p className="error-text" role="alert">{message}</p>}
      <button className="primary-button" type="submit" disabled={busy}>
        {busy ? "확인 중…" : "로그인"}
      </button>
      <p className="helper-text">
        처음 로그인하면 나만의 숫자 6자리 비밀번호를 설정합니다.
      </p>
    </form>
  );
}
