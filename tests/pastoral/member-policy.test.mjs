import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveAccess, deriveMemberLeaderAccess, isSimpleLeaderForm, parseForm, parseMemberSubmission, parseStoredReportEdit } from '../../src/features/pastoral/policy.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = { id:id(1), sourceName:'가상리더', canonicalName:'가상리더', samLabel:'3-1', village:'3', isActive:true };
const sam = { id:id(2), name:'3-1', village:'3', leaderName:'가상리더', leaderRosterId:person.id, isActive:true };
const actor = { id:id(3), displayName:'가상리더', role:'member' };
const payload = () => ({ id:id(4), form:{ meetings:[{when:'2027-01-01 14:30',place:'가상 모임 장소',attendees:'가상 참석자'}], memberNotes:[{rosterId:id(5),member:'가상샘원',sharing:'나눔',prayer:'기도',news:'소식'}] } });
const access = (a=actor, p=person, sams=[sam], heads=[]) => deriveMemberLeaderAccess(deriveAccess(a,p,sams,[p],heads));

test('member composer excludes administrators and village heads without an actual SAM binding',()=>{
  assert.equal(access({...actor,role:'admin'},person,[{...sam,leaderRosterId:id(9)}]).visible,false);
  const head={id:id(8),name:'3마을장',village:'3',leaderName:person.sourceName,leaderRosterId:person.id,isActive:true};
  assert.equal(access(actor,person,[{...sam,leaderRosterId:id(9)}],[head]).visible,false);
});
test('bound active SAM leaders retain only their own SAM even when also an administrator',()=>{
  const own=access({...actor,role:'admin'},person,[sam,{...sam,id:id(7),leaderRosterId:id(9)}]);
  assert.equal(own.visible,true);assert.deepEqual(own.sams,[sam]);assert.deepEqual(own.requiredSamIds,[sam.id]);
});
test('inactive identities, retired SAMs and matching display names cannot grant member access',()=>{
  assert.equal(access(actor,{...person,isActive:false}).visible,false);
  assert.equal(access(actor,person,[{...sam,isActive:false}]).visible,false);
  assert.equal(access(actor,{...person,id:id(9)}).visible,false);
});
test('form-only member submission keeps the three member note columns',()=>{
  const value=parseMemberSubmission(payload());
  assert.equal(value.form.meetings.length,1);assert.equal(value.form.noMeeting,false);
  assert.deepEqual(value.form.memberNotes,payload().form.memberNotes);
});
test('client cannot choose a target, author, period, date, method or files',()=>{
  for(const field of ['samId','requestId','authorId','writtenDate','year','month','method','files'])
    assert.throws(()=>parseMemberSubmission({...payload(),[field]:'forged'}),{code:'INVALID_INPUT'});
});
test('self-service submission requires exactly one meeting and complete date/time/place/attendance',()=>{
  for(const form of [{meetings:[]},{meetings:[{},{}]},{...payload().form,noMeeting:true}])
    assert.throws(()=>parseMemberSubmission({...payload(),form}),{code:'SINGLE_MEETING_REQUIRED'});
  for(const when of ['2027-01-01','2027-01-01 24:00','2027-01-01 12:60','2027-02-30 12:00'])
    assert.throws(()=>parseMemberSubmission({...payload(),form:{meetings:[{...payload().form.meetings[0],when}]}}));
  for(const key of ['place','attendees'])
    assert.throws(()=>parseMemberSubmission({...payload(),form:{meetings:[{...payload().form.meetings[0],[key]:''}]}}),{code:'MEETING_DETAILS_REQUIRED'});
});
test('historic multi-meeting and no-meeting reports keep their legacy parser',()=>{
  assert.equal(parseForm({meetings:[{when:'지난 주',place:'장소'},{when:'이번 주',place:'다른 장소'}]}).meetings.length,2);
  assert.equal(parseForm({noMeeting:true,noMeetingReason:'기존 사유'}).noMeetingReason,'기존 사유');
});
const stored=()=>({method:'form',writtenDate:'2027-01-01',form:{...parseMemberSubmission(payload()).form,entryMode:'leader'}});
const edit=()=>({id:id(6),expectedVersion:0,method:'form',writtenDate:'2000-01-01',form:payload().form,keepSlots:[],files:[]});
test('member form revisions retain the server-stored method/date even with forged browser fields',()=>{
  const parsed=parseStoredReportEdit({...edit(),method:'file'},stored(),false);
  assert.equal(parsed.method,'form');assert.equal(parsed.writtenDate,'2027-01-01');assert.equal(parsed.form.entryMode,'leader');
});
test('new single-meeting revisions cannot introduce no-meeting or extra meeting rows',()=>{
  for(const form of [{...payload().form,noMeeting:true,noMeetingReason:'사유'},{...payload().form,meetings:[...payload().form.meetings,...payload().form.meetings]}])
    assert.throws(()=>parseStoredReportEdit({...edit(),form},stored(),false),{code:'SINGLE_MEETING_REQUIRED'});
});
test('legacy multirow and administrator-expanded forms remain visible instead of being silently collapsed',()=>{
  const legacy={...stored(),form:{...stored().form,meetings:[...stored().form.meetings,...stored().form.meetings]}};
  assert.equal(isSimpleLeaderForm(legacy),false);
  assert.equal(parseStoredReportEdit({...edit(),form:legacy.form},legacy,false).form.meetings.length,2);
  const direct={...stored(),form:{...stored().form,sharing:[{member:'가상 과거 샘원',content:'과거 기록'}]}};
  assert.equal(isSimpleLeaderForm(direct),false);
});
test('legacy attachment conversion and explicit administrator corrections retain their existing policy',()=>{
  const old={method:'photo',writtenDate:'2026-01-01',form:null};
  assert.equal(parseStoredReportEdit(edit(),old,false).method,'form');
  assert.equal(parseStoredReportEdit(edit(),stored(),true).writtenDate,'2000-01-01');
});
