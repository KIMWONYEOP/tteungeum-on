import { z } from 'zod';
import { authenticated, authorizedStore, HttpError } from '@/server/auth';
import { respond, dbError } from '@/server/http';
import { projectWorkspace } from '@/repositories/workspace';
import { today, shiftDate } from '@/lib/calculations';
export async function GET(request:Request){return respond(async()=>{
 const url=new URL(request.url);const start=z.iso.date().parse(url.searchParams.get('start')||shiftDate(today(),-61)),end=z.iso.date().parse(url.searchParams.get('end')||today());
 if(start>end||Date.parse(end)-Date.parse(start)>366*86400000)throw new HttpError(400,'조회 기간은 366일 이내로 선택해 주세요.');
 if(url.searchParams.has('storeId'))await authorizedStore(z.uuid().parse(url.searchParams.get('storeId')));
 const defaultReportStart=url.searchParams.get('view')==='sales'?today():shiftDate(today(),-6);const reportStart=z.iso.date().parse(url.searchParams.get('reportStart')||defaultReportStart),reportEnd=z.iso.date().parse(url.searchParams.get('reportEnd')||today());if(reportStart<start||reportEnd>end||reportEnd<reportStart)throw new HttpError(400,'집계 기간을 확인해 주세요.');
 const {client}=await authenticated();const {data,error}=await client.rpc('workspace_snapshot',{p_start:start,p_end:end,p_report_start:reportStart,p_report_end:reportEnd});dbError(error);return {state:projectWorkspace(data)};
 });}
