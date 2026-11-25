"use client";

import { useEffect, useState } from "react";
import { scriptureSegments, scriptureVerseText } from "../../src/content/scripture-segments";
import books from "../../data/scripture-library/books.json";
import { copyPassage, verseLabel, type VerseRow } from "../../src/content/scripture-library";

export type ReaderChapter = {
  id: string; title: string; abbreviation: string; chapter: number; verses: VerseRow[];
};

export function BibleReader({ title, abbreviation, chapter, startVerse, verses, selectStartVerse = false }: {
  title: string; abbreviation: string; chapter: number; startVerse: number; verses: VerseRow[]; selectStartVerse?: boolean;
}) {
  return <BiblePassageReader title={title} startVerse={startVerse} selectStartVerse={selectStartVerse}
    chapters={[{ id: "scripture", title, abbreviation, chapter, verses }]} />;
}

export function BiblePassageReader({ title, chapters, startVerse = 1, showChapters = false, selectStartVerse = false }: {
  title: string; chapters: ReaderChapter[]; startVerse?: number; showChapters?: boolean; selectStartVerse?: boolean;
}) {
  const [fontSize, setFontSize] = useState(18);
  const [selected, setSelected] = useState<string[]>(()=>{if(!selectStartVerse)return [];const first=chapters[0];const target=first?.verses.find(([start,end,source])=>start<=startVerse&&startVerse<=end&&Boolean(scriptureVerseText(source)));return target?[`${first.id}-${target[0]}`]:[];});
  const [notice, setNotice] = useState("");
  const [manualCopy, setManualCopy] = useState("");
  const [highlights,setHighlights]=useState<Record<string,string>>({});
  const [highlightBusy,setHighlightBusy]=useState(false),[highlightReady,setHighlightReady]=useState(false);
  const references=[...new Set(chapters.map(part=>{const book=books.find(b=>b.short===part.abbreviation);return book?`${book.id}:${part.chapter}`:"";}).filter(Boolean))].join(",");
  useEffect(()=>{
    const controller=new AbortController();let alive=true;
    const refresh=()=>{fetch(`/api/scripture/highlights?references=${encodeURIComponent(references)}`,{cache:"no-store",signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!alive)return;setHighlights(Object.fromEntries(data.highlights.map((r:{book:number;chapter:number;verse:number;color:string})=>[`${r.book}:${r.chapter}:${r.verse}`,r.color])));setHighlightReady(true);}).catch(()=>{if(alive)setNotice("형광펜 기록을 불러오지 못했습니다. 다시 열어 주세요.");});};
    if(references)refresh();window.addEventListener("focus",refresh);
    return ()=>{alive=false;controller.abort();window.removeEventListener("focus",refresh);};
  },[references]);
  function referenceKey(part:ReaderChapter,verse:number){return `${books.find(b=>b.short===part.abbreviation)?.id}:${part.chapter}:${verse}`;}
  async function highlight(color:string|null){
    if(highlightBusy||!highlightReady)return;
    const refs=chapters.flatMap(part=>part.verses.filter(([start])=>selected.includes(`${part.id}-${start}`)).flatMap(([first,last])=>Array.from({length:last-first+1},(_,i)=>({book:books.find(b=>b.short===part.abbreviation)!.id,chapter:part.chapter,verse:first+i}))));
    if(refs.length>400){setNotice("한 번에 400절까지 칠할 수 있습니다. 나누어 선택해 주세요.");return;}
    setHighlightBusy(true);setNotice("");
    try{const r=await fetch("/api/scripture/highlights",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({verses:refs,color})});if(!r.ok)throw Error();setHighlights(current=>{const next={...current};for(const ref of refs){const key=`${ref.book}:${ref.chapter}:${ref.verse}`;if(color)next[key]=color;else delete next[key];}return next;});setSelected([]);setNotice("형광펜을 저장했습니다.");}catch{setNotice("형광펜을 저장하지 못했습니다. 다시 시도해 주세요.");}finally{setHighlightBusy(false);}
  }

  useEffect(() => {
    if (startVerse <= 1) return;
    const firstChapter = chapters[0];
    const target = firstChapter?.verses.find(([first, last, source]) => startVerse >= first && startVerse <= last && Boolean(scriptureVerseText(source)));
    if (target) document.getElementById(`${firstChapter.id}-verse-${target[0]}`)?.scrollIntoView({ block: "start" });
  }, [startVerse, chapters]);

  function toggle(verse: string) {
    setSelected(current => current.includes(verse) ? current.filter(value => value !== verse) : [...current, verse]);
    setNotice("");
    setManualCopy("");
  }

  async function copySelection() {
    const text = copyPassage(chapters.map(part => ({ ...part,
      verses: part.verses.filter(([start]) => selected.includes(`${part.id}-${start}`)),
    })));
    try {
      await navigator.clipboard.writeText(text);
      setNotice("복사했습니다.");
    } catch {
      setManualCopy(text);
    }
  }

  return <article className="scripture-reader card">
    <header>
      <h2>{title}</h2>
      <div className="scripture-reader-controls">
        <span>개역개정</span>
        <div role="group" aria-label="본문 글자 크기">
          <button type="button" aria-label="글자 작게" disabled={fontSize <= 16} onClick={() => setFontSize(size => size - 2)}>−</button>
          <button type="button" aria-label="글자 크게" disabled={fontSize >= 26} onClick={() => setFontSize(size => size + 2)}>+</button>
        </div>
      </div>
      <p className="scripture-hint">복사할 절을 하나씩 눌러 선택하세요.</p>
      {showChapters && <nav className="scripture-passage-chapters" aria-label="오늘 분량의 장 선택">
        {chapters.map(part => <a key={part.id} href={`#${part.id}`}>{part.title}</a>)}
      </nav>}
    </header>
    <div className="scripture-verses" style={{ fontSize: `${fontSize / 16}rem` }}>
      {chapters.map(part => <section key={part.id} id={part.id} aria-label={part.title}>
        {showChapters && <h3 className="scripture-passage-heading">{part.title}</h3>}
        {part.verses.map(([start, end, source]) => {
          let bodyIndex = 0;
          return <div className="scripture-verse-group" key={start}>
            {scriptureSegments(source).map((segment, index) => {
              if (segment.kind === "heading") return <h4 className="scripture-verse-heading" key={index}>{segment.text}</h4>;
              const firstBody = bodyIndex++ === 0;
              return <button className="scripture-verse" type="button" key={index}
                data-highlight={highlights[referenceKey(part,start)]}
                id={firstBody ? `${part.id}-verse-${start}` : `${part.id}-verse-${start}-part-${index}`}
                aria-pressed={selected.includes(`${part.id}-${start}`)} disabled={highlightBusy}
                onClick={() => toggle(`${part.id}-${start}`)}>
                <span className="scripture-verse-number" aria-hidden={!firstBody}>{firstBody ? verseLabel(start,end) : ""}</span>
                <span className="scripture-verse-body"><span className="scripture-verse-mark" data-highlight={highlights[referenceKey(part,start)]}>{segment.text}</span></span>
              </button>;
            })}
          </div>;
        })}
      </section>)}
    </div>
    {selected.length > 0 && <aside className="scripture-copy-bar" aria-label="선택한 절">
      {manualCopy && <label className="scripture-copy-text">
        아래 본문을 선택해 복사하세요.
        <textarea readOnly rows={4} value={manualCopy} onFocus={event => event.target.select()} />
      </label>}
      <div className="scripture-copy-actions" role="toolbar" aria-label="선택한 구절 도구">
        <span className="scripture-selection-count" aria-label={`${selected.length}개 구절 선택`}>{selected.length}개</span>
        <button type="button" className="scripture-clear-selection" disabled={highlightBusy} onClick={() => { setSelected([]); setNotice(""); setManualCopy(""); }}>선택 해제</button>
        <button type="button" className="scripture-tool-icon scripture-marker" aria-label="형광펜 칠하기" title="형광펜 칠하기" disabled={highlightBusy||!highlightReady} onClick={()=>void highlight("yellow")}>
          <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g transform="rotate(38 12 12)"><rect x="7" y="2" width="10" height="11" rx="2"/><path d="M7 6h10M8 13l1 4h6l1-4"/><path d="M9 17v5h3l3-5z" fill="#e6bd38"/></g></svg>
        </button>
        <button type="button" className="scripture-tool-icon" aria-label="형광펜 지우기" title="형광펜 지우기" disabled={highlightBusy||!highlightReady} onClick={()=>void highlight(null)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 3 6 6a2 2 0 0 1 0 3L11 22H5l-4-4a2 2 0 0 1 0-3L12 3a2 2 0 0 1 3 0Z"/><path d="m7 9 10 10M5 22h17"/></svg>
        </button>
        <button type="button" className="scripture-primary" disabled={highlightBusy} onClick={copySelection}>복사하기</button>
      </div>
      {notice && <p className="scripture-tool-notice" role="status">{notice}</p>}
    </aside>}
  </article>;
}
