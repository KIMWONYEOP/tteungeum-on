import type { DemoState } from '@/types/domain';
import { money, number, percentChange, reorderFor, salesSummary, settlementSummary, shiftDate, topProducts } from '@/lib/calculations';
export interface AiAnswer { text:string; details:string[]; href?:string; linkLabel?:string }
export function operatingAssistant(state:DemoState,storeId:string,prompt:string):AiAnswer{
 const day=state.generatedOn,today=salesSummary(state,storeId,day,day),yesterday=salesSummary(state,storeId,shiftDate(day,-1),shiftDate(day,-1));
 const inventory=state.products.filter(p=>p.status==='판매중').map(p=>reorderFor(state,storeId,p)),recommendations=inventory.filter(i=>i.orderQuantity>0);
 if(/발주/.test(prompt))return{text:`현재 ${recommendations.length}개 상품의 발주를 추천해요. 미입고 발주 수량까지 반영했어요.`,details:recommendations.map(r=>`${r.product.name} · ${r.orderQuantity}개 · ${money(r.orderQuantity*r.product.supplyPrice)}`),href:'/store/reorder',linkLabel:'추천발주 보기'};
 if(/재고|부족/.test(prompt))return{text:`확인이 필요한 재고는 ${inventory.filter(i=>i.status!=='정상').length}개예요.`,details:inventory.filter(i=>i.status!=='정상').map(i=>`${i.product.name} · ${i.currentStock}개 · ${i.status}`),href:'/store/inventory',linkLabel:'재고 확인'};
 if(/정산/.test(prompt)){const settlement=state.settlements.find(s=>s.storeId===storeId&&s.month===day.slice(0,7));return{text:'이번달 예상 정산은 아래와 같아요. 확정 전에는 금액이 변동될 수 있어요.',details:[settlement?money(settlementSummary(state,settlement.id).total):'이번달 정산 자료가 없습니다.'],href:'/store/settlements',linkLabel:'정산 내역 보기'};}
 if(/TOP|판매|잘 팔/.test(prompt))return{text:'최근 7일 가장 많이 팔린 상품이에요.',details:topProducts(state,storeId,shiftDate(day,-6),day).slice(0,5).map((p,i)=>`${i+1}. ${p.product.name} · ${number(p.quantity)}개`)};
 if(/어제|비교/.test(prompt)){const change=percentChange(today.total,yesterday.total);return{text:'오늘과 어제의 매출을 비교했어요.',details:[`오늘 ${money(today.total)}`,`어제 ${money(yesterday.total)}`,change===null?'어제 매출이 없어 비교할 수 없어요.':`어제 대비 ${change>=0?'+':''}${change.toFixed(1)}%`]};}
 if(/이번달|예상매출/.test(prompt)){const elapsed=Number(day.slice(-2)),days=new Date(Number(day.slice(0,4)),Number(day.slice(5,7)),0).getDate(),month=salesSummary(state,storeId,`${day.slice(0,7)}-01`,day);return{text:'현재 일평균 매출을 기준으로 계산한 예상이에요. 실제 매출과 다를 수 있어요.',details:[`이번달 누적 ${money(month.total)}`,`월말 예상 ${money(month.total/elapsed*days)}`]};}
 if(/이번주|7일/.test(prompt)){const week=salesSummary(state,storeId,shiftDate(day,-6),day);return{text:'최근 7일 운영 실적이에요.',details:[`매출 ${money(week.total)}`,`주문 ${number(week.orders)}건`],href:'/store/sales',linkLabel:'매출 상세 보기'};}
 if(/오늘|매출|브리핑/.test(prompt))return{text:'오늘 매장 운영을 살펴봤어요.',details:[`오늘 매출 ${money(today.total)}`,`주문 ${today.orders}건 · 객단가 ${money(today.average)}`,`추천발주 ${recommendations.length}개 · 재고 확인 ${inventory.filter(i=>i.status!=='정상').length}개`],href:'/store/reorder',linkLabel:'추천발주 보기'};
 return{text:'매장 운영에 대해 물어봐 주세요. 매출, 재고, 발주, 정산을 확인할 수 있어요.',details:['예: 오늘 뭐 발주해야 해?','예: 이번달 예상매출 알려줘'],href:'/store/reorder',linkLabel:'추천발주 보기'};
}
