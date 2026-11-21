import { scheduleCalendarExport } from "../../../../../../src/features/google-calendar/export-wakeup";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../../../src/features/auth/http-session";
import { declineVisit } from "../../../../../../src/features/visits/shared-calendar";
import { DomainError } from "../../../../../../src/lib/http";
import { checkOrigin, ReportError } from "../../../../../../src/features/pastoral/policy";
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
 const user=await getCurrentSessionUser();
 if(!user||user.role!=="admin")return NextResponse.json({code:"FORBIDDEN"},{status:403});
 try {
  checkOrigin(request);
  const {id}=await context.params;
  if(!z.uuid().safeParse(id).success)return NextResponse.json({code:"INVALID_INPUT"},{status:400});
  await declineVisit(id);
  scheduleCalendarExport();return NextResponse.json({status:"ok"});
 }catch(error){if(error instanceof DomainError||error instanceof ReportError)return NextResponse.json({code:error.code},{status:error.status});throw error;}
}
