"use client";
import {useState} from "react";
import {HymnCatalog} from "../scripture/HymnCatalog";
import {BibleCatalog} from "../scripture/BibleCatalog";
import {PrayerRequestForm} from "../prayer-requests/PrayerRequestForm";
import {AutumnSamPicker,AutumnRegistration} from "../autumn-light/AutumnForms";
import {MenuHome} from "../app/MenuHome";
import "../scripture/scripture.css";
import "../prayer-requests/prayer-list.css";
import "../autumn-light/autumn-light.css";
const sams=[{id:"sample-11",name:"1-1샘",village:1},{id:"sample-12",name:"1-2샘",village:1},{id:"sample-21",name:"2-1샘",village:2}];
export function ReviewScenes({view}:{view:string}){
 const [village,setVillage]=useState("1"),[register,setRegister]=useState(false);
 return <div className={`community-app${view==="home"?" is-menu-home":""}`}><div className="community-main" style={{marginLeft:0}}>
 <header className="community-header"><button type="button" className="community-menu-button" aria-label="메뉴">☰</button><div><p className="brand-kicker">삼덕교회 45공동체 · 2027년</p><h1>너른 사랑의 해</h1><p className="community-verse">이 강이 이르는 각처에 모든 것이 살 것이며 (에스겔 47:9)</p></div></header>
 <div className="community-content">
 {view==="hymns"?<main className="scripture-library"><HymnCatalog/></main>:view==="bible"?<main className="scripture-library"><BibleCatalog/></main>:view==="prayer"?<main className="shell"><section className="feature-heading"><h2>기도요청</h2><p>함께 마음을 모아 기도합니다.</p></section><PrayerRequestForm/></main>:view==="autumn"?<main className="autumn-light"><header className="autumn-feature-heading"><div><p className="eyebrow">2027 · 너른 사랑의 해</p><h2>가을빛축제</h2></div></header>{register?<AutumnRegistration sams={sams} authorName="미리보기" onRegistered={()=>{}}/>:<><div className="autumn-list-heading"><h3>전체 기도카드 <small>예시</small></h3><button className="primary-button compact-button" onClick={()=>setRegister(true)}>＋ 새 태신자 등록</button></div><label className="autumn-search"><input type="search" placeholder="이름 · 작성자 검색"/></label><AutumnSamPicker sams={sams} village={village} samId="" includeAll villageOnly onVillage={setVillage} onSam={()=>{}}/><article className="autumn-person-card is-compact"><h3>김믿음</h3><p className="autumn-person-meta">1-1샘 · 사랑샘</p><p className="autumn-prayer-text">공동체의 따뜻한 사랑을 경험하도록 함께 기도합니다.</p></article></>}</main>:<MenuHome/>}
 </div></div></div>;
}
