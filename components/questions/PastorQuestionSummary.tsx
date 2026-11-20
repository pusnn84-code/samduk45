import Link from "next/link";
import { getCurrentSessionUser } from "../../src/features/auth/http-session";
import { questionPastor, questionUnread } from "../../src/features/questions/service";
export async function PastorQuestionSummary(){
 const actor=await getCurrentSessionUser();if(!actor)return null;
 let count:number;
 try{if(!await questionPastor(actor))return null;count=await questionUnread(actor);}catch{return null;}
 return <section className="panel"><h2>질문있어요</h2><p>읽지 않은 비공개 대화 {count}건</p><Link href="/questions">무명 질문 확인하고 답변하기</Link></section>;
}
