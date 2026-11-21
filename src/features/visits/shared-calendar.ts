import {and,asc,eq,gte,lt,or,isNull,sql} from "drizzle-orm";
import {z} from "zod";
import {getDb} from "../../db/client";
import {memberRoster,ministrySchedules,sams,users,visitRequests} from "../../db/schema";
import {DomainError} from "../../lib/http";
import {expandMinistry,legacyRecipient,samSuffix,timeSortKey,type CalendarEntry} from "./shared-calendar-policy";
import {dateDistance,monthDates,validDate} from "./schedule-range";
import {canEditVisit,type VisitEditor} from "./edit-policy";
export const CalendarMonth=z.string().regex(/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/);
export const MinistryInput=z.object({
 status:z.enum(["requested","confirmed"]).optional(),
 title:z.string().trim().min(1).max(120),startDate:z.iso.date(),endDate:z.iso.date().nullable().default(null),
 eventEndDate:z.iso.date().nullable().optional(),allDay:z.boolean().optional(),time:z.string().max(5).default(""),
 location:z.string().trim().max(500).default(""),repeat:z.enum(["none","weekly"]).default("none")
}).strict().refine(x=>!x.endDate||x.endDate>=x.startDate)
 .refine(x=>!x.eventEndDate||(validDate(x.eventEndDate)&&dateDistance(x.startDate,x.eventEndDate)>=0&&dateDistance(x.startDate,x.eventEndDate)<=365))
 .refine(x=>x.repeat!=="weekly"||dateDistance(x.startDate,x.eventEndDate??x.startDate)<7)
 .refine(x=>x.allDay||/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time));
const samJoin=and(eq(sams.isActive,true),sql`replace(replace(${sams.name},'샘',''),' ','')=replace(replace(${memberRoster.samLabel},'샘',''),' ','')`);
const identity=(row:{name:string;sam:string|null;leaderName?:string|null})=>({
 recipientName:row.name,recipientSam:samSuffix(row.sam),...(row.leaderName?{recipientLeaderName:row.leaderName}:{})
});
export async function calendarPeople(){
 const rows=await getDb().select({id:memberRoster.id,name:memberRoster.canonicalName,sourceName:memberRoster.sourceName,sam:memberRoster.samLabel,leaderName:sams.leaderName})
 .from(memberRoster).leftJoin(sams,samJoin).where(eq(memberRoster.isActive,true)).orderBy(asc(memberRoster.canonicalName));
 return rows.map(row=>({...row,sam:samSuffix(row.sam)}));
}
export async function recipientForVisit(user:{id:string;role:string;displayName:string},input:{recipientRosterId?:string;recipientName?:string;attendees:string}){
 if(user.role!=="admin"){
  const [row]=await getDb().select({name:memberRoster.canonicalName,sam:memberRoster.samLabel,leaderName:sams.leaderName})
   .from(users).leftJoin(memberRoster,eq(memberRoster.id,users.rosterId)).leftJoin(sams,samJoin).where(eq(users.id,user.id));
  return identity({name:row?.name||user.displayName,sam:row?.sam??null,leaderName:row?.leaderName});
 }
 if(input.recipientRosterId){
  const [row]=await getDb().select({name:memberRoster.canonicalName,sam:memberRoster.samLabel,leaderName:sams.leaderName})
   .from(memberRoster).leftJoin(sams,samJoin).where(and(eq(memberRoster.id,input.recipientRosterId),eq(memberRoster.isActive,true)));
  if(!row)throw new DomainError("INVALID_VISIT_RECIPIENT",400);return identity(row);
 }
 const name=input.recipientName?.trim()||input.attendees.trim();
 if(!name||name.length>120)throw new DomainError("INVALID_VISIT_RECIPIENT",400);
 const matches=await getDb().select({name:memberRoster.canonicalName,sam:memberRoster.samLabel,leaderName:sams.leaderName})
  .from(memberRoster).leftJoin(sams,samJoin).where(and(eq(memberRoster.isActive,true),or(eq(memberRoster.canonicalName,name),eq(memberRoster.sourceName,name)))).limit(2);
 return matches.length===1?identity({...matches[0],name}):{recipientName:name,recipientSam:null};
}
export async function sharedMonth(month:string,viewer?:VisitEditor):Promise<CalendarEntry[]>{
 if(!CalendarMonth.safeParse(month).success)throw new DomainError("INVALID_VISIT_MONTH",400);
 const start=month+"-01",[year,number]=month.split("-").map(Number),end=new Date(Date.UTC(year,number,1)).toISOString().slice(0,10);
 const [visits,series,people]=await Promise.all([
  getDb().select({id:visitRequests.id,requesterUserId:visitRequests.requesterUserId,date:visitRequests.visitDate,endDate:visitRequests.endDate,allDay:visitRequests.allDay,
   recipientName:visitRequests.recipientName,recipientSam:visitRequests.recipientSam,attendees:visitRequests.attendees,time:visitRequests.preferredTime,
   location:visitRequests.location,status:visitRequests.status,isUnavailable:visitRequests.isUnavailable,
   requesterName:users.displayName,requesterRole:users.role,requesterSam:memberRoster.samLabel})
   .from(visitRequests).innerJoin(users,eq(users.id,visitRequests.requesterUserId)).leftJoin(memberRoster,eq(memberRoster.id,users.rosterId))
   .where(and(lt(visitRequests.visitDate,end),gte(sql<string>`coalesce(${visitRequests.endDate},${visitRequests.visitDate})`,start),or(sql`${visitRequests.status}<>'cancelled'`,eq(visitRequests.isUnavailable,true)))),
  getDb().select().from(ministrySchedules).where(and(eq(ministrySchedules.isActive,true),lt(ministrySchedules.startDate,end),
   or(and(eq(ministrySchedules.repeat,"none"),gte(sql<string>`coalesce(${ministrySchedules.eventEndDate},${ministrySchedules.startDate})`,start)),
      and(eq(ministrySchedules.repeat,"weekly"),or(isNull(ministrySchedules.endDate),gte(sql<string>`${ministrySchedules.endDate}+coalesce(${ministrySchedules.eventEndDate}-${ministrySchedules.startDate},0)`,start)))))),
  calendarPeople()
 ]);
 const entries:CalendarEntry[]=visits.flatMap(row=>monthDates(row.date,row.endDate??row.date,month).map(date=>({
  id:row.id,date,startDate:row.date,endDate:row.endDate??row.date,...legacyRecipient(row,people),
  time:row.allDay?"":row.time,...(row.allDay?{allDay:true}:{}),location:row.location,kind:"visit" as const,
  ...(viewer?{canEdit:canEditVisit(viewer,row)}:{}),
  status:row.isUnavailable?"unavailable" as const:row.status==="completed"?"completed" as const:row.status==="confirmed"?"confirmed" as const:"requested" as const
 })));
 return [...entries,...expandMinistry(series,month)].sort((a,b)=>a.date.localeCompare(b.date)||Number(Boolean(b.allDay))-Number(Boolean(a.allDay))||timeSortKey(a.time)-timeSortKey(b.time)||a.title.localeCompare(b.title,"ko"));
}
export async function createMinistry(ownerUserId:string,input:z.infer<typeof MinistryInput>){
 const [row]=await getDb().insert(ministrySchedules).values({...input,time:input.allDay?"":input.time,ownerUserId}).returning({id:ministrySchedules.id});return row;
}
export async function declineVisit(id:string){
 const rows=await getDb().update(visitRequests).set({status:"cancelled",isUnavailable:true,updatedAt:new Date()})
  .where(and(eq(visitRequests.id,id),eq(visitRequests.status,"requested"))).returning({id:visitRequests.id});
 if(!rows.length)throw new DomainError("INVALID_VISIT_STATUS_TRANSITION",409);
}
