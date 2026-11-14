import { describe, expect, it, vi } from "vitest";
import { parseMemberSubmission, parseStoredReportEdit, reportText, type ReportForm } from "../../src/features/pastoral/policy";
import { resolveReportMemberNotes } from "../../src/features/pastoral/access";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const base=():ReportForm=>({noMeeting:false,noMeetingReason:"",meetings:[],sharing:[],news:[],memberNotes:[],leaderPrayer:"",other:""});
const meeting=():ReportForm=>({...base(),entryKind:"meeting",attendeeIds:[id(1),id(2)],meetings:[{when:"2027-01-01 14:30",place:"가상 장소",attendees:"조작된 이름"}]});
const member=():ReportForm=>({...base(),entryKind:"member",memberNotes:[{rosterId:id(1),member:"조작된 이름",sharing:"나눈 내용",prayer:"",news:""}]});
const people=()=>[{rosterId:id(1),member:"가상샘원A"},{rosterId:id(2),member:"가상샘원B"}];

describe("separate pastoral submissions",()=>{
  it("accepts a member note without a meeting or attendee requirement",()=>{
    expect(parseMemberSubmission({id:id(9),form:member()}).form).toMatchObject({entryKind:"member",meetings:[],memberNotes:[{sharing:"나눈 내용"}]});
  });
  it("requires exactly one selected person with some content",()=>{
    expect(()=>parseMemberSubmission({id:id(9),form:{...member(),memberNotes:[]}})).toThrow("MEMBER_NOTE_REQUIRED");
    expect(()=>parseMemberSubmission({id:id(9),form:{...member(),memberNotes:[{...member().memberNotes![0],sharing:""}]}})).toThrow("MEMBER_NOTE_REQUIRED");
    expect(()=>parseMemberSubmission({id:id(9),form:{...member(),memberNotes:[...member().memberNotes!,{...member().memberNotes![0],rosterId:id(2)}]}})).toThrow("MEMBER_NOTE_REQUIRED");
  });
  it("keeps meeting and personal records independent",()=>{
    expect(parseMemberSubmission({id:id(9),form:meeting()}).form.memberNotes).toEqual([]);
    expect(()=>parseMemberSubmission({id:id(9),form:{...meeting(),memberNotes:member().memberNotes}})).toThrow("INVALID_INPUT");
    expect(()=>parseMemberSubmission({id:id(9),form:{...member(),meetings:meeting().meetings}})).toThrow("INVALID_INPUT");
    expect(()=>parseMemberSubmission({id:id(9),form:{...meeting(),attendeeIds:[]}})).toThrow("ATTENDEES_REQUIRED");
    expect(()=>parseMemberSubmission({id:id(9),form:{...meeting(),attendeeIds:[id(1),id(1)]}})).toThrow("INVALID_INPUT");
  });
  it("resolves selected attendees to server roster names and rejects another SAM's member",async()=>{
    const form=await resolveReportMemberNotes(meeting(),null,people);
    expect(form!.meetings[0].attendees).toBe("가상샘원A, 가상샘원B");
    await expect(resolveReportMemberNotes({...meeting(),attendeeIds:[id(99)]},null,people)).rejects.toMatchObject({code:"MEMBER_NOT_IN_SAM"});
  });
  it("resolves personal note names on the server and rejects out-of-scope IDs",async()=>{
    expect((await resolveReportMemberNotes(member(),null,people))!.memberNotes![0].member).toBe("가상샘원A");
    await expect(resolveReportMemberNotes({...member(),memberNotes:[{...member().memberNotes![0],rosterId:id(99)}]},null,people)).rejects.toMatchObject({code:"MEMBER_NOT_IN_SAM"});
  });
  it("retains historic attendees when only editing meeting time/place",async()=>{
    const previous=meeting();previous.meetings[0].attendees="이전 등록 이름";
    const load=vi.fn(people);
    const form=await resolveReportMemberNotes({...previous,meetings:[{...previous.meetings[0],place:"새 장소",attendees:"조작"}]},previous,load);
    expect(form!.meetings[0].attendees).toBe("이전 등록 이름");expect(load).not.toHaveBeenCalled();
  });
  it("retains original kind/date when editing a submitted personal record",()=>{
    const report={method:"form" as const,writtenDate:"2027-01-01",form:member()};
    const edit=parseStoredReportEdit({id:id(9),expectedVersion:1,method:"form",writtenDate:"2000-01-01",keepSlots:[],files:[],form:{...member(),entryKind:"meeting"}},report,false);
    expect(edit.form!.entryKind).toBe("member");expect(edit.writtenDate).toBe("2027-01-01");
  });
  it("exports a personal record without an unrelated empty meeting section",()=>{
    const text=reportText({method:"form",writtenDate:"2027-01-01",form:member(),samName:"1-1",leaderName:"가상리더",submittedBy:"가상리더",periodLabel:"2027년 1월"});
    expect(text).toContain("구분: 샘원 나눔·소식");expect(text).toContain("나눈 내용");expect(text).not.toContain("■ 샘모임");
  });
});
