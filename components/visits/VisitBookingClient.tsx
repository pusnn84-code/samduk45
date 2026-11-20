"use client";
import { useState } from "react";
import type { VisitDateAvailability } from "../../src/features/visits/types";
import { displayTime, entryTitle, type CalendarEntry } from "../../src/features/visits/shared-calendar-policy";
import { fetchJson } from "../../src/lib/fetch-json";
import { VisitCalendar } from "./VisitCalendar";
import { VisitRequestPanel } from "./VisitRequestPanel";
import { MinistryScheduleForm } from "./MinistryScheduleForm";
import "./schedule-fields.css";

const statusNames={confirmed:"확정",requested:"대기",unavailable:"불가",completed:"완료"};
export function VisitBookingClient({requesterName,isAdmin=false,onSelectVisit,onChanged}:{requesterName:string;isAdmin?:boolean;onSelectVisit?:(id:string)=>void;onChanged?:()=>void}) {
 const [selectedDate,setSelectedDate]=useState<string|null>(null);
 const [refreshKey,setRefreshKey]=useState(0);
 const [availability,setAvailability]=useState<VisitDateAvailability[]>([]);
 const [entries,setEntries]=useState<CalendarEntry[]>([]);
 const [form,setForm]=useState<"visit"|"ministry"|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const available=availability.find(day=>day.date===selectedDate)?.available===true;
 function select(date:string){setSelectedDate(date);setForm(null);setError("");}
 function changed(){setRefreshKey(value=>value+1);setForm(null);onChanged?.();}
 async function remove(entry:CalendarEntry) {
  if(busy||!entry.seriesId||!window.confirm(entry.repeat==="weekly"?"이 반복 일정 전체를 삭제할까요?":"이 일정을 삭제할까요?"))return;
  setBusy(true);setError("");
  try{await fetchJson("/api/admin/ministry-schedules",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:entry.seriesId})});changed();}
  catch{setError("일정을 삭제하지 못했습니다. 다시 시도해 주세요.");}finally{setBusy(false);}
 }
 return <div className="visit-shared-layout">
  <VisitCalendar selectedDate={selectedDate} onSelect={select} onAvailabilityChange={setAvailability} onEntriesChange={setEntries} refreshKey={refreshKey}/>
  {selectedDate&&<section className="visit-date-details" aria-label="선택한 날짜의 일정">
   <h3>{new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"long",timeZone:"Asia/Seoul"}).format(new Date(selectedDate+"T00:00:00+09:00"))}</h3>
   {entries.filter(entry=>entry.date===selectedDate).map(entry=><article className="visit-event-card" key={entry.id}>
    <div className="visit-event-heading"><h4>{entryTitle(entry)}</h4><i role="img" aria-label={statusNames[entry.status]} title={statusNames[entry.status]} className={`visit-status-dot is-${entry.status}`}/></div>
    <p>{displayTime(entry.time,entry.allDay)}{entry.kind==="visit"?" · 심방":entry.repeat==="weekly"?" · 매주 "+new Intl.DateTimeFormat("ko-KR",{weekday:"long",timeZone:"Asia/Seoul"}).format(new Date(entry.startDate+"T00:00:00+09:00")):""}</p>
    {entry.startDate&&entry.endDate&&entry.endDate!==entry.startDate&&<p className="schedule-date-range">{entry.startDate} ~ {entry.endDate}</p>}
    {entry.location&&<p>{entry.location}</p>}
    {isAdmin&&entry.kind==="visit"&&onSelectVisit&&<button className="text-button" type="button" onClick={()=>onSelectVisit(entry.id)}>신청 관리</button>}
    {isAdmin&&entry.kind==="ministry"&&<button type="button" className="text-button" disabled={busy} onClick={()=>void remove(entry)}>{entry.repeat==="weekly"?"반복 일정 삭제":"일정 삭제"}</button>}
   </article>)}
   {!entries.some(entry=>entry.date===selectedDate)&&<p className="helper-text">등록된 일정이 없습니다.</p>}
   {error&&<p role="alert" className="error-text">{error}</p>}
   <div className="visit-register-actions">
    {(available||isAdmin)&&<button type="button" className="visit-form-switch" aria-pressed={form==="visit"} onClick={()=>setForm(form==="visit"?null:"visit")}>{form==="visit"&&<span className="visit-form-check" aria-hidden="true">✓</span>}{isAdmin?"심방 확정 등록":"심방 신청"}</button>}
    {isAdmin&&<button type="button" className="visit-form-switch" aria-pressed={form==="ministry"} onClick={()=>setForm(form==="ministry"?null:"ministry")}>{form==="ministry"&&<span className="visit-form-check" aria-hidden="true">✓</span>}목회일정 등록</button>}
   </div>
   {form==="visit"&&<VisitRequestPanel key={selectedDate} visitDate={selectedDate} requesterName={requesterName} isAdmin={isAdmin} dateAvailable={available||isAdmin} onClose={()=>setForm(null)} onSuccess={changed} onDateUnavailable={()=>setRefreshKey(value=>value+1)}/>}
   {form==="ministry"&&isAdmin&&<MinistryScheduleForm key={selectedDate} date={selectedDate} onSuccess={changed} onClose={()=>setForm(null)}/>}
  </section>}
 </div>;
}

