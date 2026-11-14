"use client";
import type { ReportForm } from "../../src/features/pastoral/policy";
import { ReportMemberFields } from "./ReportMemberFields";
type Field<T> = { key: keyof T; label: string; max: number; multiline?: boolean; dateTime?: boolean };

function MeetingDateTime({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const parsed = /^(?:(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?|(\d{2}:\d{2}))$/.exec(value);
  if (value && !parsed) return <label>일시<input aria-label={`${label} 일시`} value={value} maxLength={100} onChange={event => onChange(event.target.value)} /></label>;
  const date = parsed?.[1] ?? "";
  const time = parsed?.[2] ?? parsed?.[3] ?? "";
  return <div className="pastoral-grid">
    <label>날짜<input type="date" aria-label={`${label} 날짜`} required={required} value={date} onChange={event => onChange([event.target.value, time].filter(Boolean).join(" "))} /></label>
    <label>시간<input type="time" aria-label={`${label} 시간`} required={required} value={time} onChange={event => onChange([date, event.target.value].filter(Boolean).join(" "))} /></label>
  </div>;
}

function FormRows<T extends object>({ title, rows, blank, fields, max, onChange }: { title: string; rows: T[]; blank: T; fields: Field<T>[]; max: number; onChange: (rows: T[]) => void }) {
  return <section className="pastoral-section"><div className="pastoral-toolbar"><h3>{title}</h3><button type="button" onClick={() => onChange([...rows, { ...blank }])} disabled={rows.length >= max}>{title} 행 추가</button></div>
    {rows.map((row, i) => <div className="pastoral-input-row" key={i}><div className="pastoral-row-label"><strong>{i + 1}행</strong><button type="button" onClick={() => onChange(rows.filter((_, index) => index !== i))} aria-label={`${title} ${i + 1}행 제거`}>행 제거</button></div>
      {fields.map(field => {
        const change = (value: string) => onChange(rows.map((r, j) => j === i ? { ...r, [field.key]: value } : r));
        const label = `${title} ${i + 1}행`;
        const value = String(row[field.key]);
        return field.dateTime ? <MeetingDateTime key={String(field.key)} label={label} value={value} onChange={change} />
          : <label key={String(field.key)}>{field.label}{field.multiline
            ? <textarea aria-label={`${label} ${field.label}`} value={value} rows={3} maxLength={field.max} onChange={e => change(e.target.value)} />
            : <input aria-label={`${label} ${field.label}`} value={value} maxLength={field.max} onChange={e => change(e.target.value)} />}
          </label>;
      })}
    </div>)}
  </section>;
}

export function ReportFormFields({form,samId,onChange,simple=false}:{form:ReportForm;samId:string;onChange:(form:ReportForm)=>void;simple?:boolean}) {
 const updateForm=(patch:Partial<ReportForm>)=>onChange({...form,...patch});
 const meeting=form.meetings[0]??{when:"",place:"",attendees:""};
 const updateMeeting=(patch:Partial<typeof meeting>)=>updateForm({meetings:[{...meeting,...patch}]});
 return <>
        {simple ? <section className="pastoral-section"><h3>샘모임</h3>
          <MeetingDateTime label="샘모임" value={meeting.when} required onChange={when=>updateMeeting({when})}/>
          <label>장소<input aria-label="샘모임 장소" required maxLength={300} value={meeting.place} onChange={event=>updateMeeting({place:event.target.value})}/></label>
          <label>참석자<textarea aria-label="샘모임 참석자" required rows={2} maxLength={1200} value={meeting.attendees} onChange={event=>updateMeeting({attendees:event.target.value})}/></label>
        </section> : <>
          <label className="pastoral-check"><input type="checkbox" checked={form.noMeeting} onChange={e => updateForm({ noMeeting: e.target.checked })} />이번 기간 샘모임 없음</label>
          {form.noMeeting && <label>샘모임을 하지 못한 이유<textarea aria-label="샘모임을 하지 못한 이유" value={form.noMeetingReason} onChange={e => updateForm({ noMeetingReason: e.target.value })} maxLength={2000} rows={3} required /></label>}
          {!form.noMeeting && <FormRows title="샘모임" rows={form.meetings} blank={{ when: "", place: "", attendees: "" }} fields={[{ key: "when", label: "일시", max: 100, dateTime: true }, { key: "place", label: "장소", max: 300 }, { key: "attendees", label: "참석자(가정)", max: 1200, multiline: true }]} max={12} onChange={meetings => updateForm({ meetings })} />}
        </>}
        <ReportMemberFields key={samId} samId={samId} notes={form.memberNotes ?? []} allowDirectInput={!simple} onChange={memberNotes => updateForm({ memberNotes })} />
        {!simple && <details className="pastoral-section" open={[...form.sharing, ...form.news].some(row => row.member || row.content) || undefined}>
        <summary>샘원 기록 직접 입력</summary>
        <FormRows title="나눔/기도제목" rows={form.sharing} blank={{ member: "", content: "" }} fields={[{ key: "member", label: "샘원", max: 100 }, { key: "content", label: "나눔 / 기도제목 (예배·성경통독은혜·기도제목)", max: 2000, multiline: true }]} max={40} onChange={sharing => updateForm({ sharing })} />
        <FormRows title="샘소식" rows={form.news} blank={{ member: "", content: "" }} fields={[{ key: "member", label: "샘원", max: 100 }, { key: "content", label: "소식 (결혼, 장례, 이사, 입원 등)", max: 2000, multiline: true }]} max={30} onChange={news => updateForm({ news })} />
        </details>}
        <label className="pastoral-section">샘리더 기도제목<textarea aria-label="샘리더 기도제목" rows={5} value={form.leaderPrayer} maxLength={5000} onChange={e => updateForm({ leaderPrayer: e.target.value })} /></label>
        <label className="pastoral-section">기타<textarea aria-label="기타" rows={5} value={form.other ?? ""} maxLength={5000} onChange={e => updateForm({ other: e.target.value })} /></label>
 </>;
}
