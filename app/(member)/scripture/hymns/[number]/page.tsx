import Link from "next/link";
import { notFound } from "next/navigation";
import { HymnScore } from "../../../../../components/scripture/HymnScore";
import { catalogNumber, findHymn } from "../../../../../src/content/scripture-library";

import {ScriptureNavigation} from "../../../../../components/scripture/ScriptureNavigation";
import {hymnNeighbors} from "../../../../../src/content/scripture-navigation";

export const metadata = { title: "찬송가 악보" };

export default async function HymnScorePage({ params }: { params: Promise<{ number: string }> }) {
  const hymn = findHymn(catalogNumber((await params).number));
  if (!hymn) notFound();
  return <>
    <Link className="scripture-back" href="/scripture/hymns">‹ 찬송가 목록</Link>
    <HymnScore key={hymn.number} hymn={hymn} />
    <ScriptureNavigation neighbors={hymnNeighbors(hymn.number)} label="찬송가 장 이동"/>
  </>;
}
