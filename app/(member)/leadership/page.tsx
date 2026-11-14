import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { canPublishNotices } from "../../../src/features/deputies/policy";
import { DeputyNoticeUpload } from "../../../components/admin/notices/DeputyNoticeUpload";
export const metadata = { title: "부관리자" };
export default async function LeadershipPage() {
  const user = await getCurrentSessionUser(); if (!user) redirect("/login"); if (!canPublishNotices(user)) redirect("/"); return <DeputyNoticeUpload />;
}
