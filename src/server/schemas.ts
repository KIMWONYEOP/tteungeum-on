import { z } from 'zod';
const uuid=z.uuid(),int=z.number().int().min(0).max(1000000000),text=z.string().trim().min(1).max(1000);
export const cartItem=z.object({productId:uuid,quantity:z.number().int().min(1).max(99999)});
const product=z.object({id:uuid,sku:text,name:text,category:z.string(),categoryId:uuid.optional(),supplierId:uuid.nullable().optional(),cost:int,supplyPrice:int,price:int,safetyStock:int,recommendedStock:int,leadTimeDays:int,status:z.enum(['판매중','판매중지']),barcode:z.string().max(100).optional(),reorderQuantity:z.number().int().positive().optional(),inventoryManaged:z.boolean().optional(),imageUrl:z.union([z.literal(''),z.url().startsWith('https://')]).optional(),vatType:z.enum(['TAXABLE','EXEMPT']).optional(),unit:z.string().max(20).optional()});
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('catalog'),kind:z.enum(['category','supplier']),name:text,code:text.optional()}),
 z.object({type:z.literal('cart'),items:z.array(cartItem).max(200)}),
 z.object({type:z.literal('submitOrder'),note:z.string().max(1000),idempotencyKey:z.string().min(8).max(128),orderType:z.enum(['MANUAL','AUTO_SUGGESTED']).default('MANUAL')}),
 z.object({type:z.literal('orderStatus'),orderId:uuid,status:z.enum(['APPROVED','PREPARING','SHIPPED','DELIVERED','CANCELLED','REJECTED'])}),
 z.object({type:z.literal('product'),product}),
 z.object({type:z.literal('adjustInventory'),productId:uuid,quantity:z.number().int().min(-1000000).max(1000000).refine(n=>n!==0),reason:text,storeId:uuid.optional()}),
 z.object({type:z.literal('readNotice'),noticeId:uuid}),z.object({type:z.literal('readNotification'),notificationId:uuid}),
 z.object({type:z.literal('ticket'),ticket:z.object({id:uuid,storeId:uuid,title:text,body:text,category:z.enum(['발주','배송','상품','정산','장비','운영','기타']),status:z.enum(['접수','처리중','답변완료','종료']),answer:z.string().max(10000),createdAt:z.string()})}),
 z.object({type:z.literal('notice'),title:text,body:text,important:z.boolean()}),
 z.object({type:z.literal('noticeUpdate'),notice:z.object({id:uuid,title:text,body:text,important:z.boolean(),published:z.boolean(),createdAt:z.string()})}),
 z.object({type:z.literal('store'),store:z.object({id:uuid,code:text,name:text,owner:z.string().max(100),address:z.string().max(500),type:z.enum(['직영','가맹']),active:z.boolean(),businessNumber:z.string().max(30).optional(),phone:z.string().max(30).optional(),addressDetail:z.string().max(300).optional(),openedAt:z.string().optional()})}),
 z.object({type:z.literal('membership'),storeId:uuid,userId:uuid,role:z.enum(['STORE_OWNER','STORE_MANAGER','STAFF']),active:z.boolean()}),
 z.object({type:z.literal('generateSettlement'),storeId:uuid,start:z.iso.date(),end:z.iso.date(),policy:z.object({franchiseFee:int,platformFee:int,otherFee:int,adjustment:z.number().int().min(-1000000000).max(1000000000)})}),
 z.object({type:z.literal('updateSettlement'),id:uuid,status:z.enum(['DRAFT','CONFIRMED','SCHEDULED','PAID','CANCELLED']),adjustment:z.number().int().min(-1000000000).max(1000000000),memo:z.string().max(1000)}),
 z.object({type:z.literal('suggestOrders'),key:z.string().min(8).max(128)})
]);
export const saleSchema=z.object({storeId:uuid,idempotencyKey:z.string().min(8).max(128),externalPosId:z.string().max(128).optional(),soldAt:z.iso.datetime({offset:true}).optional(),paymentMethod:z.enum(['CARD','CASH','TRANSFER','OTHER']).default('CARD'),items:z.array(z.object({productId:uuid,quantity:z.number().int().min(1).max(99999),unitPrice:int.optional(),discountAmount:int.default(0)})).min(1).max(200)});
