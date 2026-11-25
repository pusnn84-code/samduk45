import books from "../../../data/scripture-library/books.json";
import {z} from "zod";
import {getDb,rows,sql} from "../pastoral/db";
export const VerseReference=z.object({book:z.number().int(),chapter:z.number().int(),verse:z.number().int()}).strict().refine(r=>{
 const book=books.find(b=>b.id===r.book);return !!book&&r.chapter>=1&&r.chapter<=book.chapters.length&&r.verse>=1&&r.verse<=book.chapters[r.chapter-1];
});
export const HighlightInput=z.object({verses:z.array(VerseReference).min(1).max(400),color:z.enum(["yellow","green","pink"]).nullable()}).strict();
export async function saveHighlights(userId:string,input:z.infer<typeof HighlightInput>){
 await getDb().transaction(async tx=>{
  for(const verse of input.verses){
   if(input.color===null)await tx.execute(sql`delete from prayer_app.scripture_highlights where user_id=${userId}::uuid and book=${verse.book} and chapter=${verse.chapter} and verse=${verse.verse}`);
   else await tx.execute(sql`insert into prayer_app.scripture_highlights(user_id,book,chapter,verse,color) values(${userId}::uuid,${verse.book},${verse.chapter},${verse.verse},${input.color}) on conflict(user_id,book,chapter,verse) do update set color=excluded.color,updated_at=now()`);
  }
 });
}
export async function getHighlights(userId:string,refs:{book:number;chapter:number}[]){
 const clauses=refs.map(ref=>sql`(book=${ref.book} and chapter=${ref.chapter})`);
 if(!clauses.length)return [];
 return rows<{book:number;chapter:number;verse:number;color:"yellow"|"green"|"pink"}>(getDb(),sql`select book,chapter,verse,color from prayer_app.scripture_highlights where user_id=${userId}::uuid and (${sql.join(clauses,sql` or `)})`);
}
