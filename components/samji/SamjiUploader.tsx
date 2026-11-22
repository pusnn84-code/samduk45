"use client";
import {useState,type ChangeEvent} from 'react';
import {Content,PDF_LIMIT,type SamjiBlock} from '../../src/features/samji/policy';
import {starter,starterHash,lyrics246} from '../../src/features/samji/starter';
import {parseSamjiText} from '../../src/features/samji/parse';
declare global{interface Window{samjiPdfText?:(file:File)=>Promise<string>}}
let loader:Promise<void>|null=null;
function loadParser(){if(window.samjiPdfText)return Promise.resolve();loader??=new Promise<void>((resolve,reject)=>{const script=document.createElement('script');script.type='module';script.src='/samji-pdf-client.mjs';script.onload=()=>resolve();script.onerror=()=>{loader=null;script.remove();reject(Error('PDF_READER_UNAVAILABLE'));};document.head.append(script);});return loader;}
export function SamjiUploader({onCreated,onClose}:{onCreated:(id:string)=>void;onClose:()=>void}){
 const [file,setFile]=useState<File|null>(null),[date,setDate]=useState(''),[title,setTitle]=useState(''),[content,setContent]=useState<SamjiBlock[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function change(id:string,patch:Partial<SamjiBlock>){setContent(value=>value.map(b=>b.id===id?{...b,...patch}:b));}
 async function pick(event:ChangeEvent<HTMLInputElement>){const pdf=event.target.files?.[0];if(!pdf)return;setMessage('');if(pdf.size>PDF_LIMIT||!pdf.name.toLowerCase().endsWith('.pdf')){setMessage('3MB 이하의 PDF를 선택해 주세요.');return;}setBusy(true);setFile(pdf);
  try{const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await pdf.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
   const parsed=hash===starterHash?structuredClone(starter):await(async()=>{await loadParser();if(!window.samjiPdfText)throw Error();return parseSamjiText(await window.samjiPdfText(pdf),pdf.name);})();setDate(parsed.date);setTitle(parsed.title);setContent(parsed.content);setMessage('본문과 질문을 확인한 뒤 게시해 주세요. 그림으로 된 글이나 가사는 직접 보완해야 할 수 있습니다.');
  }catch{setDate(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));setTitle(pdf.name.replace(/\.pdf$/i,''));setContent([{id:crypto.randomUUID(),kind:'text',heading:'말씀',text:''},{id:crypto.randomUUID(),kind:'question',heading:'나눔 질문',text:''}]);setMessage('글자를 자동으로 정리하지 못했습니다. PDF를 확인해 본문과 질문을 입력해 주세요.');}finally{setBusy(false);}
 }
 function add(kind:SamjiBlock['kind']){setContent(v=>[...v,{id:crypto.randomUUID(),kind,heading:kind==='question'?'나눔 질문':kind==='scripture'?'성경본문':kind==='hymn'?'함께 찬양':'',text:'',...(kind==='hymn'?{hymnNumber:246,lyrics:lyrics246}:{})}]);}
 async function publish(){if(!file||busy)return;const parsed=Content.safeParse(content);if(!parsed.success||!date||!title.trim()){setMessage('날짜·제목·질문과 찬송가 가사를 확인해 주세요.');return;}setBusy(true);setMessage('');
  try{const form=new FormData();form.set('pdf',file);form.set('document',JSON.stringify({id:crypto.randomUUID(),date,title,content:parsed.data}));const response=await fetch('/api/samji',{method:'POST',body:form});if(!response.ok)throw Error();const result=await response.json();onCreated(result.id);}catch{setMessage('게시하지 못했습니다. 내용은 그대로 남아 있습니다. 다시 시도해 주세요.');}finally{setBusy(false);}
 }
 return <section className="card samji-upload" aria-label="샘지 PDF 올리기"><div className="samji-heading"><h2>샘지 PDF 올리기</h2><button type="button" className="text-button" disabled={busy} onClick={onClose}>닫기</button></div>
 <label>PDF 선택 (3MB 이하)<input type="file" accept="application/pdf,.pdf" onChange={event=>void pick(event)} disabled={busy}/></label>
 {busy&&<p role="status">자료를 정리하고 있습니다…</p>}{message&&<p role="status">{message}</p>}
 {file&&<><div className="samji-meta-fields"><label>자료 날짜<input type="date" required value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label><label>말씀 제목<input maxLength={120} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/></label></div>
 <p className="helper-text">질문은 아래에 답변칸이 생깁니다. 게시한 자료는 기존 기록이 바뀌지 않도록 그대로 보관합니다.</p>
 {content.map((b,index)=><fieldset className="samji-edit-block" key={b.id} disabled={busy}><legend>{index+1}. {({text:'글',question:'질문',scripture:'성경본문',hymn:'찬송가'})[b.kind]}</legend><label>구분 제목 (선택)<input value={b.heading} maxLength={100} onChange={e=>change(b.id,{heading:e.target.value})}/></label><label>{b.kind==='question'?'질문 내용':b.kind==='hymn'?'찬송가 제목':'본문'}<textarea rows={b.kind==='question'?3:7} value={b.text} onChange={e=>change(b.id,{text:e.target.value})}/></label>
 {b.kind==='hymn'&&<><label>찬송가 번호<input type="number" min={1} max={645} value={b.hymnNumber??''} onChange={e=>{const n=Number(e.target.value);change(b.id,{hymnNumber:n,...(!b.lyrics&&n===246?{lyrics:lyrics246}:{})});}}/></label><label>찬송가 가사<textarea rows={12} value={b.lyrics??''} onChange={e=>change(b.id,{lyrics:e.target.value})}/></label></>}
 <div className="samji-edit-actions"><button type="button" className="text-button" disabled={index===0} onClick={()=>setContent(v=>{const next=[...v];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>위로</button><button type="button" className="text-button" disabled={index===content.length-1} onClick={()=>setContent(v=>{const next=[...v];[next[index],next[index+1]]=[next[index+1],next[index]];return next;})}>아래로</button><button type="button" className="text-button" onClick={()=>setContent(v=>v.filter(item=>item.id!==b.id))}>항목 삭제</button></div></fieldset>)}
 <div className="samji-edit-actions">{(['question','text','scripture','hymn'] as const).map(kind=><button key={kind} type="button" className="text-button" disabled={busy||content.length>=80} onClick={()=>add(kind)}>{({question:'질문',text:'설명',scripture:'성경본문',hymn:'찬송가'})[kind]} 추가</button>)}</div>
 <button type="button" className="primary-button" disabled={busy} onClick={()=>void publish()}>확인한 자료 게시하기</button></>}
 </section>;
}
