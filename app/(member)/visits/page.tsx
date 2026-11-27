import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitBookingClient } from "../../../components/visits/VisitBookingClient";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";

export default async function VisitsPage({searchParams}:{searchParams:Promise<{date?:string;visit?:string}>}) {
  const query=await searchParams;
  const date=typeof query.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(query.date)&&!Number.isNaN(Date.parse(query.date))?query.date:null;
  const visitId=typeof query.visit==="string"&&/^[0-9a-f-]{36}$/i.test(query.visit)?query.visit:null;
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="shell visit-page-shell">
      <section className="feature-heading">
        <h2>심방·목회일정</h2>
        <p>날짜를 누르면 그날의 일정을 볼 수 있습니다.</p>
      </section>

      {user.role === "admin" && <p><Link className="primary-button compact-button" href="/admin/visits">목사님 심방 캘린더 · 직접 등록</Link></p>}
      <VisitBookingClient key={`${date??""}:${visitId??""}`} initialDate={date} initialVisitId={visitId} requesterName={user.displayName} isAdmin={user.role === "admin"} />
    </main>
  );
}

