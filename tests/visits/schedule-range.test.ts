import {describe,it,expect} from 'vitest';
import {validateRange,monthDates,matchingPeople,visitRange} from '../../src/features/visits/schedule-range';
import {expandMinistry,displayTime} from '../../src/features/visits/shared-calendar-policy';
import {MinistryInput} from '../../src/features/visits/shared-calendar';
const series={id:'range',title:'세미나',startDate:'2026-11-30',eventEndDate:'2026-12-02',endDate:null,time:'',allDay:true,location:'교회',repeat:'none'};
describe('inclusive schedule dates and all-day events',()=>{
 it('uses every inclusive day across month and year boundaries',()=>{
  expect(monthDates('2026-11-30','2026-12-02','2026-11')).toEqual(['2026-11-30']);
  expect(monthDates('2026-11-30','2026-12-02','2026-12')).toEqual(['2026-12-01','2026-12-02']);
  expect(expandMinistry([series],'2026-12').map(e=>e.date)).toEqual(['2026-12-01','2026-12-02']);
  expect(expandMinistry([{...series,startDate:'2026-12-31',eventEndDate:'2027-01-02'}],'2027-01').map(e=>e.date)).toEqual(['2027-01-01','2027-01-02']);
 });
 it('keeps legacy weekly recurrence end separate from occurrence end',()=>{
  const weekly={...series,startDate:'2026-11-05',eventEndDate:'2026-11-06',endDate:'2026-11-12',repeat:'weekly'};
  expect(expandMinistry([weekly],'2026-11').map(e=>e.date)).toEqual(['2026-11-05','2026-11-06','2026-11-12','2026-11-13']);
  expect(expandMinistry([weekly],'2026-12')).toEqual([]);
  expect(expandMinistry([{...weekly,eventEndDate:undefined}],'2026-11').map(e=>e.date)).toEqual(['2026-11-05','2026-11-12']);
 });
 it('stores all-day without a fabricated midnight time',()=>{
  expect(expandMinistry([series],'2026-11')[0]).toMatchObject({allDay:true,time:'',startDate:'2026-11-30',endDate:'2026-12-02'});
  expect(displayTime('',true)).toBe('종일');
  expect(visitRange({visitDate:'2026-11-21',endDate:'2026-11-22',allDay:true,preferredTime:'14:00'}).preferredTime).toBe('');
 });
 it('rejects invalid and excessive ranges and invalid timed events',()=>{
  for(const [start,end] of [['2026-11-22','2026-11-21'],['2026-02-29','2026-03-01'],['2026-01-01','2027-01-02']])expect(()=>validateRange(start,end)).toThrow('INVALID_SCHEDULE_RANGE');
  expect(MinistryInput.safeParse({title:'종일',startDate:'2026-11-21',eventEndDate:'2026-11-22',allDay:true,time:''}).success).toBe(true);
  expect(MinistryInput.safeParse({title:'시간',startDate:'2026-11-21',time:''}).success).toBe(false);
  expect(MinistryInput.safeParse({title:'반복',startDate:'2026-11-21',eventEndDate:'2026-11-28',repeat:'weekly',time:'14:00'}).success).toBe(false);
 });
 it('matches exact names or aliases without assigning ambiguous people',()=>{
  const people=[{id:'a',name:'김믿음A',sourceName:'김믿음',sam:'1-2샘',leaderName:'박은혜'},{id:'b',name:'김믿음B',sourceName:'김믿음',sam:'2-1샘'}];
  expect(matchingPeople(people,'김믿음')).toHaveLength(2);
  expect(matchingPeople(people,'김 믿음A')).toEqual([people[0]]);
  expect(matchingPeople(people,'김믿')).toEqual([]);
  expect(matchingPeople(people,'')).toEqual([]);
 });
});
