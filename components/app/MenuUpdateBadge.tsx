export function MenuUpdateBadge({ count, label, unit = "개" }: { count: number; label: string; unit?: string }) {
  if (!Number.isInteger(count) || count <= 0) return null;
  return <span className="nav-badge menu-update-badge" aria-label={`${label} ${count}${unit}`}>{count > 99 ? "99+" : count}</span>;
}
