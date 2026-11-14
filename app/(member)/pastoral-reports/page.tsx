import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { memberLeaderReportAccess } from "../../../src/features/pastoral/access";
import { PastoralPortal } from "../../../components/pastoral/PastoralPortal";
export const dynamic = "force-dynamic";
export const metadata = { title: "샘목양지" };

export default async function PastoralReportsPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  if (!(await memberLeaderReportAccess(user)).visible) {
    if (user.role === "admin") redirect("/admin/pastoral-reports");
    return <main className="pastoral" aria-labelledby="pastoral-access-title">
      <section className="card">
        <h2 id="pastoral-access-title">샘목양지</h2>
        <p>샘리더만 작성할 수 있습니다.</p>
      </section>
    </main>;
  }
  return <PastoralPortal />;
}
