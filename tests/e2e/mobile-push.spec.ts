import {test,expect} from '@playwright/test';
import {createECDH,randomBytes,randomUUID} from 'node:crypto';
import {login,expectNoOverflow} from './helpers';
test('phone notification opt-in, choices, test and opt-out require a deliberate tap',async({page})=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable local CI database only');test.setTimeout(90000);
 const endpoint='https://fcm.googleapis.com/fcm/send/browser-'+randomUUID(),ec=createECDH('prime256v1');ec.generateKeys();
 const keys={p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')};
 await page.addInitScript(({endpoint,keys})=>{
  let sub:object|null=null;
  const manager={getSubscription:async()=>sub,subscribe:async(options:object)=>{
   sub={endpoint,options,toJSON:()=>({endpoint,keys}),unsubscribe:async()=>{sub=null;return true;}};return sub;
  }};
  const registration={pushManager:manager};
  Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,ready:Promise.resolve(registration),getRegistration:async()=>registration},configurable:true});
  Object.defineProperty(window,'PushManager',{value:class{},configurable:true});
  let permission='default';Reflect.set(window,'permissionTaps',0);
  Object.defineProperty(window,'Notification',{value:class{static get permission(){return permission;}static async requestPermission(){Reflect.set(window,'permissionTaps',Reflect.get(window,'permissionTaps')+1);permission='granted';return permission;}},configurable:true});
 },{endpoint,keys});
 await page.setViewportSize({width:390,height:844});await login(page,'admin');
 expect((await page.request.post('/api/admin/push/setup',{data:{}})).status()).toBe(200);
 await page.goto('/profile');const settings=page.getByRole('region',{name:'휴대폰 알림',exact:true});
 await expect(settings.getByRole('button',{name:'휴대폰 알림 켜기',exact:true})).toBeEnabled();expect(await page.evaluate(()=>Reflect.get(window,'permissionTaps'))).toBe(0);
 await settings.getByLabel('도란도란 알림',{exact:true}).check();
 await settings.getByRole('button',{name:'휴대폰 알림 켜기',exact:true}).click();await expect(settings.getByRole('button',{name:'이 기기 알림 끄기',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Reflect.get(window,'permissionTaps'))).toBe(1);
 const status=await(await page.request.post('/api/push/status',{data:{endpoint}})).json();expect(status).toMatchObject({enabled:true,preferences:{community:true,reading:false,pastoral:true}});
 await expect(settings.getByLabel('샘모임 · 목양지 알림',{exact:true})).toBeVisible();await settings.getByLabel('심방 신청 알림',{exact:true}).uncheck();await settings.getByLabel('묵상 알림',{exact:true}).check();await settings.getByRole('button',{name:'알림 종류 저장',exact:true}).click();await expect(settings.getByRole('status')).toContainText('저장했습니다');
 expect((await(await page.request.post('/api/push/status',{data:{endpoint}})).json()).preferences.reading).toBe(true);expect((await(await page.request.post('/api/push/status',{data:{endpoint}})).json()).preferences.visits).toBe(false);expect((await(await page.request.post('/api/push/status',{data:{endpoint}})).json()).preferences.reports).toBe(true);
 await page.route('**/api/push/test',route=>route.fulfill({json:{status:'sent'}}));await settings.getByRole('button',{name:'알림 테스트',exact:true}).click();await expect(settings.getByRole('status')).toContainText('테스트 알림을 보냈습니다');
 await expectNoOverflow(page);await page.screenshot({path:'test-results/mobile-push-settings.png',fullPage:true});
 await settings.getByRole('button',{name:'이 기기 알림 끄기',exact:true}).click();await expect(settings.getByRole('button',{name:'휴대폰 알림 켜기',exact:true})).toBeVisible();
 expect((await(await page.request.post('/api/push/status',{data:{endpoint}})).json()).enabled).toBe(false);
});
