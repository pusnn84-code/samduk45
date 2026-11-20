import { AdminHubDashboardLoader } from "../../components/admin/AdminHubDashboardLoader";
import { EmailNotifications } from "../../components/admin/EmailNotifications";
import { PastorQuestionSummary } from "../../components/questions/PastorQuestionSummary";

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <AdminHubDashboardLoader />
      <PastorQuestionSummary />
      <EmailNotifications />
    </main>
  );
}
