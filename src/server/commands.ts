import 'server-only';
import { authenticated, authorizedStore, HttpError } from './auth';
import { dbError } from './http';
import { commandSchema } from './schemas';
import type { z } from 'zod';
export async function applyCommand(command:z.infer<typeof commandSchema>){
 const user=await authenticated(),{client,session}=user;
 const ensureHq=()=>{if(!user.hq)throw new HttpError(403,'본사 권한이 필요합니다.');};
 const rpc=async(name:string,args:Record<string,unknown>)=>{const {data,error}=await client.rpc(name,args);dbError(error);return data;};
 const manage=(kind:string,data:Record<string,unknown>)=>rpc('manage_entity',{p_kind:kind,p_data:data});
 switch(command.type){
 case 'catalog':ensureHq();return manage(command.kind,{name:command.name,code:command.code});
 case 'cart': await authorizedStore(session.storeId,true);return manage('cart',{storeId:session.storeId,items:command.items});
 case 'submitOrder': {
  await authorizedStore(session.storeId,true);
  return rpc('submit_cart',{p_store:session.storeId,p_note:command.note,p_key:command.idempotencyKey,p_type:command.orderType});
 }
 case 'orderStatus':ensureHq();return rpc('change_order_status',{p_order:command.orderId,p_status:({PREPARING:'ORDERED',DELIVERED:'RECEIVED'} as Record<string,string>)[command.status]||command.status});
 case 'product':{
  ensureHq();let categoryId=command.product.categoryId;
  if(!categoryId){const {data,error}=await client.from('categories').select('id').eq('name',command.product.category).maybeSingle();dbError(error);if(!data)throw new HttpError(400,'카테고리를 먼저 등록해 주세요.');categoryId=data.id;}
  return manage('product',{...command.product,categoryId,supplierId:command.product.supplierId||null,reorderQuantity:command.product.reorderQuantity||1,active:command.product.status==='판매중'});
 }
 case 'adjustInventory':{const store=command.storeId||session.storeId;await authorizedStore(store,true);return rpc('adjust_inventory',{p_store:store,p_product:command.productId,p_delta:command.quantity,p_reason:command.reason});}
 case 'readNotice':return manage('readNotice',{id:command.noticeId});
 case 'readNotification':return manage('readNotification',{id:command.notificationId});
 case 'ticket':{
  const {data:existing,error}=await client.from('inquiries').select('id').eq('id',command.ticket.id).maybeSingle();dbError(error);
  if(existing){ensureHq();return manage('ticketReply',{...command.ticket,status:({접수:'OPEN',처리중:'IN_PROGRESS',답변완료:'ANSWERED',종료:'CLOSED'} as const)[command.ticket.status]});}
  await authorizedStore(command.ticket.storeId,true);return manage('ticket',{...command.ticket,storeId:command.ticket.storeId});
 }
 case 'notice':ensureHq();return manage('notice',{...command,published:true});
 case 'noticeUpdate':ensureHq();return manage('noticeUpdate',{...command.notice});
 case 'store':ensureHq();return manage('store',{...command.store,status:command.store.active?'ACTIVE':'INACTIVE',operationType:command.store.type==='직영'?'DIRECT':'FRANCHISE',openedAt:command.store.openedAt||null});
 case 'membership':ensureHq();return manage('membership',{...command});
 case 'generateSettlement':ensureHq();return rpc('generate_settlement',{p_store:command.storeId,p_start:command.start,p_end:command.end,p_policy:command.policy});
 case 'updateSettlement':ensureHq();return rpc('update_settlement',{p_id:command.id,p_status:command.status,p_adjustment:command.adjustment,p_memo:command.memo});
 case 'suggestOrders':await authorizedStore(session.storeId,true);return rpc('suggest_orders',{p_store:session.storeId,p_key:command.key});
 }
}
