"use client";

import { useEffect, useState } from "react";
import type { VisitDateAvailability } from "../../src/features/visits/types";
import { fetchJson } from "../../src/lib/fetch-json";
import { entryTitle, type CalendarEntry } from "../../src/features/visits/shared-calendar-policy";

function currentSeoulMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month;
}

function moveMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return (
    String(date.getUTCFullYear()).padStart(4, "0") +
    "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0")
  );
}

function dayNumber(date: string): number {
  return Number(date.slice(-2));
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function VisitCalendar({
  selectedDate,
  onSelect,
  onAvailabilityChange,
  refreshKey = 0,
  onEntriesChange,
}: {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  onAvailabilityChange: (dates: VisitDateAvailability[]) => void;
  refreshKey?: number;
  onEntriesChange?: (entries: CalendarEntry[]) => void;
}) {
  const [month, setMonth] = useState(currentSeoulMonth);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<{
    key: string; dates: VisitDateAvailability[]; entries: CalendarEntry[]; message: string;
  } | null>(null);
  const requestKey = `${month}:${refreshKey}:${retryKey}`;
  const selectedMonth = selectedDate?.slice(0, 7);
  const additionalMonth = selectedMonth && selectedMonth !== month ? selectedMonth : null;
  const loading = result?.key !== requestKey;
  const dates = !loading && result ? result.dates : [];
  const message = !loading && result ? result.message : "";

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;

    async function refresh() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
        // Keep an open request current even while browsing a different month.
        const months = additionalMonth ? [month, additionalMonth] : [month];
        const responses = await Promise.allSettled(months.map(async (value) => {
          const [availability, calendar] = await Promise.all([
          fetchJson<{ dates: VisitDateAvailability[] }>("/api/visits/availability?month=" + encodeURIComponent(value), {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetchJson<{ entries: CalendarEntry[] }>("/api/visits/calendar?month=" + encodeURIComponent(value), {cache:"no-store",signal:controller.signal}),
          ]);
          return {...availability, entries:calendar.entries};
        }));
        const bodies = responses.map((response) => {
          if (response.status === "rejected") throw response.reason;
          return response.value;
        });
        if (!controller.signal.aborted) {
          const dates = Array.isArray(bodies[0].dates) ? bodies[0].dates : [];
          const unavailable = dates.some((date) => !date.available && date.reason === "calendar_unavailable");
          setResult({ key: requestKey, dates, entries: bodies[0].entries ?? [], message: unavailable
            ? "일정 조회가 지연되고 있습니다. 다시 확인해 주세요." : "" });
          onAvailabilityChange(bodies.flatMap((body) => Array.isArray(body.dates) ? body.dates : []));
          onEntriesChange?.(bodies.flatMap(body => body.entries ?? []));
        }
      } catch {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, dates: [], entries: [], message:
          "일정을 확인하기 어렵습니다. 잠시 후 다시 시도해 주세요.",
        });
        onAvailabilityChange([]);
        onEntriesChange?.([]);
      } finally {
        pending = false;
      }
    }

    function refreshVisible() {
      if (document.visibilityState === "visible") void refresh();
    }

    void refresh();
    const timer = window.setInterval(refreshVisible, 30_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [month, additionalMonth, requestKey, onAvailabilityChange, onEntriesChange]);

  function navigateMonth(amount: number) {
    setMonth((value) => moveMonth(value, amount));
  }

  const leadingCells = dates.length === 0 ? 0 : weekday(dates[0].date);
  const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

  return (
    <section className="card visit-calendar-card">
      <div className="visit-calendar-toolbar">
        <button
          type="button"
          className="text-button visit-month-button"
          onClick={() => navigateMonth(-1)}
          aria-label="이전 달"
        >
          ‹
        </button>
        <h3>{month.replace("-", "년 ")}월</h3>
        <button
          type="button"
          className="text-button visit-month-button"
          onClick={() => navigateMonth(1)}
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      <div className="visit-weekdays" aria-hidden="true">
        {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      {loading ? (
        <div className="visit-calendar-message">일정을 확인하고 있습니다.</div>
      ) : message ? (
        <div className="visit-calendar-message" role="status">
          <p>{message}</p>
          <button className="text-button" type="button" onClick={() => setRetryKey((value) => value + 1)}>다시 확인</button>
        </div>
      ) : (
        <div className="visit-calendar-grid">
          {Array.from({ length: leadingCells }, (_, index) => (
            <span className="visit-day-spacer" key={"spacer-" + index} />
          ))}
          {dates.map((item) => {
            const selected = selectedDate === item.date;
            const entries = result?.entries.filter(entry => entry.date === item.date) ?? [];

            return (
              <button
                key={item.date}
                type="button"
                className={[
                  "visit-day",
                  item.available ? "is-available" : "is-unavailable",
                  item.date<today ? "is-past" : "",
                  selected ? "is-selected" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSelect(item.date)}
                aria-pressed={selected}
                aria-label={item.date + (entries.length ? ` 일정 ${entries.length}건` : " 일정 없음")}
              >
                <span>{dayNumber(item.date)}</span>
                <div className="visit-day-entries">{entries.slice(0,2).map(entry => <span className="visit-day-entry" key={entry.id} title={entryTitle(entry)}><i className={`visit-status-dot is-${entry.status}`} /><span>{entry.title}</span></span>)}{entries.length>2&&<span className="visit-day-more">+{entries.length-2}</span>}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="visit-status-legend"><span><i className="visit-status-dot is-confirmed"/>확정</span><span><i className="visit-status-dot is-requested"/>대기</span><span><i className="visit-status-dot is-unavailable"/>불가</span></div>
    </section>
  );
}
