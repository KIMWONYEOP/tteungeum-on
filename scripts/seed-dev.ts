import { createClient } from '@supabase/supabase-js';
import { createMockState, categories } from '../src/data/mock';
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,password=process.env.SEED_USER_PASSWORD;
 if(process.env.NODE_ENV==='production'||process.env.VERCEL_ENV==='production'||process.env.ALLOW_DEVELOPMENT_SEED!=='true'||!url||url!==process.env.SUPABASE_DEV_PROJECT_URL)throw new Error('Seed is allowed only for an explicitly designated development project.');
 if(!key||!password||password.length<12)throw new Error('Set the server-only service role key and a development seed password of at least 12 characters securely.');
 let ownerId='';
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),mock=createMockState();
 async function upsert(table:string,rows:object[],onConflict='id'){const {error}=await client.from(table).upsert(rows,{onConflict});if(error)throw new Error(`${table}: ${error.message}`);}
 const uid=(n:number)=>`00000000-0000-4000-a000-${String(n).padStart(12,'0')}`;
 const categoryIds=new Map(categories.map((c,i)=>[c,uid(100+i)]));
 await upsert('categories',categories.map((name,i)=>({id:categoryIds.get(name),name,sort_order:i})));
 await upsert('suppliers',[{id:uid(200),code:'DEV-HQ',name:'개발 본사 물류',lead_time_days:3}]);
 const storeIds=new Map(mock.stores.map((s,i)=>[s.id,uid(300+i)]));
 const productIds=new Map(mock.products.map((p,i)=>[p.id,uid(500+i)]));
 await upsert('stores',mock.stores.map((s,i)=>({id:storeIds.get(s.id),code:`DEV-${i+1}`,name:s.name,owner_name:s.owner,address:s.address,operation_type:s.type==='직영'?'DIRECT':'FRANCHISE',status:'ACTIVE'})));
 await upsert('products',mock.products.map(p=>({id:productIds.get(p.id),sku:`DEV-${p.sku}`,name:p.name,category_id:categoryIds.get(p.category),supplier_id:uid(200),cost_price:p.cost,supply_price:p.supplyPrice,sale_price:p.price,safety_stock:p.safetyStock,reorder_quantity:20,target_stock:p.recommendedStock,inventory_managed:true})));
 // Do not reset existing inventory on repeated seeds. Only insert missing initial stock.
 for(const inv of mock.inventory){const store=storeIds.get(inv.storeId)!,product=productIds.get(inv.productId)!;const {data,error}=await client.from('inventories').select('id').eq('store_id',store).eq('product_id',product).maybeSingle();if(error)throw error;if(!data){const {error:write}=await client.from('inventories').insert({store_id:store,product_id:product,quantity:inv.currentStock});if(write)throw write;}}
 for(const [i,kind] of ['hq','owner'].entries()){
 const email=`${kind}@tteungeum.dev.invalid`;
 // Lookup is paginated, so a large dev project cannot create duplicate accounts.
 let userId:string|undefined;for(let page=1;!userId;page++){const {data,error}=await client.auth.admin.listUsers({page,perPage:1000});if(error)throw error;userId=data.users.find(u=>u.email===email)?.id;if(data.users.length<1000)break;}
 if(!userId){const {data,error}=await client.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:kind==='hq'?'개발 본사':'개발 점주'}});if(error||!data.user)throw error||new Error('User creation failed');userId=data.user.id;}
 await upsert('profiles',[{id:userId,email,name:kind==='hq'?'개발 본사':'개발 점주',role:kind==='hq'?'HQ_ADMIN':'STORE_OWNER',active:true}]);
 if(kind==='owner')ownerId=userId;
 if(kind==='owner')await upsert('store_memberships',[{user_id:userId,store_id:uid(300),store_role:'STORE_OWNER',active:true}],'user_id,store_id');
 console.log(`Development ${kind} account prepared (password omitted).`);
 // Seed uses explicit development data, not production workflows or background auto-orders.
 if(i===0){
  for(const [n,notice] of mock.notices.entries())await upsert('notices',[{id:uid(700+n),title:notice.title,content:notice.body,important:notice.important,published:true,published_at:new Date().toISOString(),created_by:userId}]);
 }
 }
 // Aggregate seed transactions maintain sum(item totals) = sale totals. Hourly fixtures are dev-only.
 for(const [i,sale] of mock.sales.entries()){
 const sid=uid(10000+i),items=mock.saleItems.filter(item=>item.saleId===sale.id);
 await upsert('sales',[{id:sid,store_id:storeIds.get(sale.storeId),sale_number:`DEV-${sale.id}`,sold_at:`${sale.date}T${String(sale.hour).padStart(2,'0')}:00:00+09:00`,subtotal:sale.total,total_amount:sale.total,payment_method:'CARD',idempotency_key:`DEV-${sale.id}`,request_payload:{seed:true},status:'COMPLETED'}]);
 await upsert('sale_items',items.map((item,j)=>({id:uid(100000+i*40+j),sale_id:sid,product_id:productIds.get(item.productId),quantity:item.quantity,unit_price:item.unitPrice,total_amount:item.unitPrice*item.quantity,cost_price:mock.products.find(p=>p.id===item.productId)!.cost})));
 }
 for(const [i,o] of mock.orders.entries()){
 const id=uid(200000+i),mapped=({REQUESTED:'REQUESTED',APPROVED:'APPROVED',PREPARING:'ORDERED',SHIPPED:'SHIPPED',DELIVERED:'RECEIVED',CANCELLED:'CANCELLED'} as Record<string,string>)[o.status];
 await upsert('purchase_orders',[{id,order_number:`DEV-${o.number}`,store_id:storeIds.get(o.storeId),order_type:'MANUAL',status:mapped,supply_amount:o.supplyAmount,tax_amount:o.vat,total_amount:o.total,ordered_at:o.createdAt,idempotency_key:`DEV-${o.id}`,request_payload:{seed:true},memo:o.note}]);
 await upsert('purchase_order_items',mock.orderItems.filter(item=>item.orderId===o.id).map(item=>({id:uid(210000+i),purchase_order_id:id,product_id:productIds.get(item.productId),quantity:item.quantity,received_quantity:mapped==='RECEIVED'?item.quantity:0,unit_cost:item.unitPrice,total_amount:item.quantity*item.unitPrice})));
 }
 for(const [i,s] of mock.settlements.entries()){
 const id=uid(220000+i),items=mock.settlementItems.filter(item=>item.settlementId===s.id),get=(kind:string)=>items.find(item=>item.kind===kind)?.amount||0,start=`${s.month}-01`,end=new Date(Date.UTC(Number(s.month.slice(0,4)),Number(s.month.slice(5,7)),0)).toISOString().slice(0,10),gross=get('총매출'),supply=get('상품매입')+get('본사공급금액'),fee=get('월회비'),other=get('기타비용'),adjustment=get('조정금액');
 await upsert('settlements',[{id,store_id:storeIds.get(s.storeId),period_start:start,period_end:end,gross_sales:gross,supply_cost:supply,franchise_fee:fee,other_fee:other,adjustment_amount:adjustment,net_settlement:gross-supply-fee-other+adjustment,status:s.status==='정산중'?'DRAFT':s.status==='확정'?'CONFIRMED':'PAID',policy:{development_seed:true}}]);
 await upsert('settlement_items',items.map((item,j)=>({id:uid(230000+i*10+j),settlement_id:id,item_type:item.kind,amount:item.amount})));
 }
 for(const [i,t] of mock.tickets.entries())await upsert('inquiries',[{id:uid(240000+i),store_id:storeIds.get(t.storeId),user_id:ownerId,category:t.category,title:t.title,content:t.body,status:({접수:'OPEN',처리중:'IN_PROGRESS',답변완료:'ANSWERED',종료:'CLOSED'} as Record<string,string>)[t.status]||'OPEN',response:t.answer}]);
 for(const [i,n] of mock.notifications.entries())await upsert('notifications',[{id:uid(250000+i),store_id:uid(300),user_id:ownerId,type:n.type,title:n.title,message:n.body,link:n.href,read_at:n.read?new Date().toISOString():null}]);
 console.log('Development seed complete. Never run this against the production project.');
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Seed failed');process.exitCode=1;});
