import {test,expect} from "@playwright/test";
import {randomUUID,createHash} from "node:crypto";
import postgres from "postgres";
import {login,expectNoOverflow} from "./helpers";
import {e2eAccounts} from "../fixtures/e2e-data";
test.use({serviceWorkers:"block"});
test("Samji separates categories, Batang questions and private Gothic answers",async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1"||!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Disposable local CI only");
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1}),id=randomUUID(),q1=randomUUID(),q2=randomUUID();
 const content=[{id:q1,kind:"question",heading:"마음을 여는 시간",text:"오늘 감사한 일은 무엇인가요?"},{id:randomUUID(),kind:"text",heading:"말씀 속으로",text:"함께 말씀을 읽고 은혜를 나눕니다."},{id:q2,kind:"question",heading:"말씀 나눔",text:"이번 주 실천하고 싶은 일은 무엇인가요?"}];
 try{
  await db`insert into prayer_app.samji_documents(id,author_user_id,issue_date,title,content,source_name,source_sha256,source_data) values(${id}::uuid,${e2eAccounts.admin.userId}::uuid,'2026-11-26','서체와 답변 구분 검증',${db.json(content)}::jsonb,'synthetic.pdf',${createHash("sha256").update(id).digest("hex")},${Buffer.from("%PDF-1.4\n%%EOF")})`;
  await login(page);await page.goto("/samji");await page.getByRole("button").filter({hasText:"서체와 답변 구분 검증"}).click();
  const question=page.locator(".samji-question-text:visible").first();await expect(question).toHaveText(content[0].text);
  const loaded=await page.evaluate(async()=>{const faces=await document.fonts.load('400 20px "Samji Gyeonggi Batang"','오늘 감사한 일은 무엇인가요?');return faces.map(f=>({family:f.family,status:f.status}));});expect(loaded.length).toBeGreaterThan(0);expect(loaded.every(f=>f.status==="loaded")).toBe(true);
  expect(await question.evaluate(e=>getComputedStyle(e).fontFamily)).toContain("Samji Gyeonggi Batang");expect(await question.evaluate(e=>getComputedStyle(e).fontWeight)).toBe("400");
  const heading=page.getByRole("heading",{name:"마음을 여는 시간",exact:true});expect(await heading.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe("rgb(49, 83, 101)");expect(await heading.evaluate(e=>getComputedStyle(e).fontFamily)).not.toContain("Samji Gyeonggi Batang");
  const answer=page.getByRole("textbox",{name:content[0].text,exact:true});expect(await answer.evaluate(e=>getComputedStyle(e).fontFamily)).not.toContain("Samji Gyeonggi Batang");expect(await page.locator(".samji-answer:visible").first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe("rgb(241, 245, 246)");
  await expect(page.locator(".samji-question-number:visible")).toHaveText(["Q1","Q2"]);await answer.fill("가족과 함께 예배드릴 수 있어 감사합니다.");await page.getByRole("textbox",{name:content[2].text,exact:true}).fill("가족의 이야기를 끝까지 듣겠습니다.");
  const saved=page.waitForResponse(r=>r.url().endsWith("/record")&&r.request().method()==="PUT");await page.getByRole("button",{name:"기록 저장",exact:true}).click();expect((await saved).status()).toBe(200);await expect(answer).toHaveAttribute("readonly","");
  await page.getByRole("button",{name:"확인",exact:true}).click();await page.getByRole("button").filter({hasText:"서체와 답변 구분 검증"}).click();await expect(answer).toHaveValue("가족과 함께 예배드릴 수 있어 감사합니다.");await expect(answer).toHaveAttribute("readonly","");
  for(const width of [320,390,430]){await page.setViewportSize({width,height:844});await expectNoOverflow(page);}
  await page.screenshot({path:"test-results/samji-blue-gray-batang.png",fullPage:true});
 }finally{await db`delete from prayer_app.samji_records where document_id=${id}::uuid`;await db`delete from prayer_app.samji_documents where id=${id}::uuid`;await db.end();}
});
