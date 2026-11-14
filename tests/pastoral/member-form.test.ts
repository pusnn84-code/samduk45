import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReportEntry } from "../../components/pastoral/ReportEntry";
import { ReportFormFields } from "../../components/pastoral/ReportFormFields";
import { ReportEditor } from "../../components/pastoral/ReportEditor";
import { emptyForm, type ReportView } from "../../components/pastoral/client";
import { parseForm } from "../../src/features/pastoral/policy";
import { SplitReportFields, emptySplitForm } from "../../components/pastoral/SplitReportFields";
vi.stubGlobal("React",React);

describe("single meeting member composer",()=>{
  it("shows note fields only for the selected person, with no meeting inputs or visible checkboxes",()=>{
    const html=renderToStaticMarkup(React.createElement(SplitReportFields,{form:{...emptySplitForm("member"),memberNotes:[{rosterId:"person",member:"선택한샘원",sharing:"나눔",prayer:"",news:""}]},people:[{rosterId:"person",member:"선택한샘원"},{rosterId:"other",member:"선택하지않은샘원"}],error:false,retry:()=>{},onChange:()=>{}}));
    expect(html).toContain('aria-label="선택한샘원 나눔"');expect(html).toContain('aria-label="선택한샘원 기도제목"');expect(html).toContain('aria-label="선택한샘원 소식"');
    expect(html).not.toContain("선택하지않은샘원");expect(html).not.toContain('type="date"');expect(html).not.toContain('type="checkbox"');
  });
  it("shows server-bound author/SAM and only the four meeting inputs",()=>{
    const html=renderToStaticMarkup(React.createElement(ReportEntry,{sam:{id:"sam",name:"3-1",village:"3",leaderName:"가상리더",isActive:true},authorName:"가상리더A",onSubmitted:()=>{}}));
    expect(html).toContain("3-1샘");expect(html).toContain("가상리더A");
    expect(html).toContain('aria-label="샘모임 날짜"');expect(html).toContain('aria-label="샘모임 시간"');
    expect(html).toContain('aria-label="샘모임 장소"');expect(html).toContain('aria-label="샘모임 참석자"');
    expect(html.match(/type="date"/g)).toHaveLength(1);expect(html.match(/type="time"/g)).toHaveLength(1);
    for(const removed of ["<select",'type="radio"','type="file"','type="checkbox"',"행 추가","행 제거","월별 제출 요청","제출 대상 월","<label>작성일"]) expect(html).not.toContain(removed);
  });
  it("retains the roster's three note columns in simple mode without row management",()=>{
    const form={...emptyForm(),memberNotes:[{rosterId:"person",member:"가상샘원",sharing:"나눔 기록",prayer:"기도 기록",news:"소식 기록"}]};
    const html=renderToStaticMarkup(React.createElement(ReportFormFields,{form,samId:"sam",simple:true,onChange:()=>{}}));
    for(const label of ["가상샘원 나눔","가상샘원 기도제목","가상샘원 소식"])expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain("나눔 기록");expect(html).toContain("기도 기록");expect(html).toContain("소식 기록");
    expect(html).not.toContain("행 추가");expect(html).not.toContain("샘모임 없음");
  });
  it("keeps historic no-meeting, multi-meeting and direct-entry controls in the legacy editor mode",()=>{
    const html=renderToStaticMarkup(React.createElement(ReportFormFields,{form:emptyForm(),samId:"sam",onChange:()=>{}}));
    expect(html).toContain("샘모임 없음");expect(html).toContain("샘모임 행 추가");expect(html).toContain("샘원 기록 직접 입력");
  });
  const report=():ReportView=>({id:"report",requestId:"period",samId:"sam",samName:"3-1",leaderName:"가상리더",submittedBy:"가상리더",periodLabel:"2027년 1월",submittedAt:"2027-01-01T00:00:00Z",version:0,isOwner:true,method:"form",writtenDate:"2027-01-01",files:[],form:{...parseForm({meetings:[{when:"2027-01-01 14:00",place:"가상 장소",attendees:"가상 참석자"}]}),entryMode:"leader"}});
  const editor=(value=report(),admin=false)=>renderToStaticMarkup(React.createElement(ReportEditor,{report:value,admin,onSaved:()=>{},onCancel:()=>{}}));
  it("keeps a new form's edit screen single-meeting without resurfacing date, method or row controls",()=>{
    const html=editor();
    expect(html.match(/type="date"/g)).toHaveLength(1);expect(html).toContain('aria-label="샘모임 시간"');
    for(const removed of ['type="radio"','type="file"','type="checkbox"',"행 추가","행 제거","<label>작성일"])expect(html).not.toContain(removed);
  });
  it("preserves visible historic multirow data while keeping member form date/method fixed",()=>{
    const value=report();value.form={...value.form!,meetings:[value.form!.meetings[0],{when:"과거 원문 일시",place:"과거 장소",attendees:"과거 참석자"}],sharing:[{member:"가상 과거 샘원",content:"이전 나눔"}]};
    const html=editor(value);
    for(const text of ["과거 원문 일시","과거 장소","과거 참석자","가상 과거 샘원","이전 나눔"])expect(html).toContain(text);
    expect(html).toContain("샘모임 행 추가");expect(html).not.toContain("pastoral-edit-method");expect(html).not.toContain("<label>작성일");
  });
  it("retains the historical attachment editor and administrator correction controls",()=>{
    const attachment={...report(),method:"photo" as const,form:null,files:[{name:"과거사진.png",size:100,sha256:"a".repeat(64)}]};
    const old=editor(attachment);expect(old).toContain("과거사진.png 유지");expect(old).toContain("새 첨부파일 추가");expect(old).toContain("pastoral-edit-method");
    const admin=editor(report(),true);expect(admin).toContain("<label>작성일");expect(admin).toContain("pastoral-edit-method");
  });
});
