import {NextResponse} from "next/server";
import {z} from "zod";
import {getCurrentSessionUser} from "../../../../src/features/auth/http-session";
import {getBibleReadingState} from "../../../../src/features/bible-reading/service";
import {withMeditations,mutateMeditation} from "../../../../src/features/bible-reading/meditations";
import {checkOrigin,readLimited,ReportError} from "../../../../src/features/pastoral/policy";
import {DomainError} from "../../../../src/lib/http";
import {schedulePushDelivery} from "../../../../src/features/push/wakeup";
const headers={"Cache-Control":"private, no-store"};
const Base=z.object({id:z.uuid(),date:z.iso.date()}).strict();
const Write=Base.extend({sharing:z.string().trim().min(1).refine(v=>!v.includes("\u0000")),sharingAnonymous:z.boolean()}).strict();
async function handle(request:Request,method:"POST"|"PATCH"|"DELETE"){
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
 try{
  checkOrigin(request);
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_CONTENT_TYPE",415);
  let raw:unknown;try{raw=JSON.parse(new TextDecoder().decode(await readLimited(request,4*1024*1024)));}catch(e){if(e instanceof ReportError)throw e;throw new DomainError("INVALID_INPUT",400);}
  const parsed=(method==="DELETE"?Base:Write).safeParse(raw);if(!parsed.success)throw new DomainError("INVALID_INPUT",400);
  await mutateMeditation(user.id,method,parsed.data);schedulePushDelivery();
  return NextResponse.json(await withMeditations(await getBibleReadingState(user.id,parsed.data.date),user.id),{headers});
 }catch(e){if(e instanceof DomainError||e instanceof ReportError)return NextResponse.json({code:e.code},{status:e.status,headers});console.warn("MEDITATION_WRITE_FAILED");return NextResponse.json({code:"SAVE_UNAVAILABLE"},{status:503,headers});}
}
export const POST=(r:Request)=>handle(r,"POST");
export const PATCH=(r:Request)=>handle(r,"PATCH");
export const DELETE=(r:Request)=>handle(r,"DELETE");
