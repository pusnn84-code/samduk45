"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MenuIcon } from "./MenuIcon";
import { INSTALL_URL, installGuide } from "./install-guide";

type InstallPrompt = Event & {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
};

const AppInstallContext = createContext<{
  installed: boolean;
  ready: boolean;
  install: () => Promise<boolean>;
} | null>(null);

export function AppInstallProvider({ children }: { children: ReactNode }) {
  const pendingPrompt = useRef<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function capturePrompt(event: Event) {
      event.preventDefault();
      pendingPrompt.current = event as InstallPrompt;
      setReady(true);
    }
    function markInstalled() {
      pendingPrompt.current = null;
      setReady(false);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    const standalone = window.matchMedia("(display-mode: standalone)");
    const checkInstalled = () => {
      if (standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone) markInstalled();
    };
    checkInstalled();
    standalone.addEventListener("change", checkInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
      standalone.removeEventListener("change", checkInstalled);
    };
  }, []);

  async function install() {
    const event = pendingPrompt.current;
    if (!event) return false;
    pendingPrompt.current = null;
    setReady(false);
    const { outcome } = await event.prompt();
    if (outcome === "accepted") setInstalled(true);
    return true;
  }

  return <AppInstallContext.Provider value={{ installed, ready, install }}>{children}</AppInstallContext.Provider>;
}

export function AppInstallButton() {
  const installer = useContext(AppInstallContext);
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(() => installGuide(""));
  const [copyStatus, setCopyStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  useEffect(() => { setGuide(installGuide(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)); }, []);
  if (installer?.installed) return null;

  async function copyAddress() {
    try { await navigator.clipboard.writeText(INSTALL_URL); setManualCopy(false); setCopyStatus("링크를 복사했습니다. 브라우저 주소창에 붙여넣으세요."); }
    catch { setManualCopy(true); setCopyStatus("아래 주소를 길게 눌러 복사하세요."); }
  }

  async function handleInstall() {
    setBusy(true);
    try {
      if (await installer?.install()) return;
    } catch {
      // Browser installation can be unavailable even after offering a prompt.
    } finally {
      setBusy(false);
    }
    dialog.current?.showModal();
  }

  return <div className="menu-home-install">
    <button className="primary-button menu-home-install-button" type="button" onClick={handleInstall} disabled={busy}>
      <MenuIcon name="install" /> 홈 화면에 추가
    </button>
    <dialog ref={dialog} className="card menu-home-install-dialog" aria-labelledby="app-install-title">
      <h3 id="app-install-title">홈 화면에 삼덕사오 추가</h3>
      <p>아이콘을 누르면 바로 열 수 있어요.</p>
      {installer?.ready ? <button type="button" className="primary-button install-guide-action" disabled={busy} onClick={handleInstall}>설치 창 열기</button>
        : guide.inApp ? <>
          <ol className="install-guide-steps">
            <li><span aria-hidden="true">1</span><strong>아래 ‘링크 복사’를 누르세요.</strong></li>
            <li><span aria-hidden="true">2</span><strong>{guide.kind === "ios" ? "Safari" : "Chrome 또는 삼성인터넷"}을 열고 주소창에 붙여넣으세요.</strong></li>
            <li><span aria-hidden="true">3</span><strong>삼덕사오에서 ‘홈 화면에 추가’를 누르세요.</strong></li>
          </ol>
          <button type="button" className="primary-button install-guide-action" onClick={copyAddress}>링크 복사</button>
          <p role="status">{copyStatus}</p>
          {manualCopy && <input className="install-guide-address" readOnly aria-label="삼덕사오 주소" value={INSTALL_URL} onFocus={event => event.currentTarget.select()} />}
        </> : <ol className="install-guide-steps">{guide.steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span><strong>{step}</strong></li>)}</ol>}
      <form method="dialog"><button className="primary-button" type="submit">닫기</button></form>
    </dialog>
  </div>;
}
