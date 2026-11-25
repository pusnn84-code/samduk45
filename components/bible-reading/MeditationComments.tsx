"use client";
import {useEffect,useRef,useState,type FormEvent,type ReactNode} from "react";
import {MeditationIcon} from "./MeditationIcon";
type Comment={id:string;name:string;body:string;isOwn:boolean};
export function MeditationComments({sharingId,commentCount=0,reaction,controls}:{sharingId:string;commentCount?:number;reaction?:ReactNode;controls?:ReactNode}){
 const [open,setOpen]=useState(false),[comments,setComments]=useState<Comment[]>([]),[countResult,setCount]=useState<{source:number;value:number}|null>(null),[draft,setDraft]=useState("");
 const [editing,setEditing]=useState<string|null>(null),[editDraft,setEditDraft]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState("");const pending=useRef<string|null>(null);
 const count=countResult?.source===commentCount?countResult.value:commentCount;
 useEffect(()=>{if(!open)return;const controller=new AbortController();fetch(`/api/bible-reading/comments?sharingId=${sharingId}`,{cache:"no-store",signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{setComments(data.comments);setCount({source:commentCount,value:data.comments.length});}).catch(()=>{if(!controller.signal.aborted)setError("댓글을 불러오지 못했습니다. 다시 열어 주세요.");});return ()=>controller.abort();},[open,sharingId,commentCount]);
 async function mutate(method:"POST"|"PATCH"|"DELETE",id:string,body?:string){
  if(busy)return;setBusy(true);setError("");
  try{const response=await fetch("/api/bible-reading/comments",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({sharingId,id,...(body===undefined?{}:{body})})});if(!response.ok)throw Error();const data=await response.json();setComments(data.comments);setCount({source:commentCount,value:data.comments.length});if(method==="POST"){setDraft("");pending.current=null;}if(method==="PATCH")setEditing(null);}
  catch{setError("저장 결과를 확인하지 못했습니다. 다시 열어 확인해 주세요.");}finally{setBusy(false);}
 }
 function submit(event:FormEvent){event.preventDefault();if(!draft.trim())return;pending.current??=crypto.randomUUID();void mutate("POST",pending.current,draft.trim());}
 return <div className="meditation-comments">
 <div className="meditation-line-actions">{reaction}<button type="button" className="meditation-icon-button meditation-comment-toggle" aria-label="댓글" title="댓글" aria-expanded={open} onClick={()=>{setOpen(v=>!v);setError("");}}><MeditationIcon name="comment"/><span>{count}</span></button><div className="meditation-own-tools">{controls}</div></div>
 {open&&<div className="meditation-comment-panel"><ul>{comments.map(comment=><li key={comment.id}><div className="meditation-comment-heading"><strong>{comment.name}</strong>{comment.isOwn&&<div className="meditation-own-tools"><button type="button" className="meditation-icon-button" aria-label="댓글 수정" title="수정" disabled={busy} onClick={()=>{setEditing(comment.id);setEditDraft(comment.body);}}><MeditationIcon name="edit"/></button><button type="button" className="meditation-icon-button" aria-label="댓글 삭제" title="삭제" disabled={busy} onClick={()=>{if(window.confirm("댓글을 삭제할까요?"))void mutate("DELETE",comment.id);}}><MeditationIcon name="delete"/></button></div>}</div>
 {editing===comment.id?<form onSubmit={event=>{event.preventDefault();if(editDraft.trim())void mutate("PATCH",comment.id,editDraft.trim());}}><textarea aria-label="댓글 수정 내용" value={editDraft} disabled={busy} onChange={event=>setEditDraft(event.target.value)}/><div className="meditation-edit-actions"><button type="button" className="bible-reading-secondary" disabled={busy} onClick={()=>setEditing(null)}>취소</button><button type="submit" className="meditation-icon-button" aria-label="댓글 수정 저장" title="저장" disabled={busy||!editDraft.trim()}><MeditationIcon name="send"/></button></div></form>:<p>{comment.body}</p>}</li>)}</ul>
 <form className="meditation-comment-compose" onSubmit={submit}><textarea aria-label="댓글 쓰기" placeholder="댓글을 입력하세요" rows={1} value={draft} disabled={busy} onChange={event=>{setDraft(event.target.value);pending.current=null;}}/><button type="submit" className="meditation-icon-button" aria-label="댓글 등록" title="등록" disabled={busy||!draft.trim()}><MeditationIcon name="send"/></button></form></div>}
 {error&&<p role="alert">{error}</p>}</div>;
}
