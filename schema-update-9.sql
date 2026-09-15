-- ============================================================
-- FEST&CHILL — MISE À JOUR #9 DU SCHÉMA
-- 1) Code PIN de retrait (facultatif, haché, jamais en clair)
-- 2) Confirmation AUTOMATIQUE du paiement par FedaPay, en plus de
--    la confirmation manuelle déjà en place (schema-update-3.sql).
--    Réutilise exactement le même système commande "pending" ->
--    ticket "valid", juste déclenché par le webhook FedaPay au lieu
--    d'un clic organisateur.
-- À exécuter après schema.sql, schema-update-2.sql et schema-update-3.sql.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) PIN DE RETRAIT
-- ------------------------------------------------------------
alter table public.profiles add column if not exists withdrawal_pin_hash text;
alter table public.profiles add column if not exists withdrawal_pin_enabled boolean not null default false;

create or replace function public.fc_set_withdrawal_pin(p_pin text)
returns void language plpgsql security definer as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  if p_pin !~ '^[0-9]{5}$' then
    raise exception 'Le code PIN doit contenir exactement 5 chiffres';
  end if;

  update public.profiles
  set withdrawal_pin_hash = crypt(p_pin, gen_salt('bf')),
      withdrawal_pin_enabled = true
  where id = auth.uid();
end;
$$;
grant execute on function public.fc_set_withdrawal_pin to authenticated;

create or replace function public.fc_disable_withdrawal_pin(p_pin text)
returns void language plpgsql security definer as $$
declare
  v_hash text;
begin
  select withdrawal_pin_hash into v_hash from public.profiles where id = auth.uid();
  if v_hash is null or crypt(p_pin, v_hash) <> v_hash then
    raise exception 'Code PIN incorrect';
  end if;
  update public.profiles set withdrawal_pin_enabled = false where id = auth.uid();
end;
$$;
grant execute on function public.fc_disable_withdrawal_pin to authenticated;

create or replace function public.fc_has_withdrawal_pin()
returns boolean language sql stable security definer as $$
  select coalesce(withdrawal_pin_enabled, false) from public.profiles where id = auth.uid();
$$;
grant execute on function public.fc_has_withdrawal_pin to authenticated;

-- Retrait sécurisé : vérifie le PIN (si activé) puis crée la demande.
-- Remplace l'ancien insert direct côté client dans festchill-wallet.html.
create or replace function public.fc_request_withdrawal(p_amount integer, p_operator text, p_phone text, p_pin text default null)
returns uuid language plpgsql security definer as $$
declare
  v_hash text;
  v_enabled boolean;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select withdrawal_pin_hash, withdrawal_pin_enabled into v_hash, v_enabled
  from public.profiles where id = auth.uid();

  if v_enabled then
    if p_pin is null or crypt(p_pin, v_hash) <> v_hash then
      raise exception 'Code PIN incorrect';
    end if;
  end if;

  insert into public.withdrawals (organizer_id, amount, operator, phone, status)
  values (auth.uid(), p_amount, p_operator, p_phone, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.fc_request_withdrawal to authenticated;

-- ------------------------------------------------------------
-- 2) CONFIRMATION AUTOMATIQUE PAR FEDAPAY
-- ------------------------------------------------------------
alter table public.orders add column if not exists fedapay_transaction_id text;

-- Confirme le paiement — UNIQUEMENT appelée par la fonction Edge
-- fedapay-webhook (avec la clé service_role). Pas de vérification
-- d'organisateur connecté ici (il n'y en a pas, c'est un serveur qui
-- appelle) — c'est pour ça qu'elle n'est PAS accordée à anon/authenticated
-- ci-dessous : seule la clé service_role peut l'exécuter.
create or replace function public.fc_fedapay_confirm_order(p_order_id uuid, p_fedapay_transaction_id text)
returns void language plpgsql security definer as $$
begin
  update public.orders
  set payment_status = 'paid', fedapay_transaction_id = p_fedapay_transaction_id
  where id = p_order_id and payment_status = 'pending';

  update public.tickets set status = 'valid' where order_id = p_order_id and status = 'pending';
end;
$$;
-- Volontairement AUCUN grant à anon/authenticated.

create or replace function public.fc_fedapay_reject_order(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_category_id uuid;
begin
  select category_id into v_category_id from public.orders where id = p_order_id;

  update public.orders set payment_status = 'failed' where id = p_order_id and payment_status = 'pending';
  update public.tickets set status = 'cancelled' where order_id = p_order_id and status = 'pending';
  update public.ticket_categories set sold = greatest(sold - 1, 0) where id = v_category_id;
end;
$$;
-- Volontairement AUCUN grant à anon/authenticated.

-- ============================================================
-- FIN — exécute ce fichier dans Supabase → SQL Editor → New query → Run
-- (après schema-update-3.sql si ce n'est pas déjà fait)
-- ============================================================
