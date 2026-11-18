import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BibleReader } from "../../../../../../components/scripture/BibleReader";
import { bibleBooks, catalogNumber, type VerseRow } from "../../../../../../src/content/scripture-library";

export const metadata = { title: "성경 본문" };

export default async function BibleChapterPage({ params, searchParams }: {
  params: Promise<{ book: string; chapter: string }>;
  searchParams: Promise<{ verse?: string }>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  const book = bibleBooks[catalogNumber(route.book) - 1];
  const chapter = catalogNumber(route.chapter);
  if (!book?.chapters[chapter - 1]) notFound();

  const data = JSON.parse(await readFile(path.join(process.cwd(), "data", "scripture-library", "bible", `${book.id}.json`), "utf8")) as VerseRow[][];
  const startVerse = catalogNumber(query.verse) || 1;
  const verses = data[chapter - 1];
  const hasVerse = verses.some(([first, last]) => first <= startVerse && startVerse <= last);
  return <>
    <Link className="scripture-back" href="/scripture/bible">‹ 성경 목차</Link>
    {!hasVerse && <p className="scripture-hint">{startVerse}절은 제공된 본문에 없습니다.</p>}
    <BibleReader key={`${book.id}-${chapter}-${startVerse}-${Boolean(query.verse)}`} title={`${book.name} ${chapter}장`} abbreviation={book.short}
      chapter={chapter} startVerse={startVerse} selectStartVerse={Boolean(query.verse) && hasVerse} verses={verses} />
  </>;
}
