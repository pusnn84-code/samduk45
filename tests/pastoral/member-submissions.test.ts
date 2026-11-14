import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), rows: vi.fn() }));
vi.mock("../../src/features/pastoral/db", async () => ({ ...await import("drizzle-orm"), getDb: mocks.getDb, rows: mocks.rows }));
import { submitMemberReport } from "../../src/features/pastoral/member-submissions";
import { getOwnReportSamMembers } from "../../src/features/pastoral/access";
import type { Actor } from "../../src/features/pastoral/policy";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor: Actor = { id:id(1), displayName:"연결 계정 이름", role:"member" };
const leader = { id:id(2), sourceName:"가상리더A", canonicalName:"가상리더", samLabel:"3-1", village:"3", isActive:true };
const member = { ...leader, id:id(3), sourceName:"가상샘원", canonicalName:"가상샘원" };
const sam = { id:id(4), name:"3-1", leaderName:"등록된 리더 표시명", leaderRosterId:leader.id, isActive:true };
const input = () => ({ id:id(5), form:{ meetings:[{ when:"2026-12-31 14:00", place:"가상 모임 장소", attendees:"가상 참석자" }], memberNotes:[{rosterId:member.id,member:"조작된 표시명",sharing:"나눔",prayer:"기도",news:"소식"}] } });
const dialect = new PgDialect();
const decode = (query: SQL) => dialect.sqlToQuery(query);

function storage(options: { role?: Actor["role"]; bound?: boolean; headOnly?: boolean; ambiguous?: boolean; stable?: boolean } = {}) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const saved = new Map<string,{ id:string; authorId:string; fingerprint:string; submitted:boolean }>();
  const targets = options.bound === false ? [{...sam,leaderRosterId:id(9)}] : options.ambiguous ? [sam,{...sam,id:id(8)}] : [sam];
  let at: Date | string = new Date("2026-12-31T15:01:00Z");
  const execute = vi.fn(async (query: SQL) => {
    const statement = decode(query); statements.push(statement);
    if (statement.sql.includes("insert into prayer_app.pastoral_reports")) {
      const params = statement.params;
      saved.set(String(params[0]), { id:String(params[0]), authorId:String(params[3]), fingerprint:String(params[10]), submitted:false });
    }
    if (statement.sql.includes("update prayer_app.pastoral_reports set submitted_at")) saved.get(String(statement.params[1]))!.submitted = true;
    return { rows:[] };
  });
  const tx = { execute };
  const transaction = vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx));
  mocks.getDb.mockReturnValue({ transaction, execute });
  mocks.rows.mockImplementation(async (_db, query: SQL) => {
    const statement = decode(query); const text = statement.sql;
    if (text.includes('select roster_id as "rosterId"')) return [{ rosterId:leader.id }];
    if (text.includes('from prayer_app.member_roster')) return [leader,member];
    if (text.includes('from prayer_app.sams order')) return targets;
    if (text.includes('from prayer_app.village_leaders')) return options.headOnly ? [{id:id(10),name:"3마을장",village:"3",leaderName:leader.sourceName,leaderRosterId:leader.id,isActive:true}] : [];
    if (text.includes('select s.id from prayer_app.sams')) return options.stable === false ? [] : [{id:sam.id}];
    if (text.includes('from prayer_app.pastoral_reports where id=')) return saved.has(String(statement.params[0])) ? [saved.get(String(statement.params[0]))] : [];
    if (text.includes('select clock_timestamp() as at')) return [{at}];
    if (text.includes('select id from prayer_app.pastoral_requests')) return [{id:id(11)}];
    throw new Error("UNEXPECTED_TEST_QUERY");
  });
  return { statements, saved, transaction, actor:{...actor,role:options.role??actor.role}, setTime:(value:Date|string)=>{at=value;} };
}

beforeEach(() => vi.resetAllMocks());
describe("atomic leader-only member pastoral submission", () => {
  it("accepts the raw timestamp strings returned by the real PostgreSQL driver", async () => {
    const state=storage(); state.setTime("2026-12-31 15:01:00+00");
    await expect(submitMemberReport(actor,input())).resolves.toEqual({id:id(5),submitted:true});
    const report=state.statements.find(statement=>statement.sql.includes("insert into prayer_app.pastoral_reports"))!;
    expect(report.params[8]).toBe("2027-01-01");
    expect(state.statements.find(statement=>statement.sql.includes("set submitted_at"))!.params[0]).toEqual(new Date("2026-12-31T15:01:00Z"));
  });
  it("stores and retries meeting-only and person-only submissions as independent reports", async () => {
    const state=storage();
    const meeting={id:id(5),form:{entryKind:"meeting",meetings:input().form.meetings,attendeeIds:[member.id],memberNotes:[]}};
    const personal={id:id(6),form:{entryKind:"member",meetings:[],memberNotes:input().form.memberNotes}};
    await submitMemberReport(actor,meeting);await submitMemberReport(actor,personal);
    await submitMemberReport(actor,meeting);await submitMemberReport(actor,personal);
    const inserts=state.statements.filter(statement=>statement.sql.includes("insert into prayer_app.pastoral_reports"));
    expect(inserts).toHaveLength(2);expect(state.saved.size).toBe(2);
    const meetingForm=JSON.parse(String(inserts[0].params[9]));const personForm=JSON.parse(String(inserts[1].params[9]));
    expect(meetingForm.entryKind).toBe("meeting");expect(meetingForm.meetings[0].attendees).toBe(member.sourceName);expect(meetingForm.memberNotes).toEqual([]);
    expect(personForm.entryKind).toBe("member");expect(personForm.meetings).toEqual([]);expect(personForm.memberNotes[0].member).toBe(member.sourceName);
  });
  it.each([{role:"admin" as const,bound:false},{bound:false,headOnly:true},{bound:false}])("rejects nonleader privileges before creating a period/report: %j", async options => {
    const state = storage(options);
    await expect(submitMemberReport(state.actor,input())).rejects.toMatchObject({code:"FORBIDDEN",status:403});
    expect(state.statements.some(statement=>statement.sql.includes("insert into"))).toBe(false);
  });
  it("uses bound roster identity and one KST instant, and creates only a disabled internal period", async () => {
    const state = storage();
    expect(await submitMemberReport(actor,input())).toEqual({id:id(5),submitted:true});
    expect(state.transaction).toHaveBeenCalledOnce();
    const period = state.statements.find(statement=>statement.sql.includes("insert into prayer_app.pastoral_requests"))!;
    expect(period.sql).toContain("false"); expect(period.sql).toContain("on conflict(year,month) do nothing");
    expect(period.params).toEqual([2027,1,actor.id]);
    const report = state.statements.find(statement=>statement.sql.includes("insert into prayer_app.pastoral_reports"))!;
    expect(report.params.slice(0,9)).toEqual([id(5),id(11),sam.id,actor.id,sam.name,"3",leader.sourceName,leader.sourceName,"2027-01-01"]);
    expect(JSON.parse(String(report.params[9])).memberNotes).toEqual([{...input().form.memberNotes[0],member:member.sourceName}]);
    expect(JSON.parse(String(report.params[9])).entryMode).toBe("leader");
    const final = state.statements.find(statement=>statement.sql.includes("set submitted_at"))!;
    expect(final.params).toEqual([new Date("2026-12-31T15:01:00Z"),id(5)]);
    expect(state.statements.some(statement=>statement.sql.includes("pastoral_schedule_versions"))).toBe(false);
  });
  it("retries the same ID without a duplicate report or recomputing its date across midnight", async () => {
    const state=storage(); await submitMemberReport(actor,input()); state.setTime(new Date("2027-01-31T15:01:00Z"));
    expect(await submitMemberReport(actor,input())).toEqual({id:id(5),submitted:true});
    expect(state.statements.filter(statement=>statement.sql.includes("insert into prayer_app.pastoral_reports"))).toHaveLength(1);
    await expect(submitMemberReport(actor,{...input(),form:{...input().form,other:"변경 내용"}})).rejects.toMatchObject({code:"ID_CONFLICT"});
  });
  it("does not accept another author's idempotency key", async () => {
    const state=storage(); await submitMemberReport(actor,input()); state.saved.get(id(5))!.authorId=id(9);
    await expect(submitMemberReport(actor,input())).rejects.toMatchObject({code:"ID_CONFLICT"});
  });
  it("fails closed for multiple active SAM bindings", async () => {
    const state=storage({ambiguous:true});
    await expect(submitMemberReport(actor,input())).rejects.toMatchObject({code:"SAM_BINDING_AMBIGUOUS",status:409});
    expect(state.statements.some(statement=>statement.sql.includes("insert into"))).toBe(false);
  });
  it("rechecks the persisted binding under row locks before writing", async () => {
    const state=storage({stable:false});
    await expect(submitMemberReport(actor,input())).rejects.toMatchObject({code:"FORBIDDEN"});
    expect(state.statements.some(statement=>statement.sql.includes("insert into"))).toBe(false);
  });
  it("rejects a note identity outside the leader's SAM before inserting the report", async () => {
    const state=storage(); const value=input(); value.form.memberNotes[0].rosterId=id(99);
    await expect(submitMemberReport(actor,value)).rejects.toMatchObject({code:"MEMBER_NOT_IN_SAM"});
    expect(state.statements.some(statement=>statement.sql.includes("insert into prayer_app.pastoral_reports"))).toBe(false);
  });
  it("does not allow requesting another SAM roster", async () => {
    storage(); await expect(getOwnReportSamMembers(actor,id(99))).rejects.toMatchObject({code:"FORBIDDEN",status:403});
    expect(await getOwnReportSamMembers(actor,sam.id)).toEqual([{rosterId:leader.id,member:leader.sourceName},{rosterId:member.id,member:member.sourceName}]);
  });
  it("rejects forged server fields before opening a transaction", async () => {
    storage(); await expect(submitMemberReport(actor,{...input(),samId:id(99)})).rejects.toMatchObject({code:"INVALID_INPUT"});
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
