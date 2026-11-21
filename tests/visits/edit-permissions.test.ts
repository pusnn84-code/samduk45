import { describe, expect, it, vi } from "vitest";
import { canEditVisit } from "../../src/features/visits/edit-policy";
import { getEditableVisit, MemberVisitPatch, saveVisitEdit, type EditableVisit, type VisitEditRepository } from "../../src/features/visits/edit-service";

const actor={id:"owner",role:"member"};
const record:EditableVisit={id:"visit",requesterUserId:"owner",requesterName:"가상 신청자",status:"requested",isUnavailable:false,
 recipientName:"가상 대상",recipientSam:"1-2샘",recipientLeaderName:"가상 리더",visitDate:"2099-11-24",endDate:"2099-11-24",
 allDay:false,visitType:"sam",attendees:"가상 신청자, 가상 샘원",location:"교회",preferredTime:"오후 2시",reason:"함께 기도하고 싶습니다."};
function repository(patch:Partial<EditableVisit>={}):VisitEditRepository{return {getById:vi.fn(async()=>({...record,...patch})),update:vi.fn(async()=>true)};}
describe("visit edit permissions",()=>{
 it.each(["requested","confirmed","completed","cancelled"])("lets the administrator edit %s without changing its workflow state",async status=>{
  const repo=repository({status});const validate=vi.fn();
  expect(canEditVisit({id:"pastor",role:"admin"},{...record,status})).toBe(true);
  await saveVisitEdit({id:"pastor",role:"admin"},"visit",{location:"가정"},repo,validate);
  expect(repo.update).toHaveBeenCalledWith("visit",{location:"가정"},undefined);expect(validate).not.toHaveBeenCalled();
 });
 it("allows an applicant to update only their own waiting request",async()=>{
  const repo=repository();await saveVisitEdit(actor,"visit",{location:"카페"},repo);
  expect(repo.update).toHaveBeenCalledWith("visit",{location:"카페"},"owner");
 });
 it.each(["confirmed","completed","cancelled"])("blocks the applicant's %s record on both reading an edit form and saving",async status=>{
  const repo=repository({status});expect(canEditVisit(actor,{...record,status})).toBe(false);
  await expect(getEditableVisit(actor,"visit",repo)).rejects.toMatchObject({code:"VISIT_NOT_EDITABLE",status:409});
  await expect(saveVisitEdit(actor,"visit",{reason:"바꾸기"},repo)).rejects.toMatchObject({code:"VISIT_NOT_EDITABLE"});
  expect(repo.update).not.toHaveBeenCalled();
 });
 it("does not expose or edit somebody else's reason, including to a sam leader",async()=>{
  const repo=repository();await expect(getEditableVisit({id:"other",role:"leader"},"visit",repo)).rejects.toMatchObject({code:"VISIT_NOT_FOUND",status:404});
  await expect(saveVisitEdit({id:"other",role:"member"},"visit",{location:"가정"},repo)).rejects.toMatchObject({code:"VISIT_NOT_FOUND"});expect(repo.update).not.toHaveBeenCalled();
 });
 it("rejects a missing record",async()=>{const repo=repository();vi.mocked(repo.getById).mockResolvedValue(null);await expect(getEditableVisit(actor,"visit",repo)).rejects.toMatchObject({status:404});});
 it("rejects an applicant's forged status, ownership or recipient fields",async()=>{
  for(const patch of [{status:"confirmed"},{requesterUserId:"other"},{recipientName:"다른 사람"},{recipientSam:"2-1샘"},{isUnavailable:false},{}])expect(MemberVisitPatch.safeParse(patch).success).toBe(false);
 });
 it("does not save a date outside booking availability",async()=>{
  const repo=repository();const validate=vi.fn().mockRejectedValue(new Error("DATE_UNAVAILABLE"));
  await expect(saveVisitEdit(actor,"visit",{visitDate:"2099-12-01",endDate:"2099-12-02"},repo,validate)).rejects.toThrow("DATE_UNAVAILABLE");
  expect(repo.update).not.toHaveBeenCalled();expect(validate).toHaveBeenCalledWith(expect.objectContaining({visitDate:"2099-12-01",endDate:"2099-12-02",requesterUserId:"owner"}));
 });
 it("preserves a past waiting request's date when only its details are corrected",async()=>{
  const repo=repository({visitDate:"2020-01-01",endDate:null});const validate=vi.fn();
  await saveVisitEdit(actor,"visit",{visitDate:"2020-01-01",endDate:"2020-01-01",reason:"소식 정정"},repo,validate);
  expect(validate).not.toHaveBeenCalled();expect(repo.update).toHaveBeenCalled();
 });
 it("rejects a stale edit when confirmation wins the database update",async()=>{
  const repo=repository();vi.mocked(repo.update).mockResolvedValue(false);
  await expect(saveVisitEdit(actor,"visit",{location:"카페"},repo)).rejects.toMatchObject({code:"VISIT_NOT_EDITABLE",status:409});
  expect(repo.update).toHaveBeenCalledWith("visit",{location:"카페"},"owner");
 });
});
