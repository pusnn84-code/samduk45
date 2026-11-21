"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "../../../src/lib/fetch-json";
type Status={configured:boolean;connected:boolean;accountEmail:string|null;selectedCalendarId:string|null;selectedCalendarName:string|null};
type Calendar={id:string;summary:string;accessRole:string|null};
export function GoogleCalendarExportSettings(){
  const [status,setStatus]=useState<Status|null>(null),[calendars,setCalendars]=useState<Calendar[]>([]),[selection,setSelection]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const synced=useRef(false);
  const refresh=useCallback(async()=>{
    const value=await fetchJson<Status>("/api/admin/google-calendar/status",{cache:"no-store"});setStatus(value);setSelection(value.selectedCalendarId??"");
    if(value.connected){const list=await fetchJson<{calendars:Calendar[]}>("/api/admin/google-calendar/calendars",{cache:"no-store"});setCalendars(list.calendars.filter(c=>c.accessRole==="owner"||c.accessRole==="writer"));}
    return value;
  },[]);
  const sync=useCallback(async()=>{
    setBusy(true);setMessage("");
    try{const result=await fetchJson<{created:number;updated:number;removed:number;unchanged:number}>("/api/admin/google-calendar/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"},55000);
      setMessage(`동기화 완료 · ${result.created+result.updated+result.unchanged}개 일정${result.removed?` · 취소·삭제 ${result.removed}개 반영`:""}`);
    }catch{setMessage("동기화하지 못했습니다. Google 연결과 인터넷 상태를 확인한 뒤 다시 동기화해 주세요.");}finally{setBusy(false);}
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetchJson<Status>("/api/admin/google-calendar/status",{cache:"no-store",signal:controller.signal}).then(async value=>{
      if(controller.signal.aborted)return;setStatus(value);setSelection(value.selectedCalendarId??"");
      if(value.connected){const list=await fetchJson<{calendars:Calendar[]}>("/api/admin/google-calendar/calendars",{cache:"no-store",signal:controller.signal});if(controller.signal.aborted)return;setCalendars(list.calendars.filter(c=>c.accessRole==="owner"||c.accessRole==="writer"));}
      if(value.connected&&value.selectedCalendarId&&!synced.current){synced.current=true;void sync();}
    }).catch(()=>{if(!controller.signal.aborted)setMessage("Google 연결 상태를 불러오지 못했습니다. 다시 확인해 주세요.");});
    return()=>controller.abort();
  },[sync]);
  async function save(){if(busy||!selection)return;setBusy(true);setMessage("");try{await fetchJson("/api/admin/google-calendar/selection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({calendarId:selection})});await refresh();await sync();}catch{setMessage("캘린더를 선택하지 못했습니다. 연결을 확인해 주세요.");}finally{setBusy(false);}}
  async function disconnect(){if(busy||!window.confirm("Google 캘린더 연결을 해제할까요? 이미 보낸 일정은 Google에 남습니다."))return;setBusy(true);try{await fetchJson("/api/admin/google-calendar/connection",{method:"DELETE"});synced.current=false;await refresh();setMessage("연결을 해제했습니다.");}catch{setMessage("연결을 해제하지 못했습니다. 다시 시도해 주세요.");}finally{setBusy(false);}}
  return <section className="card admin-setting-card" aria-labelledby="google-calendar-export-title">
    <h2 id="google-calendar-export-title">내 구글 캘린더 연결</h2>
    <p className="helper-text">확정된 심방·목회일정을 내 구글 캘린더로 보냅니다. 일정 변경은 삼덕사오에서 해 주세요.</p>
    {message&&<p role="status">{message}</p>}
    {!status?<p className="helper-text">연결 상태를 확인하는 중입니다.</p>:!status.configured?<p className="helper-text">구글 연동 서버 설정이 필요합니다.</p>:!status.connected?
      <a className="primary-button compact-button" href="/api/admin/google-calendar/connect">구글 캘린더 연결하기</a>:
      <div className="admin-form">
        <p><strong>연결 계정</strong>　{status.accountEmail??"Google 계정"}</p>
        <label>내 캘린더<select aria-label="내 캘린더" value={selection} onChange={event=>setSelection(event.target.value)} disabled={busy}><option value="">캘린더 선택</option>{calendars.map(c=><option key={c.id} value={c.id}>{c.summary}</option>)}</select></label>
        <div className="visit-register-actions"><button className="primary-button" type="button" disabled={busy||!selection} onClick={()=>void save()}>선택한 캘린더에 연결</button><button className="text-button" type="button" disabled={busy} onClick={()=>void sync()}>{busy?"동기화 중…":"지금 동기화"}</button><button className="text-button" type="button" disabled={busy} onClick={()=>void disconnect()}>연결 해제</button></div>
        <a className="text-button" href="/api/admin/google-calendar/connect">구글 계정 다시 연결</a>
      </div>}
    <p className="helper-text">대기 중 신청과 기도제목·심방 사유는 보내지 않습니다. 시간이 정해지지 않은 일정은 종일로, 시간이 정해진 일정은 1시간으로 표시합니다.</p>
    <p className="helper-text"><a href="/privacy#google-calendar" target="_blank" rel="noopener noreferrer">Google 데이터 이용 안내</a></p>
  </section>;
}
