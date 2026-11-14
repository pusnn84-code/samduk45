import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { getDb } from "../../../../src/db/client";
import { ministrySchedules } from "../../../../src/db/schema";
import { createMinistry, MinistryInput } from "../../../../src/features/visits/shared-calendar";
import { checkOrigin, readReportJson, ReportError } from "../../../../src/features/pastoral/policy";
const headers = {"Cache-Control":"private, no-store"};
async function mutate(request:Request, remove:boolean) {
  const user=await getCurrentSessionUser();
  if(!user || user.role!=="admin")return NextResponse.json({code:"FORBIDDEN"},{status:403,headers});
  try {
    checkOrigin(request);
    const body=await readReportJson(request);
    if(remove) {
      const parsed=z.object({id:z.uuid()}).strict().safeParse(body);
      if(!parsed.success)return NextResponse.json({code:"INVALID_INPUT"},{status:400,headers});
      const rows=await getDb().update(ministrySchedules).set({isActive:false})
        .where(and(eq(ministrySchedules.id,parsed.data.id),eq(ministrySchedules.isActive,true))).returning({id:ministrySchedules.id});
      if(!rows.length)return NextResponse.json({code:"NOT_FOUND"},{status:404,headers});
      return NextResponse.json({status:"ok"},{headers});
    }
    const input=MinistryInput.safeParse(body);
    if(!input.success)return NextResponse.json({code:"INVALID_INPUT"},{status:400,headers});
    return NextResponse.json(await createMinistry(user.id,input.data),{status:201,headers});
  } catch(error) {
    if(error instanceof ReportError)return NextResponse.json({code:error.code},{status:error.status,headers});
    throw error;
  }
}
export async function POST(request:Request){return mutate(request,false);}
export async function DELETE(request:Request){return mutate(request,true);}
