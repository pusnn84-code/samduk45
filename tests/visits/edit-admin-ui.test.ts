import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminVisitDetail } from "../../components/admin/visits/AdminVisitDetail";
import type { AdminVisitRecord } from "../../src/features/visits/admin-service";
vi.stubGlobal("React",React);
const visit:AdminVisitRecord={id:"visit",requesterName:"가상 신청자",recipientName:"가상 대상",visitDate:"2026-11-24",endDate:"2026-11-24",allDay:false,visitType:"personal",attendees:"",location:"교회",preferredTime:"오후 2시",reason:"나눔과 기도",status:"requested",calendarSyncStatus:"synced",googleEventId:null};
describe("administrator visit edit form",()=>{
 it.each(["requested","confirmed","completed","cancelled"] as const)("keeps inputs and save enabled for %s",status=>{
  const html=renderToStaticMarkup(React.createElement(AdminVisitDetail,{visit:{...visit,status},busy:false,onSave:async()=>{},onAction:async()=>{}}));
  expect(html).toContain("수정 내용 저장");expect(html).not.toContain('disabled=""');expect(html).toContain("나눔과 기도");
 });
});
