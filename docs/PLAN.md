# MiniVi OS — Plan por fases

Portal interno de MiniVi Jewelry LLC. Cada fase termina con `npm run typecheck && npm run test && npm run build` en verde, README y docs actualizados, y una lista de "cómo probarlo". **No se arranca la siguiente fase sin aprobación.**

Decisiones ya tomadas (no se vuelven a discutir): Shopify es la fuente de verdad de productos/stock/ventas; stack Next.js 15 + Supabase + Prisma + Vercel; fotos de producto en Google Drive; facturas en Supabase Storage; etiquetas Code 128 mariposa 2.2" × 0.5"; fichaje con PIN en tablet; nómina 1–15 y 16–fin con extra sobre 40 h/semana; roles `owner` y `kiosk`; UI en español, datos públicos en inglés; dinero en centavos.

| Fase | Qué | Estado |
|---|---|---|
| 0 | Base del proyecto | ✅ Lista para probar |
| 1 | Inventario, SKU, etiquetas y export | ✅ Lista para probar |
| 2 | Compras (unificada con Inventario) | ✅ Lista para probar |
| 3 | Gastos | ✅ Lista para probar |
| 4 | Empleados, fichaje y nómina | ✅ Lista para probar |
| 5 | Ventas (Shopify web, POS y TikTok) | ✅ Lista para probar |
| 6 | Inicio, reportes y regla de parada | ✅ Lista para probar |
| 7 | Extras que Shopify no da | ✅ Lista para probar |

Orden sugerido: 0 → 1 (para cuando llegue la mercadería) → 3 (ya hay gastos) → 2 y 4 (antes de abrir) → 5 y 6 (primera semana con la tienda abierta) → 7.

---

## Fase 0 — Base del proyecto ✅

1. Next.js 15 (App Router, TypeScript estricto, Tailwind 4, ESLint) + componentes shadcn/ui: button, card, table, dialog, form, input, select, tabs, badge, sheet, toast (sonner), calendar, dropdown-menu, command, label, popover, separator, textarea.
2. Supabase conectado (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`). Prisma 7 con adapter `pg` contra la base de Supabase. `.env.example` documentado.
3. Auth con Supabase (email + password). Tabla `profiles` con `role` (`owner` | `kiosk`). Middleware protege `/app/*` y `/kiosk/*` (sin sesión → `/login`); el rol se verifica en los layouts (`/app` solo owner; `/kiosk` owner o kiosk). Sin registro público. El perfil se crea solo en el primer login: `owner` si el email está en `OWNER_EMAILS`, si no `kiosk`.
4. Layout con sidebar (Inicio, Inventario, Ventas, Gastos, Empleados, Legal, Reportes, Configuración), responsive (sheet en móvil). Logotipo en `public/logo.svg`, identidad en `docs/BRAND.md`.
5. Tabla `settings` con valores iniciales: `precio_por_gramo=30000`, `redondeo_precio=500`, `costo_por_gramo_default=10000`, `kilataje_default=14k`, `semana_inicia=monday`, `overtime_umbral_horas=40`, `tienda_timezone=America/New_York`.
6. Tabla `audit_log` + helper `audit(entity, id, before, after)` en `src/lib/audit.ts`.
7. Página `/app` con tarjetas placeholder; `/app/configuracion` funcional.

**Entregable:** entrar con mi usuario, ver el menú y cambiar el precio por gramo en Configuración (queda en el historial).

**Cómo probarlo:** ver README → "Cómo probar la fase 0".

---

## Fase 1 — Inventario, SKU, etiquetas y export ✅

Modelo: `products`, `product_images`, `stock_movements` (el stock es la suma de movimientos; nunca un campo editable).

1. Generador de SKU `MV-<TIPO>-<NNNN>` con sufijo de variante. Test unitario.
2. Precio automático: gramos × `precio_por_gramo`, redondeado hacia arriba a `redondeo_precio`; respeta `price_override`. Test unitario.
3. Lista con filtros (tipo, subcategoría, estado, con/sin foto, con/sin Shopify), búsqueda por SKU/título y totales (piezas, gramos, costo, precio al público).
4. Ficha de producto: edición, movimientos de stock, fotos de Drive, "Ajustar stock".
5. Google Drive con cuenta de servicio (`docs/SETUP-DRIVE.md`): "Buscar fotos" por SKU (archivos `SKU.jpg`, `SKU-2.jpg` o carpeta `SKU`), copia a bucket público `product-images`.
6. Etiquetas PDF mariposa 2.2" × 0.5" con Code 128 (`docs/LABELS.md`).
7. Export a Shopify: (a) CSV con las columnas del importador; (b) sincronización por Admin GraphQL API, IDs guardados en el producto, botón por producto y masivo (`docs/SETUP-SHOPIFY.md`).
8. CSV para TikTok Shop (`docs/TIKTOK.md`).

**Entregable:** crear 5 productos, SKU y precio automáticos, fotos desde Drive, etiquetas impresas, publicados en Shopify como draft.

## Fase 2 — Compras ✅

> Compras e Inventario se unificaron: la factura del proveedor y el alta de las piezas son una sola pantalla (`/app/inventario/entradas/nueva`). Ya no existe el paso de "recibir mercadería".

Modelo: `suppliers`, `purchases`, `purchase_items`, `payables`, adjuntos en bucket `purchase-docs`.

1. Orden de compra en PDF con logo.
2. Al guardar la entrada, cada pieza crea un producto (o repone uno existente) y su `stock_movement`. No hay paso de recepción: la mercadería se carga cuando ya llegó.
3. Cuentas por pagar: vencimientos, marcar pagado, alerta a 7 días en Inicio.
4. Costo promedio por gramo del inventario, ponderado por gramos.

**Entregable:** compra de 20 piezas a $100/g con 30/60/90 → 20 productos con SKU, precio y stock, y tres cuentas por pagar.

## Fase 3 — Gastos ✅

Modelo: `expense_categories` (apertura y recurrentes, precargadas), `expenses` con `receipt_url` en bucket privado `receipts`, `reembolsable`.

1. Carga rápida desde el celular con foto. OCR: no se hizo (opcional); el monto y la fecha se tipean.
2. Gastos recurrentes: esperado vs. cargado.
3. Vista "Apertura" contra presupuesto (Build-out 34,000; Seguridad 21,100; Marketing de apertura 10,000; Licencias/seguro/legal 8,000; Depósitos 7,200; Web 1,700; Empaque 5,500; Inventario 75,000).
4. Vista "Mensual" contra presupuesto editable (renta 2,400; nómina 7,767; marketing 2,500 los primeros 6 meses y 4,500 después; etc.).
5. Export CSV/Excel para el contador.

**Entregable:** cargar un gasto con foto en menos de 30 segundos y ver apertura vs. presupuesto.

## Fase 4 — Empleados, fichaje y nómina ✅

Modelo: `employees` (PIN hasheado, tarifa por hora), `time_entries`, `pay_periods`.

1. `/kiosk`: teclado numérico, PIN → Entrada/Salida, foto opcional.
2. `/app/empleados`: quién está fichado, editar/agregar entradas con audit.
3. Nómina: períodos 1–15 y 16–fin; extra 1.5× sobre 40 h/semana lunes–domingo; semana partida entre períodos atribuye la extra donde se superan las 40. Tests: semana normal, 45 h, semana partida.
4. "Cerrar período": PDF y CSV (nombre, regular hours, overtime hours, rate). Marcar pagado.
5. Reporte de nómina por mes contra presupuesto.

**Entregable:** dos empleadas fichan dos semanas desde la tablet, cierro el período y sale el PDF.

## Fase 5 — Ventas ✅

1. Sincronizar órdenes de Shopify (API + webhooks `orders/create`, `orders/updated`, `refunds/create`) en `orders` y `order_items`, con canal por `source_name` (web, pos, tiktok).
2. Cada venta genera `stock_movements` de salida; devolución, de entrada. Idempotencia por order id.
3. Vista Ventas: hoy/semana/mes, por canal, vendedor, tipo. Ticket promedio, gramos vendidos, margen bruto.
4. Ventas por semana contra 15 base / 12 conservador / 20 optimista y umbrales 9.5 y 11.2, grande en Inicio.
5. Clientes: lo mínimo que trae Shopify.

**Entregable:** venta de prueba en Shopify aparece en 10 segundos con su canal y el stock del SKU bajó.

## Fase 6 — Inicio, reportes y regla de parada ✅

1. Dashboard completo.
2. Reporte mensual en PDF contra el escenario base.
3. Regla de parada: caja objetivo por mes (1 a 12); rojo si está más de $20,000 por debajo.
4. Export contable por rango de fechas.

## Fase 7 — Extras ✅

- Conteo físico con la cámara del celular (o lector USB), diferencias y ajuste de stock.
- Garantías y reparaciones por SKU vendido.
- Spot del oro diario (api.gold-api.com o manual): valor a metal del inventario y aviso si el costo por gramo de compra se aleja más del 10 %.
- Ventas por vendedora por período (staff del POS) contra una meta.
- Backup semanal de la base al bucket privado `backups`, con descarga desde Configuración.

---

## Legal — contratos y documentos ✅

Fuera del plan original, a pedido: un lugar para contratos, pólizas, licencias y todo papel del negocio.

- `legal_documents` (título, categoría, estado, contraparte, referencia, vigencia, aviso previo, monto, notas) y `legal_files` (archivos en el bucket privado `legal-docs`, enlaces firmados por una hora).
- Categorías pensadas para el negocio: alquiler del local, seguros, licencias y permisos, proveedores, empleados, sociedad (LLC), impuestos, banco y otros.
- Aviso configurable por documento: aparece en Inicio cuando falta menos que el aviso previo, y en rojo si ya venció.
- Lista con filtros por categoría, estado, texto y vencimiento; totales de por vencer, vencidos y sin archivo adjunto.
- Los documentos no se borran: se marcan terminados. Todo cambio queda en `audit_log`.

## Reglas para todo el proyecto

- Nunca borrar datos: archivar o marcar inactivo.
- Todo lo público en inglés y sin "solid gold".
- Fechas y horas en America/New_York.
- Si algo es imposible o inconveniente, avisar y proponer alternativa antes de hacerlo distinto.
