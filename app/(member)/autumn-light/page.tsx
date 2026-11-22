import {redirect} from "next/navigation";
import {getCurrentSessionUser} from "../../../src/features/auth/http-session";
import {AutumnLight} from "../../../components/autumn-light/AutumnLight";
import {autumnDestination} from "../../../src/features/auth/prayer-return";
export const metadata={title:"가을빛축제"};
export default async function AutumnLightPage({searchParams}:{searchParams:Promise<{card?:string}>}){const user=await getCurrentSessionUser();if(!user)redirect("/login");const {card}=await searchParams;const target=autumnDestination(card)?card!:null;return <AutumnLight key={target??"daily"} initialCardId={target} user={{displayName:user.displayName,role:user.role}}/>;}
