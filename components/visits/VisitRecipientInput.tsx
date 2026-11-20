"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import { matchingPeople, type RecipientPerson } from "../../src/features/visits/schedule-range";
import "./schedule-fields.css";
export function VisitRecipientInput({onChange,disabled=false,initialName=""}:{onChange?:(value:{recipientRosterId?:string;recipientName:string})=>void;disabled?:boolean;initialName?:string}){
 const [people,setPeople]=useState<RecipientPerson[]>([]),[name,setName]=useState(initialName),[state,setState]=useState<"loading"|"ready"|"error">("loading");
 useEffect(()=>{const controller=new AbortController();void fetchJson<{people:RecipientPerson[]}>("/api/visits/people",{signal:controller.signal,cache:"no-store"}).then(body=>{setPeople(body.people);setState("ready");}).catch(()=>{if(!controller.signal.aborted)setState("error");});return()=>controller.abort();},[]);
 const matches=matchingPeople(people,name),person=matches.length===1?matches[0]:undefined;
 useEffect(()=>{onChange?.({recipientName:name,...(person?{recipientRosterId:person.id}:{})});},[name,person,onChange]);
 return <><label>심방 대상자 이름<input name="recipientName" required maxLength={120} value={name} disabled={disabled} onChange={event=>setName(event.target.value)} placeholder="심방받는 분의 이름"/></label>
 <div className="schedule-recipient-meta"><label>소속 샘<input aria-label="소속 샘" value={person?.sam??""} readOnly placeholder="이름 확인 후 자동 표시"/></label><label>샘리더<input aria-label="샘리더" value={person?.leaderName??""} readOnly placeholder="이름 확인 후 자동 표시"/></label></div>
 <p className="schedule-recipient-status" role="status">{state==="loading"?"명단 확인 중입니다.":state==="error"?"명단을 확인하지 못했습니다. 이름은 직접 기록할 수 있으나 샘 정보는 연결되지 않습니다.":!name.trim()?"이름을 입력하면 소속 샘과 샘리더가 자동 표시됩니다.":matches.length>1?"같은 이름이 여러 명입니다. 명단의 구분 문자를 포함해 이름을 입력해 주세요. 확인 전에는 샘을 임의로 연결하지 않습니다.":person?"명단에서 확인했습니다.": "명단에서 확인되지 않은 이름입니다. 샘 정보 없이 기록됩니다."}</p></>;
}
