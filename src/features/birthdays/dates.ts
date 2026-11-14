export function seoulDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function birthdayOnYear(birthDate: string, year: number): string {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return `${year}-${birthDate.slice(5) === "02-29" && !leap ? "02-28" : birthDate.slice(5)}`;
}
export function ageOnDate(birthDate: string | null | undefined, today: string): number | null {
  if (!birthDate || !validBirthDate(birthDate) || birthDate > today) return null;
  const year = Number(today.slice(0, 4));
  return year - Number(birthDate.slice(0, 4)) - (today < birthdayOnYear(birthDate, year) ? 1 : 0);
}
export function birthdayDays(today: string): string[] {
  return Array.from({ length: 4 }, (_, offset) => {
    const date = new Date(today + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() - offset);
    return date.toISOString().slice(0, 10);
  });
}
export type BirthdaySource = { id: string; name: string; churchOffice: string | null; village: string | null; sam: string | null; birthDate: string };
export type BirthdayPerson = Omit<BirthdaySource, "birthDate">;
export function groupBirthdays(people: BirthdaySource[], today: string) {
  return birthdayDays(today).map(date => ({ date, people: people
    .filter(person => validBirthDate(person.birthDate) && person.birthDate <= date && birthdayOnYear(person.birthDate, Number(date.slice(0, 4))) === date)
    .map(({ birthDate: _birthDate, ...person }) => person)
    .sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id)) }));
}
