import { cookies } from 'next/headers';
import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase/server';
import { parseBody, respond } from '@/server/http';
export async function POST(request:Request){return respond(async()=>{await parseBody(request,z.object({}));const client=await serverSupabase();const {error}=await client.auth.signOut();if(error)throw error;(await cookies()).delete('tt-remember');(await cookies()).delete('tt-store');return {ok:true};});}
