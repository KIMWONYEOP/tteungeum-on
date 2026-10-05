'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { AppShell } from './shell';
import { Dashboard } from './dashboard';
import { SalesScreen } from './sales';
import { ProductsScreen } from './products';
import { InventoryDetail, InventoryScreen } from './inventory';
import { ReorderScreen } from './reorder';
import { NewOrderScreen, OrderDetail, OrdersScreen } from './orders';
import { SettlementsScreen } from './settlements';
import { AiScreen } from './ai';
import { NoticesScreen, NotificationsScreen, SupportScreen } from './communication';
import { HelpScreen, MoreScreen, SettingsScreen, StoresScreen } from './misc';
import { EmptyState, Skeleton } from './ui';
function Screen({area,segments}:{area:'hq'|'store';segments:string[]}){
 const hq=area==='hq',page=segments[0]||'',detail=segments[1];
 if(segments.length>2)return <EmptyState title="페이지를 찾을 수 없습니다."/>;
 if(detail&&page!=='inventory'&&page!=='orders')return <EmptyState title="페이지를 찾을 수 없습니다."/>;
 switch(page){
  case '':return <Dashboard hq={hq}/>;
  case 'sales':return <SalesScreen hq={hq}/>;
  case 'stores':if(hq)return <StoresScreen/>;break;
  case 'products':if(hq)return <ProductsScreen/>;break;
  case 'inventory':return detail?<InventoryDetail key={detail} productId={detail} hq={hq}/>:<InventoryScreen hq={hq}/>;
  case 'reorder':if(!hq)return <ReorderScreen/>;break;
  case 'orders':return detail?(detail==='new'&&!hq?<NewOrderScreen/>:<OrderDetail key={detail} orderId={detail} hq={hq}/>):<OrdersScreen hq={hq}/>;
  case 'settlements':return <SettlementsScreen hq={hq}/>;
  case 'ai':if(!hq)return <AiScreen/>;break;
  case 'notices':return <NoticesScreen hq={hq}/>;
  case 'support':return <SupportScreen hq={hq}/>;
  case 'notifications':if(!hq)return <NotificationsScreen/>;break;
  case 'more':if(!hq)return <MoreScreen/>;break;
  case 'settings':if(!hq)return <SettingsScreen/>;break;
  case 'help':if(!hq)return <HelpScreen/>;break;
 }
 return <EmptyState title="페이지를 찾을 수 없습니다." action={<Link className="button" href={`/${area}`}>홈으로</Link>}/>;
}
export function Workspace({area,segments}:{area:'hq'|'store';segments:string[]}){return <AppShell area={area}><Suspense fallback={<Skeleton/>}><Screen key={segments.join('/')} area={area} segments={segments}/></Suspense></AppShell>;}
