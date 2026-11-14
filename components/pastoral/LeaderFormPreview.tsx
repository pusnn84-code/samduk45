"use client";
import { useState } from "react";
import Link from "next/link";
import type { SamTarget } from "../../src/features/pastoral/policy";
import { ReportEntry } from "./ReportEntry";

export function LeaderFormPreview({ sams }: { sams: SamTarget[] }) {
  const [samId, setSamId] = useState(sams[0]?.id ?? "");
  const sam = sams.find(item => item.id === samId);
  return <main className="pastoral">
    <header className="pastoral-toolbar"><div><h1>샘리더 작성 화면 미리보기</h1><p>샘리더와 같은 작성 양식입니다. 입력해 보셔도 저장·제출되지 않습니다.</p></div><Link href="/admin/pastoral-reports">목양지 관리로</Link></header>
    <label className="card">확인할 샘<select value={samId} onChange={event => setSamId(event.target.value)}>{sams.map(item => <option key={item.id} value={item.id}>{item.name}샘 · {item.leaderName || "리더 미등록"}</option>)}</select></label>
    {sam ? <ReportEntry key={sam.id} sam={sam} authorName={sam.leaderName || "샘리더"} preview onSubmitted={() => {}} /> : <p>확인할 샘이 없습니다.</p>}
  </main>;
}
