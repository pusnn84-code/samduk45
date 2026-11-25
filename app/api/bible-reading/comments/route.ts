import {NextResponse} from "next/server";
import {z} from "zod";
import {getCurrentSessionUser} from "../../../../src/features/auth/http-session";
import {listMeditationComments,mutateMeditationComment} from "../../../../src/features/bible-reading/comments";
import {checkOrigin,readLimited,ReportError} from "../../../../src/features/pastoral/policy";
import {DomainError} from "../../../../src/lib/http";
const headers={"Cache-Control":"private, no-store"};
const Base=z.object({sharingId:z.uuid(),id:z.uuid()}).strict();
const Write=Base.extend({body:z.string().trim().min(1).refine(v=>!v.includes("\u0000"))}).strict();
function failure(e:unknown){return e instanceof DomainError||e instanceof ReportError?NextResponse.json({code:e.code},{status:e.status,headers}):NextResponse.json({code:"COMMENT_UNAVAILABLE"},{status:503,headers});}
export async function GET(request:Request){
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
 const parsed=z.uuid().safeParse(new URL(request.url).searchParams.get("sharingId"));if(!parsed.success)return NextResponse.json({code:"INVALID_INPUT"},{status:400,headers});
 try{return NextResponse.json({comments:await listMeditationComments(parsed.data,user.id)},{headers});}catch(e){return failure(e);}
}
async function mutate(request:Request,method:"POST"|"PATCH"|"DELETE"){
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
 try{
  checkOrigin(request);
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_INPUT",415);
  let raw:unknown;try{raw=JSON.parse(new TextDecoder().decode(await readLimited(request,4*1024*1024)));}catch(e){if(e instanceof ReportError)throw e;throw new DomainError("INVALID_INPUT",400);}
  const parsed=(method!=="DELETE"?Write:Base).safeParse(raw);if(!parsed.success)throw new DomainError("INVALID_INPUT",400);
  await mutateMeditationComment(user.id,parsed.data.sharingId,parsed.data,method==="PATCH",method==="DELETE"&&user.role==="admin");
  return NextResponse.json({comments:await listMeditationComments(parsed.data.sharingId,user.id)},{headers});
 }catch(e){return failure(e);}
}
export const POST=(r:Request)=>mutate(r,"POST");
export const DELETE=(r:Request)=>mutate(r,"DELETE");

export const PATCH=(r:Request)=>mutate(r,"PATCH");
