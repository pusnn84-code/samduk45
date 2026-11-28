import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { rootCertificates } from "node:tls";
import { Client } from "pg";

const marker = "samduk45:community-ten-photos:20261128";
const constraints = [
  ["prayer_app.community_files", "community_files_slot_check"],
  ["prayer_app.community_post_edits", "community_post_edits_files_check"],
  ["prayer_app.community_post_edits", "community_post_edits_check"],
  ["prayer_app.community_edit_chunks", "community_edit_chunks_slot_check"],
];
const stateSql = `select n.nspname||'.'||t.relname as table_name, c.conname, c.convalidated,
  obj_description(c.oid,'pg_constraint') as marker from pg_constraint c
  join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  where c.conrelid in ('prayer_app.community_files'::regclass,
    'prayer_app.community_post_edits'::regclass,'prayer_app.community_edit_chunks'::regclass)
  and c.conname = any($1::text[])`;
const countSql = `select
  (select count(*)::text from prayer_app.community_posts) posts,
  (select count(*)::text from prayer_app.community_files) files,
  (select count(*)::text from prayer_app.community_file_chunks) chunks,
  (select count(*)::text from prayer_app.community_post_edits) edits,
  (select count(*)::text from prayer_app.community_edit_chunks) edit_chunks`;

// Only this bounded, additive capacity upgrade runs here; no user rows are rewritten.
export async function upgradeCommunityPhotoSchema(client) {
  await client.query("begin isolation level repeatable read");
  try {
    await client.query("set local lock_timeout='5s'");
    await client.query("set local statement_timeout='20s'");
    await client.query("select pg_advisory_xact_lock(20261128,10)");
    const { rows } = await client.query(stateSql,[constraints.map(([,name])=>name)]);
    if(rows.length!==constraints.length || constraints.some(([table,name])=>
      !rows.some(row=>row.table_name===table && row.conname===name && row.convalidated))) {
      throw new Error("PHOTO_SCHEMA_UNEXPECTED_STATE");
    }
    if(rows.every(row=>row.marker===marker)) {
      await client.query("commit");
      return {status:"already-ready"};
    }
    const before=(await client.query(countSql)).rows[0];
    const migration=readFileSync(new URL("../drizzle/20261128010000_community_ten_photos.sql",import.meta.url),"utf8")
      .replace(/^(?:begin|commit);[ \t]*\r?$/gmi,"");
    await client.query(migration);
    for(const [table,name] of constraints) {
      // All identifiers and the marker are constants above, never request input.
      await client.query(`comment on constraint ${name} on ${table} is '${marker}'`);
    }
    const after=(await client.query(countSql)).rows[0];
    if(JSON.stringify(before)!==JSON.stringify(after))throw new Error("PHOTO_SCHEMA_DATA_CHANGED");
    await client.query("commit");
    return {status:"upgraded",counts:after};
  } catch(error) {
    await client.query("rollback").catch(()=>{});
    throw error;
  }
}

export async function prepareProductionPhotos(env=process.env) {
  if(env.VERCEL_ENV!=="production")return {status:"skipped"};
  if(!env.DATABASE_URL)throw new Error("PHOTO_SCHEMA_DATABASE_REQUIRED");
  const url=new URL(env.DATABASE_URL);
  for(const key of ["ssl","sslmode","sslcert","sslkey","sslrootcert","sslnegotiation"])url.searchParams.delete(key);
  const client=new Client({
    connectionString:url.toString(),
    ssl:{rejectUnauthorized:true,ca:[...rootCertificates,readFileSync(new URL("./certs/supabase-prod-ca-2021.crt",import.meta.url),"utf8")]},
    connectionTimeoutMillis:10000,query_timeout:25000,statement_timeout:20000,
  });
  try {
    await client.connect();
    return await upgradeCommunityPhotoSchema(client);
  } finally { await client.end().catch(()=>{}); }
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  prepareProductionPhotos().then(result=>{
    if(result.status!=="skipped")writeFileSync(new URL("../public/community-photo-release.json",import.meta.url),JSON.stringify({
      maximumPhotos:10,carousel:true,schemaReady:true,commit:process.env.VERCEL_GIT_COMMIT_SHA??null,
    }));
    console.log("COMMUNITY_PHOTO_SCHEMA",JSON.stringify(result));
  }).catch(()=>{
    // Errors can include credentials, hostnames or database row contents.
    console.error("COMMUNITY_PHOTO_SCHEMA_FAILED");
    process.exitCode=1;
  });
}
