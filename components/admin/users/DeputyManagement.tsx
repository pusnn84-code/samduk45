"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "../../../src/lib/fetch-json";
import type { DeputyCandidate } from "../../../src/features/deputies/service";
export function DeputyManagement() {
  const [members, setMembers] = useState<DeputyCandidate[]>([]), [changes, setChanges] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [loaded, setLoaded] = useState(false);
  useEffect(() => { const controller = new AbortController(); void fetchJson<{ members: DeputyCandidate[] }>("/api/admin/deputies", { cache: "no-store", signal: controller.signal }).then(body => { setMembers(body.members); setLoaded(true); }).catch(() => { if (!controller.signal.aborted) setMessage("권한 목록을 불러오지 못했습니다. 새로고침해 주세요."); }); return () => controller.abort(); }, []);
  const selected = (member: DeputyCandidate) => changes[member.id] ?? member.enabled;
  const needle = query.trim().replace(/\s/g, "");
  const visible = members.filter(member => !member.isAdmin && (needle ? [member.name, member.village, member.sam].join("").replace(/\s/g, "").includes(needle) : selected(member) || member.id in changes));
  async function save() {
    setBusy(true); setMessage("");
    try {
      await fetchJson("/api/admin/deputies", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes: Object.entries(changes).map(([id, enabled]) => ({ id, enabled })) }) });
      setMembers(current => current.map(member => member.id in changes ? { ...member, enabled: changes[member.id] } : member)); setChanges({}); setMessage("부관리자 권한을 저장했습니다.");
    } catch { setMessage("저장하지 못했습니다. 권한 목록을 다시 확인해 주세요."); } finally { setBusy(false); }
  }
  return <section className="card deputy-management" aria-labelledby="deputy-management-title"><h2 id="deputy-management-title">부관리자 권한</h2>
    <p className="helper-text">공지 글·이미지 등록과 도란도란의 공개 게시물 삭제만 허용합니다. 사용자 관리·전체 설정·다른 사람의 목양지 열람 권한은 부여하지 않습니다.</p>
    <label>부관리자 검색<input type="search" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} placeholder="이름 또는 마을·샘으로 검색" /></label>
    {!loaded && !message && <p role="status">목록을 불러오는 중입니다…</p>}
    <ul className="deputy-member-list">{visible.map(member => <li key={member.id}><label><input type="checkbox" checked={selected(member)} disabled={busy} onChange={event => setChanges(current => ({ ...current, [member.id]: event.target.checked }))} /><span><strong>{member.name}</strong><small>{[member.village && (/^\d+$/.test(member.village) ? member.village + "마을" : member.village), member.sam && (member.sam.endsWith("샘") ? member.sam : member.sam + "샘")].filter(Boolean).join(" · ") || "소속 미등록"}</small></span></label></li>)}</ul>
    {loaded && visible.length === 0 && <p className="helper-text">등록할 분의 이름을 검색해 선택해 주세요.</p>}
    <button type="button" className="primary-button" disabled={busy || !Object.keys(changes).length} onClick={() => void save()}>{busy ? "저장 중…" : "부관리자 권한 저장"}</button>
    {message && <p role="status" className="helper-text">{message}</p>}
  </section>;
}
