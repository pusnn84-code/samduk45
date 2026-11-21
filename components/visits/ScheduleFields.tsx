"use client";
import './schedule-fields.css';
export function ScheduleStatus({value,onChange,disabled=false}:{value:"requested"|"confirmed";onChange:(value:"requested"|"confirmed")=>void;disabled?:boolean}){
 return <fieldset className="schedule-status"><legend>일정 상태</legend><div>{([['requested','대기'],['confirmed','확정']] as const).map(([status,label])=><label key={status} className={value===status?'is-selected':''}><input type="radio" name="scheduleStatus" value={status} checked={value===status} disabled={disabled} onChange={()=>onChange(status)}/><span className={`visit-status-dot is-${status}`} aria-hidden="true"/>{label}</label>)}</div></fieldset>;
}
export function ScheduleDates({start,end,onStart,onEnd,disabled=false}:{start:string;end:string;onStart:(value:string)=>void;onEnd:(value:string)=>void;disabled?:boolean}){
 return <div className="schedule-date-pair"><label>시작일<input aria-label="시작일" type="date" required value={start} disabled={disabled} onChange={event=>{const value=event.target.value;onStart(value);if(end===start||end<value)onEnd(value);}}/></label><label>종료일<input aria-label="종료일" type="date" required min={start} value={end} disabled={disabled} onChange={event=>onEnd(event.target.value)}/></label></div>;
}
export function ScheduleTime({value,onChange,allDay,onAllDay,disabled=false,type='text',required=false,label='시간',name}:{value:string;onChange:(value:string)=>void;allDay:boolean;onAllDay:(value:boolean)=>void;disabled?:boolean;type?:'text'|'time';required?:boolean;label?:string;name?:string}){
 return <div className="schedule-time-field"><div className="schedule-time-heading"><span>{label}</span><label className="schedule-all-day"><input type="checkbox" checked={allDay} disabled={disabled} onChange={event=>onAllDay(event.target.checked)}/>종일</label></div><input aria-label={label} name={name} type={allDay?'text':type} value={allDay?'종일 일정':value} required={required&&!allDay} disabled={disabled||allDay} maxLength={200} onChange={event=>onChange(event.target.value)} placeholder={type==='text'?'예: 오후 3시 이후':undefined}/></div>;
}
