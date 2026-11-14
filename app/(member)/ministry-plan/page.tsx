import type { Metadata } from "next";
import { CommunityPlan2027 } from "../../../components/plan/CommunityPlan2027";

export const metadata: Metadata = { title: "2027 사역 계획" };

export default function MemberCommunityPlan2027Page() {
  return <main className="plan2027-member-page"><CommunityPlan2027 audience="member" /></main>;
}
