import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({db:vi.fn(),rows:vi.fn(),locked:vi.fn(),access:vi.fn()}));
vi.mock("../../src/features/pastoral/db",async()=>({...await import("drizzle-orm"),getDb:mocks.db,rows:mocks.rows}));
vi.mock("../../src/features/pastoral/reports",()=>({lockedReport:mocks.locked,readFile:vi.fn()}));
vi.mock("../../src/features/pastoral/access",()=>({requireReportAccess:mocks.access,requireReportAdmin:vi.fn(),getReportSamMembers:vi.fn(),resolveReportMemberNotes:async(form:unknown)=>form}));
import { beginReportEdit, publishReportEdit } from "../../src/features/pastoral/edits";
import { parseForm } from "../../src/features/pastoral/policy";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const actor={id:id(1),displayName:"가상리더",role:"member" as const};
const form=()=>({...parseForm({meetings:[{when:"2027-01-01 14:00",place:"가상 장소",attendees:"가상 참석자"}]}),entryMode:"leader" as const});
const report=()=>({id:id(2),authorId:actor.id,submittedAt:"2027-01-01T00:00:00Z",version:0,method:"form",writtenDate:"2027-01-01",form:form(),files:[]});
const change=()=>({id:id(3),expectedVersion:0,method:"file",writtenDate:"2000-01-01",form:form(),keepSlots:[],files:[]});
const dialect=new PgDialect();
function storage(){
  const statements:{sql:string;params:unknown[]}[]=[];
  const tx={execute:vi.fn(async(query:SQL)=>{statements.push(dialect.sqlToQuery(query));return{rows:[]};})};
  mocks.db.mockReturnValue({transaction:async(callback:(value:typeof tx)=>unknown)=>callback(tx)});
  mocks.locked.mockResolvedValue(report());mocks.rows.mockResolvedValueOnce([]).mockResolvedValueOnce([{count:0}]);
  return statements;
}
beforeEach(()=>vi.resetAllMocks());
describe("stored member form revision",()=>{
  it("stores the original date/method and the simple-form marker despite forged client controls",async()=>{
    const statements=storage();await beginReportEdit(actor,id(2),change());
    const insert=statements.find(statement=>statement.sql.includes("insert into prayer_app.pastoral_report_edits"))!;
    const saved=JSON.parse(String(insert.params[4]));
    expect(saved.method).toBe("form");expect(saved.writtenDate).toBe("2027-01-01");expect(saved.form.entryMode).toBe("leader");
  });
  it("rejects extra meeting rows before creating a revision",async()=>{
    const statements=storage();const value=change();value.form.meetings.push({...value.form.meetings[0]});
    await expect(beginReportEdit(actor,id(2),value)).rejects.toMatchObject({code:"SINGLE_MEETING_REQUIRED"});
    expect(statements.some(statement=>statement.sql.includes("insert into"))).toBe(false);
  });
  it("rechecks the stored method/date when publishing a staged revision",async()=>{
    const statements=storage();mocks.rows.mockReset().mockResolvedValue([{id:id(3),actorId:actor.id,payload:change(),applied:false,expired:false}]);
    await publishReportEdit(actor,id(2),id(3));
    const update=statements.find(statement=>statement.sql.includes("update prayer_app.pastoral_reports set written_date"))!;
    expect(update.params.slice(0,2)).toEqual(["2027-01-01","form"]);
    expect(JSON.parse(String(update.params[2])).entryMode).toBe("leader");
  });
});
