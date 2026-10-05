import { z } from 'zod';
import { authenticated, authorizedStore, HttpError } from '@/server/auth';
import { respond, parseBody, dbError } from '@/server/http';
export async function POST(request:Request){return respond(async()=>{const {saleId}=await parseBody(request,z.object({saleId:z.uuid()}));const {client}=await authenticated();const {data:sale,error:readError}=await client.from('sales').select('store_id').eq('id',saleId).maybeSingle();dbError(readError);if(!sale)throw new HttpError(404,'매출을 찾을 수 없습니다.');await authorizedStore(sale.store_id,true);const {error}=await client.rpc('cancel_sale',{p_sale:saleId});dbError(error);return {ok:true};});}
