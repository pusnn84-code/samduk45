import {describe,it,expect} from 'vitest';
import {randomBytes,createECDH} from 'node:crypto';
import {Subscription,safePushEndpoint,messages,pushPayload} from '../../src/features/push/policy';
import {sealPrivateKey,openPrivateKey} from '../../src/features/push/config';
describe('mobile notification privacy and provider boundaries',()=>{
 it.each(['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://localhost/a','https://evil.test/a','https://fcm.googleapis.com.evil.test/a','https://fcm.googleapis.com:444/a','https://user:pass@fcm.googleapis.com/a','https://fcm.googleapis.com/a#frag'])('rejects untrusted push destination %s',value=>expect(safePushEndpoint(value)).toBe(false));
 it.each(['https://fcm.googleapis.com/fcm/send/abc','https://updates.push.services.mozilla.com/wpush/v2/abc','https://web.push.apple.com/abc','https://wns2.notify.windows.com/abc'])('accepts official encrypted push provider %s',value=>expect(safePushEndpoint(value)).toBe(true));
 it('validates actual P-256 and auth bytes and never accepts another recipient identity',()=>{
  const ecdh=createECDH('prime256v1');ecdh.generateKeys();const input={endpoint:'https://fcm.googleapis.com/a',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
  expect(Subscription.safeParse(input).success).toBe(true);expect(Subscription.safeParse({...input,userId:'other'}).success).toBe(false);expect(Subscription.safeParse({...input,keys:{...input.keys,auth:'bad'}}).success).toBe(false);
 });
 it('all notification templates contain only a category and local destination',()=>{
  for(const kind of Object.keys(messages) as (keyof typeof messages)[]){const payload=pushPayload(kind,'event');expect(payload.url).toMatch(/^\/(?!\/)/);expect(payload).not.toHaveProperty('name');expect(payload).not.toHaveProperty('content');expect(payload.tag).toBe('samduk45-event');}
  expect(pushPayload('admin_prayer','id').body).toBe('새 기도요청이 도착했습니다.');
 });
 it('encrypts the VAPID private key and authenticates the ciphertext',()=>{
  const key=randomBytes(32),value='private-server-key';const sealed=sealPrivateKey(value,key);expect(sealed).not.toContain(value);expect(openPrivateKey(sealed,key)).toBe(value);
  const b=Buffer.from(sealed,'base64');b[b.length-1]^=1;expect(()=>openPrivateKey(b.toString('base64'),key)).toThrow();expect(()=>openPrivateKey(sealed,randomBytes(32))).toThrow();
 });
});

it('shows the originating menu first even in a collapsed phone notification',()=>{expect(pushPayload('notice','e').title).toBe('공지 · 새 글');expect(pushPayload('community','e').title).toBe('도란도란 · 새 글');expect(pushPayload('reading','e').title).toBe('성경통독 · 묵상 나눔');expect(pushPayload('admin_visit','e').title).toBe('심방요청 · 새 신청');expect(pushPayload('admin_report','e').title).toBe('샘목양지 · 새 제출');});
