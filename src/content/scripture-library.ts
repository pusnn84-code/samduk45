import bookIndex from "../../data/scripture-library/books.json";
import hymnIndex from "../../data/scripture-library/hymns.json";
import { scriptureVerseText } from "./scripture-segments";

export const bibleBooks = bookIndex;
export const hymns = hymnIndex;
export type BibleBook = (typeof bibleBooks)[number];
export type Hymn = (typeof hymns)[number];
export type VerseRow = [start: number, end: number, source: string];

export function catalogNumber(value: string | undefined) {
  return value && /^[1-9][0-9]{0,2}$/.test(value) ? Number(value) : 0;
}

export function findHymn(number: number) {
  return hymns.find(hymn => hymn.number === number);
}

export function findHymns(query: string) {
  const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, "");
  const term = normalize(query);
  const number = /^(\d+)장?$/.exec(term);
  return number ? hymns.filter(hymn => hymn.number === Number(number[1]))
    : hymns.filter(hymn => normalize(hymn.title).includes(term));
}

export function verseLabel(start: number, end: number) {
  return start === end ? String(start) : `${start}-${end}`;
}

export function copyVerse(row: VerseRow, abbreviation: string, chapter: number) {
  return copyPassage([{ abbreviation, chapter, verses: [row] }]);
}

/** Keep the selected text in reading order and append one accurate reference. */
export function copyPassage(parts: { abbreviation: string; chapter: number; verses: VerseRow[] }[]) {
  const texts: string[] = [];
  const references: string[] = [];
  let previousBook = "";
  for (const part of parts) {
    const rows = part.verses.filter(([, , source]) => scriptureVerseText(source)).sort((a, b) => a[0] - b[0]);
    if (!rows.length) continue;
    const ranges: [number, number][] = [];
    for (const [start, end, source] of rows) {
      texts.push(scriptureVerseText(source));
      const last = ranges[ranges.length - 1];
      if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
      else ranges.push([start, end]);
    }
    const book = previousBook === part.abbreviation ? "" : `${part.abbreviation} `;
    references.push(`${book}${part.chapter}:${ranges.map(([start, end]) => verseLabel(start, end)).join(",")}`);
    previousBook = part.abbreviation;
  }
  return texts.length ? `${texts.join("\n")} (${references.join("; ")})` : "";
}
