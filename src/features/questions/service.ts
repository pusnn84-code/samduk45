import { getDb, rows, sql, type Executor } from "../pastoral/db";
import { DomainError } from "../../lib/http";
import type { SessionUser } from "../auth/session";

export async function questionPastor(actor: SessionUser, db: Executor = getDb()) {
  const [setting] = await rows<{ ready: boolean; pastor: boolean }>(db, sql`
    select exists(select 1 from prayer_app.users u where u.id=s.pastor_user_id and u.is_active and u.role='admin') as ready,
    (s.pastor_user_id=${actor.id}::uuid and ${actor.role}='admin') as pastor
    from prayer_app.question_settings s where s.id=1`);
  if (!setting?.ready) throw new DomainError("QUESTIONS_NOT_READY", 503);
  return Boolean(setting.pastor);
}

export async function questionUnread(actor: SessionUser, db: Executor = getDb()) {
  const pastor = await questionPastor(actor, db);
  const [row] = await rows<{ count: number }>(db, sql`
    select count(*)::int as count from prayer_app.questions q
    where (${pastor} or q.owner_user_id=${actor.id}::uuid) and exists (
      select 1 from prayer_app.question_messages m where m.question_id=q.id
      and m.sender=${pastor ? "member" : "pastor"}
      and m.id > ${pastor ? sql`q.pastor_read_id` : sql`q.owner_read_id`})`);
  return row.count;
}

export async function listQuestions(actor: SessionUser, page: number) {
  const db = getDb();
  const pastor = await questionPastor(actor, db);
  const items = await rows<{ id: string; title: string; updatedAt: string; waiting: boolean; unread: boolean }>(db, sql`
    select q.id,q.title,q.updated_at::text as "updatedAt",
      (select m.sender='member' from prayer_app.question_messages m where m.question_id=q.id order by m.id desc limit 1) as waiting,
      exists(select 1 from prayer_app.question_messages m where m.question_id=q.id
        and m.sender=${pastor ? "member" : "pastor"} and m.id>${pastor ? sql`q.pastor_read_id` : sql`q.owner_read_id`}) as unread
    from prayer_app.questions q where (${pastor} or q.owner_user_id=${actor.id}::uuid)
    order by q.updated_at desc,q.id limit 21 offset ${page * 20}`);
  return { pastor, items: items.slice(0,20).map(item=>({...item,updatedAt:new Date(item.updatedAt).toISOString()})), hasMore: items.length>20 };
}

export async function createQuestion(actor: SessionUser, title: string, content: string) {
  return getDb().transaction(async tx => {
    const pastor = await questionPastor(actor, tx);
    if (pastor) throw new DomainError("PASTOR_REPLY_ONLY", 403);
    // Serialize submissions by this member, limiting accidental double taps/spam.
    await tx.execute(sql`select id from prayer_app.users where id=${actor.id}::uuid for update`);
    const [rate] = await rows<{ count: number }>(tx, sql`select count(*)::int as count from prayer_app.questions where owner_user_id=${actor.id}::uuid and created_at>now()-interval '1 minute'`);
    if(rate.count>=3) throw new DomainError("TOO_MANY_REQUESTS",429);
    const [q] = await rows<{id:string}>(tx, sql`insert into prayer_app.questions(owner_user_id,title) values(${actor.id}::uuid,${title}) returning id`);
    const [m] = await rows<{id:string}>(tx, sql`insert into prayer_app.question_messages(question_id,sender,content) values(${q.id}::uuid,'member',${content}) returning id::text`);
    await tx.execute(sql`update prayer_app.questions set owner_read_id=${m.id}::bigint where id=${q.id}::uuid`);
    return q.id;
  });
}

export async function questionDetail(actor: SessionUser, id: string, before?: string) {
  const db = getDb(), pastor = await questionPastor(actor, db);
  // Project only safe fields: never return owner id, name, roster, or phone.
  const [question] = await rows<{id:string;title:string}>(db, sql`select id,title from prayer_app.questions where id=${id}::uuid and (${pastor} or owner_user_id=${actor.id}::uuid)`);
  if (!question) throw new DomainError("NOT_FOUND",404);
  const messages = await rows<{id:string;sender:"member"|"pastor";content:string;createdAt:string}>(db, sql`
    select id::text,sender,content,created_at::text as "createdAt" from prayer_app.question_messages
    where question_id=${id}::uuid ${before ? sql`and id<${before}::bigint` : sql``} order by id desc limit 51`);
  return { ...question, pastor, messages: messages.slice(0,50).reverse().map(message=>({...message,createdAt:new Date(message.createdAt).toISOString()})), hasMore: messages.length>50 };
}

export async function readQuestion(actor: SessionUser, id: string, through: string) {
  const db=getDb(),pastor=await questionPastor(actor,db);
  // Acknowledge only the exact message actually rendered; later replies stay unread.
  const result = await rows<{id:string}>(db,sql`update prayer_app.questions q set ${pastor ? sql`pastor_read_id=greatest(pastor_read_id,${through}::bigint)` : sql`owner_read_id=greatest(owner_read_id,${through}::bigint)`}
    where q.id=${id}::uuid and (${pastor} or q.owner_user_id=${actor.id}::uuid)
    and exists(select 1 from prayer_app.question_messages m where m.question_id=q.id and m.id=${through}::bigint) returning id`);
  if(!result.length) throw new DomainError("NOT_FOUND",404);
}

export async function replyQuestion(actor: SessionUser,id:string,content:string) {
  return getDb().transaction(async tx=>{
    const pastor=await questionPastor(actor,tx);
    const [q]=await rows<{id:string}>(tx,sql`select id from prayer_app.questions where id=${id}::uuid and (${pastor} or owner_user_id=${actor.id}::uuid) for update`);
    if(!q)throw new DomainError("NOT_FOUND",404);
    const [rate]=await rows<{count:number}>(tx,sql`select count(*)::int as count from prayer_app.question_messages where question_id=${id}::uuid and sender=${pastor?'pastor':'member'} and created_at>now()-interval '1 minute'`);
    if(rate.count>=10)throw new DomainError("TOO_MANY_REQUESTS",429);
    await tx.execute(sql`insert into prayer_app.question_messages(question_id,sender,content) values(${id}::uuid,${pastor?'pastor':'member'},${content})`);
    await tx.execute(sql`update prayer_app.questions set updated_at=clock_timestamp() where id=${id}::uuid`);
  });
}
