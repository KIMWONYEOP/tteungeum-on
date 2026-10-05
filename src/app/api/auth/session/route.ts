import { authenticated, HttpError } from '@/server/auth';
import { respond } from '@/server/http';
export async function GET(){return respond(async()=>{try{return {session:(await authenticated()).session};}catch(e){if(e instanceof HttpError&&e.status===401)return {session:null};throw e;}});}
