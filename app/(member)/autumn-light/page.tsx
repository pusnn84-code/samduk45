import {redirect} from "next/navigation";
import {getCurrentSessionUser} from "../../../src/features/auth/http-session";
import {AutumnLight} from "../../../components/autumn-light/AutumnLight";
export const metadata={title:"가을빛축제"};
export default async function AutumnLightPage(){const user=await getCurrentSessionUser();if(!user)redirect("/login");return <AutumnLight user={{displayName:user.displayName,role:user.role}}/>;}
