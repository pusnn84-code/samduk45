"use client";
import {disableDevicePush} from '../../src/features/push/browser-device';

export function LogoutButton({ label = "로그아웃" }: { label?: string } = {}) {
  async function logout() {
    await disableDevicePush();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  return <button className="text-button" type="button" onClick={logout}>{label}</button>;
}
