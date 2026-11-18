"use client";
import { useEffect,useState } from "react";
import { fetchJson } from "../../src/lib/fetch-json";
import type { ListedPrayer } from "../../src/features/prayer-requests/community-list";
import { prayerVisibilityLabels } from "../../src/features/prayer-requests/visibility";
export function PrayerList({revision}:{revision:number}) {
  const [page,setPage]=useState(0);
  const [data,setData]=useState<{items:ListedPrayer[];hasMore:boolean}|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();let busy=false;
    async function load(){
      if(busy||controller.signal.aborted||document.visibilityState==="hidden")return;
      busy=true;
      try {const body=await fetchJson<{items:ListedPrayer[];hasMore:boolean}>(`/api/prayer-requests/list?page=${page}`,{cache:"no-store",signal:controller.signal});if(!controller.signal.aborted){setData(body);setError("");}}
      catch {if(!controller.signal.aborted)setError("기도목록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.");}
      finally{busy=false;}
    }
    void load();const timer=window.setInterval(()=>void load(),30000);window.addEventListener("focus",load);document.addEventListener("visibilitychange",load);
    return()=>{controller.abort();clearInterval(timer);window.removeEventListener("focus",load);document.removeEventListener("visibilitychange",load);};
  },[page,revision]);
  return <section className="community-prayer-list" aria-label="기도목록"><h2>기도목록</h2><p className="helper-text">공개로 나눈 기도내용입니다. 무명을 선택한 분의 이름은 표시되지 않습니다. 목사님은 비공개 글과 실제 이름도 확인할 수 있습니다.</p>
    {error&&<p role="alert" className="error-text">{error}</p>}
    {!data&&!error&&<p role="status">기도목록을 불러오고 있습니다.</p>}
    {data?.items.map(item=><article key={item.id} className="card public-prayer"><header><strong>{item.authorName}</strong><span>{prayerVisibilityLabels[item.visibility]}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</time></header><p className="prayer-request-body">{item.content}</p></article>)}
    {data?.items.length===0&&<p className="card empty-state">아직 나눈 기도내용이 없습니다.</p>}
    {(page>0||data?.hasMore)&&<nav className="prayer-request-actions" aria-label="기도목록 페이지"><button type="button" className="text-button" disabled={page===0} onClick={()=>{setData(null);setPage(v=>v-1);}}>이전</button><span>{page+1}페이지</span><button type="button" className="text-button" disabled={!data?.hasMore} onClick={()=>{setData(null);setPage(v=>v+1);}}>다음</button></nav>}
  </section>;
}
