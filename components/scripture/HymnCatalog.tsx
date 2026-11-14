"use client";

import Link from "next/link";
import { useState } from "react";
import { findHymns } from "../../src/content/scripture-library";

const pageSize = 50;

export function HymnCatalog() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const [range, setRange] = useState(0);
  const results = findHymns(query).filter(hymn => !range || (hymn.number >= range && hymn.number <= Math.min(range + 99, 645)));

  return <>
    <h2>찬송가</h2>
    <label className="scripture-search">
      <span>찬송가 검색</span>
      <input type="search" value={query} placeholder="예: 18 또는 성도들아"
        onChange={event => { setQuery(event.target.value); setRange(0); setLimit(pageSize); }} />
    </label>
    <nav className="hymn-number-ranges" aria-label="찬송가 장수 구간">
      {[0, 1, 101, 201, 301, 401, 501, 601].map(start => <button key={start} type="button" aria-pressed={range === start}
        onClick={() => { setRange(start); setQuery(""); setLimit(start ? 100 : pageSize); }}>
        {start ? `${start}–${Math.min(start + 99, 645)}` : "전체"}
      </button>)}
    </nav>
    <p className="scripture-hint" role="status">{results.length}곡{results.length === 0 && " · 일치하는 악보가 없습니다."}</p>
    <ul className="scripture-hymns">
      {results.slice(0, limit).map(hymn => <li key={hymn.number}>
        <Link prefetch={false} href={`/scripture/hymns/${hymn.number}`}>
          <span>{hymn.number}장</span><strong>{hymn.title}</strong><span aria-hidden="true">›</span>
        </Link>
      </li>)}
    </ul>
    {results.length > limit && <button type="button" className="scripture-more" onClick={() => setLimit(value => value + pageSize)}>더 보기</button>}
  </>;
}
