"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMenuActivity } from "../app/MenuActivityProvider";
import { SharingActivityView } from "./SharingActivityView";
import { SharingEmpathyButton } from "./SharingEmpathyButton";
import { BIBLE_READING_PLAN, BIBLE_READING_YEAR, getBibleReadingDay } from "../../src/content/bible-reading-plan";
import { getBibleReadingLinks } from "../../src/content/bible-reading-links";
import type { BibleReadingState } from "../../src/features/bible-reading/types";
import { fetchJson } from "../../src/lib/fetch-json";
import "./bible-reading.css";

type ReadingUpdate = { completed: boolean } | { sharing: string | null; sharingAnonymous?: boolean };

const endpoint = "/api/bible-reading";
const maxSharingLength = 150;
const monthOf = (date: string) => Number(date.slice(5, 7));
const dateLabel = (date: string) => `${monthOf(date)}월 ${Number(date.slice(8, 10))}일`;

export function BibleReadingPage({ today, initialDate }: { today: string; initialDate?: string }) {
  const {counts:menuCounts}=useMenuActivity();
  const initialDay = (initialDate && getBibleReadingDay(initialDate)) || BIBLE_READING_PLAN.find(day => day.date >= today) || BIBLE_READING_PLAN.at(-1);
  const [date, setDate] = useState(initialDay?.date ?? "");
  const [month, setMonth] = useState(initialDay ? monthOf(initialDay.date) : 1);
  const [loadedReading, setReading] = useState<BibleReadingState | null>(null);
  const [draftOverride, setDraftOverride] = useState<string | null>(null);
  const [anonymousOverride, setAnonymousOverride] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [empathyBusy,setEmpathyBusy]=useState<string|null>(null);
  const [empathyError,setEmpathyError]=useState<{id:string;message:string}|null>(null);
  const [feedback, setFeedback] = useState<{ target: "sharing" | "completion"; message: string; error?: boolean } | null>(null);
  const mutation = useRef(false);
  const loadController = useRef<AbortController | null>(null);
  const plannedDay = getBibleReadingDay(date);
  const chapterLinks = plannedDay ? getBibleReadingLinks(plannedDay.passage) : [];
  const todayIsPlanned = Boolean(getBibleReadingDay(today));
  const reading = loadedReading?.date === date ? loadedReading : null;
  const draft = draftOverride ?? reading?.sharing ?? "";
  const anonymous = anonymousOverride ?? reading?.sharingAnonymous ?? false;

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    loadController.current = controller;
    fetchJson<BibleReadingState>(`${endpoint}?date=${encodeURIComponent(date)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(result => {
      if (controller.signal.aborted) return;
      setReading(result);
      setEmpathyError(null);
      setRefreshing(false);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setRefreshing(false);
      setLoadError(error instanceof Error && error.message === "UNAUTHORIZED"
        ? "로그인한 후 다시 시도해 주세요."
        : "통독 기록을 불러오지 못했습니다. 다시 시도해 주세요.");
    });
    return () => controller.abort();
  }, [date, reload]);

  useEffect(() => {
    const refresh = () => { if (!mutation.current && document.visibilityState === "visible") setReload(value => value + 1); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  function chooseDate(nextDate: string) {
    if (mutation.current || nextDate === date) return;
    setDate(nextDate);
    setReading(null);
    setRefreshing(false);
    setDraftOverride(null);
    setAnonymousOverride(null);
    setLoadError("");
    setFeedback(null);
    setEmpathyError(null);
  }

  function chooseMonth(nextMonth: number) {
    if (mutation.current || nextMonth < 1 || nextMonth > 12) return;
    setMonth(nextMonth);
    chooseDate(BIBLE_READING_PLAN.find(day => monthOf(day.date) === nextMonth)?.date ?? "");
  }

  async function save(update: ReadingUpdate, message: string) {
    if (mutation.current || refreshing || !reading || !date) return;
    mutation.current = true;
    loadController.current?.abort();
    setSaving(true);
    setFeedback(null);
    const target = "sharing" in update ? "sharing" : "completion";
    try {
      const result = await fetchJson<BibleReadingState>(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, ...update }),
      });
      setReading(result);
      if ("sharing" in update) { setDraftOverride(null); setAnonymousOverride(null); }
      setFeedback({ target, message });
    } catch {
      setFeedback({ target, message: "저장 결과를 확인하지 못했습니다. 다시 불러온 뒤 확인해 주세요.", error: true });
    } finally {
      mutation.current = false;
      setSaving(false);
    }
  }

  function refreshReading() {
    if (mutation.current || refreshing) return;
    setRefreshing(true);
    setLoadError("");
    setFeedback(null);
    setReload(current => current + 1);
  }

  function submitSharing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sharing = draft.trim();
    if (sharing && (sharing !== reading?.sharing || anonymous !== reading?.sharingAnonymous)) void save({ sharing, sharingAnonymous: anonymous }, "한 줄 나눔을 저장했습니다.");
  }

  async function reactToLine(line:BibleReadingState["sharedLines"][number]) {
    if(mutation.current||refreshing||!reading)return;
    mutation.current=true;loadController.current?.abort();setEmpathyBusy(line.id);setEmpathyError(null);
    try {
      const state=await fetchJson<{sharingId:string;count:number;reacted:boolean}>(`${endpoint}/empathy`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({date,sharingId:line.id,reacted:!line.hasEmpathized})});
      setReading(current=>current?.date===date?{...current,sharedLines:current.sharedLines.map(item=>item.id===state.sharingId?{...item,empathyCount:state.count,hasEmpathized:state.reacted}:item)}:current);
    } catch(error) {
      const missing=error instanceof Error&&error.message==="SHARING_NOT_FOUND";
      setEmpathyError({id:line.id,message:missing?"이 나눔을 찾을 수 없어 다시 불러옵니다.":"공감 결과를 확인하지 못했습니다. 다시 불러와 확인해 주세요."});
      if(missing)setReload(value=>value+1);
    } finally {mutation.current=false;setEmpathyBusy(null);}
  }

  const startWeekday = new Date(Date.UTC(BIBLE_READING_YEAR, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(BIBLE_READING_YEAR, month, 0)).getUTCDate();
  const completedDays = reading?.progress.completedDays;
  const totalDays = reading?.progress.totalDays ?? BIBLE_READING_PLAN.length;
  const progressPercent = completedDays === undefined || totalDays === 0 ? 0 : Math.round(1000 * completedDays / totalDays) / 10;
  const firstDate = BIBLE_READING_PLAN[0]?.date;
  const lastDate = BIBLE_READING_PLAN.at(-1)?.date;
  const firstMonth = firstDate ? monthOf(firstDate) : 1;
  const lastMonth = lastDate ? monthOf(lastDate) : 12;
  const monthPlan = BIBLE_READING_PLAN.filter(day => monthOf(day.date) === month);
  const updating = saving || refreshing || empathyBusy !== null;

  function renderFeedback(target: "sharing" | "completion") {
    if (feedback?.target !== target) return null;
    return (
      <div>
        <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "bible-reading-error" : "bible-reading-success"}>{feedback.message}</p>
        {feedback.error && <button type="button" className="bible-reading-secondary" onClick={refreshReading}>기록 다시 불러오기</button>}
      </div>
    );
  }

  return (
    <main className="bible-reading" aria-labelledby="bible-reading-title">
      <header className="bible-reading-header">
        <div>
          <p className="bible-reading-eyebrow">삼덕사오 · {BIBLE_READING_YEAR}년 말씀 읽기</p>
          <h2 id="bible-reading-title">성경통독<span aria-hidden="true">.</span></h2>
          <p>읽을 본문을 확인하고, 함께 말씀을 읽은 하루를 기록해요.</p>
        </div>
        <div className="bible-reading-colors" aria-hidden="true"><i /><i /><i /><i /></div>
      </header>

      {firstDate && lastDate && (
        <p className="bible-reading-period"><strong>{dateLabel(firstDate)} ~ {dateLabel(lastDate)} · {BIBLE_READING_PLAN.length}일</strong> 월요일부터 토요일까지 읽어요. 일요일은 밀린 분량을 읽는 날이며 별도 완료 체크는 없어요.</p>
      )}

      <section className="bible-reading-progress" aria-labelledby="bible-reading-progress-title">
        <div>
          <h3 id="bible-reading-progress-title">나의 {BIBLE_READING_YEAR}년 통독</h3>
          <p>{completedDays === undefined ? (loadError ? "통독 기록을 불러오지 못했습니다." : "통독 기록 확인 중") : `전체 ${totalDays}일 중 ${completedDays}일 완료`}</p>
        </div>
        <div className="bible-reading-progress-meter">
          <strong>{completedDays === undefined ? "—" : `${progressPercent}%`}</strong>
          {completedDays !== undefined && <progress aria-label="나의 통독 진행률" value={completedDays} max={Math.max(totalDays, 1)} />}
        </div>
      </section>

      <div className="bible-reading-layout">
        <section className="bible-reading-calendar bible-reading-card" aria-labelledby="bible-reading-calendar-title">
          <h3 id="bible-reading-calendar-title">통독 날짜 선택</h3>
          <div className="bible-reading-month-controls">
            <button type="button" aria-label="이전 달" disabled={month === firstMonth || saving} onClick={() => chooseMonth(month - 1)}>‹</button>
            <select aria-label="통독 달 선택" value={month} disabled={saving} onChange={event => chooseMonth(Number(event.target.value))}>
              {Array.from({ length: lastMonth - firstMonth + 1 }, (_, index) => {
                const optionMonth = firstMonth + index;
                return <option key={optionMonth} value={optionMonth}>{BIBLE_READING_YEAR}년 {optionMonth}월</option>;
              })}
            </select>
            <button type="button" aria-label="다음 달" disabled={month === lastMonth || saving} onClick={() => chooseMonth(month + 1)}>›</button>
          </div>
          <div className="bible-reading-dates">
            {["일", "월", "화", "수", "목", "금", "토"].map(weekday => <span className="bible-reading-weekday" key={weekday}>{weekday}</span>)}
            {Array.from({ length: startWeekday }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const dayDate = `${BIBLE_READING_YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const scheduled = Boolean(getBibleReadingDay(dayDate));
              return (
                <button
                  type="button"
                  key={dayDate}
                  aria-label={`${dateLabel(dayDate)}${scheduled ? "" : ", 통독 일정 없음"}`}
                  aria-pressed={date === dayDate}
                  aria-current={dayDate === today ? "date" : undefined}
                  disabled={saving || !scheduled}
                  onClick={() => chooseDate(dayDate)}
                >{day}{menuCounts.readingDates?.includes(dayDate) && <small aria-label="새 한 줄 나눔"> N</small>}</button>
              );
            })}
          </div>
          {todayIsPlanned && (
            <button className="bible-reading-today" type="button" disabled={saving || date === today} onClick={() => {
              setMonth(monthOf(today));
              chooseDate(today);
            }}>오늘 일정 보기</button>
          )}
          <p className="bible-reading-hint">통독 일정이 있는 날짜를 선택할 수 있어요.</p>
          <details className="bible-reading-month-plan">
            <summary>이 달 통독표 <span>{monthPlan.length}일</span></summary>
            <table>
              <thead>
                <tr><th scope="col">날짜</th><th scope="col">읽을 본문</th></tr>
              </thead>
              <tbody>
                {monthPlan.map(day => (
                  <tr key={day.date} data-selected={date === day.date}>
                    <td>
                      <button
                        type="button"
                        aria-label={`${dateLabel(day.date)} ${day.passage}`}
                        aria-pressed={date === day.date}
                        disabled={saving}
                        onClick={() => chooseDate(day.date)}
                      >{dateLabel(day.date)}</button>
                    </td>
                    <td>{day.passage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

          <section className="bible-reading-card bible-reading-passage" aria-labelledby="bible-reading-passage-title">
            <p className="bible-reading-eyebrow">{date ? `${dateLabel(date)}${date === today ? " · 오늘" : ""}` : `${month}월`}</p>
            <h3 id="bible-reading-passage-title">{date === today ? "오늘의 읽을 본문" : "읽을 본문"}</h3>
            <p className="bible-reading-reference">{plannedDay?.passage ?? "선택한 달에는 통독 일정이 없습니다."}</p>
            <div className="bible-reading-reading-actions">
              {chapterLinks.length > 0 && <Link className="bible-reading-read-button" href={`/scripture/reading/${date}`}>읽기</Link>}
            {reading && <>
              <button
                className="bible-reading-primary"
                type="button"
                aria-pressed={reading.completed}
                aria-describedby="bible-reading-completion-hint"
                disabled={updating}
                onClick={() => void save({ completed: !reading.completed }, reading.completed ? "완료 체크를 해제했습니다." : "통독 완료를 기록했습니다.")}
              >
                {reading.completed ? "✓ 읽기 완료 · 체크 해제" : "읽기 완료 체크"}
              </button>
            </>}
            </div>
            {reading && <>
              <p id="bible-reading-completion-hint" className="bible-reading-hint">완료를 체크하면 로그인한 공동체 구성원에게 이름이 보여요.</p>
            </>}
            {date && !reading && !loadError && <p role="status" className="bible-reading-hint">통독 기록을 불러오는 중입니다.</p>}
            {loadError && !reading && <p role="alert" className="bible-reading-error">{loadError}</p>}
            {renderFeedback("completion")}
            {loadError && !reading && <button type="button" className="bible-reading-secondary" onClick={refreshReading}>기록 다시 불러오기</button>}
          </section>

        {reading && (<section className="bible-reading-card bible-reading-people-card" aria-labelledby="bible-reading-people-title">
              <div className="bible-reading-people-heading">
                <h3 id="bible-reading-people-title">{date === today ? "오늘 함께 읽은 분들" : `${dateLabel(date)} 함께 읽은 분들`} <span className="bible-reading-count">{reading.completedPeople.length}명</span></h3>
              </div>
              {loadError && <p role="alert" className="bible-reading-error">{loadError}</p>}
              {reading.completedPeople.length > 0 ? (
                <ul className="bible-reading-people">
                  {reading.completedPeople.map((person, index) => <li key={`${person.name}-${index}`}>{person.name}</li>)}
                </ul>
              ) : <p className="bible-reading-hint">아직 이 날짜에 완료를 체크한 분이 없습니다.</p>}
            </section>)}

          {reading && (<section className="bible-reading-card bible-reading-sharing-card" aria-labelledby="bible-reading-sharing-title">
              <h3 id="bible-reading-sharing-title">한 줄 나눔</h3>
              <SharingActivityView date={date} observedAt={reading.observedAt} />
              <p id="bible-reading-share-hint" className="bible-reading-hint">마음에 남은 말씀이나 생각을 나눠 보세요. 나눔은 로그인한 공동체 구성원에게 보여요.</p>
              <form onSubmit={submitSharing} className="bible-reading-share-form">
                <label htmlFor="bible-reading-share">나의 한 줄</label>
                <input id="bible-reading-share" type="text" maxLength={maxSharingLength} value={draft} disabled={saving}
                  aria-describedby="bible-reading-share-hint" onChange={event => setDraftOverride(event.target.value)} placeholder="150자 이내로 적어 주세요" />
                <label className="bible-reading-anonymous"><input type="checkbox" checked={anonymous} disabled={saving} onChange={event => setAnonymousOverride(event.target.checked)} />무명으로 나누기</label>
                <p className="bible-reading-hint">한 줄 나눔의 이름만 무명1·무명2처럼 표시합니다. 함께 읽은 분들에는 기존처럼 이름이 표시됩니다.</p>
                <div className="bible-reading-share-actions">
                  <span>{draft.length}/{maxSharingLength}자</span>
                  {reading.sharing !== null && <button type="button" className="bible-reading-secondary" disabled={updating} onClick={() => void save({ sharing: null }, "한 줄 나눔을 삭제했습니다.")}>삭제</button>}
                  <button type="submit" className="bible-reading-primary" disabled={updating || !draft.trim() || (draft.trim() === reading.sharing && anonymous === reading.sharingAnonymous)}>한 줄 저장</button>
                </div>
              </form>
              {renderFeedback("sharing")}
              {reading.sharedLines.length > 0 ? (
                <ul className="bible-reading-lines">
                  {reading.sharedLines.map(line => <li key={line.id}><strong>{line.name}{line.isOwn ? " · 나" : ""}</strong><p>{line.text}</p><SharingEmpathyButton line={line} disabled={updating} busy={empathyBusy===line.id} onClick={()=>void reactToLine(line)}/>{empathyError?.id===line.id&&<p className="bible-reading-error" role="alert">{empathyError.message} <button type="button" className="bible-reading-secondary" disabled={updating} onClick={refreshReading}>다시 확인</button></p>}</li>)}
                </ul>
              ) : <p className="bible-reading-hint">아직 등록된 한 줄 나눔이 없습니다.</p>}
            </section>)}
      </div>
    </main>
  );
}
