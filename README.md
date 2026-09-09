# MiniVi OS

Portal interno de MiniVi Jewelry LLC: joyería de oro 14k a precio fijo en North Miami. Un solo negocio, dos dueños, dos vendedoras. Shopify es la fuente de verdad de productos, stock y ventas; este portal agrega lo que Shopify no tiene (compras, gastos, gramos, costo por gramo, nómina, reportes contra el plan).

Reglas de negocio y convenciones: [`CLAUDE.md`](CLAUDE.md). Plan por fases: [`docs/PLAN.md`](docs/PLAN.md). Modelo de datos: [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md). Identidad: [`docs/BRAND.md`](docs/BRAND.md). Setup: [`docs/SETUP.md`](docs/SETUP.md).

## Stack

Next.js 15 (App Router) · TypeScript estricto · Tailwind 4 + shadcn/ui · Supabase (Postgres, Auth, Storage) · Prisma 7 · Vercel · Vitest.

## Scripts

| comando | qué hace |
|---|---|
| `npm run dev` | servidor local |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (lógica de negocio) |
| `npm run lint` | ESLint |
| `npm run build` | `prisma generate && next build` |
| `npm run db:migrate -- --name x` | crea y aplica una migración (dev) |
| `npm run db:deploy` | aplica migraciones pendientes (prod) |
| `npm run db:seed` | settings por defecto |
| `npm run db:studio` | Prisma Studio |

## Estado

**Fase 0 — Base:** lista. **Fase 1 — Inventario:** lista para probar (productos, SKU y precio automáticos, stock por movimientos, fotos desde Drive, etiquetas PDF, export CSV y publicación en Shopify).

## Cómo probar la fase 0

1. Sin instalar nada: seguir [`docs/GUIA-FACIL.md`](docs/GUIA-FACIL.md) (Supabase + Vercel). Con tu computadora: [`docs/SETUP.md`](docs/SETUP.md).
2. `npm run dev` y abrir http://localhost:3000.
3. Entrar con tu email y contraseña → tenés que ver `/app` con el menú (Inicio, Compras, Inventario, Ventas, Gastos, Empleados, Reportes, Configuración). Achicá la ventana o abrilo desde el celular: el menú pasa a un botón arriba a la izquierda.
4. Ir a **Configuración**, cambiar el precio por gramo (por ejemplo 300 → 310) y guardar. Tiene que aparecer el aviso "Configuración guardada" y una fila nueva en "Historial de cambios" con tu email, el valor anterior y el nuevo. Volver a Inicio: el subtítulo muestra el precio nuevo.
5. Cerrar sesión desde el menú de usuario (abajo del sidebar) → vuelve a `/login`. Intentar abrir `/app` sin sesión → redirige a `/login`.
6. Entrar con el usuario de la tablet (uno que **no** esté en `OWNER_EMAILS`) → va a `/kiosk` y no puede abrir `/app`.

## Cómo probar la fase 1

1. Inventario → **Nuevo producto**: título en inglés, tipo, subcategoría, gramos. Al guardar aparece el SKU (`MV-NK-0001`) y el precio automático (gramos × $300, redondeado a $5).
2. Creá 5 productos. Probá uno con precio manual y una variante (elegí "Es variante de…", valor de opción 18): el SKU sale `MV-NK-0001-18`.
3. En la ficha → **Ajustar stock** +3. En la lista, el stock y los totales de arriba cambian.
4. Seleccioná varios → **Etiquetas**: se abre el PDF (una etiqueta por página). Ver `docs/LABELS.md` para imprimir.
5. **Exportar → CSV para Shopify**: se descarga el archivo con las columnas del importador.
6. Con Drive configurado (`docs/SETUP-DRIVE.md`): poné una foto `MV-NK-0001.jpg` en la carpeta y apretá **Buscar fotos**.
7. Con Shopify configurado (`docs/SETUP-SHOPIFY.md`): **Publicar en Shopify** → el producto aparece como borrador en el admin de Shopify con SKU, precio, costo, peso, tags y fotos.
8. Configuración → cambiá el precio por gramo → **Recalcular precios**: los productos sin precio manual se actualizan y queda en el historial.

## Estructura

```
src/app/            rutas (login, app/*, kiosk, auth/signout)
src/components/ui/  shadcn/ui
src/components/     logo, layout (sidebar, shell)
src/lib/            prisma, supabase, auth, settings, audit, money
prisma/             schema y migraciones
docs/               plan, modelo de datos, marca, setup
public/             logo.svg, logo-dark.svg, logo-crema.svg, isotipo.svg
```
