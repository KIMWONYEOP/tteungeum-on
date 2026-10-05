import { z } from 'zod';
import { cookies } from 'next/headers';
import { authorizedStore, authenticated } from '@/server/auth';
import { parseBody, respond } from '@/server/http';
export async function POST(request:Request){return respond(async()=>{const {storeId}=await parseBody(request,z.object({storeId:z.uuid()}));await authorizedStore(storeId);(await cookies()).set('tt-store',storeId,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});return {session:(await authenticated()).session};});}
