import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import webPush from 'web-push';
import {getDb,rows,sql} from '../pastoral/db';
import {getEnv,requireRosterEncryptionKey,requireWebPushConfig} from '../../lib/env';
const aad=Buffer.from('samduk45-web-push-v1');
export function sealPrivateKey(value:string,key=Buffer.from(requireRosterEncryptionKey(),'base64')){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(aad);const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');}
export function openPrivateKey(value:string,key=Buffer.from(requireRosterEncryptionKey(),'base64')){const b=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));decipher.setAAD(aad);decipher.setAuthTag(b.subarray(12,28));return Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString('utf8');}
export async function pushConfig(){
 const env=getEnv();if(env.WEB_PUSH_VAPID_PUBLIC_KEY&&env.WEB_PUSH_VAPID_PRIVATE_KEY&&env.WEB_PUSH_SUBJECT)return requireWebPushConfig();
 const [row]=await rows<{publicKey:string;privateKey:string;subject:string}>(getDb(),sql`select public_key as "publicKey",private_key_ciphertext as "privateKey",subject from prayer_app.web_push_settings where id=1`);
 return row?{...row,privateKey:openPrivateKey(row.privateKey)}:null;
}
export async function setupPush(){
 if(await pushConfig())return;
 await getDb().transaction(async tx=>{await tx.execute(sql`select pg_advisory_xact_lock(45112201)`);
  const existing=await rows(tx,sql`select id from prayer_app.web_push_settings where id=1`);if(existing.length)return;
  const keys=webPush.generateVAPIDKeys();await tx.execute(sql`insert into prayer_app.web_push_settings(id,public_key,private_key_ciphertext,subject) values(1,${keys.publicKey},${sealPrivateKey(keys.privateKey)},'mailto:pusnn84@gmail.com')`);
 });
}
