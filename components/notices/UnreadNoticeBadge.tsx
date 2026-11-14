"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "../../src/lib/fetch-json";

export function useUnreadNoticeCount() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    let refreshAgain = false;

    async function load() {
      if (controller.signal.aborted || document.visibilityState === "hidden") return;
      if (loading) { refreshAgain = true; return; }
      loading = true;
      try {
        const body = await fetchJson<{ count: number }>("/api/notices/unread-count", {
          cache: "no-store", signal: controller.signal,
        }, 5_000);
        if (!controller.signal.aborted && Number.isInteger(body.count) && body.count >= 0) setCount(body.count);
      } catch {
        // App-internal notices remain usable even if the badge request fails.
      } finally {
        loading = false;
        if (refreshAgain && !controller.signal.aborted) { refreshAgain = false; void load(); }
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    window.addEventListener("notices:read", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      window.removeEventListener("notices:read", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname]);

  return count;
}

export function UnreadNoticeBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="nav-badge menu-update-badge" aria-label={`안 읽은 공지 ${count}개`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
