import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseConfig } from '@/lib/config';
export async function serverSupabase(){
 const {url,key}=supabaseConfig(),jar=await cookies(),remember=jar.get('tt-remember')?.value!=='0';
 const authorization=(await headers()).get('authorization');
 if(authorization?.startsWith('Bearer '))return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
 return createServerClient(url,key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},cookies:{getAll:()=>jar.getAll(),setAll:items=>{
  try{for(const {name,value,options} of items)jar.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',...(remember?{}:{maxAge:undefined,expires:undefined})});}catch{/* Server Components use proxy for refresh cookie writes. */}
 }}});
}
