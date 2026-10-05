create function public.notify_store(p_store uuid,p_type text,p_title text,p_link text) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 insert into public.notifications(user_id,store_id,type,title,link) select m.user_id,p_store,p_type,p_title,p_link from public.store_memberships m join public.profiles p on p.id=m.user_id where m.store_id=p_store and m.active and p.active;
end$$;
create function public.notify_hq(p_type text,p_title text,p_link text) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 insert into public.notifications(user_id,type,title,link) select id,p_type,p_title,p_link from public.profiles where active and role in ('SUPER_ADMIN','HQ_ADMIN');end$$;
create function public.move_inventory(p_store uuid,p_product uuid,p_delta integer,p_type text,p_ref uuid,p_memo text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare inv public.inventories%rowtype;p public.products%rowtype;safety integer;begin
 select * into p from public.products where id=p_product;if not found then raise exception '상품 없음';end if;
 if not p.inventory_managed then return;end if;
 insert into public.inventories(store_id,product_id) values(p_store,p_product) on conflict(store_id,product_id) do nothing;
 select * into inv from public.inventories where store_id=p_store and product_id=p_product for update;
 if inv.quantity+p_delta<inv.reserved_quantity then raise exception '사용 가능한 재고가 부족합니다.' using errcode='23514';end if;
 update public.inventories set quantity=quantity+p_delta,updated_at=now() where id=inv.id;
 insert into public.inventory_movements(store_id,product_id,movement_type,quantity,quantity_before,quantity_after,reference_type,reference_id,memo,created_by)
 values(p_store,p_product,p_type,p_delta,inv.quantity,inv.quantity+p_delta,p_type,p_ref,p_memo,auth.uid());
 select coalesce(sp.safety_stock_override,p.safety_stock) into safety from (select 1) d left join public.store_products sp on sp.store_id=p_store and sp.product_id=p_product;
 if inv.quantity>safety and inv.quantity+p_delta<=safety then perform public.notify_store(p_store,'재고부족',p.name||' 재고부족','/store/inventory/'||p_product);end if;
end$$;
create function public.adjust_inventory(p_store uuid,p_product uuid,p_delta integer,p_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin
 perform public.require_store(p_store,true);if length(trim(p_reason))=0 or p_delta=0 then raise exception '조정 사유와 0이 아닌 수량이 필요합니다.';end if;
 perform public.move_inventory(p_store,p_product,p_delta,'ADJUSTMENT',null,p_reason);end$$;
create function public.create_sale(p_store uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare sid uuid:=gen_random_uuid();prior public.sales%rowtype;item jsonb;p public.products%rowtype;qty integer;price numeric;discount numeric;subtotal numeric:=0;discount_total numeric:=0;
 begin
 perform public.require_store(p_store,false);
 -- STAFF can register POS sales but cannot approve orders or manually adjust inventory.
 if not public.is_hq() and not exists(select 1 from public.stores where id=p_store and status='ACTIVE') then raise exception '운영중인 매장이 아닙니다.';end if;
 if length(coalesce(p_payload->>'idempotencyKey',''))<8 or coalesce(jsonb_typeof(p_payload->'items'),'null')<>'array' or coalesce(jsonb_array_length(p_payload->'items'),0)<1 then raise exception '멱등성 키와 판매 항목이 필요합니다.';end if;
 -- Serialize per store: protects first creation, overlapping POS keys and stock mutations.
 perform 1 from public.stores where id=p_store for update;
 select * into prior from public.sales where store_id=p_store and (idempotency_key=p_payload->>'idempotencyKey' or external_pos_id=nullif(p_payload->>'externalPosId',''));
 if found then if prior.request_payload<>p_payload then raise exception '동일 키에 다른 매출 요청이 있습니다.' using errcode='23505';end if;return prior.id;end if;
 for item in select value from jsonb_array_elements(p_payload->'items') order by value->>'productId' loop
 select * into p from public.products where id=(item->>'productId')::uuid and active for share;if not found then raise exception '판매중인 상품이 아닙니다.';end if;
 if exists(select 1 from public.store_products where store_id=p_store and product_id=p.id and not enabled) then raise exception '매장 판매가 중지된 상품입니다.';end if;
 qty:=(item->>'quantity')::integer;if qty<=0 then raise exception '판매 수량 오류';end if;
 price:=coalesce((item->>'unitPrice')::numeric,(select sale_price from public.store_products where store_id=p_store and product_id=p.id),p.sale_price);discount:=coalesce((item->>'discountAmount')::numeric,0);
 if price<0 or discount<0 or discount>price*qty then raise exception '매출 금액 오류';end if;
 subtotal:=subtotal+price*qty;discount_total:=discount_total+discount;
 end loop;
 insert into public.sales(id,store_id,sale_number,sold_at,subtotal,discount_amount,tax_amount,total_amount,payment_method,external_pos_id,idempotency_key,request_payload)
 values(sid,p_store,'S-'||replace(sid::text,'-',''),coalesce((p_payload->>'soldAt')::timestamptz,now()),subtotal,discount_total,round((subtotal-discount_total)/11,2),subtotal-discount_total,coalesce(p_payload->>'paymentMethod','CARD'),nullif(p_payload->>'externalPosId',''),p_payload->>'idempotencyKey',p_payload);
 for item in select value from jsonb_array_elements(p_payload->'items') order by value->>'productId' loop
 select * into p from public.products where id=(item->>'productId')::uuid;qty:=(item->>'quantity')::integer;
 price:=coalesce((item->>'unitPrice')::numeric,(select sale_price from public.store_products where store_id=p_store and product_id=p.id),p.sale_price);discount:=coalesce((item->>'discountAmount')::numeric,0);
 insert into public.sale_items(sale_id,product_id,quantity,unit_price,discount_amount,total_amount,cost_price) values(sid,p.id,qty,price,discount,price*qty-discount,p.cost_price);
 perform public.move_inventory(p_store,p.id,-qty,'SALE',sid,'매출 등록');end loop;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,store_id,after_data) values(auth.uid(),'SALE_CREATE','sales',sid,p_store,p_payload);return sid;
end$$;
create function public.cancel_sale(p_sale uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare s public.sales%rowtype;item public.sale_items%rowtype;begin
 select * into s from public.sales where id=p_sale;if not found then raise exception '매출 없음';end if;
 perform public.require_store(s.store_id,true);perform 1 from public.stores where id=s.store_id for update;
 select * into s from public.sales where id=p_sale for update;if s.status='CANCELLED' then return;end if;
 update public.sales set status='CANCELLED' where id=p_sale;
 for item in select * from public.sale_items where sale_id=p_sale order by product_id loop perform public.move_inventory(s.store_id,item.product_id,item.quantity,'SALE_CANCEL',p_sale,'판매 취소');end loop;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,store_id,before_data,after_data) values(auth.uid(),'SALE_CANCEL','sales',p_sale,s.store_id,to_jsonb(s),jsonb_build_object('status','CANCELLED'));end$$;
create function public.create_order(p_store uuid,p_items jsonb,p_note text,p_key text,p_type text default 'MANUAL') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare oid uuid:=gen_random_uuid();prior public.purchase_orders%rowtype;item jsonb;p public.products%rowtype;qty integer;supply numeric:=0;vat numeric:=0;payload jsonb:=jsonb_build_object('items',p_items,'note',p_note,'type',p_type);begin
 perform public.require_store(p_store,true);perform 1 from public.stores where id=p_store for update;
 if p_type not in ('MANUAL','AUTO_SUGGESTED') then raise exception '자동확정 발주는 비활성화 상태입니다.';end if;
 if coalesce(length(p_key),0)<8 or coalesce(jsonb_typeof(p_items),'null')<>'array' or coalesce(jsonb_array_length(p_items),0)=0 then raise exception '발주 항목과 멱등성 키가 필요합니다.';end if;
 select * into prior from public.purchase_orders where store_id=p_store and idempotency_key=p_key;
 if found then if prior.request_payload<>payload then raise exception '동일 키의 발주 내용이 다릅니다.' using errcode='23505';end if;return prior.id;end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct value->>'productId') from jsonb_array_elements(p_items)) then raise exception '중복 상품 오류';end if;
 for item in select value from jsonb_array_elements(p_items) order by value->>'productId' loop
 select * into p from public.products where id=(item->>'productId')::uuid and active for share;if not found then raise exception '판매중인 상품이 아닙니다.';end if;
 qty:=(item->>'quantity')::integer;if qty<=0 then raise exception '발주 수량 오류';end if;
 if p_type='AUTO_SUGGESTED' and exists(select 1 from public.purchase_order_items oi join public.purchase_orders o on o.id=oi.purchase_order_id where o.store_id=p_store and oi.product_id=p.id and o.status in ('DRAFT','REQUESTED','APPROVED','ORDERED','SHIPPED','PARTIAL_RECEIVED')) then raise exception '진행중인 발주가 있어 자동발주 제안을 중복 생성할 수 없습니다.' using errcode='23505';end if;
 supply:=supply+qty*p.supply_price;if p.vat_type='TAXABLE' then vat:=vat+round(qty*p.supply_price*.1,0);end if;
 end loop;
 insert into public.purchase_orders(id,order_number,store_id,order_type,status,supply_amount,tax_amount,total_amount,requested_by,memo,idempotency_key,request_payload)
 values(oid,'PO-'||to_char(now() at time zone 'Asia/Seoul','YYYYMMDD')||'-'||replace(oid::text,'-',''),p_store,p_type,'REQUESTED',supply,vat,supply+vat,auth.uid(),p_note,p_key,payload);
 for item in select value from jsonb_array_elements(p_items) loop select * into p from public.products where id=(item->>'productId')::uuid;
 qty:=(item->>'quantity')::integer;insert into public.purchase_order_items(purchase_order_id,product_id,quantity,unit_cost,total_amount) values(oid,p.id,qty,p.supply_price,qty*p.supply_price);end loop;
 perform public.notify_hq('자동발주 생성',case when p_type='AUTO_SUGGESTED' then '자동발주 제안' else '새 발주 요청' end,'/hq/orders/'||oid);return oid;
end$$;
create function public.change_order_status(p_order uuid,p_status public.order_status) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare o public.purchase_orders%rowtype;item public.purchase_order_items%rowtype;begin
 perform public.require_hq();select * into o from public.purchase_orders where id=p_order;if not found then raise exception '발주 없음';end if;
 perform 1 from public.stores where id=o.store_id for update;select * into o from public.purchase_orders where id=p_order for update;
 if not ((o.status='REQUESTED' and p_status in ('APPROVED','REJECTED','CANCELLED')) or (o.status='APPROVED' and p_status in ('ORDERED','CANCELLED')) or (o.status='ORDERED' and p_status in ('SHIPPED','CANCELLED')) or (o.status in ('SHIPPED','PARTIAL_RECEIVED') and p_status='RECEIVED')) then raise exception '허용되지 않는 상태 변경 또는 중복 입고입니다.' using errcode='23514';end if;
 if p_status='RECEIVED' then for item in select * from public.purchase_order_items where purchase_order_id=p_order order by product_id for update loop
 perform public.move_inventory(o.store_id,item.product_id,item.quantity-item.received_quantity,'PURCHASE_RECEIPT',p_order,'발주 입고');update public.purchase_order_items set received_quantity=quantity where id=item.id;end loop;end if;
 update public.purchase_orders set status=p_status,approved_at=case when p_status='APPROVED' then now() else approved_at end,approved_by=case when p_status='APPROVED' then auth.uid() else approved_by end,shipped_at=case when p_status='SHIPPED' then now() else shipped_at end,received_at=case when p_status='RECEIVED' then now() else received_at end where id=p_order;
 perform public.notify_store(o.store_id,case when p_status='APPROVED' then '발주승인' when p_status='SHIPPED' then '배송시작' when p_status='RECEIVED' then '발주 입고' else '발주상태' end,'발주 상태가 '||p_status||'로 변경되었습니다.','/store/orders/'||p_order);
end$$;
create function public.suggest_orders(p_store uuid,p_key text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare items jsonb;begin
 perform public.require_store(p_store,true);perform 1 from public.stores where id=p_store for update;
 -- Existing idempotency token returns its original suggestion; no duplicate side effects.
 if exists(select 1 from public.purchase_orders where store_id=p_store and idempotency_key=p_key) then return (select id from public.purchase_orders where store_id=p_store and idempotency_key=p_key);end if;
 select jsonb_agg(jsonb_build_object('productId',p.id,'quantity',greatest(coalesce(sp.reorder_quantity_override,p.reorder_quantity),coalesce(p.target_stock,0)-i.quantity))) into items
 from public.inventories i join public.products p on p.id=i.product_id left join public.store_products sp on sp.store_id=i.store_id and sp.product_id=i.product_id
 where i.store_id=p_store and p.active and p.inventory_managed and coalesce(sp.enabled,true) and i.quantity<=coalesce(sp.safety_stock_override,p.safety_stock)
 and not exists(select 1 from public.purchase_order_items oi join public.purchase_orders o on o.id=oi.purchase_order_id where o.store_id=p_store and oi.product_id=p.id and o.status in ('DRAFT','REQUESTED','APPROVED','ORDERED','SHIPPED','PARTIAL_RECEIVED'));
 if items is null then return null;end if;return public.create_order(p_store,items,'자동발주 제안: 승인 전 외부 전송 없음',p_key,'AUTO_SUGGESTED');
end$$;
create function public.generate_settlement(p_store uuid,p_start date,p_end date,p_policy jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare sid uuid:=gen_random_uuid();gross numeric;refund numeric;discount numeric;supply numeric;franchise numeric:=coalesce((p_policy->>'franchiseFee')::numeric,0);platform numeric:=coalesce((p_policy->>'platformFee')::numeric,0);other numeric:=coalesce((p_policy->>'otherFee')::numeric,0);adjustment numeric:=coalesce((p_policy->>'adjustment')::numeric,0);begin
 perform public.require_hq();perform 1 from public.stores where id=p_store for update;if p_end<p_start then raise exception '기간 오류';end if;
 select coalesce(sum(total_amount),0),coalesce(sum(total_amount) filter(where status='CANCELLED'),0),coalesce(sum(discount_amount),0) into gross,refund,discount from public.sales where store_id=p_store and sold_at>=p_start::timestamp at time zone 'Asia/Seoul' and sold_at<(p_end+1)::timestamp at time zone 'Asia/Seoul';
 select coalesce(sum(total_amount),0) into supply from public.purchase_orders where store_id=p_store and status='RECEIVED' and received_at>=p_start::timestamp at time zone 'Asia/Seoul' and received_at<(p_end+1)::timestamp at time zone 'Asia/Seoul';
 insert into public.settlements(id,store_id,period_start,period_end,gross_sales,refund_amount,discount_amount,supply_cost,franchise_fee,platform_fee,other_fee,adjustment_amount,net_settlement,policy)
 values(sid,p_store,p_start,p_end,gross,refund,discount,supply,franchise,platform,other,adjustment,gross-refund-supply-franchise-platform-other+adjustment,p_policy);
 insert into public.settlement_items(settlement_id,item_type,amount) values(sid,'총매출',gross),(sid,'환불',refund),(sid,'할인',discount),(sid,'본사공급금액',supply),(sid,'월회비',franchise),(sid,'플랫폼비',platform),(sid,'기타비용',other),(sid,'조정금액',adjustment);return sid;
end$$;
create function public.update_settlement(p_id uuid,p_status text,p_adjustment numeric,p_memo text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare s public.settlements%rowtype;begin perform public.require_hq();select * into s from public.settlements where id=p_id for update;if not found then raise exception '정산 없음';end if;
 if s.status in ('PAID','CANCELLED') then raise exception '완료 정산 변경 불가';end if;
 if not (p_status=s.status or (s.status='DRAFT' and p_status in ('CONFIRMED','CANCELLED')) or (s.status='CONFIRMED' and p_status in ('SCHEDULED','CANCELLED')) or (s.status='SCHEDULED' and p_status in ('PAID','CANCELLED'))) then raise exception '정산 상태 변경 오류';end if;
 update public.settlements set status=p_status,adjustment_amount=p_adjustment,net_settlement=gross_sales-refund_amount-supply_cost-franchise_fee-platform_fee-other_fee+p_adjustment,memo=p_memo,paid_at=case when p_status='PAID' then now() else paid_at end where id=p_id;
 update public.settlement_items set amount=p_adjustment where settlement_id=p_id and item_type='조정금액';
 if p_status='CONFIRMED' then perform public.notify_store(s.store_id,'정산 확정','정산이 확정되었습니다.','/store/settlements');end if;end$$;
-- Cart checkout and clearing happen in the same transaction, with stable retries.
create function public.submit_cart(p_store uuid,p_note text,p_key text,p_type text default 'MANUAL') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare existing public.purchase_orders%rowtype;items jsonb;oid uuid;begin
 perform public.require_store(p_store,true);perform 1 from public.stores where id=p_store for update;
 select * into existing from public.purchase_orders where store_id=p_store and idempotency_key=p_key;
 if found then if existing.requested_by<>auth.uid() or existing.memo<>p_note or existing.order_type<>p_type then raise exception '발주 재시도 내용 불일치' using errcode='23505';end if;return existing.id;end if;
 select c.items into items from public.order_carts c where c.store_id=p_store and c.user_id=auth.uid() for update;
 if items is null or jsonb_array_length(items)=0 then raise exception '발주할 상품이 없습니다.';end if;
 oid:=public.create_order(p_store,items,p_note,p_key,p_type);delete from public.order_carts where store_id=p_store and user_id=auth.uid();return oid;
end$$;

do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('notify_store','notify_hq','move_inventory','adjust_inventory','create_sale','cancel_sale','create_order','change_order_status','suggest_orders','generate_settlement','update_settlement','submit_cart') loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature);end loop;end$$;
