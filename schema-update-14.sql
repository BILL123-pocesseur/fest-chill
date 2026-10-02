-- ============================================================
-- FEST&CHILL — MISE À JOUR #14
-- Sécurité PIN + protection des profils + pouvoirs administrateur
-- Idempotent : peut être relancé sans risque.
-- ============================================================
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) FAILLE CORRIGÉE : un utilisateur pouvait modifier sa propre ligne
--    "profiles" sans limite (devenir admin, effacer son blocage PIN…).
--    Ce trigger bloque les colonnes sensibles pour tout appel direct
--    du client. Les fonctions SECURITY DEFINER et les admins passent.
-- ------------------------------------------------------------
create or replace function public.fc_protect_profile_columns()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $$
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if public.is_admin() then return new; end if;

  if new.role is distinct from old.role
     or new.is_verified is distinct from old.is_verified
     or new.certified is distinct from old.certified
     or new.certification_candidate is distinct from old.certification_candidate
     or new.pin_fail_count is distinct from old.pin_fail_count
     or new.pin_lock_until is distinct from old.pin_lock_until
     or new.pin_lock_tier is distinct from old.pin_lock_tier
     or new.withdrawal_pin_hash is distinct from old.withdrawal_pin_hash
     or new.withdrawal_pin_enabled is distinct from old.withdrawal_pin_enabled then
    raise exception 'Modification non autorisée';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'blocked' or new.status not in ('active','suspended') then
      raise exception 'Modification non autorisée';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists fc_protect_profile_columns on public.profiles;
create trigger fc_protect_profile_columns before update on public.profiles
for each row execute function public.fc_protect_profile_columns();

-- ------------------------------------------------------------
-- 2) JOURNAL DES ACTIONS ADMIN
-- ------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  target_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
drop policy if exists "admin lit le journal" on public.admin_audit_log;
create policy "admin lit le journal" on public.admin_audit_log for select using (public.is_admin());

create or replace function public.fc_admin_log(p_action text, p_target uuid, p_details jsonb default null)
returns void language sql security definer set search_path to 'public','pg_temp' as $$
  insert into public.admin_audit_log(admin_id, target_id, action, details) values (auth.uid(), p_target, p_action, p_details);
$$;
revoke all on function public.fc_admin_log(text, uuid, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3) PIN : durée lisible, vérification unique, état
-- ------------------------------------------------------------
create or replace function public.fc_format_remaining(p_until timestamptz)
returns text language plpgsql stable set search_path to 'public','pg_temp' as $$
declare s bigint; d int; h int; m int;
begin
  if p_until = 'infinity' then return 'jusqu''au déblocage par l''administrateur'; end if;
  s := greatest(ceil(extract(epoch from (p_until - now())))::bigint, 60);
  d := s / 86400; h := (s % 86400) / 3600; m := (s % 3600) / 60;
  if d > 0 then return format('%s j %s h', d, h);
  elsif h > 0 then return format('%s h %s min', h, m);
  else return format('%s min', m); end if;
end;
$$;

create or replace function public.fc_register_pin_failure(p_user_id uuid)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_count integer; v_tier integer; v_hours integer;
begin
  update public.profiles set pin_fail_count = pin_fail_count + 1
  where id = p_user_id returning pin_fail_count, pin_lock_tier into v_count, v_tier;

  if v_count < 5 then
    return format('Code PIN incorrect. Il te reste %s essai(s) avant le blocage.', 5 - v_count);
  end if;

  if v_tier = 0 then v_hours := 12;
  elsif v_tier = 1 then v_hours := 72;
  elsif v_tier = 2 then v_hours := 168;
  else
    update public.profiles set pin_lock_until = 'infinity', pin_fail_count = 0 where id = p_user_id;
    return 'Trop de codes PIN incorrects : ton compte est bloqué. Contacte l''administrateur pour le débloquer.';
  end if;

  update public.profiles
  set pin_lock_until = now() + make_interval(hours => v_hours), pin_lock_tier = pin_lock_tier + 1, pin_fail_count = 0
  where id = p_user_id;

  return format('Trop de codes PIN incorrects. Blocage de %s. Réessaie après cette durée, ou contacte l''administrateur.',
    case when v_hours = 12 then '12 heures' when v_hours = 72 then '3 jours' else '7 jours' end);
end;
$$;

-- FAILLE CORRIGÉE : ces deux fonctions internes étaient appelables par n'importe qui
-- (verrouiller le compte d'un autre, ou remettre son propre compteur à zéro).
revoke all on function public.fc_register_pin_failure(uuid) from public, anon, authenticated;
revoke all on function public.fc_clear_pin_failures(uuid) from public, anon, authenticated;

create or replace function public.fc_verify_pin_attempt(p_user_id uuid, p_pin text)
returns table(ok boolean, message text)
language plpgsql security definer set search_path to 'public','extensions','pg_temp' as $$
declare v_hash text; v_lock timestamptz;
begin
  select withdrawal_pin_hash, pin_lock_until into v_hash, v_lock
  from public.profiles where id = p_user_id for update;

  if v_lock is not null and now() < v_lock then
    if v_lock = 'infinity' then
      return query select false, 'Compte bloqué : trop de codes PIN incorrects. Contacte l''administrateur pour le débloquer.'::text;
    else
      return query select false, format('Trop de codes PIN incorrects. Réessaie dans %s (vers %s).',
        public.fc_format_remaining(v_lock),
        to_char(v_lock at time zone 'Africa/Porto-Novo', 'DD/MM "à" HH24"h"MI'))::text;
    end if;
    return;
  end if;

  if v_hash is null or p_pin is null or crypt(p_pin, v_hash) <> v_hash then
    return query select false, public.fc_register_pin_failure(p_user_id);
    return;
  end if;

  update public.profiles set pin_fail_count = 0, pin_lock_tier = 0, pin_lock_until = null where id = p_user_id;
  return query select true, 'OK'::text;
end;
$$;
revoke all on function public.fc_verify_pin_attempt(uuid, text) from public, anon, authenticated;

create or replace function public.fc_get_pin_status()
returns table(enabled boolean, locked boolean, locked_until timestamptz, message text, attempts_left integer)
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare r record;
begin
  select coalesce(withdrawal_pin_enabled,false) as en, pin_lock_until as lu, pin_fail_count as fc
  into r from public.profiles where id = auth.uid();
  if r is null then return query select false, false, null::timestamptz, null::text, 5; return; end if;
  if r.lu is not null and now() < r.lu then
    return query select r.en, true, r.lu,
      case when r.lu = 'infinity'
        then 'Retraits bloqués : trop de codes PIN incorrects. Contacte l''administrateur pour débloquer ton compte.'
        else format('Retraits bloqués pendant encore %s (réessaie vers %s).', public.fc_format_remaining(r.lu),
             to_char(r.lu at time zone 'Africa/Porto-Novo', 'DD/MM "à" HH24"h"MI')) end,
      0;
  else
    return query select r.en, false, null::timestamptz, null::text, greatest(5 - r.fc, 0);
  end if;
end;
$$;
revoke all on function public.fc_get_pin_status() from public, anon;
grant execute on function public.fc_get_pin_status() to authenticated;

-- Désactiver le PIN
create or replace function public.fc_disable_withdrawal_pin(p_pin text)
returns table(ok boolean, message text)
language plpgsql security definer set search_path to 'public','extensions','pg_temp' as $$
declare v record;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into v from public.fc_verify_pin_attempt(auth.uid(), p_pin);
  if not v.ok then return query select false, v.message; return; end if;
  update public.profiles set withdrawal_pin_enabled = false where id = auth.uid();
  return query select true, 'OK'::text;
end;
$$;
revoke all on function public.fc_disable_withdrawal_pin(text) from public, anon;
grant execute on function public.fc_disable_withdrawal_pin(text) to authenticated;

-- Définir / changer le PIN : l'ancien PIN est exigé s'il y en a un d'actif
drop function if exists public.fc_set_withdrawal_pin(text);
create or replace function public.fc_set_withdrawal_pin(p_pin text, p_old_pin text default null)
returns table(ok boolean, message text)
language plpgsql security definer set search_path to 'public','extensions','pg_temp' as $$
declare v_enabled boolean; v record;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if p_pin !~ '^[0-9]{5}$' then raise exception 'Le code PIN doit contenir exactement 5 chiffres'; end if;

  select coalesce(withdrawal_pin_enabled,false) into v_enabled from public.profiles where id = auth.uid();
  if v_enabled then
    select * into v from public.fc_verify_pin_attempt(auth.uid(), p_old_pin);
    if not v.ok then return query select false, v.message; return; end if;
  end if;

  update public.profiles
  set withdrawal_pin_hash = crypt(p_pin, gen_salt('bf')), withdrawal_pin_enabled = true,
      pin_fail_count = 0, pin_lock_tier = 0, pin_lock_until = null
  where id = auth.uid();
  return query select true, 'OK'::text;
end;
$$;
revoke all on function public.fc_set_withdrawal_pin(text, text) from public, anon;
grant execute on function public.fc_set_withdrawal_pin(text, text) to authenticated;

-- Retrait organisateur
create or replace function public.fc_request_withdrawal(p_amount integer, p_operator text, p_phone text, p_pin text default null)
returns table(ok boolean, message text, withdrawal_id uuid)
language plpgsql security definer set search_path to 'public','extensions','pg_temp' as $$
declare v_enabled boolean; v record; v_id uuid; v_rate numeric; v_commission integer; v_net integer;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if p_amount <= 0 then raise exception 'Montant invalide'; end if;

  select coalesce(withdrawal_pin_enabled,false) into v_enabled from public.profiles where id = auth.uid();
  if v_enabled then
    select * into v from public.fc_verify_pin_attempt(auth.uid(), p_pin);
    if not v.ok then return query select false, v.message, null::uuid; return; end if;
  end if;

  select commission_rate into v_rate from public.platform_config where id = 1;
  v_rate := coalesce(v_rate, 5);
  v_commission := round(p_amount * v_rate / 100.0);
  v_net := p_amount - v_commission;

  insert into public.withdrawals (organizer_id, amount, operator, phone, status)
  values (auth.uid(), v_net, p_operator, p_phone, 'pending') returning id into v_id;

  insert into public.platform_commissions (withdrawal_id, organizer_id, amount, rate)
  values (v_id, auth.uid(), v_commission, v_rate);

  return query select true, 'OK'::text, v_id;
end;
$$;

-- Retrait des commissions par l'admin : même blocage PIN qu'un organisateur
drop function if exists public.fc_request_admin_withdrawal(integer, text, text, text);
create or replace function public.fc_request_admin_withdrawal(p_amount integer, p_operator text, p_phone text, p_pin text default null)
returns table(ok boolean, message text, withdrawal_id uuid)
language plpgsql security definer set search_path to 'public','extensions','pg_temp' as $$
declare v_enabled boolean; v record; v_available integer; v_id uuid;
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;

  select coalesce(withdrawal_pin_enabled,false) into v_enabled from public.profiles where id = auth.uid();
  if v_enabled then
    select * into v from public.fc_verify_pin_attempt(auth.uid(), p_pin);
    if not v.ok then return query select false, v.message, null::uuid; return; end if;
  end if;

  v_available := public.fc_get_admin_commission_balance();
  if p_amount <= 0 or p_amount > v_available then
    raise exception 'Montant invalide (disponible : %)', v_available;
  end if;

  insert into public.withdrawals (organizer_id, amount, operator, phone, status, is_platform_commission)
  values (auth.uid(), p_amount, p_operator, p_phone, 'pending', true) returning id into v_id;

  return query select true, 'OK'::text, v_id;
end;
$$;
revoke all on function public.fc_request_admin_withdrawal(integer, text, text, text) from public, anon;
grant execute on function public.fc_request_admin_withdrawal(integer, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 4) POUVOIRS ADMINISTRATEUR
-- ------------------------------------------------------------
create or replace function public.fc_admin_assert_target(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;
  if p_user_id = auth.uid() then raise exception 'Tu ne peux pas faire cette action sur ton propre compte'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'Action impossible sur un autre administrateur';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Utilisateur introuvable';
  end if;
end;
$$;
revoke all on function public.fc_admin_assert_target(uuid) from public, anon, authenticated;

-- Réinitialiser le PIN (un clic) : supprime le PIN, lève le blocage, l'utilisateur en recrée un
create or replace function public.fc_admin_reset_pin(p_organizer_id uuid)
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;
  update public.profiles
  set withdrawal_pin_hash = null, withdrawal_pin_enabled = false,
      pin_fail_count = 0, pin_lock_until = null, pin_lock_tier = 0
  where id = p_organizer_id;
  perform public.fc_admin_log('reset_pin', p_organizer_id);
end;
$$;
revoke all on function public.fc_admin_reset_pin(uuid) from public, anon;
grant execute on function public.fc_admin_reset_pin(uuid) to authenticated;

-- Liste complète des utilisateurs avec leur état de sécurité
create or replace function public.fc_admin_list_users()
returns table(u_id uuid, u_name text, u_email text, u_role text, u_status text, u_verified boolean,
              u_certified boolean, u_pin_enabled boolean, u_pin_locked_until timestamptz, u_pin_tier integer,
              u_created_at timestamptz, u_last_sign_in timestamptz, u_active_sessions bigint, u_events bigint)
language plpgsql security definer set search_path to 'public','auth','pg_temp' as $$
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;
  return query
  select p.id, p.full_name, au.email::text, p.role, p.status, p.is_verified, p.certified,
         coalesce(p.withdrawal_pin_enabled,false),
         case when p.pin_lock_until is not null and now() < p.pin_lock_until then p.pin_lock_until end,
         p.pin_lock_tier, p.created_at, au.last_sign_in_at,
         (select count(*) from public.user_sessions s where s.user_id = p.id and not s.revoked),
         (select count(*) from public.events e where e.organizer_id = p.id)
  from public.profiles p left join auth.users au on au.id = p.id
  order by p.created_at desc;
end;
$$;
revoke all on function public.fc_admin_list_users() from public, anon;
grant execute on function public.fc_admin_list_users() to authenticated;

-- Toutes les connexions (appareils) — d'un utilisateur ou de tous
create or replace function public.fc_admin_list_sessions(p_user_id uuid default null, p_limit integer default 200)
returns table(s_id uuid, s_user_id uuid, s_name text, s_email text, s_device text, s_browser text,
              s_created_at timestamptz, s_last_seen timestamptz, s_revoked boolean)
language plpgsql security definer set search_path to 'public','auth','pg_temp' as $$
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;
  return query
  select s.id, s.user_id, p.full_name, au.email::text, s.device_label, s.browser_hint, s.created_at, s.last_seen, s.revoked
  from public.user_sessions s
  join public.profiles p on p.id = s.user_id
  left join auth.users au on au.id = s.user_id
  where p_user_id is null or s.user_id = p_user_id
  order by s.last_seen desc nulls last
  limit least(coalesce(p_limit,200), 500);
end;
$$;
revoke all on function public.fc_admin_list_sessions(uuid, integer) from public, anon;
grant execute on function public.fc_admin_list_sessions(uuid, integer) to authenticated;

-- Déconnecter un utilisateur partout
create or replace function public.fc_admin_revoke_sessions(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public','auth','pg_temp' as $$
begin
  perform public.fc_admin_assert_target(p_user_id);
  update public.user_sessions set revoked = true where user_id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform public.fc_admin_log('revoke_sessions', p_user_id);
end;
$$;
revoke all on function public.fc_admin_revoke_sessions(uuid) from public, anon;
grant execute on function public.fc_admin_revoke_sessions(uuid) to authenticated;

-- Bloquer / débloquer un compte (le bloqué est déconnecté et ne peut plus se réactiver seul)
create or replace function public.fc_admin_set_account_blocked(p_user_id uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path to 'public','auth','pg_temp' as $$
begin
  perform public.fc_admin_assert_target(p_user_id);
  update public.profiles set status = case when p_blocked then 'blocked' else 'active' end where id = p_user_id;
  if p_blocked then
    update public.user_sessions set revoked = true where user_id = p_user_id;
    delete from auth.sessions where user_id = p_user_id;
  end if;
  perform public.fc_admin_log(case when p_blocked then 'block_account' else 'unblock_account' end, p_user_id);
end;
$$;
revoke all on function public.fc_admin_set_account_blocked(uuid, boolean) from public, anon;
grant execute on function public.fc_admin_set_account_blocked(uuid, boolean) to authenticated;

-- Supprimer le mot de passe : l'ancien ne marche plus, l'utilisateur passe par « Mot de passe oublié »
create or replace function public.fc_admin_invalidate_password(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public','extensions','auth','pg_temp' as $$
begin
  perform public.fc_admin_assert_target(p_user_id);
  update auth.users set encrypted_password = crypt(gen_random_uuid()::text, gen_salt('bf')) where id = p_user_id;
  update public.user_sessions set revoked = true where user_id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform public.fc_admin_log('invalidate_password', p_user_id);
end;
$$;
revoke all on function public.fc_admin_invalidate_password(uuid) from public, anon;
grant execute on function public.fc_admin_invalidate_password(uuid) to authenticated;

-- Supprimer un compte (refusé s'il y a un historique financier à conserver)
create or replace function public.fc_admin_delete_account(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public','auth','pg_temp' as $$
declare v_name text;
begin
  perform public.fc_admin_assert_target(p_user_id);
  if exists (select 1 from public.orders o join public.events e on e.id = o.event_id
             where e.organizer_id = p_user_id and o.payment_status = 'paid')
     or exists (select 1 from public.withdrawals where organizer_id = p_user_id)
     or exists (select 1 from public.platform_commissions where organizer_id = p_user_id) then
    raise exception 'Suppression refusée : ce compte a des ventes ou retraits enregistrés. Bloque-le plutôt pour conserver l''historique financier.';
  end if;
  select full_name into v_name from public.profiles where id = p_user_id;
  perform public.fc_admin_log('delete_account', p_user_id, jsonb_build_object('name', v_name));
  delete from public.event_collaborators where organizer_id = p_user_id or invited_by = p_user_id;
  update public.tickets set scanned_by = null where scanned_by = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;
revoke all on function public.fc_admin_delete_account(uuid) from public, anon;
grant execute on function public.fc_admin_delete_account(uuid) to authenticated;

-- Journal des actions admin
create or replace function public.fc_admin_list_audit(p_limit integer default 100)
returns table(a_id uuid, a_admin text, a_target text, a_action text, a_details jsonb, a_created_at timestamptz)
language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;
  return query
  select l.id, pa.full_name, pt.full_name, l.action, l.details, l.created_at
  from public.admin_audit_log l
  left join public.profiles pa on pa.id = l.admin_id
  left join public.profiles pt on pt.id = l.target_id
  order by l.created_at desc limit least(coalesce(p_limit,100), 500);
end;
$$;
revoke all on function public.fc_admin_list_audit(integer) from public, anon;
grant execute on function public.fc_admin_list_audit(integer) to authenticated;

-- ============================================================
-- (ajouté) CONTRÔLE DU SOLDE CÔTÉ SERVEUR + FICHE PUBLIQUE ORGANISATEUR
-- Déjà appliqué sur ta base via migrations Supabase ; ce fichier sert d'archive.
-- 1) Suppression de la règle "organisateur crée un retrait" (insertion directe)
-- 2) fc_organizer_available_balance + fc_request_withdrawal (solde vérifié par le serveur)
-- 3) fc_public_organizer_info (nom, photo, téléphone, e-mail d'un organisateur actif
--    ayant un événement en vente)
-- ============================================================
drop policy if exists "organisateur crée un retrait" on public.withdrawals;
