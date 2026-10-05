'use client';
import { useState } from 'react';
import { useData } from './provider';
import { ErrorState, Modal } from './ui';
export function CatalogForm({onClose}:{onClose:()=>void}){
 const {execute,busy}=useData(),[category,setCategory]=useState(''),[supplier,setSupplier]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[feedback,setFeedback]=useState('');
 async function save(kind:'category'|'supplier'){setError('');try{await execute({type:'catalog',kind,name:kind==='category'?category:supplier,code:kind==='supplier'?code:undefined});setFeedback('기준정보를 등록했습니다.');setCategory('');setSupplier('');setCode('');}catch(e){setError(e instanceof Error?e.message:'등록 실패');}}
 return <Modal title="상품 기준정보" onClose={onClose}><p className="muted small">실제 운영할 분류와 공급사를 먼저 등록하세요. 데모 데이터는 자동으로 추가되지 않습니다.</p><form className="mt" onSubmit={e=>{e.preventDefault();void save('category');}}><label>새 카테고리<input value={category} onChange={e=>setCategory(e.target.value)} required/></label><button className="button secondary" disabled={busy}>카테고리 등록</button></form><form className="mt" onSubmit={e=>{e.preventDefault();void save('supplier');}}><label>공급사 코드<input value={code} onChange={e=>setCode(e.target.value)} required/></label><label>공급사명<input value={supplier} onChange={e=>setSupplier(e.target.value)} required/></label><button className="button secondary" disabled={busy}>공급사 등록</button></form>{error&&<ErrorState message={error}/>}<p role="status" className="positive mt">{feedback}</p></Modal>;
}
