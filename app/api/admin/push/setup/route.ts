import {NextResponse} from 'next/server';
import {getCurrentSessionUser} from '../../../../../src/features/auth/http-session';
import {requireAdmin} from '../../../../../src/features/admin/service';
import {setupPush} from '../../../../../src/features/push/config';
import {DomainError} from '../../../../../src/lib/http';
import {checkOrigin,ReportError} from '../../../../../src/features/pastoral/policy';
export async function POST(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{requireAdmin(await getCurrentSessionUser());checkOrigin(request);await setupPush();return NextResponse.json({configured:true},{headers});}
 catch(e){return NextResponse.json({code:e instanceof DomainError||e instanceof ReportError?e.code:'PUSH_SETUP_FAILED'},{status:e instanceof DomainError||e instanceof ReportError?e.status:503,headers});}
}
