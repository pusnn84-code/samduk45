import { NextResponse } from "next/server";
import { google } from "googleapis";
import { z } from "zod";
import { getCurrentSessionUser } from "../auth/http-session";
import { requireAdmin } from "../admin/service";
import { checkOrigin, readReportJson, ReportError } from "../pastoral/policy";
import { requireGoogleCalendarConfig } from "../../lib/env";
import { DomainError } from "../../lib/http";
import { createGoogleOAuthClient, listConnectedCalendars } from "./client";
import { encryptGoogleRefreshToken } from "./crypto";
import { assertGoogleOAuthState, googleAuthorizationUrlOptions, newGoogleOAuthState } from "./oauth";
import { deleteGoogleCalendarConnection, getGoogleCalendarConnection, saveGoogleCalendarConnection, selectGoogleCalendar } from "./repository";
import { syncCalendarExports } from "./export-service";
import { scheduleCalendarExport } from "./export-wakeup";
import { cookies } from "next/headers";

const cookieName="samduk45_calendar_oauth";
const headers={"Cache-Control":"private, no-store"};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
function failure(error:unknown){
  if(error instanceof DomainError||error instanceof ReportError)return json({code:error.code},error.status);
  return json({code:"GOOGLE_CALENDAR_REQUEST_FAILED"},502);
}
function configured(){try{requireGoogleCalendarConfig();return true;}catch{return false;}}
const callbackUri=(request:Request)=>new URL("/api/admin/google-calendar/callback",request.url).toString();
const cookieOptions=(request:Request)=>({httpOnly:true,secure:new URL(request.url).protocol==="https:",sameSite:"lax" as const,path:"/api/admin/google-calendar",maxAge:600});
function returnToSettings(request:Request,message:string){const url=new URL("/admin/visits",request.url);url.searchParams.set("google-calendar",message);const response=NextResponse.redirect(url);response.cookies.set(cookieName,"",{...cookieOptions(request),maxAge:0});return response;}

export async function status(){
  try{requireAdmin(await getCurrentSessionUser());const connection=await getGoogleCalendarConnection();return json({configured:configured(),connected:Boolean(connection),accountEmail:connection?.googleAccountEmail??null,selectedCalendarId:connection?.selectedCalendarId??null,selectedCalendarName:connection?.selectedCalendarName??null,direction:"app_to_google"});}
  catch(error){return failure(error);}
}
export async function calendars(){try{requireAdmin(await getCurrentSessionUser());return json({calendars:await listConnectedCalendars()});}catch(error){return failure(error);}}
export async function selection(request:Request){
  try{
    requireAdmin(await getCurrentSessionUser());checkOrigin(request);
    const parsed=z.object({calendarId:z.string().min(1).max(1024)}).strict().safeParse(await readReportJson(request));if(!parsed.success)return json({code:"INVALID_INPUT"},400);
    const available=await listConnectedCalendars(),selected=available.find(c=>c.id===parsed.data.calendarId&&(c.accessRole==="owner"||c.accessRole==="writer"));
    if(!selected)return json({code:"CALENDAR_NOT_WRITABLE"},400);
    await selectGoogleCalendar(selected.id,selected.summary);scheduleCalendarExport();return json({status:"ok"});
  }catch(error){return failure(error);}
}
export async function disconnect(request:Request){try{requireAdmin(await getCurrentSessionUser());checkOrigin(request);await deleteGoogleCalendarConnection();return json({status:"ok"});}catch(error){return failure(error);}}
export async function sync(request:Request){try{requireAdmin(await getCurrentSessionUser());checkOrigin(request);return json({status:"ok",...await syncCalendarExports()});}catch(error){return failure(error);}}
export async function connect(request:Request){
  try{
    const user=await getCurrentSessionUser();requireAdmin(user);
    if(!configured())return returnToSettings(request,"not-configured");
    const state=newGoogleOAuthState(),oauth=createGoogleOAuthClient(callbackUri(request));
    const url=oauth.generateAuthUrl({...googleAuthorizationUrlOptions(state),prompt:"select_account consent"});
    const response=NextResponse.redirect(url);response.cookies.set(cookieName,state+"."+user.id,cookieOptions(request));return response;
  }catch(error){return failure(error);}
}
export async function callback(request:Request){
  try{
    const user=await getCurrentSessionUser();requireAdmin(user);const url=new URL(request.url),store=await cookies();
    const expected=store.get(cookieName)?.value?.split(".");
    if(!expected||expected[1]!==user.id)throw new DomainError("GOOGLE_OAUTH_STATE_MISMATCH",400);
    assertGoogleOAuthState(url.searchParams.get("state"),expected[0]);
    if(url.searchParams.has("error"))return returnToSettings(request,"cancelled");
    const code=url.searchParams.get("code");if(!code)return returnToSettings(request,"failed");
    const oauth=createGoogleOAuthClient(callbackUri(request));const {tokens}=await oauth.getToken(code);
    if(!tokens.refresh_token)return returnToSettings(request,"permission-needed");
    oauth.setCredentials(tokens);const calendar=google.calendar({version:"v3",auth:oauth});
    const result=await calendar.calendarList.list({maxResults:250},{timeout:5000,retry:false});
    const primary=result.data.items?.find(c=>c.primary&&(c.accessRole==="owner"||c.accessRole==="writer")&&c.id);
    if(!primary?.id)return returnToSettings(request,"failed");
    await saveGoogleCalendarConnection({connectedByUserId:user.id,googleAccountEmail:primary.id.includes("@")?primary.id:null,refreshTokenCiphertext:encryptGoogleRefreshToken(tokens.refresh_token)});
    await selectGoogleCalendar(primary.id,primary.summary||primary.id);scheduleCalendarExport();return returnToSettings(request,"connected");
  }catch(error){if(error instanceof DomainError&&error.status===403)return failure(error);return returnToSettings(request,"failed");}
}
