"use client";

import { useEffect, useState } from "react";
import books from "../../data/scripture-library/books.json";
import { copyPassage, verseLabel, type VerseRow } from "../../src/content/scripture-library";

export type ReaderChapter = {
  id: string; title: string; abbreviation: string; chapter: number; verses: VerseRow[];
};

export function BibleReader({ title, abbreviation, chapter, startVerse, verses }: {
  title: string; abbreviation: string; chapter: number; startVerse: number; verses: VerseRow[];
}) {
  return <BiblePassageReader title={title} startVerse={startVerse}
    chapters={[{ id: "scripture", title, abbreviation, chapter, verses }]} />;
}

export function BiblePassageReader({ title, chapters, startVerse = 1, showChapters = false }: {
  title: string; chapters: ReaderChapter[]; startVerse?: number; showChapters?: boolean;
}) {
  const [fontSize, setFontSize] = useState(18);
  const [selected, setSelected] = useState<string[]>([]);
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
    const target = firstChapter?.verses.find(([first, last]) => startVerse >= first && startVerse <= last);
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
        {part.verses.map(([start, end, source]) => <button className="scripture-verse" type="button" key={start}
          data-highlight={highlights[referenceKey(part,start)]} id={`${part.id}-verse-${start}`} aria-pressed={selected.includes(`${part.id}-${start}`)} disabled={highlightBusy} onClick={() => toggle(`${part.id}-${start}`)}>
          <span className="scripture-verse-number">{verseLabel(start, end)}</span>
          <span>{source.split(/(<[^>]+>)/g).map((text, index) => text.startsWith("<") && text.endsWith(">")
            ? <strong className="scripture-verse-heading" key={index}>{text.slice(1, -1)}</strong> : text)}</span>
        </button>)}
      </section>)}
    </div>
    {selected.length > 0 && <aside className="scripture-copy-bar" aria-label="선택한 절">
      {manualCopy && <label className="scripture-copy-text">
        아래 본문을 선택해 복사하세요.
        <textarea readOnly rows={4} value={manualCopy} onFocus={event => event.target.select()} />
      </label>}
      <div className="scripture-highlight-actions" role="group" aria-label="형광펜 색상">
        {[["yellow","노랑"],["green","초록"],["pink","분홍"]].map(([color,label])=><button type="button" key={color} data-color={color} disabled={highlightBusy||!highlightReady} onClick={()=>void highlight(color)}>{label}</button>)}
        <button type="button" disabled={highlightBusy||!highlightReady} onClick={()=>void highlight(null)}>형광펜 지우기</button>
      </div>
      <div className="scripture-copy-actions">
        <span role="status">{notice || `${selected.length}개 구절 선택`}</span>
        <button type="button" onClick={() => { setSelected([]); setNotice(""); setManualCopy(""); }}>선택 해제</button>
        <button type="button" className="scripture-primary" onClick={copySelection}>복사하기</button>
      </div>
    </aside>}
  </article>;
}
