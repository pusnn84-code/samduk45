"use client";

import { useRef, useState } from "react";
import type { Hymn } from "../../src/content/scripture-library";

export function HymnScore({ hymn }: { hymn: Hymn }) {
  const [score, setScore] = useState(0);
  const [zoom, setZoom] = useState(100);
  const viewport = useRef<HTMLDivElement>(null);
  const title = `${hymn.number}장 ${hymn.title}`;

  return <>
    <h2>{title}</h2>
    <div className="scripture-score card">
      {hymn.files.length > 1 && <label>
        악보 선택
        <select value={score} onChange={event => { setScore(Number(event.target.value)); viewport.current?.scrollTo(0, 0); }}>
          {hymn.files.map((file, index) => <option value={index} key={file}>악보 {index + 1}</option>)}
        </select>
      </label>}
      <div className="scripture-score-tools" role="group" aria-label="악보 확대">
        {[100, 150, 200].map(size => <button key={size} type="button" aria-pressed={size === zoom} onClick={() => setZoom(size)}>
          {size === 100 ? "화면 맞춤" : `${size}%`}
        </button>)}
      </div>
      <div ref={viewport} className="scripture-score-viewport" tabIndex={0} aria-label={title + " 악보"} role="region">
        {/* The authenticated endpoint supplies a pre-optimized score. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/scripture/hymn-score/${hymn.files[score]}`} alt={title + " 악보"} style={{ width: `${zoom}%` }} />
      </div>
    </div>
  </>;
}
