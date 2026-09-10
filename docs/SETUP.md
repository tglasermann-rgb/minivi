# Setup — Fase 0

Qué hace falta para correr MiniVi OS por primera vez (local y en Vercel).

## 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com) (región `us-east-1`, es la más cercana a Miami).
2. **Project Settings → API**: copiar `Project URL`, `anon public` y `service_role`.
3. **Project Settings → Database → Connection string**:
   - `DATABASE_URL`: modo **Transaction** (puerto 6543). La usa la app.
   - `DIRECT_URL`: modo **Session** o Direct (puerto 5432). La usan las migraciones.
   Reemplazar `[YOUR-PASSWORD]` por la contraseña de la base.
4. **Authentication → Providers → Email**: dejar habilitado. Desactivar "Confirm email" si querés que los usuarios entren sin verificar (recomendado, no hay registro público).
5. **Authentication → Users → Add user → Create new user**: crear los dos dueños con email y contraseña, y un usuario para la tablet (por ejemplo `kiosk@minivi.com`).

## 2. Variables de entorno

```bash
cp .env.example .env.local   # Next.js
cp .env.example .env         # Prisma CLI (migraciones, seed)
```

Completar los valores. `OWNER_EMAILS` lleva los emails de los dueños separados por coma: en su primer login reciben rol `owner`. Cualquier otro usuario entra como `kiosk`. Para cambiar un rol después: Supabase → Table Editor → `profiles` → columna `role`.

## 3. Base de datos

```bash
npm install
npm run db:deploy     # aplica prisma/migrations (crea profiles, settings, audit_log)
npm run db:seed       # opcional: asegura los settings por defecto
```

Para crear una migración nueva en fases siguientes: editar `prisma/schema.prisma` y correr `npm run db:migrate -- --name lo_que_cambia`. Prisma usa `DIRECT_URL` del archivo `.env`.

## 4. Correr local

```bash
npm run dev
```

Abrir http://localhost:3000 → redirige a `/login`. Entrar con un email de `OWNER_EMAILS` → `/app`.

## 5. Vercel

Versión paso a paso sin comandos: [`docs/GUIA-FACIL.md`](GUIA-FACIL.md).

1. Importar el repo de GitHub en Vercel (framework: Next.js, detectado solo).
2. **Environment Variables**: cargar todas las de `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL`/`DIRECT_URL` solo en el servidor (no llevan `NEXT_PUBLIC_`).
3. El build en Vercel (`vercel.json` → `npm run build:vercel`) corre `prisma migrate deploy` antes de `next build`, así las migraciones nuevas se aplican solas en cada deploy. Necesita `DIRECT_URL`.
4. En Supabase → **Authentication → URL Configuration**: agregar la URL de Vercel a "Site URL" y "Redirect URLs".

## Buckets de Supabase Storage

Se crean solos la primera vez que se usan: `product-images` (público, fotos de producto), `receipts` (privado, facturas de gastos), `purchase-docs` (privado), `clock-photos` (privado, fichaje), `backups` (privado) y `legal-docs` (privado, contratos y documentos).

## Región: el servidor va junto a la base

`vercel.json` fija la región de Vercel en **pdx1** (Portland) porque el proyecto de Supabase está en **us-west-2** (Oregón). Cada pantalla hace varias consultas y una llamada de sesión; con el servidor del otro lado del país cada una costaba unos 65 ms y el portal se sentía lento.

Si algún día se crea el proyecto de Supabase en otra región, hay que mover `regions` a la ciudad de Vercel más cercana: `us-east-1` → `iad1`, `us-west-1` → `sfo1`, `eu-central-1` → `fra1`, `sa-east-1` → `gru1`. La región de Supabase se ve en el host de `DATABASE_URL` (`aws-0-<región>.pooler.supabase.com`).

## Diagnóstico

`GET /api/health` (sin sesión) devuelve si la base responde, cuánto tarda, y qué variables de entorno están cargadas (sin exponer valores). Es lo primero que hay que mirar ante un "Application error".

## Comprobaciones

```bash
npm run typecheck && npm run test && npm run build
```

## Notas técnicas

- **Prisma 7** usa `prisma.config.ts` (la URL no va en `schema.prisma`) y el adapter `@prisma/adapter-pg`. El cliente se genera en `src/generated/prisma` (ignorado por git, se regenera en `npm install`/`build`).
- **RLS** está activado en todas las tablas sin políticas: nadie puede leer datos por la API REST de Supabase con la anon key. El portal accede por Prisma como `postgres`.
- **Roles**: el middleware (Edge) solo verifica que haya sesión; el rol se chequea en los layouts de `/app` (owner) y `/kiosk` (owner o kiosk) con Prisma.
- **Conexiones**: en Vercel cada función abre su propio pool. Supabase (free) admite pocas conexiones, así que el pool va limitado a 2 (`DATABASE_POOL_MAX` lo cambia) con cierre de ociosas a los 10 s. Sin esto aparecen errores de "too many connections".
- `.npmrc` tiene `legacy-peer-deps=true` por un conflicto de peers entre vitest y `@types/node`; Vercel lo respeta.
