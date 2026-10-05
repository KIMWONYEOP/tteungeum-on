'use client';
import { useState } from 'react';
import { useData } from './provider';
import { ChartCard, DataTable, FilterChip, KpiCard, Money, PageHeader, Panel } from './ui';
import { percentChange, salesSummary, shiftDate, topProducts } from '@/lib/calculations';
export function SalesScreen({hq}:{hq:boolean}){
 const {state,session}=useData(),[period,setPeriod]=useState('오늘'),[store,setStore]=useState('all');const day=state.generatedOn,storeId=hq?(store==='all'?null:store):session.storeId;
 const start=period==='오늘'?day:period==='7일'?shiftDate(day,-6):period==='30일'?shiftDate(day,-29):`${day.slice(0,7)}-01`;
 const count=Math.round((new Date(`${day}T12:00:00Z`).getTime()-new Date(`${start}T12:00:00Z`).getTime())/86400000)+1,previousStart=shiftDate(start,-count),previousEnd=shiftDate(start,-1);
 const current=salesSummary(state,storeId,start,day),previous=salesSummary(state,storeId,previousStart,previousEnd),change=percentChange(current.total,previous.total);
 const points=Array.from({length:count},(_,i)=>{const date=shiftDate(start,i);return {label:date.slice(5),value:salesSummary(state,storeId,date,date).total};}),hours=[9,11,13,15,17,19].map(hour=>({label:`${hour}시`,value:current.sales.filter(s=>s.hour===hour).reduce((n,s)=>n+s.total,0)}));
 return <><PageHeader title="매출관리" description={`${start} ~ ${day} · 이전 동일 일수와 비교합니다.`}/><div className="toolbar"><div className="filters">{['오늘','7일','30일','이번달'].map(p=><FilterChip key={p} active={p===period} onClick={()=>setPeriod(p)}>{p}</FilterChip>)}</div>{hq&&<select aria-label="매장 선택" value={store} onChange={e=>setStore(e.target.value)}><option value="all">전체 매장</option>{state.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}</div><div className="kpi-grid four"><KpiCard label="총매출" value={<Money value={current.total}/>}/><KpiCard label="주문건수" value={`${current.orders}건`}/><KpiCard label="객단가" value={<Money value={current.average}/>}/><KpiCard label="전기간 대비" value={change===null?'비교 불가':`${change>=0?'+':''}${change.toFixed(1)}%`} hint={`${previousStart} ~ ${previousEnd}`} positive={change!==null&&change>=0}/></div><div className="dashboard-grid"><ChartCard title="기간별 매출" points={points}/><ChartCard title="시간대별 매출" points={hours} kind="bar"/></div><Panel title="상품별 판매 TOP"><DataTable rows={topProducts(state,storeId,start,day)} keyOf={r=>r.product.id} columns={[{label:'상품명',render:r=>r.product.name},{label:'카테고리',render:r=>r.product.category},{label:'판매량',render:r=>`${r.quantity}개`},{label:'판매금액',render:r=><Money value={r.amount}/>} ]}/></Panel></>;
}
