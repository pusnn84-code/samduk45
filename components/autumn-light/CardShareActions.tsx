"use client";
import Image from "next/image";
import {useEffect,useRef,useState} from "react";
import type {AutumnCard} from "../../src/features/autumn-light/types";
import {prayerCardImages} from "./prayer-card-image";
function download(url:string,name:string){const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();}
async function copy(value:string){
 try{await navigator.clipboard.writeText(value);return true;}catch{}
 const t=document.createElement("textarea");t.value=value;t.readOnly=true;t.style.position="fixed";t.style.left="-9999px";document.body.append(t);t.select();let ok=false;try{ok=document.execCommand("copy");}catch{}t.remove();return ok;
}
export function CardShareActions({card}:{card:AutumnCard}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[images,setImages]=useState<{blob:Blob;url:string;name:string}[]>([]),[manual,setManual]=useState("");
 const dialog=useRef<HTMLDialogElement>(null),urls=useRef<string[]>([]);
 const mobile=()=>navigator.maxTouchPoints>0&&matchMedia("(pointer:coarse)").matches;
 function close(){for(const url of urls.current)URL.revokeObjectURL(url);urls.current=[];setImages([]);}
 useEffect(()=>()=>{for(const url of urls.current)URL.revokeObjectURL(url);},[]);
 useEffect(()=>{if(images.length)dialog.current?.showModal();},[images]);
 async function capture(){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const blobs=await prayerCardImages(card),stem="기도카드_"+card.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,"").slice(0,70);
   const data=blobs.map((blob,i)=>({blob,url:URL.createObjectURL(blob),name:stem+(blobs.length>1?"_"+(i+1):"")+".png"}));urls.current=data.map(d=>d.url);
   if(!mobile()&&data.length===1){download(data[0].url,data[0].name);setMessage("그림 다운로드를 시작했습니다.");setTimeout(()=>{for(const url of data.map(d=>d.url))URL.revokeObjectURL(url);},60000);}
   else setImages(data);
  }catch{setMessage("이미지를 만들지 못했습니다. 다시 시도해 주세요.");}finally{setBusy(false);}
 }
 async function saveImage(item:{blob:Blob;url:string;name:string}){
  const file=new File([item.blob],item.name,{type:"image/png"});
  if(mobile()&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:"이분을 위해 기도합시다"});return;}catch(e){if(e instanceof Error&&e.name==="AbortError")return;}}
  download(item.url,item.name);
 }
 async function shareLink(){
  const url=new URL("/pray/"+card.id,location.origin).href;
  if(navigator.share){try{await navigator.share({title:"이분을 위해 기도합시다",text:card.name+"님을 위해 함께 기도해 주세요.",url});return;}catch(e){if(e instanceof Error&&e.name==="AbortError")return;}}
  if(await copy(url))setMessage("기도카드 링크를 복사했습니다.");else setManual(url);
 }
 return <div className="autumn-share-controls"><div className="autumn-share-buttons">
  <button type="button" className="autumn-icon-button" aria-label="기도카드 캡처" title="기도카드 그림으로 저장하기" disabled={busy} onClick={()=>void capture()}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M12 7v10m-4-4 4 4 4-4"/></svg></button>
  <button type="button" className="autumn-icon-button" aria-label="기도카드 링크 공유" title="기도카드 링크 공유하기" onClick={()=>void shareLink()}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></button>
 </div>{message&&<p role="status" className="autumn-share-status">{message}</p>}
 {images.length>0&&<dialog ref={dialog} className="autumn-capture-preview" aria-label="기도카드 이미지" onCancel={e=>{e.preventDefault();e.stopPropagation();close();}} onClose={e=>{e.stopPropagation();close();}}><header><h3>이분을 위해 기도합시다</h3><button type="button" className="text-button" onClick={close}>닫기</button></header><p className="helper-text">이미지를 길게 눌러 저장할 수도 있습니다.</p>{images.map((item,i)=><div key={item.url}><Image unoptimized width={1080} height={900} src={item.url} alt={card.name+"님 기도카드 "+(i+1)}/><button type="button" className="primary-button" onClick={()=>void saveImage(item)}>이미지 저장{images.length>1?" "+(i+1):""}</button></div>)}</dialog>}
 {manual&&<div className="autumn-share-fallback" role="dialog" aria-label="기도카드 링크 복사"><label>기도카드 링크<input readOnly value={manual} onFocus={e=>e.target.select()}/></label><button type="button" className="text-button" onClick={()=>setManual("")}>닫기</button></div>}
 </div>;
}
