"use client";
import type { InternalVisitPatch } from "../../../src/features/visits/internal-calendar";

import { useState,useCallback } from "react";
import { ScheduleDates,ScheduleTime } from "../../visits/ScheduleFields";
import { VisitRecipientInput } from "../../visits/VisitRecipientInput";
import type {
  AdminVisitRecord,
} from "../../../src/features/visits/admin-service";

export function AdminVisitDetail({
  visit,
  busy,
  onSave,
  onAction,
}: {
  visit: AdminVisitRecord | null;
  busy: boolean;
  onSave: (patch: InternalVisitPatch) => Promise<void>;
  onAction: (action: "confirm" | "complete" | "cancel" | "delete" | "decline") => Promise<void>;
}) {
  const [visitDate, setVisitDate] = useState(visit?.visitDate ?? "");
  const [endDate,setEndDate]=useState(visit?.endDate??visit?.visitDate??"");
  const [allDay,setAllDay]=useState(Boolean(visit?.allDay));
  const [visitType, setVisitType] = useState<"personal" | "sam">(
    visit?.visitType ?? "personal",
  );
  const [attendees, setAttendees] = useState(visit?.attendees ?? "");
  const [location, setLocation] = useState(visit?.location ?? "");
  const [preferredTime, setPreferredTime] = useState(visit?.preferredTime ?? "");
  const [reason, setReason] = useState(visit?.reason ?? "");
  const [recipientName,setRecipientName]=useState(visit?.recipientName || visit?.attendees || visit?.requesterName || "");
  const updateRecipient=useCallback((value:{recipientName:string})=>setRecipientName(value.recipientName),[]);

  if (!visit) {
    return (
      <section className="card empty-state admin-visit-detail">
        <strong>심방 신청을 선택해 주세요.</strong>
      </section>
    );
  }

  return (
    <section className="card admin-visit-detail">
      <div className="section-heading">
        <div>
          <p className="eyebrow">신청 상세</p>
          <h2>{visit.recipientName || visit.attendees || visit.requesterName}</h2>
        </div>
        <span className="status-pill">{visit.isUnavailable ? "불가" : visit.status === "requested" ? "수락 대기" : visit.status === "confirmed" ? "캘린더 반영됨" : visit.status === "completed" ? "심방 완료" : "취소됨"}</span>
      </div>

      <dl className="admin-visit-summary">
        <div><dt>신청 날짜</dt><dd>{visit.visitDate}{visit.endDate&&visit.endDate!==visit.visitDate?` ~ ${visit.endDate}`:""}</dd></div>
        {visit.recipientSam&&<div><dt>소속 샘</dt><dd>{visit.recipientSam}</dd></div>}
        {visit.recipientLeaderName&&<div><dt>샘리더</dt><dd>{visit.recipientLeaderName}</dd></div>}
        <div><dt>상태</dt><dd>{visit.isUnavailable ? "불가" : visit.status === "requested" ? "수락 대기" : visit.status === "confirmed" ? "확정" : visit.status === "completed" ? "완료" : "취소"}</dd></div>
      </dl>

      <div className="admin-form">
        <VisitRecipientInput initialName={visit.recipientName||visit.attendees||visit.requesterName} onChange={updateRecipient} disabled={busy||visit.status==="cancelled"||visit.status==="completed"}/>
        <ScheduleDates start={visitDate} end={endDate} onStart={setVisitDate} onEnd={setEndDate} disabled={busy||visit.status==="cancelled"||visit.status==="completed"}/>
        <label>
          심방 유형
          <select
            value={visitType}
            onChange={(event) =>
              setVisitType(event.target.value as "personal" | "sam")
            }
            disabled={busy || visit.status === "cancelled" || visit.status === "completed"}
          >
            <option value="personal">개인심방</option>
            <option value="sam">샘심방</option>
          </select>
        </label>
        <label>
          참석자 명단
          <textarea
            value={attendees}
            onChange={(event) => setAttendees(event.target.value)}
            disabled={busy || visit.status === "cancelled" || visit.status === "completed"}
          />
        </label>
        <label>
          장소
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            disabled={busy || visit.status === "cancelled" || visit.status === "completed"}
          />
        </label>
        <ScheduleTime label="희망 시간" value={preferredTime} onChange={setPreferredTime} allDay={allDay} onAllDay={setAllDay} disabled={busy||visit.status==="cancelled"||visit.status==="completed"}/>
        <label>
          심방 요청 이유
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy || visit.status === "cancelled" || visit.status === "completed"}
          />
        </label>
      </div>

      {(visit.status === "requested" || visit.status === "confirmed") && (
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() =>
            void onSave({
              visitDate,
              endDate,
              allDay,
              visitType,
              attendees,
              location,
              preferredTime:allDay?"":preferredTime,
              reason,
              recipientName,
            })
          }
        >
          수정 내용 저장
        </button>
      )}

      <div className="admin-visit-actions">
        {visit.status === "requested" && <button type="button" className="text-button danger-button" disabled={busy} onClick={()=>void onAction("decline")}>불가</button>}
        <button className="text-button danger-button" type="button"
          disabled={busy}
          onClick={() => void onAction("delete")}>신청 삭제</button>
        {visit.status === "requested" && (
          <button
            className="primary-button compact-button"
            type="button"
            disabled={busy}
            onClick={() => void onAction("confirm")}
          >
            신청 수락 · 캘린더 반영
          </button>
        )}
        {visit.status === "confirmed" && (
          <button
            className="primary-button compact-button"
            type="button"
            disabled={busy}
            onClick={() => void onAction("complete")}
          >
            완료
          </button>
        )}
        {(visit.status === "requested" || visit.status === "confirmed") && (
          <button
            className="text-button danger-button"
            type="button"
            disabled={busy}
            onClick={() => void onAction("cancel")}
          >
            취소
          </button>
        )}
      </div>
    </section>
  );
}
