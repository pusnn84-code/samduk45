import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "../../../../src/features/auth/http-session";
import { directory } from "../../../../src/features/pastoral/access";
import { LeaderFormPreview } from "../../../../components/pastoral/LeaderFormPreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "샘리더 작성 화면 미리보기" };

export default async function Page() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  const data = await directory();
  const sams = data.sams.filter(sam => sam.isActive && /^[1-5]-\d+(?:샘)?$/.test(sam.name.trim()));
  return <LeaderFormPreview sams={sams} />;
}
