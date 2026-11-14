"use client";
import {useState,useRef,type FormEvent} from "react";
import {fetchJson} from "../../src/lib/fetch-json";
import type {AutumnCard,AutumnSam} from "../../src/features/autumn-light/types";

export function AutumnSamPicker({sams,village,samId,onVillage,onSam,disabled=false,includeAll=false,villageOnly=false}:{sams:AutumnSam[];village:string;samId:string;onVillage:(value:string)=>void;onSam:(value:string)=>void;disabled?:boolean;includeAll?:boolean;villageOnly?:boolean}){
 return <div className="autumn-sam-picker"><fieldset disabled={disabled}><legend>마을 선택</legend><div className="autumn-choices">{includeAll&&<button type="button" aria-pressed={!village} onClick={()=>onVillage("")}>전체</button>}{[1,2,3,4,5].map(n=><button key={n} type="button" aria-pressed={village===String(n)} onClick={()=>onVillage(String(n))}>{n}마을</button>)}</div></fieldset>
 {!villageOnly&&village&&<fieldset disabled={disabled}><legend>샘 선택</legend><div className="autumn-choices">{includeAll&&<button type="button" aria-pressed={!samId} onClick={()=>onSam("")}>전체 샘</button>}{sams.filter(sam=>String(sam.village)===village).map(sam=><button key={sam.id} type="button" aria-pressed={samId===sam.id} onClick={()=>onSam(sam.id)}>{sam.name}</button>)}</div></fieldset>}
 </div>;
}
export function AutumnRegistration({sams,authorName,onRegistered}:{sams:AutumnSam[];authorName:string;onRegistered:(card:AutumnCard)=>void}){
 const [name,setName]=useState(""),[prayer,setPrayer]=useState(""),[village,setVillage]=useState(""),[samId,setSamId]=useState(""),[allowDuplicate,setAllowDuplicate]=useState(false),[duplicate,setDuplicate]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const key=useRef<string>(""),writing=useRef(false);
 async function submit(event:FormEvent){
  event.preventDefault();if(writing.current||!samId||!name.trim()||!prayer.trim())return;
  writing.current=true;setBusy(true);setError("");if(!key.current)key.current=crypto.randomUUID();
  try{const result=await fetchJson<{card:AutumnCard}>("/api/autumn-light/cards",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name,samId,prayer,submissionKey:key.current,allowDuplicate})});key.current="";setName("");setPrayer("");setDuplicate(false);setAllowDuplicate(false);onRegistered(result.card);}
  catch(cause){if(cause instanceof Error&&cause.message==="AUTUMN_POSSIBLE_DUPLICATE"){setDuplicate(true);setError("이 샘에 같은 이름의 기도카드가 있습니다.")}else setError("등록 결과를 확인하지 못했습니다. 입력 내용은 보존했습니다. 다시 누르면 같은 등록으로 확인합니다.")}
  finally{writing.current=false;setBusy(false);}
 }
 return <form className="autumn-form card" onSubmit={submit}><h2>새 태신자 등록</h2><label>이름<input required maxLength={120} value={name} disabled={busy} onChange={e=>{setName(e.target.value);setDuplicate(false);setAllowDuplicate(false)}}/></label>
 <AutumnSamPicker sams={sams} village={village} samId={samId} disabled={busy} onVillage={v=>{setVillage(v);setSamId("");setDuplicate(false);setAllowDuplicate(false)}} onSam={v=>{setSamId(v);setDuplicate(false);setAllowDuplicate(false)}}/>
 <label>작성자<input value={authorName} readOnly/></label><label>기도제목<textarea required maxLength={10000} rows={7} value={prayer} disabled={busy} onChange={e=>setPrayer(e.target.value)}/></label>
 {duplicate&&<label className="autumn-checkbox"><input type="checkbox" checked={allowDuplicate} disabled={busy} onChange={e=>setAllowDuplicate(e.target.checked)}/>기존 카드와 다른 동명이인입니다.</label>}{error&&<p role="alert" className="error-text">{error}</p>}
 <button className="primary-button" disabled={busy||!samId||!name.trim()||!prayer.trim()||(duplicate&&!allowDuplicate)}>{busy?"등록 중…":"기도카드 등록"}</button></form>;
}
export function AutumnEditor({card,sams,isAdmin,onUpdated}:{card:AutumnCard;sams:AutumnSam[];isAdmin:boolean;onUpdated:(card:AutumnCard)=>void}){
 const [name,setName]=useState(card.name),[prayer,setPrayer]=useState(card.prayer),[village,setVillage]=useState(String(card.village)),[samId,setSamId]=useState(card.samId),[visited,setVisited]=useState(card.visited),[registered,setRegistered]=useState(card.registered),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const writing=useRef(false),version=useRef(card.version);
 async function save(event:FormEvent){event.preventDefault();if(writing.current)return;writing.current=true;setBusy(true);setError("");try{const result=await fetchJson<{card:AutumnCard}>(`/api/autumn-light/cards/${card.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({name,prayer,samId,expectedVersion:version.current,...(isAdmin?{visited,registered}:{})})});version.current=result.card.version;onUpdated(result.card);}catch(cause){setError(cause instanceof Error&&cause.message==="AUTUMN_CONFLICT"?"다른 변경이 먼저 저장되었습니다. 작성 내용을 복사한 뒤 닫고 다시 열어 주세요.":"변경 내용을 저장하지 못했습니다.")}finally{writing.current=false;setBusy(false)}}
 return <form className="autumn-form" onSubmit={save}><label>이름<input value={name} required maxLength={120} disabled={busy} onChange={e=>setName(e.target.value)}/></label><AutumnSamPicker sams={sams} village={village} samId={samId} disabled={busy} onVillage={v=>{setVillage(v);setSamId("")}} onSam={setSamId}/><label>기도제목<textarea required value={prayer} maxLength={10000} rows={8} disabled={busy} onChange={e=>setPrayer(e.target.value)}/></label>
 {isAdmin&&<fieldset className="autumn-status-editor" disabled={busy}><legend>2026년 가을빛축제 현황</legend><label className="autumn-checkbox"><input type="checkbox" checked={visited} onChange={e=>setVisited(e.target.checked)}/>초청일 방문</label><label className="autumn-checkbox"><input type="checkbox" checked={registered} onChange={e=>setRegistered(e.target.checked)}/>교회 등록</label></fieldset>}{error&&<p role="alert" className="error-text">{error}</p>}<button className="primary-button" disabled={busy||!samId||!name.trim()||!prayer.trim()}>{busy?"저장 중…":"저장"}</button></form>;
}
