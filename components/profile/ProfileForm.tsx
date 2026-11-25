"use client";
import Link from "next/link";
import {useState,type FormEvent} from "react";
import type { ProfileData } from "../../src/lib/types";

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const [birthDate,setBirthDate]=useState(initial.birthDate??""),[phone,setPhone]=useState(initial.phone??""),[phonePrivate,setPhonePrivate]=useState(initial.phonePrivate??false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function save(event:FormEvent){event.preventDefault();setBusy(true);setMessage("");try{const r=await fetch("/api/profile/details",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({birthDate:birthDate||null,phone,phonePrivate})});if(!r.ok){const data=await r.json();throw new Error(data.code==="PHONE_CONFLICT"?"같은 이름과 연락처가 이미 등록되어 있습니다. 목사님께 확인해 주세요.":"정보를 저장하지 못했습니다. 입력 내용을 확인해 주세요.");}setMessage("내 정보를 저장했습니다.");}catch(e){setMessage(e instanceof Error?e.message:"저장하지 못했습니다.");}finally{setBusy(false);}}
  return <section className="card">
    <dl className="profile-summary">
      <div><dt>이름</dt><dd>{initial.displayName}</dd></div>
      <div><dt>직분</dt><dd>{initial.position ?? "미지정"}</dd></div>
      <div><dt>샘</dt><dd>{initial.samLabel ?? "미지정"}</dd></div>
      <div><dt>비밀번호</dt><dd>{initial.passwordMode === "initial" ? "초기 비밀번호 사용 중" : "설정한 비밀번호 사용 중"}</dd></div>
    </dl>
    <form onSubmit={save} className="profile-edit-form">
      <label>생년월일<input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} disabled={busy}/></label>
      <label>휴대폰 번호<input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy} required placeholder="01012345678"/></label>
      <label><input type="checkbox" checked={phonePrivate} onChange={e=>setPhonePrivate(e.target.checked)} disabled={busy}/>연락처 비공개</label>
      <p className="helper-text">비공개로 선택하면 다른 구성원의 명단에 연락처가 표시되지 않습니다. 목사님은 확인할 수 있습니다. 번호를 바꿔도 간편비밀번호는 그대로입니다.</p>
      <button className="primary-button" type="submit" disabled={busy}>{busy?"저장 중…":"내 정보 저장"}</button>
      {message&&<p role="status">{message}</p>}
    </form>
    <Link className="primary-button" href="/set-pin">6자리 번호 설정·변경</Link>
    <p className="helper-text">6자리 번호를 설정하면 이 휴대폰에서는 이름 없이 로그인할 수 있습니다.</p>
    <p className="helper-text">이름·직분·샘 정보 수정은 관리자에게 요청해 주세요.</p>
  </section>;
}
