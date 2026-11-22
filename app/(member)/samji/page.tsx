import {redirect} from 'next/navigation';
import {getCurrentSessionUser} from '../../../src/features/auth/http-session';
import {SamjiClient} from '../../../components/samji/SamjiClient';
export const metadata={title:'은혜의 샘지'};
export default async function SamjiPage(){const u=await getCurrentSessionUser();if(!u)redirect('/login');return <main className="shell samji-shell"><SamjiClient isAdmin={u.role==='admin'}/></main>;}
