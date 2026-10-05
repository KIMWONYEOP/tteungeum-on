import type { CartItem, DemoState, OrderStatus, Product, Session, SupportTicket } from '@/types/domain';

export type Command =
 | {type:'catalog';kind:'category'|'supplier';name:string;code?:string}
 | {type:'store'; store: import('@/types/domain').Store}
 | {type:'membership'; storeId:string; userId:string; role:import('@/types/domain').Role; active:boolean}
 | {type:'noticeUpdate'; notice:import('@/types/domain').Notice}
 | {type:'generateSettlement'; storeId:string; start:string; end:string; policy:Record<string,number>}
 | {type:'updateSettlement'; id:string; status:string; adjustment:number; memo:string}
 | {type:'suggestOrders'; key:string}

 | { type:'cart'; items:CartItem[] }
 | { type:'submitOrder'; note:string; idempotencyKey?:string; orderType?:'MANUAL'|'AUTO_SUGGESTED' }
 | { type:'orderStatus'; orderId:string; status:OrderStatus }
 | { type:'product'; product:Product }
 | { type:'adjustInventory'; productId:string; quantity:number; reason:string; storeId?:string }
 | { type:'readNotice'; noticeId:string }
 | { type:'readNotification'; notificationId:string }
 | { type:'ticket'; ticket:SupportTicket }
 | { type:'notice'; title:string; body:string; important:boolean };
export interface AppService { load(range?:{start:string;end:string;reportStart?:string;reportEnd?:string}): Promise<DemoState>; login(email:string,password:string,remember:boolean):Promise<Session>; demoLogin(kind:'hq'|'store',remember:boolean):Promise<Session>; session():Promise<Session|null>; logout():Promise<void>; execute(state:DemoState,session:Session,command:Command):Promise<DemoState> }

export const isHq = (session:Session) => ['SUPER_ADMIN','HQ_ADMIN','HQ_MANAGER'].includes(session.profile.role);
export const allowedOrderTransitions = (status:OrderStatus):OrderStatus[] => ({REQUESTED:['APPROVED','CANCELLED','REJECTED'],APPROVED:['PREPARING','CANCELLED'],PREPARING:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED'],DELIVERED:[],CANCELLED:[],DRAFT:['REQUESTED','CANCELLED'],REJECTED:[],PARTIAL_RECEIVED:['DELIVERED']} as Record<OrderStatus,OrderStatus[]>)[status];
