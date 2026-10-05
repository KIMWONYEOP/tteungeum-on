import { z } from 'zod';
import { parseBody, respond } from '@/server/http';
import { applyCommand } from '@/server/commands';
export async function POST(request:Request){return respond(async()=>{const {key}=await parseBody(request,z.object({key:z.string().min(8).max(128)}));return {orderId:await applyCommand({type:'suggestOrders',key})};});}
