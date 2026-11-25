"use client";
import { useId, useRef, useState } from "react";
import type { DirectoryMember as CommunityDirectoryMember } from "../../src/features/directory/service";
import { copyDirectoryPhone } from "./directory-state";

export function DirectoryMemberCards({ members, compact = false }: { members: CommunityDirectoryMember[]; compact?: boolean }) {
  const phonePrefix = useId();
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ id: string; success: boolean } | null>(null);
  const phones = useRef<Record<string, HTMLInputElement | null>>({});
  async function copyPhone(member: CommunityDirectoryMember) {
    if (copyingId || !member.phone) return;
    setCopyingId(member.id);
    const success = await copyDirectoryPhone(member.phone, navigator.clipboard);
    setCopyResult({ id: member.id, success });
    setCopyingId(null);
    if (!success) {
      phones.current[member.id]?.focus();
      phones.current[member.id]?.select();
    }
  }

  return <div className={compact ? "directory-member-grid directory-member-grid-inline" : "directory-member-grid"}>{members.map(member =>
        <article className="directory-member-card" key={member.id} aria-label={member.name + " " + (member.churchOffice || "성도")}>
          <header className="directory-member-heading"><span className="directory-avatar" aria-hidden="true">{Array.from(member.name)[0]}</span><div>{!compact && <p className="directory-member-location">{member.village || "마을 미등록"} / {member.sam || "샘 미등록"}</p>}<h4>{member.name}<small>{member.churchOffice || "직분 미등록"}</small></h4>{compact && <p className="directory-inline-roles">{member.roles.join(" · ") || "샘원"}</p>}</div></header>
          {!compact && <dl className="directory-member-basics"><div><dt>마을</dt><dd>{member.village || "미등록"}</dd></div><div><dt>샘</dt><dd>{member.sam || "미등록"}</dd></div><div><dt>그룹 직책</dt><dd>{member.roles.join(" · ") || "샘원"}</dd></div><div><dt>교회 직분</dt><dd>{member.churchOffice || "미등록"}</dd></div></dl>}
          <details className="directory-member-details"><summary>연락처와 상세 정보 보기 <span aria-hidden="true">＋</span></summary><div className="directory-detail-content">
            <dl className="directory-extra-fields"><div><dt>나이</dt><dd>{member.age === null ? "미등록" : member.age + "세"}</dd></div><div><dt>성별</dt><dd>{member.gender || "미등록"}</dd></div></dl>
            <div className="directory-phone-field"><label htmlFor={phonePrefix + "-" + member.id}>핸드폰</label>{member.phone ? <><div><input id={phonePrefix + "-" + member.id} ref={node => { phones.current[member.id] = node; }} readOnly value={member.phone} aria-label={member.name + " 핸드폰, 클릭해서 복사"} onFocus={event => event.currentTarget.select()} onClick={() => void copyPhone(member)} onKeyDown={event => { if (event.key === "Enter") void copyPhone(member); }} /><button type="button" disabled={copyingId !== null} onClick={() => void copyPhone(member)}>{copyingId === member.id ? "복사 중" : "번호 복사"}</button></div><p role="status" className="directory-copy-status">{copyResult?.id === member.id ? copyResult.success ? "번호를 복사했습니다." : "위 번호를 선택해 직접 복사해 주세요." : "번호를 누르면 복사할 수 있습니다."}</p></> : <p>{member.contactStatus === "private" ? "비공개" : member.contactStatus === "unavailable" ? "연락처를 불러오지 못했습니다." : "미등록"}</p>}</div>
          </div></details>
        </article>,
  )}</div>;
}
