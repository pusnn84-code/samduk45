"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";

type OwnVisit = { id: string; visitDate: string; endDate?: string|null; allDay?:boolean; status: string; preferredTime: string; location: string };
const statusLabel: Record<string, string> = { requested: "수락 대기", confirmed: "확정", completed: "완료", cancelled: "취소" };

export function MyVisitRequests({ refreshKey }: { refreshKey: number }) {
  const [visits, setVisits] = useState<OwnVisit[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<{ visits: OwnVisit[] }>("/api/visits", { cache: "no-store", signal: controller.signal })
      .then(body => { setVisits(body.visits); setError(""); })
      .catch(() => { if (!controller.signal.aborted) setError("내 신청을 불러오지 못했습니다. 페이지를 새로고침해 주세요."); });
    return () => controller.abort();
  }, [refreshKey]);
  return <section className="card" style={{ marginTop: 20 }} aria-labelledby="my-visits-title"><h3 id="my-visits-title">내 심방 신청</h3>
    {error ? <p role="alert">{error}</p> : visits.length === 0 ? <p className="helper-text">아직 신청한 심방이 없습니다.</p> : <ul>{visits.map(visit => <li key={visit.id} style={{ marginBlock: 12 }}>
      <strong>{visit.visitDate}{visit.endDate&&visit.endDate!==visit.visitDate?` ~ ${visit.endDate}`:""}</strong> · {statusLabel[visit.status] || visit.status}<span> {visit.allDay?"종일":visit.preferredTime} {visit.location}</span>
    </li>)}</ul>}
    <p className="helper-text">신청은 목사님이 수락한 뒤 확정됩니다. 일정 변경은 목사님께 문의해 주세요.</p>
  </section>;
}
