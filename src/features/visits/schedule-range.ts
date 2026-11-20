import { DomainError } from "../../lib/http";
export function dateDistance(start:string,end:string){return (Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000;}
export function shiftDate(date:string,days:number){return new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;}
export function validateRange(start:string,end:string){
 const length=dateDistance(start,end);
 if(!validDate(start)||!validDate(end)||!Number.isInteger(length)||length<0||length>365)throw new DomainError('INVALID_SCHEDULE_RANGE',400);
 return length;
}
export function visitRange<T extends {visitDate:string;endDate?:string|null;allDay?:boolean;preferredTime:string}>(input:T):T {
 validateRange(input.visitDate,input.endDate??input.visitDate);
 return input.allDay?{...input,preferredTime:''}:input;
}
export function monthDates(start:string,end:string,month:string){
 const [year,number]=month.split('-').map(Number),days=new Date(Date.UTC(year,number,0)).getUTCDate();
 return Array.from({length:days},(_,i)=>month+'-'+String(i+1).padStart(2,'0')).filter(d=>d>=start&&d<=end);
}
export type RecipientPerson={id:string;name:string;sourceName?:string;sam:string|null;leaderName?:string|null};
export function matchingPeople(people:RecipientPerson[],value:string){
 const normalize=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');const name=normalize(value);
 return name?people.filter(p=>normalize(p.name)===name||(p.sourceName&&normalize(p.sourceName)===name)):[];
}
