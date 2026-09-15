-- ============================================================
-- FEST&CHILL — MISE À JOUR #5 DU SCHÉMA
-- 2FA (numéro choisi) + Vérification de pièce d'identité (vrai
-- formulaire + stockage) + Sessions actives réelles.
-- À exécuter après schema-update-4.sql.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 2FA — numéro choisi par l'utilisateur
--    NOTE : l'envoi réel du SMS de code nécessite un fournisseur SMS
--    externe (voir discussion). Ici on enregistre juste le numéro et
--    l'activation choisis par l'utilisateur, prêts à être branchés
--    dessus dès que le fournisseur SMS sera configuré.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists mfa_phone text;
alter table public.profiles add column if not exists mfa_enabled boolean not null default false;

-- ------------------------------------------------------------
-- 2. VÉRIFICATION DE PIÈCE D'IDENTITÉ — vrai formulaire, vrai stockage
-- ------------------------------------------------------------
create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  full_legal_name text not null,
  id_type text not null check (id_type in ('cni','passeport','permis')),
  id_number text not null,
  document_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists identity_verifications_organizer_idx on public.identity_verifications (organizer_id);

alter table public.identity_verifications enable row level security;

drop policy if exists "organisateur voit sa vérification" on public.identity_verifications;
create policy "organisateur voit sa vérification"
  on public.identity_verifications for select using (organizer_id = auth.uid() or public.is_admin());

drop policy if exists "organisateur soumet sa vérification" on public.identity_verifications;
create policy "organisateur soumet sa vérification"
  on public.identity_verifications for insert with check (organizer_id = auth.uid());

drop policy if exists "admin met à jour le statut" on public.identity_verifications;
create policy "admin met à jour le statut"
  on public.identity_verifications for update using (public.is_admin());

-- Bucket de stockage privé pour les documents d'identité
insert into storage.buckets (id, name, public)
values ('identity-documents', 'identity-documents', false)
on conflict (id) do nothing;

drop policy if exists "organisateur upload son document identité" on storage.objects;
create policy "organisateur upload son document identité"
  on storage.objects for insert
  with check (bucket_id = 'identity-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "organisateur/admin lit les documents identité" on storage.objects;
create policy "organisateur/admin lit les documents identité"
  on storage.objects for select
  using (bucket_id = 'identity-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ------------------------------------------------------------
-- 3. SESSIONS ACTIVES RÉELLES
--    Une ligne par connexion (navigateur/appareil) réellement enregistrée.
--    Limite honnête : on peut déconnecter LA session courante précisément,
--    et déconnecter TOUTES LES AUTRES d'un coup (fonction native Supabase),
--    mais pas cibler UNE seule ancienne session précise (Supabase ne le
--    permet pas côté client sans clé serveur).
-- ------------------------------------------------------------
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_label text,
  browser_hint text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  revoked boolean not null default false
);

create index if not exists user_sessions_user_idx on public.user_sessions (user_id);

alter table public.user_sessions enable row level security;

drop policy if exists "utilisateur gère ses sessions" on public.user_sessions;
create policy "utilisateur gère ses sessions"
  on public.user_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- FIN
-- ============================================================
