import { PastoralAdmin } from "../../../components/pastoral/PastoralAdmin";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { memberLeaderReportAccess } from "../../../src/features/pastoral/access";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function PastoralAdminPage({ searchParams }: { searchParams: Promise<{ id?: string; unreviewed?: string }> }) {
  const [query, user] = await Promise.all([searchParams, getCurrentSessionUser()]);
  const canSubmit = user?.role === "admin" && (await memberLeaderReportAccess(user)).visible;
  const id = typeof query.id === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(query.id) ? query.id : "";
  return <><div className="pastoral"><Link className="primary-button" href="/admin/pastoral-reports/preview">샘리더 작성 화면 미리보기</Link></div><PastoralAdmin initialId={id} initialUnreviewed={query.unreviewed === "1"} canSubmit={canSubmit} /></>;
}
