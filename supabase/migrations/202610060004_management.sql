create function public.manage_entity(p_kind text,p_data jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare eid uuid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());sid uuid:=(p_data->>'storeId')::uuid;uid uuid;begin
 if p_kind in ('category','supplier','store','product','membership','profile','notice','noticeUpdate','ticketReply','settlement') then perform public.require_hq();end if;
 case p_kind
 when 'category' then
 insert into public.categories(name) values(p_data->>'name') returning id into eid;
 when 'supplier' then
 insert into public.suppliers(code,name) values(p_data->>'code',p_data->>'name') returning id into eid;
 when 'store' then
 insert into public.stores(id,code,name,owner_name,business_number,phone,address,address_detail,operation_type,status,opened_at)
 values(eid,p_data->>'code',p_data->>'name',coalesce(p_data->>'owner',''),p_data->>'businessNumber',p_data->>'phone',coalesce(p_data->>'address',''),p_data->>'addressDetail',coalesce(p_data->>'operationType','FRANCHISE'),coalesce(p_data->>'status','ACTIVE'),(p_data->>'openedAt')::date)
 on conflict(id) do update set code=excluded.code,name=excluded.name,owner_name=excluded.owner_name,business_number=excluded.business_number,phone=excluded.phone,address=excluded.address,address_detail=excluded.address_detail,operation_type=excluded.operation_type,status=excluded.status,opened_at=excluded.opened_at;
 insert into public.inventories(store_id,product_id) select eid,id from public.products where inventory_managed on conflict(store_id,product_id) do nothing;
 when 'membership' then
 uid:=(p_data->>'userId')::uuid;
 if not exists(select 1 from public.profiles where id=uid and active and role in ('STORE_OWNER','STORE_MANAGER','STAFF')) then raise exception '활성 점포 계정만 매장에 연결할 수 있습니다.';end if;
 insert into public.store_memberships(user_id,store_id,store_role,active) values(uid,sid,(p_data->>'role')::public.app_role,coalesce((p_data->>'active')::boolean,true)) on conflict(user_id,store_id) do update set store_role=excluded.store_role,active=excluded.active returning id into eid;
 when 'profile' then
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='SUPER_ADMIN') then raise exception '최고관리자 권한이 필요합니다.' using errcode='42501';end if;
 if eid=auth.uid() then raise exception '자기 계정 권한은 변경할 수 없습니다.';end if;
 update public.profiles set role=(p_data->>'role')::public.app_role,active=coalesce((p_data->>'active')::boolean,true) where id=eid;
 when 'product' then
 insert into public.products(id,sku,barcode,name,category_id,supplier_id,cost_price,supply_price,sale_price,safety_stock,reorder_quantity,target_stock,inventory_managed,active,image_url,vat_type,unit)
 values(eid,p_data->>'sku',nullif(p_data->>'barcode',''),p_data->>'name',(p_data->>'categoryId')::uuid,(p_data->>'supplierId')::uuid,(p_data->>'cost')::numeric,(p_data->>'supplyPrice')::numeric,(p_data->>'price')::numeric,(p_data->>'safetyStock')::integer,coalesce((p_data->>'reorderQuantity')::integer,1),(p_data->>'recommendedStock')::integer,coalesce((p_data->>'inventoryManaged')::boolean,true),coalesce((p_data->>'active')::boolean,true),nullif(p_data->>'imageUrl',''),coalesce(p_data->>'vatType','TAXABLE'),coalesce(p_data->>'unit','개'))
 on conflict(id) do update set sku=excluded.sku,barcode=excluded.barcode,name=excluded.name,category_id=excluded.category_id,supplier_id=excluded.supplier_id,cost_price=excluded.cost_price,supply_price=excluded.supply_price,sale_price=excluded.sale_price,safety_stock=excluded.safety_stock,reorder_quantity=excluded.reorder_quantity,target_stock=excluded.target_stock,inventory_managed=excluded.inventory_managed,active=excluded.active,image_url=excluded.image_url,vat_type=excluded.vat_type,unit=excluded.unit;
 insert into public.inventories(store_id,product_id) select id,eid from public.stores where (select inventory_managed from public.products where id=eid) on conflict(store_id,product_id) do nothing;
 when 'cart' then
 perform public.require_store(sid,true);
 if jsonb_array_length(p_data->'items')<>(select count(distinct value->>'productId') from jsonb_array_elements(p_data->'items')) then raise exception '중복 상품 오류';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'items') i where (i->>'quantity')::integer<=0 or not exists(select 1 from public.products where id=(i->>'productId')::uuid and active)) then raise exception '장바구니 상품 또는 수량 오류';end if;
 insert into public.order_carts(user_id,store_id,items) values(auth.uid(),sid,p_data->'items') on conflict(user_id,store_id) do update set items=excluded.items,updated_at=now();
 when 'cartClear' then
 perform public.require_store(sid,true);delete from public.order_carts where user_id=auth.uid() and store_id=sid;
 when 'readNotice' then
 if not exists(select 1 from public.notices where id=eid and (public.is_hq() or (published and target_type in ('ALL','STORE') and public.is_active_user()))) then raise exception '공지 접근 불가' using errcode='42501';end if;
 insert into public.notice_reads(user_id,notice_id) values(auth.uid(),eid) on conflict do nothing;
 when 'readNotification' then
 update public.notifications set read_at=now() where id=eid and user_id=auth.uid() and public.is_active_user();
 when 'notice' then
 insert into public.notices(id,title,content,important,published,published_at,created_by) values(eid,p_data->>'title',p_data->>'body',coalesce((p_data->>'important')::boolean,false),coalesce((p_data->>'published')::boolean,true),now(),auth.uid());
 if coalesce((p_data->>'published')::boolean,true) then insert into public.notifications(user_id,type,title,link) select id,'본사공지',p_data->>'title','/store/notices' from public.profiles where active and role in ('STORE_OWNER','STORE_MANAGER','STAFF');end if;
 when 'noticeUpdate' then
 update public.notices set title=p_data->>'title',content=p_data->>'body',important=coalesce((p_data->>'important')::boolean,false),published=(p_data->>'published')::boolean,published_at=case when (p_data->>'published')::boolean then coalesce(published_at,now()) else published_at end where id=eid;
 when 'ticket' then
 perform public.require_store(sid,true);insert into public.inquiries(id,store_id,user_id,category,title,content) values(eid,sid,auth.uid(),p_data->>'category',p_data->>'title',p_data->>'body');perform public.notify_hq('새 문의',p_data->>'title','/hq/support');
 when 'ticketReply' then
 update public.inquiries set response=p_data->>'answer',status=p_data->>'status',responded_by=auth.uid(),responded_at=now() where id=eid returning store_id into sid;
 if sid is not null then perform public.notify_store(sid,'문의 답변','본사에서 문의에 답변했습니다.','/store/support');end if;
 else raise exception '지원하지 않는 변경 작업';
 end case;return eid;
end$$;
-- Aggregate sales by Korean day; return product/hour totals for the selected report period.
create function public.workspace_snapshot(p_start date default (now() at time zone 'Asia/Seoul')::date-61,p_end date default (now() at time zone 'Asia/Seoul')::date,p_report_start date default (now() at time zone 'Asia/Seoul')::date-6,p_report_end date default (now() at time zone 'Asia/Seoul')::date)
 returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with scoped_sales as (select * from public.sales where sold_at>=p_start::timestamp at time zone 'Asia/Seoul' and sold_at<(p_end+1)::timestamp at time zone 'Asia/Seoul' and status='COMPLETED'),
 grouped_sales as (
 select store_id, (sold_at at time zone 'Asia/Seoul')::date date,-1 as "hour",sum(total_amount) total,count(*) order_count
 from scoped_sales group by 1,2
 ),product_period as (
 select s.store_id,i.product_id,sum(i.quantity) quantity,sum(i.total_amount) total
 from scoped_sales s join public.sale_items i on i.sale_id=s.id
 where (s.sold_at at time zone 'Asia/Seoul')::date between p_report_start and p_report_end group by 1,2
 ),product_recent as (
 select s.store_id,i.product_id,sum(i.quantity) quantity from public.sales s join public.sale_items i on i.sale_id=s.id
 where s.status='COMPLETED' and s.sold_at>=((now() at time zone 'Asia/Seoul')::date-13)::timestamp at time zone 'Asia/Seoul' and s.sold_at<((now() at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul' group by 1,2
 ),product_yesterday as (
 select s.store_id,i.product_id,sum(i.quantity) quantity,sum(i.total_amount) total from public.sales s join public.sale_items i on i.sale_id=s.id
 where s.status='COMPLETED' and (s.sold_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date-1 group by 1,2
 ),hours_period as (
 select store_id,extract(hour from sold_at at time zone 'Asia/Seoul')::integer as "hour",sum(total_amount) total from scoped_sales
 where (sold_at at time zone 'Asia/Seoul')::date between p_report_start and p_report_end group by 1,2
 ),hours_today as (
 select store_id,extract(hour from sold_at at time zone 'Asia/Seoul')::integer as "hour",sum(total_amount) total from scoped_sales
 where (sold_at at time zone 'Asia/Seoul')::date=(now() at time zone 'Asia/Seoul')::date group by 1,2
 ),outstanding as (
 select o.store_id,i.product_id,sum(i.quantity-i.received_quantity) quantity from public.purchase_orders o join public.purchase_order_items i on i.purchase_order_id=o.id
 where o.status in ('DRAFT','REQUESTED','APPROVED','ORDERED','SHIPPED','PARTIAL_RECEIVED') group by 1,2
 )
 select jsonb_build_object(
 'profiles',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.profiles t),
 'stores',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.stores t),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.store_memberships t),
 'categories',(select coalesce(jsonb_agg(to_jsonb(t) order by sort_order),'[]') from public.categories t),
 'suppliers',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.suppliers t),
 'products',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.products t),
 'store_products',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.store_products t),
 'inventory',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.inventories t),
 'movements',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.inventory_movements t),
 'sales',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from grouped_sales t),
 'sale_items','[]'::jsonb,
 'report_period',jsonb_build_array(jsonb_build_object('start',p_report_start,'end',p_report_end)),
 'product_period',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from product_period t),
 'product_recent',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from product_recent t),
 'product_yesterday',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from product_yesterday t),
 'hours_period',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from hours_period t),
 'hours_today',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from hours_today t),
 'outstanding',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from outstanding t),
 'orders',(select coalesce(jsonb_agg(to_jsonb(t) order by ordered_at desc),'[]') from public.purchase_orders t),
 'order_items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.purchase_order_items t),
 'settlements',(select coalesce(jsonb_agg(to_jsonb(t) order by period_start desc),'[]') from public.settlements t),
 'settlement_items',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.settlement_items t),
 'notices',(select coalesce(jsonb_agg(to_jsonb(t) order by created_at desc),'[]') from public.notices t),
 'notice_reads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.notice_reads t),
 'tickets',(select coalesce(jsonb_agg(to_jsonb(t) order by created_at desc),'[]') from public.inquiries t),
 'notifications',(select coalesce(jsonb_agg(to_jsonb(t) order by created_at desc),'[]') from public.notifications t),
 'carts',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.order_carts t)
 )
$$;
-- Restrict all newly introduced RPCs; do not change unrelated existing functions.
do $$declare fn record;begin for fn in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in (
 'is_hq','is_active_user','can_access_store','can_operate_store','require_hq','require_store','handle_new_user','touch_updated_at','capture_audit','notify_store','notify_hq','move_inventory','adjust_inventory','create_sale','cancel_sale','create_order','change_order_status','suggest_orders','generate_settlement','update_settlement','manage_entity','workspace_snapshot','submit_cart'
 ) loop execute format('revoke execute on function %s from public,anon,authenticated',fn.signature);end loop;end$$;
grant execute on function public.is_hq(),public.is_active_user(),public.can_access_store(uuid),public.can_operate_store(uuid) to authenticated;
grant execute on function public.submit_cart(uuid,text,text,text),public.adjust_inventory(uuid,uuid,integer,text),public.create_sale(uuid,jsonb),public.cancel_sale(uuid),public.create_order(uuid,jsonb,text,text,text),public.change_order_status(uuid,public.order_status),public.suggest_orders(uuid,text),public.generate_settlement(uuid,date,date,jsonb),public.update_settlement(uuid,text,numeric,text),public.manage_entity(text,jsonb),public.workspace_snapshot(date,date,date,date) to authenticated;
