-- ============================================================
-- FEST&CHILL — MISE À JOUR #4 DU SCHÉMA
-- Trace la vraie date de dernière modification du mot de passe
-- (Supabase ne l'expose pas directement via la clé publique).
-- Idempotent : peut être relancé sans risque.
-- ============================================================

alter table public.profiles add column if not exists password_updated_at timestamptz;
