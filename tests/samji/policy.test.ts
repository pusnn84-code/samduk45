import {describe,it,expect} from 'vitest';
import {Content,RecordInput,shareQuestions,validateAnswerKeys} from '../../src/features/samji/policy';
import {starter} from '../../src/features/samji/starter';
import {parseSamjiText} from '../../src/features/samji/parse';
describe('은혜의 샘지 document and private records',()=>{
 it('keeps the four questions, complete seven verses, full commentary and hymn lyrics',()=>{
  expect(Content.safeParse(starter.content).success).toBe(true);expect(starter.content.filter(b=>b.kind==='question')).toHaveLength(4);
  const bible=starter.content.find(b=>b.kind==='scripture')!.text;expect(bible.match(/^[3-9] /gm)).toHaveLength(7);expect(bible).toContain('믿음의 결국 곧 영혼의 구원을 받음이라');
  const hymn=starter.content.find(b=>b.kind==='hymn')!;expect(hymn.hymnNumber).toBe(246);for(const label of ['1절','2절','3절','후렴'])expect(hymn.lyrics).toContain(label);
 });
 it('copies only answered questions and their answers, with no title, scripture or notes',()=>{
  const q=starter.content.filter(b=>b.kind==='question');const answers={[q[0].id]:'첫 답변',[q[1].id]:'   ',[q[2].id]:'세 번째 답변'};
  expect(shareQuestions(starter.content,answers)).toBe(`1. ${q[0].text}\n첫 답변\n\n2. ${q[2].text}\n세 번째 답변`);
 });
 it('rejects forged fields, duplicate notes and answers referring to non-question blocks',()=>{
  const id=starter.content[0].id,note={id,text:'메모'};expect(RecordInput.safeParse({version:0,answers:{},notes:[note],ownerUserId:id}).success).toBe(false);
  expect(RecordInput.safeParse({version:0,answers:{},notes:[note,note]}).success).toBe(false);expect(RecordInput.safeParse({version:0,answers:{},notes:[{...note,title:'이름'}]}).success).toBe(false);
  const bible=starter.content.find(b=>b.kind==='scripture')!;expect(validateAnswerKeys(starter.content,{[bible.id]:'forged'})).toBe(false);
 });
 it('parses the PDF section order and wrapped numbered questions without dropping scripture',()=>{
  const text='은혜의 샘 2026. 11. 22\n마음을 여는 시간\n1) 오늘 바라는 것은\n무엇인가요?\n2) 위로는 무엇인가요?\n다함께 찬양\n찬송가 246장(통 221장) 나 가나안 땅 귀한 성에\n기도\n함께 기도합니다.\n성경통독 베드로전서 1장 3-9절\n3 우리 주 예수 그리스도\n4 썩지 않고\n말씀 속으로 “살아있는 소망”\n말씀 해설입니다.\n말씀 나눔\n1) 본문 적용은 무엇인가요?\n2) 오늘 적용은 무엇인가요?\n함께 기도하기\n서로 기도합니다.';
  let n=0;const parsed=parseSamjiText(text,'samji.pdf',()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`);
  expect(parsed.date).toBe('2026-11-22');expect(parsed.title).toBe('살아있는 소망');expect(parsed.content.filter(b=>b.kind==='question')).toHaveLength(4);expect(parsed.content[0].text).toBe('오늘 바라는 것은 무엇인가요?');expect(parsed.content.find(b=>b.kind==='scripture')?.text).toContain('4 썩지 않고');expect(Content.safeParse(parsed.content).success).toBe(true);
 });
});
