"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useUnreadNoticeCount } from "../notices/UnreadNoticeBadge";
import { fetchJson } from "../../src/lib/fetch-json";
import { EMPTY_MENU_ACTIVITY, type MenuActivityCounts, type MenuActivityKind } from "../../src/features/menu-activity/types";

const activityChanged = "menu-activity:changed";
export const MenuActivityContext = createContext<{ counts: MenuActivityCounts; markViewed: (kind: MenuActivityKind, time: string, date?: string) => Promise<void> }>({
  counts: EMPTY_MENU_ACTIVITY, markViewed: async () => {},
});
export const useMenuActivity = () => useContext(MenuActivityContext);

export function MenuActivityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const notices = useUnreadNoticeCount();
  const [questions, setQuestions] = useState(0);
  const [updates, setUpdates] = useState({ community: 0, members: 0, reading: 0, readingDates: [] as string[] });
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function refresh() {
      if (!active || document.visibilityState === "hidden") return;
      controller?.abort();
      const request = new AbortController(); controller = request;
      void fetchJson<{ count: number }>("/api/questions/unread", { cache: "no-store", signal: request.signal }, 8000).then(body => {
        if(active && !request.signal.aborted && Number.isInteger(body.count) && body.count >= 0) setQuestions(body.count);
      }).catch(() => {});
      try {
        const body = await fetchJson<{ community: number; members: number; reading: number; readingDates: string[] }>("/api/menu-activity", { cache: "no-store", signal: request.signal }, 8000);
        if (active && !request.signal.aborted && [body.community, body.members, body.reading].every(value => Number.isInteger(value) && value >= 0)) setUpdates(body);
      } catch { /* Keep the last known counts during a temporary connection failure. */ }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh); window.addEventListener(activityChanged, refresh); document.addEventListener("visibilitychange", refresh);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener(activityChanged, refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [pathname]);
  const markViewed = useCallback(async (kind: MenuActivityKind, observedAt: string, date?: string) => {
    await fetchJson("/api/menu-activity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, observedAt, ...(date ? { date } : {}) }) }, 8000);
    window.dispatchEvent(new Event(activityChanged));
  }, []);
  return <MenuActivityContext.Provider value={{ counts: { ...updates, notices, questions }, markViewed }}>{children}</MenuActivityContext.Provider>;
}

/** Mount only beside successfully loaded content. Prefetched server routes never acknowledge a menu. */
export function MenuActivityView({ kind, observedAt }: { kind: MenuActivityKind; observedAt?: string }) {
  const pathname = usePathname();
  const { markViewed } = useMenuActivity();
  const sent = useRef("");
  useEffect(() => {
    const correctPage = kind === "members" ? pathname === "/our-community" : pathname === "/community" || pathname === "/admin/community";
    if (!correctPage || !observedAt) return;
    const key = kind + ":" + observedAt;
    function acknowledge() {
      if (document.visibilityState !== "visible" || sent.current === key) return;
      sent.current = key;
      void markViewed(kind, observedAt!).catch(() => { if (sent.current === key) sent.current = ""; });
    }
    acknowledge(); document.addEventListener("visibilitychange", acknowledge); window.addEventListener("focus", acknowledge);
    return () => { document.removeEventListener("visibilitychange", acknowledge); window.removeEventListener("focus", acknowledge); };
  }, [kind, observedAt, pathname, markViewed]);
  return null;
}

export function NoticeActivityRefresh() {
  useEffect(() => { window.dispatchEvent(new Event("notices:read")); }, []);
  return null;
}
