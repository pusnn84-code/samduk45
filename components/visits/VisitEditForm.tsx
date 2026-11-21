"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import type { EditableVisit } from "../../src/features/visits/edit-service";
import { ScheduleDates, ScheduleTime } from "./ScheduleFields";
import { VisitRecipientInput } from "./VisitRecipientInput";

type Visit = Omit<EditableVisit, "requesterUserId">;
export function VisitEditForm({ visitId, isAdmin = false, onSaved, onClose }: {
  visitId: string; isAdmin?: boolean; onSaved: () => void; onClose: () => void;
}) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const updateRecipient = useCallback((value: { recipientName: string }) => {
    setVisit(current => current ? { ...current, recipientName: value.recipientName } : current);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchJson<{ visit: Visit }>(`/api/visits/${visitId}`, { cache: "no-store", signal: controller.signal })
      .then(body => { setVisit(body.visit); setError(""); })
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(error instanceof Error && error.message === "VISIT_NOT_EDITABLE" ?
          "확정되었거나 종료된 신청은 수정할 수 없습니다. 일정 변경은 목사님께 문의해 주세요." :
          "수정할 신청을 불러오지 못했습니다. 날짜를 다시 선택해 주세요.");
      });
    return () => controller.abort();
  }, [visitId]);
  function change<K extends keyof Visit>(key: K, value: Visit[K]) {
    setVisit(current => current ? { ...current, [key]: value } : current);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!visit || busy || locked) return;
    setBusy(true); setError("");
    try {
      await fetchJson(`/api/visits/${visitId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitDate: visit.visitDate, endDate: visit.endDate ?? visit.visitDate,
          allDay: visit.allDay, visitType: visit.visitType, attendees: visit.attendees,
          location: visit.location, preferredTime: visit.allDay ? "" : visit.preferredTime,
          reason: visit.reason, ...(isAdmin ? { recipientName: visit.recipientName || visit.attendees || visit.requesterName } : {}),
        }),
      });
      onSaved();
    } catch (error) {
      if (error instanceof Error && error.message === "VISIT_NOT_EDITABLE") {
        setLocked(true);
        setError("목사님이 이미 확정했거나 신청 상태가 바뀌어 저장할 수 없습니다. 날짜를 다시 선택해 확인해 주세요.");
      } else if (error instanceof Error && /VISIT_DATE_UNAVAILABLE|VISIT_OUTSIDE_BOOKING_PERIOD/.test(error.message)) {
        setError("신청 가능한 날짜를 선택해 주세요. 이전 입력 내용은 유지됩니다.");
      } else setError("수정 내용을 저장하지 못했습니다. 날짜와 입력 내용을 확인해 주세요.");
    } finally { setBusy(false); }
  }
  return <section className="card visit-edit-panel" aria-label="심방 신청 수정">
    <h3>심방 신청 수정</h3>
    {error && <p className="error-text" role="alert">{error}</p>}
    {!visit && !error && <p role="status">신청 내용을 불러오는 중입니다.</p>}
    {visit && <form className="admin-form" onSubmit={event => void save(event)}>
      <fieldset disabled={busy || locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {isAdmin && <VisitRecipientInput initialName={visit.recipientName || visit.attendees || visit.requesterName} onChange={updateRecipient} disabled={busy || locked} />}
        <ScheduleDates start={visit.visitDate} end={visit.endDate ?? visit.visitDate}
          onStart={value => change("visitDate", value)} onEnd={value => change("endDate", value)} disabled={busy || locked} />
        <label>심방 유형<select value={visit.visitType} onChange={event => change("visitType", event.target.value as Visit["visitType"])}>
          <option value="personal">개인심방</option><option value="sam">샘심방</option>
        </select></label>
        <label>신청자<input value={visit.requesterName} readOnly /></label>
        <label>참석자 명단 (선택)<textarea maxLength={3000} value={visit.attendees} onChange={event => change("attendees", event.target.value)} /></label>
        <label>장소 (선택)<input maxLength={500} value={visit.location} onChange={event => change("location", event.target.value)} /></label>
        <ScheduleTime label={isAdmin ? "시간" : "희망 시간 (선택)"} value={visit.preferredTime}
          onChange={value => change("preferredTime", value)} allDay={visit.allDay} onAllDay={value => change("allDay", value)} disabled={busy || locked} />
        <label>심방 요청 이유 (선택)<textarea maxLength={10000} value={visit.reason} onChange={event => change("reason", event.target.value)} /></label>
      </fieldset>
      {!isAdmin && <p className="helper-text">대기 중인 본인 신청만 수정할 수 있습니다. 확정 이후에는 목사님께 변경을 요청해 주세요.</p>}
      <div className="visit-register-actions"><button type="submit" className="primary-button" disabled={busy || locked}>{busy ? "저장 중…" : "수정 내용 저장"}</button>
        <button type="button" className="text-button" disabled={busy} onClick={onClose}>닫기</button></div>
    </form>}
    {!visit && <button type="button" className="text-button" onClick={onClose}>닫기</button>}
  </section>;
}
