import books from "../../../data/scripture-library/books.json";
import {z} from "zod";
import {getDb,rows,sql} from "../pastoral/db";
export const VerseReference=z.object({book:z.number().int(),chapter:z.number().int(),verse:z.number().int()}).strict().refine(r=>{
 const book=books.find(b=>b.id===r.book);return !!book&&r.chapter>=1&&r.chapter<=book.chapters.length&&r.verse>=1&&r.verse<=book.chapters[r.chapter-1];
});
export const HighlightInput=z.object({verses:z.array(VerseReference).min(1).max(400),color:z.enum(["yellow","green","pink"]).nullable()}).strict();
export async function saveHighlights(userId:string,input:z.infer<typeof HighlightInput>){
 const verses=[...new Map(input.verses.map(v=>[`${v.book}:${v.chapter}:${v.verse}`,v])).values()];
 await getDb().transaction(async tx=>{
  if(input.color===null){
   const matches=verses.map(v=>sql`(book=${v.book} and chapter=${v.chapter} and verse=${v.verse})`);
   await tx.execute(sql`delete from prayer_app.scripture_highlights where user_id=${userId}::uuid and (${sql.join(matches,sql` or `)})`);
  }else{
   const values=verses.map(v=>sql`(${userId}::uuid,${v.book},${v.chapter},${v.verse},${input.color})`);
   await tx.execute(sql`insert into prayer_app.scripture_highlights(user_id,book,chapter,verse,color) values ${sql.join(values,sql`, `)} on conflict(user_id,book,chapter,verse) do update set color=excluded.color,updated_at=now()`);
  }
 });
}
export async function getHighlights(userId:string,refs:{book:number;chapter:number}[]){
 const clauses=refs.map(ref=>sql`(book=${ref.book} and chapter=${ref.chapter})`);
 if(!clauses.length)return [];
 return rows<{book:number;chapter:number;verse:number;color:"yellow"|"green"|"pink"}>(getDb(),sql`select book,chapter,verse,color from prayer_app.scripture_highlights where user_id=${userId}::uuid and (${sql.join(clauses,sql` or `)})`);
}
