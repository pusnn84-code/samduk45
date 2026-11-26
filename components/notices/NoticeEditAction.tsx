"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {AdminNoticeEditor} from "../admin/notices/AdminNoticeEditor";
import type {MemberNoticeDetail,AdminNoticeRow} from "../../src/features/notices/types";
import "./notice-actions.css";
export function NoticeEditAction({notice}:{notice:MemberNoticeDetail}){
 const [editing,setEditing]=useState(false),[removing,setRemoving]=useState(false),[error,setError]=useState("");const router=useRouter();
 const row:AdminNoticeRow={...notice,status:"published",createdAt:notice.publishedAt,updatedAt:notice.publishedAt,readCount:0,targetActiveUsers:0};
 async function remove(){if(removing||!window.confirm("‘"+notice.title+"’ 공지를 삭제할까요?"))return;setRemoving(true);setError("");try{const response=await fetch("/api/admin/notices/"+encodeURIComponent(notice.id),{method:"DELETE"});if(!response.ok)throw Error();router.replace("/notices");router.refresh();}catch{setError("공지를 삭제하지 못했습니다. 다시 시도해 주세요.");setRemoving(false);}}
 return <section className="notice-inline-edit">
  {!editing?<div className="notice-action-buttons"><button type="button" className="primary-button" disabled={removing} onClick={()=>{setError("");setEditing(true);}}>공지 수정</button><button type="button" className="secondary-button" disabled={removing} onClick={()=>void remove()}>{removing?"삭제 중…":"공지 삭제"}</button></div>:<AdminNoticeEditor notice={row} onCancel={()=>setEditing(false)} onSaved={()=>{setEditing(false);router.refresh();}}/>}
  {error&&<p role="alert" className="error-text">{error}</p>}
 </section>;
}
