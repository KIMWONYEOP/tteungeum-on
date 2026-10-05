import { expect, test } from '@playwright/test';
import { calculateReorder, reorderFor, salesSummary, shiftDate } from '../src/lib/calculations';
import { createMockState } from '../src/data/mock';

test('발주공식은 미입고 수량을 차감하고 정확한 수량을 계산한다',()=>{
 const result=calculateReorder({recent14DaySales:140,leadTimeDays:3,safetyStock:20,currentStock:15,outstandingOrderQuantity:5});
 expect(result).toEqual({averageDailySales:10,leadTimeDemand:30,targetStock:50,recommendedOrder:30,daysUntilStockout:1.5});
 expect(calculateReorder({recent14DaySales:7,leadTimeDays:3,safetyStock:10,currentStock:0,outstandingOrderQuantity:0}).recommendedOrder).toBe(11.5);
});
test('0 판매량, 충분한 재고, 잘못된 입력을 안전하게 처리한다',()=>{
 const zero=calculateReorder({recent14DaySales:0,leadTimeDays:3,safetyStock:10,currentStock:4,outstandingOrderQuantity:0});
 expect(zero.daysUntilStockout).toBeNull();expect(zero.recommendedOrder).toBe(6);
 expect(calculateReorder({recent14DaySales:140,leadTimeDays:3,safetyStock:20,currentStock:100,outstandingOrderQuantity:5}).recommendedOrder).toBe(0);
 expect(()=>calculateReorder({recent14DaySales:-1,leadTimeDays:3,safetyStock:20,currentStock:10,outstandingOrderQuantity:0})).toThrow();
});
test('Mock 자료 수량과 매출·판매항목 합계가 일치한다',()=>{
 const state=createMockState();expect(state.products.length).toBeGreaterThanOrEqual(30);expect(new Set(state.sales.map(s=>s.date)).size).toBe(60);expect(state.orders).toHaveLength(8);expect(state.notices).toHaveLength(3);expect(state.tickets).toHaveLength(5);expect(state.notifications).toHaveLength(10);expect(new Set(state.settlements.map(s=>s.month)).size).toBe(3);
 const totals=new Map<string,number>();for(const i of state.saleItems)totals.set(i.saleId,(totals.get(i.saleId)||0)+i.quantity*i.unitPrice);
 for(const s of state.sales)expect(totals.get(s.id)).toBe(s.total);
 const recs=state.products.filter(p=>reorderFor(state,'store-1',p).orderQuantity>0);expect(recs).toHaveLength(4);
 expect(salesSummary(state,'store-1',shiftDate(state.generatedOn,-29),state.generatedOn).sales).toHaveLength(180);
});
