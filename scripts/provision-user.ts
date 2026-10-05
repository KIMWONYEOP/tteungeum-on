// Explicit server-only administrative tool. Never imported by application code.
import { createClient } from '@supabase/supabase-js';
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,email=process.env.PROVISION_EMAIL,role=process.env.PROVISION_ROLE,password=process.env.PROVISION_PASSWORD;
 if(!url||!key||!email||!role||!['SUPER_ADMIN','HQ_ADMIN','STORE_OWNER','STORE_MANAGER','STAFF'].includes(role))throw new Error('Securely set URL, server admin key, PROVISION_EMAIL and PROVISION_ROLE.');
 if(process.env.ALLOW_USER_PROVISION!=='true')throw new Error('Explicitly set ALLOW_USER_PROVISION=true for this one-time administrator operation.');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let id:string|undefined;
 for(let page=1;!id;page++){const {data,error}=await client.auth.admin.listUsers({page,perPage:1000});if(error)throw error;id=data.users.find(u=>u.email===email)?.id;if(data.users.length<1000)break;}
 if(!id){if(!password||password.length<12)throw new Error('New accounts require a securely supplied password of at least 12 characters.');const {data,error}=await client.auth.admin.createUser({email,password,email_confirm:true});if(error||!data.user)throw error||new Error('Provision failed');id=data.user.id;}
 const {error}=await client.from('profiles').update({role,active:true}).eq('id',id);if(error)throw error;
 console.log('Account role provisioned. No secret or password printed. Assign a store membership through HQ store management.');
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Provision failed');process.exitCode=1;});
