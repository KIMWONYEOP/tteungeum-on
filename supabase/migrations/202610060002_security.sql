revoke create on schema public from public,anon,authenticated;
create function public.is_hq() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('SUPER_ADMIN','HQ_ADMIN'))
$$;
create function public.is_active_user() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active)
$$;
create function public.can_access_store(p_store uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_hq() or exists(select 1 from public.store_memberships m join public.profiles p on p.id=m.user_id where p.id=auth.uid() and p.active and m.active and m.store_id=p_store)
$$;
create function public.can_operate_store(p_store uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_hq() or exists(select 1 from public.store_memberships m join public.profiles p on p.id=m.user_id join public.stores s on s.id=m.store_id where p.id=auth.uid() and p.active and p.role in ('STORE_OWNER','STORE_MANAGER') and m.active and m.store_role in ('STORE_OWNER','STORE_MANAGER') and s.status='ACTIVE' and m.store_id=p_store)
$$;
create function public.require_hq() returns void language plpgsql security definer set search_path=public,pg_temp as $$begin if not public.is_hq() then raise exception '본사 권한이 필요합니다.' using errcode='42501';end if;end$$;
create function public.require_store(p_store uuid,p_write boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin if (p_write and not public.can_operate_store(p_store)) or (not p_write and not public.can_access_store(p_store)) then raise exception '매장 접근 권한이 없습니다.' using errcode='42501';end if;end$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 insert into public.profiles(id,email,name,role) values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'name',''),'STAFF');return new;end$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create function public.touch_updated_at() returns trigger language plpgsql set search_path=public,pg_temp as $$begin new.updated_at=now();return new;end$$;
create function public.capture_audit() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 declare rowdata jsonb:=to_jsonb(new);olddata jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else null end;begin
 insert into public.audit_logs(user_id,action,entity_type,entity_id,store_id,before_data,after_data) values(auth.uid(),tg_op,tg_table_name,(rowdata->>'id')::uuid,(rowdata->>'store_id')::uuid,olddata,rowdata);return new;end$$;
do $$declare t text;begin
 foreach t in array array['profiles','stores','products','purchase_orders','settlements'] loop
 execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()',t,t);
 end loop;
 foreach t in array array['profiles','store_memberships','stores','products','inventory_movements','purchase_orders','settlements','inquiries','notices'] loop
 execute format('create trigger audit_%I after insert or update on public.%I for each row execute function public.capture_audit()',t,t);
 end loop;
 foreach t in array array['profiles','stores','store_memberships','categories','suppliers','products','store_products','inventories','inventory_movements','sales','sale_items','purchase_orders','purchase_order_items','settlements','settlement_items','notices','notice_reads','inquiries','notifications','audit_logs','ai_insights','order_carts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end$$;
create policy profiles_read on public.profiles for select to authenticated using(public.is_hq() or (id=auth.uid() and active));
create policy stores_read on public.stores for select to authenticated using(public.can_access_store(id));
create policy memberships_read on public.store_memberships for select to authenticated using(public.is_hq() or (user_id=auth.uid() and public.is_active_user()));
create policy categories_read on public.categories for select to authenticated using(public.is_active_user());
create policy suppliers_read on public.suppliers for select to authenticated using(public.is_active_user());
create policy products_read on public.products for select to authenticated using(public.is_active_user());
do $$declare t text;begin foreach t in array array['store_products','inventories','inventory_movements','sales','purchase_orders','settlements','inquiries','ai_insights'] loop
 execute format('create policy store_scoped_read on public.%I for select to authenticated using(public.can_access_store(store_id))',t);end loop;end$$;
create policy sale_items_read on public.sale_items for select to authenticated using(exists(select 1 from public.sales s where s.id=sale_id));
create policy order_items_read on public.purchase_order_items for select to authenticated using(exists(select 1 from public.purchase_orders o where o.id=purchase_order_id));
create policy settlement_items_read on public.settlement_items for select to authenticated using(exists(select 1 from public.settlements s where s.id=settlement_id));
create policy notices_read on public.notices for select to authenticated using(public.is_hq() or (public.is_active_user() and published and target_type in ('ALL','STORE')));
create policy notice_reads_read on public.notice_reads for select to authenticated using(user_id=auth.uid() and public.is_active_user());
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and public.is_active_user() and (store_id is null or public.can_access_store(store_id)));
create policy audits_read on public.audit_logs for select to authenticated using(public.is_hq());
create policy carts_read on public.order_carts for select to authenticated using(user_id=auth.uid() and public.can_operate_store(store_id));
-- Write access is only through explicitly authorized atomic RPCs, never table DML.
-- Function grants are finalized explicitly in migration 004.
grant execute on function public.is_hq(),public.is_active_user(),public.can_access_store(uuid),public.can_operate_store(uuid) to authenticated;

do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in ('is_hq','is_active_user','can_access_store','can_operate_store','require_hq','require_store','handle_new_user','touch_updated_at','capture_audit') loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature);end loop;end$$;
grant execute on function public.is_hq(),public.is_active_user(),public.can_access_store(uuid),public.can_operate_store(uuid) to authenticated;
