import { MenuIcon } from "../app/MenuIcon";
import type { getBirthdays } from "../../src/features/birthdays/service";
import type { BirthdayPerson } from "../../src/features/birthdays/dates";
import { BirthdayDateRefresh } from "./BirthdayDateRefresh";
import "./birthdays.css";
const displayDate = (date: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(date + "T12:00:00+09:00"));
function People({ people }: { people: BirthdayPerson[] }) {
  return <ul className="birthday-people">{people.map(person => <li key={person.id}><span className="birthday-person-mark" aria-hidden="true">{Array.from(person.name)[0]}</span><div><strong>{person.name}</strong>{person.churchOffice && <span className="birthday-office">{person.churchOffice}</span>}<p>{[person.village, person.sam].filter(Boolean).join(" · ")}</p></div></li>)}</ul>;
}
export function BirthdayPage({ data }: { data: Awaited<ReturnType<typeof getBirthdays>> }) {
  return <main className="birthdays-page"><BirthdayDateRefresh day={data.today} />
    <header><p className="brand-kicker">삼덕사오 · 함께 축하하는 하루</p><h2>오늘의 생일<span>.</span></h2><p>우리 곁의 소중한 사람들에게 축하의 마음을 전해 주세요.</p></header>
    <section className="birthday-today" aria-labelledby="birthday-today-title"><div className="birthday-section-heading"><div><p>HAPPY BIRTHDAY</p><h3 id="birthday-today-title">{displayDate(data.today)} <span>오늘</span></h3></div><MenuIcon name="birthday" /></div>
      <p className="birthday-count">오늘 생일인 분 <strong>{data.current.people.length}명</strong></p>
      {data.current.people.length ? <People people={data.current.people} /> : <p className="birthday-empty">오늘은 등록된 생일자가 없습니다.</p>}
    </section>
    <section className="birthday-upcoming" aria-labelledby="birthday-upcoming-title"><div className="birthday-history-title"><h3 id="birthday-upcoming-title">다가오는 생일</h3><p>내일 · {displayDate(data.upcoming.date)} · {data.upcoming.people.length}명</p></div>{data.upcoming.people.length ? <People people={data.upcoming.people} /> : <p className="birthday-empty">내일은 등록된 생일자가 없습니다.</p>}</section>
    <section className="birthday-history" aria-labelledby="birthday-history-title"><div className="birthday-history-title"><h3 id="birthday-history-title">지난 생일</h3><p>어제부터 3일 전까지 · 최근 날짜 순</p></div>
      {data.history.map(group => <section className="birthday-history-day" key={group.date} aria-label={displayDate(group.date)}><div className="birthday-history-date"><time dateTime={group.date}>{displayDate(group.date)}</time><span>{group.people.length}명</span></div>{group.people.length ? <People people={group.people} /> : <p className="birthday-empty">등록된 생일자가 없습니다.</p>}</section>)}
    </section><p className="birthday-note">등록된 생년월일과 한국 시간을 기준으로 표시합니다. 2월 29일생은 윤년이 아닌 해에는 2월 28일에 함께 표시합니다.</p>
  </main>;
}
