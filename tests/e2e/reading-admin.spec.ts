import {test,expect} from "@playwright/test";
import postgres from "postgres";
import {randomUUID} from "node:crypto";
import {login,expectNoOverflow} from "./helpers";
test.use({serviceWorkers:"block"});
test("administrator can publish the reading notice and moderate shares and comments",async({page,browser})=>{
 test.skip(process.env.E2E_DATABASE_READY!=="1"||!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname),"Disposable local CI only");test.setTimeout(120000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1}),ctx=await browser.newContext({serviceWorkers:"block"}),shareId=randomUUID(),adminShareId=randomUUID(),commentId=randomUUID(),date="2026-11-30";
 const [original]=await db`select title,body from prayer_app.bible_reading_notice where id=1`;
 try{
  await login(page);expect((await page.request.put("/api/admin/bible-reading/notice",{data:{title:"거부",body:"거부"}})).status()).toBe(403);
  expect((await page.request.post("/api/bible-reading/shares",{data:{id:shareId,date,sharing:"관리자 삭제 검증 묵상",sharingAnonymous:false}})).status()).toBe(200);
  expect((await page.request.post("/api/bible-reading/comments",{data:{id:commentId,sharingId:shareId,body:"관리자가 확인할 댓글"}})).status()).toBe(200);
  const admin=await ctx.newPage();await login(admin,"admin");await admin.goto("/admin/bible-reading");
  const form=admin.getByRole("form",{name:"성경통독 공지 설정",exact:true});await form.getByLabel("공지 제목",{exact:true}).fill("시편 통독 안내");await form.getByLabel("공지 내용",{exact:true}).fill("월요일부터 매일 시편 한 편씩 읽어요.\n함께 받은 은혜를 나눠 주세요.");
  const save=admin.waitForResponse(r=>r.url().endsWith("/api/admin/bible-reading/notice")&&r.request().method()==="PUT");await form.getByRole("button",{name:"저장",exact:true}).click();expect((await save).status()).toBe(200);
  await page.bringToFront();await page.goto("/bible-reading?date="+date);await expect(page.locator(".bible-reading-period:visible")).toContainText("시편 통독 안내");await expect(page.locator(".bible-reading-period:visible")).toContainText("함께 받은 은혜를 나눠 주세요.");
  expect((await admin.request.post("/api/bible-reading/shares",{data:{id:adminShareId,date,sharing:"관리자 글 권한 검증",sharingAnonymous:false}})).status()).toBe(200);expect((await page.request.delete("/api/bible-reading/shares",{data:{id:adminShareId,date}})).status()).toBe(404);
  await admin.bringToFront();await admin.goto("/bible-reading?date="+date);
  const row=admin.locator(".bible-reading-lines>li:visible").filter({hasText:"관리자 삭제 검증 묵상"});await expect(row.getByRole("button",{name:"수정",exact:true})).toHaveCount(0);await row.getByRole("button",{name:"댓글",exact:true}).click();
  const comment=row.locator(".meditation-comment-panel li").filter({hasText:"관리자가 확인할 댓글"});await expect(comment.getByRole("button",{name:"댓글 수정",exact:true})).toHaveCount(0);
  admin.once("dialog",d=>void d.accept());const deletedComment=admin.waitForResponse(r=>r.url().endsWith("/api/bible-reading/comments")&&r.request().method()==="DELETE");await comment.getByRole("button",{name:"댓글 삭제",exact:true}).click();expect((await deletedComment).status()).toBe(200);await expect(comment).toHaveCount(0);
  admin.once("dialog",d=>void d.accept());const deleted=admin.waitForResponse(r=>r.url().endsWith("/api/bible-reading/shares")&&r.request().method()==="DELETE");await row.getByRole("button",{name:"삭제",exact:true}).click();expect((await deleted).status()).toBe(200);await expect(row).toHaveCount(0);await expectNoOverflow(admin);
 }finally{await db`delete from prayer_app.bible_reading_shares where sharing_id in (${shareId}::uuid,${adminShareId}::uuid)`;if(original)await db`insert into prayer_app.bible_reading_notice(id,title,body) values(1,${original.title},${original.body}) on conflict(id) do update set title=excluded.title,body=excluded.body`;else await db`delete from prayer_app.bible_reading_notice where id=1`;await ctx.close();await db.end();}
});
