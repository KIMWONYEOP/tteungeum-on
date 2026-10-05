import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { HttpError } from './auth';
import { dataMode } from '@/lib/config';
export async function parseBody<T>(request:Request,schema:ZodType<T>):Promise<T>{
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'허용되지 않는 요청 출처입니다.');
 if(request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'교차 사이트 요청은 허용되지 않습니다.');
 if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'JSON 요청이 필요합니다.');
 const raw=await request.text();if(Buffer.byteLength(raw)>128000)throw new HttpError(413,'요청 데이터가 너무 큽니다.');
 let data;try{data=JSON.parse(raw);}catch{throw new HttpError(400,'JSON 형식 오류');}return schema.parse(data);
}
export async function respond(run:()=>Promise<unknown>){try{if(dataMode()==='mock')throw new HttpError(503,'DB API는 Supabase 모드에서 사용하세요.');return NextResponse.json(await run(),{headers:{'Cache-Control':'private, no-store'}});}catch(e){
 if(e instanceof HttpError)return NextResponse.json({error:e.message},{status:e.status});
 if(e instanceof ZodError)return NextResponse.json({error:'입력값을 확인해 주세요.',issues:e.issues.map(i=>({path:i.path,message:i.message}))},{status:400});
 const message=e instanceof Error&&e.message.startsWith('Supabase 설정')?e.message:'요청을 처리할 수 없습니다. 연결 설정과 권한을 확인해 주세요.';
 return NextResponse.json({error:message},{status:503});}}
export function dbError(error:{code?:string;message:string}|null){if(!error)return;
 const code=error.code;throw new HttpError(code==='42501'?403:['23505','23P01'].includes(code||'')?409:['23514','P0001','22P02','23502','23503'].includes(code||'')?400:503,
 code==='42501'?'이 작업에 대한 권한이 없습니다.':['23505','23P01'].includes(code||'')?'중복 요청 또는 이미 존재하는 데이터입니다.':['23514','P0001'].includes(code||'')?error.message:'데이터를 저장할 수 없습니다.');}
