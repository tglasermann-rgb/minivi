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

1. Importar el repo de GitHub en Vercel (framework: Next.js, detectado solo).
2. **Environment Variables**: cargar todas las de `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` y `DATABASE_URL`/`DIRECT_URL` solo en el servidor (no llevan `NEXT_PUBLIC_`).
3. El build corre `prisma generate && next build`. Las migraciones **no** se aplican en el build: correr `npm run db:deploy` desde tu máquina apuntando a producción cuando haya una migración nueva.
4. En Supabase → **Authentication → URL Configuration**: agregar la URL de Vercel a "Site URL" y "Redirect URLs".

## Comprobaciones

```bash
npm run typecheck && npm run test && npm run build
```

## Notas técnicas

- **Prisma 7** usa `prisma.config.ts` (la URL no va en `schema.prisma`) y el adapter `@prisma/adapter-pg`. El cliente se genera en `src/generated/prisma` (ignorado por git, se regenera en `npm install`/`build`).
- **RLS** está activado en todas las tablas sin políticas: nadie puede leer datos por la API REST de Supabase con la anon key. El portal accede por Prisma como `postgres`.
- **Roles**: el middleware (Edge) solo verifica que haya sesión; el rol se chequea en los layouts de `/app` (owner) y `/kiosk` (owner o kiosk) con Prisma.
- `.npmrc` tiene `legacy-peer-deps=true` por un conflicto de peers entre vitest y `@types/node`; Vercel lo respeta.
