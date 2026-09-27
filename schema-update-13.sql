-- ============================================================
-- FEST&CHILL — MISE À JOUR #13 DU SCHÉMA
-- Déjà appliquée en base (via Supabase MCP) — ce fichier est la trace, à
-- déposer dans le dépôt comme les précédentes.
--
-- Corrige aussi un oubli de la mise à jour #12 : les colonnes
-- events.duration_days / tickets.scan_count / tickets.last_scan_date
-- n'avaient en réalité jamais été créées (la 1ère tentative avait échoué
-- en cours de route) alors que les fonctions qui s'appuient dessus
-- avaient déjà été (re)créées. Les ALTER TABLE ci-dessous les rattrapent
-- si jamais schema-update-12.sql n'a pas déjà été exécuté à la main.
-- ============================================================

alter table public.events
  add column if not exists duration_days integer not null default 1;
alter table public.events
  drop constraint if exists events_duration_days_check;
alter table public.events
  add constraint events_duration_days_check check (duration_days >= 1 and duration_days <= 30);

alter table public.tickets
  add column if not exists scan_count integer not null default 0;
alter table public.tickets
  add column if not exists last_scan_date date;

-- Vente fermée une fois le dernier jour de l'événement passé (voir
-- purchase_ticket() — mise à jour dans le tableau de bord Supabase,
-- non reproduite ici pour éviter les divergences de copie).

-- check_order_status() renvoie maintenant aussi buyer_name, buyer_phone et
-- duration_days, pour que le reçu affiché après un paiement FedaPay (qui
-- redirige hors de la page, donc perd l'état JS local) puisse afficher le
-- nom/téléphone de l'acheteur et la bonne durée de l'événement.

-- Historique organisateur : un événement peut être masqué de la liste
-- "Historique" (bouton "Vider l'historique") sans supprimer aucune
-- donnée de vente.
alter table public.events
  add column if not exists hidden_from_history boolean not null default false;
