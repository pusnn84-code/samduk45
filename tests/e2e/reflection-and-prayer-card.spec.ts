import {test,expect} from "@playwright/test";
import postgres from "postgres";
import {randomUUID} from "node:crypto";
import {readFile,mkdir} from "node:fs/promises";
import {login,expectNoOverflow} from "./helpers";
import {e2eAccounts} from "../fixtures/e2e-data";
const date="2026-11-05";
const disposable=()=>process.env.E2E_DATABASE_READY==="1"&&["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname);
test("multiple long meditations retain legacy completion, aliases and empathy with actor-only edits",async({page,browser})=>{
 test.skip(!disposable(),"Disposable CI database only");test.setTimeout(150000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1}),otherContext=await browser.newContext(),legacy=randomUUID();const user=e2eAccounts.admin.userId;
 try{
  await login(page,"admin");
  await db`insert into prayer_app.bible_reading_entries(user_id,reading_date,completed,sharing,sharing_id,sharing_anonymous,anonymous_number)
   values(${user}::uuid,${date}::date,true,'기존 묵상을 이어갑니다.',${legacy}::uuid,false,null)
   on conflict(user_id,reading_date) do update set completed=true,sharing=excluded.sharing,sharing_id=excluded.sharing_id,sharing_anonymous=false,anonymous_number=null`;
  await db`insert into prayer_app.bible_sharing_empathy(sharing_id,user_id) values(${legacy}::uuid,${e2eAccounts.member.userId}::uuid) on conflict do nothing`;
  await page.goto("/bible-reading?date="+date);
  await expect(page.getByRole("heading",{name:"묵상 나눔",exact:true})).toBeVisible();
  const input=page.getByRole("textbox",{name:"나의 묵상",exact:true});await expect(input).toHaveValue("");expect(await input.getAttribute("maxlength")).toBeNull();
  const first="말씀을 되새깁니다.\n"+"은혜를 기억합니다. ".repeat(150);
  await input.fill(first);let saved=page.waitForResponse(r=>r.url().endsWith("/api/bible-reading/shares")&&r.request().method()==="POST");await page.getByRole("button",{name:"나눔 올리기",exact:true}).click();let state=await(await saved).json();
  const firstLine=state.sharedLines.find((l:{text:string})=>l.text===first.trim());expect(firstLine).toBeTruthy();await expect(input).toHaveValue("");
  await input.fill("다시 읽으며 받은 두 번째 묵상");await page.getByRole("checkbox",{name:"무명으로 나누기",exact:true}).check();saved=page.waitForResponse(r=>r.url().endsWith("/api/bible-reading/shares")&&r.request().method()==="POST");await page.getByRole("button",{name:"나눔 올리기",exact:true}).click();state=await(await saved).json();
  expect(state.sharedLines.filter((l:{isOwn:boolean})=>l.isOwn)).toHaveLength(3);const second=state.sharedLines.find((l:{text:string})=>l.text==="다시 읽으며 받은 두 번째 묵상");expect(second.name).toMatch(/^무명\d+$/);
  expect(state.sharedLines.find((l:{id:string})=>l.id===legacy).empathyCount).toBe(1);expect(state.completed).toBe(true);
  const replay=await page.request.post("/api/bible-reading/shares",{data:{id:firstLine.id,date,sharing:first.trim(),sharingAnonymous:false}});expect(replay.status()).toBe(200);expect((await replay.json()).sharedLines.filter((l:{isOwn:boolean})=>l.isOwn)).toHaveLength(3);
  const other=await otherContext.newPage();await login(other);
  expect((await other.request.patch("/api/bible-reading/shares",{data:{id:firstLine.id,date,sharing:"타인 변경",sharingAnonymous:false}})).status()).toBe(404);
  expect((await other.request.delete("/api/bible-reading/shares",{data:{id:firstLine.id,date}})).status()).toBe(404);
  for(let i=0;i<2;i++){const r=await other.request.put("/api/bible-reading/empathy",{data:{date,sharingId:second.id,reacted:true}});expect(r.status()).toBe(200);expect((await r.json()).count).toBe(1);}
  const secondRow=page.locator(".bible-reading-lines li:visible").filter({hasText:"다시 읽으며 받은 두 번째 묵상"});await secondRow.getByRole("button",{name:"수정",exact:true}).click();await expect(input).toHaveValue("다시 읽으며 받은 두 번째 묵상");
  await input.fill("문단을 이어서 수정합니다.\n두 번째 문단도 남깁니다.");const edited=page.waitForResponse(r=>r.url().endsWith("/api/bible-reading/shares")&&r.request().method()==="PATCH");await page.getByRole("button",{name:"수정 저장",exact:true}).click();state=await(await edited).json();expect(state.sharedLines.find((l:{id:string})=>l.id===second.id).text).toContain("\n");
  const target=page.locator(".bible-reading-lines li:visible").filter({hasText:"문단을 이어서 수정합니다."});page.once("dialog",d=>void d.accept());const deleted=page.waitForResponse(r=>r.url().endsWith("/api/bible-reading/shares")&&r.request().method()==="DELETE");await target.getByRole("button",{name:"삭제",exact:true}).click();expect((await deleted).status()).toBe(200);
  const [record]=await db`select completed,(select count(*)::int from prayer_app.bible_sharing_empathy where sharing_id=${second.id}::uuid) as reactions from prayer_app.bible_reading_entries where user_id=${user}::uuid and reading_date=${date}::date`;expect(record.completed).toBe(true);expect(record.reactions).toBe(0);
  await expectNoOverflow(page);
 }finally{await db`delete from prayer_app.bible_reading_shares where user_id=${user}::uuid and reading_date=${date}::date`;await db`delete from prayer_app.bible_reading_entries where user_id=${user}::uuid and reading_date=${date}::date`;await otherContext.close();await db.end();}
});

test("Psalms, inline comments and cross-reader highlights",async({page,browser})=>{
 test.skip(!disposable(),"Disposable CI database only");test.setTimeout(150000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1});
 const otherContext=await browser.newContext();const shareId=randomUUID(),commentId=randomUUID(),day="2026-11-30";
 const member=e2eAccounts.member;
 try{
  await login(page);
  const share=await page.request.post("/api/bible-reading/shares",{data:{id:shareId,date:day,sharing:"시편을 새롭게 읽습니다.",sharingAnonymous:true}});
  expect(share.status()).toBe(200);expect((await share.json()).progress.totalDays).toBe(97);
  await page.goto("/bible-reading?date="+day);await expect.poll(()=>page.locator(".bible-reading-reference:visible").allTextContents()).toContain("시편 54편");
  const row=page.locator(".bible-reading-lines>li:visible").filter({hasText:"시편을 새롭게 읽습니다."});await row.getByRole("button",{name:"댓글 쓰기·보기",exact:true}).click();
  await row.getByLabel("댓글 쓰기",{exact:true}).fill("함께 읽을 수 있어서 감사합니다.");
  const added=page.waitForResponse(r=>r.url().endsWith("/api/bible-reading/comments")&&r.request().method()==="POST");await row.getByRole("button",{name:"댓글 등록",exact:true}).click();expect((await added).status()).toBe(200);await expect(row.getByText("함께 읽을 수 있어서 감사합니다.",{exact:true})).toBeVisible();
  const comments=await(await page.request.get("/api/bible-reading/comments?sharingId="+shareId)).json();expect(comments.comments[0].name).toMatch(/^무명\d+$/);expect(JSON.stringify(comments)).not.toContain(member.userId);
  const other=await otherContext.newPage();await login(other,"admin");
  expect((await other.request.delete("/api/bible-reading/comments",{data:{sharingId:shareId,id:comments.comments[0].id}})).status()).toBe(404);
  expect((await other.request.post("/api/bible-reading/comments",{data:{sharingId:shareId,id:commentId,body:"함께 기도합니다."}})).status()).toBe(200);
  await page.bringToFront();await page.goto("/scripture/bible/19/54");await page.locator(".scripture-verse:visible").first().click();
  const yellow=page.getByRole("button",{name:"노랑",exact:true});await expect(yellow).toBeEnabled();
  const marked=page.waitForResponse(r=>r.url().endsWith("/api/scripture/highlights")&&r.request().method()==="PUT");await yellow.click();expect((await marked).status()).toBe(200);
  await page.goto("/scripture/reading/"+day);await expect(page.locator('.scripture-verse[data-highlight="yellow"]:visible').first()).toBeVisible();
  const privateHighlights=await(await other.request.get("/api/scripture/highlights?references=19:54")).json();expect(privateHighlights.highlights).toEqual([]);
  await expectNoOverflow(page);
 }finally{
  await db`delete from prayer_app.bible_reading_shares where sharing_id=${shareId}::uuid`;
  await db`delete from prayer_app.scripture_highlights where user_id=${member.userId}::uuid`;
  await otherContext.close();await db.end();
 }
});

test("profile contacts and birth date save, remain private, and notice edits require an administrator",async({page})=>{
 test.skip(!disposable(),"Disposable CI database only");test.setTimeout(150000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1}),member=e2eAccounts.member;let noticeId="";
 const [original]=await db`select birth_date,phone_ciphertext,phone_lookup_hash,phone_private from prayer_app.member_roster where id=${member.rosterId}::uuid`;
 try{
  await login(page);console.log("profile-stage:authenticated");
  await page.bringToFront();await page.goto("/profile");const profileForm=page.getByRole("form",{name:"내 정보 수정",exact:true});await expect(profileForm).toHaveCount(1);await profileForm.getByLabel("생년월일",{exact:true}).fill("19800521");await profileForm.getByLabel("휴대폰 번호",{exact:true}).fill("01000000982");await profileForm.getByLabel("연락처 비공개",{exact:true}).check();
  const profileSaved=page.waitForResponse(r=>r.url().endsWith("/api/profile/details")&&r.request().method()==="PATCH");await profileForm.getByRole("button",{name:"내 정보 저장",exact:true}).click();expect((await profileSaved).status()).toBe(200);
  const profile=await(await page.request.get("/api/profile")).json();expect(profile.profile.phonePrivate).toBe(true);expect(profile.profile.birthDate).toBe("1980-05-21");expect(profile.profile.phone).toBe("01000000982");
  await page.reload();await expect(profileForm.getByLabel("휴대폰 번호",{exact:true})).toHaveValue("01000000982");await expect(profileForm.getByLabel("연락처 비공개",{exact:true})).toBeChecked();
  console.log("profile-stage:saved-and-reloaded");await login(page,"admin");
  const notice=await page.request.post("/api/admin/notices",{data:{title:"수정 동작 검증",body:"수정하기 전",status:"published"}});expect(notice.status()).toBe(201);noticeId=(await notice.json()).notice.id;
  await page.bringToFront();await page.goto("/notices/"+noticeId);await page.getByRole("button",{name:"공지 수정",exact:true}).click();await page.getByPlaceholder("공지 내용을 입력하세요.").fill("수정한 안내입니다.");
  const noticeSaved=page.waitForResponse(r=>r.url().endsWith("/api/admin/notices/"+noticeId)&&r.request().method()==="PATCH");await page.getByRole("button",{name:"발행",exact:true}).click();expect((await noticeSaved).status()).toBe(200);await expect.poll(()=>page.locator(".notice-detail:visible .notice-body").allTextContents()).toContain("수정한 안내입니다.");
  await login(page);await page.goto("/notices/"+noticeId);await expect(page.getByRole("button",{name:"공지 수정",exact:true})).toHaveCount(0);

  await expectNoOverflow(page);
 }finally{
  if(noticeId)await db`delete from prayer_app.notices where id=${noticeId}::uuid`;
  await db`update prayer_app.member_roster set birth_date=${original.birth_date},phone_ciphertext=${original.phone_ciphertext},phone_lookup_hash=${original.phone_lookup_hash},phone_private=${original.phone_private} where id=${member.rosterId}::uuid`;
  await db`update prayer_app.users set phone_lookup_hash=${original.phone_lookup_hash} where id=${member.userId}::uuid`;
  await db.end();
 }
});

test("prayer card has three aligned actions, PNG export, mobile preview and a login-safe share link",async({page,browser})=>{
 test.skip(!disposable(),"Disposable CI database only");test.setTimeout(150000);
 const db=postgres(process.env.DATABASE_URL!,{ssl:"require",prepare:false,max:1}),mobileContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),anonymousContext=await browser.newContext();let id="";const samId=randomUUID();
 try{
  await page.setViewportSize({width:1280,height:900});await login(page);
  await db`insert into prayer_app.sams(id,name,leader_name,is_active) values(${samId}::uuid,'1-98샘','검증리더',true)`;
  const result=await page.request.post("/api/autumn-light/cards",{data:{name:"캡처 검증 "+randomUUID().slice(0,5),samId,prayer:"서로를 사랑하는 마음으로 함께 기도합니다.\n새로운 만남 가운데 은혜를 누리게 하소서.",submissionKey:randomUUID()}});expect(result.status()).toBe(201);const card=(await result.json()).card;id=card.id;
  await page.goto("/autumn-light?card="+id);const detail=page.locator(".autumn-detail:visible");await expect(detail).toBeVisible();const actions=detail.locator(".autumn-card-actions");await expect(actions.getByRole("button")).toHaveCount(3);
  const left=await actions.locator(".autumn-reaction-hit").boundingBox(),right=await actions.getByRole("button",{name:"기도카드 캡처",exact:true}).boundingBox();expect(right!.x).toBeGreaterThan(left!.x+left!.width);
  const down=page.waitForEvent("download");await actions.getByRole("button",{name:"기도카드 캡처",exact:true}).click();const file=await down;await mkdir("test-results",{recursive:true});await file.saveAs("test-results/prayer-card.png");const bytes=await readFile((await file.path())!);expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  await page.evaluate(()=>Object.defineProperty(navigator,"share",{configurable:true,value:async(data:unknown)=>{Reflect.set(window,"prayerSharedLink",data);}}));await actions.getByRole("button",{name:"기도카드 링크 공유",exact:true}).click();const share=await page.evaluate(()=>Reflect.get(window,"prayerSharedLink"));expect(share.url).toContain("/pray/"+id);expect(share.title).toBe("이분을 위해 기도합시다");
  const phone=await mobileContext.newPage();await login(phone);await phone.goto("/autumn-light?card="+id);const phoneDetail=phone.locator(".autumn-detail:visible");await expect(phoneDetail).toBeVisible();await phoneDetail.getByRole("button",{name:"기도카드 캡처",exact:true}).click();const preview=phone.getByRole("dialog",{name:"기도카드 이미지",exact:true});await expect(preview).toBeVisible();await expect.poll(()=>preview.locator("img").first().evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1080);await preview.getByRole("button",{name:"닫기",exact:true}).click();await expect(phoneDetail).toBeVisible();await expectNoOverflow(phone);
  const visitor=await anonymousContext.newPage();await visitor.goto(share.url);await expect(visitor).toHaveURL(new RegExp("/login\\?autumnCard="+id));await expect(visitor.getByText(card.prayer,{exact:true})).toHaveCount(0);
  await visitor.getByLabel("이름 (아이디)",{exact:true}).fill(e2eAccounts.member.name);await visitor.getByLabel("비밀번호",{exact:true}).fill(e2eAccounts.member.phone.slice(-6));await visitor.getByRole("button",{name:"로그인",exact:true}).click();
  await expect(visitor).toHaveURL(new RegExp("/autumn-light\\?card="+id));await expect(visitor.locator(".autumn-detail:visible").getByRole("heading",{name:card.name,exact:true})).toBeVisible();
 }finally{if(id){await db`delete from prayer_app.autumn_daily where person_id=${id}::uuid`;await db`delete from prayer_app.autumn_people where id=${id}::uuid`;}await db`delete from prayer_app.sams where id=${samId}::uuid`;await mobileContext.close();await anonymousContext.close();await db.end();}
});

