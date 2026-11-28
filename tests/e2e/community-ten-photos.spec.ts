import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { expectNoOverflow, login } from "./helpers";
test.use({serviceWorkers:"block"});
test.beforeEach(()=>test.skip(process.env.E2E_DATABASE_READY!=="1","Requires disposable CI DB"));
const root="/api/community";
test("ten photos can be selected, published, viewed and replaced without losing retained photos",async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:360,height:800});
  await login(page);
  const folderId=(await(await page.request.get(root+"/folders")).json()).folders[0].id;
  const image=await sharp({create:{width:480,height:320,channels:3,background:"#b4cad8"}}).png().toBuffer();
  const selection=Array.from({length:10},(_,i)=>({name:`photo-${i}.png`,mimeType:"image/png",buffer:image}));
  let id="";
  try {
    await page.goto("/community?new=1");
    const input=page.locator('input[type="file"]');
    const submit=page.getByRole("button",{name:"등록",exact:true});
    await input.setInputFiles(selection);
    await expect(page.locator(".community-selected-photos img")).toHaveCount(10);
    await expect(submit).toBeEnabled();
    await input.setInputFiles({name:"eleventh.png",mimeType:"image/png",buffer:image});
    await expect(page.locator(".community-file-error").getByRole("alert")).toContainText("최대 10장");
    await expect(page.locator(".community-selected-photos img")).toHaveCount(10);
    await page.getByRole("button",{name:"기존 선택만 유지하기",exact:true}).click();
    const created=page.waitForResponse(r=>r.url().endsWith(root+"/posts")&&r.request().method()==="POST");
    await submit.click();
    const response=await created;expect(response.status()).toBe(201);id=(await response.json()).id;
    await expect(page).toHaveURL(new RegExp("post="+id+"$"),{timeout:60000});
    let saved=(await(await page.request.get(root+"/posts/"+id)).json()).post;
    expect(saved.files).toHaveLength(10);
    expect(saved.files.map((f:{slot:number})=>f.slot)).toEqual([0,1,2,3,4,5,6,7,8,9]);
    for(const file of saved.files){
      expect(file.size).toBeLessThanOrEqual(1048576);
      expect((await page.request.get(`${root}/posts/${id}/files/${file.slot}/image?sha=${file.sha256}`)).ok()).toBe(true);
      expect((await page.request.get(`${root}/posts/${id}/files/${file.slot}/chunks/0`)).ok()).toBe(true);
    }
    const last=page.locator(".community-photo img").last();
    await last.scrollIntoViewIfNeeded();
    await expect.poll(()=>last.evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
    await expectNoOverflow(page);
    const retainedHashes=saved.files.slice(2).map((f:{sha256:string})=>f.sha256);
    await page.getByRole("link",{name:"게시글 수정",exact:true}).click();
    for(const name of ["photo-0","photo-1"])await page.getByRole("button",{name:new RegExp(name+"\\.(webp|png|jpg) 첨부 제거")}).click();
    await input.setInputFiles(selection.slice(0,2).map((f,i)=>({...f,name:`replacement-${i}.png`})));
    await page.getByRole("button",{name:"수정 저장",exact:true}).click();
    await expect(page).toHaveURL(new RegExp("post="+id+"$"),{timeout:60000});
    saved=(await(await page.request.get(root+"/posts/"+id)).json()).post;
    expect(saved.files).toHaveLength(10);
    expect(saved.files.slice(0,8).map((f:{sha256:string})=>f.sha256)).toEqual(retainedHashes);
    expect(saved.files[9].name).toContain("replacement-1");
    expect((await page.request.get(`${root}/posts/${id}/files/9/image?sha=${saved.files[9].sha256}`)).ok()).toBe(true);

    const file={name:"synthetic.png",size:image.length,sha256:createHash("sha256").update(image).digest("hex")};
    const stagedId=randomUUID();
    const staged=await page.request.post(`${root}/posts/${id}/edits`,{data:{id:stagedId,baseVersion:saved.version,title:"전체 사진 교체 검증",body:"사진",keepSlots:[],files:Array(10).fill(file)}});
    expect(staged.status()).toBe(201);
    const stagedUrl=`${root}/posts/${id}/edits/${stagedId}`;
    expect((await page.request.put(stagedUrl+"/files/9/chunks/0",{data:image,headers:{"content-type":"application/octet-stream"}})).ok()).toBe(true);
    expect((await page.request.put(stagedUrl+"/files/10/chunks/0",{data:image,headers:{"content-type":"application/octet-stream"}})).status()).toBe(400);
    expect((await page.request.delete(stagedUrl)).ok()).toBe(true);
    const rejected=await page.request.post(root+"/posts",{data:{id:randomUUID(),folderId,title:"제한 검증",body:"사진",files:Array(11).fill(file)}});
    expect(rejected.status()).toBe(400);expect((await rejected.json()).code).toBe("TOO_MANY_FILES");
    const edit=await page.request.post(`${root}/posts/${id}/edits`,{data:{id:randomUUID(),baseVersion:saved.version,title:"수정 제한",body:"사진",keepSlots:[0,1,2,3,4,5,6,7,8,9],files:[file]}});
    expect(edit.status()).toBe(400);expect((await edit.json()).code).toBe("TOO_MANY_FILES");
    for(const slot of ["10","-1","01"]){
      expect((await page.request.get(`${root}/posts/${id}/files/${slot}/image`)).status()).toBe(400);
      expect((await page.request.get(`${root}/posts/${id}/files/${slot}/chunks/0`)).status()).toBe(400);
    }
  }finally{if(id)expect((await page.request.delete(root+"/posts/"+id)).ok()).toBe(true);}
});
