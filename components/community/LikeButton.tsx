"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorText } from "./shared";
export function LikeButton({ postId, initialLiked, initialCount }: { postId: string; initialLiked: boolean; initialCount: number }) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  useEffect(() => {
    if (pending.current) return;
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount]);
  async function toggle() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      // Keep the previous state on failure; retry sends the same explicit intent.
      const next = await api<{ liked: boolean; likeCount: number }>(`/posts/${postId}/like`, "PUT", { liked: !liked });
      setLiked(next.liked); setCount(next.likeCount);
    } catch (error) { setMessage(errorText(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="community-likes">
    <button type="button" className={`community-like-button${liked ? " is-liked" : ""}`} aria-label="좋아요" aria-pressed={liked} aria-busy={busy} disabled={busy} onClick={() => void toggle()}>
      <svg width="23" height="23" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.5 5.5a5.1 5.1 0 0 0-7.2 0L12 6.8l-1.3-1.3a5.1 5.1 0 0 0-7.2 7.2L12 21l8.5-8.3a5.1 5.1 0 0 0 0-7.2Z" /></svg> 좋아요 <span aria-live="polite" className="community-like-count">{count}</span>
    </button>
    {message && <p className="error-text" role="alert">{message}</p>}
  </div>;
}
