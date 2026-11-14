import { BirthdayPage } from "../../../components/birthdays/BirthdayPage";
import { getBirthdays } from "../../../src/features/birthdays/service";
export const metadata = { title: "오늘의 생일" };
export const dynamic = "force-dynamic";
export default async function BirthdaysPage() { return <BirthdayPage data={await getBirthdays()} />; }
