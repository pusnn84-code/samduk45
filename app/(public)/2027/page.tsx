import type { Metadata } from "next";
import { CommunityPlan2027 } from "../../../components/plan/CommunityPlan2027";
import { COMMUNITY_2027 } from "../../../src/content/community-2027";
import { publicPageMetadata } from "../../../src/lib/branding";

export const metadata: Metadata = {
  title: "2027 사역 계획",
  description: `2027년 ${COMMUNITY_2027.motto}. ${COMMUNITY_2027.intro}`,
  ...publicPageMetadata("/2027"),
};

export default function PublicCommunityPlan2027Page() {
  return <CommunityPlan2027 />;
}
