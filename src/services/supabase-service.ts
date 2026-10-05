import type { AppService } from './service';
import type { DemoState, Session } from '@/types/domain';
export function emptyWorkspace():DemoState{return {version:1,production:true,generatedOn:'',profiles:[],stores:[],storeMembers:[],suppliers:[],products:[],inventory:[],inventoryTransactions:[],sales:[],saleItems:[],orders:[],orderItems:[],settlements:[],settlementItems:[],notices:[],tickets:[],notifications:[],auditLogs:[],noticeReads:[],carts:{}};}
export class SessionExpiredError extends Error{constructor(){super('로그인이 만료되었습니다. 다시 로그인해 주세요.');}}
async function request<T>(url:string,body?:unknown):Promise<T>{
 const response=await fetch(url,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();if(response.status===401&&!url.includes('/auth/login'))throw new SessionExpiredError();if(!response.ok)throw new Error(data.error||'요청에 실패했습니다.');return data as T;
}
let activePath='',activeRange:Parameters<AppService['load']>[0];
export const supabaseService:AppService={
 async load(range){
  const path=window.location.pathname;if(activePath!==path){activePath=path;activeRange=undefined;}if(range)activeRange=range;
  const params=new URLSearchParams(activeRange);params.set('view',path.endsWith('/sales')?'sales':'dashboard');const query=`?${params}`;
  const response=await fetch(`/api/workspace${query}`,{cache:'no-store',credentials:'same-origin'});
  if(response.status===401)throw new SessionExpiredError();const data=await response.json();if(!response.ok)throw new Error(data.error||'데이터 조회에 실패했습니다.');return data.state as DemoState;
 },
 async session(){const response=await fetch('/api/auth/session',{cache:'no-store',credentials:'same-origin'});if(response.status===403){await request('/api/auth/logout',{});return null;}const data=await response.json();if(!response.ok)throw new Error(data.error||'세션 조회 실패');return data.session as Session|null;},
 async login(email,password,remember){return (await request<{session:Session}>('/api/auth/login',{email,password,remember})).session;},
 async demoLogin(){throw new Error('운영 환경에서는 실제 계정으로 로그인해 주세요.');},
 async logout(){await request('/api/auth/logout',{});activePath='';activeRange=undefined;},
 async execute(_state,_session,command){await request('/api/commands',command);return this.load();},
};
