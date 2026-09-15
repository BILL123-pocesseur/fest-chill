-- ============================================================
-- FEST&CHILL — MISE À JOUR #10 DU SCHÉMA
-- Photo de profil (avatar) — style WhatsApp/Facebook.
-- La colonne profiles.avatar_url existe déjà depuis schema.sql,
-- il ne manquait que le bucket de stockage + les règles d'accès.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- Bucket PUBLIC (contrairement à identity-documents qui est privé) :
-- une photo de profil doit être visible par tout le monde sur le site
-- (cartes événements, page ticket, etc.), pas seulement le propriétaire.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "chacun upload sa propre photo de profil" on storage.objects;
create policy "chacun upload sa propre photo de profil"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chacun remplace sa propre photo de profil" on storage.objects;
create policy "chacun remplace sa propre photo de profil"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "chacun supprime sa propre photo de profil" on storage.objects;
create policy "chacun supprime sa propre photo de profil"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos de profil visibles par tous" on storage.objects;
create policy "photos de profil visibles par tous"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- ============================================================
-- FIN — exécute ce fichier dans Supabase → SQL Editor → New query → Run
-- ============================================================
