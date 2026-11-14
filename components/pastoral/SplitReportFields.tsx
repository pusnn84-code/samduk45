"use client";
import { useEffect, useRef, useState } from "react";
import type { MemberNote, ReportForm, ReportKind } from "../../src/features/pastoral/policy";
import { api } from "./client";

export type SamPerson = Pick<MemberNote, "rosterId" | "member">;
export function useSamPeople(samId: string) {
  const [people, setPeople] = useState<SamPerson[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!samId) return;
    const controller = new AbortController();
    void api<{members: SamPerson[]}>(`/api/pastoral/sams/${encodeURIComponent(samId)}/members`, {cache:"no-store", signal:controller.signal})
      .then(value => {if (!controller.signal.aborted) {setPeople(value.members);setError(false);}})
      .catch(() => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, [samId, attempt]);
  return { people, error, retry: () => {setError(false);setAttempt(n => n + 1);} };
}

function NamePicker({people, selected, multiple, onSelect, onClose}: {
  people: SamPerson[]; selected: string[]; multiple: boolean; onSelect: (ids: string[]) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(selected);
  useEffect(() => {if (!dialog.current?.open) dialog.current?.showModal();}, []);
  return <dialog ref={dialog} className="card pastoral-name-dialog" aria-labelledby="pastoral-picker-title" onCancel={event => {event.preventDefault();onClose();}}>
    <header><h3 id="pastoral-picker-title">{multiple ? "참석자 선택" : "기록할 샘원 선택"}</h3><button type="button" onClick={onClose} aria-label="이름 선택 닫기">×</button></header>
    <input type="search" aria-label="샘원 이름 검색" placeholder="이름 검색" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {if(event.key === "Enter")event.preventDefault();}} />
    <div className="pastoral-name-list">{people.filter(person => person.member.replace(/\s/g, "").includes(query.replace(/\s/g, ""))).map(person => <button key={person.rosterId} type="button" aria-pressed={draft.includes(person.rosterId)} onClick={() => {
      if (!multiple) {onSelect([person.rosterId]);onClose();return;}
      setDraft(current => current.includes(person.rosterId) ? current.filter(id => id !== person.rosterId) : [...current, person.rosterId]);
    }}>{person.member}</button>)}</div>
    {multiple && <footer><p>{draft.length}명 선택</p><button type="button" className="primary-button" onClick={() => {onSelect(draft);onClose();}}>선택 완료</button></footer>}
  </dialog>;
}

export function emptySplitForm(kind: ReportKind): ReportForm {
  return {entryKind:kind,noMeeting:false,noMeetingReason:"",meetings:kind === "meeting" ? [{when:"",place:"",attendees:""}] : [],sharing:[],news:[],memberNotes:[],leaderPrayer:"",other:"",...(kind === "meeting" ? {attendeeIds:[]} : {})};
}

export function SplitReportFields({form, onChange, people, error, retry, savedMember}: {
  form: ReportForm; onChange: (value: ReportForm) => void; people: SamPerson[] | null; error: boolean; retry: () => void; savedMember?: {id:string; version:number};
}) {
  const [picker, setPicker] = useState(false);
  const [draftNotes, setDraftNotes] = useState(() => new Map<string, MemberNote>());
  const savedKey = savedMember ? `${savedMember.id}:${savedMember.version}` : "";
  const [lastSavedKey, setLastSavedKey] = useState(savedKey);
  if (savedKey !== lastSavedKey) {
    setLastSavedKey(savedKey);
    if (savedMember) setDraftNotes(notes => {
      const next = new Map(notes);
      next.delete(savedMember.id);
      return next;
    });
  }
  const current = form.memberNotes?.[0];
  const kind = form.entryKind;
  const meeting = form.meetings[0] ?? {when:"",place:"",attendees:""};
  const updateMeeting = (patch: Partial<typeof meeting>) => onChange({...form, meetings:[{...meeting,...patch}]});
  const canPick = people !== null && !error;
  function updateNote(key: "sharing" | "prayer" | "news", value: string) {
    if (!current) return;
    const note = {...current, [key]: value};
    setDraftNotes(notes => new Map(notes).set(note.rosterId, note));
    onChange({...form, memberNotes: [note]});
  }
  return <section className="pastoral-split-fields">
    {error ? <p role="alert">샘 명단을 불러오지 못했습니다. <button type="button" onClick={retry}>다시 불러오기</button></p> : people === null ? <p role="status">샘 명단을 불러오는 중입니다.</p> : !people.length && <p>등록된 샘원이 없습니다. 관리자에게 확인해 주세요.</p>}
    {kind === "meeting" ? <>
      <div className="pastoral-grid"><label>날짜<input required aria-label="샘모임 날짜" type="date" value={meeting.when.split(" ")[0] || ""} onChange={event => updateMeeting({when:[event.target.value,meeting.when.split(" ")[1] || ""].join(" ")})}/></label><label>시간<input required aria-label="샘모임 시간" type="time" value={meeting.when.split(" ")[1] || ""} onChange={event => updateMeeting({when:[meeting.when.split(" ")[0],event.target.value].join(" ")})}/></label></div>
      <label>장소<input required aria-label="샘모임 장소" maxLength={300} value={meeting.place} onChange={event => updateMeeting({place:event.target.value})}/></label>
      <div><p className="pastoral-field-label">참석자</p><button type="button" className="pastoral-name-trigger" aria-label="샘모임 참석자" disabled={!canPick} onClick={() => setPicker(true)}>이름 선택 · {form.attendeeIds?.length ?? 0}명 <span aria-hidden="true">⌄</span></button>
      <div className="pastoral-name-chips">{(form.attendeeIds ?? []).map(id => <span key={id}>{people?.find(person => person.rosterId === id)?.member ?? "기존 참석자"}</span>)}</div></div>
    </> : <>
      <div><p className="pastoral-field-label">기록할 샘원</p><button type="button" className="pastoral-name-trigger" disabled={!canPick} onClick={() => setPicker(true)}>{current?.member || "이름을 선택하세요"}<span aria-hidden="true">⌄</span></button></div>
      {current && ([['sharing','나눔'],['prayer','기도제목'],['news','소식']] as const).map(([key,label]) => <label key={key}>{label}<textarea aria-label={`${current.member} ${label}`} rows={3} maxLength={2000} value={current[key]} onChange={event => updateNote(key, event.target.value)}/></label>)}
    </>}
    {picker && people && <NamePicker people={people} multiple={kind === "meeting"} selected={kind === "meeting" ? form.attendeeIds ?? [] : current ? [current.rosterId] : []} onClose={() => setPicker(false)} onSelect={ids => {
      if (kind === "meeting") {onChange({...form,attendeeIds:ids,meetings:[{...meeting,attendees:ids.map(id => people.find(person => person.rosterId === id)!.member).join(", ")}]});return;}
      if (current) setDraftNotes(notes => new Map(notes).set(current.rosterId,current));
      const person=people.find(person => person.rosterId === ids[0]);
      if (person) onChange({...form,memberNotes:[draftNotes.get(person.rosterId) ?? {...person,sharing:"",prayer:"",news:""}]});
    }}/>}
  </section>;
}

export function EditSplitReportFields({samId,form,onChange}:{samId:string;form:ReportForm;onChange:(form:ReportForm)=>void}) {
  const data=useSamPeople(samId);
  return <SplitReportFields form={form} onChange={onChange} {...data}/>;
}
