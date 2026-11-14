"use client";
import { useEffect, useRef } from "react";
import { useMenuActivity } from "../app/MenuActivityProvider";

export function SharingActivityView({date,observedAt}:{date:string;observedAt?:string}) {
  const marker=useRef<HTMLSpanElement>(null);
  const {markViewed}=useMenuActivity();
  useEffect(()=>{
    if(!observedAt || !marker.current)return;
    let sent=false;
    const observer=new IntersectionObserver(entries=>{
      if(sent || document.visibilityState!=="visible" || !entries.some(entry=>entry.isIntersecting))return;
      sent=true;
      void markViewed("reading",observedAt,date).catch(()=>{sent=false;});
    });
    observer.observe(marker.current);
    return ()=>observer.disconnect();
  },[date,observedAt,markViewed]);
  return <span ref={marker} aria-hidden="true" style={{display:"block",height:1}}/>;
}
