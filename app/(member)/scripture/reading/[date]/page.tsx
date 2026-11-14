import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BiblePassageReader, type ReaderChapter } from "../../../../../components/scripture/BibleReader";
import { getBibleReadingDay } from "../../../../../src/content/bible-reading-plan";
import { getBibleReadingChapters } from "../../../../../src/content/bible-reading-links";
import type { VerseRow } from "../../../../../src/content/scripture-library";

export const metadata = { title: "성경통독 본문" };

export default async function ReadingPassagePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const day = getBibleReadingDay(date);
  if (!day) notFound();
  const references = getBibleReadingChapters(day.passage);
  if (!references.length) notFound();
  const data = new Map(await Promise.all([...new Set(references.map(part => part.book))].map(async book => [book,
    JSON.parse(await readFile(path.join(process.cwd(), "data", "scripture-library", "bible", `${book}.json`), "utf8")) as VerseRow[][],
  ] as const)));
  const chapters: ReaderChapter[] = references.map(part => ({
    id: `reading-${part.book}-${part.chapter}`, title: part.label,
    abbreviation: part.abbreviation, chapter: part.chapter, verses: data.get(part.book)![part.chapter - 1],
  }));
  return <>
    <Link className="scripture-back" href={`/bible-reading?date=${date}`}>‹ 성경통독으로 돌아가기</Link>
    <p className="scripture-hint">{Number(date.slice(5, 7))}월 {Number(date.slice(8, 10))}일 통독 본문</p>
    <BiblePassageReader title={day.passage} chapters={chapters} showChapters />
    <Link className="scripture-back" href={`/bible-reading?date=${date}`}>통독표로 돌아가 완료 체크하기 ›</Link>
  </>;
}
