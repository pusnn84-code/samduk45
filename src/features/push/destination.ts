export const notificationKinds=['notice','community','reading','admin_report','admin_visit','admin_prayer','admin_question','admin_notice_confirmation','own_visit','own_question'] as const;
export type NotificationKind=typeof notificationKinds[number];
const uuid='[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}';
export function notificationSource(kind:unknown,source:unknown):{kind:NotificationKind;source:string}|null{
 if(typeof kind!=='string'||!notificationKinds.includes(kind as NotificationKind)||typeof source!=='string'||source.length>150)return null;
 const pattern=kind==='admin_notice_confirmation'?new RegExp('^'+uuid+':'+uuid+':[0-9a-f]{32}$','i'):kind==='admin_question'||kind==='own_question'?/^[1-9][0-9]{0,19}$/:new RegExp('^'+uuid+'$','i');
 return pattern.test(source)?{kind:kind as NotificationKind,source}:null;
}
export function notificationEntryUrl(kind:NotificationKind,source:string){return '/notifications/open?'+new URLSearchParams({kind,source});}
export function safeNotificationDestination(value:unknown){
 if(typeof value!=='string'||value.length>600||!value.startsWith('/notifications/open?'))return null;
 try{const url=new URL(value,'https://samduk45.invalid');if(url.origin!=='https://samduk45.invalid'||url.pathname!=='/notifications/open'||url.hash||[...url.searchParams].length!==2)return null;const target=notificationSource(url.searchParams.get('kind'),url.searchParams.get('source'));return target?notificationEntryUrl(target.kind,target.source):null;}catch{return null;}
}
