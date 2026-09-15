-- ============================================================
-- MISE À JOUR 8 — Nom de l'organisateur visible publiquement
-- (nécessaire pour la nouvelle page festchill-explore.html qui
-- liste tous les événements publiés de tous les organisateurs)
--
-- Sans cette policy, les visiteurs anonymes ne peuvent pas lire
-- profiles.full_name (la policy existante limite la lecture au
-- propriétaire du profil ou à l'admin) — les cartes événements
-- afficheront alors juste "Organisateur Fest&Chill" à la place
-- du vrai nom.
-- ============================================================

drop policy if exists "nom d'organisateur visible si événement publié" on public.profiles;
create policy "nom d'organisateur visible si événement publié"
  on public.profiles for select using (
    exists(select 1 from public.events e where e.organizer_id = profiles.id and e.status = 'published')
  );

-- ============================================================
-- FIN — exécute ce fichier dans Supabase → SQL Editor → New query → Run
-- ============================================================
