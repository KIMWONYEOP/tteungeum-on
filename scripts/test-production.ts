import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
async function main(){
 const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:'',APP_DATA_MODE:'mock'};
 const server=spawn('npm',['start','--','--port','3200'],{env,stdio:'ignore',detached:true});
 let browser;
 try{
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://localhost:3200/login');if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,'Production server readiness');
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage();await page.goto('http://localhost:3200/login');
  await page.locator('.error').waitFor();assert.match(await page.locator('.error').innerText(),/Supabase 설정/);
  assert.equal(await page.getByRole('button',{name:'본사 데모 로그인'}).count(),0);assert.equal(await page.getByRole('button',{name:'점주 데모 로그인'}).count(),0);
  await page.goto('http://localhost:3200/hq');await page.waitForURL('**/login');
  await page.goto('http://localhost:3200/store');await page.waitForURL('**/login');
  const response=await fetch('http://localhost:3200/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'product',product:{id:'fake'}})});assert.notEqual(response.status,200);
  console.log('PASS Production has no demo fallback, clear configuration error, protected route redirects, and blocked writes without configuration.');
 }finally{await browser?.close();if(server.pid)try{process.kill(-server.pid,'SIGTERM');}catch{server.kill('SIGTERM');}}
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
