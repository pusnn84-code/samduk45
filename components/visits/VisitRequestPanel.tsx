"use client";

import { FormEvent, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import type { VisitStartTimes } from "../../src/features/visits/types";
import { VisitRecipientInput } from "./VisitRecipientInput";

export function VisitRequestPanel({
  visitDate,
  requesterName,
  isAdmin = false,
  dateAvailable,
  onClose,
  onSuccess,
  onDateUnavailable,
}: {
  visitDate: string;
  requesterName: string;
  isAdmin?: boolean;
  dateAvailable: boolean;
  startTimes?: VisitStartTimes | null;
  onClose: () => void;
  onSuccess: () => void;
  onDateUnavailable: () => void;
}) {
  const [visitType, setVisitType] = useState<"personal" | "sam">("personal");
  const [attendees, setAttendees] = useState("");
  const [location, setLocation] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recipient,setRecipient]=useState<{recipientRosterId?:string;recipientName:string}>({recipientName:""});

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !dateAvailable) return;

    setBusy(true);
    setMessage("");
    try {
      await fetchJson<{ id: string }>("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          visitDate,
          visitType,
          attendees,
          location,
          preferredTime,
          reason,
          ...(isAdmin ? recipient : {}),
        }),
      });
      setMessage(isAdmin ? "심방 일정이 확정되어 캘린더에 반영되었습니다." : "심방 신청이 전달되었습니다.");
      onSuccess();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      if (["VISIT_OUTSIDE_BOOKING_PERIOD", "VISIT_ALREADY_EXISTS", "VISIT_DATE_UNAVAILABLE"].includes(code)) {
        onDateUnavailable();
      }
      setMessage(
        code === "VISIT_OUTSIDE_BOOKING_PERIOD"
          ? "신청 가능한 기간이 변경되었습니다. 달력에서 다른 날짜를 선택해 주세요."
          : code === "VISIT_ALREADY_EXISTS" || code === "VISIT_DATE_UNAVAILABLE"
          ? "방금 다른 일정이 등록되었습니다. 다른 날짜를 선택해 주세요."
            : cause instanceof Error && cause.name === "TimeoutError"
              ? "응답이 지연되어 신청 결과를 확인하지 못했습니다. 달력을 다시 확인해 주세요."
              : "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="visit-request-panel" aria-label={isAdmin ? "심방 일정 기록" : "심방 신청하기"}>
      <div className="visit-panel-heading">
        <div>
          <p className="eyebrow">{isAdmin ? "심방 일정 기록" : "심방 신청하기"}</p>
          <h3>{visitDate}</h3>
        </div>
        <button
          type="button"
          className="text-button visit-panel-close"
          aria-label="심방 신청 닫기"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <form className="visit-request-form" onSubmit={submit}>
        <fieldset>
          <legend>심방 유형</legend>
          <div className="visit-type-options">
            <label>
              <input
                type="radio"
                name="visitType"
                checked={visitType === "personal"}
                onChange={() => setVisitType("personal")}
              />
              개인심방
            </label>
            <label>
              <input
                type="radio"
                name="visitType"
                checked={visitType === "sam"}
                onChange={() => setVisitType("sam")}
              />
              샘심방
            </label>
          </div>
        </fieldset>

        {isAdmin && <VisitRecipientInput onChange={setRecipient} disabled={busy}/>}
        <label>
          신청자
          <input value={requesterName} readOnly />
        </label>

        <label>
          참석자 명단 (선택)
          <textarea
            maxLength={3000}
            value={attendees}
            onChange={(event) => setAttendees(event.target.value)}
            placeholder="함께 참석하는 분의 이름을 적어주세요."
          />
        </label>

        <label>
          장소 (선택)
          <input
            maxLength={500}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="예: 가정, 교회, 카페"
          />
        </label>

        <label>
          희망 시간 (선택)
          <input
            aria-describedby={dateAvailable ? "visit-start-time-guidance" : undefined}
            maxLength={200}
            value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
            placeholder="예: 오후 3시 이후"
          />
        </label>

        {dateAvailable && (
          <div className="visit-start-time-guidance" id="visit-start-time-guidance" aria-live="polite">
            <p>{isAdmin ? "심방 시간을 적어주세요. 저장하면 바로 확정됩니다." : "원하시는 시간을 적어주세요. 목사님이 확인 후 일정을 확정합니다."}</p>
          </div>
        )}

        <label>
          심방 요청 이유 (선택)
          <textarea
            maxLength={10000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="심방을 요청하는 이유를 자유롭게 적어주세요."
          />
        </label>

        <p className="helper-text">항목을 입력하지 않아도 신청할 수 있습니다.</p>
        <p className="visit-confirmation-copy">
          {isAdmin ? "관리자가 기록한 일정은 수락 대기 없이 심방 캘린더에 바로 반영됩니다." : "목사님이 신청을 수락하면 심방 캘린더에 반영됩니다."}
        </p>

        {!dateAvailable ? (
          <p className="error-text" role="status">
            이 날짜는 지금 신청할 수 없습니다. 달력에서 다른 날짜를 선택해 주세요.
          </p>
        ) : message && (
          <p className={message.includes("전달") || message.includes("반영되었습니다") ? "success-text" : "error-text"} role="status">
            {message}
          </p>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={busy || !dateAvailable}
        >
          {busy ? (isAdmin ? "저장 중…" : "신청 중…") : (isAdmin ? "확정 일정 저장" : "신청")}
        </button>
      </form>
    </aside>
  );
}
