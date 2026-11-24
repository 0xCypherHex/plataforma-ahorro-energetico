-- =============================================================================
--  Migración 002 · Registro con comunidad nueva (Fase 2)
--  Ejecutar UNA vez en Supabase → SQL Editor → Run.
--
--  Cambio: el trigger handle_new_user ahora acepta en options.data:
--    · community_id                → unirse a una comunidad existente (igual que antes)
--    · new_community_name          → crear (o reutilizar si ya existe) una comunidad
--    · new_community_municipality  → opcional, municipio/alcaldía de la comunidad nueva
--  Así web y móvil registran usuario + comunidad en una sola llamada a signUp.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type      public.account_type := 'hogar';
  v_comm      uuid;
  v_tariff    numeric;
  v_settings  public.app_settings%rowtype;
  v_new_name  text := nullif(btrim(coalesce(v_meta->>'new_community_name', '')), '');
  v_new_muni  text := nullif(btrim(coalesce(v_meta->>'new_community_municipality', '')), '');
begin
  if v_meta->>'account_type' in ('hogar', 'negocio') then
    v_type := (v_meta->>'account_type')::public.account_type;
  end if;

  -- 1) Comunidad existente
  if coalesce(v_meta->>'community_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select c.id into v_comm from public.communities c where c.id = (v_meta->>'community_id')::uuid;
  end if;

  -- 2) Comunidad nueva (si no se eligió una existente)
  if v_comm is null and v_new_name is not null and char_length(v_new_name) between 2 and 120 then
    v_new_muni := left(v_new_muni, 120);
    select c.id into v_comm
      from public.communities c
     where lower(c.name) = lower(v_new_name)
       and lower(coalesce(c.municipality, '')) = lower(coalesce(v_new_muni, ''))
     limit 1;

    if v_comm is null then
      insert into public.communities (name, municipality, created_by)
      values (v_new_name, v_new_muni, new.id)
      on conflict do nothing
      returning id into v_comm;

      if v_comm is null then  -- otra inserción simultánea ganó la carrera
        select c.id into v_comm
          from public.communities c
         where lower(c.name) = lower(v_new_name)
           and lower(coalesce(c.municipality, '')) = lower(coalesce(v_new_muni, ''))
         limit 1;
      end if;
    end if;
  end if;

  select * into v_settings from public.app_settings where id = 1;
  v_tariff := case when v_type = 'negocio'
                   then coalesce(v_settings.default_tariff_negocio, 4.00)
                   else coalesce(v_settings.default_tariff_hogar, 1.20) end;

  insert into public.profiles (id, full_name, account_type, community_id, tariff_per_kwh)
  values (new.id, left(coalesce(v_meta->>'full_name', ''), 120), v_type, v_comm, v_tariff)
  on conflict (id) do nothing;

  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
