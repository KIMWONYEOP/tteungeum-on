import type { Session, DemoState, OrderStatus } from '@/types/domain';
import { createMockState } from '@/data/mock';
import { today } from '@/lib/calculations';
import { isHq, type AppService } from './service';
const DATA_KEY='tteungeum-on-v1-data',SESSION_KEY='tteungeum-on-v1-session';
const id = () => crypto.randomUUID();
const transitions: Record<OrderStatus, OrderStatus[]> = { REQUESTED:['APPROVED','CANCELLED'],APPROVED:['PREPARING','CANCELLED'],PREPARING:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED'],DELIVERED:[],CANCELLED:[],DRAFT:['REQUESTED','CANCELLED'],REJECTED:[],PARTIAL_RECEIVED:['DELIVERED'] };
export const allowedOrderTransitions = (status: OrderStatus) => transitions[status];
function persistSession(session: Session) { localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY); (session.remember?localStorage:sessionStorage).setItem(SESSION_KEY,JSON.stringify(session)); }
export const mockService: AppService = {
  async load() {
    const raw=localStorage.getItem(DATA_KEY);
    if(raw) { try { const parsed=JSON.parse(raw) as DemoState; if(parsed.version===1 && Array.isArray(parsed.products) && parsed.products.length>=30) return parsed; } catch { /* 손상된 데모 저장본만 초기화 */ } }
    const state=createMockState(); localStorage.setItem(DATA_KEY,JSON.stringify(state)); return state;
  },
  async login(email,password,remember) {
    const state=await this.load(); const profile=state.profiles.find(p=>p.email===email.trim());
    if(!profile || password!=='Demo1234!') throw new Error('데모 이메일과 비밀번호를 확인해 주세요.');
    const session={profile,storeId:'store-1',remember};persistSession(session);return session;
  },
  async demoLogin(kind,remember) { return this.login(kind==='hq'?'hq@tteungeum.demo':'owner@tteungeum.demo','Demo1234!',remember); },
  async session() {
    const raw=localStorage.getItem(SESSION_KEY)||sessionStorage.getItem(SESSION_KEY);
    if(!raw)return null;
    try {const session=JSON.parse(raw) as Session;const state=await this.load();const profile=state.profiles.find(p=>p.id===session.profile.id);return profile?{...session,profile}:null;}catch{return null;}
  },
  async logout() {localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);},
  async execute(state,session,command) {
    const next=structuredClone(state),hq=isHq(session),storeId=session.storeId;
    if(!hq && !state.storeMembers.some(m=>m.profileId===session.profile.id && m.storeId===storeId))throw new Error('이 매장에 대한 권한이 없습니다.');
    if(['orderStatus','product','notice'].includes(command.type)&&!hq)throw new Error('본사 관리자 권한이 필요합니다.');
    const positiveInt=(value:number)=>Number.isSafeInteger(value)&&value>0;
    switch(command.type){
      case 'cart': {
        if(command.items.some(i=>!positiveInt(i.quantity)||!state.products.some(p=>p.id===i.productId&&p.status==='판매중')))throw new Error('판매중인 상품과 유효한 수량을 선택해 주세요.');
        if(new Set(command.items.map(i=>i.productId)).size!==command.items.length)throw new Error('중복 상품을 담을 수 없습니다.');
        next.carts[storeId]=command.items;break;
      }
      case 'submitOrder': {
        const cart=state.carts[storeId]||[];if(!cart.length)throw new Error('발주할 상품을 먼저 담아 주세요.');
        const orderId=id();let supplyAmount=0;
        for(const item of cart){const product=state.products.find(p=>p.id===item.productId);if(!product||product.status!=='판매중'||!positiveInt(item.quantity))throw new Error('발주 상품과 수량을 확인해 주세요.');supplyAmount+=product.supplyPrice*item.quantity;next.orderItems.push({id:id(),orderId,productId:item.productId,quantity:item.quantity,unitPrice:product.supplyPrice});}
        const vat=Math.round(supplyAmount*.1);
        next.orders.unshift({id:orderId,number:`PO-${today().replaceAll('-','')}-${orderId.slice(0,8).toUpperCase()}`,storeId,createdAt:new Date().toISOString(),status:'REQUESTED',note:command.note.trim(),supplyAmount,vat,total:supplyAmount+vat});next.carts[storeId]=[];break;
      }
      case 'orderStatus': {
        const order=next.orders.find(o=>o.id===command.orderId);if(!order)throw new Error('발주를 찾을 수 없습니다.');
        if(!transitions[order.status].includes(command.status))throw new Error('허용되지 않는 상태 변경입니다.');
        order.status=command.status;
        if(command.status==='DELIVERED') for(const item of next.orderItems.filter(i=>i.orderId===order.id)){
          const inventory=next.inventory.find(i=>i.storeId===order.storeId&&i.productId===item.productId);if(!inventory)throw new Error('입고할 재고를 찾을 수 없습니다.');
          const before=inventory.currentStock;inventory.currentStock+=item.quantity;next.inventoryTransactions.unshift({id:id(),storeId:order.storeId,productId:item.productId,quantity:item.quantity,before,after:inventory.currentStock,reason:`발주 ${order.number} 배송완료 입고`,createdAt:new Date().toISOString()});
        }
        if(['APPROVED','SHIPPED','DELIVERED'].includes(command.status))next.notifications.unshift({id:id(),storeId:order.storeId,title:`${order.number} ${command.status==='APPROVED'?'발주 승인':command.status==='SHIPPED'?'배송 시작':'배송 완료'}`,body:'발주내역에서 상세 내용을 확인해 주세요.',type:command.status==='APPROVED'?'발주승인':command.status==='SHIPPED'?'배송시작':'배송완료',href:`/store/orders/${order.id}`,read:false,createdAt:today()});break;
      }
      case 'product': {
        const p=command.product;
        if(!p.name.trim()||!p.sku.trim()||[p.cost,p.supplyPrice,p.price,p.safetyStock,p.recommendedStock,p.leadTimeDays].some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('상품 정보와 0 이상의 정수 값을 확인해 주세요.');
        if(p.recommendedStock<p.safetyStock)throw new Error('권장재고는 안전재고 이상이어야 합니다.');
        if(next.products.some(existing=>existing.id!==p.id&&existing.sku===p.sku))throw new Error('이미 사용 중인 SKU입니다.');
        const index=next.products.findIndex(existing=>existing.id===p.id);
        if(index>=0)next.products[index]=p;else{next.products.push(p);for(const store of next.stores)next.inventory.push({id:id(),storeId:store.id,productId:p.id,currentStock:0});}break;
      }
      case 'adjustInventory': {
        const inv=next.inventory.find(i=>i.storeId===storeId&&i.productId===command.productId);
        if(!inv||!Number.isSafeInteger(command.quantity)||inv.currentStock+command.quantity<0||!command.reason.trim())throw new Error('조정 수량과 사유를 확인해 주세요. 재고는 음수가 될 수 없습니다.');
        const before=inv.currentStock;inv.currentStock+=command.quantity;next.inventoryTransactions.unshift({id:id(),storeId,productId:inv.productId,quantity:command.quantity,before,after:inv.currentStock,reason:command.reason.trim(),createdAt:new Date().toISOString()});break;
      }
      case 'readNotice': {const key=`${session.profile.id}:${command.noticeId}`;if(!next.noticeReads.includes(key))next.noticeReads.push(key);break;}
      case 'readNotification': {const n=next.notifications.find(n=>n.id===command.notificationId&&n.storeId===storeId);if(n)n.read=true;break;}
      case 'ticket': {
        const existing=next.tickets.find(t=>t.id===command.ticket.id);
        if(existing&&!hq)throw new Error('문의 답변에는 본사 권한이 필요합니다.');
        if(!command.ticket.title.trim()||!command.ticket.body.trim())throw new Error('문의 제목과 내용을 입력해 주세요.');
        if(existing)Object.assign(existing,{answer:command.ticket.answer,status:command.ticket.status});else next.tickets.unshift({...command.ticket,storeId,status:'접수',answer:''});break;
      }
      case 'notice': {
        if(!command.title.trim()||!command.body.trim())throw new Error('공지 제목과 내용을 입력해 주세요.');
        const noticeId=id();next.notices.unshift({id:noticeId,title:command.title.trim(),body:command.body.trim(),important:command.important,createdAt:today()});
        for(const store of next.stores)next.notifications.unshift({id:id(),storeId:store.id,title:command.title,body:'새로운 본사 공지를 확인해 주세요.',type:'본사공지',href:'/store/notices',read:false,createdAt:today()});break;
      }
    }
    next.auditLogs.unshift({id:id(),actorId:session.profile.id,action:command.type,entityId:'orderId' in command?command.orderId:storeId,createdAt:new Date().toISOString()});
    localStorage.setItem(DATA_KEY,JSON.stringify(next));return next;
  },
};
