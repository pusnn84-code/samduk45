import type { Metadata } from "next";
import { BibleReadingPage } from "../../../components/bible-reading/BibleReadingPage";
import { todayInSeoul } from "../../../src/features/challenge/date";

export const metadata: Metadata = { title: "성경통독" };

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  return <BibleReadingPage today={todayInSeoul()} initialDate={date} />;
}
