"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
type Comment={id:string;name:string;body:string;isOwn:boolean};
export function MeditationComments({sharingId}:{sharingId:string}){
 const [open,setOpen]=useState(false),[comments,setComments]=useState<Comment[]>([]),[draft,setDraft]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");const pending=useRef<string|null>(null);
 useEffect(()=>{if(!open)return;const controller=new AbortController();fetch(`/api/bible-reading/comments?sharingId=${sharingId}`,{cache:"no-store",signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>setComments(data.comments)).catch(()=>{if(!controller.signal.aborted)setError("댓글을 불러오지 못했습니다. 다시 열어 주세요.");});return ()=>controller.abort();},[open,sharingId]);
 async function mutate(method:"POST"|"DELETE",id:string,body?:string){
  if(busy)return;setBusy(true);setError("");
  try{const response=await fetch("/api/bible-reading/comments",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({sharingId,id,...(body===undefined?{}:{body})})});if(!response.ok)throw Error();const data=await response.json();setComments(data.comments);if(method==="POST"){setDraft("");pending.current=null;}}
  catch{setError("저장 결과를 확인하지 못했습니다. 다시 열어 확인해 주세요.");}finally{setBusy(false);}
 }
 function submit(event:FormEvent){event.preventDefault();if(!draft.trim())return;pending.current??=crypto.randomUUID();void mutate("POST",pending.current,draft.trim());}
 return <div className="meditation-comments"><button type="button" className="bible-reading-secondary" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setError("");}}>댓글{open?` ${comments.length}`:" 쓰기·보기"}</button>
 {open&&<div><ul>{comments.map(comment=><li key={comment.id}><strong>{comment.name}</strong><p>{comment.body}</p>{comment.isOwn&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm("댓글을 삭제할까요?"))void mutate("DELETE",comment.id);}}>삭제</button>}</li>)}</ul>
 <form onSubmit={submit}><label>댓글 쓰기<textarea rows={2} value={draft} disabled={busy} onChange={event=>{setDraft(event.target.value);pending.current=null;}}/></label><button type="submit" className="bible-reading-primary" disabled={busy||!draft.trim()}>댓글 등록</button></form></div>}
 {error&&<p role="alert">{error}</p>}</div>;
}
