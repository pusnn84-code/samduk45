import { expect, test } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";
import postgres from "postgres";
import {randomUUID} from "node:crypto";
import {e2eAccounts} from "../fixtures/e2e-data";

test.describe("current approved member experience", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Disposable database only");
  const routes = ["/", "/notices", "/birthdays", "/bible-reading", "/scripture", "/scripture/bible", "/scripture/hymns", "/prayer-requests", "/visits", "/community", "/our-community", "/pastoral-reports", "/autumn-light", "/ministry-plan", "/profile"];
  for (const width of [360, 1280]) for (const route of routes) {
    test(`${route} renders without horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await login(page);
        await page.goto(route);
        await expect(page.locator("main").first()).toBeVisible();
        await expect(page.getByText("화면을 불러오고 있습니다.", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: /Application error|Internal Server Error/ })).toHaveCount(0);
        await expectNoOverflow(page);
    });
  }
  test("Doran primary and secondary actions have equal height and alignment", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/community");
    const refresh = page.getByRole("button", { name: "새로고침", exact: true });
    const write = page.getByRole("link", { name: "글쓰기", exact: true });
    await expect(refresh).toBeVisible();
    const a = await refresh.boundingBox(), b = await write.boundingBox();
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(a!.height).toBeGreaterThanOrEqual(48);
    expect(a!.height).toBe(b!.height);
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
  });
  test("pastor-created visits are confirmed, duplicate dates are supported and members see them", async ({ page, browser }) => {
    await login(page, "admin");
    const visitDate = new Date().toISOString().slice(0, 10);
    const month = visitDate.slice(0, 7);
    const title = "브라우저검증 심방대상";
    for (let i = 0; i < 2; i++) {
      const response = await page.request.post("/api/admin/visits", { data: { visitDate, visitType: "personal", recipientName: title, preferredTime: `1${i}:00` } });
      expect(response.status()).toBe(201);
    }
    const context = await browser.newContext();
    try {
      const member = await context.newPage();
      await login(member);
      const response = await member.request.get(`/api/visits/calendar?month=${month}`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      const entries = body.entries.filter((entry: { title: string }) => entry.title === title);
      expect(entries).toHaveLength(2);
      expect(entries.every((entry: { status: string }) => entry.status === "confirmed")).toBe(true);
      expect(JSON.stringify(body)).not.toContain("phoneCiphertext");
    } finally { await context.close(); }
  });
  test("private/public visibility and anonymity are independent and admin retains identity", async ({ page, browser }) => {
    await login(page);
    const saved: Record<string,string> = {};
    for (const visibility of ["private","private_anonymous","public","anonymous"]) {
      const response = await page.request.post("/api/prayer-requests", { data: { content: `공개범위검증-${visibility}`, visibility } });
      expect(response.status()).toBe(201);
      saved[visibility] = (await response.json()).id;
    }
    const context = await browser.newContext();
    try {
      const viewer = await context.newPage();
      await login(viewer,"newcomer");
      const other = (await (await viewer.request.get("/api/prayer-requests/list")).json()).items;
      expect(other.some((p:{id:string})=>p.id===saved.private)).toBe(false);
      expect(other.some((p:{id:string})=>p.id===saved.private_anonymous)).toBe(false);
      expect(other.find((p:{id:string})=>p.id===saved.anonymous).authorName).toBe("무명");
      expect(other.find((p:{id:string})=>p.id===saved.public).authorName).toBe("성도검증");
      await login(viewer,"admin");
      const admin = (await (await viewer.request.get("/api/prayer-requests/list")).json()).items;
      for (const id of Object.values(saved)) expect(admin.find((p:{id:string})=>p.id===id).authorName).toBe("성도검증");
    } finally { await context.close(); }
  });
  test("hymn ranges, hidden install button and direct Bible verse navigation", async ({page})=>{
    await login(page);
    await expect(page.getByRole("button",{name:"홈 화면에 추가",exact:true})).toHaveCount(0);
    await page.goto("/scripture/hymns");
    await page.getByRole("button",{name:"101–200",exact:true}).click();
    await expect(page.locator(".scripture-hymns li")).toHaveCount(100);
    await expect(page.locator(".scripture-hymns li").first()).toContainText("101장");
    await expect(page.locator(".scripture-hymns li").last()).toContainText("200장");
    await page.goto("/scripture/bible");
    await expect(page.getByRole("link",{name:"본문 열기",exact:true})).toHaveCount(0);
    const old = await page.getByRole("button",{name:"창세기",exact:true}).locator("small").evaluate(e=>getComputedStyle(e).color);
    const next = await page.getByRole("button",{name:"마태복음",exact:true}).locator("small").evaluate(e=>getComputedStyle(e).color);
    expect(old).not.toBe(next);
    await page.getByRole("button",{name:"마태복음",exact:true}).click();
    await page.getByRole("button",{name:"2장",exact:true}).click();
    await page.getByRole("button",{name:"3절",exact:true}).click();
    await expect(page).toHaveURL(/\/scripture\/bible\/40\/2\?verse=3$/);
    const verse = page.locator(".scripture-verse").first();
    const size = await verse.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
    await page.getByRole("button",{name:"글자 크게",exact:true}).click();
    expect(await verse.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(size);
    await verse.click();
    await expect(page.getByRole("button",{name:"복사하기",exact:true})).toBeVisible();
    await expect(verse).toHaveAttribute("aria-pressed","true");
  });
  test("a bound leader submits meeting and individual notes separately to the real database",async({page})=>{
    const url=new URL(process.env.DATABASE_URL??"");
    if(process.env.CI!=="true"||!["127.0.0.1","localhost"].includes(url.hostname)||url.pathname!=="/prayer_e2e")throw new Error("DISPOSABLE_DATABASE_REQUIRED");
    const db=postgres(url.toString(),{ssl:"require",max:1});
    const samId=randomUUID(),member=e2eAccounts.member;
    const [old]=await db`select village,sam,sam_label from prayer_app.member_roster where id=${member.rosterId}`;
    try{
      await db`update prayer_app.member_roster set village='1',sam='1',sam_label='1-1' where id=${member.rosterId}`;
      await db`insert into prayer_app.sams(id,name,leader_name,leader_roster_id,leader_binding_locked) values(${samId},'1-1',${member.name},${member.rosterId},true)`;
      await login(page);
      await page.goto("/pastoral-reports");
      await page.getByLabel("샘모임 날짜",{exact:true}).fill(new Date().toISOString().slice(0,10));
      await page.getByLabel("샘모임 시간",{exact:true}).fill("14:00");
      await page.getByLabel("샘모임 장소",{exact:true}).fill("테스트 장소");
      await page.getByRole("button",{name:"샘모임 참석자",exact:true}).click();
      await page.getByRole("button",{name:member.name,exact:true}).click();
      await page.getByRole("button",{name:"선택 완료",exact:true}).click();
      let saved=page.waitForResponse(r=>r.url().endsWith("/api/pastoral/submit")&&r.request().method()==="POST");
      await page.getByRole("button",{name:"샘모임 제출",exact:true}).click();
      let response=await saved;expect(response.status(),await response.text()).toBe(201);
      await page.goto("/pastoral-reports");
      await page.getByRole("tab",{name:"샘원 나눔·소식",exact:true}).click();
      await page.getByRole("button",{name:"이름을 선택하세요",exact:true}).click();
      await page.getByRole("button",{name:member.name,exact:true}).click();
      await page.getByLabel(`${member.name} 나눔`,{exact:true}).fill("감사한 하루를 나눕니다.");
      saved=page.waitForResponse(r=>r.url().endsWith("/api/pastoral/submit")&&r.request().method()==="POST");
      await page.getByRole("button",{name:"나눔·소식 제출",exact:true}).click();
      response=await saved;expect(response.status(),await response.text()).toBe(201);
      const reports=await db`select form->>'entryKind' as kind,submitted_by,author_user_id,submitted_at from prayer_app.pastoral_reports where sam_id=${samId}`;
      expect(reports.map(r=>r.kind).sort()).toEqual(["meeting","member"]);
      expect(reports.every(r=>r.submitted_by===member.name&&r.author_user_id===member.userId&&r.submitted_at)).toBe(true);
    }finally{
      await db`delete from prayer_app.pastoral_reports where sam_id=${samId}`;
      await db`delete from prayer_app.sams where id=${samId}`;
      await db`update prayer_app.member_roster set village=${old.village},sam=${old.sam},sam_label=${old.sam_label} where id=${member.rosterId}`;
      await db.end();
    }
  });
});
