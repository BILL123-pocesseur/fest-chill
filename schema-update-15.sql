-- Déjà appliqué sur ton projet Supabase (migration « admin_user_display_preferences »).
-- Gardé ici pour l'historique du projet.
create or replace function public.fc_admin_get_preferences(p_user_id uuid)
returns table(p_language text, p_theme text, p_accent text, p_timezone text, p_avatar text)
language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;
  return query select language, theme, accent_color, timezone, avatar_url from public.profiles where id = p_user_id;
end;
$$;
revoke all on function public.fc_admin_get_preferences(uuid) from public, anon;
grant execute on function public.fc_admin_get_preferences(uuid) to authenticated;

create or replace function public.fc_admin_reset_preferences(p_user_id uuid, p_language text default 'fr')
returns void language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if not public.is_admin() then raise exception 'Non autorisé'; end if;
  if p_language not in ('fr','en','ar') then raise exception 'Langue inconnue'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'Utilisateur introuvable'; end if;
  update public.profiles set language = p_language, theme = 'light', accent_color = '#0EA5A0' where id = p_user_id;
  perform public.fc_admin_log('reset_preferences', p_user_id, jsonb_build_object('language', p_language));
end;
$$;
revoke all on function public.fc_admin_reset_preferences(uuid, text) from public, anon;
grant execute on function public.fc_admin_reset_preferences(uuid, text) to authenticated;
