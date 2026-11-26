import {it,expect} from "vitest";
import {groupConfirmationPeople} from "../../src/features/notices/confirmation-layout";
const person=(id:string,roles:string[],confirmedAt:string|null=null)=>({id,name:id,responsibilities:roles,confirmedAt});
it("sorts across statuses by numeric village and sam without sorting 10 before 2",()=>{
 const rows=[person("ten",["1-10샘 리더"]),person("two",["1-2샘 리더"],"2026-11-26T01:00:00Z"),person("v2",["2-1샘 리더"]),person("one",["1-1샘 리더"])];
 const result=groupConfirmationPeople(rows);expect(result.map(g=>g.title)).toEqual(["1마을","2마을"]);expect(result[0].entries.map(e=>e.label)).toEqual(["1-1샘","1-2샘","1-10샘"]);expect(result[0].entries[1].person.confirmedAt).toBe("2026-11-26T01:00:00Z");expect(rows[0].id).toBe("ten");
});
it("keeps people with combined roles once and retains officers, administrators and heads",()=>{
 const result=groupConfirmationPeople([person("leader",["임원","1마을장","1-1샘 리더","2-2샘 리더"]),person("head",["2마을장"]),person("officer",["임원","총무"]),person("pastor",["관리자"])]);
 expect(result.map(g=>g.title)).toEqual(["1마을","2마을","임원 · 관리자"]);expect(result.flatMap(g=>g.entries).map(e=>e.person.id).sort()).toEqual(["head","leader","officer","pastor"]);expect(result[1].entries[0].label).toBe("마을장");expect(result[2].entries.map(e=>e.label).sort()).toEqual(["관리자","총무"]);
});
it("has no empty village blocks or per-village confirmation totals",()=>{expect(groupConfirmationPeople([])).toEqual([]);expect(Object.keys(groupConfirmationPeople([person("one",["1-1샘 리더"])])[0]).sort()).toEqual(["entries","key","title"]);});
