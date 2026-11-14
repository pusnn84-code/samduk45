import { notFound, redirect } from "next/navigation";
import { NoticeDetail } from "../../../../components/notices/NoticeDetail";
import { NoticeConfirmations } from "../../../../components/notices/NoticeConfirmations";
import { NoticeActivityRefresh } from "../../../../components/app/MenuActivityProvider";
import "../../../../components/notices/notice-confirmations.css";
import { getNoticeConfirmations } from "../../../../src/features/notices/confirmations";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import {
  getPublishedNoticeForUser,
  markNoticeRead,
} from "../../../../src/features/notices/service";

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const notice = await getPublishedNoticeForUser(id, user.id);
  if (!notice) notFound();

  await markNoticeRead(id, user.id);
  const confirmation = await getNoticeConfirmations(id, user);

  return (
    <main className="shell">
      <NoticeActivityRefresh />
      <NoticeDetail notice={{ ...notice, isUnread: false }}>
        {confirmation && notice.revision && <NoticeConfirmations key={`${id}:${notice.revision}`} noticeId={id} readRevision={notice.revision} initial={confirmation} />}
      </NoticeDetail>
    </main>
  );
}
