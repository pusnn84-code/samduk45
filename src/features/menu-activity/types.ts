export type MenuActivityKind = "community" | "members" | "reading";
export type MenuActivityCounts = { notices: number; community: number; members: number; reading?: number; readingDates?: string[] };
export const EMPTY_MENU_ACTIVITY: MenuActivityCounts = { notices: 0, community: 0, members: 0, reading: 0 };
export function countForMenu(href: string, counts: MenuActivityCounts): number {
  if (href === "/notices") return counts.notices;
  if (href === "/community") return counts.community;
  if (href === "/bible-reading") return counts.reading ?? 0;
  return 0;
}
