/** Keep every confirmed/completed appointment for a date; pending requests stay in the approval list. */
export function calendarEntriesForDate<T extends { visitDate: string; status: string }>(visits: T[], date: string): T[] {
  return visits.filter(visit => visit.visitDate === date && (visit.status === "confirmed" || visit.status === "completed"));
}
