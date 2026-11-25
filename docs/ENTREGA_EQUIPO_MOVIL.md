# Entrega al equipo móvil (React Native · Expo)

Todo lo que necesita la app móvil para conectarse al **mismo backend** que el sitio web.

---

## 1. Archivos a entregar

### Código portable (copiar tal cual, respetando las carpetas)

| Archivo | Para qué | Depende de |
|---|---|---|
| `types/database.ts` | Tipos de tablas, enums, respuestas y nombres de RPC | Nada |
| `lib/energyCalculations.ts` | Fórmulas de kWh, costo y CO2; desglose; ahorro; validación de aparatos y hábitos | `../types/database` |
| `lib/recommendations.ts` | Motor de recomendaciones personalizadas | `./energyCalculations`, `../types/database` |
| `lib/rpc.ts` | `callRpc()` tipado para todas las funciones RPC | `@supabase/supabase-js`, `../types/database` |
| `lib/dates.ts` | Fecha de hoy en America/Mexico_City, semanas (lunes) | Nada |

Ninguno importa Next.js, React ni APIs del navegador. Los imports son **relativos**: no hace falta configurar alias.

### Documentación

| Archivo | Contenido |
|---|---|
| `docs/INTEGRACION_MOVIL.md` | **Contrato completo**: Auth, tablas, columnas, enums, RLS, todas las RPC con parámetros y respuestas, errores, reglas de puntos |
| `docs/ENTREGA_EQUIPO_MOVIL.md` | Este archivo |
| `supabase/schema.sql` | Esquema completo (solo referencia — **no lo ejecutes de nuevo**, ya está aplicado) |
| `.env.example` (de este paquete) | Plantilla de variables para Expo |

## 2. Variables de entorno (archivo `.env` del proyecto Expo)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://jnpgnsoqhwbjhmejmdzs.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

- Son **los mismos valores** que usa la web (`NEXT_PUBLIC_…`).
- La *publishable key* es pública y puede ir en la app.
- **Nunca** pongas la *secret key* / *service_role* en la app.
- Pásale la clave por un canal privado (no la subas a un repositorio público).

## 3. Dependencias de la app

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
# Gráficas (Recharts es solo web):
npx expo install victory-native react-native-svg
```

El cliente de Supabase para Expo está en `INTEGRACION_MOVIL.md`, sección 1.3.

## 4. Mapa de pantallas → backend

| Pantalla móvil | Lecturas | Escrituras / RPC | Lógica portable |
|---|---|---|---|
| Registro / Login | `communities` (sin sesión) | `auth.signUp` con `full_name`, `account_type`, `community_id` **o** `new_community_name` | — |
| Perfil | `profiles` (propio) | `update` de `full_name`, `account_type`, `community_id`, `tariff_per_kwh` | — |
| Aparatos | `appliances`, `categories`, `appliance_catalog`, `app_settings` | `insert` / `update` / `delete` en `appliances` | `validateAppliance`, `calculateTotals`, `breakdownByCategory`, `breakdownByAppliance` |
| Hábitos | `habit_logs` (últimos 30–60 días) | `insert` / `delete` en `habit_logs` | `validateHabit`, `habitWeeklyKwh`, `HABIT_LABELS` |
| Recomendaciones | aparatos + hábitos | — | `generateRecommendations`, `summarizeRecommendations` |
| Panel / gráficas | `consumption_snapshots`, RPC `get_my_savings_history`, `get_my_gamification` | — | `calculateTotals` |
| Retos | RPC `get_active_challenges`, `challenge_participations` | RPC `join_challenge`, `log_challenge_progress`, `complete_challenge`, `abandon_challenge` | `calculateSavings` para el "Ahora" (solo aparatos de `measured_category_slug`) |
| Logros | RPC `get_my_gamification`, `levels`, `points_ledger` | — | — |
| Comunidad | RPC `get_community_stats`, `get_leaderboard`, `get_community_ranking` | — | — |

El **panel de administrador** es solo web; la app no necesita pantallas de admin.

## 5. Reglas que la app debe respetar

1. **No calcular puntos, insignias, niveles, rachas ni rankings en el teléfono.** Siempre leerlos de la BD o de las RPC.
2. **Mostrar el aviso de verificación aproximada** en la pantalla de retos (texto en `INTEGRACION_MOVIL.md` §6.2).
3. **Cada reto mide solo su categoría** (`measured_category_slug`; `null` = todo el hogar).
4. Mostrar al usuario `error.message` de las RPC cuando `error.code === 'P0001'`: ya viene en español.
5. Fechas y semanas en **America/Mexico_City**, semanas de **lunes a domingo** (usa `lib/dates.ts`).

## 6. Accesos sugeridos

- **Cuenta de prueba:** que tu compañero se registre desde la web o la app; si necesita probar como admin, asígnale el rol desde **Admin → Usuarios**.
- **Supabase Dashboard (opcional):** Project Settings → Team → *Invite* con rol de solo lectura si necesita revisar datos o logs.
- **URL de la web en producción:** `https://TU-PROYECTO.vercel.app` para comparar resultados entre web y móvil.

## 7. Prueba de humo para la app

1. Registrarse con `new_community_name` → el perfil aparece con esa comunidad.
2. Agregar un aparato → `calculateTotals(...).kwh.mensual` coincide con la web para la misma cuenta.
3. Llamar `callRpc(supabase, 'get_my_gamification')` → ver la insignia *Primer inventario*.
4. Unirse a un reto, bajar horas del aparato y completarlo → mismo resultado que en la web.
5. `callRpc(supabase, 'get_leaderboard', { p_scope: 'global' })` → aparece la cuenta con `is_me: true`.
