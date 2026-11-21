"use client";
import {useState,type FormEvent} from "react";
import {fetchJson} from "../../src/lib/fetch-json";
import {ScheduleDates,ScheduleTime,ScheduleStatus} from "./ScheduleFields";
export function MinistryScheduleForm({date,onSuccess,onClose}:{date:string;onSuccess:()=>void;onClose:()=>void}){
 const [status,setStatus]=useState<"requested"|"confirmed">("confirmed");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[start,setStart]=useState(date),[end,setEnd]=useState(date),[time,setTime]=useState("14:00"),[allDay,setAllDay]=useState(false),[repeat,setRepeat]=useState("none"),[until,setUntil]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const values=Object.fromEntries(new FormData(event.currentTarget).entries());setBusy(true);setError("");
 try{await fetchJson("/api/admin/ministry-schedules",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:values.title,location:values.location,startDate:start,eventEndDate:end,allDay,time:allDay?"":time,repeat,endDate:repeat==="weekly"?(until||null):null,status})});onSuccess();}
 catch{setError("일정을 저장하지 못했습니다. 날짜 순서와 시간을 확인해 주세요. 반복 일정의 한 회 기간은 7일 이내로 입력해 주세요.");}finally{setBusy(false);}}
 return <form onSubmit={submit} className="card admin-form visit-ministry-form"><h3>목회일정 등록</h3>
 <label>일정 제목<input name="title" required maxLength={120} placeholder="예: 목요전도대" disabled={busy}/></label>
 <ScheduleStatus value={status} onChange={setStatus} disabled={busy}/>
 <ScheduleDates start={start} end={end} onStart={setStart} onEnd={setEnd} disabled={busy}/>
 <ScheduleTime type="time" required label="시간" value={time} onChange={setTime} allDay={allDay} onAllDay={setAllDay} disabled={busy}/>
 <label>장소<input name="location" maxLength={500} disabled={busy}/></label>
 <label>반복<select value={repeat} onChange={event=>setRepeat(event.target.value)} disabled={busy}><option value="none">반복 안 함</option><option value="weekly">매주 같은 요일</option></select></label>
 {repeat==="weekly"&&<label>반복 종료일 (선택)<input type="date" min={start} value={until} onChange={event=>setUntil(event.target.value)} disabled={busy}/></label>}
 {error&&<p role="alert" className="error-text">{error}</p>}
 <div className="visit-register-actions"><button className="primary-button" disabled={busy}>{busy?"저장 중…":status==="confirmed"?"확정 일정 등록":"대기 일정 등록"}</button><button className="text-button" type="button" onClick={onClose} disabled={busy}>닫기</button></div></form>;
}
