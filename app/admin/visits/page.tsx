import { GoogleCalendarExportSettings } from "../../../components/admin/settings/GoogleCalendarExportSettings";
import type { VisitStatus } from "../../../src/features/visits/types";
import { AdminVisitManagement } from "../../../components/admin/visits/AdminVisitManagement";
import { VisitAvailabilitySettings } from "../../../components/admin/settings/VisitAvailabilitySettings";

function parseStatus(value: unknown): "all" | VisitStatus {
  return value === "requested" ||
    value === "confirmed" ||
    value === "completed" ||
    value === "cancelled"
    ? value
    : "all";
}

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawId=Array.isArray(params.id)?params.id[0]:params.id;
  const initialId=typeof rawId==="string"&&/^[0-9a-f-]{36}$/i.test(rawId)?rawId:null;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;

  return (
    <main className="admin-shell">
      <AdminVisitManagement key={initialId??"list"} initialId={initialId} initialStatus={parseStatus(rawStatus)} />
      <VisitAvailabilitySettings />
      <GoogleCalendarExportSettings />
    </main>
  );
}

