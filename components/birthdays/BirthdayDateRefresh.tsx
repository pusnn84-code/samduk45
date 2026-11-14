"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { seoulDate } from "../../src/features/birthdays/dates";
export function BirthdayDateRefresh({ day }: { day: string }) {
  const router = useRouter();
  useEffect(() => {
    const check = () => { if (document.visibilityState === "visible" && seoulDate() !== day) router.refresh(); };
    const timer = window.setInterval(check, 60000); check();
    window.addEventListener("focus", check); document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [day, router]);
  return null;
}
