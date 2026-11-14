import Link from "next/link";
import { COMMUNITY_2027 } from "../../src/content/community-2027";
import "./community-plan-2027.css";

function BrandSquares({ className = "" }: { className?: string }) {
  return <span className={`plan2027-squares ${className}`} aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function CommunityPlan2027Intro() {
  return (
    <section className="plan2027-intro" aria-labelledby="plan2027-intro-title">
      <div>
        <p className="plan2027-kicker">{COMMUNITY_2027.year}년, 우리 공동체가 걸어갈 길</p>
        <h2 id="plan2027-intro-title">{COMMUNITY_2027.motto}</h2>
        <p className="plan2027-intro-copy">{COMMUNITY_2027.intro}</p>
      </div>
      <Link href="/ministry-plan" className="plan2027-intro-link">2027 사역 계획 보기 <span aria-hidden="true">↗</span></Link>
      <BrandSquares />
    </section>
  );
}

export function CommunityPlan2027({ audience = "public" }: { audience?: "public" | "member" }) {
  const Title = audience === "public" ? "h1" : "h2";
  const SectionTitle = audience === "public" ? "h2" : "h3";
  const CardTitle = audience === "public" ? "h3" : "h4";

  return (
    <article className="plan2027" aria-labelledby="plan2027-title">
      <header className="plan2027-hero">
        <div className="plan2027-hero-copy">
          <p className="plan2027-kicker">삼덕교회 45공동체 · {COMMUNITY_2027.year} 사역 운영 계획</p>
          <Title className="plan2027-title" id="plan2027-title">{COMMUNITY_2027.motto}<span className="plan2027-title-dot" aria-hidden="true">.</span></Title>
          <p className="plan2027-lead">{COMMUNITY_2027.intro}</p>
          <a className="plan2027-text-link" href="#plan2027-ministries">올해의 사역 살펴보기 <span aria-hidden="true">↓</span></a>
        </div>
        <div className="plan2027-year-art" aria-hidden="true"><span>20</span><span>27</span><BrandSquares /></div>
      </header>

      <blockquote className="plan2027-verse">
        <p>“{COMMUNITY_2027.verse}”</p>
        <cite>{COMMUNITY_2027.verseRef}</cite>
      </blockquote>

      <nav className="plan2027-jump-nav" aria-label="2027 사역 계획 바로가기">
        <a href="#plan2027-goals">우리의 방향</a><a href="#plan2027-rhythm">매월의 만남</a><a href="#plan2027-ministries">8가지 사역</a><a href="#plan2027-timeline">한눈에 보는 한 해</a>
      </nav>

      <section className="plan2027-section" id="plan2027-goals" aria-labelledby="plan2027-goals-title">
        <div className="plan2027-section-heading"><p className="plan2027-kicker">01 · 우리의 방향</p><SectionTitle id="plan2027-goals-title">깊어지고, 연결되고,<br />이웃에게 흘려보내요.</SectionTitle><p>샘 안에서 나눈 사랑이 이웃을 향한 섬김으로 이어지도록, 세 가지 방향으로 함께합니다.</p></div>
        <div className="plan2027-goals">
          {COMMUNITY_2027.goals.map((goal, index) => <article className="plan2027-goal" key={goal.title}><span className="plan2027-card-number">0{index + 1}</span><p className="plan2027-goal-summary">{goal.summary}</p><CardTitle>{goal.title}</CardTitle><p>{goal.description}</p></article>)}
        </div>
      </section>

      <section className="plan2027-section plan2027-rhythm-section" id="plan2027-rhythm" aria-labelledby="plan2027-rhythm-title">
        <div className="plan2027-section-heading"><p className="plan2027-kicker">02 · 매월의 만남</p><SectionTitle id="plan2027-rhythm-title">함께 모이고,<br />샘의 속도로 만나요.</SectionTitle><p>공동체 정기모임은 월 1회로, 샘모임은 각 샘의 형편에 맞게 이어갑니다.</p></div>
        <div className="plan2027-rhythm">
          {COMMUNITY_2027.rhythm.map(item => <article className="plan2027-rhythm-card" key={item.week}><p className="plan2027-week"><span>매월</span>{item.week}</p><div><CardTitle>{item.title}</CardTitle><p>{item.description}</p></div></article>)}
        </div>
      </section>

      <section className="plan2027-section" id="plan2027-ministries" aria-labelledby="plan2027-ministries-title">
        <div className="plan2027-section-heading"><p className="plan2027-kicker">03 · 8가지 사역</p><SectionTitle id="plan2027-ministries-title">일상에서 시작해,<br />이웃을 향하는 한 걸음.</SectionTitle><p>배우고 나누는 시간부터 함께 걷고 섬기는 자리까지, 올해 계획한 사역을 소개합니다.</p></div>
        <div className="plan2027-ministries">
          {COMMUNITY_2027.ministries.map((ministry, index) => <article className="plan2027-ministry" id={`plan2027-${ministry.id}`} key={ministry.id}><div className="plan2027-ministry-top"><span className="plan2027-card-number">{String(index + 1).padStart(2, "0")}</span><span className="plan2027-accent-square" aria-hidden="true" /></div><CardTitle>{ministry.title}</CardTitle><p className="plan2027-ministry-description">{ministry.description}</p><span className="plan2027-schedule">{ministry.schedule}</span></article>)}
        </div>
      </section>

      <section className="plan2027-section plan2027-timeline-section" id="plan2027-timeline" aria-labelledby="plan2027-timeline-title">
        <div className="plan2027-section-heading"><p className="plan2027-kicker">04 · 한눈에 보는 한 해</p><SectionTitle id="plan2027-timeline-title">2027년, 이렇게 함께해요.</SectionTitle><p>아래는 월·시기별 계획입니다. 구체적인 날짜와 장소, 참여 방법은 공동체 공지를 확인해 주세요.</p></div>
        <ol className="plan2027-timeline" aria-label="2027년 월·시기별 사역 계획">
          {COMMUNITY_2027.timeline.map(item => <li key={`${item.period}-${item.title}`}><span className="plan2027-period">{item.period}<small>계획</small></span><div><a href={`#plan2027-${item.ministryId}`}>{item.title}<span aria-hidden="true">↗</span></a><p>{item.detail}</p></div></li>)}
        </ol>
        <p className="plan2027-calendar-note"><span aria-hidden="true">■</span> 월·시기는 운영 계획에 따른 안내이며, 세부 일정은 달라질 수 있습니다.</p>
      </section>

      <section className="plan2027-join" aria-labelledby="plan2027-join-title">
        <BrandSquares />
        <div><p className="plan2027-kicker">함께할 수 있는 자리를 찾아요</p><SectionTitle id="plan2027-join-title">우리의 만남이,<br />너른 사랑으로 이어지도록.</SectionTitle><p>참여가 궁금하다면 공동체 공지를 확인하거나, 45공동체 운영 담당자에게 문의해 주세요.</p></div>
        <div className="plan2027-join-actions"><Link href={audience === "member" ? "/notices" : "/login"} className="plan2027-button">{audience === "member" ? "공동체 공지 확인하기" : "로그인하고 공지 확인하기"}<span aria-hidden="true">↗</span></Link><Link href="/about#contact-title" className="plan2027-text-link">운영 문의 안내 <span aria-hidden="true">↗</span></Link></div>
      </section>
      <p className="plan2027-source-note">삼덕교회 45공동체 · 2027년 사역 운영 계획</p>
    </article>
  );
}
