import type {NoticeConfirmationPerson} from "./types";
export type ConfirmationGroup={key:string;title:string;entries:{person:NoticeConfirmationPerson;label:string}[]};
export function groupConfirmationPeople(people:NoticeConfirmationPerson[]):ConfirmationGroup[]{
 const positioned=people.map(person=>{
  const sams=person.responsibilities.flatMap(role=>{const match=/^([1-5])\s*-\s*([1-9]\d*)\s*샘(?:\s|$)/u.exec(role);return match?[{village:Number(match[1]),sam:Number(match[2])}]:[];}).sort((a,b)=>a.village-b.village||a.sam-b.sam);
  if(sams.length){const {village,sam}=sams[0];return {person,village,order:sam,label:`${village}-${sam}샘`};}
  const heads=person.responsibilities.flatMap(role=>{const match=/^([1-5])\s*마을장$/u.exec(role);return match?[Number(match[1])]:[];}).sort((a,b)=>a-b);
  return {person,village:heads[0]??99,order:Number.MAX_SAFE_INTEGER,label:person.responsibilities.includes("목사")?"목사":heads.length?"마을장":person.responsibilities.includes("임원")?(person.responsibilities.find(role=>["총무","회계","서기"].includes(role))??"임원"):person.responsibilities.includes("관리자")?"관리자":"리더"};
 }).sort((a,b)=>a.village-b.village||a.order-b.order||a.person.name.localeCompare(b.person.name,"ko")||a.person.id.localeCompare(b.person.id));
 const groups:ConfirmationGroup[]=[];
 for(const row of positioned){const key=row.village===99?"other":String(row.village);let group=groups.find(group=>group.key===key);if(!group){group={key,title:key==="other"?(positioned.some(item=>item.village===99&&item.person.responsibilities.includes("목사"))?"임원 · 목사":"임원 · 관리자"):row.village+"마을",entries:[]};groups.push(group);}group.entries.push({person:row.person,label:row.label});}
 return groups;
}
