import {NextResponse} from 'next/server';
import {getCurrentSessionUser} from '../../../../src/features/auth/http-session';
import {pushConfig} from '../../../../src/features/push/config';
import {schedulePushDelivery} from '../../../../src/features/push/wakeup';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'private, no-store'};
 if(!await getCurrentSessionUser())return NextResponse.json({code:'UNAUTHORIZED'},{status:401,headers});
 try{const config=await pushConfig();if(!config)return NextResponse.json({code:'PUSH_NOT_CONFIGURED'},{status:503,headers});
  // WEB_PUSH_VAPID_PUBLIC_KEY is the only key disclosed; private key stays server-side.
  schedulePushDelivery();return NextResponse.json({publicKey:config.publicKey},{headers});
 }catch{return NextResponse.json({code:'PUSH_NOT_CONFIGURED'},{status:503,headers});}
}
