-- ============================================================
-- FEST&CHILL — MISE À JOUR #7 DU SCHÉMA
-- Ajoute l'espagnol et l'arabe aux langues disponibles
-- (ta base n'autorisait jusqu'ici que 'fr' et 'en').
-- Idempotent : peut être relancé sans risque.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check
  check (language in ('fr','en','es','ar'));
