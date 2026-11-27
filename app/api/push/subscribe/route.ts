import {NextResponse} from 'next/server';
import {getCurrentSessionUser} from '../../../../src/features/auth/http-session';
import {savePushSubscription,removePushSubscription,updatePushPreferences} from '../../../../src/features/push/devices';
import {Endpoint,Subscription,Preferences,defaultPreferences,preferencesForRole} from '../../../../src/features/push/policy';
import {pushConfig} from '../../../../src/features/push/config';
import {checkOrigin,readReportJson,ReportError} from '../../../../src/features/pastoral/policy';
import {DomainError} from '../../../../src/lib/http';
import {z} from 'zod';
const headers={'Cache-Control':'private, no-store'};
async function handle(request:Request,method:string){
 const user=await getCurrentSessionUser();if(!user)return NextResponse.json({code:'UNAUTHORIZED'},{status:401,headers});
 try{checkOrigin(request);const body=await readReportJson(request);
  if(method==='POST'){
   const parsed=Subscription.safeParse(body);if(!parsed.success)return NextResponse.json({code:'INVALID_INPUT'},{status:400,headers});
   if(!await pushConfig())return NextResponse.json({code:'PUSH_NOT_CONFIGURED'},{status:503,headers});
   const preferences=preferencesForRole(parsed.data.preferences??defaultPreferences,user.role==='admin');
   await savePushSubscription(user.id,{...parsed.data,preferences},request.headers.get('user-agent'));
   return NextResponse.json({enabled:true,preferences},{headers});
  }
  if(method==='PUT'){
   const parsed=z.object({endpoint:Endpoint,preferences:Preferences}).strict().safeParse(body);if(!parsed.success)return NextResponse.json({code:'INVALID_INPUT'},{status:400,headers});
   const preferences=preferencesForRole(parsed.data.preferences,user.role==='admin');
   await updatePushPreferences(user.id,parsed.data.endpoint,preferences);return NextResponse.json({enabled:true,preferences},{headers});
  }
  const parsed=z.object({endpoint:Endpoint}).strict().safeParse(body);if(!parsed.success)return NextResponse.json({code:'INVALID_INPUT'},{status:400,headers});
  await removePushSubscription(user.id,parsed.data.endpoint);return NextResponse.json({enabled:false},{headers});
 }catch(e){if(e instanceof DomainError||e instanceof ReportError)return NextResponse.json({code:e.code},{status:e.status,headers});return NextResponse.json({code:'PUSH_SETTINGS_FAILED'},{status:503,headers});}
}
export async function POST(request:Request){return handle(request,'POST');}
export async function PUT(request:Request){return handle(request,'PUT');}
export async function DELETE(request:Request){return handle(request,'DELETE');}

