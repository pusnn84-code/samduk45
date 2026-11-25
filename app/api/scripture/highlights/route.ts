import {NextResponse} from "next/server";
import {getCurrentSessionUser} from "../../../../src/features/auth/http-session";
import {getHighlights,saveHighlights,HighlightInput,VerseReference} from "../../../../src/features/scripture/highlights";
import {checkOrigin,readLimited,ReportError} from "../../../../src/features/pastoral/policy";
import {DomainError} from "../../../../src/lib/http";
const headers={"Cache-Control":"private, no-store"};
function failure(error:unknown){return error instanceof DomainError||error instanceof ReportError?NextResponse.json({code:error.code},{status:error.status,headers}):NextResponse.json({code:"HIGHLIGHT_UNAVAILABLE"},{status:503,headers});}
export async function GET(request:Request){
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
 try{
  const value=new URL(request.url).searchParams.get("references")??"";
  if(!/^\d+:\d+(,\d+:\d+){0,49}$/.test(value))throw new DomainError("INVALID_INPUT",400);
  const refs=value.split(",").map(value=>{const [book,chapter]=value.split(":").map(Number);return {book,chapter};});
  if(refs.some(r=>!VerseReference.safeParse({...r,verse:1}).success))throw new DomainError("INVALID_INPUT",400);
  return NextResponse.json({highlights:await getHighlights(user.id,refs)},{headers});
 }catch(e){return failure(e);}
}
export async function PUT(request:Request){
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
 try{
  checkOrigin(request);
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_INPUT",415);
  let raw:unknown;try{raw=JSON.parse(new TextDecoder().decode(await readLimited(request,50000)));}catch(e){if(e instanceof ReportError)throw e;throw new DomainError("INVALID_INPUT",400);}
  const parsed=HighlightInput.safeParse(raw);if(!parsed.success)throw new DomainError("INVALID_INPUT",400);
  await saveHighlights(user.id,parsed.data);return NextResponse.json({status:"ok"},{headers});
 }catch(e){return failure(e);}
}
