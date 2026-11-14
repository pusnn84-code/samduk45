"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorBox, Loading, useResource, type Folder, type Post, type Viewer } from "./shared";
import { PostDetail } from "./PostDetail";
import { PostEditor } from "./PostEditor";
import { SocialFeed } from "./SocialFeed";
import "./community.css";
import "./doran.css";
export function CommunityClient({user,admin=false}:{user:Viewer;admin?:boolean}) {
  const params=useSearchParams();const router=useRouter();const [revision,setRevision]=useState(0);
  // Role alone must never turn the member interface into a management interface.
  const management=admin && user.role==="admin";
  const basePath=management?"/admin/community":"/community";
  const postId=params.get("post")??"";
  const folders=useResource<{folders:Folder[]}>("/folders",revision,true);
  const detail=useResource<{post:Post}>(postId?`/posts/${encodeURIComponent(postId)}`:null,revision);
  const reload=()=>setRevision(value=>value+1);
  const saved=(id:string)=>{reload();router.replace(`${basePath}?post=${id}`);};
  return <div className="shell community doran">
    <header className="doran-heading"><p className="doran-eyebrow">삼덕사오 · 함께하는 순간들</p><h2>{management ? "도란도란 관리" : "도란도란"}<span aria-hidden="true">.</span></h2><p>우리의 이야기가 머무는 자리</p></header>
    {folders.error?<ErrorBox message={folders.error} retry={reload}/>:!folders.data?<Loading/>:postId?
      detail.error?<ErrorBox message={detail.error} retry={reload}/>:!detail.data?<Loading/>:!management && params.get("edit")==="1" && detail.data.post.authorId===user.id?
      <PostEditor key={`${postId}-${detail.data.post.version}`} post={detail.data.post} folders={folders.data.folders} basePath={basePath} onSaved={saved}/>:
      <PostDetail key={`${postId}-${detail.data.post.version}`} post={detail.data.post} user={user} admin={management} basePath={basePath} reload={reload} onDeleted={()=>{reload();router.replace(basePath);}}/>:
      !management && params.get("new")==="1"?<PostEditor key="new" folders={folders.data.folders} basePath={basePath} onSaved={saved}/>:
      <SocialFeed basePath={basePath} user={user}/>
    }
  </div>;
}
