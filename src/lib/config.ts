import 'server-only';
export type DataMode = 'mock' | 'supabase';
export function dataMode():DataMode {
 // A production deployment can never fall back to demo authentication or fake numbers.
 return process.env.NODE_ENV!=='production' && process.env.APP_DATA_MODE==='mock' ? 'mock':'supabase';
}
export function supabaseConfig(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Supabase 설정이 필요합니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY(또는 ANON_KEY)를 환경 설정에 등록해 주세요.');
 const parsed=new URL(url);if(parsed.protocol!=='https:' && !['localhost','127.0.0.1'].includes(parsed.hostname))throw new Error('Supabase URL은 HTTPS여야 합니다.');
 if(key.startsWith('sb_secret_'))throw new Error('공개 키 설정에 서버 비밀키를 사용할 수 없습니다.');
 if(key.split('.').length===3){try{const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());if(payload.role==='service_role')throw new Error('Service role key를 공개 설정에 사용할 수 없습니다.');}catch(e){if(e instanceof Error&&e.message.includes('Service role'))throw e;}}
 return {url,key};
}
