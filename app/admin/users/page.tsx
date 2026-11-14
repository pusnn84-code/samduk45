import { AdminUserManagementLoader } from "../../../components/admin/users/AdminUserManagementLoader";
import { SamLeaderSettings } from "../../../components/admin/settings/SamLeaderSettings";
import { DeputyManagement } from "../../../components/admin/users/DeputyManagement";

export default function AdminUsersPage() {
  return (
    <main className="admin-shell">
      <DeputyManagement />
      <AdminUserManagementLoader />
      <SamLeaderSettings />
    </main>
  );
}
