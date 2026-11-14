import {notFound} from "next/navigation";
import {ReviewScenes} from "../../components/review/ReviewScenes";
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){
  if(process.env.VERCEL_ENV!=="preview")notFound();
  const {view}=await searchParams;
  return <ReviewScenes view={view??"hymns"}/>;
}
