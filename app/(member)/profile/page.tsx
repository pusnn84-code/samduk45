import {getDb,rows,sql} from "../../../src/features/pastoral/db";
import { redirect } from "next/navigation";
import { PushOptIn } from '../../../components/notices/PushOptIn';
import { ProfileForm } from "../../../components/profile/ProfileForm";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";
import { getProfile } from "../../../src/features/profile/service";

export default async function ProfilePage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/login");

  const [recipient]=await rows<{pastor:boolean}>(getDb(),sql`select exists(select 1 from prayer_app.question_settings s where s.id=1 and s.pastor_user_id=${user.id}::uuid) as pastor`);
  return (
    <main className="shell">
      <h1>내 정보</h1>
      <ProfileForm initial={profile} />
      <PushOptIn isAdmin={user.role === 'admin'} isPastor={user.role === 'admin'&&recipient?.pastor===true} />
    </main>
  );
}

