import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { dataMode, supabaseConfig } from '@/lib/config';
export async function proxy(request:NextRequest){
 if(dataMode()==='mock')return NextResponse.next();
 let config;try{config=supabaseConfig();}catch{return NextResponse.next();}
 let response=NextResponse.next({request});
 const client=createServerClient(config.url,config.key,{cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'},cookies:{getAll:()=>request.cookies.getAll(),setAll:items=>{
  for(const {name,value} of items)request.cookies.set(name,value);
  response=NextResponse.next({request});
  for(const {name,value,options} of items)response.cookies.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',...(request.cookies.get('tt-remember')?.value==='0'?{maxAge:undefined,expires:undefined}:{})});
 }}});
 await client.auth.getUser();return response;
}
export const config={matcher:['/hq/:path*','/store/:path*','/api/:path*']};
