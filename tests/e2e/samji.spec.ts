import {test,expect} from '@playwright/test';
import {login,expectNoOverflow} from './helpers';
import postgres from 'postgres';
function textPdf(){const stream='BT /F1 16 Tf 40 550 Td (Hello Samji PDF) Tj ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];let data='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const start=Buffer.byteLength(data);data+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(data);}
test('PDF review, inline answers, private notes, optimistic saves, score display and Q&A-only copy',async({page,browser})=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable local CI database only');test.setTimeout(150000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:'require',prepare:false,max:1}),memberContext=await browser.newContext(),otherContext=await browser.newContext();let id='';
 try{
  await page.setViewportSize({width:390,height:844});await login(page,'admin');await page.goto('/');
  const nav=page.getByRole('navigation',{name:'메뉴 선택',exact:true});await expect(nav.getByRole('link',{name:'은혜의 샘지',exact:true})).toBeInViewport();
  expect(await nav.getByRole('link').count()).toBe(13);for(const link of await nav.getByRole('link').all())await expect(link).toBeInViewport();await expectNoOverflow(page);
  await page.setViewportSize({width:320,height:568});for(const link of await nav.getByRole('link').all())await expect(link).toBeInViewport();await expectNoOverflow(page);await page.setViewportSize({width:390,height:844});
  await page.goto('/samji');await page.getByRole('button',{name:'PDF 올리기',exact:true}).click();
  await page.getByLabel('PDF 선택 (3MB 이하)',{exact:true}).setInputFiles({name:'samji_261122_.pdf',mimeType:'application/pdf',buffer:textPdf()});
  const uploader=page.getByRole('region',{name:'샘지 PDF 올리기',exact:true});await expect(uploader.getByLabel('본문',{exact:true})).toHaveValue('Hello Samji PDF',{timeout:45000});
  await uploader.getByLabel('말씀 제목',{exact:true}).fill('샘지 기능 검증');await uploader.getByLabel('질문 내용',{exact:true}).fill('오늘 감사한 일은 무엇인가요?');
  await uploader.getByRole('button',{name:'질문 추가',exact:true}).click();await uploader.getByLabel('질문 내용',{exact:true}).last().fill('오늘 실천하고 싶은 일은 무엇인가요?');
  await uploader.getByRole('button',{name:'찬송가 추가',exact:true}).click();
  await uploader.getByLabel('찬송가 제목',{exact:true}).fill('나 가나안 땅 귀한 성에');
  const sent=page.waitForResponse(r=>r.url().endsWith('/api/samji')&&r.request().method()==='POST');await uploader.getByRole('button',{name:'확인한 자료 게시하기',exact:true}).click();const response=await sent;expect(response.status()).toBe(201);id=(await response.json()).id;
  await expect(page.getByRole('heading',{name:'샘지 기능 검증',exact:true})).toBeVisible();await expect(page.getByText('후렴',{exact:false})).toContainText('후렴');
  await page.getByRole('button',{name:'악보 보기',exact:true}).click();const dialog=page.getByRole('dialog',{name:'246장 찬송가 악보',exact:true});await expect(dialog).toBeVisible();
  await expect.poll(async()=>await dialog.locator('img').first().evaluate((e:HTMLImageElement)=>e.naturalWidth)).toBeGreaterThan(0);await dialog.getByRole('button',{name:'닫기',exact:true}).click();
  const member=await memberContext.newPage();await member.setViewportSize({width:390,height:844});await login(member);await member.goto('/samji');
  await member.getByRole('button').filter({hasText:'샘지 기능 검증'}).click();
  const q1=member.getByLabel('오늘 감사한 일은 무엇인가요?',{exact:true}),q2=member.getByLabel('오늘 실천하고 싶은 일은 무엇인가요?',{exact:true});
  await q1.fill('오늘의 첫 감사 답변');await q2.fill('오늘의 두 번째 적용 답변');await member.getByLabel('나눔 메모 1',{exact:true}).fill('공유하면 안 되는 개인 메모');
  expect(await member.getByLabel('이름·제목',{exact:true}).count()).toBe(0);
  const saved=member.waitForResponse(r=>r.url().endsWith('/record')&&r.request().method()==='PUT');await member.getByRole('button',{name:'기록 저장',exact:true}).click();expect((await saved).status()).toBe(200);
  const own=await(await member.request.get('/api/samji/'+id)).json();expect(own.record.notes[0].text).toBe('공유하면 안 되는 개인 메모');expect(own.record.version).toBe(1);
  const admin=await(await page.request.get('/api/samji/'+id)).json();expect(admin.record.answers).toEqual({});expect(admin.record.notes).toEqual([]);
  const other=await otherContext.newPage();await login(other,'leader');expect((await(await other.request.get('/api/samji/'+id)).json()).record.answers).toEqual({});
  expect((await member.request.post('/api/samji',{data:{}})).status()).toBe(403);
  expect((await member.request.put('/api/samji/'+id+'/record',{data:{version:1,answers:own.record.answers,notes:[],ownerUserId:'other'}})).status()).toBe(400);
  expect((await member.request.put('/api/samji/'+id+'/record',{data:{version:0,answers:{},notes:[]}})).status()).toBe(409);
  await member.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{Reflect.set(window,'samjiCopiedText',value);}}}));
  await member.getByRole('button',{name:'공유하기',exact:true}).click();const copied=await member.evaluate(()=>Reflect.get(window,'samjiCopiedText'));
  expect(copied).toContain('오늘 감사한 일은 무엇인가요?');expect(copied).toContain('오늘의 두 번째 적용 답변');expect(copied).not.toContain('개인 메모');expect(copied).not.toContain('후렴');expect(copied).not.toContain('샘지 기능 검증');
  await member.getByRole('button',{name:'목록',exact:true}).click();await member.getByRole('button',{name:'내 기록',exact:true}).click();await member.getByRole('button').filter({hasText:'샘지 기능 검증'}).click();await expect(q1).toHaveValue('오늘의 첫 감사 답변');
  await q1.fill('');await member.getByRole('button',{name:'공유하기',exact:true}).click();expect(await member.evaluate(()=>Reflect.get(window,'samjiCopiedText'))).not.toContain('오늘 감사한 일은 무엇인가요?');
  await member.getByRole('button',{name:'기록 저장',exact:true}).click();await expect(q1).toHaveValue('');await expectNoOverflow(member);await member.screenshot({path:'test-results/samji-inline-answers.png',fullPage:true});
 }finally{if(id){await db`delete from prayer_app.samji_records where document_id=${id}::uuid`;await db`delete from prayer_app.samji_documents where id=${id}::uuid`;}await memberContext.close();await otherContext.close();await db.end();}
});
