"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import "./questions.css";

type Item={id:string;title:string;updatedAt:string;waiting:boolean;unread:boolean};
type Message={id:string;sender:"member"|"pastor";content:string;createdAt:string};
type Detail={id:string;title:string;pastor:boolean;messages:Message[];hasMore:boolean};
type List={pastor:boolean;items:Item[];hasMore:boolean};
const date=(value:string)=>new Date(value).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
const changed=()=>window.dispatchEvent(new Event("menu-activity:changed"));
const options=(method:string,data:unknown)=>({method,headers:{"content-type":"application/json"},body:JSON.stringify(data)});
function errorText(error:unknown){return error instanceof Error && error.message==="TOO_MANY_REQUESTS"?"잠시 후 다시 보내 주세요.":"불러오거나 보내지 못했습니다. 잠시 후 다시 시도해 주세요.";}

export function QuestionsWorkspace({initialId=null}:{initialId?:string|null}={}){
 const [list,setList]=useState<List|null>(null),[page,setPage]=useState(0),[detail,setDetail]=useState<Detail|null>(null);
 const [selected,setSelected]=useState<string|null>(initialId),[compose,setCompose]=useState(false);
 const [title,setTitle]=useState(""),[content,setContent]=useState(""),[reply,setReply]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const selectedRef=useRef<string|null>(initialId);
 function open(id:string|null){selectedRef.current=id;setSelected(id);setDetail(null);setReply('');setError('');setLoading(Boolean(id));}
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const data=await fetchJson<List>(`/api/questions?page=${page}`,{cache:"no-store",signal});setList(data);
 },[page]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  void fetchJson<List>(`/api/questions?page=${page}`,{cache:'no-store',signal:controller.signal}).then(data=>{if(active)setList(data);}).catch(()=>{if(active)setError("질문 목록을 불러오지 못했습니다.");}).finally(()=>{if(active)setLoading(false);});
  const poll=()=>{if(document.visibilityState==='visible')void refresh(controller.signal).catch(()=>{});};
  const timer=setInterval(poll,30000);window.addEventListener('focus',poll);
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',poll);};
 },[refresh,page]);
 const loadDetail=useCallback(async(id:string,signal?:AbortSignal)=>{
  const data=await fetchJson<Detail>(`/api/questions/${id}`,{cache:'no-store',signal});
  if(selectedRef.current!==id||signal?.aborted)return;
  setDetail(data);
 },[]);
 useEffect(()=>{
  if(!selected)return;const controller=new AbortController();
  void loadDetail(selected,controller.signal).catch(()=>{if(!controller.signal.aborted)setError('대화를 불러오지 못했습니다.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  const poll=()=>{if(document.visibilityState==='visible')void loadDetail(selected,controller.signal).catch(()=>{});};
  const timer=setInterval(poll,30000);window.addEventListener('focus',poll);
  return()=>{controller.abort();clearInterval(timer);window.removeEventListener('focus',poll);};
 },[selected,loadDetail]);
 const last=detail?.messages.at(-1)?.id;
 const detailId=detail?.id;
 useEffect(()=>{
  if(!detailId||!last)return;const id=detailId;
  const acknowledge=()=>{if(document.visibilityState==='visible')void fetchJson(`/api/questions/${id}`,options('PATCH',{through:last})).then(()=>{changed();void refresh().catch(()=>{});}).catch(()=>{});};
  acknowledge();document.addEventListener('visibilitychange',acknowledge);
  return()=>document.removeEventListener('visibilitychange',acknowledge);
 },[detailId,last,refresh]); // Only the latest rendered message is acknowledged.
 async function sendQuestion(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{const result=await fetchJson<{id:string}>('/api/questions',options('POST',{title,content}));setTitle('');setContent('');setCompose(false);open(result.id);changed();void refresh().catch(()=>{});}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function sendReply(event:React.FormEvent){
  event.preventDefault();if(busy||!selected)return;setBusy(true);setError('');
  try{await fetchJson(`/api/questions/${selected}`,options('POST',{content:reply}));setReply('');await loadDetail(selected);changed();void refresh().catch(()=>{});}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function older(){if(!detail||busy)return;setBusy(true);setError('');
  try{const data=await fetchJson<Detail>(`/api/questions/${detail.id}?before=${detail.messages[0].id}`,{cache:'no-store'});setDetail(current=>current?.id===data.id?{...current,messages:[...data.messages,...current.messages],hasMore:data.hasMore}:current);}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 return <section className="questions-workspace">
  <header className="questions-intro"><h2>질문있습니다</h2><p>신앙과 삶의 궁금한 점을 목사님과 나눠 보세요.</p><p className="questions-privacy">무명 · 비공개 대화입니다. 작성자와 담당 목사님만 볼 수 있습니다.</p></header>
  {error&&<p role="alert" className="questions-error">{error}</p>}
  {selected?<>
   <button type="button" className="questions-secondary" onClick={()=>open(null)}>대화 목록</button>
   {loading&&!detail&&<p role="status">대화를 불러오는 중입니다.</p>}
   {detail&&<article className="questions-thread"><h3>{detail.title}</h3>
    {detail.hasMore&&<button className="questions-secondary" type="button" onClick={()=>void older()} disabled={busy}>이전 대화 보기</button>}
    <ol className="questions-messages" aria-label="질문과 답변">{detail.messages.map(m=><li key={m.id} className={m.sender=== (detail.pastor?'pastor':'member')?'is-mine':''}><span className="questions-sender">{m.sender==='pastor'?'담당 목사님':detail.pastor?'무명':'나'}</span><p>{m.content}</p><time dateTime={new Date(m.createdAt).toISOString()}>{date(m.createdAt)}</time></li>)}</ol>
    <form onSubmit={sendReply}><label htmlFor="question-reply">{detail.pastor?'답변':'이어서 이야기하기'}</label><textarea id="question-reply" value={reply} onChange={e=>setReply(e.target.value)} required maxLength={5000} rows={4} disabled={busy}/><button className="questions-primary" type="submit" disabled={busy||!reply.trim()}>{busy?'보내는 중…':'보내기'}</button></form>
   </article>}
  </>:compose?<form className="questions-compose" onSubmit={sendQuestion}>
   <label htmlFor="question-title">제목</label><input id="question-title" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={100} disabled={busy}/>
   <label htmlFor="question-content">나누고 싶은 이야기</label><textarea id="question-content" value={content} onChange={e=>setContent(e.target.value)} required maxLength={5000} rows={9} disabled={busy}/>
   <p className="questions-hint">목사님에게도 작성자 이름이 표시되지 않습니다. 내용에 이름을 적으면 전달됩니다.</p>
   <div className="questions-actions"><button type="button" className="questions-secondary" disabled={busy} onClick={()=>{setCompose(false);setError('');}}>취소</button><button className="questions-primary" disabled={busy||!title.trim()||!content.trim()}>{busy?'보내는 중…':'목사님께 보내기'}</button></div>
  </form>:<>
   <div className="questions-toolbar"><h3>{list?.pastor?'받은 질문':'나의 대화'}</h3>{list&&!list.pastor&&<button className="questions-primary" type="button" onClick={()=>{setCompose(true);setError('');}}>질문하기</button>}</div>
   {loading&&!list&&<p role="status">질문 목록을 불러오는 중입니다.</p>}
   {list?.items.length===0&&<div className="questions-empty">{list.pastor?'아직 받은 질문이 없습니다.':'아직 나눈 대화가 없습니다. 편안하게 질문해 주세요.'}</div>}
   <ul className="questions-list">{list?.items.map(item=><li key={item.id}><button type="button" onClick={()=>open(item.id)}><span><strong>{item.title}</strong>{item.unread&&<span className="questions-new" aria-label="읽지 않은 새 대화">N</span>}</span><span className="questions-meta">{item.waiting?'답변 대기':'목사님 답변'} · {date(item.updatedAt)}</span></button></li>)}</ul>
   <div className="questions-pagination">{page>0&&<button className="questions-secondary" type="button" onClick={()=>setPage(p=>p-1)}>이전</button>}{list?.hasMore&&<button className="questions-secondary" type="button" onClick={()=>setPage(p=>p+1)}>다음</button>}</div>
  </>}
 </section>;
}
