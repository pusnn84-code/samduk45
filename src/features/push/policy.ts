import { z } from "zod";
export const defaultPreferences={notices:true,community:false,reading:false,pastoral:true,personal:true};
export type PushPreferences=typeof defaultPreferences;
export const Preferences=z.object({notices:z.boolean(),community:z.boolean(),reading:z.boolean(),pastoral:z.boolean(),personal:z.boolean()}).strict();
export function safePushEndpoint(value:string){
 try{const u=new URL(value);return value.length<=4096&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&
  (u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));
 }catch{return false;}
}
export const Endpoint=z.string().max(4096).refine(safePushEndpoint);
function key(bytes:number){return z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(120).refine(v=>{const b=Buffer.from(v,'base64url');return b.length===bytes&&b.toString('base64url')===v.replace(/=+$/,'')&&(bytes!==65||b[0]===4);});}
export const Subscription=z.object({endpoint:Endpoint,keys:z.object({p256dh:key(65),auth:key(16)}).strict(),preferences:Preferences.optional()}).strict();
export const messages={
 notice:{title:'삼덕사오 · 새 공지',body:'공동체의 새 공지를 확인해 주세요.',url:'/notices',topic:'notices'},
 community:{title:'삼덕사오 · 도란도란',body:'도란도란에 새로운 이야기가 올라왔습니다.',url:'/community',topic:'community'},
 reading:{title:'삼덕사오 · 한 줄 나눔',body:'성경통독 한 줄 나눔에 새 글이 올라왔습니다.',url:'/bible-reading',topic:'reading'},
 admin_prayer:{title:'삼덕사오 · 기도요청',body:'새 기도요청이 도착했습니다.',url:'/admin/prayer-requests',topic:'pastoral'},
 admin_visit:{title:'삼덕사오 · 심방신청',body:'새 심방신청이 도착했습니다.',url:'/admin/visits',topic:'pastoral'},
 admin_report:{title:'삼덕사오 · 샘목양지',body:'새 샘목양지가 제출되었습니다.',url:'/admin/pastoral-reports',topic:'pastoral'},
 admin_question:{title:'삼덕사오 · 질문있어요',body:'새로운 1:1 질문이 도착했습니다.',url:'/questions',topic:'pastoral'},
 own_visit:{title:'삼덕사오 · 심방 확정',body:'신청하신 심방이 확정되었습니다. 일정을 확인해 주세요.',url:'/visits',topic:'personal'},
 own_question:{title:'삼덕사오 · 질문 답변',body:'목사님의 새 답변이 도착했습니다.',url:'/questions',topic:'personal'},
} as const;
export type PushKind=keyof typeof messages;
export function pushPayload(kind:PushKind,eventKey:string){const {title,body,url}=messages[kind];return {title,body,url,tag:'samduk45-'+eventKey};}
