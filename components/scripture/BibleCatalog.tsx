"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bibleBooks } from "../../src/content/scripture-library";

const bookGroups = [
  { label: "구약 · 율법서", from: 0, to: 5 },
  { label: "역사서", from: 5, to: 17 },
  { label: "시가서", from: 17, to: 22 },
  { label: "대예언서", from: 22, to: 27 },
  { label: "소예언서", from: 27, to: 39 },
  { label: "신약 · 복음서", from: 39, to: 43 },
  { label: "역사서", from: 43, to: 44 },
  { label: "바울서신", from: 44, to: 57 },
  { label: "공동서신", from: 57, to: 65 },
  { label: "예언서", from: 65, to: 66 },
];

export function BibleCatalog() {
  const router = useRouter();
  const [bookId, setBookId] = useState(1);
  const [chapter, setChapter] = useState(1);
  const [verse, setVerse] = useState(1);
  const [keypadOpen, setKeypadOpen] = useState(true);
  const [target, setTarget] = useState<"chapter" | "verse">("chapter");
  const [digits, setDigits] = useState("");
  const chapterList = useRef<HTMLDivElement>(null);
  const verseList = useRef<HTMLDivElement>(null);
  const book = bibleBooks[bookId - 1];
  const verseCount = book.chapters[chapter - 1];
  const maximum = target === "chapter" ? book.chapters.length : verseCount;
  const invalid = digits !== "" && (Number(digits) < 1 || Number(digits) > maximum);

  useEffect(() => {
    chapterList.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
  }, [chapter, bookId]);

  useEffect(() => {
    verseList.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
  }, [verse, chapter, bookId]);

  function chooseBook(id: number) {
    setBookId(id);
    setChapter(1);
    setVerse(1);
    setTarget("chapter");
    setDigits("");
  }

  function chooseChapter(number: number) {
    setChapter(number);
    setVerse(1);
    setTarget("verse");
    setDigits("");
  }

  function changeDigits(next: string) {
    setDigits(next);
    const number = Number(next);
    if (!next || number < 1 || number > maximum) return;
    if (target === "chapter") {
      setChapter(number);
      setVerse(1);
    } else {
      setVerse(number);
    }
  }

  function chooseTarget(next: "chapter" | "verse") {
    if (next === "verse" && target === "verse" && !invalid) {
      router.push(`/scripture/bible/${book.id}/${chapter}?verse=${verse}`);
      return;
    }
    setTarget(next);
    setDigits("");
  }

  return <section className="scripture-finder" aria-labelledby="scripture-finder-title">
    <header className="scripture-finder-header">
      <h2 id="scripture-finder-title">성경찾기</h2>
      <Link href="/scripture" aria-label="성경찾기 닫기">×</Link>
    </header>
    <div className="scripture-finder-columns">
      <section aria-labelledby="finder-books-title">
        <h3 id="finder-books-title">성경 66권</h3>
        <div className="scripture-finder-list scripture-finder-books">
          {bookGroups.map(group => <section key={group.from} aria-label={group.label}>
            <h4>{group.label}</h4>
            {bibleBooks.slice(group.from, group.to).map(item => <button key={item.id} type="button"
              aria-pressed={bookId === item.id} onClick={() => chooseBook(item.id)}>
              <small aria-hidden="true" data-testament={item.id > 39 ? "new" : "old"}>{item.short}</small><span>{item.name}</span>
            </button>)}
          </section>)}
        </div>
      </section>
      <section aria-labelledby="finder-chapters-title">
        <h3 id="finder-chapters-title">장</h3>
        <div ref={chapterList} className="scripture-finder-list">
          {Array.from({ length: book.chapters.length }, (_, index) => index + 1).map(number =>
            <button type="button" key={number} aria-pressed={chapter === number} onClick={() => chooseChapter(number)}>{number}장</button>,
          )}
        </div>
      </section>
      <section aria-labelledby="finder-verses-title">
        <h3 id="finder-verses-title">절</h3>
        <div ref={verseList} className="scripture-finder-list">
          {Array.from({ length: verseCount }, (_, index) => index + 1).map(number =>
            <button type="button" key={number} aria-pressed={verse === number} onClick={() => {
              setVerse(number); setTarget("verse"); setDigits("");
              router.push(`/scripture/bible/${book.id}/${chapter}?verse=${number}`);
            }}>{number}절</button>,
          )}
        </div>
      </section>
    </div>
    <footer className="scripture-finder-footer">
      <div className="scripture-finder-selection">
        <strong role="status">{book.name} {target === "chapter" && digits ? digits : chapter}장 {target === "verse" && digits ? digits : verse}절</strong>
        <button type="button" className="scripture-keypad-toggle" aria-expanded={keypadOpen}
          aria-controls="scripture-keypad" onClick={() => setKeypadOpen(open => !open)}
          aria-label={keypadOpen ? "숫자 키패드 숨기기" : "숫자 키패드 열기"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="2" y="4" width="20" height="12" rx="1" /><path d="M5 8h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h6m2 0h2M8 20l4 2 4-2" />
          </svg>
        </button>
      </div>
      {invalid && <p className="scripture-keypad-error" role="alert">1~{maximum}{target === "chapter" ? "장" : "절"} 사이의 번호를 입력하세요.</p>}
      {keypadOpen && <div id="scripture-keypad" className="scripture-keypad" aria-label="장·절 숫자 입력">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(number => <button className={`scripture-key-${number}`} type="button" key={number}
          onClick={() => changeDigits((digits + number).slice(0, 3))}>{number}</button>)}
        <button className="scripture-key-chapter" type="button" aria-pressed={target === "chapter"} aria-label="장 번호 입력"
          onClick={() => chooseTarget("chapter")}>{target === "chapter" && digits ? digits : chapter}장</button>
        <button className="scripture-key-verse" type="button" aria-pressed={target === "verse"} aria-label="절 번호 입력"
          onClick={() => chooseTarget("verse")}>{target === "verse" && digits ? digits : verse}절</button>
        <button className="scripture-key-backspace" type="button" aria-label="입력한 숫자 한 자리 지우기"
          onClick={() => changeDigits(digits.slice(0, -1))}>⌫</button>
      </div>}
    </footer>
  </section>;
}
