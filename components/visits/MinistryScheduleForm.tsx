"use client";
import { useState, type FormEvent } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
export function MinistryScheduleForm({date,onSuccess,onClose}:{date:string;onSuccess:()=>void;onClose:()=>void}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 const [repeat,setRepeat]=useState("none");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;const values=Object.fromEntries(new FormData(event.currentTarget).entries());setBusy(true);setError("");
  try{await fetchJson("/api/admin/ministry-schedules",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...values,endDate:values.endDate||null})});onSuccess();}
  catch{setError("일정을 저장하지 못했습니다. 날짜와 시간을 확인해 주세요.");}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="card admin-form visit-ministry-form"><h3>목회일정 등록</h3>
  <label>일정 제목<input name="title" required maxLength={120} placeholder="예: 목요전도대" disabled={busy}/></label>
  <label>시작 날짜<input name="startDate" type="date" required defaultValue={date} disabled={busy}/></label>
  <label>시간<input name="time" type="time" required defaultValue="14:00" disabled={busy}/></label>
  <label>장소<input name="location" maxLength={500} disabled={busy}/></label>
  <label>반복<select name="repeat" value={repeat} onChange={event=>setRepeat(event.target.value)} disabled={busy}><option value="none">반복 안 함</option><option value="weekly">매주 같은 요일</option></select></label>
  {repeat==="weekly"&&<label>반복 종료일 (선택)<input name="endDate" type="date" min={date} disabled={busy}/></label>}
  {error&&<p role="alert" className="error-text">{error}</p>}
  <div className="visit-register-actions"><button className="primary-button" disabled={busy}>{busy?"저장 중…":"확정 일정 등록"}</button><button className="text-button" type="button" onClick={onClose} disabled={busy}>닫기</button></div>
 </form>;
}
