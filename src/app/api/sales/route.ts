import { authorizedStore } from '@/server/auth';
import { respond, parseBody, dbError } from '@/server/http';
import { saleSchema } from '@/server/schemas';
export async function POST(request:Request){return respond(async()=>{const input=await parseBody(request,saleSchema);const {client}=await authorizedStore(input.storeId);const {storeId,...payload}=input;const {data,error}=await client.rpc('create_sale',{p_store:storeId,p_payload:payload});dbError(error);return {saleId:data};});}
