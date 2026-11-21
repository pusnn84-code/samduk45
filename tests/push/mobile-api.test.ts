import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createECDH,randomBytes} from 'node:crypto';
const b=vi.hoisted(()=>({session:vi.fn(),save:vi.fn(),remove:vi.fn(),prefs:vi.fn(),status:vi.fn(),test:vi.fn(),config:vi.fn(),setup:vi.fn()}));
vi.mock('../../src/features/auth/http-session',()=>({getCurrentSessionUser:b.session}));
vi.mock('../../src/features/push/devices',()=>({savePushSubscription:b.save,removePushSubscription:b.remove,updatePushPreferences:b.prefs,deviceStatus:b.status,sendTestPush:b.test}));
vi.mock('../../src/features/push/config',()=>({pushConfig:b.config,setupPush:b.setup}));
import {POST,PUT,DELETE} from '../../app/api/push/subscribe/route';
import {POST as status} from '../../app/api/push/status/route';
import {POST as test} from '../../app/api/push/test/route';
import {POST as setup} from '../../app/api/admin/push/setup/route';
import {GET as key} from '../../app/api/push/public-key/route';
const ec=createECDH('prime256v1');ec.generateKeys();const input={endpoint:'https://fcm.googleapis.com/test',keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
function req(body:unknown,origin='https://app.test'){return new Request('https://app.test/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});}
beforeEach(()=>{vi.clearAllMocks();b.session.mockResolvedValue({id:'owner',role:'member'});b.config.mockResolvedValue({publicKey:'public',privateKey:'SECRET',subject:'mailto:a@test.example'});b.status.mockResolvedValue({enabled:false});});
describe('mobile push session boundaries',()=>{
 it('requires a full session for every device operation and public key',async()=>{b.session.mockResolvedValue(null);for(const fn of [POST,PUT,DELETE,status,test,setup])expect((await fn(req(input))).status).toBe(401+(fn===setup?2:0));expect((await key()).status).toBe(401);expect(b.save).not.toHaveBeenCalled();});
 it('never discloses private configuration',async()=>{expect(await(await key()).json()).toEqual({publicKey:'public'});});
 it('saves to the session owner and forbids choosing another user',async()=>{expect((await POST(req(input))).status).toBe(200);expect(b.save).toHaveBeenCalledWith('owner',expect.objectContaining({preferences:expect.objectContaining({pastoral:false})}),null);b.save.mockClear();expect((await POST(req({...input,userId:'other'}))).status).toBe(400);expect(b.save).not.toHaveBeenCalled();});
 it('blocks cross-site requests and private-network providers before storage',async()=>{expect((await POST(req(input,'https://other.test'))).status).toBe(403);expect((await POST(req({...input,endpoint:'https://127.0.0.1/secret'}))).status).toBe(400);expect(b.save).not.toHaveBeenCalled();});
 it('scopes device status, tests and removal to the current user',async()=>{await status(req({endpoint:input.endpoint}));expect(b.status).toHaveBeenCalledWith('owner',input.endpoint);await test(req({endpoint:input.endpoint}));expect(b.test).toHaveBeenCalledWith('owner',input.endpoint);await DELETE(req({endpoint:input.endpoint}));expect(b.remove).toHaveBeenCalledWith('owner',input.endpoint);});
 it('limits server key initialization to an administrator',async()=>{expect((await setup(req({}))).status).toBe(403);expect(b.setup).not.toHaveBeenCalled();b.session.mockResolvedValue({id:'pastor',role:'admin'});expect((await setup(req({}))).status).toBe(200);expect(b.setup).toHaveBeenCalledOnce();});
});
