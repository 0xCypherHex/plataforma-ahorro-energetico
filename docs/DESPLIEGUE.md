# Despliegue gratuito en Vercel

**Proyecto:** Plataforma de Ahorro Energético Comunitario · Next.js 16 + Supabase
**Costo:** $0 — plan *Hobby* de Vercel (uso personal / no comercial) + plan gratuito de Supabase.

---

## 0. Antes de empezar

1. Compila sin errores en tu computadora:
   ```bash
   npm run lint
   npm run build
   ```
2. Confirma que `.env.local` **no** se sube a GitHub (el `.gitignore` de Next.js ya incluye `.env*`):
   ```bash
   git status --ignored | grep env
   ```
3. Sube todo a GitHub:
   ```bash
   git add .
   git commit -m "Fase 6: panel de administrador y documentación de despliegue"
   git push origin main
   ```

## 1. Crear el proyecto en Vercel

1. Entra a <https://vercel.com> y regístrate con **Continue with GitHub**.
2. **Add New… → Project**.
3. Busca el repositorio `plataforma-ahorro-energetico` y presiona **Import**.
4. Vercel detecta **Next.js** automáticamente. No cambies *Build Command*, *Output Directory* ni *Install Command*.
5. Abre **Environment Variables** y agrega exactamente estas dos (marca *Production*, *Preview* y *Development*):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://jnpgnsoqhwbjhmejmdzs.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la misma clave `sb_publishable_…` de tu `.env.local` |

   > Nunca agregues la *secret key* / *service_role*: la app no la necesita.

6. Presiona **Deploy** y espera ~1–2 minutos. Al terminar verás tu URL, por ejemplo `https://plataforma-ahorro-energetico.vercel.app`.

> **Importante:** las variables `NEXT_PUBLIC_*` se incrustan en el código **al compilar**. Si cambias una variable en Vercel, ve a **Deployments → ⋯ → Redeploy** para que tome efecto.

## 2. Configurar Supabase Auth para producción

Supabase → **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| **Site URL** | `https://TU-PROYECTO.vercel.app` (sin `/` al final) |
| **Redirect URLs** (agrega las tres) | `http://localhost:3000/**` · `https://TU-PROYECTO.vercel.app/**` · `https://*-TU-CUENTA.vercel.app/**` |

- La primera permite seguir desarrollando en local.
- La tercera cubre los *previews* que Vercel crea para cada rama (`TU-CUENTA` es el nombre de tu cuenta o equipo en Vercel).

Mientras sea prototipo, deja **Confirm email** desactivado (Authentication → Sign In / Providers → Email). El correo integrado de Supabase tiene un límite muy bajo de envíos por hora; para producción real configura un SMTP propio.

## 3. Verificación en producción

Abre tu URL de Vercel y comprueba:

- [ ] La portada muestra las estadísticas globales.
- [ ] `/dashboard` sin sesión redirige a `/login`.
- [ ] Registro con comunidad nueva → llegas al panel con el aviso de bienvenida.
- [ ] Agregar un aparato del catálogo → aparece en *Mis aparatos* y suma la insignia *Primer inventario*.
- [ ] Registrar un hábito, unirte a un reto, completarlo y verte en *Comunidad*.
- [ ] Con tu cuenta admin: `/admin` muestra los contadores y puedes crear un reto.
- [ ] En el celular (o con F12 → vista móvil) aparece la barra inferior de pestañas.

## 4. Despliegues automáticos

| Acción | Resultado |
|---|---|
| `git push` a `main` | Nuevo despliegue de **producción** |
| `git push` a otra rama / Pull Request | Despliegue de **preview** con URL propia |
| Error al compilar | Vercel conserva la última versión que funcionaba |

## 5. Rutina semanal del administrador

Cada **lunes**:

1. **Admin → Retos**: revisa que la semana actual tenga retos. Usa **Copiar a la semana siguiente** para reutilizar los buenos.
2. **Admin → Resumen → Reconocimientos comunitarios**: elige la semana pasada y presiona **Entregar reconocimientos** (oro, plata y bronce). Repetirlo no duplica premios.
3. Revisa **Comunidad** para ver la clasificación actualizada.

## 6. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| "Faltan variables de entorno de Supabase" | No se agregaron en Vercel | Agrégalas (paso 1.5) y haz **Redeploy** |
| "La clave de Supabase no es válida… HTTP 401" | Clave mal copiada o de otro proyecto | Copia de nuevo la *publishable key* y haz **Redeploy** |
| Funciona en local pero no en Vercel tras cambiar una variable | `NEXT_PUBLIC_*` se fija al compilar | **Redeploy** |
| El build falla en Vercel | Error de TypeScript/ESLint | Ejecuta `npm run build` en local, corrige y vuelve a hacer `push` |
| "Server Action unavailable" después de un despliegue | Pestaña abierta con la versión anterior | Recarga la página (Ctrl+Shift+R) |
| La app no responde tras días sin uso | El proyecto gratuito de Supabase se pausó por inactividad | Supabase Dashboard → **Restore project** |

## 7. Migraciones aplicadas (para referencia)

Ya ejecutadas en Supabase, en este orden. `supabase/schema.sql` las incluye todas para un proyecto nuevo.

1. `schema.sql` (Fase 1)
2. `migrations/002_registro_con_comunidad.sql` (Fase 2)
3. `migrations/003_retos_por_categoria.sql` (Fase 5)
