import {describe,it,expect} from "vitest";
import {AutumnCreate,AutumnFilter,AutumnPatch,assertAutumnEdit,autumnStatusLabels} from "../../src/features/autumn-light/policy";
const owner={id:"owner",role:"member" as const};
describe("autumn light privacy and permissions",()=>{
 it("keeps status changes exclusive to the full administrator, including unchecking",()=>{
  for(const input of [{visited:true,expectedVersion:1},{registered:false,expectedVersion:1}])expect(()=>assertAutumnEdit(owner,"owner",input)).toThrow("FORBIDDEN");
  expect(()=>assertAutumnEdit({...owner,role:"admin"},null,{visited:false,registered:true,expectedVersion:1})).not.toThrow();
 });
 it("lets members edit only their own new card",()=>{
  expect(()=>assertAutumnEdit(owner,"owner",{prayer:"기도",expectedVersion:1})).not.toThrow();
  expect(()=>assertAutumnEdit(owner,"someone-else",{name:"다른 이름",expectedVersion:1})).toThrow("FORBIDDEN");
  expect(()=>assertAutumnEdit(owner,null,{prayer:"기도",expectedVersion:1})).toThrow("FORBIDDEN");
 });
 it("shows only positive checked statuses",()=>{
  expect(autumnStatusLabels({visited:false,registered:false})).toEqual([]);
  expect(autumnStatusLabels({visited:true,registered:false})).toEqual(["초청일 방문"]);
  expect(autumnStatusLabels({visited:false,registered:true})).toEqual(["교회 등록"]);
  expect(autumnStatusLabels({visited:true,registered:true})).toEqual(["초청일 방문","교회 등록"]);
 });
 it("limits villages to one through five without removing valid sixth sams",()=>{
  expect(AutumnFilter.safeParse({village:"6"}).success).toBe(false);
  expect(AutumnFilter.parse({village:"2"})).toMatchObject({village:2,page:0});
 });
 it("rejects spoofed author and status on registration",()=>{
  const base={name:"예시",samId:"00000000-0000-4000-8000-000000000001",prayer:"기도",submissionKey:"00000000-0000-4000-8000-000000000002"};
  expect(AutumnCreate.parse(base)).toMatchObject({allowDuplicate:false});
  for(const extra of [{visited:true},{registered:true},{authorName:"다른 작성자"},{createdByUserId:"other"}])expect(AutumnCreate.safeParse({...base,...extra}).success).toBe(false);
  expect(AutumnPatch.safeParse({expectedVersion:1}).success).toBe(false);
 });
});
