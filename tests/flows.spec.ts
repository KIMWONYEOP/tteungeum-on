import { expect, test, type Page } from '@playwright/test';
async function demoLogin(page:Page,kind:'점주'|'본사'){await page.goto('/login');await page.getByRole('button',{name:`${kind} 데모 로그인`}).click();await expect(page).toHaveURL(kind==='점주'?/\/store$/:/\/hq$/);await expect(page.locator('main h1')).toBeVisible();}
async function logout(page:Page){await page.goto('/store/more');await page.getByRole('button',{name:'로그아웃',exact:true}).last().click();await expect(page).toHaveURL(/\/login$/);}

test('점주 재고 → 추천 → 수량수정 → 신청 → 본사 승인 → 배송완료 및 재고입고',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await demoLogin(page,'점주');await page.locator('.panel').filter({has:page.getByRole('heading',{name:'재고위험',exact:true})}).getByRole('link',{name:'전체 보기',exact:true}).click();await page.locator('.inventory-card').filter({hasText:'아이스 아메리카노'}).click();
 await expect(page.locator('main h1')).toHaveText('아이스 아메리카노');await page.getByRole('link',{name:'발주하기',exact:true}).click();
 const card=page.locator('.reorder-card').filter({hasText:'아이스 아메리카노'});const input=card.getByRole('spinbutton');const recommended=Number(await input.inputValue());await card.getByRole('button',{name:'아이스 아메리카노 수량 증가',exact:true}).click();expect(Number(await input.inputValue())).toBe(recommended+1);
 await card.getByRole('button',{name:'발주담기',exact:true}).click();await page.getByRole('link',{name:/발주서 만들기/}).click();await page.getByRole('textbox',{name:'요청사항'}).fill('E2E 입고 확인');await page.getByRole('button',{name:'발주 신청',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('발주를 신청하시겠습니까?');await page.getByRole('button',{name:'확인',exact:true}).click();
 await expect(page).toHaveURL(/\/store\/orders$/);const latest=page.locator('.order-card').first();await expect(latest).toContainText('승인대기');const href=await latest.getAttribute('href');const orderId=href!.split('/').pop()!;await page.reload();await expect(page.locator('.order-card').first()).toContainText('승인대기');
 await logout(page);await demoLogin(page,'본사');await page.getByRole('link',{name:/발주대기 .*확인/}).click();await page.goto(`/hq/orders/${orderId}`);await expect(page.locator('main')).toContainText('E2E 입고 확인');
 for(const label of ['승인','준비중','출고','배송완료']){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'확인',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
 await expect(page.locator('main .badge')).toHaveText('배송완료');await expect(page.getByRole('button',{name:'승인',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();await demoLogin(page,'점주');await page.goto('/store/inventory/product-1');await expect(page.locator('.kpi').first()).toContainText(`${recommended+1}개`);await expect(page.locator('main')).toContainText('배송완료 입고');await page.goto(`/store/orders/${orderId}`);await expect(page.locator('main .badge')).toHaveText('배송완료');expect(errors).toEqual([]);
});

test('상품 등록·수정, 재고조정, 공지 읽음, 문의 접수·답변, AI 안내',async({page})=>{
 await demoLogin(page,'본사');await page.goto('/hq/products');await page.getByRole('button',{name:'+ 상품등록',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('SKU',{exact:true}).fill('TEST-001');await dialog.getByLabel('상품명',{exact:true}).fill('테스트 상품');await dialog.getByLabel('공급가',{exact:true}).fill('1000');await dialog.getByLabel('판매가',{exact:true}).fill('2000');await dialog.getByRole('button',{name:'상품 저장',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('searchbox').fill('테스트 상품');await page.getByRole('button',{name:'테스트 상품',exact:true}).filter({visible:true}).click();await dialog.getByLabel('판매가',{exact:true}).fill('2500');await dialog.getByRole('button',{name:'상품 저장',exact:true}).click();await expect(page.locator('main')).toContainText('2,500');
 await page.getByRole('button',{name:'로그아웃',exact:true}).click();await demoLogin(page,'점주');await page.goto('/store/inventory/product-2');await page.getByLabel('조정 수량',{exact:false}).fill('3');await page.getByLabel('조정 사유').fill('실사 반영');await page.getByRole('button',{name:'재고조정 저장'}).click();await expect(page.getByRole('status')).toHaveText('재고가 조정되었습니다.');await expect(page.locator('.kpi').first()).toContainText('9개');
 await page.goto('/store/notices');await page.locator('.notice-row').first().click();await page.getByRole('button',{name:'닫기',exact:true}).click();await expect(page.locator('.notice-row').first()).toContainText('읽음');
 await page.goto('/store/support');await page.getByRole('button',{name:'+ 문의하기',exact:true}).click();await dialog.getByLabel('제목').fill('E2E 배송 문의');await dialog.getByLabel('내용').fill('배송 일정을 확인해 주세요.');await dialog.getByRole('button',{name:'문의 접수'}).click();await expect(page.locator('main')).toContainText('E2E 배송 문의');
 await page.goto('/store/ai');await page.getByRole('textbox',{name:'운영 질문'}).fill('오늘 뭐 발주해야 해?');await page.getByRole('button',{name:'질문 확인'}).click();await expect(page.locator('.assistant-answer')).toContainText('발주를 추천해요');await page.getByRole('link',{name:'추천발주 보기',exact:true}).click();await expect(page).toHaveURL(/\/store\/reorder$/);
 await logout(page);await demoLogin(page,'본사');await page.goto('/hq/support');await page.getByRole('button',{name:'E2E 배송 문의',exact:true}).filter({visible:true}).click();await dialog.getByLabel('처리 상태').selectOption('답변완료');await dialog.getByLabel('답변',{exact:true}).fill('내일 오전에 배송됩니다.');await dialog.getByRole('button',{name:'답변 저장'}).click();await expect(page.locator('main')).toContainText('답변완료');
});

for(const width of [375,768,1440])test(`${width}px 전체 화면·권한·반응형 검사`,async({page})=>{
 await page.setViewportSize({width,height:900});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await demoLogin(page,'점주');
 for(const route of ['', 'sales','inventory','inventory/product-1','reorder','orders/new','orders','orders/order-1','settlements','ai','notices','support','notifications','more','settings','help']){
  await page.goto(`/store${route?`/${route}`:''}`);await expect(page.locator('main h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),route).toBeTruthy();
  if(width===375){await expect(page.locator('.mobile-nav')).toBeVisible();if(route==='sales') {await expect(page.locator('.desktop-table')).toBeHidden();await expect(page.locator('.mobile-cards')).toBeVisible();}}
 }
 await page.goto('/store');await page.screenshot({path:`test-results/store-${width}.png`,fullPage:true});
 await page.goto('/hq');await expect(page).toHaveURL(/\/store$/);await logout(page);await demoLogin(page,'본사');
 for(const route of ['', 'stores','sales','products','inventory','orders','orders/order-1','settlements','notices','support']){await page.goto(`/hq${route?`/${route}`:''}`);await expect(page.locator('main h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),route).toBeTruthy();}
 await page.goto('/hq');await page.screenshot({path:`test-results/hq-${width}.png`,fullPage:true});expect(errors).toEqual([]);
});

test('이메일 로그인·로그인 유지·로그아웃과 매출·재고 필터',async({page})=>{
 await page.goto('/login');await page.getByLabel('이메일',{exact:true}).fill('owner@tteungeum.demo');await page.getByLabel('비밀번호',{exact:true}).fill('incorrect');await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page.locator('.error[role=alert]')).toContainText('비밀번호를 확인');
 await page.getByLabel('비밀번호',{exact:true}).fill('Demo1234!');await page.getByRole('checkbox',{name:'로그인 상태 유지'}).uncheck();await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page).toHaveURL(/\/store$/);
 expect(await page.evaluate(()=>localStorage.getItem('tteungeum-on-v1-session'))).toBeNull();expect(await page.evaluate(()=>sessionStorage.getItem('tteungeum-on-v1-session'))).not.toBeNull();await page.reload();await expect(page.locator('main h1')).toHaveText('우리 매장, 오늘도 ON');
 await page.goto('/store/sales');const todayTotal=await page.locator('.kpi').first().innerText();await page.getByRole('button',{name:'30일',exact:true}).click();await expect(page.locator('.kpi').first()).not.toHaveText(todayTotal);await expect(page.getByRole('button',{name:'30일',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.goto('/store/inventory');await page.getByRole('button',{name:'품절',exact:true}).click();await expect(page.locator('.inventory-card')).toHaveCount(1);await page.getByRole('searchbox').fill('없는 상품');await expect(page.locator('.empty')).toBeVisible();
 await logout(page);expect(await page.evaluate(()=>sessionStorage.getItem('tteungeum-on-v1-session'))).toBeNull();await page.goto('/store/orders');await expect(page).toHaveURL(/\/login$/);
});
