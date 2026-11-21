import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentSessionUser} from '../../../../src/features/auth/http-session';
import {deviceStatus} from '../../../../src/features/push/devices';
import {Endpoint} from '../../../../src/features/push/policy';
import {checkOrigin,readReportJson,ReportError} from '../../../../src/features/pastoral/policy';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'},user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:'UNAUTHORIZED'},{status:401,headers});
 try{checkOrigin(request);const input=z.object({endpoint:Endpoint}).strict().safeParse(await readReportJson(request));if(!input.success)return NextResponse.json({code:'INVALID_INPUT'},{status:400,headers});
  return NextResponse.json(await deviceStatus(user.id,input.data.endpoint),{headers});
 }catch(e){return NextResponse.json({code:e instanceof ReportError?e.code:'PUSH_STATUS_FAILED'},{status:e instanceof ReportError?e.status:503,headers});}
}
