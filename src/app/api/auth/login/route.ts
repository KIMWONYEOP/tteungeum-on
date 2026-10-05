import { z } from 'zod';
import { cookies } from 'next/headers';
import { serverSupabase } from '@/lib/supabase/server';
import { authenticated, HttpError } from '@/server/auth';
import { parseBody, respond } from '@/server/http';
export async function POST(request:Request){return respond(async()=>{
 const input=await parseBody(request,z.object({email:z.email(),password:z.string().min(1).max(256),remember:z.boolean()}));
 const jar=await cookies();jar.set('tt-remember',input.remember?'1':'0',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',...(input.remember?{maxAge:31536000}:{})});
 const client=await serverSupabase();const {error}=await client.auth.signInWithPassword({email:input.email,password:input.password});
 if(error)throw new HttpError(401,'이메일 또는 비밀번호를 확인해 주세요.');
 try{return {session:(await authenticated()).session};}catch(e){await client.auth.signOut();throw e;}
 });}
