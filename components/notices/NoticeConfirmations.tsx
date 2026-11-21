"use client";

import { useState } from "react";
import type { NoticeConfirmationPerson, NoticeConfirmationState } from "../../src/features/notices/types";

function confirmedTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function People({ people, empty }: { people: NoticeConfirmationPerson[]; empty: string }) {
  return people.length ? <ul className="notice-confirmation-people">{people.map(person => <li key={person.id}>
    <div><strong>{person.name}</strong><span>{person.responsibilities.join(" · ")}</span></div>
    {person.confirmedAt && <time dateTime={person.confirmedAt}>{confirmedTime(person.confirmedAt)}</time>}
  </li>)}</ul> : <p className="notice-confirmation-empty">{empty}</p>;
}

export function NoticeConfirmations({ noticeId, readRevision, initial }: { noticeId: string; readRevision: string; initial: NoticeConfirmationState }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [changed, setChanged] = useState(initial.revision !== readRevision);

  async function request(confirm: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/notices/${noticeId}/confirmations`, confirm ? {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision: readRevision }), cache: "no-store",
      } : { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 403) { setForbidden(true); return; }
      if (response.status === 409 && result.code === "NOTICE_CHANGED") { setChanged(true); return; }
      if (!response.ok) throw new Error("REQUEST_FAILED");
      setState(result);
      setChanged(result.revision !== readRevision);
      if (confirm) setMessage("공지 확인을 기록했습니다.");
    } catch { setMessage("확인 정보를 저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  if (forbidden) return null;
  return <section className="notice-confirmations" aria-labelledby="notice-confirmation-title">
    <div className="notice-confirmation-heading">
      <div><p className="eyebrow">리더 함께 확인</p><h3 id="notice-confirmation-title">공지 읽음 확인</h3></div>
      <button type="button" className="text-button" disabled={busy} onClick={() => void request(false)}>현황 새로고침</button>
    </div>
    <p className="helper-text">샘리더·마을장·임원과 관리자가 함께 볼 수 있습니다. ‘확인했습니다’ 버튼을 누른 기준으로 표시됩니다.</p>
    {changed ? <div className="notice-confirmation-action" role="status"><p>공지 내용이 변경되었습니다. 다시 읽은 뒤 확인해 주세요.</p><button type="button" className="primary-button compact-button" onClick={() => window.location.reload()}>공지 다시 읽기</button></div>
      : state.canConfirm && <div className="notice-confirmation-action">
        <button type="button" className="primary-button compact-button" disabled={busy || Boolean(state.ownConfirmedAt)} onClick={() => void request(true)}>{state.ownConfirmedAt ? "확인 완료" : busy ? "기록 중…" : "확인했습니다"}</button>
        {state.ownConfirmedAt && <span>내 확인 · {confirmedTime(state.ownConfirmedAt)}</span>}
      </div>}
    {message && <p role="status" className="helper-text">{message}</p>}
    <div className="notice-confirmation-columns">
      <section aria-label="확인한 리더"><h4>확인한 리더 <span>{state.confirmed.length}명</span></h4><People people={state.confirmed} empty="아직 확인한 리더가 없습니다." /></section>
      <section aria-label="미확인 리더"><h4>미확인 리더 <span>{state.unconfirmed.length}명</span></h4><People people={state.unconfirmed} empty="미확인 리더가 없습니다." /></section>
    </div>
    {state.confirmed.length + state.unconfirmed.length === 0 && <p className="helper-text">현재 등록된 확인 대상 리더가 없습니다. 샘리더·마을장과 공지 확인 임원 등록 상태를 확인해 주세요.</p>}
  </section>;
}
