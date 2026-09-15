-- ============================================================
-- FEST&CHILL — MISE À JOUR #3 DU SCHÉMA
-- Paiement Mobile Money → confirmation MANUELLE par l'organisateur
-- (au lieu d'être validé automatiquement sans vérification).
-- À exécuter après schema.sql ET schema-update-2.sql.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Autoriser un ticket à exister en statut "pending" (en attente
--    de confirmation de paiement) — il réserve le numéro choisi
--    mais n'est pas valide pour l'entrée tant qu'il n'est pas confirmé.
-- ------------------------------------------------------------
alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets add constraint tickets_status_check
  check (status in ('pending','valid','used','cancelled'));
alter table public.tickets alter column status set default 'pending';

-- ------------------------------------------------------------
-- 2. purchase_ticket — ne marque plus le paiement comme "payé"
--    automatiquement. Réserve le numéro + crée la commande et le
--    ticket en attente ; l'acheteur reçoit un message "en attente
--    de confirmation", pas un ticket utilisable immédiatement.
--    (On la supprime d'abord : sa structure de retour change.)
-- ------------------------------------------------------------
drop function if exists public.purchase_ticket(uuid, integer, text, text, text);

create or replace function public.purchase_ticket(
  p_category_id uuid,
  p_ticket_number integer,
  p_buyer_name text,
  p_buyer_phone text,
  p_operator text
) returns table (
  order_id uuid,
  ticket_id uuid,
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
  values (v_event_id, p_category_id, p_buyer_name, p_buyer_phone, v_price, p_operator, 'pending')
  returning id into v_order_id;

  begin
    insert into public.tickets (order_id, event_id, category_id, ticket_number, status)
    values (v_order_id, v_event_id, p_category_id, p_ticket_number, 'pending')
    returning id into v_ticket_id;
  exception when unique_violation then
    raise exception 'Ce ticket vient d''être pris, choisis-en un autre';
  end;

  update public.ticket_categories set sold = sold + 1 where id = p_category_id;

  return query
    select o.id, t.id, t.ticket_number, e.title, e.event_date, tc.name, tc.price
    from public.tickets t
    join public.orders o on o.id = t.order_id
    join public.events e on e.id = t.event_id
    join public.ticket_categories tc on tc.id = t.category_id
    where t.id = v_ticket_id;
end;
$$;

grant execute on function public.purchase_ticket to anon, authenticated;

-- ------------------------------------------------------------
-- 3. confirm_order_payment — l'organisateur clique "Confirmer" une fois
--    l'argent Mobile Money reçu. Réservé à l'organisateur de l'événement
--    concerné (ou un admin) : personne d'autre ne peut valider un paiement.
-- ------------------------------------------------------------
create or replace function public.confirm_order_payment(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_organizer uuid;
begin
  select e.organizer_id into v_organizer
  from public.orders o join public.events e on e.id = o.event_id
  where o.id = p_order_id;

  if v_organizer is null then
    raise exception 'Commande introuvable';
  end if;
  if v_organizer <> auth.uid() and not public.is_admin() then
    raise exception 'Non autorisé';
  end if;

  update public.orders set payment_status = 'paid' where id = p_order_id;
  update public.tickets set status = 'valid' where order_id = p_order_id and status = 'pending';
end;
$$;

grant execute on function public.confirm_order_payment to authenticated;

-- ------------------------------------------------------------
-- 4. reject_order_payment — l'organisateur indique que l'argent n'est
--    jamais arrivé. Le ticket est annulé et le numéro redevient
--    disponible pour un autre acheteur.
-- ------------------------------------------------------------
create or replace function public.reject_order_payment(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_organizer uuid;
  v_category_id uuid;
begin
  select e.organizer_id, o.category_id into v_organizer, v_category_id
  from public.orders o join public.events e on e.id = o.event_id
  where o.id = p_order_id;

  if v_organizer is null then
    raise exception 'Commande introuvable';
  end if;
  if v_organizer <> auth.uid() and not public.is_admin() then
    raise exception 'Non autorisé';
  end if;

  update public.orders set payment_status = 'failed' where id = p_order_id;
  update public.tickets set status = 'cancelled' where order_id = p_order_id and status = 'pending';
  update public.ticket_categories set sold = greatest(sold - 1, 0) where id = v_category_id;
end;
$$;

grant execute on function public.reject_order_payment to authenticated;

-- ------------------------------------------------------------
-- 5. pending_orders — liste les commandes en attente de confirmation
--    pour les événements de l'organisateur connecté (ou un événement précis).
-- ------------------------------------------------------------
create or replace function public.pending_orders(p_event_id uuid default null)
returns table (
  order_id uuid,
  event_id uuid,
  event_title text,
  category_name text,
  ticket_number integer,
  buyer_name text,
  buyer_phone text,
  payment_operator text,
  amount integer,
  created_at timestamptz
) language sql stable security definer as $$
  select o.id, e.id, e.title, tc.name, t.ticket_number, o.buyer_name, o.buyer_phone, o.payment_operator, o.amount, o.created_at
  from public.orders o
  join public.events e on e.id = o.event_id
  join public.tickets t on t.order_id = o.id
  join public.ticket_categories tc on tc.id = o.category_id
  where o.payment_status = 'pending'
    and (e.organizer_id = auth.uid() or public.is_admin())
    and (p_event_id is null or e.id = p_event_id)
  order by o.created_at asc;
$$;

grant execute on function public.pending_orders to authenticated;

-- ------------------------------------------------------------
-- 6. scan_ticket — refuse désormais explicitement l'entrée si le
--    ticket n'a pas encore été confirmé (paiement en attente) ou
--    a été annulé, au lieu de le traiter comme valide par erreur.
-- ------------------------------------------------------------
create or replace function public.scan_ticket(p_qr_code text)
returns table (
  result text,           -- 'valid' | 'already_used' | 'pending_payment' | 'cancelled' | 'not_found' | 'forbidden'
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

  if v_ticket.status = 'pending' then
    return query select 'pending_payment', v_ticket.ticket_number, v_ticket.cat_name, v_ticket.ev_title,
      (select buyer_name from public.orders where id = v_ticket.order_id), null::timestamptz;
    return;
  end if;

  if v_ticket.status = 'cancelled' then
    return query select 'cancelled', v_ticket.ticket_number, v_ticket.cat_name, v_ticket.ev_title,
      (select buyer_name from public.orders where id = v_ticket.order_id), null::timestamptz;
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

-- ------------------------------------------------------------
-- 7. check_order_status — permet à l'ACHETEUR (sans compte) de vérifier
--    si l'organisateur a confirmé son paiement, et de récupérer son
--    ticket (QR code) une fois que c'est le cas. Accessible publiquement
--    via l'ID de commande (UUID aléatoire, impossible à deviner).
-- ------------------------------------------------------------
create or replace function public.check_order_status(p_order_id uuid)
returns table (
  payment_status text,
  ticket_id uuid,
  qr_code text,
  ticket_number integer,
  event_title text,
  event_date date,
  category_name text,
  price integer
) language sql stable security definer as $$
  select o.payment_status, t.id, t.qr_code, t.ticket_number, e.title, e.event_date, tc.name, tc.price
  from public.orders o
  join public.tickets t on t.order_id = o.id
  join public.events e on e.id = o.event_id
  join public.ticket_categories tc on tc.id = o.category_id
  where o.id = p_order_id;
$$;

grant execute on function public.check_order_status to anon, authenticated;

-- ============================================================
-- FIN — le code du site (buy-ticket, event-detail, scanner) est
-- déjà prêt à utiliser ces nouvelles fonctions.
-- ============================================================
