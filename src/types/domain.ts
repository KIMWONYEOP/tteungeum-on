export type Role = 'SUPER_ADMIN' | 'HQ_MANAGER' | 'HQ_ADMIN' | 'STORE_OWNER' | 'STORE_MANAGER' | 'STAFF';
export type Category = '커피' | '음료' | '디저트' | '스낵' | '뜬금이 굿즈' | '시즌상품' | '소모품';
export type OrderStatus = 'REQUESTED' | 'APPROVED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'DRAFT' | 'REJECTED' | 'PARTIAL_RECEIVED';
export type InventoryStatus = '정상' | '주의' | '부족' | '품절';
export interface Profile { id: string; email: string; name: string; role: Role }
export interface Store { id: string; name: string; type: '직영' | '가맹'; owner: string; address: string; active: boolean; code?: string; businessNumber?: string; phone?: string; addressDetail?: string; openedAt?: string; status?: string }
export interface StoreMember { id: string; storeId: string; profileId: string; role: Role }
export interface Supplier { id: string; name: string; leadTimeDays: number }
export interface Product { id: string; sku: string; name: string; category: Category; cost: number; supplyPrice: number; price: number; safetyStock: number; recommendedStock: number; status: '판매중' | '판매중지'; supplierId: string; leadTimeDays: number; barcode?: string; categoryId?: string; reorderQuantity?: number; inventoryManaged?: boolean; imageUrl?: string; vatType?: 'TAXABLE'|'EXEMPT'; unit?: string }
export interface StoreInventory { id: string; storeId: string; productId: string; currentStock: number; reservedQuantity?: number; outstandingQuantity?: number; suggestedQuantity?: number; safetyStock?: number; reorderQuantity?: number }
export interface InventoryTransaction { id: string; storeId: string; productId: string; quantity: number; before: number; after: number; reason: string; createdAt: string }
export interface Sale { id: string; storeId: string; date: string; hour: number; orderCount: number; total: number }
export interface SaleItem { id: string; saleId: string; productId: string; quantity: number; unitPrice: number; total?: number }
export interface PurchaseOrderItem { id: string; orderId: string; productId: string; quantity: number; unitPrice: number }
export interface PurchaseOrder { id: string; number: string; storeId: string; createdAt: string; status: OrderStatus; note: string; supplyAmount: number; vat: number; total: number }
export interface Settlement { id: string; storeId: string; month: string; status: '정산중' | '확정' | '지급완료' | '지급예정' | '취소'; dbStatus?: string; periodStart?: string; periodEnd?: string; policy?: Record<string,number>; total?: number; adjustment?: number; memo?: string }
export interface SettlementItem { id: string; settlementId: string; kind: '총매출' | '상품매입' | '본사공급금액' | '월회비' | '기타비용' | '조정금액' | '환불' | '할인' | '플랫폼비'; amount: number }
export interface Notice { id: string; title: string; body: string; important: boolean; createdAt: string; published?: boolean }
export type TicketCategory = '발주' | '배송' | '상품' | '정산' | '장비' | '운영' | '기타';
export interface SupportTicket { id: string; storeId: string; title: string; body: string; category: TicketCategory; status: '접수' | '처리중' | '답변완료' | '종료'; answer: string; createdAt: string }
export interface Notification { id: string; storeId: string; title: string; body: string; type: '재고부족' | '발주승인' | '배송시작' | '배송완료' | '본사공지' | '정산' | '자동발주 생성' | '발주 입고' | '새 문의' | '문의 답변' | '정산 확정' | '발주상태'; href: string; read: boolean; createdAt: string }
export interface AuditLog { id: string; actorId: string; action: string; entityId: string; createdAt: string }
export interface Session { profile: Profile; storeId: string; remember: boolean }
export interface CartItem { productId: string; quantity: number }
export interface DemoState {
  reportPeriod?:{start:string;end:string}; productTotals?:{storeId:string;productId:string;quantity:number;amount:number}[]; yesterdayProducts?:{storeId:string;productId:string;quantity:number;amount:number}[]; recentProductSales?:{storeId:string;productId:string;quantity:number}[]; periodHours?:{storeId:string;hour:number;total:number}[]; todayHours?:{storeId:string;hour:number;total:number}[]; production?: boolean; categoryOptions?: {id:string;name:string}[]; version: 1; generatedOn: string; profiles: Profile[]; stores: Store[]; storeMembers: StoreMember[]; suppliers: Supplier[];
  products: Product[]; inventory: StoreInventory[]; inventoryTransactions: InventoryTransaction[]; sales: Sale[]; saleItems: SaleItem[];
  orders: PurchaseOrder[]; orderItems: PurchaseOrderItem[]; settlements: Settlement[]; settlementItems: SettlementItem[];
  notices: Notice[]; tickets: SupportTicket[]; notifications: Notification[]; auditLogs: AuditLog[];
  noticeReads: string[]; carts: Record<string, CartItem[]>;
}
export interface ReorderResult { averageDailySales: number; leadTimeDemand: number; targetStock: number; recommendedOrder: number; daysUntilStockout: number | null }

/** UI compatibility projection; production is derived from authenticated database queries. */
export type WorkspaceState = DemoState;
