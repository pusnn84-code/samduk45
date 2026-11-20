export type CalendarEntry = {
  id: string; seriesId?: string; date: string; title: string; sam: string | null;
  time: string; location: string; kind: "visit" | "ministry";
  status: "confirmed" | "requested" | "unavailable" | "completed";
  repeat?: "none" | "weekly";
  allDay?: boolean; startDate?: string; endDate?: string;
};
export type MinistrySeries = {
  id: string; title: string; startDate: string; endDate: string | null;
  time: string; location: string; repeat: string;
  eventEndDate?: string | null; allDay?: boolean;
};
export function samSuffix(value: string | null | undefined): string | null {
  const match = /^([1-5])-([1-9]\d*)(?:샘)?$/.exec((value ?? "").replace(/\s/g, ""));
  return match ? `${match[1]}-${match[2]}샘` : null;
}
export function entryTitle(entry: Pick<CalendarEntry, "title" | "sam">) {
  const sam = samSuffix(entry.sam);
  return entry.title + (sam ? `(${sam})` : "");
}
export function expandMinistry(series: MinistrySeries[], month: string): CalendarEntry[] {
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return series.flatMap(item => {
    const duration=Math.max(0,dateDistance(item.startDate,item.eventEndDate??item.startDate));
    const entries: CalendarEntry[] = [];
    for (let day = 1; day <= days; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      if(date<item.startDate)continue;
      const elapsed=dateDistance(item.startDate,date);
      const offset=item.repeat==='weekly'?Math.floor(elapsed/7)*7:0;
      const occurrence=shiftDate(item.startDate,offset),last=shiftDate(occurrence,duration);
      if(date>last||(item.repeat==='weekly'&&item.endDate&&occurrence>item.endDate))continue;
      entries.push({ id: `${item.id}:${date}`, seriesId: item.id, date, title: item.title,
        sam: null, time: item.allDay?'':item.time, location: item.location, kind: "ministry", status: "confirmed",
        startDate:occurrence,endDate:last,...(item.allDay?{allDay:true}:{}),
        repeat: item.repeat === "weekly" ? "weekly" : "none" });
    }
    return entries;
  });
}
export function legacyRecipient(input: { recipientName: string | null; recipientSam: string | null;
  attendees: string; requesterName: string; requesterRole: string; requesterSam: string | null }, people: { name: string; sourceName: string; sam: string | null }[]) {
  if (input.recipientName) return { title: input.recipientName, sam: samSuffix(input.recipientSam) };
  const title = input.requesterRole === "admin" ? input.attendees.trim() || "심방 대상 미입력" : input.requesterName;
  const matches = people.filter(person => person.name === title || person.sourceName === title);
  // Never guess a sam for ambiguous names, or attach the registering pastor's sam.
  const sam = matches.length === 1 ? matches[0].sam : input.requesterRole !== "admin" ? input.requesterSam : null;
  return { title, sam: samSuffix(sam) };
}
export function displayTime(value: string,allDay=false) {
  if(allDay)return '종일';
  const match=/^(\d{2}):(\d{2})$/.exec(value);
  if(!match)return value || "시간 미정";
  const hour=Number(match[1]);
  return `${hour<12?"오전":"오후"} ${hour%12||12}:${match[2]}`;
}
export function timeSortKey(value: string) {
  const match=/(오전|오후)?\s*(\d{1,2})(?::(\d{2})|시)?/.exec(value);
  if(!match)return 24*60;
  let hour=Number(match[2]);
  if(match[1])hour=hour%12+(match[1]==="오후"?12:0);
  return hour*60+Number(match[3]||0);
}
import {dateDistance,shiftDate} from './schedule-range';
