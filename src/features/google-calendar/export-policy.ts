import { createHash } from "node:crypto";
import { shiftDate } from "../visits/schedule-range";

export type CalendarExportSource = {
  kind: "visit" | "ministry"; id: string; title: string; location: string;
  startDate: string; endDate: string; time: string; allDay: boolean;
  repeat?: "none" | "weekly"; repeatUntil?: string | null;
};
export const exportMarker = "samduk45-calendar-v1";
export const sourceKey = (source: Pick<CalendarExportSource,"kind"|"id">) => `${source.kind}:${source.id}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const exportEventId = (calendarId: string, source: Pick<CalendarExportSource,"kind"|"id">) => "s45" + hash(calendarId+":"+sourceKey(source));
export function exactTime(value: string): string | null {
  const clock=/^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if(clock){const h=Number(clock[1]),m=Number(clock[2]);return h<24&&m<60?`${String(h).padStart(2,"0")}:${clock[2]}`:null;}
  const korean=/^(오전|오후)\s*(\d{1,2})(?::(\d{2})|시(?:\s*(\d{1,2})분)?)?$/.exec(value.trim());
  if(!korean)return null;
  const hour=Number(korean[2]),minute=Number(korean[3]||korean[4]||0);
  if(hour<1||hour>12||minute>59)return null;
  return `${String(hour%12+(korean[1]==="오후"?12:0)).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
}
export function googleExportBody(source: CalendarExportSource) {
  const time=source.allDay?null:exactTime(source.time);
  const allDay=!time;
  const recurrence=source.repeat==="weekly"?["RRULE:FREQ=WEEKLY"+(source.repeatUntil?
    ";UNTIL="+(allDay?source.repeatUntil.replaceAll("-",""):
      new Date(source.repeatUntil+"T23:59:59+09:00").toISOString().replaceAll("-","").replaceAll(":","").replace(".000","")):"")]:undefined;
  const payload={
    summary:source.title,
    location:source.location,
    description:"삼덕사오에서 관리하는 일정입니다. 변경은 삼덕사오에서 해 주세요."+
      (!time&&source.time&&!source.allDay?"\n입력한 시간: "+source.time:"")+"\nhttps://samduk45.vercel.app/visits",
    start:time?{dateTime:source.startDate+"T"+time+":00+09:00",timeZone:"Asia/Seoul"}:{date:source.startDate},
    end:time?{dateTime:new Date(Date.parse(source.endDate+"T"+time+":00+09:00")+60*60*1000).toISOString(),timeZone:"Asia/Seoul"}:{date:shiftDate(source.endDate,1)},
    ...(recurrence?{recurrence}:{}),
  };
  return {...payload,extendedProperties:{private:{samduk45Export:exportMarker,samduk45Source:sourceKey(source),samduk45Hash:hash(JSON.stringify(payload))}}};
}
