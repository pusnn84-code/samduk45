import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { setSharingEmpathy } from "../../../../src/features/bible-reading/empathy";
import { checkOrigin, readReportJson, ReportError } from "../../../../src/features/pastoral/policy";
import { DomainError } from "../../../../src/lib/http";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const Input=z.object({date:z.iso.date(),sharingId:z.uuid(),reacted:z.boolean()}).strict();
export async function PUT(request:Request) {
  const user=await getCurrentSessionUser();
  if(!user)return NextResponse.json({code:"UNAUTHORIZED"},{status:401,headers});
  try {
    checkOrigin(request);
    const input=Input.safeParse(await readReportJson(request));
    if(!input.success)return NextResponse.json({code:"INVALID_INPUT"},{status:400,headers});
    return NextResponse.json(await setSharingEmpathy(user.id,input.data),{headers});
  } catch(error) {
    if(error instanceof DomainError||error instanceof ReportError)return NextResponse.json({code:error.code},{status:error.status,headers});
    throw error;
  }
}
