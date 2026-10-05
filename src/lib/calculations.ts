import type { DemoState, Product, ReorderResult, InventoryStatus } from '@/types/domain';

export const money = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value);
export const number = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
export function shiftDate(date: string, days: number) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export const monthKey = (offset = 0, anchor = today()) => { const d = new Date(`${anchor}T12:00:00Z`); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + offset); return d.toISOString().slice(0, 7); };
export function calculateReorder(input: { recent14DaySales: number; leadTimeDays: number; safetyStock: number; currentStock: number; outstandingOrderQuantity: number }): ReorderResult {
  for (const value of Object.values(input)) if (!Number.isFinite(value) || value < 0) throw new Error('발주 계산에는 0 이상의 유효한 수가 필요합니다.');
  const averageDailySales = input.recent14DaySales / 14;
  const leadTimeDemand = averageDailySales * input.leadTimeDays;
  const targetStock = leadTimeDemand + input.safetyStock;
  return { averageDailySales, leadTimeDemand, targetStock, recommendedOrder: Math.max(0, targetStock - input.currentStock - input.outstandingOrderQuantity), daysUntilStockout: averageDailySales > 0 ? input.currentStock / averageDailySales : null };
}
export function reorderFor(state: DemoState, storeId: string, product: Product) {
  const saleIds = new Set(state.sales.filter(s => s.storeId === storeId && s.date >= shiftDate(state.generatedOn, -13) && s.date <= state.generatedOn).map(s => s.id));
  const recent14DaySales = state.saleItems.filter(i => i.productId === product.id && saleIds.has(i.saleId)).reduce((n, i) => n + i.quantity, 0);
  const currentStock = state.inventory.find(i => i.storeId === storeId && i.productId === product.id)?.currentStock ?? 0;
  const openIds = new Set(state.orders.filter(o => o.storeId === storeId && !['DELIVERED', 'CANCELLED'].includes(o.status)).map(o => o.id));
  const outstandingOrderQuantity = state.orderItems.filter(i => i.productId === product.id && openIds.has(i.orderId)).reduce((n, i) => n + i.quantity, 0);
  const result = calculateReorder({ recent14DaySales, leadTimeDays: product.leadTimeDays, safetyStock: product.safetyStock, currentStock, outstandingOrderQuantity });
  return { ...result, product, currentStock, recent14DaySales, outstandingOrderQuantity, orderQuantity: Math.ceil(result.recommendedOrder), status: inventoryStatus(currentStock, product.safetyStock, result.daysUntilStockout, product.leadTimeDays) };
}
export function inventoryStatus(stock: number, safety: number, days: number | null, lead: number): InventoryStatus {
  if (stock === 0) return '품절';
  if (stock < safety) return '부족';
  if ((days !== null && days <= lead) || stock <= safety * 1.5) return '주의';
  return '정상';
}
export function salesSummary(state: DemoState, storeId: string | null, start: string, end: string) {
  const sales = state.sales.filter(s => (!storeId || s.storeId === storeId) && s.date >= start && s.date <= end);
  const total = sales.reduce((n, s) => n + s.total, 0), orders = sales.reduce((n, s) => n + s.orderCount, 0);
  return { total, orders, average: orders ? total / orders : 0, sales };
}
export const percentChange = (current: number, previous: number) => previous ? ((current - previous) / previous) * 100 : null;
export function topProducts(state: DemoState, storeId: string | null, start: string, end: string) {
  const ids = new Set(salesSummary(state, storeId, start, end).sales.map(s => s.id));
  return state.products.map(product => { const items = state.saleItems.filter(i => i.productId === product.id && ids.has(i.saleId)); return { product, quantity: items.reduce((n, i) => n + i.quantity, 0), amount: items.reduce((n, i) => n + i.quantity * i.unitPrice, 0) }; }).filter(p => p.quantity > 0).sort((a, b) => b.quantity - a.quantity);
}
export function settlementSummary(state: DemoState, id: string) {
  const items = state.settlementItems.filter(i => i.settlementId === id);
  const get = (kind: string) => items.filter(i => i.kind === kind).reduce((n, i) => n + i.amount, 0);
  return { items, total: get('총매출') - get('상품매입') - get('본사공급금액') - get('월회비') - get('기타비용') + get('조정금액') };
}
export const orderLabels = { REQUESTED: '승인대기', APPROVED: '승인완료', PREPARING: '상품준비', SHIPPED: '배송중', DELIVERED: '배송완료', CANCELLED: '취소' } as const;
