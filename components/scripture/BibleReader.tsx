"use client";

import { useEffect, useState } from "react";
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
          id={`${part.id}-verse-${start}`} aria-pressed={selected.includes(`${part.id}-${start}`)} onClick={() => toggle(`${part.id}-${start}`)}>
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
      <div className="scripture-copy-actions">
        <span role="status">{notice || `${selected.length}개 구절 선택`}</span>
        <button type="button" onClick={() => { setSelected([]); setNotice(""); setManualCopy(""); }}>선택 해제</button>
        <button type="button" className="scripture-primary" onClick={copySelection}>복사하기</button>
      </div>
    </aside>}
  </article>;
}
