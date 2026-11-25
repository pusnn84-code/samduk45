import { and, asc, eq, inArray } from "drizzle-orm";
import type { calendar_v3 } from "googleapis";
import { getDb } from "../../db/client";
import { ministrySchedules, memberRoster, users, visitRequests } from "../../db/schema";
import { DomainError } from "../../lib/http";
import { legacyRecipient, samSuffix } from "../visits/shared-calendar-policy";
import { calendarPeople } from "../visits/shared-calendar";
import { getAuthorizedGoogleCalendarContext } from "./client";
import { getGoogleCalendarConnection } from "./repository";
import { exportEventId, exportMarker, googleExportBody, sourceKey, type CalendarExportSource } from "./export-policy";

export async function exportSources():Promise<CalendarExportSource[]> {
  const [visits,ministries,people]=await Promise.all([
    getDb().select({id:visitRequests.id,date:visitRequests.visitDate,end:visitRequests.endDate,allDay:visitRequests.allDay,
      recipientName:visitRequests.recipientName,recipientSam:visitRequests.recipientSam,attendees:visitRequests.attendees,
      requesterName:users.displayName,requesterRole:users.role,requesterSam:memberRoster.samLabel,
      time:visitRequests.preferredTime,location:visitRequests.location})
      .from(visitRequests).innerJoin(users,eq(users.id,visitRequests.requesterUserId)).leftJoin(memberRoster,eq(memberRoster.id,users.rosterId))
      .where(and(inArray(visitRequests.status,["confirmed","completed"]),eq(visitRequests.isUnavailable,false))).orderBy(asc(visitRequests.id)),
    getDb().select().from(ministrySchedules).where(and(eq(ministrySchedules.isActive,true),eq(ministrySchedules.status,"confirmed"))).orderBy(asc(ministrySchedules.id)),
    calendarPeople(),
  ]);
  return [
    ...visits.map(row=>{const recipient=legacyRecipient(row,people);return {kind:"visit" as const,id:row.id,
      title:"심방 · "+recipient.title+(samSuffix(recipient.sam)?`(${samSuffix(recipient.sam)})`:""),
      location:row.location,startDate:row.date,endDate:row.end??row.date,time:row.time,allDay:row.allDay};}),
    ...ministries.map(row=>({kind:"ministry" as const,id:row.id,title:row.title,location:row.location,
      startDate:row.startDate,endDate:row.eventEndDate??row.startDate,time:row.time,allDay:row.allDay,
      repeat:row.repeat as "none"|"weekly"|"biweekly",repeatUntil:row.endDate})),
  ];
}
export type ExportCalendar = Pick<calendar_v3.Calendar,"events">;
function code(error:unknown){if(!error||typeof error!=="object")return 0;const value=error as {code?:unknown;response?:{status?:unknown}};return Number(value.response?.status??value.code)||0;}
export async function reconcileExports(calendar:ExportCalendar, calendarId:string,sources:CalendarExportSource[],stillConnected:()=>Promise<boolean>=async()=>true,sourceActive:(key:string)=>Promise<boolean>=async()=>true) {
  const options={timeout:5000,retry:false}, existing=new Map<string,calendar_v3.Schema$Event>();
  let pageToken:string|undefined;
  do {
    const response=await calendar.events.list({calendarId,privateExtendedProperty:["samduk45Export="+exportMarker],singleEvents:false,showDeleted:false,maxResults:2500,pageToken},options);
    for(const event of response.data.items??[])if(event.id)existing.set(event.id,event);
    pageToken=response.data.nextPageToken??undefined;
  } while(pageToken);
  const result={created:0,updated:0,removed:0,unchanged:0};
  for(const source of sources){
    if(!await stillConnected())throw new DomainError("CALENDAR_CONNECTION_CHANGED",409);
    const eventId=exportEventId(calendarId,source),body=googleExportBody(source),prior=existing.get(eventId);
    if(prior&&prior.extendedProperties?.private?.samduk45Hash===body.extendedProperties.private.samduk45Hash){result.unchanged++;existing.delete(eventId);continue;}
    if(prior){
      await calendar.events.update({calendarId,eventId,sendUpdates:"none",requestBody:body},{...options,headers:prior.etag?{"If-Match":prior.etag}:{}});result.updated++;
    }else{
      try{await calendar.events.insert({calendarId,sendUpdates:"none",requestBody:{id:eventId,...body}},options);result.created++;}
      catch(error){
        if(code(error)!==409)throw error;
        const current=await calendar.events.get({calendarId,eventId},options);
        // A concurrent export may already have inserted the same deterministic ID.
        if(current.data.extendedProperties?.private?.samduk45Export!==exportMarker||current.data.extendedProperties?.private?.samduk45Source!==sourceKey(source))throw new DomainError("CALENDAR_EVENT_CONFLICT",409);
        if(current.data.extendedProperties?.private?.samduk45Hash===body.extendedProperties.private.samduk45Hash)result.unchanged++;
        else { await calendar.events.update({calendarId,eventId,sendUpdates:"none",requestBody:body},{...options,headers:current.data.etag?{"If-Match":current.data.etag}:{}});result.updated++; }
      }
    }
    existing.delete(eventId);
  }
  for(const [eventId,event] of existing){
    // Never touch personal events, untagged events, guests or other applications.
    const key=event.extendedProperties?.private?.samduk45Source;
    const identity=key?/^(visit|ministry):([0-9a-f-]{36})$/i.exec(key):null;
    if(!identity||eventId!==exportEventId(calendarId,{kind:identity[1] as "visit"|"ministry",id:identity[2]}))continue;
    if(event.extendedProperties?.private?.samduk45Export!==exportMarker||!key||!await stillConnected()||await sourceActive(key))continue;
    try{await calendar.events.delete({calendarId,eventId,sendUpdates:"none"},{...options,headers:event.etag?{"If-Match":event.etag}:{}});result.removed++;}
    catch(error){if(code(error)!==410)throw error;}
  }
  return result;
}
export async function syncCalendarExports(){
  const {connection,calendar}=await getAuthorizedGoogleCalendarContext();
  if(!connection.selectedCalendarId)throw new DomainError("CALENDAR_NOT_SELECTED",409);
  // Obtain the complete source snapshot successfully before considering deletions.
  const sources=await exportSources();
  return reconcileExports(calendar,connection.selectedCalendarId,sources,async()=>{
    const current=await getGoogleCalendarConnection();return current?.id===connection.id&&current.refreshTokenCiphertext===connection.refreshTokenCiphertext&&current.selectedCalendarId===connection.selectedCalendarId;
  },async key=>{
    const match=/^(visit|ministry):([0-9a-f-]{36})$/i.exec(key);if(!match)return true;
    if(match[1]==="visit"){
      const [row]=await getDb().select({id:visitRequests.id}).from(visitRequests).where(and(eq(visitRequests.id,match[2]),inArray(visitRequests.status,["confirmed","completed"]),eq(visitRequests.isUnavailable,false))).limit(1);
      return Boolean(row);
    }
    const [row]=await getDb().select({id:ministrySchedules.id}).from(ministrySchedules).where(and(eq(ministrySchedules.id,match[2]),eq(ministrySchedules.isActive,true),eq(ministrySchedules.status,"confirmed"))).limit(1);return Boolean(row);
  });
}
