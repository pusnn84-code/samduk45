"use client";
import { useId, useRef, useState } from "react";
import { parseMemberSubmission, type MemberSubmission, type ReportKind, type SamTarget } from "../../src/features/pastoral/policy";
import { api, jsonBody, message } from "./client";
import { emptySplitForm, SplitReportFields, useSamPeople } from "./SplitReportFields";

type Props = { sam: SamTarget; authorName: string; onSubmitted: (id:string, kind:ReportKind) => void; preview?:boolean };
function EntryForm({sam,authorName,onSubmitted,preview=false,kind,data}: Props & {kind:ReportKind;data:ReturnType<typeof useSamPeople>}) {
  const [form,setForm]=useState(() => emptySplitForm(kind));
  const [busy,setBusy]=useState(false);const [locked,setLocked]=useState(false);const [error,setError]=useState("");
  const [savedMember,setSavedMember]=useState<{id:string;version:number}>();
  const pending=useRef<MemberSubmission|null>(null);
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(preview||busy)return;setBusy(true);setError("");
    try {
      if(!pending.current){pending.current=parseMemberSubmission({id:crypto.randomUUID(),form});setLocked(true);}
      const result=await api<{id:string;submitted:boolean}>("/api/pastoral/submit",jsonBody("POST",pending.current));
      const memberId=pending.current.form.memberNotes?.[0]?.rosterId;
      if(memberId)setSavedMember(old=>({id:memberId,version:(old?.version??0)+1}));
      pending.current=null;setLocked(false);setForm(emptySplitForm(kind));
      window.dispatchEvent(new Event("pastoral:changed"));onSubmitted(result.id,kind);
    } catch(cause) {
      if(cause instanceof Error&&["INVALID_INPUT","INVALID_DATE","INVALID_MEETING_DATE","MEETING_DETAILS_REQUIRED","SINGLE_MEETING_REQUIRED","MEMBER_NOT_IN_SAM","REPORT_TOO_LONG","FORBIDDEN","SAM_BINDING_AMBIGUOUS","MEMBER_NOTE_REQUIRED","ATTENDEES_REQUIRED"].includes(cause.message)){pending.current=null;setLocked(false);}
      setError(message(cause));
    } finally {setBusy(false);}
  }
  return <form className="pastoral-entry card" onSubmit={submit}>
    <h2>{kind === "meeting" ? "샘모임 기록" : "샘원별 나눔 · 소식"}</h2>
    <dl className="pastoral-meta"><div><dt>담당 샘</dt><dd>{sam.name}샘</dd></div><div><dt>작성자</dt><dd>{authorName}</dd></div></dl>
    <fieldset disabled={busy||locked}><legend>{kind === "meeting" ? "날짜·시간·장소·참석자" : "나눔·기도제목·소식"}</legend>
      <SplitReportFields form={form} onChange={setForm} {...data} savedMember={savedMember}/>
    </fieldset>
    {error&&<p role="alert" className="error-text">{error}</p>}
    {locked&&!busy&&<p className="helper-text">제출 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도하면 중복 제출 없이 결과를 확인합니다.</p>}
    <button type="submit" className="primary-button" disabled={busy||preview||!data.people?.length}>{preview?"미리보기 · 제출되지 않습니다":busy?"제출 중…":locked?"같은 내용으로 다시 시도":kind === "meeting"?"샘모임 제출":"나눔·소식 제출"}</button>
  </form>;
}

export function ReportEntry(props:Props) {
  const [kind,setKind]=useState<ReportKind>("meeting");const prefix=useId();
  const data=useSamPeople(props.sam.id);
  return <>
    <div className="pastoral-entry-tabs" role="tablist" aria-label="목양지 작성 종류">{([['meeting','샘모임'],['member','샘원 나눔·소식']] as const).map(([value,label])=><button key={value} id={`${prefix}-${value}-tab`} type="button" role="tab" aria-selected={kind===value} aria-controls={`${prefix}-${value}-panel`} onClick={()=>setKind(value)}>{label}</button>)}</div>
    {(['meeting','member'] as const).map(value=><div key={value} id={`${prefix}-${value}-panel`} role="tabpanel" aria-labelledby={`${prefix}-${value}-tab`} hidden={kind!==value}><EntryForm {...props} kind={value} data={data}/></div>)}
  </>;
}
