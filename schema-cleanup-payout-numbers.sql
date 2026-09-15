-- ============================================================
-- FEST&CHILL — NETTOYAGE : suppression de la table en double
-- "payout_numbers" (créée par erreur depuis une autre conversation IA).
-- On récupère d'abord ses données dans la vraie table utilisée par le
-- site (payout_methods), puis on supprime le doublon.
-- ============================================================

-- 1. Copie les numéros de payout_numbers vers payout_methods,
--    seulement s'ils n'y sont pas déjà (évite les doublons).
insert into public.payout_methods (organizer_id, operator, phone, is_primary)
select pn.organizer_id, pn.operator, pn.phone, pn.is_primary
from public.payout_numbers pn
where not exists (
  select 1 from public.payout_methods pm
  where pm.organizer_id = pn.organizer_id and pm.phone = pn.phone
);

-- 2. Supprime la table en double (plus aucune donnée n'est perdue).
drop table if exists public.payout_numbers;
