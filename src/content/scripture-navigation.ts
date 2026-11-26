import {bibleBooks,hymns} from "./scripture-library";
export type ScriptureDestination={href:string;label:string};
export type ScriptureNeighbors={previous:ScriptureDestination|null;next:ScriptureDestination|null};
export function chapterNeighbors(bookId:number,chapter:number):ScriptureNeighbors{
 const index=bibleBooks.findIndex(book=>book.id===bookId),book=bibleBooks[index];
 if(!book||!Number.isInteger(chapter)||chapter<1||chapter>book.chapters.length)return {previous:null,next:null};
 const destination=(id:number,n:number):ScriptureDestination=>({href:`/scripture/bible/${id}/${n}`,label:`${bibleBooks.find(book=>book.id===id)!.name} ${n}장`});
 const before=bibleBooks[index-1],after=bibleBooks[index+1];
 return {previous:chapter>1?destination(book.id,chapter-1):before?destination(before.id,before.chapters.length):null,next:chapter<book.chapters.length?destination(book.id,chapter+1):after?destination(after.id,1):null};
}
export function hymnNeighbors(number:number):ScriptureNeighbors{
 const catalog=[...hymns].sort((a,b)=>a.number-b.number),index=catalog.findIndex(hymn=>hymn.number===number);
 if(index<0)return {previous:null,next:null};
 const destination=(hymn:typeof hymns[number]|undefined)=>hymn?{href:`/scripture/hymns/${hymn.number}`,label:`${hymn.number}장 ${hymn.title}`}:null;
 return {previous:destination(catalog[index-1]),next:destination(catalog[index+1])};
}
export function readingNeighbors(neighbors:ScriptureNeighbors,date:string):ScriptureNeighbors{
 const context=(item:ScriptureDestination|null)=>item?{...item,href:item.href+'?'+new URLSearchParams({readingDate:date})}:null;
 return {previous:context(neighbors.previous),next:context(neighbors.next)};
}
