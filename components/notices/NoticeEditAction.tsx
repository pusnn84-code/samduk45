"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {AdminNoticeEditor} from "../admin/notices/AdminNoticeEditor";
import type {MemberNoticeDetail,AdminNoticeRow} from "../../src/features/notices/types";
export function NoticeEditAction({notice}:{notice:MemberNoticeDetail}){
 const [editing,setEditing]=useState(false);const router=useRouter();
 const row:AdminNoticeRow={...notice,status:"published",createdAt:notice.publishedAt,updatedAt:notice.publishedAt,readCount:0,targetActiveUsers:0};
 return <section className="notice-inline-edit">
  {!editing?<button type="button" className="primary-button" onClick={()=>setEditing(true)}>공지 수정</button>:<AdminNoticeEditor notice={row} onCancel={()=>setEditing(false)} onSaved={()=>{setEditing(false);router.refresh();}}/>}
 </section>;
}
