"use client";
import Link from "next/link";
import type { ProfileData } from "../../src/lib/types";

export function ProfileForm({ initial }: { initial: ProfileData }) {
  return <section className="card">
    <dl className="profile-summary">
      <div><dt>이름</dt><dd>{initial.displayName}</dd></div>
      <div><dt>직분</dt><dd>{initial.position ?? "미지정"}</dd></div>
      <div><dt>샘</dt><dd>{initial.samLabel ?? "미지정"}</dd></div>
      <div><dt>비밀번호</dt><dd>{initial.passwordMode === "initial" ? "초기 비밀번호 사용 중" : "설정한 비밀번호 사용 중"}</dd></div>
    </dl>
    <Link className="primary-button" href="/set-pin">6자리 번호 설정·변경</Link>
    <p className="helper-text">6자리 번호를 설정하면 이 휴대폰에서는 이름 없이 로그인할 수 있습니다.</p>
    <p className="helper-text">이름·직분·샘 정보 수정은 관리자에게 요청해 주세요.</p>
  </section>;
}
