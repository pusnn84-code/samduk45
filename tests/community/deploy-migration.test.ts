import { randomUUID, createHash } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it, vi } from "vitest";
import { prepareProductionPhotos, upgradeCommunityPhotoSchema } from "../../scripts/prepare-community-photos.mjs";

const schemaRows=[
  ["prayer_app.community_files","community_files_slot_check"],
  ["prayer_app.community_post_edits","community_post_edits_files_check"],
  ["prayer_app.community_post_edits","community_post_edits_check"],
  ["prayer_app.community_edit_chunks","community_edit_chunks_slot_check"],
].map(([table_name,conname])=>({table_name,conname,convalidated:true,marker:null as string|null}));

describe("production photo schema preparation",()=>{
  it("never connects for preview or ordinary local builds",async()=>{
    for(const VERCEL_ENV of [undefined,"preview","development"]) {
      await expect(prepareProductionPhotos({VERCEL_ENV,DATABASE_URL:"invalid"})).resolves.toEqual({status:"skipped"});
    }
    await expect(prepareProductionPhotos({VERCEL_ENV:"production"})).rejects.toThrow("PHOTO_SCHEMA_DATABASE_REQUIRED");
  });
  it("does not change schema if the expected constraints are missing",async()=>{
    const query=vi.fn(async()=>({rows:[]}));
    await expect(upgradeCommunityPhotoSchema({query})).rejects.toThrow("PHOTO_SCHEMA_UNEXPECTED_STATE");
    expect(query.mock.calls.flat()).toContain("rollback");
    expect(query.mock.calls.flat().some(sql=>String(sql).includes("alter table"))).toBe(false);
  });
  it("rolls back the entire upgrade when DDL fails",async()=>{
    const query=vi.fn(async(sql:string)=>{
      if(sql.includes("from pg_constraint"))return {rows:schemaRows};
      if(sql.includes("alter table"))throw Error("synthetic DDL failure");
      return {rows:[{files:"1"}]};
    });
    await expect(upgradeCommunityPhotoSchema({query})).rejects.toThrow("synthetic DDL failure");
    expect(query.mock.calls.at(-1)?.[0]).toBe("rollback");
    expect(query.mock.calls.flat()).not.toContain("commit");
  });
  it("skips repeated DDL after the atomic upgrade marker is present",async()=>{
    const query=vi.fn(async(sql:string)=>({rows:sql.includes("from pg_constraint")?schemaRows.map(row=>({...row,marker:"samduk45:community-ten-photos:20261128"})):[]}));
    await expect(upgradeCommunityPhotoSchema({query})).resolves.toEqual({status:"already-ready"});
    expect(query.mock.calls.flat().some(sql=>String(sql).includes("alter table"))).toBe(false);
  });
});

describe.skipIf(process.env.E2E_DATABASE_READY!=="1")("real deployment migration in disposable CI PostgreSQL",()=>{
  it("upgrades the old two-photo schema, preserves saved content, and runs only once",async()=>{
    const url=new URL(process.env.DATABASE_URL!);
    if(process.env.CI!=="true" || !["127.0.0.1","localhost"].includes(url.hostname) || url.pathname!=="/prayer_e2e")throw Error("DISPOSABLE_CI_DATABASE_REQUIRED");
    // This test database has its own one-day, self-signed certificate.
    const client=new Client({connectionString:url.toString(),ssl:{rejectUnauthorized:false}});
    await client.connect();
    const id=randomUUID(), editId=randomUUID(), bytes=Buffer.from("x");
    const sha=createHash("sha256").update(bytes).digest("hex");
    try {
      await client.query(`alter table prayer_app.community_files drop constraint community_files_slot_check;
        alter table prayer_app.community_files add constraint community_files_slot_check check(slot in(0,1));
        alter table prayer_app.community_post_edits drop constraint community_post_edits_files_check;
        alter table prayer_app.community_post_edits add constraint community_post_edits_files_check check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=2);
        alter table prayer_app.community_post_edits drop constraint community_post_edits_check;
        alter table prayer_app.community_post_edits add constraint community_post_edits_check check(keep_slots <@ array[0,1]::smallint[] and cardinality(keep_slots)+jsonb_array_length(files)<=2);
        alter table prayer_app.community_edit_chunks drop constraint community_edit_chunks_slot_check;
        alter table prayer_app.community_edit_chunks add constraint community_edit_chunks_slot_check check(slot in(0,1));`);
      const folder=(await client.query("select id from prayer_app.community_folders order by created_at,id limit 1")).rows[0].id;
      const author="00000000-0000-4000-8000-000000000202";
      await client.query("insert into prayer_app.community_posts(id,folder_id,author_user_id,title,body) values($1,$2,$3,'배포 검증','기존 내용 유지')",[id,folder,author]);
      await client.query("insert into prayer_app.community_files(post_id,slot,name,size,sha256) values($1,0,'saved.png',1,$2)",[id,sha]);
      await client.query("insert into prayer_app.community_file_chunks(post_id,slot,chunk_index,data) values($1,0,0,$2)",[id,bytes]);
      const files=[{name:"new.png",size:1,sha256:sha}];
      await client.query("insert into prayer_app.community_post_edits(id,post_id,author_user_id,base_version,title,body,keep_slots,files) values($1,$2,$3,0,'수정 초안','내용','{0}',$4::jsonb)",[editId,id,author,JSON.stringify(files)]);
      await client.query("insert into prayer_app.community_edit_chunks(edit_id,slot,chunk_index,data) values($1,0,0,$2)",[editId,bytes]);
      const snapshot=async()=>({post:(await client.query("select * from prayer_app.community_posts where id=$1",[id])).rows,
        file:(await client.query("select * from prayer_app.community_files where post_id=$1",[id])).rows,
        chunk:(await client.query("select data from prayer_app.community_file_chunks where post_id=$1",[id])).rows,
        edit:(await client.query("select * from prayer_app.community_post_edits where id=$1",[editId])).rows,
        editChunk:(await client.query("select data from prayer_app.community_edit_chunks where edit_id=$1",[editId])).rows});
      const before=await snapshot();
      expect((await upgradeCommunityPhotoSchema(client)).status).toBe("upgraded");
      expect(await snapshot()).toEqual(before);
      await client.query("insert into prayer_app.community_files(post_id,slot,name,size,sha256) values($1,9,'tenth.png',1,$2)",[id,sha]);
      await client.query("insert into prayer_app.community_edit_chunks(edit_id,slot,chunk_index,data) values($1,9,0,$2)",[editId,bytes]);
      await expect(client.query("insert into prayer_app.community_files(post_id,slot,name,size,sha256) values($1,10,'eleventh.png',1,$2)",[id,sha])).rejects.toMatchObject({code:"23514"});
      await expect(client.query("update prayer_app.community_post_edits set keep_slots='{}',files=$2::jsonb where id=$1",[editId,JSON.stringify(Array(11).fill(files[0]))])).rejects.toMatchObject({code:"23514"});
      expect((await upgradeCommunityPhotoSchema(client)).status).toBe("already-ready");
    }finally{
      await client.query("delete from prayer_app.community_posts where id=$1",[id]);
      await client.end();
    }
  });
});
