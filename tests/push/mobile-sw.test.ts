import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,it,expect,vi} from 'vitest';
describe('mobile notification worker',()=>{
 it('shows malformed pushes safely and refuses external click destinations',async()=>{
  const listeners:Record<string,(e:unknown)=>void>={},show=vi.fn(async()=>{}),open=vi.fn(async()=>{});
  const self={location:{origin:'https://app.test'},addEventListener:(type:string,handler:(e:unknown)=>void)=>{listeners[type]=handler;},skipWaiting:vi.fn(),registration:{showNotification:show},clients:{claim:vi.fn(),matchAll:async()=>[],openWindow:open}};
  runInNewContext(readFileSync('public/sw.js','utf8'),{self,URL});let pending:Promise<unknown>|undefined;
  listeners.push({data:{json:()=>{throw Error('bad');}},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;expect(show).toHaveBeenCalledWith('삼덕사오',expect.objectContaining({icon:'/icons/45-logo-v4-192.png',badge:'/icons/notification-samduk-badge-v1-96.png'}));
  listeners.notificationclick({notification:{close:vi.fn(),data:{url:'https://evil.test/steal'}},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;expect(open).toHaveBeenCalledWith('https://app.test/notices');
 });
 it('reuses an existing app window and keeps the destination on the app origin',async()=>{
  const listeners:Record<string,(e:unknown)=>void>={},navigate=vi.fn(async()=>{}),focus=vi.fn(async()=>{}),open=vi.fn();
  const self={location:{origin:'https://app.test'},addEventListener:(type:string,handler:(e:unknown)=>void)=>{listeners[type]=handler;},clients:{matchAll:async()=>[{url:'https://app.test/',navigate,focus}],openWindow:open}};
  runInNewContext(readFileSync('public/sw.js','utf8'),{self,URL});let pending:Promise<unknown>|undefined;
  listeners.notificationclick({notification:{close:vi.fn(),data:{url:'/questions'}},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
  expect(navigate).toHaveBeenCalledWith('https://app.test/questions');expect(focus).toHaveBeenCalledOnce();expect(open).not.toHaveBeenCalled();
 });
});
