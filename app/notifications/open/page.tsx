import {redirect,notFound} from 'next/navigation';
import {getCurrentSessionUser} from '../../../src/features/auth/http-session';
import {notificationSource,notificationEntryUrl} from '../../../src/features/push/destination';
import {notificationContent} from '../../../src/features/push/content';
export const dynamic='force-dynamic';
export default async function NotificationPage({searchParams}:{searchParams:Promise<{kind?:string;source?:string}>}){
 const query=await searchParams,source=notificationSource(query.kind,query.source);if(!source)notFound();const user=await getCurrentSessionUser();
 if(!user)redirect('/login?'+new URLSearchParams({next:notificationEntryUrl(source.kind,source.source)}));
 const content=await notificationContent(user.id,source.kind,source.source);if(!content)notFound();redirect(content.target);
}
