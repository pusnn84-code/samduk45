import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentSessionUser} from '../auth/http-session';
import {DomainError} from '../../lib/http';
import {checkOrigin,readLimited,ReportError} from '../pastoral/policy';
import {DocumentInput,RecordInput,PDF_LIMIT} from './policy';
import {createSamji,listSamji,samjiDetail,saveSamji,samjiPdf} from './service';
export const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers});
function failure(e:unknown){if(e instanceof DomainError||e instanceof ReportError)return json({code:e.code},e.status);console.warn('SAMJI_REQUEST_FAILED');return json({code:'SAMJI_UNAVAILABLE'},503);}
async function user(){const u=await getCurrentSessionUser();if(!u)throw new DomainError('UNAUTHORIZED',401);return u;}
type Context={params:Promise<{id:string}>};
async function id(context:Context){const value=(await context.params).id;if(!z.uuid().safeParse(value).success)throw new DomainError('INVALID_INPUT',400);return value;}
export async function list(request:Request){try{const u=await user(),query=new URL(request.url).searchParams,page=z.coerce.number().int().min(0).max(10000).safeParse(query.get('page')??0);if(!page.success)return json({code:'INVALID_INPUT'},400);return json(await listSamji(u.id,query.get('own')==='1',page.data));}catch(e){return failure(e);}}
export async function create(request:Request){
 try{
  const u=await user();if(u.role!=='admin')throw new DomainError('FORBIDDEN',403);checkOrigin(request);
  const type=request.headers.get('content-type')??'';if(!type.startsWith('multipart/form-data;'))return json({code:'INVALID_CONTENT_TYPE'},415);
  const bytes=await readLimited(request,4*1024*1024);let form:FormData;
  try{form=await new Response(new Uint8Array(bytes),{headers:{'content-type':type}}).formData();}catch{return json({code:'INVALID_INPUT'},400);}
  const file=form.get('pdf'),raw=form.get('document');if(!(file instanceof File)||typeof raw!=='string'||file.size<5||file.size>PDF_LIMIT)return json({code:'INVALID_PDF'},400);
  let value:unknown;try{value=JSON.parse(raw);}catch{return json({code:'INVALID_INPUT'},400);}const input=DocumentInput.safeParse(value);if(!input.success)return json({code:'INVALID_INPUT'},400);
  const data=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(data.subarray(0,5))!=='%PDF-')return json({code:'INVALID_PDF'},400);
  const name=file.name.replace(/[\r\n\\/\x00-\x1f]/g,'').slice(0,160);if(!name.toLowerCase().endsWith('.pdf'))return json({code:'INVALID_PDF'},400);
  return json(await createSamji(u.id,input.data,name,data),201);
 }catch(e){return failure(e);}
}
export async function detail(_request:Request,context:Context){try{const u=await user();return json(await samjiDetail(await id(context),u.id));}catch(e){return failure(e);}}
export async function save(request:Request,context:Context){try{const u=await user();checkOrigin(request);if(!request.headers.get('content-type')?.startsWith('application/json'))return json({code:'INVALID_CONTENT_TYPE'},415);
 let body:unknown;try{body=JSON.parse(new TextDecoder().decode(await readLimited(request,300000)));}catch(e){if(e instanceof ReportError)throw e;return json({code:'INVALID_INPUT'},400);}
 const input=RecordInput.safeParse(body);if(!input.success)return json({code:'INVALID_INPUT'},400);return json(await saveSamji(await id(context),u.id,input.data));
 }catch(e){return failure(e);}}
export async function pdf(_request:Request,context:Context){try{await user();const file=await samjiPdf(await id(context));return new Response(new Uint8Array(file.data),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="samji.pdf"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Content-Security-Policy':"sandbox; default-src 'none'"}});}catch(e){return failure(e);}}
