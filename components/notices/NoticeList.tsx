import Link from "next/link";
import "./pinned-plan.css";
import type { MemberNoticeSummary } from "../../src/features/notices/types";

function displayDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function NoticeList({
  notices,
}: {
  notices: MemberNoticeSummary[];
}) {

  return (
    <section className="card notice-list" aria-label="공지 목록">
      <Link className="notice-list-row notice-list-row-pinned" href="/notices/ministry-plan" prefetch={false}>
        <span className="notice-title-line"><span className="notice-pinned-badge">고정</span><strong>2027 사역안내</strong></span>
        <span className="notice-pinned-arrow" aria-hidden="true">›</span>
      </Link>
      {notices.map((notice) => (
        <Link
          className={notice.isUnread ? "notice-list-row is-unread" : "notice-list-row"}
          href={`/notices/${notice.id}`}
          prefetch={false}
          key={notice.id}
        >
          <span className="notice-title-line">
            {notice.isUnread && <strong className="notice-new-badge">NEW</strong>}
            <strong>{notice.title}</strong>
          </span>
          <time dateTime={notice.publishedAt}>
            {displayDate(notice.publishedAt)}
          </time>
        </Link>
      ))}
    </section>
  );
}
