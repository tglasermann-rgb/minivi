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

**Fase 0 — Base:** lista. **Fase 1 — Inventario:** lista. **Fase 2 — Compras:** lista. **Fase 3 — Gastos:** lista. **Fase 4 — Empleados y nómina:** lista. **Fase 5 — Ventas:** lista. **Fase 6 — Inicio, reportes y regla de parada:** lista para probar (dashboard completo, reporte mensual en PDF contra el plan, caja real vs objetivo con alerta roja, export contable CSV de ventas, gastos y nómina).

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

## Cómo probar la fase 2

1. Compras → **Proveedores** → **Nuevo proveedor**.
2. Compras → **Nueva compra**: costo por gramo 100, condiciones 30/60/90, 20 líneas (o menos, con cantidad). Abajo se ven el total y las tres cuotas con fecha. Crear.
3. En la ficha: **PDF** abre la orden con el logo para mandar al proveedor. **Estado → Pedida**.
4. **Recibir mercadería**: confirmá las cantidades. Aparecen los SKU en cada línea; en Inventario están los productos con precio automático y stock. Probá recibir parcial primero (menos unidades) y después el resto.
5. **Cuentas por pagar**: tres cuotas pendientes; marcá una como pagada. En Inicio aparecen las que vencen en 7 días.
6. Reportes: costo promedio por gramo del inventario, ponderado por gramos.

## Cómo probar la fase 3

1. Desde el celular: Gastos → sacá la foto de una factura, poné fecha, monto y categoría → **Guardar gasto**. Menos de 30 segundos.
2. Pagá algo con "Tarjeta personal de Tomas": queda **reembolsable**; después "marcar reembolsado".
3. **Apertura**: barras de gastado vs presupuesto por grupo del plan (Build-out 34,000, Seguridad 21,100…). Inventario suma las compras.
4. **Mensual**: matriz de 6 meses; clic en un presupuesto para cambiarlo solo ese mes. Marketing pasa de 2,500 a 4,500 desde el mes 7 (Configuración → mes de apertura).
5. **Presupuestos**: editar montos del plan.
6. **CSV contador**: descarga el mes con la columna de reembolsable.

## Cómo probar la fase 4

1. Empleados → **Nueva empleada**: nombre, PIN de 4 dígitos, tarifa por hora. Creá dos.
2. En la tablet (o en tu celular), entrá con el usuario del kiosco a `/kiosk`. Tecleá el PIN: "Entrada". Volvé a teclearlo: "Salida" con las horas. En Configuración podés activar la foto al fichar.
3. Empleados: "Fichadas ahora" y la tabla de entradas del período. Corregí una entrada (lápiz) o agregá una manual: queda marcada con ✎ y en el historial.
4. Nómina: elegí el período, mirá horas normales y extra por empleada. Con una semana de 45 h aparecen 5 h extra. **Cerrar período** → **PDF** y **CSV para payroll** (nombre, regular hours, overtime hours, rate). **Marcar pagado**.
5. Nómina por mes vs. plan: compara el bruto de los períodos cerrados contra los 7,767 del plan.

## Cómo probar la fase 5

1. Configurar Shopify (`docs/SETUP-SHOPIFY.md`): app custom con scopes de órdenes y clientes, y los 4 webhooks con `SHOPIFY_WEBHOOK_SECRET` en Vercel.
2. Ventas → **Todo el historial** una vez para traer las órdenes existentes.
3. Hacé una venta de prueba en Shopify (o en el POS con un SKU del inventario). En menos de 10 segundos aparece en Ventas con su canal, y en Inventario el stock del SKU bajó con un movimiento "Venta".
4. Hacé una devolución en Shopify: entra un movimiento "Devolución" y el neto se ajusta.
5. Inicio y Ventas: "Ventas por semana" contra 15 base / 12 conservador / 20 optimista y los umbrales 9.5 y 11.2.
6. Ventas → **Clientes**: lista con compras y total gastado.

## Cómo probar la fase 6

1. Inicio: ventas por semana vs plan, caja del mes, ventas netas y margen, stock en gramos y dólares, regla de parada, cuentas por pagar próximas, fichadas ahora y últimos gastos.
2. Configuración: cargá la **caja inicial** (con lo que abrís) y el mes de apertura.
3. Reportes → tabla "Regla de parada": cargá el objetivo de caja de cada mes (M1 a M12) del plan. La fila se pone en rojo si la caja real queda más de $20,000 por debajo.
4. **PDF del mes**: ventas por canal, margen, gastos por categoría vs plan, nómina, resultado y caja, con la regla de parada.
5. **Ventas CSV / Gastos CSV / Nómina CSV**: exports del mes para el contador (también sirven por rango cambiando las fechas en la URL).

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
