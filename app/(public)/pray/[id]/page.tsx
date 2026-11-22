import {notFound,redirect} from "next/navigation";
import {getCurrentSessionUser} from "../../../../src/features/auth/http-session";
import {autumnDestination} from "../../../../src/features/auth/prayer-return";
export const metadata={title:"이분을 위해 기도합시다"};
export default async function SharedPrayerCard({params}:{params:Promise<{id:string}>}){const {id}=await params,destination=autumnDestination(id);if(!destination)notFound();if(await getCurrentSessionUser())redirect(destination);redirect("/login?autumnCard="+id);}
