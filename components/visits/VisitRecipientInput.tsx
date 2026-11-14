"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
type Person={id:string;name:string;sam:string|null};
export function VisitRecipientInput({onChange,disabled=false}:{onChange?:(value:{recipientRosterId?:string;recipientName:string})=>void;disabled?:boolean}) {
 const [people,setPeople]=useState<Person[]>([]);const [personId,setPersonId]=useState("");const [name,setName]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();void fetchJson<{people:Person[]}>("/api/visits/people",{signal:controller.signal,cache:"no-store"})
 .then(body=>setPeople(body.people)).catch(()=>{if(!controller.signal.aborted)setError("명단을 불러오지 못했습니다. 대상자 이름을 직접 입력해 주세요.");});return()=>controller.abort();},[]);
 return <>
  <label>심방 대상자<select name="recipientRosterId" value={personId} disabled={disabled} onChange={event=>{const id=event.target.value;const person=people.find(item=>item.id===id);setPersonId(id);setName(person?.name||"");onChange?.({recipientRosterId:id||undefined,recipientName:person?.name||""});}}>
   <option value="">이름 직접 입력</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}{person.sam?`(${person.sam})`:""}</option>)}
  </select></label>
  {!personId&&<label>대상자 이름<input name="recipientName" required maxLength={120} value={name} disabled={disabled} onChange={event=>{setName(event.target.value);onChange?.({recipientName:event.target.value});}} placeholder="심방받는 분의 이름"/></label>}
  {error&&<p role="status" className="helper-text">{error}</p>}
 </>;
}
