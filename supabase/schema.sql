-- =============================================================================
--  PLATAFORMA DE AHORRO ENERGÉTICO COMUNITARIO (ODS 7)
--  schema.sql  ·  Backend compartido Web (Next.js) + Móvil (React Native/Expo)
-- =============================================================================
--  Cómo usarlo:
--    1. Supabase Dashboard → SQL Editor → New query.
--    2. Pega TODO este archivo y presiona "Run". Se ejecuta en una sola transacción
--       lógica; si algo falla, lee el mensaje y vuelve a ejecutar tras corregir.
--    3. Está pensado para un proyecto NUEVO. Si necesitas reiniciar desde cero,
--       ejecuta primero el bloque "RESET" (al final del archivo, comentado).
--
--  Reglas de arquitectura:
--    · TODA la lógica crítica (puntos, insignias, niveles, verificación de retos,
--      rankings, estadísticas) vive aquí, en funciones RPC y triggers.
--      Web y móvil solo llaman  supabase.rpc('nombre_funcion', { ... }).
--    · Las fórmulas de consumo son IDÉNTICAS a lib/energyCalculations.ts:
--        kWh_semana = (W × cantidad × horas_día × días_semana) / 1000
--        kWh_día    = kWh_semana / 7
--        kWh_mes    = kWh_semana × 52 / 12
--        kWh_año    = kWh_semana × 52
--        costo      = kWh × tarifa_por_kWh (del perfil)
--        CO2 (kg)   = kWh × factor_CO2 (app_settings.co2_kg_per_kwh)
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. TIPOS ENUM
-- -----------------------------------------------------------------------------
create type public.account_type          as enum ('hogar', 'negocio');
create type public.user_role             as enum ('user', 'admin');
create type public.participation_status  as enum ('activo', 'completado', 'abandonado');
create type public.verification_source   as enum ('manual', 'enchufe_inteligente', 'medidor_inteligente');
create type public.habit_type            as enum ('luces_sin_necesidad', 'dispositivos_standby', 'uso_aparato');
create type public.points_reason         as enum ('reto_completado', 'avance_registrado', 'habito_registrado', 'insignia', 'racha', 'ajuste_admin');
create type public.badge_criteria        as enum ('retos_completados', 'puntos_totales', 'aparatos_registrados', 'habitos_registrados', 'ahorro_kwh_total', 'racha_semanas', 'ahorro_pct_reto');
create type public.award_type            as enum ('oro', 'plata', 'bronce');

-- -----------------------------------------------------------------------------
-- 1. CONFIGURACIÓN GLOBAL (una sola fila, id = 1)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id                         smallint primary key default 1 check (id = 1),
  co2_kg_per_kwh             numeric(8,4)  not null default 0.444 check (co2_kg_per_kwh >= 0),  -- FESEN SEMARNAT 2024
  default_tariff_hogar       numeric(10,4) not null default 1.20  check (default_tariff_hogar > 0),
  default_tariff_negocio     numeric(10,4) not null default 4.00  check (default_tariff_negocio > 0),
  currency                   text          not null default 'MXN',
  timezone                   text          not null default 'America/Mexico_City',
  challenge_grace_days       smallint      not null default 3 check (challenge_grace_days between 0 and 14),
  points_progress_log        integer       not null default 5  check (points_progress_log >= 0),
  points_habit_log           integer       not null default 2  check (points_habit_log >= 0),
  streak_bonus_per_week      integer       not null default 10 check (streak_bonus_per_week >= 0),
  streak_bonus_cap           integer       not null default 50 check (streak_bonus_cap >= 0),
  updated_at                 timestamptz   not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES BÁSICAS
-- -----------------------------------------------------------------------------
create or replace function public.app_timezone()
returns text language sql stable set search_path = public, pg_temp as $$
  select coalesce((select s.timezone from public.app_settings s where s.id = 1), 'America/Mexico_City');
$$;

-- Fecha "de hoy" en la zona horaria de la plataforma
create or replace function public.app_today()
returns date language sql stable set search_path = public, pg_temp as $$
  select (now() at time zone public.app_timezone())::date;
$$;

-- Lunes de la semana a la que pertenece una fecha (semana ISO: lunes a domingo)
create or replace function public.week_start_of(p_date date)
returns date language sql immutable as $$
  select p_date - (extract(isodow from p_date)::int - 1);
$$;

create or replace function public.co2_factor()
returns numeric language sql stable set search_path = public, pg_temp as $$
  select coalesce((select s.co2_kg_per_kwh from public.app_settings s where s.id = 1), 0.444);
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. TABLAS DE CATÁLOGO
-- -----------------------------------------------------------------------------
create table public.levels (
  level       integer primary key check (level >= 1),
  name        text    not null,
  min_points  integer not null unique check (min_points >= 0),
  description text
);

create table public.categories (
  slug        text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name        text not null check (char_length(name) between 2 and 60),
  icon        text,                               -- nombre de ícono o emoji
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.communities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 120),
  municipality  text check (char_length(municipality) <= 120),
  state         text check (char_length(state) <= 80),
  postal_code   text check (postal_code ~ '^[0-9]{5}$'),
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create unique index communities_name_muni_uidx
  on public.communities (lower(name), lower(coalesce(municipality, '')));

-- -----------------------------------------------------------------------------
-- 4. PERFILES (1 a 1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null default '' check (char_length(full_name) <= 120),
  account_type         public.account_type not null default 'hogar',
  role                 public.user_role    not null default 'user',
  community_id         uuid references public.communities(id) on delete set null,
  tariff_per_kwh       numeric(10,4) not null default 1.20 check (tariff_per_kwh > 0 and tariff_per_kwh <= 100),
  avatar_url           text,
  points               integer not null default 0 check (points >= 0),
  level                integer not null default 1,
  streak_weeks         integer not null default 0,
  last_completed_week  date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index profiles_community_idx on public.profiles (community_id);

-- -----------------------------------------------------------------------------
-- 5. APARATOS
-- -----------------------------------------------------------------------------
create table public.appliance_catalog (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (char_length(name) between 2 and 100),
  category_slug          text not null references public.categories(slug) on update cascade on delete restrict,
  default_watts          numeric(10,2) not null check (default_watts > 0 and default_watts <= 20000),
  default_hours_per_day  numeric(4,2)  not null default 1 check (default_hours_per_day between 0 and 24),
  default_days_per_week  smallint      not null default 7 check (default_days_per_week between 0 and 7),
  description            text,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (name)
);
create index appliance_catalog_category_idx on public.appliance_catalog (category_slug);

create table public.appliances (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  catalog_id     uuid references public.appliance_catalog(id) on delete set null,
  name           text not null check (char_length(name) between 1 and 100),
  category_slug  text not null references public.categories(slug) on update cascade on delete restrict,
  watts          numeric(10,2) not null check (watts > 0 and watts <= 20000),
  quantity       integer       not null default 1 check (quantity between 1 and 500),
  hours_per_day  numeric(4,2)  not null check (hours_per_day between 0 and 24),
  days_per_week  smallint      not null default 7 check (days_per_week between 0 and 7),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index appliances_user_idx on public.appliances (user_id);

-- Foto diaria del consumo estimado del usuario (para la evolución histórica).
-- La llena un trigger cada vez que cambian sus aparatos o su tarifa.
create table public.consumption_snapshots (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  snapshot_date    date not null,
  appliance_count  integer not null,
  daily_kwh        numeric(14,4) not null,
  weekly_kwh       numeric(14,4) not null,
  monthly_kwh      numeric(14,4) not null,
  yearly_kwh       numeric(14,4) not null,
  tariff_per_kwh   numeric(10,4) not null,
  monthly_cost     numeric(14,2) not null,
  monthly_co2_kg   numeric(14,4) not null,
  updated_at       timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

-- -----------------------------------------------------------------------------
-- 6. HÁBITOS
-- -----------------------------------------------------------------------------
--  luces_sin_necesidad  → item_count = focos encendidos sin necesidad, hours_per_day = horas así
--  dispositivos_standby → item_count = aparatos conectados sin uso,    hours_per_day = horas así
--  uso_aparato          → appliance_id = aparato, hours_per_day = horas REALES de uso ese día
--  watts_per_item: si se omite, el trigger pone 15 W (foco), 5 W (standby) o los W del aparato.
create table public.habit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_date        date not null default public.app_today(),
  habit_type      public.habit_type not null,
  appliance_id    uuid references public.appliances(id) on delete set null,
  item_count      integer not null default 1 check (item_count between 1 and 500),
  watts_per_item  numeric(10,2) check (watts_per_item >= 0 and watts_per_item <= 20000),
  hours_per_day   numeric(4,2) not null check (hours_per_day between 0 and 24),
  days_per_week   smallint not null default 7 check (days_per_week between 0 and 7),
  notes           text check (char_length(notes) <= 500),
  created_at      timestamptz not null default now()
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);

-- -----------------------------------------------------------------------------
-- 7. RETOS SEMANALES
-- -----------------------------------------------------------------------------
create table public.challenges (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 3 and 120),
  description           text not null check (char_length(description) between 10 and 2000),
  tips                  text check (char_length(tips) <= 2000),
  category_slug         text references public.categories(slug) on update cascade on delete set null,
  target_reduction_pct  numeric(5,2) not null default 10 check (target_reduction_pct > 0 and target_reduction_pct <= 100),
  points_reward         integer not null default 50 check (points_reward between 0 and 1000),
  week_start            date not null check (extract(isodow from week_start) = 1),   -- siempre lunes
  week_end              date generated always as (week_start + 6) stored,          -- domingo
  is_active             boolean not null default true,
  created_by            uuid references auth.users(id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index challenges_week_idx on public.challenges (week_start, is_active);

create table public.challenge_participations (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  challenge_id             uuid not null references public.challenges(id) on delete cascade,
  status                   public.participation_status not null default 'activo',
  joined_at                timestamptz not null default now(),
  baseline_weekly_kwh      numeric(14,4) not null,          -- consumo estimado ANTES (al unirse)
  final_weekly_kwh         numeric(14,4),                   -- consumo estimado DESPUÉS (al completar)
  savings_kwh              numeric(14,4),                   -- baseline - final (puede ser negativo)
  savings_pct              numeric(7,2),
  savings_cost             numeric(14,2),
  savings_co2_kg           numeric(14,4),
  target_met               boolean,
  points_awarded           integer not null default 0,
  completed_at             timestamptz,
  -- Preparado para integración futura con medidores / enchufes inteligentes:
  verification_source      public.verification_source not null default 'manual',
  meter_reading_start_kwh  numeric(14,3) check (meter_reading_start_kwh >= 0),
  meter_reading_kwh        numeric(14,3) check (meter_reading_kwh >= 0),
  notes                    text check (char_length(notes) <= 1000),
  unique (user_id, challenge_id)
);
create index participations_user_idx      on public.challenge_participations (user_id, status);
create index participations_challenge_idx on public.challenge_participations (challenge_id, status);
create index participations_completed_idx on public.challenge_participations (completed_at) where status = 'completado';

create table public.challenge_progress_logs (
  id                 uuid primary key default gen_random_uuid(),
  participation_id   uuid not null references public.challenge_participations(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  log_date           date not null default public.app_today(),
  note               text check (char_length(note) <= 1000),
  meter_reading_kwh  numeric(14,3) check (meter_reading_kwh >= 0),
  points_awarded     integer not null default 0,
  created_at         timestamptz not null default now()
);
create index progress_logs_participation_idx on public.challenge_progress_logs (participation_id, log_date);

-- -----------------------------------------------------------------------------
-- 8. GAMIFICACIÓN
-- -----------------------------------------------------------------------------
create table public.badges (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z0-9_]{3,40}$'),
  name            text not null,
  description     text not null,
  icon            text,
  criteria_type   public.badge_criteria not null,
  criteria_value  numeric(12,2) not null check (criteria_value > 0),
  points_bonus    integer not null default 0 check (points_bonus >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.user_badges (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  badge_id    uuid not null references public.badges(id) on delete cascade,
  awarded_at  timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.points_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  points        integer not null,
  reason        public.points_reason not null,
  reference_id  uuid,
  description   text,
  created_at    timestamptz not null default now()
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);

create table public.community_awards (
  id                 uuid primary key default gen_random_uuid(),
  community_id       uuid not null references public.communities(id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  award              public.award_type not null,
  rank               smallint not null check (rank between 1 and 3),
  participants       integer not null,
  avg_savings_pct    numeric(7,2) not null,
  total_savings_kwh  numeric(14,4) not null,
  created_at         timestamptz not null default now(),
  unique (community_id, period_start),
  unique (period_start, rank)
);

-- -----------------------------------------------------------------------------
-- 9. TRIGGERS updated_at
-- -----------------------------------------------------------------------------
create trigger trg_categories_updated        before update on public.categories        for each row execute function public.set_updated_at();
create trigger trg_profiles_updated          before update on public.profiles          for each row execute function public.set_updated_at();
create trigger trg_catalog_updated           before update on public.appliance_catalog for each row execute function public.set_updated_at();
create trigger trg_appliances_updated        before update on public.appliances        for each row execute function public.set_updated_at();
create trigger trg_challenges_updated        before update on public.challenges        for each row execute function public.set_updated_at();
create trigger trg_app_settings_updated      before update on public.app_settings      for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 10. FUNCIONES INTERNAS (no expuestas a clientes)
-- -----------------------------------------------------------------------------

-- ¿El usuario actual es admin?  (se usa en políticas RLS)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- kWh por SEMANA estimados de todos los aparatos de un usuario
create or replace function public.calc_user_weekly_kwh(p_user_id uuid)
returns numeric language sql stable set search_path = public, pg_temp as $$
  select coalesce(sum(a.watts * a.quantity * a.hours_per_day * a.days_per_week) / 1000.0, 0)::numeric
  from public.appliances a
  where a.user_id = p_user_id;
$$;

create or replace function public.level_for_points(p_points integer)
returns integer language sql stable set search_path = public, pg_temp as $$
  select coalesce(max(l.level), 1) from public.levels l where l.min_points <= p_points;
$$;

-- Guarda/actualiza la foto de consumo del día
create or replace function public.refresh_consumption_snapshot(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week   numeric;
  v_tariff numeric;
  v_count  integer;
  v_co2    numeric := public.co2_factor();
begin
  select p.tariff_per_kwh into v_tariff from public.profiles p where p.id = p_user_id;
  if not found then
    return;  -- el perfil ya no existe (p. ej. borrado en cascada)
  end if;
  v_week := public.calc_user_weekly_kwh(p_user_id);
  select count(*) into v_count from public.appliances a where a.user_id = p_user_id;

  insert into public.consumption_snapshots as cs
    (user_id, snapshot_date, appliance_count, daily_kwh, weekly_kwh, monthly_kwh, yearly_kwh,
     tariff_per_kwh, monthly_cost, monthly_co2_kg, updated_at)
  values
    (p_user_id, public.app_today(), v_count, v_week / 7, v_week, v_week * 52 / 12, v_week * 52,
     v_tariff, round(v_week * 52 / 12 * v_tariff, 2), v_week * 52 / 12 * v_co2, now())
  on conflict (user_id, snapshot_date) do update set
    appliance_count = excluded.appliance_count,
    daily_kwh       = excluded.daily_kwh,
    weekly_kwh      = excluded.weekly_kwh,
    monthly_kwh     = excluded.monthly_kwh,
    yearly_kwh      = excluded.yearly_kwh,
    tariff_per_kwh  = excluded.tariff_per_kwh,
    monthly_cost    = excluded.monthly_cost,
    monthly_co2_kg  = excluded.monthly_co2_kg,
    updated_at      = now();
end $$;

-- Inserta un movimiento de puntos (el trigger del ledger actualiza perfil y nivel)
create or replace function public.award_points(
  p_user_id uuid, p_points integer, p_reason public.points_reason,
  p_reference_id uuid default null, p_description text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_points is null or p_points = 0 then
    return;
  end if;
  insert into public.points_ledger (user_id, points, reason, reference_id, description)
  values (p_user_id, p_points, p_reason, p_reference_id, p_description);
end $$;

-- Revisa y otorga insignias pendientes. Devuelve las NUEVAS insignias obtenidas.
create or replace function public.check_and_award_badges(p_user_id uuid)
returns setof public.badges language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b             public.badges%rowtype;
  v_metric      numeric;
  m_completed   integer;
  m_savings     numeric;
  m_best_pct    numeric;
  m_appliances  integer;
  m_habits      integer;
  m_streak      integer;
begin
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    return;
  end if;

  select count(*),
         coalesce(sum(greatest(cp.savings_kwh, 0)), 0),
         coalesce(max(cp.savings_pct), 0)
    into m_completed, m_savings, m_best_pct
  from public.challenge_participations cp
  where cp.user_id = p_user_id and cp.status = 'completado';

  select count(*) into m_appliances from public.appliances a where a.user_id = p_user_id;
  select count(*) into m_habits     from public.habit_logs h where h.user_id = p_user_id;
  select p.streak_weeks into m_streak from public.profiles p where p.id = p_user_id;

  for b in
    select bd.* from public.badges bd
    where bd.is_active
      and not exists (select 1 from public.user_badges ub where ub.user_id = p_user_id and ub.badge_id = bd.id)
    order by (bd.criteria_type = 'puntos_totales'), bd.criteria_value   -- puntos al final
  loop
    v_metric := case b.criteria_type
      when 'retos_completados'    then m_completed
      when 'ahorro_kwh_total'     then m_savings
      when 'ahorro_pct_reto'      then m_best_pct
      when 'aparatos_registrados' then m_appliances
      when 'habitos_registrados'  then m_habits
      when 'racha_semanas'        then m_streak
      when 'puntos_totales'       then (select p.points from public.profiles p where p.id = p_user_id)
    end;

    if v_metric >= b.criteria_value then
      insert into public.user_badges (user_id, badge_id) values (p_user_id, b.id)
      on conflict do nothing;
      if found then
        perform public.award_points(p_user_id, b.points_bonus, 'insignia', b.id, 'Insignia: ' || b.name);
        return next b;
      end if;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 11. TRIGGERS DE NEGOCIO
-- -----------------------------------------------------------------------------

-- 11.1 Crear perfil automáticamente al registrarse (lee options.data del signUp)
--      Acepta community_id o new_community_name (+ new_community_municipality). Ver migración 002.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 11.2 Ledger de puntos → actualiza puntos y nivel del perfil
create or replace function public.on_points_ledger_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles p
     set points = greatest(0, p.points + new.points),
         level  = public.level_for_points(greatest(0, p.points + new.points))
   where p.id = new.user_id;
  return null;
end $$;

create trigger trg_points_ledger_insert
  after insert on public.points_ledger
  for each row execute function public.on_points_ledger_insert();

-- 11.3 Cambios en aparatos → foto de consumo + insignias
create or replace function public.on_appliances_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_consumption_snapshot(old.user_id);
  else
    perform public.refresh_consumption_snapshot(new.user_id);
    if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
      perform public.refresh_consumption_snapshot(old.user_id);
    end if;
    if tg_op = 'INSERT' then
      perform public.check_and_award_badges(new.user_id);
    end if;
  end if;
  return null;
end $$;

create trigger trg_appliances_change
  after insert or update or delete on public.appliances
  for each row execute function public.on_appliances_change();

-- 11.4 Cambio de tarifa → nueva foto de consumo
create or replace function public.on_profile_tariff_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.refresh_consumption_snapshot(new.id);
  return null;
end $$;

create trigger trg_profile_tariff_change
  after update of tariff_per_kwh on public.profiles
  for each row when (old.tariff_per_kwh is distinct from new.tariff_per_kwh)
  execute function public.on_profile_tariff_change();

-- 11.5 Hábitos: valor por defecto de watts (antes de insertar)
create or replace function public.before_habit_log_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.appliance_id is not null and not exists (
      select 1 from public.appliances a where a.id = new.appliance_id and a.user_id = new.user_id) then
    raise exception 'El aparato indicado no pertenece a tu cuenta' using errcode = 'P0001';
  end if;

  if new.watts_per_item is null then
    new.watts_per_item := case new.habit_type
      when 'luces_sin_necesidad'  then 15
      when 'dispositivos_standby' then 5
      when 'uso_aparato' then coalesce((select a.watts from public.appliances a where a.id = new.appliance_id), 0)
    end;
  end if;
  return new;
end $$;

create trigger trg_habit_logs_before_insert
  before insert on public.habit_logs
  for each row execute function public.before_habit_log_insert();

-- 11.6 Hábitos: puntos (máx. una vez al día) + insignias
create or replace function public.after_habit_log_insert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_points integer := coalesce((select s.points_habit_log from public.app_settings s where s.id = 1), 2);
begin
  if not exists (
      select 1 from public.points_ledger pl
      where pl.user_id = new.user_id
        and pl.reason = 'habito_registrado'
        and (pl.created_at at time zone public.app_timezone())::date = public.app_today()) then
    perform public.award_points(new.user_id, v_points, 'habito_registrado', new.id, 'Registro de hábitos');
  end if;
  perform public.check_and_award_badges(new.user_id);
  return null;
end $$;

create trigger trg_habit_logs_after_insert
  after insert on public.habit_logs
  for each row execute function public.after_habit_log_insert();

-- -----------------------------------------------------------------------------
-- 12. FUNCIONES RPC PÚBLICAS (las que llaman Web y Móvil)
-- -----------------------------------------------------------------------------

-- 12.1 Resumen de consumo en 4 periodos
create or replace function public.get_my_consumption_summary()
returns table (period text, kwh numeric, cost numeric, co2_kg numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with base as (
    select public.calc_user_weekly_kwh(p.id) as wk, p.tariff_per_kwh as tariff, public.co2_factor() as co2
    from public.profiles p where p.id = auth.uid()
  )
  select v.period, round(v.k, 3), round(v.k * b.tariff, 2), round(v.k * b.co2, 3)
  from base b
  cross join lateral (values
    ('diario',  b.wk / 7,       1),
    ('semanal', b.wk,           2),
    ('mensual', b.wk * 52 / 12, 3),
    ('anual',   b.wk * 52,      4)
  ) as v(period, k, ord)
  order by v.ord;
$$;

-- 12.2 Consumo mensual por categoría
create or replace function public.get_my_consumption_by_category()
returns table (category_slug text, category_name text, appliance_count bigint,
               monthly_kwh numeric, monthly_cost numeric, monthly_co2_kg numeric, pct numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (
    select p.id, p.tariff_per_kwh as tariff from public.profiles p where p.id = auth.uid()
  ),
  per_cat as (
    select a.category_slug,
           count(*) as n,
           sum(a.watts * a.quantity * a.hours_per_day * a.days_per_week) / 1000.0 * 52 / 12 as month_kwh
    from public.appliances a join me on a.user_id = me.id
    group by a.category_slug
  ),
  total as (select coalesce(sum(month_kwh), 0) as t from per_cat)
  select pc.category_slug, c.name, pc.n,
         round(pc.month_kwh, 3),
         round(pc.month_kwh * me.tariff, 2),
         round(pc.month_kwh * public.co2_factor(), 3),
         case when total.t > 0 then round(pc.month_kwh / total.t * 100, 2) else 0 end
  from per_cat pc
  join public.categories c on c.slug = pc.category_slug
  cross join me cross join total
  order by pc.month_kwh desc;
$$;

-- 12.3 Consumo mensual por aparato
create or replace function public.get_my_consumption_by_appliance()
returns table (appliance_id uuid, name text, category_slug text,
               monthly_kwh numeric, monthly_cost numeric, monthly_co2_kg numeric, pct numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (
    select p.id, p.tariff_per_kwh as tariff from public.profiles p where p.id = auth.uid()
  ),
  per_app as (
    select a.id, a.name, a.category_slug,
           a.watts * a.quantity * a.hours_per_day * a.days_per_week / 1000.0 * 52 / 12 as month_kwh
    from public.appliances a join me on a.user_id = me.id
  ),
  total as (select coalesce(sum(month_kwh), 0) as t from per_app)
  select pa.id, pa.name, pa.category_slug,
         round(pa.month_kwh, 3),
         round(pa.month_kwh * me.tariff, 2),
         round(pa.month_kwh * public.co2_factor(), 3),
         case when total.t > 0 then round(pa.month_kwh / total.t * 100, 2) else 0 end
  from per_app pa cross join me cross join total
  order by pa.month_kwh desc;
$$;

-- 12.4 Retos vigentes (semana actual + periodo de gracia) con mi estado
create or replace function public.get_active_challenges()
returns table (id uuid, title text, description text, tips text, category_slug text,
               target_reduction_pct numeric, points_reward integer, week_start date, week_end date,
               can_join boolean, participants_count bigint,
               my_participation_id uuid, my_status public.participation_status)
language sql stable security definer set search_path = public, pg_temp as $$
  with t as (
    select public.app_today() as today,
           coalesce((select s.challenge_grace_days from public.app_settings s where s.id = 1), 3) as grace
  )
  select c.id, c.title, c.description, c.tips, c.category_slug,
         c.target_reduction_pct, c.points_reward, c.week_start, c.week_end,
         (t.today between c.week_start and c.week_end) as can_join,
         (select count(*) from public.challenge_participations x
           where x.challenge_id = c.id and x.status <> 'abandonado'),
         mine.id, mine.status
  from public.challenges c
  cross join t
  left join public.challenge_participations mine
         on mine.challenge_id = c.id and mine.user_id = auth.uid()
  where auth.uid() is not null
    and c.is_active
    and c.week_start <= t.today
    and c.week_end + t.grace >= t.today
  order by c.week_start desc, c.created_at;
$$;

-- 12.5 Unirse a un reto (guarda el consumo "ANTES")
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

  v_baseline := public.calc_user_weekly_kwh(v_uid);
  if v_baseline <= 0 then
    raise exception 'Registra al menos un aparato antes de unirte a un reto' using errcode = 'P0001';
  end if;

  select * into v_existing from public.challenge_participations cp
   where cp.user_id = v_uid and cp.challenge_id = p_challenge_id;

  if found then
    if v_existing.status <> 'abandonado' then
      raise exception 'Ya participas en este reto' using errcode = 'P0001';
    end if;
    update public.challenge_participations cp
       set status = 'activo', joined_at = now(), baseline_weekly_kwh = v_baseline,
           final_weekly_kwh = null, savings_kwh = null, savings_pct = null, savings_cost = null,
           savings_co2_kg = null, target_met = null, completed_at = null
     where cp.id = v_existing.id
    returning * into v_row;
  else
    insert into public.challenge_participations (user_id, challenge_id, baseline_weekly_kwh)
    values (v_uid, p_challenge_id, v_baseline)
    returning * into v_row;
  end if;

  return v_row;
end $$;

-- 12.6 Registrar avance diario de un reto (+puntos, máx. 1 vez al día por reto)
create or replace function public.log_challenge_progress(
  p_participation_id uuid, p_note text default null, p_meter_reading_kwh numeric default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid     uuid := auth.uid();
  v_part    public.challenge_participations%rowtype;
  v_points  integer := 0;
  v_cfg     integer := coalesce((select s.points_progress_log from public.app_settings s where s.id = 1), 5);
  v_log_id  uuid;
  v_badges  jsonb;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;

  select * into v_part from public.challenge_participations cp
   where cp.id = p_participation_id and cp.user_id = v_uid;
  if not found then
    raise exception 'Participación no encontrada' using errcode = 'P0001';
  end if;
  if v_part.status <> 'activo' then
    raise exception 'Solo puedes registrar avances en retos activos' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.challenge_progress_logs l
                  where l.participation_id = p_participation_id and l.log_date = public.app_today()) then
    v_points := v_cfg;
  end if;

  insert into public.challenge_progress_logs (participation_id, user_id, note, meter_reading_kwh, points_awarded)
  values (p_participation_id, v_uid, left(p_note, 1000), p_meter_reading_kwh, v_points)
  returning id into v_log_id;

  if p_meter_reading_kwh is not null then
    update public.challenge_participations cp
       set meter_reading_start_kwh = coalesce(cp.meter_reading_start_kwh, p_meter_reading_kwh)
     where cp.id = p_participation_id;
  end if;

  perform public.award_points(v_uid, v_points, 'avance_registrado', v_log_id, 'Avance de reto');

  select coalesce(jsonb_agg(jsonb_build_object('code', nb.code, 'name', nb.name, 'icon', nb.icon)), '[]'::jsonb)
    into v_badges from public.check_and_award_badges(v_uid) nb;

  return jsonb_build_object('log_id', v_log_id, 'points_awarded', v_points, 'new_badges', v_badges);
end $$;

-- 12.7 Completar reto: compara consumo ANTES vs DESPUÉS, da puntos, racha e insignias
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

  -- Consumo DESPUÉS (estimado con los aparatos tal como están ahora)
  v_final   := public.calc_user_weekly_kwh(v_uid);
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

-- 12.8 Abandonar reto
create or replace function public.abandon_challenge(p_participation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode = '28000';
  end if;
  update public.challenge_participations cp
     set status = 'abandonado'
   where cp.id = p_participation_id and cp.user_id = auth.uid() and cp.status = 'activo';
  if not found then
    raise exception 'No hay un reto activo con ese id' using errcode = 'P0001';
  end if;
end $$;

-- 12.9 Mi gamificación (puntos, nivel, racha e insignias)
create or replace function public.get_my_gamification()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'points',             p.points,
    'level',              p.level,
    'level_name',         (select l.name from public.levels l where l.level = p.level),
    'current_level_min',  (select l.min_points from public.levels l where l.level = p.level),
    'next_level_min',     (select min(l.min_points) from public.levels l where l.min_points > p.points),
    'streak_weeks',       p.streak_weeks,
    'completed_challenges', (select count(*) from public.challenge_participations cp
                              where cp.user_id = p.id and cp.status = 'completado'),
    'total_savings_kwh',  (select coalesce(round(sum(greatest(cp.savings_kwh, 0)), 3), 0)
                             from public.challenge_participations cp
                            where cp.user_id = p.id and cp.status = 'completado'),
    'badges', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'code', b.code, 'name', b.name, 'description', b.description, 'icon', b.icon,
                 'earned', ub.user_id is not null, 'awarded_at', ub.awarded_at)
               order by (ub.user_id is null), b.criteria_type, b.criteria_value)
        from public.badges b
        left join public.user_badges ub on ub.badge_id = b.id and ub.user_id = p.id
        where b.is_active), '[]'::jsonb)
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- 12.10 Historial semanal de MI ahorro (para gráficas de evolución)
create or replace function public.get_my_savings_history(p_weeks integer default 12)
returns table (week_start date, savings_kwh numeric, savings_cost numeric, savings_co2_kg numeric,
               completed_challenges bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with weeks as (
    select gs::date as wk
    from generate_series(
      public.week_start_of(public.app_today()) - (least(greatest(p_weeks, 1), 104) - 1) * 7,
      public.week_start_of(public.app_today()),
      interval '7 days') gs
  ),
  done as (
    select public.week_start_of((cp.completed_at at time zone public.app_timezone())::date) as wk,
           greatest(cp.savings_kwh, 0) as kwh, cp.savings_cost, cp.savings_co2_kg
    from public.challenge_participations cp
    where cp.user_id = auth.uid() and cp.status = 'completado'
  )
  select w.wk,
         round(coalesce(sum(d.kwh), 0), 3),
         round(coalesce(sum(d.savings_cost), 0), 2),
         round(coalesce(sum(d.savings_co2_kg), 0), 3),
         count(d.wk)
  from weeks w left join done d on d.wk = w.wk
  where auth.uid() is not null
  group by w.wk
  order by w.wk;
$$;

-- 12.11 Clasificación individual (por % de ahorro estimado promedio)
--   p_scope: 'global' | 'comunidad'
create or replace function public.get_leaderboard(
  p_scope text default 'global', p_days integer default 30, p_limit integer default 20)
returns table (rank bigint, user_id uuid, display_name text, community_name text,
               avg_savings_pct numeric, total_savings_kwh numeric, completed_challenges bigint,
               points integer, level integer, is_me boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (
    select p.id, p.community_id from public.profiles p where p.id = auth.uid()
  ),
  stats as (
    select cp.user_id,
           avg(least(greatest(cp.savings_pct, 0), 100)) as avg_pct,
           sum(greatest(cp.savings_kwh, 0))             as kwh,
           count(*)                                     as n
    from public.challenge_participations cp
    where cp.status = 'completado'
      and cp.completed_at >= now() - make_interval(days => least(greatest(p_days, 1), 3650))
    group by cp.user_id
  ),
  ranked as (
    select row_number() over (order by s.avg_pct desc, p.points desc, p.created_at) as rnk,
           p.id, p.full_name, c.name as cname, s.avg_pct, s.kwh, s.n, p.points, p.level
    from stats s
    join public.profiles p on p.id = s.user_id
    left join public.communities c on c.id = p.community_id
    where p_scope = 'global'
       or (p_scope = 'comunidad' and p.community_id is not null
           and p.community_id = (select me.community_id from me))
  )
  select r.rnk, r.id,
         coalesce(nullif(trim(split_part(trim(r.full_name), ' ', 1)
                  || coalesce(' ' || nullif(left(split_part(trim(r.full_name), ' ', 2), 1), '') || '.', '')), ''),
                  'Usuario'),
         r.cname, round(r.avg_pct, 2), round(r.kwh, 3), r.n, r.points, r.level,
         r.id = (select me.id from me)
  from ranked r
  where exists (select 1 from me)
    and (r.rnk <= least(greatest(p_limit, 1), 100) or r.id = (select me.id from me))
  order by r.rnk;
$$;

-- 12.12 Clasificación de comunidades
create or replace function public.get_community_ranking(p_days integer default 30, p_limit integer default 20)
returns table (rank bigint, community_id uuid, community_name text, municipality text,
               participants bigint, avg_savings_pct numeric, total_savings_kwh numeric,
               total_savings_cost numeric, total_savings_co2_kg numeric,
               gold_awards bigint, total_awards bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with stats as (
    select p.community_id,
           count(distinct cp.user_id)                       as participants,
           avg(least(greatest(cp.savings_pct, 0), 100))     as avg_pct,
           sum(greatest(cp.savings_kwh, 0))                 as kwh,
           sum(coalesce(cp.savings_cost, 0))                as cost,
           sum(coalesce(cp.savings_co2_kg, 0))              as co2
    from public.challenge_participations cp
    join public.profiles p on p.id = cp.user_id
    where cp.status = 'completado' and p.community_id is not null
      and cp.completed_at >= now() - make_interval(days => least(greatest(p_days, 1), 3650))
    group by p.community_id
  )
  select row_number() over (order by s.avg_pct desc, s.kwh desc, c.name) as rnk,
         c.id, c.name, c.municipality, s.participants,
         round(s.avg_pct, 2), round(s.kwh, 3), round(s.cost, 2), round(s.co2, 3),
         (select count(*) from public.community_awards ca where ca.community_id = c.id and ca.award = 'oro'),
         (select count(*) from public.community_awards ca where ca.community_id = c.id)
  from stats s join public.communities c on c.id = s.community_id
  order by rnk
  limit least(greatest(p_limit, 1), 100);
$$;

-- 12.13 Estadísticas comunitarias (p_community_id = null → toda la plataforma)
create or replace function public.get_community_stats(p_community_id uuid default null, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_days    integer := least(greatest(p_days, 1), 3650);
  v_result  jsonb;
begin
  with members as (
    select p.id from public.profiles p
    where p_community_id is null or p.community_id = p_community_id
  ),
  parts as (
    select cp.*, c.title, c.week_start as ch_week
    from public.challenge_participations cp
    join members m on m.id = cp.user_id
    join public.challenges c on c.id = cp.challenge_id
  ),
  done as (select * from parts where status = 'completado'),
  active_users as (
    select user_id from parts where joined_at >= now() - make_interval(days => v_days)
    union
    select h.user_id from public.habit_logs h join members m on m.id = h.user_id
     where h.created_at >= now() - make_interval(days => v_days)
    union
    select l.user_id from public.challenge_progress_logs l join members m on m.id = l.user_id
     where l.created_at >= now() - make_interval(days => v_days)
  ),
  top_ch as (
    select d.challenge_id, d.title, count(*) as completions,
           round(avg(least(greatest(d.savings_pct, 0), 100)), 2) as avg_savings_pct,
           round(sum(greatest(d.savings_kwh, 0)), 3) as total_savings_kwh
    from done d
    group by d.challenge_id, d.title
    order by sum(greatest(d.savings_kwh, 0)) desc, count(*) desc
    limit 5
  ),
  weeks as (
    select gs::date as wk
    from generate_series(public.week_start_of(public.app_today()) - 7 * 7,
                         public.week_start_of(public.app_today()), interval '7 days') gs
  ),
  series as (
    select w.wk,
           round(coalesce(sum(greatest(d.savings_kwh, 0)), 0), 3) as kwh,
           round(coalesce(sum(d.savings_cost), 0), 2)            as cost,
           round(coalesce(sum(d.savings_co2_kg), 0), 3)          as co2,
           count(distinct d.user_id)                             as participants
    from weeks w left join done d on d.ch_week = w.wk
    group by w.wk
  )
  select jsonb_build_object(
    'community_id',          p_community_id,
    'community_name',        (select c.name from public.communities c where c.id = p_community_id),
    'currency',              (select s.currency from public.app_settings s where s.id = 1),
    'total_members',         (select count(*) from members),
    'active_participants',   (select count(*) from active_users),
    'challenges_completed',  (select count(*) from done),
    'total_savings_kwh',     (select round(coalesce(sum(greatest(savings_kwh, 0)), 0), 3) from done),
    'total_savings_cost',    (select round(coalesce(sum(savings_cost), 0), 2) from done),
    'total_savings_co2_kg',  (select round(coalesce(sum(savings_co2_kg), 0), 3) from done),
    'avg_savings_pct',       (select round(coalesce(avg(least(greatest(savings_pct, 0), 100)), 0), 2) from done),
    'top_challenges',        coalesce((select jsonb_agg(to_jsonb(t) order by t.total_savings_kwh desc, t.completions desc) from top_ch t), '[]'::jsonb),
    'weekly_series',         coalesce((select jsonb_agg(jsonb_build_object(
                                 'week_start', s.wk, 'savings_kwh', s.kwh, 'savings_cost', s.cost,
                                 'savings_co2_kg', s.co2, 'participants', s.participants) order by s.wk)
                               from series s), '[]'::jsonb),
    'awards',                coalesce((select jsonb_agg(jsonb_build_object(
                                 'period_start', ca.period_start, 'award', ca.award, 'rank', ca.rank)
                                 order by ca.period_start desc)
                               from public.community_awards ca
                               where p_community_id is not null and ca.community_id = p_community_id), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

-- -----------------------------------------------------------------------------
-- 13. RPC DE ADMINISTRADOR
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'No puedes quitarte tu propio rol de administrador' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'Usuario no encontrado' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50)
returns table (id uuid, email text, full_name text, account_type public.account_type, role public.user_role,
               community_name text, points integer, level integer, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.full_name, p.account_type, p.role, c.name, p.points, p.level, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.communities c on c.id = p.community_id
    where p_search is null or p_search = ''
       or p.full_name ilike '%' || p_search || '%'
       or u.email ilike '%' || p_search || '%'
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 500);
end $$;

-- Otorga reconocimientos (oro/plata/bronce) a las 3 mejores comunidades de una semana
create or replace function public.admin_grant_community_awards(p_week_start date default null)
returns setof public.community_awards
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_week date := public.week_start_of(coalesce(p_week_start, public.app_today() - 7));
begin
  if not public.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;

  return query
  insert into public.community_awards
    (community_id, period_start, period_end, award, rank, participants, avg_savings_pct, total_savings_kwh)
  select r.community_id, v_week, v_week + 6,
         (array['oro', 'plata', 'bronce'])[r.rnk]::public.award_type,
         r.rnk, r.participants, r.avg_pct, r.kwh
  from (
    select p.community_id,
           row_number() over (order by avg(least(greatest(cp.savings_pct, 0), 100)) desc,
                                       sum(greatest(cp.savings_kwh, 0)) desc) as rnk,
           count(distinct cp.user_id)                          as participants,
           round(avg(least(greatest(cp.savings_pct, 0), 100)), 2) as avg_pct,
           round(sum(greatest(cp.savings_kwh, 0)), 4)          as kwh
    from public.challenge_participations cp
    join public.challenges ch on ch.id = cp.challenge_id
    join public.profiles p on p.id = cp.user_id
    where cp.status = 'completado' and ch.week_start = v_week and p.community_id is not null
    group by p.community_id
  ) r
  where r.rnk <= 3
  on conflict do nothing
  returning *;
end $$;

-- -----------------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.app_settings             enable row level security;
alter table public.levels                   enable row level security;
alter table public.categories               enable row level security;
alter table public.communities              enable row level security;
alter table public.profiles                 enable row level security;
alter table public.appliance_catalog        enable row level security;
alter table public.appliances               enable row level security;
alter table public.consumption_snapshots    enable row level security;
alter table public.habit_logs               enable row level security;
alter table public.challenges               enable row level security;
alter table public.challenge_participations enable row level security;
alter table public.challenge_progress_logs  enable row level security;
alter table public.badges                   enable row level security;
alter table public.user_badges              enable row level security;
alter table public.points_ledger            enable row level security;
alter table public.community_awards         enable row level security;

-- Catálogos públicos: todos leen, solo admin escribe
create policy "app_settings: lectura pública"  on public.app_settings      for select using (true);
create policy "app_settings: admin actualiza"  on public.app_settings      for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "levels: lectura pública"        on public.levels            for select using (true);
create policy "levels: admin escribe"          on public.levels            for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "categories: lectura"            on public.categories        for select using (is_active or public.is_admin());
create policy "categories: admin escribe"      on public.categories        for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "catalog: lectura"               on public.appliance_catalog for select using (is_active or public.is_admin());
create policy "catalog: admin escribe"         on public.appliance_catalog for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "badges: lectura"                on public.badges            for select using (is_active or public.is_admin());
create policy "badges: admin escribe"          on public.badges            for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "awards: lectura pública"        on public.community_awards  for select using (true);

-- Comunidades: todos leen; usuarios autenticados crean; solo admin edita/borra
create policy "communities: lectura pública"   on public.communities for select using (true);
create policy "communities: crear"             on public.communities for insert to authenticated with check (created_by = auth.uid());
create policy "communities: admin actualiza"   on public.communities for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "communities: admin borra"       on public.communities for delete to authenticated using (public.is_admin());

-- Perfiles: cada quien ve y edita el suyo (columnas limitadas por GRANT); admin ve todos
create policy "profiles: ver propio o admin"   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: editar propio"        on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Aparatos y hábitos: CRUD solo del dueño; admin puede leer
create policy "appliances: ver"                on public.appliances for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "appliances: crear"              on public.appliances for insert to authenticated with check (user_id = auth.uid());
create policy "appliances: editar"             on public.appliances for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "appliances: borrar"             on public.appliances for delete to authenticated using (user_id = auth.uid());

create policy "habits: ver"                    on public.habit_logs for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "habits: crear"                  on public.habit_logs for insert to authenticated with check (user_id = auth.uid());
create policy "habits: editar"                 on public.habit_logs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "habits: borrar"                 on public.habit_logs for delete to authenticated using (user_id = auth.uid());

-- Retos: todos ven los activos; admin ve y gestiona todos
create policy "challenges: lectura"            on public.challenges for select using (is_active or public.is_admin());
create policy "challenges: admin escribe"      on public.challenges for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Datos calculados: SOLO lectura del dueño. Escritura únicamente vía RPC/trigger.
create policy "snapshots: ver propio"          on public.consumption_snapshots    for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "participations: ver propio"     on public.challenge_participations for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "progress: ver propio"           on public.challenge_progress_logs  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "user_badges: ver propio"        on public.user_badges              for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "ledger: ver propio"             on public.points_ledger            for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- 15. PRIVILEGIOS (GRANTS)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- Base: RLS decide qué filas; los GRANT deciden qué operaciones existen
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- anon no necesita ver datos de usuarios (de todos modos RLS lo bloquea)
revoke select on public.profiles, public.appliances, public.habit_logs, public.consumption_snapshots,
                 public.challenge_participations, public.challenge_progress_logs,
                 public.user_badges, public.points_ledger from anon;

-- Perfiles: el usuario solo puede editar estas columnas (NO role, points, level, streak)
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, account_type, community_id, tariff_per_kwh, avatar_url) on public.profiles to authenticated;

-- Tablas calculadas: nadie escribe directo desde el cliente
revoke insert, update, delete on public.consumption_snapshots, public.challenge_participations,
       public.challenge_progress_logs, public.user_badges, public.points_ledger,
       public.community_awards from authenticated;

-- Funciones: quitar todo y conceder solo lo necesario
revoke execute on all functions in schema public from public, anon, authenticated;

-- Usadas por RLS / valores por defecto (deben poder ejecutarse como el usuario)
grant execute on function public.is_admin()              to anon, authenticated;
grant execute on function public.app_today()             to anon, authenticated;
grant execute on function public.app_timezone()          to anon, authenticated;
grant execute on function public.week_start_of(date)     to anon, authenticated;
grant execute on function public.co2_factor()            to anon, authenticated;

-- API para clientes autenticados
grant execute on function public.get_my_consumption_summary()                       to authenticated;
grant execute on function public.get_my_consumption_by_category()                   to authenticated;
grant execute on function public.get_my_consumption_by_appliance()                  to authenticated;
grant execute on function public.get_active_challenges()                            to authenticated;
grant execute on function public.join_challenge(uuid)                               to authenticated;
grant execute on function public.log_challenge_progress(uuid, text, numeric)        to authenticated;
grant execute on function public.complete_challenge(uuid, numeric, text)            to authenticated;
grant execute on function public.abandon_challenge(uuid)                            to authenticated;
grant execute on function public.get_my_gamification()                              to authenticated;
grant execute on function public.get_my_savings_history(integer)                    to authenticated;
grant execute on function public.get_leaderboard(text, integer, integer)            to authenticated;
grant execute on function public.admin_set_user_role(uuid, public.user_role)        to authenticated;
grant execute on function public.admin_list_users(text, integer)                    to authenticated;
grant execute on function public.admin_grant_community_awards(date)                 to authenticated;

-- Estadísticas agregadas: también visibles sin sesión (página pública)
grant execute on function public.get_community_stats(uuid, integer)                 to anon, authenticated;
grant execute on function public.get_community_ranking(integer, integer)            to anon, authenticated;

grant all on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- 16. DATOS SEMILLA
-- -----------------------------------------------------------------------------
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

insert into public.levels (level, name, min_points, description) values
  (1, 'Chispa',                 0,    'Acabas de encender tu camino al ahorro.'),
  (2, 'Foco Ahorrador',         100,  'Ya identificas tus principales consumos.'),
  (3, 'Guardián de la Energía', 300,  'Tus hábitos de ahorro son constantes.'),
  (4, 'Eco Héroe',              600,  'Inspiras a tu comunidad con resultados.'),
  (5, 'Maestro Solar',          1000, 'Dominas el uso eficiente de la energía.'),
  (6, 'Leyenda Verde',          1600, 'Referente de ahorro energético comunitario.')
on conflict (level) do nothing;

insert into public.categories (slug, name, icon, sort_order) values
  ('iluminacion',     'Iluminación',     '💡', 10),
  ('refrigeracion',   'Refrigeración',   '🧊', 20),
  ('entretenimiento', 'Entretenimiento', '📺', 30),
  ('cocina',          'Cocina',          '🍳', 40),
  ('climatizacion',   'Climatización',   '❄️', 50),
  ('otros',           'Otros',           '🔌', 60)
on conflict (slug) do nothing;

-- Potencias aproximadas. Refrigeradores: horas = tiempo equivalente de trabajo del compresor.
insert into public.appliance_catalog (name, category_slug, default_watts, default_hours_per_day, default_days_per_week, description) values
  ('Foco LED',                           'iluminacion',     9,    5,    7, 'Equivale a un incandescente de 60 W'),
  ('Foco ahorrador (fluorescente)',      'iluminacion',     20,   5,    7, 'Lámpara fluorescente compacta'),
  ('Foco incandescente',                 'iluminacion',     60,   5,    7, 'Tecnología poco eficiente'),
  ('Tubo fluorescente T8',               'iluminacion',     32,   8,    7, 'Común en cocinas, oficinas y negocios'),
  ('Tira LED decorativa',                'iluminacion',     15,   4,    7, 'Por cada 5 metros aprox.'),
  ('Lámpara de escritorio LED',          'iluminacion',     7,    4,    5, null),
  ('Refrigerador moderno (eficiente)',   'refrigeracion',   150,  8,    7, 'Menos de 10 años de antigüedad'),
  ('Refrigerador antiguo (+10 años)',    'refrigeracion',   250,  12,   7, 'Empaques y compresor desgastados consumen más'),
  ('Frigobar',                           'refrigeracion',   80,   10,   7, null),
  ('Congelador horizontal',              'refrigeracion',   200,  10,   7, null),
  ('Enfriador de agua (garrafón)',       'refrigeracion',   100,  8,    7, null),
  ('Exhibidor refrigerado (negocio)',    'refrigeracion',   400,  14,   7, 'Vitrina vertical de bebidas'),
  ('Televisión LED 32"',                 'entretenimiento', 50,   5,    7, null),
  ('Televisión LED 55"',                 'entretenimiento', 120,  5,    7, null),
  ('Consola de videojuegos',             'entretenimiento', 150,  3,    7, null),
  ('Decodificador de TV de paga',        'entretenimiento', 15,   24,   7, 'Suele quedar encendido o en espera todo el día'),
  ('Equipo de sonido / bocina',          'entretenimiento', 60,   2,    7, null),
  ('Computadora de escritorio',          'entretenimiento', 200,  6,    5, 'Incluye CPU, sin monitor'),
  ('Monitor',                            'entretenimiento', 30,   6,    5, null),
  ('Laptop',                             'entretenimiento', 60,   6,    7, null),
  ('Módem / router WiFi',                'entretenimiento', 10,   24,   7, null),
  ('Cargador de celular',                'entretenimiento', 5,    3,    7, null),
  ('Horno de microondas',                'cocina',          1200, 0.25, 7, null),
  ('Licuadora',                          'cocina',          400,  0.1,  7, null),
  ('Cafetera de goteo',                  'cocina',          900,  0.3,  7, null),
  ('Hervidor eléctrico',                 'cocina',          1500, 0.2,  7, null),
  ('Tostador',                           'cocina',          900,  0.15, 5, null),
  ('Freidora de aire',                   'cocina',          1500, 0.5,  4, null),
  ('Parrilla eléctrica',                 'cocina',          1500, 1,    5, null),
  ('Horno eléctrico',                    'cocina',          2000, 0.5,  3, null),
  ('Máquina de café espresso (negocio)', 'cocina',          1500, 3,    6, null),
  ('Ventilador de pie',                  'climatizacion',   60,   8,    7, null),
  ('Ventilador de techo',                'climatizacion',   75,   8,    7, null),
  ('Minisplit 1 ton (convencional)',     'climatizacion',   1100, 6,    7, '12,000 BTU'),
  ('Minisplit 1 ton (inverter)',         'climatizacion',   800,  6,    7, '12,000 BTU, más eficiente'),
  ('Enfriador evaporativo',              'climatizacion',   200,  6,    7, null),
  ('Calefactor eléctrico',               'climatizacion',   1500, 3,    7, null),
  ('Lavadora automática',                'otros',           500,  1,    3, null),
  ('Secadora de ropa eléctrica',         'otros',           2500, 1,    2, null),
  ('Plancha de ropa',                    'otros',           1000, 1,    2, null),
  ('Bomba de agua 1/2 HP',               'otros',           375,  1,    7, null),
  ('Secadora de cabello',                'otros',           1500, 0.25, 7, null),
  ('Aspiradora',                         'otros',           1000, 0.5,  2, null),
  ('Terminal / caja registradora',       'otros',           30,   10,   6, 'Pequeño negocio'),
  ('Letrero luminoso',                   'otros',           100,  6,    7, 'Pequeño negocio')
on conflict (name) do nothing;

insert into public.badges (code, name, description, icon, criteria_type, criteria_value, points_bonus) values
  ('PRIMER_APARATO',     'Primer inventario',     'Registraste tu primer aparato.',                     '🔌', 'aparatos_registrados', 1,   10),
  ('INVENTARIO_COMPLETO','Inventario completo',   'Registraste 10 aparatos o más.',                     '📋', 'aparatos_registrados', 10,  25),
  ('PRIMER_HABITO',      'Observador',            'Registraste tu primer hábito.',                      '👀', 'habitos_registrados',  1,   10),
  ('HABITOS_CONSTANTES', 'Hábitos bajo control',  'Registraste 15 hábitos.',                            '📆', 'habitos_registrados',  15,  30),
  ('PRIMER_RETO',        'Primer reto',           'Completaste tu primer reto semanal.',                '🎯', 'retos_completados',    1,   20),
  ('RETADOR',            'Retador',               'Completaste 5 retos.',                               '🏅', 'retos_completados',    5,   50),
  ('CAMPEON_RETOS',      'Campeón de retos',      'Completaste 15 retos.',                              '🏆', 'retos_completados',    15,  100),
  ('AHORRO_10_KWH',      '10 kWh ahorrados',      'Acumulaste 10 kWh de ahorro estimado.',              '⚡', 'ahorro_kwh_total',     10,  30),
  ('AHORRO_50_KWH',      '50 kWh ahorrados',      'Acumulaste 50 kWh de ahorro estimado.',              '🌱', 'ahorro_kwh_total',     50,  75),
  ('SUPER_AHORRO',       'Súper ahorro',          'Ahorraste 20% o más en un solo reto.',               '🚀', 'ahorro_pct_reto',      20,  50),
  ('RACHA_3',            'Constancia',            'Completaste retos 3 semanas seguidas.',              '🔥', 'racha_semanas',        3,   40),
  ('RACHA_8',            'Imparable',             'Completaste retos 8 semanas seguidas.',              '💪', 'racha_semanas',        8,   100),
  ('PUNTOS_500',         'Medio millar',          'Alcanzaste 500 puntos.',                             '⭐', 'puntos_totales',       500, 0)
on conflict (code) do nothing;

insert into public.communities (name, municipality, state, postal_code, created_by) values
  ('Colonia Centro',               'Ejemplo', 'Ejemplo', null, null),
  ('Fraccionamiento Las Flores',   'Ejemplo', 'Ejemplo', null, null),
  ('Unidad Habitacional Los Pinos','Ejemplo', 'Ejemplo', null, null)
on conflict do nothing;

-- Retos: semana actual, siguiente y la posterior (calculadas al ejecutar el script)
insert into public.challenges (title, description, tips, category_slug, target_reduction_pct, points_reward, week_start, created_by) values
  ('Apaga lo que no usas',
   'Durante esta semana apaga la luz cada vez que salgas de una habitación y reduce las horas de iluminación registradas en tus aparatos.',
   'Aprovecha la luz natural. Pon una nota junto a los apagadores. Ajusta las horas de tus focos en la calculadora al terminar.',
   'iluminacion', 10, 50, public.week_start_of(public.app_today()), null),
  ('Cazadores de vampiros eléctricos',
   'Desconecta los aparatos que se quedan en espera (standby): TV, decodificador, consola, cargadores y microondas.',
   'Usa multicontactos con interruptor para apagar varios aparatos a la vez.',
   'entretenimiento', 5, 40, public.week_start_of(public.app_today()), null),
  ('Climatización inteligente',
   'Usa el ventilador antes que el aire acondicionado y, si lo usas, programa 24–25 °C y reduce sus horas de uso.',
   'Cierra cortinas en las horas de más sol. Limpia los filtros del minisplit.',
   'climatizacion', 15, 70, public.week_start_of(public.app_today()), null),
  ('Lavado eficiente',
   'Lava solo con carga completa y reduce los días de uso de la lavadora y la secadora.',
   'Seca la ropa al sol siempre que sea posible.',
   'otros', 10, 50, public.week_start_of(public.app_today()) + 7, null),
  ('Refri en forma',
   'Revisa los empaques del refrigerador, sepáralo 10 cm de la pared y evita abrirlo sin necesidad.',
   'No metas comida caliente. Mantén el termostato en nivel medio.',
   'refrigeracion', 5, 40, public.week_start_of(public.app_today()) + 7, null),
  ('Pantallas con medida',
   'Reduce al menos una hora diaria el uso de TV, consola o computadora.',
   'Activa el modo de ahorro de energía y baja el brillo de las pantallas.',
   'entretenimiento', 10, 50, public.week_start_of(public.app_today()) + 7, null),
  ('Cocina con cabeza',
   'Reduce el uso de aparatos de alto consumo en la cocina (horno eléctrico, parrilla, hervidor).',
   'Calienta solo el agua que vas a usar. Tapa las ollas.',
   'cocina', 10, 50, public.week_start_of(public.app_today()) + 14, null),
  ('Cambio a LED',
   'Sustituye focos incandescentes o ahorradores por LED y actualiza tus aparatos en la calculadora.',
   'Un LED de 9 W ilumina igual que un incandescente de 60 W.',
   'iluminacion', 15, 80, public.week_start_of(public.app_today()) + 14, null);

commit;

-- =============================================================================
-- PRIMER ADMINISTRADOR (ejecútalo DESPUÉS de registrarte en la app):
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'TU_CORREO@ejemplo.com');
--
-- =============================================================================
-- RESET (solo si necesitas borrar todo y volver a correr el script):
--
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop table if exists public.community_awards, public.points_ledger, public.user_badges,
--   public.badges, public.challenge_progress_logs, public.challenge_participations,
--   public.challenges, public.habit_logs, public.consumption_snapshots, public.appliances,
--   public.appliance_catalog, public.profiles, public.communities, public.categories,
--   public.levels, public.app_settings cascade;
-- drop function if exists public.handle_new_user, public.on_points_ledger_insert,
--   public.on_appliances_change, public.on_profile_tariff_change, public.before_habit_log_insert,
--   public.after_habit_log_insert, public.check_and_award_badges, public.award_points,
--   public.refresh_consumption_snapshot, public.level_for_points, public.calc_user_weekly_kwh,
--   public.is_admin, public.set_updated_at, public.co2_factor, public.week_start_of,
--   public.app_today, public.app_timezone, public.get_my_consumption_summary,
--   public.get_my_consumption_by_category, public.get_my_consumption_by_appliance,
--   public.get_active_challenges, public.join_challenge, public.log_challenge_progress,
--   public.complete_challenge, public.abandon_challenge, public.get_my_gamification,
--   public.get_my_savings_history, public.get_leaderboard, public.get_community_ranking,
--   public.get_community_stats, public.admin_set_user_role, public.admin_list_users,
--   public.admin_grant_community_awards cascade;
-- drop type if exists public.account_type, public.user_role, public.participation_status,
--   public.verification_source, public.habit_type, public.points_reason,
--   public.badge_criteria, public.award_type cascade;
-- =============================================================================
