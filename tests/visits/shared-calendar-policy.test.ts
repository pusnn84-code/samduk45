import { describe, expect, it } from "vitest";
import { displayTime, timeSortKey, entryTitle, expandMinistry, legacyRecipient, samSuffix } from "../../src/features/visits/shared-calendar-policy";
const series={id:"series",title:"목요전도대",startDate:"2026-11-05",endDate:null,time:"14:00",location:"교회",repeat:"weekly"};
describe("shared ministry calendar",()=>{
 it("keeps tentative weekly ministry occurrences waiting instead of marking them confirmed",()=>{
  const entries=expandMinistry([{...series,status:"requested"}],"2026-11");
  expect(entries).toHaveLength(4);expect(entries.every(entry=>entry.status==="requested")).toBe(true);
 });
 it("orders Korean preferred times with structured ministry times and formats 24-hour input",()=>{
  expect(["오후 4:00","14:00","오전 11시",""].sort((a,b)=>timeSortKey(a)-timeSortKey(b))).toEqual(["오전 11시","14:00","오후 4:00",""]);
  expect(displayTime("14:00")).toBe("오후 2:00");expect(displayTime("00:00")).toBe("오전 12:00");expect(displayTime("오후 3시 이후")).toBe("오후 3시 이후");
 });
 it("expands weekly Thursday events through a month and across year boundaries",()=>{
  expect(expandMinistry([series],"2026-11").map(x=>x.date)).toEqual(["2026-11-05","2026-11-12","2026-11-19","2026-11-26"]);
  expect(expandMinistry([series],"2027-01").map(x=>x.date)).toEqual(["2027-01-07","2027-01-14","2027-01-21","2027-01-28"]);
 });
 it("honors start and inclusive end dates without generating earlier occurrences",()=>{
  expect(expandMinistry([{...series,startDate:"2026-11-19",endDate:"2026-11-26"}],"2026-11").map(x=>x.date)).toEqual(["2026-11-19","2026-11-26"]);
  expect(expandMinistry([{...series,endDate:"2026-11-12"}],"2026-12")).toEqual([]);
 });
 it("does not repeat single appointments and keeps occurrence IDs stable",()=>{
  const entries=expandMinistry([{...series,repeat:"none"}],"2026-11");
  expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({id:"series:2026-11-05",seriesId:"series",status:"confirmed",title:"목요전도대",sam:null});
  expect(expandMinistry([{...series,repeat:"none"}],"2026-12")).toEqual([]);
 });
 it("shows the recipient instead of a registering pastor and only assigns uniquely known sams",()=>{
  const input={recipientName:null,recipientSam:null,attendees:"김믿음",requesterName:"최지웅",requesterRole:"admin",requesterSam:"5-1"};
  expect(legacyRecipient(input,[{name:"김믿음",sourceName:"김믿음",sam:"1-2"}])).toEqual({title:"김믿음",sam:"1-2샘"});
  expect(legacyRecipient(input,[{name:"김믿음",sourceName:"김믿음",sam:"1-2"},{name:"김믿음",sourceName:"김믿음",sam:"2-1"}]).sam).toBeNull();
  expect(legacyRecipient({...input,attendees:""},[])).toEqual({title:"심방 대상 미입력",sam:null});
 });
 it("retains explicit recipient snapshots, handles member self-requests and avoids fabricated sams",()=>{
  const input={recipientName:"박사랑",recipientSam:"2-3샘",attendees:"다른 참석자",requesterName:"최지웅",requesterRole:"admin",requesterSam:"5-1"};
  expect(entryTitle(legacyRecipient(input,[]))).toBe("박사랑(2-3샘)");
  expect(legacyRecipient({...input,recipientName:null,attendees:"",requesterName:"김믿음",requesterRole:"member",requesterSam:"1-2"},[])).toEqual({title:"김믿음",sam:"1-2샘"});
  expect(samSuffix("6-1")).toBeNull();expect(samSuffix(null)).toBeNull();
 });
});

it("anchors biweekly recurrence at the original start date and includes the final permitted occurrence",()=>{
 const biweekly={...series,repeat:"biweekly",endDate:"2026-12-17"};
 expect(expandMinistry([biweekly],"2026-11").map(e=>e.date)).toEqual(["2026-11-05","2026-11-19"]);
 expect(expandMinistry([biweekly],"2026-12").map(e=>e.date)).toEqual(["2026-12-03","2026-12-17"]);
 expect(expandMinistry([biweekly],"2027-01")).toEqual([]);
 expect(expandMinistry([{...biweekly,endDate:null}],"2027-01").map(e=>e.date)).toEqual(["2027-01-14","2027-01-28"]);
 expect(expandMinistry([biweekly],"2026-12")[0]).toMatchObject({repeat:"biweekly",repeatUntil:"2026-12-17"});
});
it("preserves full multi-day biweekly occurrences whose start is on the inclusive cutoff",()=>{
 expect(expandMinistry([{...series,repeat:"biweekly",startDate:"2026-11-26",eventEndDate:"2026-11-27",endDate:"2026-12-24"}],"2026-12").map(e=>e.date)).toEqual(["2026-12-10","2026-12-11","2026-12-24","2026-12-25"]);
});
