"use client";
import Link from "next/link";
import { useState } from "react";
import { AdminNoticeEditor } from "./AdminNoticeEditor";
export function DeputyNoticeUpload() {
  const [message, setMessage] = useState("");
  return <main className="shell"><section className="feature-heading"><h2>부관리자</h2><p>공동체의 소식을 올리고, 도란도란의 공개 게시물을 관리합니다.</p><Link className="secondary-button" href="/community">도란도란 게시물 관리</Link></section>
    {message && <p role="status" className="card">{message} <Link href="/notices">공지에서 확인하기</Link></p>}
    <AdminNoticeEditor notice={null} publishOnly onCancel={() => {}} onSaved={() => setMessage("공지를 등록했습니다.")} />
  </main>;
}
