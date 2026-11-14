/** Pure domain policy; no secrets, database clients or user content logging. */
export const FILE_LIMIT = 6 * 1024 * 1024;
export const CHUNK_LIMIT = 512 * 1024;
export class ReportError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}
export type Method = "photo" | "file" | "form";
export type Attachment = { name: string; size: number; sha256: string };
export type Meeting = { when: string; place: string; attendees: string };
export type Sharing = { member: string; content: string };
export type MemberNote = { rosterId: string; member: string; sharing: string; prayer: string; news: string };
export type ReportKind = "meeting" | "member";
export type ReportForm = { noMeeting: boolean; noMeetingReason: string; meetings: Meeting[]; sharing: Sharing[]; news: Sharing[]; memberNotes?: MemberNote[]; leaderPrayer: string; other: string; entryMode?: "leader"; entryKind?: ReportKind; attendeeIds?: string[] };
export type Submission = { id: string; requestId: string; samId: string; method: Method; writtenDate: string; form: ReportForm | null; files: Attachment[] };
export type Period = { month: number };
export type ReportRequest = { id: string; year: number; month: number; enabled: boolean };
export type LeaderBinding = { leaderRosterId?: string | null; leaderBindingLocked?: boolean };
export type VillageLeader = LeaderBinding & { id: string; name: string; village: string; leaderName: string; isActive: boolean };
export type SamTarget = LeaderBinding & { id: string; name: string; leaderName: string; village: string; isActive: boolean };
export type Identity = { id: string; sourceName: string; canonicalName: string; samLabel: string | null; village: string | null; isActive: boolean };
export type ReportAccess = { visible: boolean; sams: SamTarget[]; requiredSamIds: string[]; rosterId: string | null };
export type Actor = { id: string; displayName: string; role: "member" | "admin" };

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportError("INVALID_INPUT");
  return value as Record<string, unknown>;
}
export function clean(value: unknown, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw new ReportError("INVALID_INPUT");
  const text = value.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (text.length > max || (required && !text)) throw new ReportError("INVALID_INPUT");
  return text;
}
export function reportId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)) throw new ReportError("INVALID_INPUT");
  return value.toLowerCase();
}
export function int(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new ReportError("INVALID_INPUT");
  return value;
}
export function isoDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ReportError("INVALID_DATE");
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ReportError("INVALID_DATE");
  return value;
}
export function seoulToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)!.value).join("-");
}
export function periodBounds(year: number, month: number): { startDate: string; endDate: string } {
  int(year, 2000, 9998); int(month, 1, 12);
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return { startDate: prefix + "01", endDate: prefix + new Date(Date.UTC(year, month, 0)).getUTCDate() };
}
export function periodLabel(period: { year: number; month: number }): string {
  return `${period.year}년 ${period.month}월`;
}
export function parseSchedule(value: unknown, now = new Date()): { year: number; expectedVersion: number; selected: Period[] } {
  const input = object(value);
  const currentYear = Number(seoulToday(now).slice(0, 4));
  const year = int(input.year, currentYear, currentYear + 1);
  const expectedVersion = int(input.expectedVersion, 0, 2147483646);
  if (!Array.isArray(input.selected) || input.selected.length > 12) throw new ReportError("INVALID_INPUT");
  const selected = input.selected.map(v => {
    const item = object(v);
    if (Object.keys(item).some(k => k !== "month")) throw new ReportError("MONTHLY_ONLY");
    return { month: int(item.month, 1, 12) };
  });
  if (new Set(selected.map(p => p.month)).size !== selected.length) throw new ReportError("DUPLICATE_MONTH");
  return { year, expectedVersion, selected: selected.sort((a, b) => a.month - b.month) };
}
export function toggleMonth(periods: Period[], month: number): Period[] {
  int(month, 1, 12);
  return (periods.some(p => p.month === month) ? periods.filter(p => p.month !== month) : [...periods, { month }]).sort((a,b) => a.month-b.month);
}
export function requestState(request: ReportRequest, submitted: boolean, today = seoulToday()): "submitted" | "cancelled" | "upcoming" | "pending" | "closed" {
  if (submitted) return "submitted";
  if (!request.enabled) return "cancelled";
  const month = `${request.year}-${String(request.month).padStart(2, "0")}`;
  return today.slice(0,7) < month ? "upcoming" : today.slice(0,7) > month ? "closed" : "pending";
}
export function countMissing(requests: ReportRequest[], samIds: string[], submitted: { requestId: string; samId: string }[], today = seoulToday()): number {
  const done = new Set(submitted.map(x => `${x.requestId}:${x.samId}`));
  return requests.reduce((total, r) => total + (requestState(r, false, today) === "pending" ? [...new Set(samIds)].filter(id => !done.has(`${r.id}:${id}`)).length : 0), 0);
}
export function samKey(value: string | null): string {
  return (value ?? "").normalize("NFC").replace(/\s+/gu, "").replace(/마을-?/gu, "-").replace(/샘$/u, "").split("-").map(p => /^\d+$/.test(p) ? String(Number(p)) : p).join("-");
}
export function villageKey(value: string | null): string {
  const result = (value ?? "").normalize("NFC").replace(/\s+/gu, "").replace(/마을$/u, "");
  return /^\d+$/.test(result) ? String(Number(result)) : result;
}
export function reportSamMembers(sam: Pick<SamTarget, "name" | "village">, roster: Identity[]) {
  const samLabel = samKey(sam.name);
  const village = villageKey(sam.village);
  if (!samLabel || !village) return [];
  return roster
    .filter(person => person.isActive && samKey(person.samLabel) === samLabel && villageKey(person.village) === village)
    .map(person => ({ rosterId: person.id, member: person.sourceName }))
    .sort((a, b) => a.member.localeCompare(b.member, "ko") || a.rosterId.localeCompare(b.rosterId));
}
function nameKey(value: string): string {
  // Preserve A/B suffixes. Do not use the app's login canonicalizer for authorization.
  return value.normalize("NFC").trim().replace(/\s*(?:\(|\[)?(?:담임목사|부목사|목사|전도사|장로|권사|안수집사|집사|성도)(?:님)?(?:\)|\])?$/u, "").replace(/\s+/gu, "");
}
export type LeaderTarget = { kind: "sam" | "village"; name: string; scope: string; leaderName: string };
export function leaderCandidates(target: LeaderTarget, roster: Identity[]): Identity[] {
  const key = nameKey(target.leaderName);
  if (!key) return [];
  // Count namesakes across all villages, not only the target scope. Preserve explicit suffixes.
  return roster.filter(r => r.isActive && (nameKey(r.sourceName) === key || nameKey(r.canonicalName) === key));
}
export function leaderInScope(target: LeaderTarget, person: Identity): boolean {
  // Village heads may belong to another village. Their responsibility is the
  // registered target village; sam leaders must still belong to their own sam.
  return person.isActive && (target.kind === "village" || samKey(person.samLabel) === samKey(target.scope));
}
export function selectLeaderIdentity(target: LeaderTarget, roster: Identity[], existing: (LeaderBinding & {leaderName: string}) | null = null, chosen?: string): {rosterId: string | null; locked: boolean} {
  const unchanged = existing && nameKey(existing.leaderName) === nameKey(target.leaderName);
  const pinned = unchanged && existing.leaderBindingLocked;
  if (chosen !== undefined) {
    const person = roster.find(r => r.id === chosen);
    if (!person || !leaderInScope(target, person) || (!(pinned && existing.leaderRosterId === chosen) && !leaderCandidates(target, roster).some(r => r.id === chosen))) throw new ReportError("LEADER_SELECTION_INVALID", 409);
    return {rosterId: chosen, locked: true};
  }
  // A removed identity must never transfer its role to a newly added namesake.
  if (pinned) return {rosterId: existing.leaderRosterId ?? null, locked: true};
  const candidates = leaderCandidates(target, roster);
  if (candidates.length > 1) throw new ReportError("LEADER_SELECTION_REQUIRED", 409);
  if (candidates.length === 1 && leaderInScope(target, candidates[0])) return {rosterId:candidates[0].id,locked:true};
  return {rosterId:null,locked:false};
}
/** Runtime authority uses persisted roster IDs, never display names. */
export function automaticLeaders(allSams: SamTarget[], roster: Identity[]): { samId: string; rosterId: string; name: string }[] {
  const people = new Map(roster.map(r => [r.id, r]));
  return allSams.filter(s => s.isActive && s.leaderName && s.leaderRosterId).flatMap(sam => {
    const person = people.get(sam.leaderRosterId!);
    return person && leaderInScope({kind:"sam",name:sam.name,scope:sam.name,leaderName:sam.leaderName},person) ? [{samId:sam.id,rosterId:person.id,name:person.sourceName}] : [];
  });
}
export function parseVillageLeader(value: unknown): Omit<VillageLeader, "id"> {
  const input = object(value);
  const match = /^(\d{1,3})마을장$/u.exec(clean(input.name, 30, true).replace(/\s+/gu, ""));
  if (!match || Number(match[1]) < 1) throw new ReportError("INVALID_VILLAGE_LABEL");
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") throw new ReportError("INVALID_INPUT");
  const village = String(Number(match[1]));
  return { name: `${village}마을장`, village, leaderName: clean(input.leaderName, 100, true), isActive: input.isActive !== false };
}
export function automaticVillageLeaders(heads: VillageLeader[], roster: Identity[]): { village: string; rosterId: string }[] {
  const people = new Map(roster.map(r => [r.id, r]));
  return heads.filter(h => h.isActive && h.leaderRosterId).flatMap(head => {
    const person = people.get(head.leaderRosterId!);
    return person && leaderInScope({kind:"village",name:head.name,scope:head.village,leaderName:head.leaderName},person) ? [{village:head.village,rosterId:person.id}] : [];
  });
}
export function deriveAccess(actor: Actor, identity: Identity | null, allSams: SamTarget[], roster: Identity[], heads: VillageLeader[]): ReportAccess {
  const active = allSams.filter(s => s.isActive);
  const leaderIds = new Set<string>(); const villages = new Set<string>();
  if (identity?.isActive) {
    for (const binding of automaticLeaders(active, roster)) if (binding.rosterId === identity.id) leaderIds.add(binding.samId);
    for (const binding of automaticVillageLeaders(heads, roster)) if (binding.rosterId === identity.id) villages.add(binding.village);
  }
  const allowed = active.filter(s => actor.role === "admin" || leaderIds.has(s.id) || villages.has(villageKey(s.village)));
  return { visible: actor.role === "admin" || leaderIds.size > 0 || villages.size > 0, sams: allowed, requiredSamIds: [...leaderIds], rosterId: identity?.isActive ? identity.id : null };
}
/** The member composer belongs only to the authenticated, bound SAM leader. */
export function deriveMemberLeaderAccess(access: ReportAccess): ReportAccess {
  const sams = access.sams.filter(sam => access.requiredSamIds.includes(sam.id));
  return { ...access, visible: sams.length > 0, sams, requiredSamIds: sams.map(sam => sam.id) };
}

export type MemberSubmission = { id: string; form: ReportForm };
export function parseMemberSubmission(value: unknown): MemberSubmission {
  const input = object(value);
  // Targets, authors, dates, method and schedule are resolved on the server.
  if (Object.keys(input).some(key => key !== "id" && key !== "form")) throw new ReportError("INVALID_INPUT");
  const raw = object(input.form);
  if (raw.entryKind === "member") {
    const form = parseForm(raw);
    if (form.noMeeting || form.meetings.length || form.sharing.length || form.news.length || form.leaderPrayer || form.other || form.attendeeIds?.length) throw new ReportError("INVALID_INPUT");
    if (form.memberNotes?.length !== 1) throw new ReportError("MEMBER_NOTE_REQUIRED");
    return { id: reportId(input.id), form };
  }
  if (raw.noMeeting === true || !Array.isArray(raw.meetings) || raw.meetings.length !== 1) throw new ReportError("SINGLE_MEETING_REQUIRED");
  const form = parseForm(raw);
  if (form.meetings.length !== 1) throw new ReportError("SINGLE_MEETING_REQUIRED");
  const meeting = form.meetings[0];
  const when = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/.exec(meeting.when);
  if (!when || Number(when[2]) > 23 || Number(when[3]) > 59) throw new ReportError("INVALID_MEETING_DATE");
  isoDate(when[1]);
  if (!meeting.place || !meeting.attendees) throw new ReportError("MEETING_DETAILS_REQUIRED");
  if (form.entryKind === "meeting") {
    if (!form.attendeeIds?.length) throw new ReportError("ATTENDEES_REQUIRED");
    if (form.memberNotes?.length || form.sharing.length || form.news.length || form.leaderPrayer || form.other) throw new ReportError("INVALID_INPUT");
  }
  return { id: reportId(input.id), form: { ...form, noMeeting: false, noMeetingReason: "" } };
}
function formRows<T>(input: unknown, maxRows: number, keys: string[], limits: number[]): T[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > maxRows) throw new ReportError("TOO_MANY_ROWS");
  return input.map(v => { const row = object(v); return Object.fromEntries(keys.map((key, index) => [key, clean(row[key], limits[index])])); })
    .filter(row => Object.values(row).some(Boolean)) as T[];
}
export function parseForm(value: unknown): ReportForm {
  const v = object(value);
  if (v.noMeeting !== undefined && typeof v.noMeeting !== "boolean") throw new ReportError("INVALID_INPUT");
  const form: ReportForm = {
    noMeeting: v.noMeeting === true,
    noMeetingReason: v.noMeeting === true ? clean(v.noMeetingReason, 2000) : "",
    meetings: formRows<Meeting>(v.meetings, 12, ["when", "place", "attendees"], [100, 300, 1200]),
    sharing: formRows<Sharing>(v.sharing, 40, ["member", "content"], [100, 2000]),
    news: formRows<Sharing>(v.news, 30, ["member", "content"], [100, 2000]),
    leaderPrayer: clean(v.leaderPrayer, 5000),
    other: clean(v.other, 5000),
  };
  if (v.entryKind !== undefined) {
    if (v.entryKind !== "meeting" && v.entryKind !== "member") throw new ReportError("INVALID_INPUT");
    form.entryKind = v.entryKind;
  }
  if (v.attendeeIds !== undefined) {
    if (!Array.isArray(v.attendeeIds) || v.attendeeIds.length > 100) throw new ReportError("INVALID_INPUT");
    form.attendeeIds = v.attendeeIds.map(reportId);
    if (new Set(form.attendeeIds).size !== form.attendeeIds.length) throw new ReportError("INVALID_INPUT");
  }
  if (form.noMeeting && !form.noMeetingReason) throw new ReportError("NO_MEETING_REASON_REQUIRED");
  if (form.noMeeting) form.meetings = [];
  if (v.memberNotes !== undefined) {
    if (!Array.isArray(v.memberNotes) || v.memberNotes.length > 100) throw new ReportError("TOO_MANY_ROWS");
    const seen = new Set<string>();
    form.memberNotes = v.memberNotes.map(value => {
      const row = object(value);
      const rosterId = reportId(row.rosterId);
      if (seen.has(rosterId)) throw new ReportError("INVALID_MEMBER_NOTE");
      seen.add(rosterId);
      return {
        rosterId, member: clean(row.member, 120, true), sharing: clean(row.sharing, 2000),
        prayer: clean(row.prayer, 2000), news: clean(row.news, 2000),
      };
    }).filter(row => row.sharing || row.prayer || row.news);
  }
  if (JSON.stringify(form).length > 50000) throw new ReportError("REPORT_TOO_LONG");
  return form;
}
export function photoName(name: string): boolean { return /\.(jpe?g|png|webp|gif|avif|heic|heif|tiff?)$/iu.test(name); }
export function parseFiles(value: unknown, method: Method): Attachment[] {
  if (!Array.isArray(value) || value.length > 2 || (method !== "form" && !value.length) || (method === "form" && value.length)) throw new ReportError("INVALID_FILE_COUNT");
  return value.map(v => {
    const f = object(v); const name = clean(f.name, 180, true);
    if (/[\\/\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(name) || name.startsWith(".") || !(/\.(pdf|hwp|hwpx|docx?|xlsx?|pptx?|txt|csv|odt)$/iu.test(name) || photoName(name))) throw new ReportError("UNSUPPORTED_FILE");
    if (method === "photo" && !photoName(name)) throw new ReportError("PHOTO_REQUIRED");
    const size = int(f.size, 1, FILE_LIMIT);
    if (typeof f.sha256 !== "string" || !/^[a-f0-9]{64}$/iu.test(f.sha256)) throw new ReportError("INVALID_HASH");
    return { name, size, sha256: f.sha256.toLowerCase() };
  });
}
export function parseSubmission(value: unknown, now = new Date()): Submission {
  const v = object(value);
  if (v.method !== "photo" && v.method !== "file" && v.method !== "form") throw new ReportError("INVALID_METHOD");
  return { id: reportId(v.id), requestId: reportId(v.requestId), samId: reportId(v.samId), method: v.method,
    writtenDate: isoDate(v.writtenDate || seoulToday(now)),
    form: v.method === "form" ? parseForm(v.form) : null, files: parseFiles(v.files ?? [], v.method) };
}
export function chunkSize(size: number, index: number): number {
  int(size, 1, FILE_LIMIT); int(index, 0, Math.ceil(size / CHUNK_LIMIT) - 1);
  return Math.min(CHUNK_LIMIT, size - index * CHUNK_LIMIT);
}
export function reportText(report: Pick<Submission, "method" | "writtenDate" | "form"> & { samName: string; leaderName: string; submittedBy: string; periodLabel: string; submittedAt?: string | null }): string {
  if (report.method !== "form" || !report.form) throw new ReportError("TEXT_REPORT_REQUIRED", 409);
  const f = report.form;
  const section = (title: string, lines: string[]) => `\n■ ${title}\n${lines.length ? lines.join("\n\n") : "기록 없음"}\n`;
  return `샘목양지\n제출 대상: ${report.periodLabel}\n작성일: ${report.writtenDate}\n샘: ${report.samName}\n샘리더: ${report.leaderName}\n제출자: ${report.submittedBy}\n`
    + (f.entryKind ? `구분: ${f.entryKind === "meeting" ? "샘모임" : "샘원 나눔·소식"}\n` : "")
    + (f.entryKind === "member" ? "" : section("샘모임", [...(f.noMeeting ? [`이번 기간 샘모임 없음\n사유: ${f.noMeetingReason}`] : []), ...f.meetings.map((r, i) => `${i + 1}. 일시: ${r.when}\n장소: ${r.place}\n참석자: ${r.attendees}`)]))
    + ((f.memberNotes ?? []).length ? section("샘원별 기록", (f.memberNotes ?? []).map(r => [
      `샘원: ${r.member}`, r.sharing && `나눔: ${r.sharing}`, r.prayer && `기도제목: ${r.prayer}`, r.news && `소식: ${r.news}`,
    ].filter(Boolean).join("\n"))) : "")
    + (f.entryKind ? "" : section("나눔/기도제목 (예배·성경통독은혜·기도제목)", f.sharing.map(r => `샘원: ${r.member}\n${r.content}`))
    + section("샘소식 (결혼, 장례, 이사, 입원 등)", f.news.map(r => `샘원: ${r.member}\n${r.content}`))
    + section("샘리더 기도제목", f.leaderPrayer ? [f.leaderPrayer] : [])
    + section("기타", f.other ? [f.other] : []));
}

export function checkOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new ReportError("FORBIDDEN", 403);
}
export async function readLimited(request: Request, limit: number): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > limit)) throw new ReportError("PAYLOAD_TOO_LARGE", 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new ReportError("PAYLOAD_TOO_LARGE", 413); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return bytes;
  } finally { reader.releaseLock(); }
}
export async function readReportJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.toLowerCase().split(";")[0].trim() !== "application/json") throw new ReportError("INVALID_CONTENT_TYPE", 415);
  const bytes = await readLimited(request, 224 * 1024);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ReportError("INVALID_INPUT"); }
}
export function isRaster(data: Uint8Array): boolean {
  const hex = [...data.subarray(0, 8)].map(n => n.toString(16).padStart(2, "0")).join("");
  const head = String.fromCharCode(...data.subarray(0, 32));
  return hex.startsWith("ffd8ff") || hex === "89504e470d0a1a0a" || /^GIF8[79]a/.test(head) ||
    (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") || /^(49492a00|4d4d002a|49492b00|4d4d002b)/.test(hex) ||
    (head.slice(4, 8) === "ftyp" && /avif|avis|heic|heix|hevc|hevx|mif1|msf1/.test(head.slice(8)));
}

/** A revision never changes the report's original author, target or completion month. */
export type ReportEdit = { id: string; expectedVersion: number; writtenDate: string; method: Method; form: ReportForm | null; files: Attachment[]; keepSlots: number[] };
export function parseReportEdit(value: unknown): ReportEdit {
  const v = object(value);
  if (v.method !== "photo" && v.method !== "file" && v.method !== "form") throw new ReportError("INVALID_METHOD");
  if (!Array.isArray(v.keepSlots) || v.keepSlots.length > 2) throw new ReportError("INVALID_FILE_COUNT");
  const keepSlots = v.keepSlots.map(slot => int(slot, 0, 1));
  if (new Set(keepSlots).size !== keepSlots.length) throw new ReportError("INVALID_FILE_COUNT");
  // New files are independently validated; retained slots are validated against the locked original.
  const files = Array.isArray(v.files) && !v.files.length ? [] : parseFiles(v.files, v.method);
  const count = keepSlots.length + files.length;
  if ((v.method === "form" && count !== 0) || (v.method !== "form" && (count < 1 || count > 2))) throw new ReportError("INVALID_FILE_COUNT");
  return { id: reportId(v.id), expectedVersion: int(v.expectedVersion, 0, 2147483646),
    method: v.method, writtenDate: isoDate(v.writtenDate), keepSlots,
    form: v.method === "form" ? parseForm(v.form) : null, files };
}
/** New leader forms stay simple; historic rows added by an admin remain editable. */
export function isSimpleLeaderForm(report: Pick<Submission, "method" | "form">): boolean {
  const form = report.form;
  return report.method === "form" && form?.entryMode === "leader" && !form.noMeeting
    && form.meetings.length === 1 && form.sharing.length === 0 && form.news.length === 0;
}
export function parseStoredReportEdit(value: unknown, report: Pick<Submission, "method" | "writtenDate" | "form">, admin: boolean): ReportEdit {
  const raw = object(value);
  const input = parseReportEdit(!admin && report.method === "form"
    ? { ...raw, method: report.method, writtenDate: report.writtenDate } : raw);
  if (report.form?.entryKind && input.method === "form") {
    return { ...input, form: { ...parseMemberSubmission({ id: input.id, form: { ...input.form, entryKind: report.form.entryKind } }).form, entryMode: "leader" } };
  }
  if (!admin && isSimpleLeaderForm(report)) {
    return { ...input, form: { ...parseMemberSubmission({ id: input.id, form: input.form }).form, entryMode: "leader" } };
  }
  return input;
}
export function assertReportMutation(actor: Pick<Actor, "id" | "role">, report: { authorId: string | null; submittedAt: string | null }, admin: boolean) {
  if (admin ? actor.role !== "admin" : report.authorId !== actor.id) throw new ReportError("FORBIDDEN", 403);
  if (!report.submittedAt) throw new ReportError("REPORT_NOT_FINALIZED", 409);
}
