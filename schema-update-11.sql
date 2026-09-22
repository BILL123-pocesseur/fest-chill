-- ============================================================
-- FEST&CHILL — MISE À JOUR #11 DU SCHÉMA
-- À exécuter après schema-update-10.sql, dans Supabase → SQL Editor → New query → Run
-- Idempotent : peut être relancé sans risque.
--
-- Ajoute Celtiis Cash comme 3e opérateur mobile money (à côté de MTN
-- Mobile Money et Moov Money), sur les 3 tables où l'opérateur est
-- contraint par un CHECK : orders.payment_operator, withdrawals.operator,
-- payout_methods.operator.
-- ============================================================

alter table public.orders
  drop constraint if exists orders_payment_operator_check;
alter table public.orders
  add constraint orders_payment_operator_check
  check (payment_operator in ('mtn','moov','celtiis'));

alter table public.withdrawals
  drop constraint if exists withdrawals_operator_check;
alter table public.withdrawals
  add constraint withdrawals_operator_check
  check (operator in ('mtn','moov','celtiis'));

alter table public.payout_methods
  drop constraint if exists payout_methods_operator_check;
alter table public.payout_methods
  add constraint payout_methods_operator_check
  check (operator in ('mtn','moov','celtiis'));

-- table historique (encore présente en base, gardée cohérente même si le
-- code applicatif utilise désormais payout_methods)
alter table if exists public.payout_numbers
  drop constraint if exists payout_numbers_operator_check;
alter table if exists public.payout_numbers
  add constraint payout_numbers_operator_check
  check (operator in ('mtn','moov','celtiis'));
