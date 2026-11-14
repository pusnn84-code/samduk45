"use client";

import { useEffect, useState } from "react";
import type { SamTarget } from "../../src/features/pastoral/policy";
import { api, message } from "./client";
import { ReportEntry } from "./ReportEntry";
import { ReportDetail } from "./ReportDetail";
import { ReportHistory } from "./ReportHistory";

type Compose = { sam: SamTarget; authorName: string; today: string };

export function PastoralPortal() {
  const [compose, setCompose] = useState<Compose | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [viewId, setViewId] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<Compose>("/api/pastoral/compose", { cache: "no-store", signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setCompose(value); setError(""); } })
      .catch(err => { if (!controller.signal.aborted) setError(message(err)); });
    return () => controller.abort();
  }, [refresh]);

  function refreshStatus() {
    setRefresh(value => value + 1);
    window.dispatchEvent(new Event("pastoral:changed"));
  }

  return <main className="pastoral">
    {notice && <p role="status" className="pastoral-success">{notice}</p>}
    {viewId && <ReportDetail key={viewId} id={viewId} onChanged={refreshStatus} onClose={() => setViewId("")} />}
    <div hidden={Boolean(viewId)}>
    <header className="pastoral-toolbar"><div><h1>목양지</h1><p>샘의 모임과 샘원들의 이야기를 기록해 주세요.</p></div></header>
    {error && <p role="alert" className="error-text">{error}</p>}
    {!compose && !error && <p role="status">작성 화면을 불러오는 중입니다.</p>}
    {compose && <>
      <ReportEntry key={compose.sam.id} sam={compose.sam} authorName={compose.authorName} onSubmitted={(id,kind) => {
        setNotice(kind === "meeting" ? "샘모임이 제출되었습니다." : "나눔·소식이 제출되었습니다."); refreshStatus(); setViewId(id);
      }} />
      <details className="card"><summary>내가 제출한 목양지 보기</summary><ReportHistory refresh={refresh} onView={setViewId} /></details>
    </>}
    </div>
  </main>;
}
