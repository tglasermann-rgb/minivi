# MiniVi OS — Modelo de datos

Postgres en Supabase, gestionado con Prisma (`prisma/schema.prisma`). Convenciones:

- Dinero en **centavos** (`integer`). Gramos como `numeric(8,2)`.
- Toda tabla tiene `created_at`, `updated_at`, `created_by` (uuid del usuario).
- Nunca se borra: `status` / `archived` / `active`.
- Todo cambio de stock, precio, costo o configuración deja una fila en `audit_log`.
- RLS activado en todas las tablas sin políticas: la API REST de Supabase no puede leer nada; el portal accede con Prisma (rol `postgres`).
- Migraciones con `prisma migrate`; nunca editar la base a mano. Lo que Prisma no modela (RLS, seeds) va al final del `migration.sql` correspondiente.

Estado: **Fase 0 implementada**. El resto es el diseño aprobado para las fases siguientes y puede ajustarse al implementarlas.

---

## Fase 0 ✅

### profiles
Perfil de usuario. `id` = `auth.users.id` de Supabase (sin FK: el schema `auth` no lo gestiona Prisma). Se crea solo en el primer login.

| campo | tipo | nota |
|---|---|---|
| id | uuid PK | igual al id de Supabase Auth |
| email | text unique | |
| full_name | text? | |
| role | enum `owner` \| `kiosk` | default `kiosk`; `owner` si el email está en `OWNER_EMAILS` |

### settings
Clave/valor global. Valores como texto; tipado en `src/lib/settings.ts`.

| key | valor inicial | significado |
|---|---|---|
| precio_por_gramo | 30000 | centavos; precio al público por gramo |
| redondeo_precio | 500 | centavos; el precio se redondea hacia arriba a este múltiplo |
| costo_por_gramo_default | 10000 | centavos; sugerido al crear una compra |
| kilataje_default | 14k | |
| semana_inicia | monday | para las 40 h de la hora extra |
| overtime_umbral_horas | 40 | |
| tienda_timezone | America/New_York | |

En fases siguientes se agregan acá: `drive_root_folder_id`, `shopify_location_id`, presupuestos de apertura y mensuales, caja objetivo por mes, umbrales de ventas semanales.

### audit_log

| campo | tipo |
|---|---|
| id | bigserial PK |
| entity | text (`settings`, `products`, `stock_movements`, …) |
| entity_id | text |
| action | text (`create` \| `update` \| `archive` \| libre) |
| before / after | jsonb |
| user_id / user_email | quién |

Índices: `(entity, entity_id)`, `(created_at)`.

---

## Fase 1 — Inventario

### products
| campo | tipo | nota |
|---|---|---|
| id | uuid PK | |
| sku | text unique | `MV-<TIPO>-<NNNN>[-variante]`, inmutable |
| title | text | inglés |
| type | enum necklace \| bracelet \| earring \| ring \| charm \| pendant | |
| subcategory | text | lista válida en CLAUDE.md |
| extra_tags | text[] | new, bestseller, essential, gift, 2g, kids |
| karat | text | `14k` |
| grams | numeric(8,2) | |
| description_html | text | inglés, nunca "solid gold" |
| option_name / option_value | text? | Length / Size |
| cost_cents | int | gramos × (costo por gramo de la compra + el "+" de la línea) |
| price_cents | int | gramos × precio_por_gramo redondeado |
| price_override | bool | si true no se recalcula |
| status | enum draft \| active \| archived | |
| shopify_product_id / shopify_variant_id / shopify_inventory_item_id | text? | |
| drive_folder_id | text? | |
| barcode | text | = sku |
| purchase_item_id | uuid? FK | de dónde vino |
| notes | text? | |

### product_images
`product_id` FK, `drive_file_id`, `public_url`, `position`.

### stock_movements
`product_id` FK, `qty` (+/−), `reason` enum purchase \| sale \| return \| adjustment \| loss \| transfer, `reference` (order id, purchase id…), `note`. **Stock actual = suma de qty.** Índice `(product_id)`.

### sku_counters
`type` PK, `last_number` int. Para generar el siguiente SKU sin carreras (update … returning dentro de transacción).

---

## Fase 2 — Compras

- **suppliers**: name, contact, payment_terms (text), notes, active.
- **purchases**: supplier_id FK, date, invoice_number, status draft \| ordered \| received \| closed, cost_per_gram_cents, subtotal_cents, tax_cents, shipping_cents, total_cents, payment_terms (`cash` \| `30_60_90` \| json con cuotas), notes, attachments (bucket `purchase-docs`).
- **purchase_items**: purchase_id FK, description, type, subcategory, karat, grams, qty, qty_received, unit_cost_cents (= grams × (cost_per_gram + premium_cents) salvo override), premium_cents (el "+" de la línea, en centavos por gramo sobre la base de la compra), product_id FK? (se crea al recibir).
- **payables**: purchase_id FK, amount_cents, due_on, paid_on?, method?. Se generan según condiciones.

---

## Fase 3 — Gastos

- **expense_categories**: name, group `opening` \| `recurring`, budget_cents? (apertura), monthly_budget_cents? (recurrente), sort, active. Precargadas.
- **expenses**: date, category_id FK, vendor, amount_cents, payment_method enum company_card \| cash \| transfer \| personal_card_tomas \| personal_card_nissim, recurring bool, frequency monthly \| yearly?, notes, receipt_url (bucket privado `receipts`), paid bool, reimbursable bool.
- **monthly_budgets**: year_month, category_id FK, amount_cents (editable; marketing 2,500 → 4,500 al mes 7).

---

## Fase 4 — Empleados y nómina

- **employees**: name, pin_hash, hourly_rate_cents, hired_on, active, phone, email, notes.
- **time_entries**: employee_id FK, clock_in, clock_out?, break_minutes, edited_by?, note, photo_url?. Índice `(employee_id, clock_in)`.
- **pay_periods**: starts_on, ends_on, status open \| closed \| paid.
- **pay_period_lines**: pay_period_id FK, employee_id FK, regular_hours numeric(6,2), overtime_hours numeric(6,2), rate_cents, gross_cents.

---

## Fase 5 — Ventas

- **orders**: shopify_order_id unique, order_number, channel enum web \| pos \| tiktok \| other (por `source_name`), placed_at, customer_id FK?, subtotal_cents, tax_cents, discount_cents, total_cents, payment_method, financial_status, fulfillment_status, staff_name?, raw jsonb.
- **order_items**: order_id FK, product_id FK?, sku, title, qty, price_cents, cost_cents_at_sale, grams_at_sale.
- **customers**: shopify_customer_id unique, name, email, phone, orders_count, total_spent_cents.
- **webhook_events**: shopify_event_id unique, topic, received_at, processed_at, payload jsonb. Idempotencia.

---

## Fase 6 — Reportes

- **cash_targets**: month (1–12), target_cents. Regla de parada: rojo si caja real < objetivo − 2,000,000 centavos.

## Fase 7 — Extras

- **inventory_counts** / **inventory_count_lines**, **warranty_claims**, **gold_spot** (date, usd_per_gram), **backups**.
