-- ============================================================
-- FEST&CHILL — MISE À JOUR #2 DU SCHÉMA
-- À exécuter après schema.sql, dans Supabase → SQL Editor → New query → Run
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. NUMÉROS MOBILE MONEY (onglet "Mobile Money" des paramètres)
-- ------------------------------------------------------------
create table if not exists public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  operator text not null check (operator in ('mtn','moov')),
  phone text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists payout_methods_organizer_idx on public.payout_methods (organizer_id);

alter table public.payout_methods enable row level security;

drop policy if exists "organisateur gère ses numéros Mobile Money" on public.payout_methods;
create policy "organisateur gère ses numéros Mobile Money"
  on public.payout_methods for all
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

-- ------------------------------------------------------------
-- 2. PRÉFÉRENCES DE NOTIFICATIONS + PRÉFÉRENCE DE RETRAIT
--    (stockées directement sur profiles, un seul enregistrement par utilisateur)
-- ------------------------------------------------------------
alter table public.profiles add column if not exists notif_prefs jsonb not null default '{
  "sms_sale": true, "sms_withdraw": true, "sms_failed": false,
  "email_daily": true, "email_weekly": true, "email_security": true, "email_news": false,
  "inapp_all": true, "inapp_sound": true
}'::jsonb;

alter table public.profiles add column if not exists withdrawal_preference text not null default 'manual'
  check (withdrawal_preference in ('manual','auto_sale','auto_weekly'));

-- ============================================================
-- FIN — rien d'autre à faire côté Supabase, le code du site
-- est déjà prêt à utiliser ces colonnes/tables.
-- ============================================================
