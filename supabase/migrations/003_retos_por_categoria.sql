-- =============================================================================
--  Migración 003 · Cada reto mide solo su categoría de aparatos (Fase 5)
--  Ejecutar UNA vez en Supabase → SQL Editor → Run.
--
--  Problema que corrige: con varios retos simultáneos, todos comparaban el consumo
--  TOTAL del hogar, así que el mismo ahorro se contaba en cada reto (doble conteo
--  en puntos, clasificaciones y estadísticas comunitarias).
--
--  Ahora:
--    · Un reto con category_slug compara solo los aparatos de esa categoría.
--    · Un reto sin categoría compara todo el hogar.
--    · La categoría medida se congela al unirse (measured_category_slug), así que
--      si el admin edita el reto a mitad de semana la comparación sigue siendo justa.
-- =============================================================================

alter table public.challenge_participations
  add column if not exists measured_category_slug text;

comment on column public.challenge_participations.measured_category_slug is
  'Categoría de aparatos que mide esta participación (null = todo el hogar). Se fija al unirse.';

-- kWh semanales de un usuario, opcionalmente filtrados por categoría
create or replace function public.calc_user_weekly_kwh(p_user_id uuid, p_category_slug text)
returns numeric language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(a.watts * a.quantity * a.hours_per_day * a.days_per_week) / 1000.0, 0)::numeric
  from public.appliances a
  where a.user_id = p_user_id
    and (p_category_slug is null or a.category_slug = p_category_slug);
$$;

revoke execute on function public.calc_user_weekly_kwh(uuid, text) from public, anon, authenticated;

create or replace function public.join_challenge(p_challenge_id uuid)
returns public.challenge_participations
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid       uuid := auth.uid();
  v_ch        public.challenges%rowtype;
  v_baseline  numeric;
  v_existing  public.challenge_participations%rowtype;
  v_row       public.challenge_participations%rowtype;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;

  select * into v_ch from public.challenges c where c.id = p_challenge_id;
  if not found or not v_ch.is_active then
    raise exception 'El reto no existe o no está activo' using errcode = 'P0001';
  end if;
  if public.app_today() not between v_ch.week_start and v_ch.week_end then
    raise exception 'Este reto no está abierto esta semana' using errcode = 'P0001';
  end if;

  -- El reto mide solo los aparatos de su categoría (o todo el hogar si no tiene categoría)
  v_baseline := public.calc_user_weekly_kwh(v_uid, v_ch.category_slug);
  if v_baseline <= 0 then
    if v_ch.category_slug is null then
      raise exception 'Registra al menos un aparato antes de unirte a un reto' using errcode = 'P0001';
    else
      raise exception 'Este reto mide tus aparatos de %. Registra al menos uno de esa categoría para unirte.',
        coalesce((select c.name from public.categories c where c.slug = v_ch.category_slug), v_ch.category_slug)
        using errcode = 'P0001';
    end if;
  end if;

  select * into v_existing from public.challenge_participations cp
   where cp.user_id = v_uid and cp.challenge_id = p_challenge_id;

  if found then
    if v_existing.status <> 'abandonado' then
      raise exception 'Ya participas en este reto' using errcode = 'P0001';
    end if;
    update public.challenge_participations cp
       set status = 'activo', joined_at = now(), baseline_weekly_kwh = v_baseline,
           measured_category_slug = v_ch.category_slug,
           final_weekly_kwh = null, savings_kwh = null, savings_pct = null, savings_cost = null,
           savings_co2_kg = null, target_met = null, completed_at = null
     where cp.id = v_existing.id
    returning * into v_row;
  else
    insert into public.challenge_participations (user_id, challenge_id, baseline_weekly_kwh, measured_category_slug)
    values (v_uid, p_challenge_id, v_baseline, v_ch.category_slug)
    returning * into v_row;
  end if;

  return v_row;
end $$;

create or replace function public.complete_challenge(
  p_participation_id uuid, p_meter_reading_kwh numeric default null, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid         uuid := auth.uid();
  v_part        public.challenge_participations%rowtype;
  v_ch          public.challenges%rowtype;
  v_prof        public.profiles%rowtype;
  v_cfg         public.app_settings%rowtype;
  v_today       date := public.app_today();
  v_week        date := public.week_start_of(public.app_today());
  v_final       numeric;
  v_savings     numeric;
  v_pct         numeric;
  v_met         boolean;
  v_points      integer;
  v_streak      integer;
  v_streak_pts  integer := 0;
  v_badges      jsonb;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;

  select * into v_part from public.challenge_participations cp
   where cp.id = p_participation_id and cp.user_id = v_uid
   for update;
  if not found then
    raise exception 'Participación no encontrada' using errcode = 'P0001';
  end if;
  if v_part.status <> 'activo' then
    raise exception 'Este reto ya fue completado o abandonado' using errcode = 'P0001';
  end if;

  select * into v_ch   from public.challenges c where c.id = v_part.challenge_id;
  select * into v_cfg  from public.app_settings s where s.id = 1;
  select * into v_prof from public.profiles p where p.id = v_uid for update;

  if v_today > v_ch.week_end + coalesce(v_cfg.challenge_grace_days, 3) then
    raise exception 'El plazo para completar este reto ya terminó' using errcode = 'P0001';
  end if;

  -- Consumo DESPUÉS (estimado con los aparatos de la MISMA categoría medida al unirse)
  v_final   := public.calc_user_weekly_kwh(v_uid, v_part.measured_category_slug);
  v_savings := v_part.baseline_weekly_kwh - v_final;
  v_pct     := case when v_part.baseline_weekly_kwh > 0
                    then round(v_savings / v_part.baseline_weekly_kwh * 100, 2) else 0 end;
  v_met     := v_pct >= v_ch.target_reduction_pct;

  -- Puntos: 100% si cumple la meta, 50% si ahorró algo, 20% por participar
  v_points := case
                when v_met     then v_ch.points_reward
                when v_pct > 0 then round(v_ch.points_reward * 0.5)
                else                round(v_ch.points_reward * 0.2)
              end;

  update public.challenge_participations cp
     set status            = 'completado',
         final_weekly_kwh  = v_final,
         savings_kwh       = round(v_savings, 4),
         savings_pct       = v_pct,
         savings_cost      = round(greatest(v_savings, 0) * v_prof.tariff_per_kwh, 2),
         savings_co2_kg    = round(greatest(v_savings, 0) * public.co2_factor(), 4),
         target_met        = v_met,
         points_awarded    = v_points,
         completed_at      = now(),
         meter_reading_kwh = coalesce(p_meter_reading_kwh, cp.meter_reading_kwh),
         notes             = coalesce(left(p_notes, 1000), cp.notes)
   where cp.id = p_participation_id
  returning * into v_part;

  perform public.award_points(v_uid, v_points, 'reto_completado', v_part.id, 'Reto: ' || v_ch.title);

  -- Racha semanal (constancia)
  if v_prof.last_completed_week is distinct from v_week then
    if v_prof.last_completed_week = v_week - 7 then
      v_streak := v_prof.streak_weeks + 1;
    else
      v_streak := 1;
    end if;
    update public.profiles p set streak_weeks = v_streak, last_completed_week = v_week where p.id = v_uid;
    if v_streak >= 2 then
      v_streak_pts := least(v_streak * coalesce(v_cfg.streak_bonus_per_week, 10), coalesce(v_cfg.streak_bonus_cap, 50));
      perform public.award_points(v_uid, v_streak_pts, 'racha', null, 'Racha de ' || v_streak || ' semanas');
    end if;
  else
    v_streak := v_prof.streak_weeks;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('code', nb.code, 'name', nb.name, 'icon', nb.icon)), '[]'::jsonb)
    into v_badges from public.check_and_award_badges(v_uid) nb;

  select * into v_prof from public.profiles p where p.id = v_uid;

  return jsonb_build_object(
    'participation_id',     v_part.id,
    'baseline_weekly_kwh',  round(v_part.baseline_weekly_kwh, 3),
    'final_weekly_kwh',     round(v_final, 3),
    'savings_kwh',          round(v_savings, 3),
    'savings_pct',          v_pct,
    'savings_cost',         v_part.savings_cost,
    'savings_co2_kg',       v_part.savings_co2_kg,
    'target_reduction_pct', v_ch.target_reduction_pct,
    'target_met',           v_met,
    'points_awarded',       v_points,
    'streak_weeks',         v_streak,
    'streak_bonus',         v_streak_pts,
    'total_points',         v_prof.points,
    'level',                v_prof.level,
    'new_badges',           v_badges,
    'verification_note',    'Verificación aproximada: compara el consumo ESTIMADO de tus aparatos antes y después del reto.'
  );
end $$;

revoke execute on function public.join_challenge(uuid) from public, anon;
revoke execute on function public.complete_challenge(uuid, numeric, text) from public, anon;
grant execute on function public.join_challenge(uuid) to authenticated;
grant execute on function public.complete_challenge(uuid, numeric, text) to authenticated;
