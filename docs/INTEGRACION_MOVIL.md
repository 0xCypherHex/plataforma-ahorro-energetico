# INTEGRACIÓN MÓVIL — Contrato del backend compartido

**Proyecto:** Plataforma de Ahorro Energético Comunitario (ODS 7)
**Backend:** Supabase (PostgreSQL + Auth + RLS + funciones RPC)
**Clientes:** Sitio web (Next.js) y App móvil (React Native · Expo · TypeScript)
**Versión del contrato:** 1.1 (Fase 2: registro con comunidad nueva)

> Regla de oro: **la app móvil nunca calcula puntos, insignias, niveles, ahorro de retos ni rankings.**
> Todo eso lo hace la base de datos. El móvil solo lee tablas (con RLS) y llama `supabase.rpc(...)`.
> Si algo de este contrato cambia, se actualiza este archivo y `supabase/schema.sql` en el mismo commit.

---

## 1. Conexión

### 1.1 Variables de entorno (archivo `.env` del proyecto Expo)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://jnpgnsoqhwbjhmejmdzs.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

- La **publishable key** (o la antigua *anon key*, que también funciona) es pública: puede ir en la app.
- La **secret key / service_role** **NUNCA** va en la app móvil ni en el sitio web del lado del cliente.
- Se obtienen en: Supabase Dashboard → *Project Settings* → *API Keys*.

### 1.2 Dependencias

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

### 1.3 Cliente (`lib/supabase.ts` en el proyecto móvil)

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from '../types/database'; // se entrega en la Fase 3

export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresca el token solo mientras la app está en primer plano
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

---

## 2. Autenticación

| Concepto | Valor |
|---|---|
| Método | Correo + contraseña (`supabase.auth.signUp` / `signInWithPassword`) |
| Contraseña mínima | 6 caracteres (configuración por defecto de Supabase) |
| Confirmación de correo | **Desactivada durante el prototipo** (Auth → Sign In / Providers → Email → *Confirm email* = off). Si se activa, `signUp` no devuelve sesión hasta que el usuario confirme. |
| Creación de perfil | **Automática** por el trigger `on_auth_user_created`. El móvil **no** inserta en `profiles`. |

### 2.1 Registro — metadatos obligatorios

El trigger lee `options.data`. Envía exactamente estas llaves:

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: 'Ana López',          // string, máx. 120
      account_type: 'hogar',           // 'hogar' | 'negocio'   (si falta o es inválido → 'hogar')
      // Comunidad: usa UNA de estas dos opciones (o ninguna)
      community_id: 'uuid-opcional',              // unirse a una comunidad existente
      // new_community_name: 'Col. Las Américas', // crear una nueva (2–120 caracteres)
      // new_community_municipality: 'Ecatepec',  // opcional, junto con la anterior
    },
  },
});
```

- Si envías `new_community_name`, el trigger **crea la comunidad** o, si ya existe una con el mismo nombre y municipio (sin distinguir mayúsculas), **reutiliza la existente**. `community_id` tiene prioridad si se envían ambos.
- La tarifa inicial se asigna sola: `app_settings.default_tariff_hogar` (1.20 MXN/kWh) o `default_tariff_negocio` (4.00 MXN/kWh). El usuario la ajusta después con su recibo.
- El rol **siempre** nace como `'user'`. Un usuario **no** puede hacerse admin desde la app.
- La lista de comunidades (`communities`) se puede leer **sin sesión** para mostrar el selector en la pantalla de registro.

### 2.2 Roles y tipos de perfil

| Campo | Valores | Quién lo cambia |
|---|---|---|
| `profiles.account_type` | `'hogar'` (familias, vecinos, estudiantes) · `'negocio'` (pequeño negocio) | El propio usuario |
| `profiles.role` | `'user'` · `'admin'` | Solo un admin (RPC `admin_set_user_role`) o SQL directo |

> El "Administrador" es un **rol**, no un tipo de cuenta. Un admin también tiene `account_type`.
> La app móvil no necesita pantallas de admin (el panel admin vive en la web), pero puede ocultar/mostrar cosas con `profile.role === 'admin'`.

---

## 3. Enums (valores permitidos)

| Enum | Valores |
|---|---|
| `account_type` | `hogar`, `negocio` |
| `user_role` | `user`, `admin` |
| `participation_status` | `activo`, `completado`, `abandonado` |
| `verification_source` | `manual`, `enchufe_inteligente`, `medidor_inteligente` |
| `habit_type` | `luces_sin_necesidad`, `dispositivos_standby`, `uso_aparato` |
| `points_reason` | `reto_completado`, `avance_registrado`, `habito_registrado`, `insignia`, `racha`, `ajuste_admin` |
| `badge_criteria` | `retos_completados`, `puntos_totales`, `aparatos_registrados`, `habitos_registrados`, `ahorro_kwh_total`, `racha_semanas`, `ahorro_pct_reto` |
| `award_type` | `oro`, `plata`, `bronce` |

**Categorías de aparatos** (no es enum, es la tabla `categories`; el admin puede agregar más). Slugs semilla:
`iluminacion`, `refrigeracion`, `entretenimiento`, `cocina`, `climatizacion`, `otros`.
Siempre léelas de la tabla en vez de escribirlas fijas en la app.

---

## 4. Tablas

Convenciones: `id uuid` generado por la BD · fechas `date` llegan como `'YYYY-MM-DD'` · `timestamptz` como ISO 8601 · `numeric` llega como `number`.
**Leyenda de permisos (para un usuario normal autenticado):** R = leer · C = crear · U = actualizar · D = borrar · `—` = sin acceso directo.

### 4.1 `profiles` — R (solo el suyo) · U (solo columnas permitidas)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `full_name` | text | ✏️ editable, máx. 120 |
| `account_type` | account_type | ✏️ editable |
| `role` | user_role | 🔒 solo lectura |
| `community_id` | uuid \| null | ✏️ editable → `communities.id` |
| `tariff_per_kwh` | numeric(10,4) | ✏️ editable, > 0 y ≤ 100 (moneda: MXN) |
| `avatar_url` | text \| null | ✏️ editable |
| `points` | integer | 🔒 lo calcula la BD |
| `level` | integer | 🔒 lo calcula la BD |
| `streak_weeks` | integer | 🔒 semanas seguidas completando retos |
| `last_completed_week` | date \| null | 🔒 |
| `created_at`, `updated_at` | timestamptz | 🔒 |

Si intentas actualizar una columna 🔒, PostgREST responde **error 42501 (permission denied)**.

```ts
await supabase.from('profiles').update({ tariff_per_kwh: 1.45, community_id }).eq('id', user.id);
```

### 4.2 `communities` — R (todos, incluso sin sesión) · C (autenticado)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | 2–120, único junto con `municipality` (sin distinguir mayúsculas) |
| `municipality` | text \| null | |
| `state` | text \| null | |
| `postal_code` | text \| null | 5 dígitos |
| `created_by` | uuid | se llena solo con `auth.uid()` |
| `created_at` | timestamptz | |

Crear una colonia nueva (requiere sesión): `insert({ name, municipality, state, postal_code })`. Si ya existe → error `23505` (duplicado).

### 4.3 `categories` — R (todos)

`slug` (PK, `^[a-z0-9_]{2,40}$`), `name`, `icon` (emoji), `sort_order`, `is_active`, `created_at`, `updated_at`.
Ordena por `sort_order`.

### 4.4 `appliance_catalog` — R (todos)

| Columna | Tipo |
|---|---|
| `id` | uuid PK |
| `name` | text (único) |
| `category_slug` | text → `categories.slug` |
| `default_watts` | numeric |
| `default_hours_per_day` | numeric (0–24) |
| `default_days_per_week` | smallint (0–7) |
| `description` | text \| null |
| `is_active` | boolean |

Uso: al elegir un aparato del catálogo, **precarga** el formulario con estos valores (el usuario puede editarlos) y guarda `catalog_id`.

### 4.5 `appliances` — CRUD del dueño

| Columna | Tipo | Restricción |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | **default `auth.uid()`** → no hace falta enviarlo |
| `catalog_id` | uuid \| null | → `appliance_catalog.id` (null = manual) |
| `name` | text | 1–100 |
| `category_slug` | text | → `categories.slug` |
| `watts` | numeric | > 0 y ≤ 20 000 |
| `quantity` | integer | 1–500 |
| `hours_per_day` | numeric(4,2) | 0–24 |
| `days_per_week` | smallint | 0–7 |
| `created_at`, `updated_at` | timestamptz | |

Efectos automáticos al crear/editar/borrar: se actualiza la foto diaria en `consumption_snapshots` y se revisan insignias (al crear).

```ts
await supabase.from('appliances').insert({
  name: 'Minisplit recámara', category_slug: 'climatizacion',
  watts: 1100, quantity: 1, hours_per_day: 6, days_per_week: 7, catalog_id: null,
});
```

### 4.6 `consumption_snapshots` — R (solo propio)

Una fila por usuario por día con el consumo **estimado** en ese momento (para la gráfica de evolución). La escribe un trigger.
Columnas: `user_id`, `snapshot_date`, `appliance_count`, `daily_kwh`, `weekly_kwh`, `monthly_kwh`, `yearly_kwh`, `tariff_per_kwh`, `monthly_cost`, `monthly_co2_kg`, `updated_at`.

```ts
await supabase.from('consumption_snapshots').select('*').order('snapshot_date', { ascending: true }).limit(90);
```

### 4.7 `habit_logs` — CRUD del dueño

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | default `auth.uid()` |
| `log_date` | date | default = hoy (zona `America/Mexico_City`) |
| `habit_type` | habit_type | ver tabla abajo |
| `appliance_id` | uuid \| null | debe ser un aparato **propio** (si no → error) |
| `item_count` | integer | 1–500 |
| `watts_per_item` | numeric \| null | si se omite, la BD pone el valor por defecto |
| `hours_per_day` | numeric | 0–24 |
| `days_per_week` | smallint | 0–7, default 7 |
| `notes` | text \| null | máx. 500 |
| `created_at` | timestamptz | |

| `habit_type` | Qué significa `item_count` | Qué significa `hours_per_day` | `watts_per_item` por defecto |
|---|---|---|---|
| `luces_sin_necesidad` | focos encendidos sin necesidad | horas así al día | **15 W** |
| `dispositivos_standby` | aparatos conectados sin usarse | horas así al día | **5 W** |
| `uso_aparato` | (normalmente 1) | horas **reales** de uso ese día | los `watts` del aparato (`appliance_id` obligatorio en la UI) |

Efectos automáticos: **+2 puntos** (máximo una vez al día) y revisión de insignias.

### 4.8 `challenges` — R (solo activos)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | |
| `description` | text | |
| `tips` | text \| null | |
| `category_slug` | text \| null | |
| `target_reduction_pct` | numeric | meta de reducción, % |
| `points_reward` | integer | puntos si se cumple la meta |
| `week_start` | date | siempre **lunes** |
| `week_end` | date | **domingo** (columna generada) |
| `is_active` | boolean | |
| `created_by`, `created_at`, `updated_at` | | |

Para la lista de retos usa la RPC `get_active_challenges()` (ya trae tu estado), no la tabla directa.

### 4.9 `challenge_participations` — R (solo propio) · escritura **solo por RPC**

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id`, `challenge_id` | uuid | único por pareja (un usuario puede estar en **varios retos a la vez**) |
| `status` | participation_status | |
| `joined_at` | timestamptz | |
| `baseline_weekly_kwh` | numeric | consumo estimado **ANTES** (al unirse) |
| `final_weekly_kwh` | numeric \| null | consumo estimado **DESPUÉS** (al completar) |
| `savings_kwh` | numeric \| null | `baseline − final` (negativo = consumió más) |
| `savings_pct` | numeric \| null | |
| `savings_cost` | numeric \| null | MXN |
| `savings_co2_kg` | numeric \| null | |
| `target_met` | boolean \| null | |
| `points_awarded` | integer | |
| `completed_at` | timestamptz \| null | |
| `verification_source` | verification_source | hoy siempre `manual` |
| `meter_reading_start_kwh` | numeric \| null | 🔮 futuro: lectura inicial de medidor/enchufe |
| `meter_reading_kwh` | numeric \| null | 🔮 futuro: lectura final |
| `notes` | text \| null | |

### 4.10 `challenge_progress_logs` — R (solo propio) · escritura solo por RPC

`id`, `participation_id`, `user_id`, `log_date`, `note`, `meter_reading_kwh`, `points_awarded`, `created_at`.

### 4.11 Gamificación

| Tabla | Acceso | Columnas |
|---|---|---|
| `levels` | R todos | `level`, `name`, `min_points`, `description` |
| `badges` | R todos | `id`, `code`, `name`, `description`, `icon`, `criteria_type`, `criteria_value`, `points_bonus`, `is_active` |
| `user_badges` | R propio | `user_id`, `badge_id`, `awarded_at` |
| `points_ledger` | R propio | `id`, `user_id`, `points`, `reason`, `reference_id`, `description`, `created_at` |
| `community_awards` | R todos | `id`, `community_id`, `period_start`, `period_end`, `award`, `rank`, `participants`, `avg_savings_pct`, `total_savings_kwh`, `created_at` |
| `app_settings` | R todos | `co2_kg_per_kwh` (0.444), `default_tariff_hogar`, `default_tariff_negocio`, `currency` ('MXN'), `timezone`, `challenge_grace_days` (3), `points_progress_log` (5), `points_habit_log` (2), `streak_bonus_per_week` (10), `streak_bonus_cap` (50) |

---

## 5. Políticas RLS (resumen)

| Tabla | anon (sin sesión) | Usuario autenticado | Admin |
|---|---|---|---|
| `app_settings`, `levels`, `community_awards` | R | R | R + escribe (`app_settings`, `levels`) |
| `categories`, `appliance_catalog`, `badges` | R (activos) | R (activos) | CRUD (ve inactivos) |
| `communities` | R | R + C | R + C + U + D |
| `profiles` | — | R/U **solo la suya** (columnas ✏️) | R todas |
| `appliances`, `habit_logs` | — | CRUD **solo los suyos** | R todos |
| `challenges` | R (activos) | R (activos) | CRUD (ve inactivos) |
| `consumption_snapshots`, `challenge_participations`, `challenge_progress_logs`, `user_badges`, `points_ledger` | — | R **solo los suyos** | R todos |

Nadie (ni admin) escribe directamente en tablas calculadas: solo RPC y triggers.

---

## 6. Funciones RPC

Llamada general: `const { data, error } = await supabase.rpc('nombre', { p_param: valor });`
Los nombres de parámetros **deben** ir exactamente como aquí (con prefijo `p_`). Los parámetros con *default* se pueden omitir.

### 6.1 Consumo

| RPC | Parámetros | Devuelve |
|---|---|---|
| `get_my_consumption_summary` | — | 4 filas: `{ period: 'diario'\|'semanal'\|'mensual'\|'anual', kwh, cost, co2_kg }` |
| `get_my_consumption_by_category` | — | filas `{ category_slug, category_name, appliance_count, monthly_kwh, monthly_cost, monthly_co2_kg, pct }` ordenadas de mayor a menor |
| `get_my_consumption_by_appliance` | — | filas `{ appliance_id, name, category_slug, monthly_kwh, monthly_cost, monthly_co2_kg, pct }` |

### 6.2 Retos

| RPC | Parámetros | Devuelve |
|---|---|---|
| `get_active_challenges` | — | filas `{ id, title, description, tips, category_slug, target_reduction_pct, points_reward, week_start, week_end, can_join, participants_count, my_participation_id, my_status }` — retos de la semana actual + los que siguen en periodo de gracia |
| `join_challenge` | `p_challenge_id: uuid` | fila de `challenge_participations` creada |
| `log_challenge_progress` | `p_participation_id: uuid`, `p_note?: string`, `p_meter_reading_kwh?: number` | `{ log_id, points_awarded, new_badges: [{code,name,icon}] }` |
| `complete_challenge` | `p_participation_id: uuid`, `p_meter_reading_kwh?: number`, `p_notes?: string` | ver abajo |
| `abandon_challenge` | `p_participation_id: uuid` | `null` |

Respuesta de `complete_challenge`:

```json
{
  "participation_id": "uuid",
  "baseline_weekly_kwh": 52.29,
  "final_weekly_kwh": 36.89,
  "savings_kwh": 15.4,
  "savings_pct": 29.45,
  "savings_cost": 23.10,
  "savings_co2_kg": 6.8376,
  "target_reduction_pct": 15,
  "target_met": true,
  "points_awarded": 70,
  "streak_weeks": 1,
  "streak_bonus": 0,
  "total_points": 197,
  "level": 2,
  "new_badges": [{ "code": "PRIMER_RETO", "name": "Primer reto", "icon": "🎯" }],
  "verification_note": "Verificación aproximada: compara el consumo ESTIMADO de tus aparatos antes y después del reto."
}
```

**Flujo de verificación (manual / aproximada):**
1. `join_challenge` guarda el consumo semanal estimado actual como **ANTES**.
2. Durante la semana el usuario cambia sus hábitos y **actualiza sus aparatos** (horas, días, cantidad o potencia) y registra avances con `log_challenge_progress`.
3. `complete_challenge` recalcula el consumo con los aparatos actuales (**DESPUÉS**) y compara.
4. La app **debe mostrar un aviso** de que la verificación es aproximada y depende de los datos que ingresa el usuario.

### 6.3 Gamificación y clasificación

| RPC | Parámetros | Devuelve |
|---|---|---|
| `get_my_gamification` | — | `{ points, level, level_name, current_level_min, next_level_min (null si es el máximo), streak_weeks, completed_challenges, total_savings_kwh, badges: [{code,name,description,icon,earned,awarded_at}] }` |
| `get_my_savings_history` | `p_weeks?: number` (default 12, máx. 104) | filas por semana `{ week_start, savings_kwh, savings_cost, savings_co2_kg, completed_challenges }` |
| `get_leaderboard` | `p_scope?: 'global'\|'comunidad'` (default `'global'`), `p_days?: number` (30), `p_limit?: number` (20, máx. 100) | filas `{ rank, user_id, display_name, community_name, avg_savings_pct, total_savings_kwh, completed_challenges, points, level, is_me }`. Siempre incluye al usuario actual aunque quede fuera del límite. `display_name` = "Nombre I." (privacidad). |
| `get_community_ranking` | `p_days?: number` (30), `p_limit?: number` (20) | filas `{ rank, community_id, community_name, municipality, participants, avg_savings_pct, total_savings_kwh, total_savings_cost, total_savings_co2_kg, gold_awards, total_awards }` — **también funciona sin sesión** |
| `get_community_stats` | `p_community_id?: uuid` (null = toda la plataforma), `p_days?: number` (30) | ver abajo — **también funciona sin sesión** |

Respuesta de `get_community_stats`:

```json
{
  "community_id": "uuid | null",
  "community_name": "Colonia Centro",
  "currency": "MXN",
  "total_members": 25,
  "active_participants": 12,
  "challenges_completed": 40,
  "total_savings_kwh": 310.5,
  "total_savings_cost": 372.6,
  "total_savings_co2_kg": 137.86,
  "avg_savings_pct": 14.2,
  "top_challenges": [{ "challenge_id": "uuid", "title": "...", "completions": 9, "avg_savings_pct": 18.1, "total_savings_kwh": 95.2 }],
  "weekly_series": [{ "week_start": "2026-11-23", "savings_kwh": 15.4, "savings_cost": 23.1, "savings_co2_kg": 6.84, "participants": 1 }],
  "awards": [{ "period_start": "2026-11-16", "award": "oro", "rank": 1 }]
}
```

`weekly_series` siempre trae las **últimas 8 semanas** (incluida la actual), con ceros donde no hubo actividad.

### 6.4 Administrador (solo web; con un usuario normal devuelven error 42501)

| RPC | Parámetros | Devuelve |
|---|---|---|
| `admin_set_user_role` | `p_user_id: uuid`, `p_role: 'user'\|'admin'` | `null` |
| `admin_list_users` | `p_search?: string`, `p_limit?: number` (50) | filas `{ id, email, full_name, account_type, role, community_name, points, level, created_at }` |
| `admin_grant_community_awards` | `p_week_start?: date` (default: semana pasada) | filas de `community_awards` insertadas (top 3: oro/plata/bronce) |

El CRUD de retos, categorías y catálogo lo hace el admin directamente sobre las tablas (`challenges`, `categories`, `appliance_catalog`); RLS lo permite solo a admins.

### 6.5 Errores

Los errores de negocio llegan en `error.message` en español, listos para mostrarse:

| `error.code` | Ejemplos de `error.message` |
|---|---|
| `P0001` | "Registra al menos un aparato antes de unirte a un reto" · "Ya participas en este reto" · "Este reto no está abierto esta semana" · "El plazo para completar este reto ya terminó" · "Solo puedes registrar avances en retos activos" · "El aparato indicado no pertenece a tu cuenta" |
| `28000` | "Debes iniciar sesión" |
| `42501` | "Solo administradores" / permiso denegado al editar columnas 🔒 |
| `23505` | Registro duplicado (p. ej. comunidad ya existente) |
| `23514` | Violación de un `check` (p. ej. `hours_per_day` > 24) |

---

## 7. Reglas de negocio (para mostrar textos correctos en la UI)

### 7.1 Fórmulas de consumo (idénticas en SQL y en `lib/energyCalculations.ts`)

```
kWh_semana = (watts × cantidad × horas_día × días_semana) / 1000
kWh_día    = kWh_semana / 7
kWh_mes    = kWh_semana × 52 / 12      (≈ 4.333 semanas)
kWh_año    = kWh_semana × 52
costo      = kWh × profiles.tariff_per_kwh
CO2 (kg)   = kWh × app_settings.co2_kg_per_kwh   (0.444 kg CO2e/kWh — factor SEMARNAT 2024 del Sistema Eléctrico Nacional)
```

Redondeo en respuestas RPC: kWh a 3 decimales, dinero a 2, CO2 a 3.

### 7.2 Puntos

| Acción | Puntos |
|---|---|
| Completar reto cumpliendo la meta (`savings_pct ≥ target_reduction_pct`) | 100 % de `points_reward` |
| Completar reto con ahorro > 0 pero sin llegar a la meta | 50 % |
| Completar reto sin ahorro (participación) | 20 % |
| Registrar avance de reto | +5 (máx. 1 vez al día por reto) |
| Registrar hábito | +2 (máx. 1 vez al día) |
| Racha (completar retos en semanas consecutivas, desde la 2.ª) | +10 × semanas (tope 50) |
| Insignia obtenida | `badges.points_bonus` |

### 7.3 Niveles (semilla)

| Nivel | Nombre | Puntos mínimos |
|---|---|---|
| 1 | Chispa | 0 |
| 2 | Foco Ahorrador | 100 |
| 3 | Guardián de la Energía | 300 |
| 4 | Eco Héroe | 600 |
| 5 | Maestro Solar | 1000 |
| 6 | Leyenda Verde | 1600 |

### 7.4 Insignias (semilla)

| Código | Criterio |
|---|---|
| `PRIMER_APARATO` | 1 aparato registrado |
| `INVENTARIO_COMPLETO` | 10 aparatos |
| `PRIMER_HABITO` | 1 hábito registrado |
| `HABITOS_CONSTANTES` | 15 hábitos |
| `PRIMER_RETO` | 1 reto completado |
| `RETADOR` | 5 retos |
| `CAMPEON_RETOS` | 15 retos |
| `AHORRO_10_KWH` | 10 kWh ahorrados acumulados |
| `AHORRO_50_KWH` | 50 kWh |
| `SUPER_AHORRO` | ≥ 20 % de ahorro en un solo reto |
| `RACHA_3` | 3 semanas seguidas |
| `RACHA_8` | 8 semanas seguidas |
| `PUNTOS_500` | 500 puntos |

### 7.5 Semanas y fechas

- Zona horaria de la plataforma: **America/Mexico_City**.
- Semana = **lunes a domingo**. Un reto solo admite unirse dentro de su semana.
- Se puede **completar** hasta **3 días** después del domingo (`challenge_grace_days`).
- Clasificaciones: últimos 30 días por defecto (`p_days`).

---

## 8. Ejemplos rápidos (TypeScript)

```ts
// Iniciar sesión
await supabase.auth.signInWithPassword({ email, password });

// Mi perfil
const { data: profile } = await supabase.from('profiles').select('*').single();

// Catálogo + categorías (para el formulario de aparatos)
const [{ data: categories }, { data: catalog }] = await Promise.all([
  supabase.from('categories').select('*').order('sort_order'),
  supabase.from('appliance_catalog').select('*').order('name'),
]);

// Mis aparatos
const { data: appliances } = await supabase.from('appliances').select('*').order('created_at');

// Resumen de consumo
const { data: summary } = await supabase.rpc('get_my_consumption_summary');

// Retos de la semana y unirse
const { data: challenges } = await supabase.rpc('get_active_challenges');
const { data: participation, error } = await supabase.rpc('join_challenge', { p_challenge_id: id });
if (error) Alert.alert('Ups', error.message);

// Completar reto
const { data: result } = await supabase.rpc('complete_challenge', { p_participation_id: participation.id });

// Ranking de mi comunidad
const { data: ranking } = await supabase.rpc('get_leaderboard', { p_scope: 'comunidad' });

// Estadísticas de mi comunidad
const { data: stats } = await supabase.rpc('get_community_stats', { p_community_id: profile.community_id });
```

---

## 9. Archivos compartidos (llegan en fases posteriores)

| Archivo | Fase | Contenido | Dependencias |
|---|---|---|---|
| `types/database.ts` | 3 | Tipos de todas las tablas, enums y respuestas RPC | Ninguna |
| `lib/energyCalculations.ts` | 3 | Fórmulas puras de kWh, costo y CO2 (las mismas de la sección 7.1) | Ninguna |
| `lib/recommendations.ts` | 4 | Motor de recomendaciones personalizadas | Solo los dos anteriores |

Son TypeScript puro (sin imports de Next.js, React ni del navegador): se copian tal cual a la carpeta del proyecto Expo.

---

## 10. Preparado para medidores inteligentes (futuro)

- `challenge_participations.verification_source` (`manual` hoy; luego `enchufe_inteligente` / `medidor_inteligente`).
- `challenge_participations.meter_reading_start_kwh` y `meter_reading_kwh`, y `challenge_progress_logs.meter_reading_kwh`.
- Las RPC `log_challenge_progress` y `complete_challenge` ya aceptan `p_meter_reading_kwh`: la primera lectura registrada se guarda como lectura inicial.
- Hoy el cálculo de ahorro sigue usando el consumo **estimado**; las lecturas se almacenan para una futura verificación con datos reales.
