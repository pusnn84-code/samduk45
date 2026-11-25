import {getDb,rows,sql} from "../pastoral/db";
export type ReadingNotice={title:string;body:string};
export async function getReadingNotice():Promise<ReadingNotice|null>{
 const [notice]=await rows<ReadingNotice>(getDb(),sql`select title,body from prayer_app.bible_reading_notice where id=1`);return notice??null;
}
export async function saveReadingNotice(input:ReadingNotice):Promise<ReadingNotice>{
 const [notice]=await rows<ReadingNotice>(getDb(),sql`insert into prayer_app.bible_reading_notice(id,title,body) values(1,${input.title},${input.body}) on conflict(id) do update set title=excluded.title,body=excluded.body,updated_at=now() returning title,body`);return notice;
}
