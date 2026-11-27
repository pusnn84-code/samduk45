import { QuestionsWorkspace } from "../../../components/questions/QuestionsWorkspace";
export default async function QuestionsPage({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;const initialId=typeof id==="string"&&/^[0-9a-f-]{36}$/i.test(id)?id:null;return <main className="shell"><QuestionsWorkspace key={initialId??"list"} initialId={initialId}/></main>;}
