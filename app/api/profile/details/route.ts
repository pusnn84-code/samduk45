import {NextResponse} from "next/server";
import {getCurrentSessionUser} from "../../../../src/features/auth/http-session";
import {ProfileDetailsSchema,updateProfileDetails} from "../../../../src/features/profile/details";
import {getProfile} from "../../../../src/features/profile/service";
import {checkOrigin,readLimited,ReportError} from "../../../../src/features/pastoral/policy";
import {DomainError} from "../../../../src/lib/http";
export async function PATCH(request:Request){
 const headers={"Cache-Control":"private, no-store"};
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
 try{
  checkOrigin(request);
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_INPUT",415);
  let raw:unknown;try{raw=JSON.parse(new TextDecoder().decode(await readLimited(request,4096)));}catch(e){if(e instanceof ReportError)throw e;throw new DomainError("INVALID_INPUT",400);}
  const parsed=ProfileDetailsSchema.safeParse(raw);if(!parsed.success)throw new DomainError("INVALID_INPUT",400);
  await updateProfileDetails(user.id,parsed.data);
  return NextResponse.json({profile:await getProfile(user.id)},{headers});
 }catch(e){if(e instanceof DomainError||e instanceof ReportError)return NextResponse.json({code:e.code},{status:e.status,headers});return NextResponse.json({code:"SAVE_UNAVAILABLE"},{status:503,headers});}
}
