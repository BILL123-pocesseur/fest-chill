-- ============================================================
-- FEST&CHILL — MISE À JOUR #6 DU SCHÉMA
-- Permet à un acheteur (sans compte) de voir le numéro Mobile Money
-- PRINCIPAL de l'organisateur d'un événement, pour savoir où envoyer
-- son paiement. Ne révèle que le numéro principal, rien d'autre.
-- Peut être exécuté à n'importe quel moment après schema-update-2.sql.
-- Idempotent.
-- ============================================================

create or replace function public.get_event_payout_info(p_event_id uuid)
returns table (operator text, phone text)
language sql stable security definer as $$
  select pm.operator, pm.phone
  from public.payout_methods pm
  join public.events e on e.organizer_id = pm.organizer_id
  where e.id = p_event_id and pm.is_primary = true
  limit 1;
$$;

grant execute on function public.get_event_payout_info to anon, authenticated;
