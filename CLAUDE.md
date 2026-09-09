# MiniVi OS

Portal interno para administrar MiniVi Jewelry LLC, una joyería de oro 14k a precio fijo en North Miami (tienda física + Shopify + TikTok Shop). Un solo negocio, dos dueños, dos vendedoras.

## Reglas de negocio que nunca cambian
- El precio de venta se calcula como gramos × precio por gramo (parámetro global, hoy $300/g), redondeado hacia arriba al múltiplo de $5. Se puede sobrescribir por pieza.
- El costo se calcula como gramos × costo por gramo de la compra (hoy ~$100/g). Cada compra tiene su propio costo por gramo.
- Nunca escribir "solid gold" en ningún texto que salga al público. Usar "real 14k gold", "stamped 14k", "no plating".
- Shopify es la fuente de verdad de productos publicados, stock y ventas. El portal lee y escribe por Admin API; no inventa un segundo stock.
- SKU: `MV-<TIPO>-<NNNN>` (NK necklace, BR bracelet, ER earring, RG ring, CH charm, PD pendant), con sufijo de variante si hay (`-16`, `-18` para largos; `-6`, `-7` para tallas). Inmutable una vez creado.
- Tags de Shopify: tipo en minúscula + subcategoría + extras + `14k` + `real-gold`. Subcategorías válidas: chains, pendants, chokers, layering, bangles, charm-bracelets, anklets, hoops, huggies, studs, drops, bands, stackable, signet, statement, initials, symbols, faith, zodiac, kids-earrings, kids-bracelets, kids-pendants. Extras: new, bestseller, essential, gift, 2g, kids.
- Nómina: períodos del 1 al 15 y del 16 al último día del mes. Hora extra 1.5× sobre 40 h por semana (semana lunes a domingo). El portal calcula horas y bruto; no calcula retenciones.

## Stack
Next.js 15 App Router · TypeScript estricto · Tailwind + shadcn/ui · Supabase (Postgres, Auth, Storage) · Prisma como ORM · Vercel. Sin librerías de estado global; server components y server actions por defecto. Validación con zod en cada server action.

## Convenciones
- UI en español. Datos que van a Shopify/TikTok en inglés.
- Dinero en centavos (integer) en la base; gramos como numeric(8,2).
- Todo cambio de stock, precio o costo deja una fila en `audit_log` (quién, cuándo, antes, después).
- Cada tabla tiene `created_at`, `updated_at`, `created_by`.
- Migraciones con Prisma; nunca editar la base a mano.
- Tests: Vitest para lógica de negocio (precio, SKU, nómina). No hace falta testear UI.
- Antes de marcar una fase como terminada: `npm run typecheck && npm run test && npm run build` en verde.

## Identidad visual (ver docs/BRAND.md)
- Logotipo: `public/logo.svg` (oro) y `public/logo-dark.svg` (tabaco). Minúscula geométrica, un solo peso, nunca estirar ni agregar sombras.
- Colores: oro `#C08E3A` (acento, nunca fondo grande), oro claro `#D9B876`, oro profundo `#7E5F28`, oro oscuro `#523D16`, tabaco `#3E2D1E`, tinta `#221C17`, arena `#E1D8C8`, crema `#F9F6F0`.
- Tipografía: Jost para logotipo y títulos, DM Sans para texto, IBM Plex Mono para números (pesos, precios, SKU).

## Cómo trabajar conmigo
- Trabajá por fases (ver docs/PLAN.md). Al terminar una fase, deteneté y pedime que la pruebe.
- Si una decisión de negocio no está en este archivo ni en docs/, preguntame antes de asumir.
- Explicame en español y corto qué hiciste; no me pegues código en el chat salvo que lo pida.
