import {after} from 'next/server';
export function schedulePushDelivery(){
 if(process.env.NODE_ENV==='test')return;
 if(process.env.CI==='true'&&process.env.E2E_DATABASE_READY==='1')return;
 try{after(async()=>{try{const {dispatchPush}=await import('./dispatcher');await dispatchPush();}catch{console.warn('Mobile push deferred; durable delivery queue retained');}});}catch{console.warn('Mobile push wakeup deferred');}
}
