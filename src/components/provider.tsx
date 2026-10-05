'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { DemoState, Session } from '@/types/domain';
import type { AppService, Command } from '@/services/service';
import type { DataMode } from '@/lib/config';
import { emptyWorkspace, SessionExpiredError, supabaseService } from '@/services/supabase-service';
type ContextValue={state:DemoState|null;session:Session|null;ready:boolean;error:string;busy:boolean;mode:DataMode;login:(kind:'hq'|'store'|null,email:string,password:string,remember:boolean)=>Promise<Session>;logout:()=>Promise<void>;execute:(command:Command)=>Promise<void>;switchStore:(storeId:string)=>Promise<void>;refresh:(range?:{start:string;end:string;reportStart?:string;reportEnd?:string})=>Promise<void>};
const AppContext=createContext<ContextValue|null>(null);
export function AppProvider({children,mode,configurationError}:{children:React.ReactNode;mode:DataMode;configurationError?:string}){
 const [state,setState]=useState<DemoState|null>(null),[session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(configurationError||''),[busy,setBusy]=useState(false);
 const current=useRef<DemoState|null>(null),queue=useRef<Promise<void>>(Promise.resolve()),client=useRef<AppService>(supabaseService);
 useEffect(()=>{let active=true;async function initialize(){try{
  if(configurationError){setReady(true);return;}
  client.current=mode==='mock'?(await import('@/services/mock-service')).mockService:supabaseService;
  const user=await client.current.session();const data=user||mode==='mock'?await client.current.load():emptyWorkspace();if(active){current.current=data;setState(data);setSession(user);setReady(true);}
 }catch(e){if(active){setError(e instanceof Error?e.message:'데이터를 불러올 수 없습니다.');setReady(true);}}}void initialize();return()=>{active=false;};},[mode,configurationError]);
 const refresh=useCallback(async(range?:{start:string;end:string;reportStart?:string;reportEnd?:string})=>{try{const data=await client.current.load(range);current.current=data;setState(data);}catch(error){if(error instanceof SessionExpiredError){setSession(null);current.current=null;setState(null);}throw error;}},[]);
 const execute=useCallback((command:Command)=>{
 const run=queue.current.then(async()=>{if(!current.current||!session)throw new Error('로그인이 필요합니다.');setBusy(true);try{const next=await client.current.execute(current.current,session,command);current.current=next;setState(next);}catch(error){if(error instanceof SessionExpiredError){setSession(null);current.current=null;setState(null);}throw error;}finally{setBusy(false);}});queue.current=run.catch(()=>{});return run;
 },[session]);
 useEffect(()=>{if(mode!=='supabase'||!session)return;const update=()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});};document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[mode,session,refresh]);
 async function login(kind:'hq'|'store'|null,email:string,password:string,remember:boolean){const user=kind?await client.current.demoLogin(kind,remember):await client.current.login(email,password,remember);const data=await client.current.load();current.current=data;setState(data);setSession(user);setError('');return user;}
 async function switchStore(storeId:string){if(mode==='mock')return;const response=await fetch('/api/auth/store',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({storeId})});const data=await response.json();if(!response.ok)throw new Error(data.error||'매장 변경 실패');setSession(data.session);await refresh();}
 async function logout(){await client.current.logout();setSession(null);setState(null);current.current=null;}
 return <AppContext.Provider value={{state,session,ready,error,busy,mode,login,logout,execute,refresh,switchStore}}>{children}</AppContext.Provider>;
}
export function useApp(){const context=useContext(AppContext);if(!context)throw new Error('AppProvider가 필요합니다.');return context;}
export function useData(){const app=useApp();if(!app.state||!app.session)throw new Error('로그인 후 사용해 주세요.');return {...app,state:app.state,session:app.session};}
