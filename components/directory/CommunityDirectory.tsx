"use client";

import { useId, useState } from "react";
import type { DirectoryMember as CommunityDirectoryMember, DirectorySam, DirectoryVillageLeader } from "../../src/features/directory/service";
import { DirectoryMemberCards } from "./DirectoryMemberCards";
import { DirectorySamAccordion } from "./DirectorySamAccordion";
import "./community-directory.css";

export function CommunityDirectory({ members, sams = [], villageLeaders = [], isSample = false }: { members: CommunityDirectoryMember[]; sams?: DirectorySam[]; villageLeaders?: DirectoryVillageLeader[]; isSample?: boolean }) {
  const [village, setVillage] = useState("");
  const [sam, setSam] = useState("");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const villagePanelPrefix = useId();
  const villages = [...new Set([
    ...members.map(member => member.village || "마을 미등록"),
    ...sams.map(group => group.village || "마을 미등록"),
  ])].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  const roles = ["마을장", "샘리더"];
  const search = query.trim().replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
  const visible = members.filter(member =>
    (!village || (member.village || "마을 미등록") === village)
    && (!sam || member.sam === sam)
    && (!role || member.roles.includes(role))
    && (!search || [member.name, member.churchOffice, member.village, member.sam, ...member.roles]
      .join("").replace(/\s+/g, "").toLocaleLowerCase("ko-KR").includes(search)),
  );


  return <main className="community-directory" aria-labelledby="directory-title">
    <header className="directory-header"><div><p className="directory-eyebrow">삼덕사오 · 서로를 알아가는 공간</p><h2 id="directory-title">우리 공동체<span aria-hidden="true">.</span></h2><p>마을과 샘을 따라 함께하는 사람들을 만나보세요.</p></div><span className="directory-brand-squares" aria-hidden="true"><i /><i /><i /><i /></span></header>
    {isSample && <section className="directory-sample-notice" aria-label="샘플 조직도 안내"><span className="directory-sample-tag">샘플</span><div><h3>샘플 조직도 · 가상 데이터</h3><p>이름·소속·직책·나이·성별·번호는 화면 확인을 위한 가상 정보입니다. 실제 성도 명단이나 연락처는 포함하지 않았습니다.</p><p>모든 전화번호는 예시 번호 010-0000-0000입니다.</p></div></section>}
    {!isSample && <p className="directory-section-helper">등록된 연락처는 로그인한 공동체 회원들이 볼 수 있습니다.</p>}
    <section className="directory-organization" aria-labelledby="directory-organization-title">
      <div className="directory-section-heading"><div><p className="directory-eyebrow">01 · 공동체 조직도</p><h3 id="directory-organization-title">마을과 샘</h3></div><button type="button" className="directory-all-button" aria-pressed={!village} onClick={() => { setVillage(""); setSam(""); }}>전체 마을 <span>{members.length}명</span></button></div>
      <p className="directory-section-helper">마을을 누르면 샘이, 샘을 누르면 샘원 명단이 펼쳐집니다. 한 번 더 누르면 접힙니다.</p>
      <div className="directory-village-grid">
        {villages.map((name, index) => {
          const people = members.filter(member => (member.village || "마을 미등록") === name);
          const headNames = [...new Set([
            ...villageLeaders.filter(head => head.village === name).map(head => head.name),
            ...people.filter(member => member.roles.includes("마을장")).map(member => member.name),
          ])];
          const registeredGroups = sams.filter(group => (group.village || "마을 미등록") === name);
          const samLabels = [...new Set([
            ...people.map(member => member.sam).filter((label): label is string => !!label),
            ...registeredGroups.map(group => group.name),
          ])].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
          return <article className="directory-village" data-village={index % 2 + 1} data-selected={village === name} key={name}>
            <button type="button" id={villagePanelPrefix + index + "-trigger"} className="directory-village-heading" aria-expanded={village === name} aria-controls={villagePanelPrefix + index + "-sams"} onClick={() => { setVillage(village === name ? "" : name); setSam(""); setRole(""); setQuery(""); }}><span className="directory-village-identity"><small>마을</small><span className="directory-village-title"><strong>{name}</strong><span className="directory-village-leader"><span>마을장</span> {headNames.join(" · ") || "미등록"}</span></span></span><span className="directory-village-count">{people.length}<small>명</small><span className="directory-village-toggle" aria-hidden="true">{village === name ? "−" : "＋"}</span></span></button>
            <div className="directory-sam-tree" id={villagePanelPrefix + index + "-sams"} hidden={village !== name} role="group" aria-labelledby={villagePanelPrefix + index + "-trigger"}>
              {samLabels.map(label => {
                const registeredGroup = registeredGroups.find(group => group.name === label);
                const leaderName = registeredGroup
                  ? registeredGroup.leaderName
                  : people.filter(member => member.sam === label && member.roles.includes("샘리더")).map(member => member.name).join(" · ");
                const samMembers = people.filter(member => member.sam === label);
                return <DirectorySamAccordion key={label} label={label} leaderName={leaderName || "리더 미등록"} count={samMembers.length}
                  open={village === name && sam === label}
                  onToggle={() => { setVillage(name); setSam(village === name && sam === label ? "" : label); setRole(""); setQuery(""); }}>
                  {samMembers.length ? <DirectoryMemberCards members={samMembers} compact /> : <p className="directory-sam-empty">아직 등록된 샘원이 없습니다.</p>}
                </DirectorySamAccordion>;
              })}
            </div>
          </article>;
        })}
      </div>
    </section>
    {!sam && <details className="directory-members directory-member-search">
      <summary>구성원 검색 <span>이름·직책으로 찾기</span></summary>
      <section aria-labelledby="directory-members-title">
      <div className="directory-section-heading"><div><p className="directory-eyebrow">02 · 함께하는 사람들</p><h3 id="directory-members-title">{village || "구성원 검색"}</h3></div><button type="button" className="directory-reset" onClick={() => { setVillage(""); setSam(""); setRole(""); setQuery(""); }}>선택 초기화</button></div>
      <div className="directory-search-controls">
        <div className="directory-search"><label htmlFor="directory-query">구성원 검색</label><input id="directory-query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="이름, 직책, 마을과 샘 검색" /></div>
        <div className="directory-role-select"><label htmlFor="directory-role">그룹 직책</label><select id="directory-role" value={role} onChange={event => setRole(event.target.value)}><option value="">전체 직책</option>{roles.map(label => <option key={label} value={label}>{label}</option>)}</select></div>
      </div>
      {query.trim() || role ? <><p role="status" className="directory-results-heading">전체 {members.length}명 중 {visible.length}명</p>
      <DirectoryMemberCards members={visible} />
      {visible.length === 0 && <p className="directory-empty">조건에 맞는 구성원이 없습니다.</p>}</> : <p className="directory-section-helper">이름을 입력하거나 마을장·샘리더를 선택하면 검색 결과가 표시됩니다.</p>}
      </section>
    </details>}
  </main>;
}
