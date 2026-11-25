import {NextResponse} from "next/server";
import {z} from "zod";
import {getCurrentSessionUser} from "../../../../../src/features/auth/http-session";
import {getReadingNotice,saveReadingNotice} from "../../../../../src/features/bible-reading/notice";
import {checkOrigin,readLimited,ReportError} from "../../../../../src/features/pastoral/policy";
import {DomainError} from "../../../../../src/lib/http";
const headers={"Cache-Control":"private, no-store"};
const schema=z.object({title:z.string().trim().max(200),body:z.string().trim().max(20000)}).strict();
function failure(e:unknown){return e instanceof DomainError||e instanceof ReportError?NextResponse.json({code:e.code},{status:e.status,headers}):NextResponse.json({code:"NOTICE_UNAVAILABLE"},{status:503,headers});}
export async function GET(){const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});if(!user||user.role!=="admin")return NextResponse.json({code:"FORBIDDEN"},{status:403,headers});try{return NextResponse.json({notice:await getReadingNotice()},{headers});}catch(e){return failure(e);}}
export async function PUT(request:Request){
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});if(!user||user.role!=="admin")return NextResponse.json({code:"FORBIDDEN"},{status:403,headers});
 try{checkOrigin(request);if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_CONTENT_TYPE",415);
 let raw:unknown;try{raw=JSON.parse(new TextDecoder().decode(await readLimited(request,100000)));}catch(e){if(e instanceof ReportError)throw e;throw new DomainError("INVALID_INPUT",400);}
 const parsed=schema.safeParse(raw);if(!parsed.success||parsed.data.title.includes("\u0000")||parsed.data.body.includes("\u0000"))throw new DomainError("INVALID_INPUT",400);
 return NextResponse.json({notice:await saveReadingNotice(parsed.data)},{headers});}catch(e){return failure(e);}
}
