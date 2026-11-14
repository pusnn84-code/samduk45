import {z} from "zod";
import {getCurrentSessionUser} from "../../../../src/features/auth/http-session";
import {json,sameOrigin,boundedJson} from "../../../../src/features/pastoral/http";
import {ReportError} from "../../../../src/features/pastoral/policy";
import {DomainError} from "../../../../src/lib/http";
import {AutumnCreate,AutumnPatch,AutumnFilter} from "../../../../src/features/autumn-light/policy";
import {getAutumnDaily,listAutumnSams,listAutumnCards,getAutumnCard,createAutumnCard,updateAutumnCard,setAutumnPrayer,listAutumnParticipants} from "../../../../src/features/autumn-light/service";
export const dynamic="force-dynamic";
type Context={params:Promise<{path?:string[]}>};
async function handle(request:Request,context:Context){
 try{
  const actor=await getCurrentSessionUser();if(!actor)return json({code:"UNAUTHORIZED"},401);
  const path=(await context.params).path??[];
  if(request.method!=="GET")sameOrigin(request);
  if(request.method==="GET"&&path.length===0){const [today,sams]=await Promise.all([getAutumnDaily(actor),listAutumnSams()]);return json({...today,sams});}
  if(path[0]!=="cards")throw new DomainError("AUTUMN_NOT_FOUND",404);
  if(request.method==="GET"&&path.length===1){const params=Object.fromEntries(new URL(request.url).searchParams);const parsed=AutumnFilter.safeParse(params);if(!parsed.success)return json({code:"INVALID_INPUT"},400);return json(await listAutumnCards(actor,parsed.data));}
  if(request.method==="POST"&&path.length===1){const parsed=AutumnCreate.safeParse(await boundedJson(request));if(!parsed.success)return json({code:"INVALID_INPUT"},400);return json({card:await createAutumnCard(actor,parsed.data)},201);}
  if(!z.uuid().safeParse(path[1]).success)return json({code:"INVALID_INPUT"},400);
  if(request.method==="GET"&&path.length===2)return json({card:await getAutumnCard(actor,path[1])});
  if(request.method==="PATCH"&&path.length===2){const parsed=AutumnPatch.safeParse(await boundedJson(request));if(!parsed.success)return json({code:"INVALID_INPUT"},400);return json({card:await updateAutumnCard(actor,path[1],parsed.data)});}
  if(path.length===3&&path[2]==="prayers"){
   if(request.method==="PUT"){const parsed=z.object({prayed:z.boolean()}).strict().safeParse(await boundedJson(request));if(!parsed.success)return json({code:"INVALID_INPUT"},400);return json({card:await setAutumnPrayer(actor,path[1],parsed.data.prayed)});}
   if(request.method==="GET"){const page=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get("page")??0);if(!page.success)return json({code:"INVALID_INPUT"},400);return json(await listAutumnParticipants(actor,path[1],page.data));}
  }
  throw new DomainError("AUTUMN_NOT_FOUND",404);
 }catch(error){if(error instanceof DomainError||error instanceof ReportError)return json({code:error.code},error.status);return json({code:"AUTUMN_UNAVAILABLE"},503);}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;export const PUT=handle;
