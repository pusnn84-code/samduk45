"use client";
import {useEffect,useState,useRef} from 'react';
import {decodeApplicationServerKey} from '../../src/features/push/browser-key';
import {normalizePreferences,type PushPreferences} from '../../src/features/push/policy';
import './push-settings.css';
const initial:PushPreferences={notices:true,community:false,reading:false,pastoral:true,personal:true};
type Phase='loading'|'ready'|'enabled'|'denied'|'unsupported'|'ios'|'kakao'|'unconfigured'|'error';
async function api(path:string,body:unknown,method='POST'){const r=await fetch(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});if(!r.ok)throw Error('PUSH_REQUEST_FAILED');return r.json();}
export function PushOptIn({isAdmin=false,isPastor=isAdmin}:{isAdmin?:boolean;isPastor?:boolean}={}){
 const [phase,setPhase]=useState<Phase>('loading'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [prepared,setPrepared]=useState(false);
 const [preferences,setPreferences]=useState<PushPreferences>(normalizePreferences({...initial,pastoral:isPastor}));
 const key=useRef(''),registration=useRef<ServiceWorkerRegistration|null>(null),subscription=useRef<PushSubscription|null>(null);
 useEffect(()=>{
  let active=true;
  void(async()=>{
   const response=await fetch('/api/push/public-key',{cache:'no-store'});if(!response.ok){if(active)setPhase('unconfigured');return;}
   const config=await response.json();key.current=config.publicKey;
   const ua=navigator.userAgent,ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
   if(/KAKAOTALK/i.test(ua)){if(active)setPhase('kakao');return;}
   if(ios&&!window.matchMedia('(display-mode: standalone)').matches&&!(navigator as Navigator&{standalone?:boolean}).standalone){if(active)setPhase('ios');return;}
   if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){if(active)setPhase('unsupported');return;}
   await navigator.serviceWorker.register('/sw.js');const reg=await navigator.serviceWorker.ready;if(!active)return;registration.current=reg;setPrepared(true);
   const sub=await reg.pushManager.getSubscription();subscription.current=sub;
   if(Notification.permission==='denied'){setPhase('denied');return;}
   if(sub){const status=await api('/api/push/status',{endpoint:sub.endpoint});if(!active)return;if(status.enabled){setPreferences(normalizePreferences(status.preferences));setPhase('enabled');return;}}
   if(active)setPhase('ready');
  })().catch(()=>{if(active)setPhase('error');});
  return()=>{active=false;};
 },[]);
 async function enablePush(){
  if(busy||!key.current||!registration.current)return;setBusy(true);setMessage('');
  try{
   // Request permission directly from this button tap; do not fetch first (iOS).
   const permission=await Notification.requestPermission();if(permission!=='granted'){setPhase('denied');return;}
   let sub=await registration.current.pushManager.getSubscription();
   if(sub){const existing=sub.options.applicationServerKey;const expected=new Uint8Array(decodeApplicationServerKey(key.current));if(existing&&(new Uint8Array(existing).length!==expected.length||new Uint8Array(existing).some((v,i)=>v!==expected[i]))){await api('/api/push/subscribe',{endpoint:sub.endpoint},'DELETE');await sub.unsubscribe();sub=null;}}
   sub??=await registration.current.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeApplicationServerKey(key.current)});
   const json=sub.toJSON();if(!json.keys?.p256dh||!json.keys?.auth)throw Error('INVALID_PUSH_KEYS');
   const result=await api('/api/push/subscribe',{endpoint:sub.endpoint,keys:{p256dh:json.keys.p256dh,auth:json.keys.auth},preferences});
   subscription.current=sub;setPreferences(normalizePreferences(result.preferences));setPhase('enabled');setMessage('이 기기에서 알림을 받습니다. 알림 테스트를 눌러 확인해 보세요.');
  }catch{setPhase('error');setMessage('알림을 켜지 못했습니다. 브라우저의 알림 권한을 확인한 뒤 다시 시도해 주세요.');}finally{setBusy(false);}
 }
 async function save(){if(!subscription.current)return;setBusy(true);setMessage('');try{await api('/api/push/subscribe',{endpoint:subscription.current.endpoint,preferences},'PUT');setMessage('알림 종류를 저장했습니다.');}catch{setMessage('저장하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function disable(){if(!subscription.current)return;setBusy(true);setMessage('');try{await api('/api/push/subscribe',{endpoint:subscription.current.endpoint},'DELETE');await subscription.current.unsubscribe();subscription.current=null;setPhase('ready');setMessage('이 기기의 알림을 껐습니다.');}catch{setMessage('알림을 끄지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function test(){if(!subscription.current)return;setBusy(true);setMessage('');try{await api('/api/push/test',{endpoint:subscription.current.endpoint});setMessage('테스트 알림을 보냈습니다. 휴대폰 알림창을 확인해 주세요. 테스트는 1분에 한 번 가능합니다.');}catch{setMessage('테스트를 보내지 못했습니다. 잠시 후 다시 시도하거나 휴대폰 알림 설정을 확인해 주세요.');}finally{setBusy(false);}}
 async function setup(){setBusy(true);try{await api('/api/admin/push/setup',{});window.location.reload();}catch{setMessage('알림 서버를 준비하지 못했습니다. 다시 시도해 주세요.');setBusy(false);}}
 const labels:[keyof PushPreferences,string][]=[['notices','공지 알림'],['reading','묵상 알림'],['community','도란도란 알림'],['personal','내 심방 확정 · 질문 답변'],...(isPastor?[['reports','샘모임 · 목양지 알림'],['visits','심방 신청 알림'],['prayers','기도요청 알림'],['questions','질문 접수 알림'],['confirmations','공지 읽음 확인 알림']] as [keyof PushPreferences,string][]:[])];
 return <section className="card push-settings" aria-labelledby="push-settings-title"><h2 id="push-settings-title">휴대폰 알림</h2>
 <p>받고 싶은 새 소식을 선택해 주세요. 이 기기에서 한 번만 알림을 허용하면 됩니다.</p>
 {phase==='loading'?<p role="status">알림 설정을 확인하고 있습니다.</p>:phase==='kakao'?<p>카카오톡 안에서는 알림을 설정할 수 없습니다. 오른쪽 위 메뉴에서 Chrome 또는 삼성 인터넷으로 연 뒤 다시 이용해 주세요.</p>:phase==='ios'?<p>아이폰은 Safari의 공유 메뉴 → ‘홈 화면에 추가’ 후, 홈 화면의 삼덕사오를 열어 알림을 켜 주세요. iOS 16.4 이상에서 사용할 수 있습니다.</p>:phase==='unsupported'?<p>이 브라우저는 휴대폰 알림을 지원하지 않습니다. 최신 Chrome·삼성 인터넷 또는 아이폰의 홈 화면 앱에서 이용해 주세요.</p>:phase==='denied'?<p>알림이 차단되어 있습니다. 휴대폰 설정에서 이 브라우저 또는 삼덕사오의 알림을 허용한 뒤 이 화면을 다시 열어 주세요.</p>:phase==='unconfigured'?<><p>알림 서버를 준비하고 있습니다.</p>{isAdmin&&<button type="button" className="primary-button" disabled={busy} onClick={()=>void setup()}>휴대폰 알림 시작하기</button>}</>:<>
 <fieldset disabled={busy} className="push-topics"><legend>받을 알림</legend>{labels.map(([name,label])=><label key={name}><input type="checkbox" checked={preferences[name]} onChange={e=>setPreferences({...preferences,[name]:e.target.checked,...(["reports","visits","prayers","questions","confirmations"].includes(name)?{pastoral:true}:{})})}/><span>{label}</span></label>)}</fieldset>
 <div className="push-actions">{phase==='enabled'?<><button type="button" className="primary-button" disabled={busy} onClick={()=>void save()}>알림 종류 저장</button><button type="button" className="text-button" disabled={busy} onClick={()=>void test()}>알림 테스트</button><button type="button" className="text-button" disabled={busy} onClick={()=>void disable()}>이 기기 알림 끄기</button></>:<button type="button" className="primary-button" disabled={busy||!prepared} onClick={()=>void enablePush()}>{busy?'설정 중…':'휴대폰 알림 켜기'}</button>}</div>
 </>}
 {message&&<p role="status">{message}</p>}
 <p className="helper-text">목회 접수 알림은 담당 목사님께만 전달됩니다. 무명 묵상과 질문은 이름을 숨기며, 비공개 본문은 알림에 표시하지 않습니다. 알림을 누르면 해당 글로 이동합니다. 기기·브라우저 설정이나 절전 상태에 따라 도착이 늦어질 수 있습니다.</p>
 </section>;
}
