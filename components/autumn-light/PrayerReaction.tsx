"use client";
import {useEffect,useRef,useState,type PointerEvent} from "react";
import {fetchJson} from "../../src/lib/fetch-json";
import type {AutumnCard,AutumnParticipants} from "../../src/features/autumn-light/types";

export function PrayerReaction({card,onUpdated}:{card:AutumnCard;onUpdated:(card:AutumnCard)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[open,setOpen]=useState(false);
 const changing=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null),held=useRef(false),origin=useRef<{x:number;y:number}|null>(null);
 function cancel(){if(timer.current)clearTimeout(timer.current);timer.current=null;origin.current=null;}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 function press(event:PointerEvent<HTMLButtonElement>){
  if(event.button!==0)return;held.current=false;origin.current={x:event.clientX,y:event.clientY};
  timer.current=setTimeout(()=>{timer.current=null;held.current=true;setOpen(true)},500);
 }
 async function toggle(){
  if(held.current){held.current=false;return;}if(changing.current)return;
  changing.current=true;setBusy(true);setError("");
  try{const result=await fetchJson<{card:AutumnCard}>(`/api/autumn-light/cards/${card.id}/prayers`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({prayed:!card.prayed})});onUpdated(result.card);}
  catch{setError("기도 참여를 저장하지 못했습니다.");}
  finally{changing.current=false;setBusy(false);}
 }
 return <div className="autumn-reaction-row"><button type="button" className="autumn-reaction-hit" aria-label="기도했어요, 길게 누르면 함께 기도한 분 보기" aria-keyshortcuts="Shift+F10" aria-pressed={card.prayed} aria-busy={busy} onPointerDown={press} onPointerMove={e=>{if(origin.current&&Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>12)cancel()}} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onContextMenu={e=>{e.preventDefault();cancel();held.current=true;setOpen(true)}} onKeyDown={e=>{if(e.key==="ContextMenu"||(e.shiftKey&&e.key==="F10")){e.preventDefault();held.current=false;setOpen(true)}}} onClick={()=>void toggle()}><span className="autumn-reaction-pill"><span aria-hidden="true">🙏</span><span aria-live="polite">{card.count}</span></span></button>
  {error&&<p className="error-text" role="status">{error}</p>}
  {open&&<Participants id={card.id} onClose={()=>{cancel();held.current=false;setOpen(false)}}/>}
 </div>;
}
function Participants({id,onClose}:{id:string;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);const [names,setNames]=useState<string[]>([]),[page,setPage]=useState(0),[more,setMore]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(true);
 useEffect(()=>{ref.current?.showModal()},[]);
 useEffect(()=>{const controller=new AbortController();void fetchJson<AutumnParticipants>(`/api/autumn-light/cards/${id}/prayers?page=${page}`,{cache:"no-store",signal:controller.signal}).then(data=>{if(!controller.signal.aborted){setNames(previous=>page===0?data.names:[...previous,...data.names]);setMore(data.hasMore);setError("")}}).catch(()=>{if(!controller.signal.aborted)setError("명단을 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setBusy(false)});return()=>controller.abort()},[id,page]);
 return <dialog ref={ref} className="autumn-participants" onCancel={e=>{e.preventDefault();onClose()}} onClose={onClose}><header><h3>함께 기도한 분들</h3><button type="button" aria-label="명단 닫기" onClick={onClose}>×</button></header>
 {names.map((name,index)=><p key={index}>{name}</p>)}{!busy&&!names.length&&!error&&<p className="helper-text">아직 참여한 분이 없습니다.</p>}{error&&<p role="alert" className="error-text">{error}</p>}{busy&&<p role="status">불러오는 중…</p>}{more&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setBusy(true);setPage(v=>v+1)}}>더 보기</button>}
 </dialog>;
}
