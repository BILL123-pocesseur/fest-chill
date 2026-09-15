-- ============================================================
-- FEST&CHILL — SCHÉMA SUPABASE (PostgreSQL)
-- À exécuter dans Supabase → SQL Editor → New query → Run
-- ============================================================

create extension if not exists "pgcrypto"; -- pour gen_random_uuid()

-- ============================================================
-- 1. PROFILES (étend auth.users — créé automatiquement via trigger)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  role text not null default 'organizer' check (role in ('organizer','admin')),
  is_verified boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  theme text not null default 'dark' check (theme in ('dark','light','auto')),
  accent_color text not null default '#0EA5A0',
  language text not null default 'fr' check (language in ('fr','en','es','ar')),
  timezone text not null default 'Africa/Porto-Novo',
  created_at timestamptz not null default now()
);

-- Si la table public.profiles existe déjà chez toi (base en prod),
-- exécute plutôt ces 4 lignes (idempotentes) au lieu du create table ci-dessus :
-- alter table public.profiles add column if not exists theme text not null default 'dark' check (theme in ('dark','light','auto'));
-- alter table public.profiles add column if not exists accent_color text not null default '#0EA5A0';
-- alter table public.profiles add column if not exists language text not null default 'fr' check (language in ('fr','en','es','ar'));
-- alter table public.profiles add column if not exists timezone text not null default 'Africa/Porto-Novo';

-- Auto-création du profil à l'inscription (Google OAuth ou email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. EVENTS
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  slug text unique not null,
  title text not null,
  event_type text,
  description text,
  location text,
  event_date date not null,
  event_time time,
  banner_url text,
  status text not null default 'draft' check (status in ('draft','published','suspended','ended')),
  created_at timestamptz not null default now()
);

create index on public.events (slug);
create index on public.events (organizer_id);

-- ============================================================
-- 3. TICKET CATEGORIES (Normal / VIP / VVIP ...)
-- ============================================================
create table public.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  quota integer not null check (quota >= 0),
  sold integer not null default 0,
  position integer not null default 0
);

create index on public.ticket_categories (event_id);

-- ============================================================
-- 4. ORDERS (une commande = un paiement)
-- ============================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  category_id uuid not null references public.ticket_categories(id),
  buyer_name text,
  buyer_phone text not null,
  amount integer not null,
  payment_operator text check (payment_operator in ('mtn','moov')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);

create index on public.orders (event_id);

-- ============================================================
-- 5. TICKETS (un ticket = une entrée, avec QR unique)
-- ============================================================
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id),
  category_id uuid not null references public.ticket_categories(id),
  ticket_number integer not null,
  qr_code text unique not null default encode(gen_random_bytes(16),'hex'),
  status text not null default 'valid' check (status in ('valid','used','cancelled')),
  scanned_at timestamptz,
  scanned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (category_id, ticket_number)
);

create index on public.tickets (event_id);
create index on public.tickets (qr_code);

-- ============================================================
-- 6. WITHDRAWALS (retraits organisateur)
-- ============================================================
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  operator text not null check (operator in ('mtn','moov')),
  phone text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. PLATFORM CONFIG (une seule ligne, gérée par l'admin)
-- ============================================================
create table public.platform_config (
  id int primary key default 1,
  commission_rate numeric not null default 10,
  fee_small integer not null default 500,
  fee_medium integer not null default 1500,
  fee_large integer not null default 3000,
  constraint single_row check (id = 1)
);
insert into public.platform_config (id) values (1);

-- ============================================================
-- RLS — activation
-- ============================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_categories enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.withdrawals enable row level security;
alter table public.platform_config enable row level security;

-- Fonction utilitaire : l'utilisateur courant est-il admin ?
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- PROFILES
create policy "profil visible par son propriétaire ou un admin"
  on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profil modifiable par son propriétaire"
  on public.profiles for update using (id = auth.uid());
create policy "admin peut tout modifier sur profiles"
  on public.profiles for update using (public.is_admin());

-- EVENTS
create policy "événements publiés visibles par tous"
  on public.events for select using (status = 'published' or organizer_id = auth.uid() or public.is_admin());
create policy "organisateur crée ses événements"
  on public.events for insert with check (organizer_id = auth.uid());
create policy "organisateur modifie ses événements"
  on public.events for update using (organizer_id = auth.uid() or public.is_admin());
create policy "organisateur supprime ses événements"
  on public.events for delete using (organizer_id = auth.uid() or public.is_admin());

-- TICKET CATEGORIES
create policy "catégories visibles si événement visible"
  on public.ticket_categories for select using (
    exists(select 1 from public.events e where e.id = event_id
      and (e.status = 'published' or e.organizer_id = auth.uid() or public.is_admin()))
  );
create policy "organisateur gère ses catégories"
  on public.ticket_categories for all using (
    exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
    or public.is_admin()
  );

-- ORDERS (visibles seulement par l'organisateur concerné / admin — l'achat public passe par la fonction RPC ci-dessous)
create policy "organisateur voit les commandes de ses événements"
  on public.orders for select using (
    exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
    or public.is_admin()
  );

-- TICKETS (idem : lecture organisateur/admin, la vérif acheteur se fait via le QR + fonction RPC)
create policy "organisateur voit les tickets de ses événements"
  on public.tickets for select using (
    exists(select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid())
    or public.is_admin()
  );

-- WITHDRAWALS
create policy "organisateur voit et crée ses retraits"
  on public.withdrawals for select using (organizer_id = auth.uid() or public.is_admin());
create policy "organisateur crée un retrait"
  on public.withdrawals for insert with check (organizer_id = auth.uid());

-- PLATFORM CONFIG
create policy "config visible par tous les organisateurs connectés"
  on public.platform_config for select using (auth.uid() is not null);
create policy "seul un admin modifie la config"
  on public.platform_config for update using (public.is_admin());

-- ============================================================
-- RPC #1 — ACHAT D'UN TICKET (appelée depuis la page publique buy-ticket,
-- fonctionne même sans compte acheteur — SECURITY DEFINER contourne les RLS
-- ci-dessus de façon contrôlée, avec vérifications strictes à l'intérieur).
-- ============================================================
create or replace function public.purchase_ticket(
  p_category_id uuid,
  p_ticket_number integer,
  p_buyer_name text,
  p_buyer_phone text,
  p_operator text
) returns table (
  ticket_id uuid,
  qr_code text,
  ticket_number integer,
  event_title text,
  event_date date,
  category_name text,
  price integer
) language plpgsql security definer as $$
declare
  v_event_id uuid;
  v_price integer;
  v_quota integer;
  v_sold integer;
  v_order_id uuid;
  v_ticket_id uuid;
begin
  select event_id, price, quota, sold into v_event_id, v_price, v_quota, v_sold
  from public.ticket_categories where id = p_category_id for update;

  if v_event_id is null then
    raise exception 'Catégorie de ticket introuvable';
  end if;

  if v_sold >= v_quota then
    raise exception 'Cette catégorie est épuisée';
  end if;

  if p_ticket_number < 1 or p_ticket_number > v_quota then
    raise exception 'Numéro de ticket invalide';
  end if;

  insert into public.orders (event_id, category_id, buyer_name, buyer_phone, amount, payment_operator, payment_status)
  values (v_event_id, p_category_id, p_buyer_name, p_buyer_phone, v_price, p_operator, 'paid')
  returning id into v_order_id;

  begin
    insert into public.tickets (order_id, event_id, category_id, ticket_number)
    values (v_order_id, v_event_id, p_category_id, p_ticket_number)
    returning id into v_ticket_id;
  exception when unique_violation then
    raise exception 'Ce ticket vient d''être pris, choisis-en un autre';
  end;

  update public.ticket_categories set sold = sold + 1 where id = p_category_id;

  return query
    select t.id, t.qr_code, t.ticket_number, e.title, e.event_date, tc.name, tc.price
    from public.tickets t
    join public.events e on e.id = t.event_id
    join public.ticket_categories tc on tc.id = t.category_id
    where t.id = v_ticket_id;
end;
$$;

grant execute on function public.purchase_ticket to anon, authenticated;

-- ============================================================
-- RPC #2 — RÉCUPÉRER LES NUMÉROS DÉJÀ VENDUS D'UNE CATÉGORIE
-- (pour griser les cases dans la grille de sélection)
-- ============================================================
create or replace function public.sold_ticket_numbers(p_category_id uuid)
returns setof integer language sql stable security definer as $$
  select ticket_number from public.tickets
  where category_id = p_category_id and status != 'cancelled';
$$;

grant execute on function public.sold_ticket_numbers to anon, authenticated;

-- ============================================================
-- RPC #3 — SCAN D'UN TICKET (utilisée depuis festchill-scanner.html,
-- réservée aux organisateurs connectés propriétaires de l'événement)
-- ============================================================
create or replace function public.scan_ticket(p_qr_code text)
returns table (
  result text,           -- 'valid' | 'already_used' | 'not_found' | 'forbidden'
  ticket_number integer,
  category_name text,
  event_title text,
  buyer_name text,
  scanned_at timestamptz
) language plpgsql security definer as $$
declare
  v_ticket record;
begin
  select t.*, e.organizer_id, e.title as ev_title, tc.name as cat_name
  into v_ticket
  from public.tickets t
  join public.events e on e.id = t.event_id
  join public.ticket_categories tc on tc.id = t.category_id
  where t.qr_code = p_qr_code
  for update of t;

  if v_ticket is null then
    return query select 'not_found', null::integer, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_ticket.organizer_id <> auth.uid() and not public.is_admin() then
    return query select 'forbidden', null::integer, null::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_ticket.status = 'used' then
    return query select 'already_used', v_ticket.ticket_number, v_ticket.cat_name, v_ticket.ev_title,
      (select buyer_name from public.orders where id = v_ticket.order_id), v_ticket.scanned_at;
    return;
  end if;

  update public.tickets set status = 'used', scanned_at = now(), scanned_by = auth.uid()
  where id = v_ticket.id;

  return query select 'valid', v_ticket.ticket_number, v_ticket.cat_name, v_ticket.ev_title,
    (select buyer_name from public.orders where id = v_ticket.order_id), now();
end;
$$;

grant execute on function public.scan_ticket to authenticated;

-- ============================================================
-- FIN — Prochaine étape côté Supabase :
-- 1. Authentication → Providers → activer Google (Client ID/Secret Google Cloud Console)
-- 2. Authentication → URL Configuration → ajouter ton domaine
-- 3. Copier Project URL + anon public key dans js/supabase-client.js
-- ============================================================

-- ============================================================
-- DEVENIR ADMINISTRATEUR (à exécuter une seule fois, manuellement)
-- Il n'y a volontairement aucun moyen de le faire depuis l'application
-- (question de sécurité). Pour donner les droits admin à ton propre
-- compte : Supabase → SQL Editor → colle la ligne ci-dessous en
-- remplaçant l'email, puis Run. Le lien "Administration" apparaîtra
-- alors dans la barre latérale de ce compte.
-- ============================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'ton-email@example.com');
