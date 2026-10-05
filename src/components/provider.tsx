'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { DemoState, Session } from '@/types/domain';
import { service, type Command } from '@/services/service';

type ContextValue={state:DemoState|null;session:Session|null;ready:boolean;error:string;busy:boolean;login:(kind:'hq'|'store'|null,email:string,password:string,remember:boolean)=>Promise<Session>;logout:()=>Promise<void>;execute:(command:Command)=>Promise<void>};
const AppContext=createContext<ContextValue|null>(null);
export function AppProvider({children}:{children:React.ReactNode}){
 const [state,setState]=useState<DemoState|null>(null),[session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const current=useRef<DemoState|null>(null),queue=useRef<Promise<void>>(Promise.resolve());
 useEffect(()=>{let active=true;Promise.all([service.load(),service.session()]).then(([data,user])=>{if(active){current.current=data;setState(data);setSession(user);setReady(true);}}).catch(()=>{if(active){setError('브라우저 저장소를 사용할 수 없습니다. 저장소 권한을 허용한 뒤 새로고침해 주세요.');setReady(true);}});return()=>{active=false;};},[]);
 const execute=useCallback((command:Command)=>{
  const run=queue.current.then(async()=>{if(!current.current||!session)throw new Error('로그인이 필요합니다.');setBusy(true);try{const next=await service.execute(current.current,session,command);current.current=next;setState(next);}finally{setBusy(false);}});queue.current=run.catch(()=>{});return run;
 },[session]);
 async function login(kind:'hq'|'store'|null,email:string,password:string,remember:boolean){const user=kind?await service.demoLogin(kind,remember):await service.login(email,password,remember);setSession(user);return user;}
 async function logout(){await service.logout();setSession(null);}
 return <AppContext.Provider value={{state,session,ready,error,busy,login,logout,execute}}>{children}</AppContext.Provider>;
}
export function useApp(){const context=useContext(AppContext);if(!context)throw new Error('AppProvider가 필요합니다.');return context;}
export function useData(){const app=useApp();if(!app.state||!app.session)throw new Error('로그인 후 사용해 주세요.');return {...app,state:app.state,session:app.session};}
