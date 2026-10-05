import type { Category, DemoState, OrderStatus, TicketCategory } from '@/types/domain';
import { monthKey, shiftDate, today } from '@/lib/calculations';

export const categories: Category[] = ['커피', '음료', '디저트', '스낵', '뜬금이 굿즈', '시즌상품', '소모품'];
export const ticketCategories: TicketCategory[] = ['발주', '배송', '상품', '정산', '장비', '운영', '기타'];
const catalog: [string, Category, number][] = [
  ['아이스 아메리카노','커피',3500],['카페 라떼','커피',4500],['바닐라 라떼','커피',5000],['콜드브루','커피',4800],['디카페인 커피','커피',4000],
  ['복숭아 아이스티','음료',4000],['레몬 에이드','음료',5000],['딸기 라떼','음료',5500],['초코 라떼','음료',4500],['말차 라떼','음료',5500],
  ['버터 크루아상','디저트',3800],['초코 쿠키','디저트',2500],['치즈 케이크','디저트',6500],['소금빵','디저트',3000],['휘낭시에','디저트',2800],
  ['감자칩','스낵',2200],['카라멜 팝콘','스낵',3500],['믹스넛','스낵',3000],['쌀과자','스낵',1800],
  ['뜬금이 키링','뜬금이 굿즈',8000],['뜬금이 머그','뜬금이 굿즈',12000],['뜬금이 스티커','뜬금이 굿즈',2000],['뜬금이 에코백','뜬금이 굿즈',15000],
  ['가을 밤 라떼','시즌상품',6000],['단호박 케이크','시즌상품',6800],['시즌 선물세트','시즌상품',25000],
  ['테이크아웃 컵','소모품',300],['컵 뚜껑','소모품',100],['종이 빨대','소모품',100],['냅킨','소모품',50],['컵 홀더','소모품',100],['쇼핑백','소모품',500],
];
export function createMockState(): DemoState {
  const anchor = today();
  const state: DemoState = { version: 1, generatedOn: anchor, profiles: [
    { id:'profile-hq',email:'hq@tteungeum.demo',name:'김본사',role:'HQ_MANAGER' },
    { id:'profile-owner',email:'owner@tteungeum.demo',name:'김점주',role:'STORE_OWNER' },
  ], stores: [
    {id:'store-1',name:'뜬금상점 직영 1호점',type:'직영',owner:'김점주',address:'서울시 성동구 성수동',active:true},
    {id:'store-2',name:'뜬금상점 연남점',type:'가맹',owner:'박연남',address:'서울시 마포구 연남동',active:true},
    {id:'store-3',name:'뜬금상점 수원점',type:'가맹',owner:'이수원',address:'경기도 수원시 영통구',active:true},
    {id:'store-4',name:'뜬금상점 부산점',type:'가맹',owner:'정부산',address:'부산시 부산진구 전포동',active:true},
    {id:'store-5',name:'뜬금상점 대전점',type:'가맹',owner:'최대전',address:'대전시 유성구 봉명동',active:true},
  ],storeMembers:[{id:'member-1',storeId:'store-1',profileId:'profile-owner',role:'STORE_OWNER'}],suppliers:[{id:'supplier-1',name:'뜬금상점 본사 물류',leadTimeDays:3}],
    products:[], inventory:[], inventoryTransactions:[], sales:[], saleItems:[], orders:[], orderItems:[], settlements:[], settlementItems:[], notices:[], tickets:[], notifications:[],auditLogs:[],noticeReads:[],carts:{} };
  state.products = catalog.map(([name,category,price],i) => ({id:`product-${i+1}`,sku:`TT-${String(i+1).padStart(4,'0')}`,name,category,cost:Math.round(price*.25/10)*10,supplyPrice:Math.round(price*.45/10)*10,price,safetyStock:category==='소모품'?50:12,recommendedStock:category==='소모품'?200:80,status:'판매중',supplierId:'supplier-1',leadTimeDays:3}));
  for (const [si,store] of state.stores.entries()) {
    for (const [pi,p] of state.products.entries()) {
      const stock = pi < 4 ? [0,6,14,18][pi] : 180 + pi * 3;
      state.inventory.push({id:`inv-${store.id}-${p.id}`,storeId:store.id,productId:p.id,currentStock:stock});
      state.inventoryTransactions.push({id:`tx-${store.id}-${p.id}`,storeId:store.id,productId:p.id,quantity:stock,before:0,after:stock,reason:'초기 재고 입고',createdAt:`${shiftDate(anchor,-20)}T09:00:00+09:00`});
    }
    // 60일을 보관하여 최근 30일과 그 이전 기간을 비교할 수 있습니다.
    for (let day=-59;day<=0;day++) {
      const date=shiftDate(anchor,day);
      for (const hour of [9,11,13,15,17,19]) {
        const id=`sale-${store.id}-${date}-${hour}`;
        let total=0,quantity=0;
        for (let pi=0;pi<26;pi++) {
          const p=state.products[pi];
          const q=pi<5 ? 2+((day+60+hour+pi+si)%4) : ((pi+hour+day+60+si)%5===0?1:0);
          if (!q) continue;
          state.saleItems.push({id:`item-${id}-${p.id}`,saleId:id,productId:p.id,quantity:q,unitPrice:p.price});
          total+=q*p.price; quantity+=q;
        }
        state.sales.push({id,storeId:store.id,date,hour,total,orderCount:Math.ceil(quantity/1.6)});
      }
    }
    for (let month=0;month>-3;month--) {
      const key=monthKey(month,anchor),id=`settlement-${store.id}-${key}`;
      state.settlements.push({id,storeId:store.id,month:key,status:month===0?'정산중':month===-1?'확정':'지급완료'});
      const total=state.sales.filter(s=>s.storeId===store.id&&s.date.startsWith(key)).reduce((n,s)=>n+s.total,0) || 15000000+si*850000;
      const amounts={총매출:total,상품매입:Math.round(total*.15),본사공급금액:Math.round(total*.2),월회비:150000,기타비용:50000,조정금액:10000};
      Object.entries(amounts).forEach(([kind,amount])=>state.settlementItems.push({id:`${id}-${kind}`,settlementId:id,kind:kind as typeof state.settlementItems[number]['kind'],amount}));
    }
  }
  const statuses: OrderStatus[]=['REQUESTED','REQUESTED','APPROVED','PREPARING','SHIPPED','DELIVERED','DELIVERED','CANCELLED'];
  statuses.forEach((status,i)=>{
    const id=`order-${i+1}`, product=state.products[10+i],quantity=12+i*2,supplyAmount=product.supplyPrice*quantity,vat=Math.round(supplyAmount*.1);
    state.orders.push({id,number:`PO-${anchor.replaceAll('-','')}-${String(i+1).padStart(3,'0')}`,storeId:state.stores[i%5].id,createdAt:`${shiftDate(anchor,-i)}T10:00:00+09:00`,status,note:i===0?'오전 입고 부탁드립니다.':'',supplyAmount,vat,total:supplyAmount+vat});
    state.orderItems.push({id:`oi-${i}`,orderId:id,productId:product.id,quantity,unitPrice:product.supplyPrice});
  });
  state.notices=[
    {id:'notice-1',title:'가을 시즌 상품 판매 안내',body:'가을 밤 라떼와 단호박 케이크가 출시되었습니다. 매장별 안전재고를 확인한 뒤 발주해 주세요.',important:true,createdAt:anchor},
    {id:'notice-2',title:'물류 배송 일정 안내',body:'정기 배송은 월요일부터 금요일까지 진행됩니다. 배송 관련 문의는 본사문의의 배송 카테고리를 이용해 주세요.',important:true,createdAt:shiftDate(anchor,-2)},
    {id:'notice-3',title:'뜬금ON 운영 가이드',body:'매출과 재고를 확인하고 자동발주 추천에서 필요한 상품을 담아보세요. 현재 화면은 데모 데이터로 운영됩니다.',important:false,createdAt:shiftDate(anchor,-5)},
  ];
  state.tickets=Array.from({length:5},(_,i)=>({id:`ticket-${i+1}`,storeId:state.stores[i%5].id,title:['배송 시간 확인 요청','발주 수량 변경 문의','시즌상품 보관 방법','월 정산 내역 확인','커피 머신 점검 요청'][i],body:'관련 내용을 확인하고 안내 부탁드립니다.',category:ticketCategories[i],status:(['접수','처리중','답변완료','접수','종료'] as const)[i],answer:i===2?'냉장 보관 후 안내된 소비기한 내 판매해 주세요.':'',createdAt:shiftDate(anchor,-i)}));
  state.notifications=Array.from({length:10},(_,i)=>({id:`notification-${i+1}`,storeId:'store-1',title:['아이스 아메리카노 재고 부족','발주가 승인되었습니다','배송이 시작되었습니다','배송이 완료되었습니다','새로운 본사공지','이번달 정산 안내'][i%6],body:'매장 운영에 필요한 내용을 확인해 주세요.',type:(['재고부족','발주승인','배송시작','배송완료','본사공지','정산'] as const)[i%6],href:['/store/inventory','/store/orders','/store/orders','/store/orders','/store/notices','/store/settlements'][i%6],read:i>5,createdAt:shiftDate(anchor,-i)}));
  return state;
}
