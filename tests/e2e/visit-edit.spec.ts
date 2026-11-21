import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { login, expectNoOverflow } from "./helpers";
import { e2eAccounts } from "../fixtures/e2e-data";

test("visit owners edit waiting requests, confirmation locks stale forms, and admins correct every state", async ({page,browser,browserName}) => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Disposable database only");
  test.setTimeout(120_000);
  const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1});
  const now=new Date(),date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,5)).toISOString().slice(0,10);
  const own=randomUUID(),other=randomUUID(),nonce=randomUUID().slice(0,8);
  const adminContext=await browser.newContext(),admin=await adminContext.newPage();
  try {
    for(const [id,owner,location] of [[own,e2eAccounts.member.userId,`수정 전 ${nonce}`],[other,e2eAccounts.admin.userId,`다른 신청 ${nonce}`]]) {
      await db`insert into prayer_app.visit_requests(id,requester_user_id,visit_date,end_date,visit_type,attendees,location,preferred_time,reason,status,calendar_sync_status)
        values(${id}::uuid,${owner}::uuid,${date}::date,${date}::date,'personal','',${location},'오후 2시','비공개 신청 사유','requested','synced')`;
    }
    await page.setViewportSize({width:390,height:844});await login(page);await login(admin,"admin");
    const response=await page.request.get("/api/visits/calendar?month="+date.slice(0,7));expect(response.status()).toBe(200);
    const {entries}=await response.json();expect(entries.find((e:{id:string})=>e.id===own).canEdit).toBe(true);expect(entries.find((e:{id:string})=>e.id===other).canEdit).toBe(false);
    expect(JSON.stringify(entries)).not.toContain("requesterUserId");expect(JSON.stringify(entries)).not.toContain("비공개 신청 사유");
    expect((await page.request.get("/api/visits/"+other)).status()).toBe(404);
    expect((await page.request.patch("/api/visits/"+other,{data:{location:"권한 없음"}})).status()).toBe(404);
    expect((await page.request.patch("/api/visits/"+own,{data:{status:"confirmed"}})).status()).toBe(400);
    await page.goto("/visits");await page.getByRole("button",{name:"다음 달",exact:true}).click();
    await page.getByRole("button",{name:new RegExp("^"+date+" 일정")}).click();
    const event=page.locator(".visit-event-card").filter({hasText:`수정 전 ${nonce}`});await event.getByRole("button",{name:"수정",exact:true}).click();
    const editor=page.getByRole("region",{name:"심방 신청 수정",exact:true});
    await expect(editor.getByLabel("장소 (선택)",{exact:true})).toHaveValue(`수정 전 ${nonce}`);
    await editor.getByLabel("장소 (선택)",{exact:true}).fill(`수정 후 ${nonce}`);
    await editor.getByLabel("심방 요청 이유 (선택)",{exact:true}).fill("샘원과 함께 기도하고 싶습니다.");
    await expectNoOverflow(page);await page.screenshot({path:`test-results/visit-edit-${browserName}.png`,fullPage:true});
    const saved=page.waitForResponse(r=>r.url().endsWith("/api/visits/"+own)&&r.request().method()==="PATCH");
    await editor.getByRole("button",{name:"수정 내용 저장",exact:true}).click();expect((await saved).status()).toBe(200);
    await expect(editor).toHaveCount(0);await expect(page.locator(".visit-event-card").filter({hasText:`수정 후 ${nonce}`})).toBeVisible();
    const [updated]=await db`select location,reason,status from prayer_app.visit_requests where id=${own}::uuid`;
    expect(updated).toMatchObject({location:`수정 후 ${nonce}`,reason:"샘원과 함께 기도하고 싶습니다.",status:"requested"});
    await page.locator(".visit-event-card").filter({hasText:`수정 후 ${nonce}`}).getByRole("button",{name:"수정",exact:true}).click();
    await expect(editor.getByLabel("장소 (선택)",{exact:true})).toHaveValue(`수정 후 ${nonce}`);
    await db`update prayer_app.visit_requests set status='confirmed' where id=${own}::uuid`;
    await editor.getByLabel("장소 (선택)",{exact:true}).fill("확정 이후 저장 금지");
    await editor.getByRole("button",{name:"수정 내용 저장",exact:true}).click();
    await expect(editor.getByRole("alert")).toContainText("이미 확정");await expect(editor.getByRole("button",{name:"수정 내용 저장",exact:true})).toBeDisabled();
    expect((await page.request.get("/api/visits/"+own)).status()).toBe(409);expect((await page.request.patch("/api/visits/"+own,{data:{location:"확정 수정 금지"}})).status()).toBe(409);
    await page.reload();await page.getByRole("button",{name:"다음 달",exact:true}).click();await page.getByRole("button",{name:new RegExp("^"+date+" 일정")}).click();expect(await page.getByRole("button",{name:"수정",exact:true}).count()).toBe(0);
    for(const status of ["confirmed","completed","cancelled"]) {
      await db`update prayer_app.visit_requests set status=${status} where id=${own}::uuid`;
      expect((await admin.request.get("/api/visits/"+own)).status()).toBe(200);
      expect((await admin.request.patch("/api/admin/visits/"+own,{data:{location:`관리자 ${status}`}})).status()).toBe(200);
      const [row]=await db`select status,location,reason from prayer_app.visit_requests where id=${own}::uuid`;
      expect(row).toMatchObject({status,location:`관리자 ${status}`,reason:"샘원과 함께 기도하고 싶습니다."});
    }
  } finally {
    await db`delete from prayer_app.visit_requests where id in (${own}::uuid,${other}::uuid)`;
    await adminContext.close();await db.end();
  }
});
