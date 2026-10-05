-- Additive baseline: no DROP, TRUNCATE, or production seed.
create extension if not exists btree_gist;
set search_path=public,extensions;
create type public.app_role as enum ('SUPER_ADMIN','HQ_ADMIN','STORE_OWNER','STORE_MANAGER','STAFF');
create type public.order_status as enum ('DRAFT','REQUESTED','APPROVED','ORDERED','SHIPPED','PARTIAL_RECEIVED','RECEIVED','REJECTED','CANCELLED');
create table public.profiles (
 id uuid primary key references auth.users(id), email text not null, name text not null default '', phone text,
 role public.app_role not null default 'STAFF', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stores (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null check(length(trim(name))>0), owner_name text not null default '',
 business_number text, phone text, address text not null default '', address_detail text,
 operation_type text not null default 'FRANCHISE' check(operation_type in ('DIRECT','FRANCHISE')),
 status text not null default 'ACTIVE' check(status in ('ACTIVE','INACTIVE')), opened_at date,
 auto_order_enabled boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.store_memberships (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), store_id uuid not null references public.stores(id),
 store_role public.app_role not null check(store_role in ('STORE_OWNER','STORE_MANAGER','STAFF')), active boolean not null default true,
 created_at timestamptz not null default now(), unique(user_id,store_id)
);
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, sort_order integer not null default 0, active boolean not null default true);
create table public.suppliers (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, business_number text, contact_name text, phone text, email text,address text,
 lead_time_days integer not null default 3 check(lead_time_days>=0),active boolean not null default true
);
create table public.products (
 id uuid primary key default gen_random_uuid(), sku text not null unique check(length(trim(sku))>0), barcode text unique, name text not null check(length(trim(name))>0),
 category_id uuid not null references public.categories(id), supplier_id uuid references public.suppliers(id),
 cost_price numeric(16,2) not null check(cost_price>=0), supply_price numeric(16,2) not null check(supply_price>=0), sale_price numeric(16,2) not null check(sale_price>=0),
 vat_type text not null default 'TAXABLE' check(vat_type in ('TAXABLE','EXEMPT')), unit text not null default '개',
 safety_stock integer not null default 0 check(safety_stock>=0), reorder_quantity integer not null default 1 check(reorder_quantity>0), target_stock integer check(target_stock>=0),
 inventory_managed boolean not null default true, active boolean not null default true, image_url text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.store_products (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id), product_id uuid not null references public.products(id),
 sale_price numeric(16,2) check(sale_price>=0), enabled boolean not null default true,
 safety_stock_override integer check(safety_stock_override>=0),reorder_quantity_override integer check(reorder_quantity_override>0),unique(store_id,product_id)
);
create table public.inventories (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),product_id uuid not null references public.products(id),
 quantity integer not null default 0 check(quantity>=0),reserved_quantity integer not null default 0 check(reserved_quantity>=0 and reserved_quantity<=quantity),
 updated_at timestamptz not null default now(),unique(store_id,product_id)
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),product_id uuid not null references public.products(id),
 movement_type text not null check(movement_type in ('SALE','SALE_CANCEL','PURCHASE_RECEIPT','ADJUSTMENT','DISPOSAL','TRANSFER_IN','TRANSFER_OUT','INITIAL')),
 quantity integer not null,quantity_before integer not null check(quantity_before>=0),quantity_after integer not null check(quantity_after>=0),
 reference_type text,reference_id uuid,memo text,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),
 check(quantity_after=quantity_before+quantity)
);
create table public.sales (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),sale_number text not null,sold_at timestamptz not null,
 subtotal numeric(16,2) not null check(subtotal>=0),discount_amount numeric(16,2) not null default 0 check(discount_amount>=0),tax_amount numeric(16,2) not null default 0 check(tax_amount>=0),
 total_amount numeric(16,2) not null check(total_amount>=0),payment_method text not null default 'CARD',external_pos_id text,idempotency_key text not null,
 request_payload jsonb not null,status text not null default 'COMPLETED' check(status in ('COMPLETED','CANCELLED')),created_at timestamptz not null default now(),
 unique(store_id,sale_number),unique(store_id,idempotency_key),unique(store_id,external_pos_id),check(total_amount=subtotal-discount_amount)
);
create table public.sale_items (
 id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.sales(id),product_id uuid not null references public.products(id),
 quantity integer not null check(quantity>0),unit_price numeric(16,2) not null check(unit_price>=0),discount_amount numeric(16,2) not null default 0 check(discount_amount>=0),
 total_amount numeric(16,2) not null check(total_amount>=0),cost_price numeric(16,2) not null check(cost_price>=0),check(total_amount=quantity*unit_price-discount_amount)
);
create table public.purchase_orders (
 id uuid primary key default gen_random_uuid(),order_number text not null unique,store_id uuid not null references public.stores(id),supplier_id uuid references public.suppliers(id),
 order_type text not null check(order_type in ('MANUAL','AUTO_SUGGESTED','AUTO')),status public.order_status not null default 'REQUESTED',
 ordered_at timestamptz not null default now(),approved_at timestamptz,shipped_at timestamptz,received_at timestamptz,
 supply_amount numeric(16,2) not null default 0 check(supply_amount>=0),tax_amount numeric(16,2) not null default 0 check(tax_amount>=0),total_amount numeric(16,2) not null default 0 check(total_amount>=0),
 requested_by uuid references public.profiles(id),approved_by uuid references public.profiles(id),memo text,
 idempotency_key text not null,request_payload jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(store_id,idempotency_key),check(total_amount=supply_amount+tax_amount)
);
create table public.purchase_order_items (
 id uuid primary key default gen_random_uuid(),purchase_order_id uuid not null references public.purchase_orders(id),product_id uuid not null references public.products(id),
 quantity integer not null check(quantity>0),received_quantity integer not null default 0 check(received_quantity>=0 and received_quantity<=quantity),
 unit_cost numeric(16,2) not null check(unit_cost>=0),total_amount numeric(16,2) not null check(total_amount>=0),unique(purchase_order_id,product_id),check(total_amount=quantity*unit_cost)
);
create table public.settlements (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),period_start date not null,period_end date not null check(period_end>=period_start),
 gross_sales numeric(16,2) not null check(gross_sales>=0),refund_amount numeric(16,2) not null default 0 check(refund_amount>=0),discount_amount numeric(16,2) not null default 0 check(discount_amount>=0),
 supply_cost numeric(16,2) not null default 0 check(supply_cost>=0),franchise_fee numeric(16,2) not null default 0 check(franchise_fee>=0),platform_fee numeric(16,2) not null default 0 check(platform_fee>=0),
 other_fee numeric(16,2) not null default 0 check(other_fee>=0),adjustment_amount numeric(16,2) not null default 0,net_settlement numeric(16,2) not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','CONFIRMED','SCHEDULED','PAID','CANCELLED')),scheduled_payment_date date,paid_at timestamptz,memo text,
 policy jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 exclude using gist(store_id with =,daterange(period_start,period_end,'[]') with &&) where(status<>'CANCELLED')
);
create table public.settlement_items (id uuid primary key default gen_random_uuid(),settlement_id uuid not null references public.settlements(id),item_type text not null,description text,amount numeric(16,2) not null,reference_id uuid);
create table public.notices (
 id uuid primary key default gen_random_uuid(),title text not null check(length(trim(title))>0),content text not null,target_type text not null default 'ALL' check(target_type in ('ALL','HQ','STORE')),
 important boolean not null default false,published boolean not null default false,published_at timestamptz,created_by uuid references public.profiles(id),created_at timestamptz not null default now()
);
create table public.notice_reads (user_id uuid not null references public.profiles(id),notice_id uuid not null references public.notices(id),read_at timestamptz not null default now(),primary key(user_id,notice_id));
create table public.inquiries (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.stores(id),user_id uuid not null references public.profiles(id),category text not null,title text not null check(length(trim(title))>0),content text not null,
 status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','ANSWERED','CLOSED')),response text,responded_by uuid references public.profiles(id),responded_at timestamptz,created_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),store_id uuid references public.stores(id),type text not null,title text not null,message text not null default '',link text not null default '/store/notifications',read_at timestamptz,created_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id),action text not null,entity_type text not null,entity_id uuid,store_id uuid references public.stores(id),before_data jsonb,after_data jsonb,ip_address inet,created_at timestamptz not null default now()
);
create table public.ai_insights (id uuid primary key default gen_random_uuid(),store_id uuid references public.stores(id),insight_type text not null,period_start date,period_end date,title text not null,summary text,data jsonb,created_at timestamptz not null default now());
create table public.order_carts (user_id uuid not null references public.profiles(id),store_id uuid not null references public.stores(id),items jsonb not null default '[]',updated_at timestamptz not null default now(),primary key(user_id,store_id));
create index sales_store_date on public.sales(store_id,sold_at);
create index sale_items_sale on public.sale_items(sale_id);
create index movements_store_date on public.inventory_movements(store_id,created_at);
create index orders_store_date on public.purchase_orders(store_id,ordered_at);
create index orders_status on public.purchase_orders(status);
create index orders_items_product on public.purchase_order_items(product_id,purchase_order_id);
create index settlements_store_period on public.settlements(store_id,period_start,period_end);
create index memberships_store_user on public.store_memberships(store_id,user_id);
create index products_category on public.products(category_id);
create index inquiries_status_store on public.inquiries(status,store_id);
create index notifications_user_read on public.notifications(user_id,read_at);
create index audit_store_date on public.audit_logs(store_id,created_at);

-- Close exposure before the next migration runs, even on projects with broad default grants.
do $$declare t text;begin foreach t in array array['profiles','stores','store_memberships','categories','suppliers','products','store_products','inventories','inventory_movements','sales','sale_items','purchase_orders','purchase_order_items','settlements','settlement_items','notices','notice_reads','inquiries','notifications','audit_logs','ai_insights','order_carts'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);end loop;end$$;
