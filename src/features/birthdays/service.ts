import { getDb, rows, sql } from "../pastoral/db";
import { getCurrentSessionUser } from "../auth/http-session";
import { DomainError } from "../../lib/http";
import { birthdayDays, birthdayOnYear, groupBirthdays, seoulDate, type BirthdaySource } from "./dates";
import { visibleDirectoryVillage } from "../directory/visibility";

export async function getBirthdays(now = new Date()) {
  if (!await getCurrentSessionUser()) throw new DomainError("UNAUTHORIZED", 401);
  const today = seoulDate(now);
  const next = new Date(today + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  const tomorrow = next.toISOString().slice(0,10);
  const dates = [...birthdayDays(today), tomorrow];
  const keys = new Set(dates.map(date => Number(date.slice(5, 7)) * 100 + Number(date.slice(8))));
  if (dates.some(date => date.endsWith("02-28") && birthdayOnYear("2000-02-29", Number(date.slice(0, 4))) === date)) keys.add(229);
  const matches = await rows<BirthdaySource>(getDb(), sql`
    select id,source_name as name,position as "churchOffice",village,sam_label as sam,birth_date::text as "birthDate"
    from prayer_app.member_roster where is_active and birth_date is not null
      and (extract(month from birth_date)::int*100+extract(day from birth_date)::int) in (${sql.join([...keys].map(key => sql`${key}`), sql`,`)})
  `);
  const people = matches.filter(person => visibleDirectoryVillage(person.village)).map(person => ({
    ...person, village: /^\d+$/.test(person.village!) ? person.village + "마을" : person.village,
    sam: person.sam && /^\d+-\d+$/.test(person.sam) ? person.sam + "샘" : person.sam,
  }));
  const groups = groupBirthdays(people, today);
  return { today, current: groups[0], upcoming: groupBirthdays(people, tomorrow)[0], history: groups.slice(1) };
}
