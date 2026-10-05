// Pure compatibility projection; credentials and clients remain in server-only modules.
import { z } from 'zod';
import type { DemoState, Category, OrderStatus, Role, SettlementItem, SupportTicket, Notification } from '@/types/domain';
import { today } from '@/lib/calculations';
const rowSchema=z.record(z.string(),z.unknown());
type Row=z.infer<typeof rowSchema>;
const str=(r:Row,key:string)=>String(r[key]??'');
const num=(r:Row,key:string)=>{const n=Number(r[key]??0);if(!Number.isFinite(n))throw new Error('유효하지 않은 DB 숫자');return n;};
const flag=(r:Row,key:string)=>r[key]===true;
const orders:Record<string,OrderStatus>={DRAFT:'DRAFT',REQUESTED:'REQUESTED',APPROVED:'APPROVED',ORDERED:'PREPARING',SHIPPED:'SHIPPED',PARTIAL_RECEIVED:'PARTIAL_RECEIVED',RECEIVED:'DELIVERED',REJECTED:'REJECTED',CANCELLED:'CANCELLED'};
const tickets:Record<string,SupportTicket['status']>={OPEN:'접수',IN_PROGRESS:'처리중',ANSWERED:'답변완료',CLOSED:'종료'};
export function projectWorkspace(value:unknown):DemoState{
 const raw=z.record(z.string(),z.array(rowSchema)).parse(value),rows=(key:string)=>raw[key]||[];
 const categories=rows('categories'),products=rows('products'),suppliers=rows('suppliers');
 const categoryName=(id:string)=>str(categories.find(c=>c.id===id)||{},'name') as Category;
 const saleId=(r:Row)=>`${str(r,'store_id')}:${str(r,'date')}:${num(r,'hour')}`;
 const productRows=(key:string)=>rows(key).map(r=>({storeId:str(r,'store_id'),productId:str(r,'product_id'),quantity:num(r,'quantity'),amount:num(r,'total')}));
 const hourRows=(key:string)=>rows(key).map(r=>({storeId:str(r,'store_id'),hour:num(r,'hour'),total:num(r,'total')}));
 return {version:1,production:true,reportPeriod:{start:str(rows('report_period')[0]||{},'start'),end:str(rows('report_period')[0]||{},'end')},productTotals:productRows('product_period'),yesterdayProducts:productRows('product_yesterday'),recentProductSales:productRows('product_recent'),periodHours:hourRows('hours_period'),todayHours:hourRows('hours_today'),generatedOn:today(),categoryOptions:categories.map(r=>({id:str(r,'id'),name:str(r,'name')})),
 profiles:rows('profiles').map(r=>({id:str(r,'id'),email:str(r,'email'),name:str(r,'name'),role:str(r,'role') as Role})),
 stores:rows('stores').map(r=>({id:str(r,'id'),code:str(r,'code'),name:str(r,'name'),owner:str(r,'owner_name'),address:str(r,'address'),type:r.operation_type==='DIRECT'?'직영':'가맹',active:r.status==='ACTIVE',status:str(r,'status'),businessNumber:str(r,'business_number'),phone:str(r,'phone'),addressDetail:str(r,'address_detail'),openedAt:str(r,'opened_at')})),
 storeMembers:rows('memberships').filter(r=>flag(r,'active')).map(r=>({id:str(r,'id'),storeId:str(r,'store_id'),profileId:str(r,'user_id'),role:str(r,'store_role') as Role})),
 suppliers:suppliers.map(r=>({id:str(r,'id'),name:str(r,'name'),leadTimeDays:num(r,'lead_time_days')})),
 products:products.map(r=>({id:str(r,'id'),sku:str(r,'sku'),name:str(r,'name'),category:categoryName(str(r,'category_id')),categoryId:str(r,'category_id'),supplierId:str(r,'supplier_id'),cost:num(r,'cost_price'),supplyPrice:num(r,'supply_price'),price:num(r,'sale_price'),safetyStock:num(r,'safety_stock'),recommendedStock:r.target_stock===null?num(r,'reorder_quantity'):num(r,'target_stock'),reorderQuantity:num(r,'reorder_quantity'),status:flag(r,'active')?'판매중':'판매중지',leadTimeDays:num(suppliers.find(s=>s.id===r.supplier_id)||{},'lead_time_days'),barcode:str(r,'barcode'),inventoryManaged:flag(r,'inventory_managed'),imageUrl:str(r,'image_url'),vatType:str(r,'vat_type') as 'TAXABLE'|'EXEMPT',unit:str(r,'unit')})),
 inventory:rows('inventory').map(r=>{
 const product=products.find(p=>p.id===r.product_id)||{},override=rows('store_products').find(p=>p.store_id===r.store_id&&p.product_id===r.product_id),outstanding=num(rows('outstanding').find(o=>o.store_id===r.store_id&&o.product_id===r.product_id)||{},'quantity');
 const stock=num(r,'quantity'),safety=override?.safety_stock_override===null||!override?num(product,'safety_stock'):num(override,'safety_stock_override');
 const reorder=override?.reorder_quantity_override===null||!override?num(product,'reorder_quantity'):num(override,'reorder_quantity_override');
 return {id:str(r,'id'),storeId:str(r,'store_id'),productId:str(r,'product_id'),currentStock:stock,reservedQuantity:num(r,'reserved_quantity'),outstandingQuantity:outstanding,safetyStock:safety,reorderQuantity:reorder,suggestedQuantity:stock<=safety&&!rows('outstanding').some(o=>o.store_id===r.store_id&&o.product_id===r.product_id)&&flag(product,'active')&&flag(product,'inventory_managed')&&override?.enabled!==false?Math.max(reorder,product.target_stock===null?0:num(product,'target_stock')-stock):0};
 }),
 inventoryTransactions:rows('movements').map(r=>({id:str(r,'id'),storeId:str(r,'store_id'),productId:str(r,'product_id'),quantity:num(r,'quantity'),before:num(r,'quantity_before'),after:num(r,'quantity_after'),reason:str(r,'memo'),createdAt:str(r,'created_at')})),
 sales:rows('sales').map(r=>({id:saleId(r),storeId:str(r,'store_id'),date:str(r,'date'),hour:num(r,'hour'),orderCount:num(r,'order_count'),total:num(r,'total')})),
 saleItems:rows('sale_items').map(r=>({id:`${saleId(r)}:${str(r,'product_id')}`,saleId:saleId(r),productId:str(r,'product_id'),quantity:num(r,'quantity'),unitPrice:num(r,'quantity')?num(r,'total')/num(r,'quantity'):0,total:num(r,'total')})),
 orders:rows('orders').map(r=>({id:str(r,'id'),number:str(r,'order_number'),storeId:str(r,'store_id'),createdAt:str(r,'ordered_at'),status:orders[str(r,'status')],note:str(r,'memo'),supplyAmount:num(r,'supply_amount'),vat:num(r,'tax_amount'),total:num(r,'total_amount')})),
 orderItems:rows('order_items').map(r=>({id:str(r,'id'),orderId:str(r,'purchase_order_id'),productId:str(r,'product_id'),quantity:num(r,'quantity'),unitPrice:num(r,'unit_cost')})),
 settlements:rows('settlements').map(r=>({id:str(r,'id'),storeId:str(r,'store_id'),month:str(r,'period_start').slice(0,7),status:({DRAFT:'정산중',CONFIRMED:'확정',SCHEDULED:'지급예정',PAID:'지급완료',CANCELLED:'취소'} as const)[str(r,'status') as 'DRAFT'],dbStatus:str(r,'status'),periodStart:str(r,'period_start'),periodEnd:str(r,'period_end'),total:num(r,'net_settlement'),adjustment:num(r,'adjustment_amount'),memo:str(r,'memo')})),
 settlementItems:rows('settlement_items').map(r=>({id:str(r,'id'),settlementId:str(r,'settlement_id'),kind:str(r,'item_type') as SettlementItem['kind'],amount:num(r,'amount')})),
 notices:rows('notices').map(r=>({id:str(r,'id'),title:str(r,'title'),body:str(r,'content'),important:flag(r,'important'),published:flag(r,'published'),createdAt:str(r,'created_at').slice(0,10)})),
 tickets:rows('tickets').map(r=>({id:str(r,'id'),storeId:str(r,'store_id'),title:str(r,'title'),body:str(r,'content'),category:str(r,'category') as SupportTicket['category'],status:tickets[str(r,'status')],answer:str(r,'response'),createdAt:str(r,'created_at').slice(0,10)})),
 notifications:rows('notifications').map(r=>({id:str(r,'id'),storeId:str(r,'store_id'),title:str(r,'title'),body:str(r,'message'),type:str(r,'type') as Notification['type'],href:str(r,'link'),read:!!r.read_at,createdAt:str(r,'created_at').slice(0,10)})),
 auditLogs:[],noticeReads:rows('notice_reads').map(r=>`${str(r,'user_id')}:${str(r,'notice_id')}`),carts:Object.fromEntries(rows('carts').map(r=>[str(r,'store_id'),z.array(z.object({productId:z.string(),quantity:z.number().int().positive()})).parse(r.items)]))
 };
}
