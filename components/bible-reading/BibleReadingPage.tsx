"use client";
import {MeditationIcon} from "./MeditationIcon";


import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMenuActivity } from "../app/MenuActivityProvider";
import { SharingActivityView } from "./SharingActivityView";
import { MeditationComments } from "./MeditationComments";
import { SharingEmpathyButton } from "./SharingEmpathyButton";
import { BIBLE_READING_PLAN, getBibleReadingDay, readingCycle } from "../../src/content/bible-reading-plan";
import { getBibleReadingLinks } from "../../src/content/bible-reading-links";
import type { BibleReadingState } from "../../src/features/bible-reading/types";
import { fetchJson } from "../../src/lib/fetch-json";
import "./bible-reading.css";

type ReadingUpdate = { completed: boolean } | { sharing: string | null; sharingAnonymous?: boolean };

const endpoint = "/api/bible-reading";
const monthOf = (date: string) => Number(date.slice(5, 7));
const monthIndex=(date:string)=>Number(date.slice(0,4))*12+monthOf(date)-1;
const dateLabel = (date: string) => `${monthOf(date)}월 ${Number(date.slice(8, 10))}일`;

export function BibleReadingPage({ today, initialDate }: { today: string; initialDate?: string }) {
  const {counts:menuCounts}=useMenuActivity();
  const initialDay = (initialDate && getBibleReadingDay(initialDate)) || BIBLE_READING_PLAN.find(day => day.date >= today) || BIBLE_READING_PLAN.at(-1);
  const [date, setDate] = useState(initialDay?.date ?? "");
  const [month, setMonth] = useState(initialDay ? monthIndex(initialDay.date) : monthIndex(today));
  const [loadedReading, setReading] = useState<BibleReadingState | null>(null);
  const [draftOverride, setDraftOverride] = useState<string | null>(null);
  const [anonymousOverride, setAnonymousOverride] = useState<boolean | null>(null);
  const [editingId,setEditingId]=useState<string|null>(null);
  const postId=useRef<string|null>(null);
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
  const draft = draftOverride ?? "";
  const anonymous = anonymousOverride ?? false;

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
    setEditingId(null);postId.current=null;
    setLoadError("");
    setFeedback(null);
    setEmpathyError(null);
  }

  function chooseMonth(nextMonth: number) {
    if (mutation.current || nextMonth < monthIndex(BIBLE_READING_PLAN[0].date) || nextMonth > monthIndex(BIBLE_READING_PLAN.at(-1)!.date)) return;
    setMonth(nextMonth);
    chooseDate(BIBLE_READING_PLAN.find(day => monthIndex(day.date) === nextMonth)?.date ?? "");
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

  async function writeSharing(method:"POST"|"PATCH"|"DELETE",id:string,text?:string){
    if(mutation.current||refreshing||!reading)return;
    mutation.current=true;loadController.current?.abort();setSaving(true);setFeedback(null);
    try{
      const result=await fetchJson<BibleReadingState>(endpoint+"/shares",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({id,date,...(method==="DELETE"?{}:{sharing:text,sharingAnonymous:anonymous})})});
      setReading(result);
      if(method!=="DELETE"||id===editingId){setDraftOverride("");setAnonymousOverride(false);setEditingId(null);postId.current=null;}
      setFeedback({target:"sharing",message:method==="DELETE"?"묵상 나눔을 삭제했습니다.":method==="PATCH"?"묵상 나눔을 수정했습니다.":"묵상 나눔을 올렸습니다. 새로운 글을 계속 남길 수 있습니다."});
    }catch{setFeedback({target:"sharing",message:"저장 결과를 확인하지 못했습니다. 입력한 내용은 그대로 남아 있습니다. 다시 불러와 확인해 주세요.",error:true});}
    finally{mutation.current=false;setSaving(false);}
  }
  function submitSharing(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!draft.trim())return;
    if(editingId)void writeSharing("PATCH",editingId,draft.trim());
    else{postId.current??=crypto.randomUUID();void writeSharing("POST",postId.current,draft.trim());}
  }
  function editSharing(line:BibleReadingState["sharedLines"][number]){
    setEditingId(line.id);setDraftOverride(line.text);setAnonymousOverride(line.anonymous??false);postId.current=null;setFeedback(null);
    document.getElementById("bible-reading-share")?.focus();
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

  const year=Math.floor(month/12), monthNumber=month%12+1;
  const cycle=readingCycle(date||today);
  const startWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const completedDays = reading?.progress.completedDays;
  const totalDays = reading?.progress.totalDays ?? cycle.length;
  const progressPercent = completedDays === undefined || totalDays === 0 ? 0 : Math.round(1000 * completedDays / totalDays) / 10;
  const firstDate = cycle[0]?.date;
  const lastDate = cycle.at(-1)?.date;
  const firstMonth = monthIndex(BIBLE_READING_PLAN[0].date);
  const lastMonth = monthIndex(BIBLE_READING_PLAN.at(-1)!.date);
  const monthPlan = BIBLE_READING_PLAN.filter(day => monthIndex(day.date) === month);
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
          <p className="bible-reading-eyebrow">삼덕사오 · 말씀 읽기</p>
          <h2 id="bible-reading-title">성경통독<span aria-hidden="true">.</span></h2>
          <p>읽을 본문을 확인하고, 함께 말씀을 읽은 하루를 기록해요.</p>
        </div>
        <div className="bible-reading-colors" aria-hidden="true"><i /><i /><i /><i /></div>
      </header>

      {firstDate && lastDate && (
        <p className="bible-reading-period"><strong>{dateLabel(firstDate)} ~ {dateLabel(lastDate)} · {cycle.length}일</strong> 월요일부터 토요일까지 읽어요. 일요일은 밀린 분량을 읽는 날이며 별도 완료 체크는 없어요.</p>
      )}

      <section className="bible-reading-progress" aria-labelledby="bible-reading-progress-title">
        <div>
          <h3 id="bible-reading-progress-title">나의 {cycle[0].date === "2026-11-30" ? "시편" : "2026년"} 통독</h3>
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
                return <option key={optionMonth} value={optionMonth}>{Math.floor(optionMonth/12)}년 {optionMonth%12+1}월</option>;
              })}
            </select>
            <button type="button" aria-label="다음 달" disabled={month === lastMonth || saving} onClick={() => chooseMonth(month + 1)}>›</button>
          </div>
          <div className="bible-reading-dates">
            {["일", "월", "화", "수", "목", "금", "토"].map(weekday => <span className="bible-reading-weekday" key={weekday}>{weekday}</span>)}
            {Array.from({ length: startWeekday }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const dayDate = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
                >{day}{menuCounts.readingDates?.includes(dayDate) && <small aria-label="새 묵상 나눔"> N</small>}</button>
              );
            })}
          </div>
          {todayIsPlanned && (
            <button className="bible-reading-today" type="button" disabled={saving || date === today} onClick={() => {
              setMonth(monthIndex(today));
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
            <p className="bible-reading-eyebrow">{date ? `${dateLabel(date)}${date === today ? " · 오늘" : ""}` : `${monthNumber}월`}</p>
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
              <h3 id="bible-reading-sharing-title">묵상 나눔</h3>
              <SharingActivityView date={date} observedAt={reading.observedAt} />
              <p id="bible-reading-share-hint" className="bible-reading-hint">마음에 남은 말씀이나 생각을 나눠 보세요. 나눔은 로그인한 공동체 구성원에게 보여요.</p>
              <form onSubmit={submitSharing} className="bible-reading-share-form">
                <label htmlFor="bible-reading-share">나의 묵상</label>
                <textarea id="bible-reading-share" rows={5} value={draft} disabled={saving}
                  aria-describedby="bible-reading-share-hint" onChange={event => setDraftOverride(event.target.value)} placeholder="말씀을 읽으며 느낀 생각과 은혜를 편안하게 적어 주세요." />
                <label className="bible-reading-anonymous"><input type="checkbox" checked={anonymous} disabled={saving} onChange={event => setAnonymousOverride(event.target.checked)} />무명으로 나누기</label>
                <p className="bible-reading-hint">묵상 나눔의 이름만 무명1·무명2처럼 표시합니다. 함께 읽은 분들에는 기존처럼 이름이 표시됩니다.</p>
                <div className="bible-reading-share-actions">
                  {editingId&&<button type="button" className="bible-reading-secondary" disabled={updating} onClick={()=>{setEditingId(null);setDraftOverride("");setAnonymousOverride(false);postId.current=null;}}>수정 취소</button>}
                  <button type="submit" className="bible-reading-primary" disabled={updating||!draft.trim()}>{editingId?"수정 저장":"나눔 올리기"}</button>
                </div>
              </form>
              {renderFeedback("sharing")}
              {reading.sharedLines.length > 0 ? (
                <ul className="bible-reading-lines">
                  {reading.sharedLines.map(line => <li key={line.id}><strong>{line.name}{line.isOwn ? " · 나" : ""}</strong><p>{line.text}</p><MeditationComments sharingId={line.id} commentCount={line.commentCount} reaction={<SharingEmpathyButton line={line} disabled={updating} busy={empathyBusy===line.id} onClick={()=>void reactToLine(line)}/>} controls={line.isOwn&&<><button type="button" className="meditation-icon-button" aria-label="수정" title="수정" disabled={updating} onClick={()=>editSharing(line)}><MeditationIcon name="edit"/></button><button type="button" className="meditation-icon-button" aria-label="삭제" title="삭제" disabled={updating} onClick={()=>{if(window.confirm("이 묵상 나눔을 삭제할까요?"))void writeSharing("DELETE",line.id);}}><MeditationIcon name="delete"/></button></>}/>{empathyError?.id===line.id&&<p className="bible-reading-error" role="alert">{empathyError.message} <button type="button" className="bible-reading-secondary" disabled={updating} onClick={refreshReading}>다시 확인</button></p>}</li>)}
                </ul>
              ) : <p className="bible-reading-hint">아직 등록된 묵상 나눔이 없습니다.</p>}
            </section>)}
      </div>
    </main>
  );
}
