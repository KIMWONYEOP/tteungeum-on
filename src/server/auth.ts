import 'server-only';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { dataMode } from '@/lib/config';
import type { Session, Role } from '@/types/domain';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export async function authenticated(){
 const client=await serverSupabase();const authorization=(await headers()).get('authorization');const token=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;const {data,error}=await client.auth.getUser(token);
 if(error||!data.user)throw new HttpError(401,'로그인이 필요합니다.');
 const {data:profile,error:profileError}=await client.from('profiles').select('id,email,name,role,active').eq('id',data.user.id).maybeSingle();
 if(profileError)throw new HttpError(503,'프로필 조회에 실패했습니다. DB migration과 연결을 확인해 주세요.');
 if(!profile?.active)throw new HttpError(403,'활성화된 계정 권한이 없습니다. 본사에 문의해 주세요.');
 const {data:members,error:memberError}=await client.from('store_memberships').select('id,store_id,store_role').eq('user_id',data.user.id).eq('active',true);
 if(memberError)throw new HttpError(503,'매장 권한 조회에 실패했습니다.');
 const hq=['SUPER_ADMIN','HQ_ADMIN'].includes(profile.role);
 if(!hq&&!members?.length)throw new HttpError(403,'배정된 매장이 없습니다. 본사에 계정 연결을 요청해 주세요.');
 const selected=(await cookies()).get('tt-store')?.value;
 const session:Session={profile:{id:profile.id,email:profile.email,name:profile.name,role:profile.role as Role},storeId:members?.find(m=>m.store_id===selected)?.store_id||members?.[0]?.store_id||'',remember:true};
 return {client,session,members:members||[],hq};
}
export async function requireArea(area:'hq'|'store'){
 if(dataMode()==='mock')return;
 try{const user=await authenticated();if(area==='hq'&&!user.hq)redirect('/store');if(area==='store'&&user.hq)redirect('/hq');}
 catch(error){if(error instanceof HttpError){if(error.status===401||error.status===403)redirect('/login');throw error;}if(error instanceof Error&&error.message.startsWith('Supabase 설정'))redirect('/login');throw error;}
}
export async function authorizedStore(storeId:string,write=false){
 const user=await authenticated();const member=user.members.find(m=>m.store_id===storeId);
 if(!user.hq&&!member)throw new HttpError(403,'다른 매장에 접근할 수 없습니다.');
 if(write&&!user.hq&&(user.session.profile.role==='STAFF'||member?.store_role==='STAFF'))throw new HttpError(403,'직원 계정으로 이 작업을 할 수 없습니다.');
 return user;
}
