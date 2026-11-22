import type {SamjiBlock} from './policy';
import {lyrics246} from './starter';
const names:[RegExp,string][]=[[/^마음을\s*여는\s*시간/,'마음을 여는 시간'],[/^(다함께|함께)\s*찬양/,'함께 찬양'],[/^기도\s*$/,'기도'],[/^(성경통독|성경\s*본문)/,'성경통독'],[/^말씀\s*속으로/,'말씀 속으로'],[/^말씀\s*나눔/,'말씀 나눔'],[/^함께\s*기도하기/,'함께 기도하기'],[/^주기도문/,'주기도문']];
export function parseSamjiText(raw:string,fileName:string,newId=()=>crypto.randomUUID()){
 const text=raw.replace(/\r/g,'').normalize('NFKC'),sections:{heading:string;lines:string[]}[]=[];
 for(const line of text.split('\n')){const clean=line.trim(),found=names.find(([pattern])=>pattern.test(clean));if(found){const tail=clean.replace(found[0],'').trim();sections.push({heading:found[1],lines:tail?[tail]:[]});}else if(sections.length)sections[sections.length-1].lines.push(clean);}
 const dateMatch=text.match(/(20\d{2})\s*[.년/-]\s*(\d{1,2})\s*[.월/-]\s*(\d{1,2})/),short=fileName.match(/(?:^|[_\s])(\d{2})(\d{2})(\d{2})(?=[_.\s]|$)/);
 const date=dateMatch?`${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`:short?`20${short[1]}-${short[2]}-${short[3]}`:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const title=text.match(/말씀\s*속으로\s*[“"「](.+?)[”"」]/)?.[1]??fileName.replace(/\.pdf$/i,'').replace(/_/g,' ').trim();
 const content:SamjiBlock[]=[];
 for(const section of sections){const body=section.lines.join('\n').trim();
  if(['마음을 여는 시간','말씀 나눔'].includes(section.heading)){
   const matches=[...body.matchAll(/(?:^|\n)\s*\d+[)．.]\s*([\s\S]*?)(?=(?:\n\s*\d+[)．.])|$)/g)];
   if(matches.length){matches.forEach((m,i)=>content.push({id:newId(),kind:'question',heading:i===0?section.heading:'',text:m[1].replace(/\s*\n\s*/g,' ').trim()}));continue;}
  }
  if(section.heading==='함께 찬양'){
   const n=Number(body.match(/(?:찬송가\s*)?(\d+)\s*장/)?.[1]);content.push({id:newId(),kind:'hymn',heading:section.heading,text:body.replace(/^찬송가\s*\d+장\s*(?:\(통\s*\d+장\))?\s*/,'').trim(),hymnNumber:n>=1&&n<=645?n:undefined,lyrics:n===246?lyrics246:''});continue;
  }
  content.push({id:newId(),kind:section.heading==='성경통독'?'scripture':'text',heading:section.heading,text:body});
 }
 if(!content.length)content.push({id:newId(),kind:'text',heading:'말씀',text:text.trim()});
 if(!content.some(b=>b.kind==='question'))content.push({id:newId(),kind:'question',heading:'나눔 질문',text:''});
 return {date,title,content};
}
