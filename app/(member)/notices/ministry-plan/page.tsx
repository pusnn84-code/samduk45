import type {Metadata} from "next";
import Link from "next/link";
import {CommunityPlan2027} from "../../../../components/plan/CommunityPlan2027";
import "../../../../components/notices/pinned-plan.css";
export const metadata:Metadata={title:"2027 사역안내"};
export default function PinnedMinistryPlanPage(){return <main className="plan2027-member-page"><header className="pinned-plan-heading"><div><span className="notice-pinned-badge">고정 공지</span><h1>2027 사역안내</h1></div><Link href="/notices" className="text-link">공지 목록</Link></header><CommunityPlan2027 audience="member"/></main>;}
