import {z} from 'zod';
export const PDF_LIMIT=3*1024*1024;
export const Block=z.object({id:z.uuid(),kind:z.enum(['text','question','scripture','hymn']),heading:z.string().trim().max(100).default(''),text:z.string().trim().max(30000),hymnNumber:z.number().int().min(1).max(645).optional(),lyrics:z.string().trim().max(10000).optional()}).strict().superRefine((v,c)=>{
 if(v.kind==='question'&&!v.text)c.addIssue({code:'custom',message:'질문을 입력해 주세요.'});
 if(v.kind==='hymn'&&(!v.hymnNumber||!v.lyrics?.trim()))c.addIssue({code:'custom',message:'찬송가 번호와 가사를 확인해 주세요.'});
 if(v.kind!=='hymn'&&(v.hymnNumber!==undefined||v.lyrics!==undefined))c.addIssue({code:'custom',message:'찬송가 항목을 확인해 주세요.'});
});
export const Content=z.array(Block).min(1).max(80).refine(v=>new Set(v.map(b=>b.id)).size===v.length).refine(v=>v.some(b=>b.kind==='question')).refine(v=>JSON.stringify(v).length<=180000);
export type SamjiBlock=z.infer<typeof Block>;
export const DocumentInput=z.object({id:z.uuid(),date:z.iso.date(),title:z.string().trim().min(1).max(120),content:Content}).strict();
export const RecordInput=z.object({version:z.number().int().min(0).max(1000000000),answers:z.record(z.uuid(),z.string().max(5000)),notes:z.array(z.object({id:z.uuid(),text:z.string().max(2000)}).strict()).max(20)}).strict().refine(v=>new Set(v.notes.map(n=>n.id)).size===v.notes.length).refine(v=>Object.values(v.answers).join('').length+v.notes.map(n=>n.text).join('').length<=60000);
export type SamjiRecordInput=z.infer<typeof RecordInput>;
export function validateAnswerKeys(content:SamjiBlock[],answers:Record<string,string>){const ids=new Set(content.filter(b=>b.kind==='question').map(b=>b.id));return Object.keys(answers).every(id=>ids.has(id));}
export function shareQuestions(content:SamjiBlock[],answers:Record<string,string>){return content.filter(b=>b.kind==='question'&&answers[b.id]?.trim()).map((b,i)=>`${i+1}. ${b.text}\n${answers[b.id].trim()}`).join('\n\n');}
