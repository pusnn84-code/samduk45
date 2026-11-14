import type { Metadata } from "next";
import { CommunityDirectorySample } from "../../../components/directory/CommunityDirectorySample";
import { CommunityDirectory } from "../../../components/directory/CommunityDirectory";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getCommunityDirectory } from "../../../src/features/directory/service";
import { redirect } from "next/navigation";
import { MenuActivityView } from "../../../components/app/MenuActivityProvider";

export const metadata: Metadata = { title: "우리 공동체" };
export const dynamic = "force-dynamic";

export default async function OurCommunityPage() {
  if (!(await getCurrentSessionUser())) redirect("/login");
  const { members, sams, villageLeaders, activityObservedAt } = await getCommunityDirectory();
  return <>{members.length || sams.length
    ? <CommunityDirectory members={members} sams={sams} villageLeaders={villageLeaders} />
    : <CommunityDirectorySample />}<MenuActivityView kind="members" observedAt={activityObservedAt} /></>;
}
