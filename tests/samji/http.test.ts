import {beforeEach,describe,it,expect,vi} from 'vitest';
const b=vi.hoisted(()=>({session:vi.fn(),list:vi.fn(),detail:vi.fn(),create:vi.fn(),save:vi.fn(),pdf:vi.fn()}));
vi.mock('../../src/features/auth/http-session',()=>({getCurrentSessionUser:b.session}));
vi.mock('../../src/features/samji/service',()=>({listSamji:b.list,samjiDetail:b.detail,createSamji:b.create,saveSamji:b.save,samjiPdf:b.pdf}));
import {list,create,detail,save,pdf} from '../../src/features/samji/http';
const id='00000000-0000-4000-8000-000000000111',context={params:Promise.resolve({id})};
const request=(body:unknown={},origin='https://app.test')=>new Request('https://app.test/api/samji',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();b.session.mockResolvedValue({id:'member',role:'member'});b.list.mockResolvedValue({items:[],hasMore:false});b.detail.mockResolvedValue({document:{id},record:{answers:{},notes:[],version:0}});b.save.mockResolvedValue({version:1});b.pdf.mockResolvedValue({data:Buffer.from('%PDF-fake'),name:'샘지.pdf'});});
describe('samji private record HTTP boundary',()=>{
 it('requires a full login for every read, write and source file',async()=>{b.session.mockResolvedValue(null);expect((await list(new Request('https://app.test/api/samji'))).status).toBe(401);for(const handler of [detail,save,pdf])expect((await handler(request(),context)).status).toBe(401);expect((await create(request())).status).toBe(401);expect(b.detail).not.toHaveBeenCalled();});
 it('scopes all records to the current user including administrators',async()=>{
  for(const role of ['member','leader','admin']){b.session.mockResolvedValue({id:role,role});await detail(request(),context);expect(b.detail).toHaveBeenLastCalledWith(id,role);await save(request({version:0,answers:{},notes:[]}),context);expect(b.save).toHaveBeenLastCalledWith(id,role,{version:0,answers:{},notes:[]});}
 });
 it('allows only admins to post PDFs and blocks cross-site record writes',async()=>{expect((await create(request())).status).toBe(403);expect((await save(request({version:0,answers:{},notes:[]},'https://evil.test'),context)).status).toBe(403);expect(b.create).not.toHaveBeenCalled();expect(b.save).not.toHaveBeenCalled();});
 it('does not accept owner identities or memo titles from the browser',async()=>{expect((await save(request({version:0,answers:{},notes:[],ownerUserId:'other'}),context)).status).toBe(400);expect(b.save).not.toHaveBeenCalled();});
 it('serves the original as a private PDF with safe headers',async()=>{const response=await pdf(request(),context);expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('content-type')).toBe('application/pdf');expect(response.headers.get('content-security-policy')).toContain('sandbox');});
});
