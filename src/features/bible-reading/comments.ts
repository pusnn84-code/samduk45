import {getDb,rows,sql} from "../pastoral/db";
import {DomainError} from "../../lib/http";
export async function listMeditationComments(sharingId:string,userId:string){
 return rows<{id:string;name:string;body:string;isOwn:boolean;createdAt:string}>(getDb(),sql`
 select c.id,case when s.sharing_anonymous and s.user_id=c.user_id then '무명'||s.anonymous_number else u.display_name end as name,
 c.body,c.user_id=${userId}::uuid as "isOwn",c.created_at as "createdAt"
 from prayer_app.meditation_comments c join prayer_app.bible_reading_shares s on s.sharing_id=c.sharing_id and s.sharing is not null
 join prayer_app.users u on u.id=c.user_id and u.is_active
 join prayer_app.users author on author.id=s.user_id and author.is_active
 where c.sharing_id=${sharingId}::uuid order by c.created_at,c.id`);
}
export async function mutateMeditationComment(userId:string,sharingId:string,input:{id:string;body:string}|{id:string}){
 await getDb().transaction(async tx=>{
  const [parent]=await rows<{id:string}>(tx,sql`select s.sharing_id as id from prayer_app.bible_reading_shares s join prayer_app.users u on u.id=s.user_id and u.is_active where s.sharing_id=${sharingId}::uuid and s.sharing is not null for update of s`);
  if(!parent)throw new DomainError("SHARING_NOT_FOUND",404);
  const [existing]=await rows<{owner:string;body:string;parent:string}>(tx,sql`select user_id as owner,body,sharing_id as parent from prayer_app.meditation_comments where id=${input.id}::uuid`);
  if("body" in input){
   if(existing){if(existing.owner===userId&&existing.parent===sharingId&&existing.body===input.body)return;throw new DomainError("COMMENT_CONFLICT",409);}
   await tx.execute(sql`insert into prayer_app.meditation_comments(id,sharing_id,user_id,body) values(${input.id}::uuid,${sharingId}::uuid,${userId}::uuid,${input.body})`);
  }else{
   if(!existing||existing.owner!==userId||existing.parent!==sharingId)throw new DomainError("COMMENT_NOT_FOUND",404);
   await tx.execute(sql`delete from prayer_app.meditation_comments where id=${input.id}::uuid and user_id=${userId}::uuid`);
  }
 });
}
