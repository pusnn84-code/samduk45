"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { isPhotoName } from "../../src/features/community/refinement-policy";
import type { Attachment } from "./shared";
import "./refinement.css";
function Photo({postId,file}:{postId:string;file:Attachment}) {
  const [failed,setFailed]=useState(false);
  return <div className="community-photo">{failed?<div className="helper-text" role="status">사진을 표시하지 못했습니다. <button type="button" className="secondary-button" onClick={()=>setFailed(false)}>사진 다시 불러오기</button></div>:
    // Authenticated, bounded and re-encoded by our image endpoint.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/community/posts/${postId}/files/${file.slot}/image?sha=${file.sha256}`} alt={file.name} decoding="async" loading="lazy" draggable={false} onError={()=>setFailed(true)}/>
  }</div>;
}
function Gallery({postId,photos}:{postId:string;photos:Attachment[]}) {
  const [active,setActive]=useState(0);
  const activeRef=useRef(0);
  const track=useRef<HTMLDivElement>(null);
  const trackId=useId();
  function select(index:number) {
    const next=Math.max(0,Math.min(photos.length-1,index));
    activeRef.current=next;setActive(next);
    track.current?.scrollTo({left:next*track.current.clientWidth,behavior:"instant"});
  }
  useEffect(()=>{
    const element=track.current;
    if(!element)return;
    const observer=new ResizeObserver(()=>element.scrollTo({left:activeRef.current*element.clientWidth,behavior:"instant"}));
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  function keyDown(event:KeyboardEvent<HTMLDivElement>) {
    if(event.target!==event.currentTarget)return;
    const next=event.key==="ArrowRight"?active+1:event.key==="ArrowLeft"?active-1:event.key==="Home"?0:event.key==="End"?photos.length-1:null;
    if(next===null)return;
    event.preventDefault();select(next);
  }
  return <section className="community-photos community-photo-gallery" aria-label="첨부 사진" aria-roledescription="사진 슬라이드">
    <div className="community-photo-window">
      <div ref={track} id={trackId} className="community-photo-track" tabIndex={0} aria-label="사진 넘기기" onKeyDown={keyDown} onScroll={event=>{
        const element=event.currentTarget;
        if(!element.clientWidth)return;
        const index=Math.max(0,Math.min(photos.length-1,Math.round(element.scrollLeft/element.clientWidth)));
        activeRef.current=index;setActive(index);
      }}>
        {photos.map((file,index)=><div key={`${file.slot}-${file.sha256}`} className="community-photo-slide" role="group" aria-roledescription="사진" aria-label={`${index+1} / ${photos.length}`} aria-hidden={index!==active} inert={index!==active}>
          <Photo postId={postId} file={file}/>
        </div>)}
      </div>
      <span className="community-photo-counter" aria-hidden="true">{active+1}/{photos.length}</span>
      <button type="button" className="community-photo-arrow community-photo-previous" aria-label="이전 사진" aria-controls={trackId} disabled={active===0} onClick={()=>select(active-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
      <button type="button" className="community-photo-arrow community-photo-next" aria-label="다음 사진" aria-controls={trackId} disabled={active===photos.length-1} onClick={()=>select(active+1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
    </div>
    <div className="community-photo-dots" aria-label="사진 선택">
      {photos.map((file,index)=><button type="button" key={file.slot} aria-label={`${index+1}번째 사진`} aria-current={index===active?"true":undefined} aria-controls={trackId} onClick={()=>select(index)}><span/></button>)}
    </div>
    <span className="sr-only" role="status" aria-live="polite">{photos.length}장 중 {active+1}번째 사진</span>
  </section>;
}
export function PostPhotos({postId,files}:{postId:string;files:Attachment[]}) {
  const photos=files.filter(file=>isPhotoName(file.name));
  if(!photos.length)return null;
  if(photos.length===1)return <section className="community-photos" aria-label="첨부 사진"><Photo postId={postId} file={photos[0]}/></section>;
  return <Gallery key={photos.map(file=>`${file.slot}-${file.sha256}`).join(":")} postId={postId} photos={photos}/>;
}
