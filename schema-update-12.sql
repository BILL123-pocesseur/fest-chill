-- ============================================================
-- FEST&CHILL — MISE À JOUR #12 DU SCHÉMA
-- Déjà appliquée en base (via Supabase MCP) — ce fichier est juste la
-- trace, à déposer dans le dépôt comme les précédentes.
-- ============================================================

-- Événements sur plusieurs jours consécutifs. event_date reste le jour de
-- DÉBUT ; duration_days = nombre de jours consécutifs (1 = comportement
-- inchangé, événement classique sur une seule journée).
alter table public.events
  add column if not exists duration_days integer not null default 1;
alter table public.events
  drop constraint if exists events_duration_days_check;
alter table public.events
  add constraint events_duration_days_check check (duration_days >= 1 and duration_days <= 30);

-- Suivi des scans multiples par ticket : scan_count progresse à chaque
-- passage valide ; last_scan_date empêche plus d'un scan le même jour
-- calendaire (protège contre le partage d'une photo du QR code pour faire
-- entrer plusieurs personnes le même jour).
alter table public.tickets
  add column if not exists scan_count integer not null default 0;
alter table public.tickets
  add column if not exists last_scan_date date;

-- scan_ticket() : voir supabase-client.js / festchill-scanner.html pour
-- l'utilisation des nouveaux résultats "already_used_today", et des
-- colonnes day_number / total_days retournées à chaque scan valide.
-- Définition complète : voir le tableau de bord Supabase (fonction déjà
-- appliquée, non reproduite ici pour éviter les divergences de copie).
