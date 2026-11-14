import { redirect } from "next/navigation";
import Link from "next/link";
import { canPublishNotices } from "../../../src/features/deputies/policy";
import { NoticeList } from "../../../components/notices/NoticeList";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { listPublishedNotices } from "../../../src/features/notices/service";

export default async function NoticesPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const notices = await listPublishedNotices(user.id);

  return (
    <main className="shell">
      <section className="feature-heading">
        <h2>공지</h2>
        <p>45공동체의 새로운 소식과 안내를 확인하세요.</p>
        {canPublishNotices(user) && <Link className="primary-button" href={user.role === "admin" ? "/admin/notices" : "/leadership"}>공지 올리기</Link>}
      </section>
      <NoticeList notices={notices} />
    </main>
  );
}
