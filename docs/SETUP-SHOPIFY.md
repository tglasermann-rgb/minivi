# Shopify — app custom y sincronización

El portal crea y actualiza productos en Shopify por la **Admin GraphQL API** con una app custom de la tienda. Shopify sigue siendo la fuente de verdad de lo publicado, el stock y las ventas.

## Crear la app custom (una sola vez)

1. Admin de Shopify → **Settings** (abajo a la izquierda) → **Apps and sales channels** → **Develop apps** → **Allow custom app development** (si lo pide) → **Create an app**.
2. Nombre: `MiniVi OS`. Create app.
3. Pestaña **Configuration** → **Admin API integration** → **Configure**. Marcar estos permisos (scopes):
   - `read_products`, `write_products`
   - `read_inventory`, `write_inventory`
   - `read_locations`
   - `read_orders`, `write_orders` (fase 5)
   - `read_customers` (fase 5)
   - `read_product_listings` (opcional)
   Save.
4. Pestaña **API credentials** → **Install app** → confirmar. Aparece el **Admin API access token** (empieza con `shpat_`). Se muestra **una sola vez**: copialo y guardalo.
5. El dominio de la tienda es el que termina en `.myshopify.com` (Settings → Domains).

## Cargar en el portal

En Vercel → Settings → Environment Variables (todas en All Environments):

| Nombre | Valor |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `tu-tienda.myshopify.com` (tipo Config) |
| `SHOPIFY_ADMIN_TOKEN` | el token `shpat_…` (tipo Secret) |
| `SHOPIFY_API_VERSION` | opcional; por defecto `2026-01` |

Redeploy. Después, en el portal → **Configuración** → **Ubicación de Shopify** → **Buscar ubicaciones en Shopify** → elegí la tienda física → Guardar. Sin esto, se publica el producto pero no el stock.

## Qué manda el portal al publicar

Por cada producto (o grupo de variantes que comparten `handle`):

- título, descripción HTML, vendor `MiniVi`, tipo, tags (tipo + subcategoría + extras + kilataje + `real-gold`), estado (`draft` o `active`);
- por variante: SKU, barcode (= SKU), precio, costo, peso en gramos, y el stock disponible en la ubicación configurada;
- las fotos ya copiadas al bucket público (ver docs/SETUP-DRIVE.md).

Usa la mutación `productSet` (crea o actualiza según haya `shopify_product_id`). Los IDs de producto, variante e inventory item se guardan en el producto. Cada "Ajustar stock" en el portal actualiza el stock en Shopify con `inventorySetQuantities`.

## CSV alternativo

Si preferís cargar por el importador de Shopify: en Inventario, seleccioná productos → **Exportar** → **CSV para Shopify**. Tiene las columnas exactas del importador (Handle, Title, Body (HTML), Vendor, Type, Tags, Published, Option1 Name/Value, Variant SKU, Variant Grams, Inventory Tracker/Qty/Policy, Fulfillment Service, Price, Requires Shipping, Taxable, Image Src/Position, Weight Unit, Cost per item, Status). Admin → Products → Import.

## Problemas comunes

- "Shopify no está configurado": faltan las variables o el redeploy.
- "Shopify respondió 401/403": token inválido o la app no tiene los scopes; volvé a instalar la app después de cambiar permisos.
- "userErrors: … option values": dos variantes con el mismo valor de opción; revisá que cada variante tenga un valor distinto (16, 18…).
- Si Shopify avisa que la versión de API venció: cambiá `SHOPIFY_API_VERSION` a una vigente (las versiones duran 12 meses).

## Ventas: webhooks de órdenes (fase 5)

Para que las ventas aparezcan en el portal en segundos:

1. Admin de Shopify → **Settings** → **Notifications** → **Webhooks** (abajo de todo) → **Create webhook**.
2. Crear cuatro, todos con formato **JSON**, versión de API la misma que `SHOPIFY_API_VERSION`, y URL `https://minivi.vercel.app/api/webhooks/shopify`:
   - `Order creation` (orders/create)
   - `Order update` (orders/updated)
   - `Order cancellation` (orders/cancelled)
   - `Refund create` (refunds/create)
3. En esa misma pantalla, abajo, dice "All your webhooks will be signed with **…**": copiá ese texto y cargalo en Vercel como `SHOPIFY_WEBHOOK_SECRET` (Secret, All Environments). Redeploy.
4. Probar: hacé una venta de prueba en Shopify (o en el POS). En Ventas aparece en segundos con su canal, y el stock del SKU bajó.

Respaldo: un cron diario (`vercel.json`, 10:00 UTC) vuelve a traer lo actualizado por si algún webhook se perdió; el botón **Sincronizar** hace lo mismo a mano, y **Todo el historial** trae todas las órdenes desde el principio (para arrancar).

Canal: se detecta por `source_name` de la orden: `web` → Web, `pos` → Tienda, `tiktok` → TikTok Shop. Vendedora: el staff del POS (si la app tiene el scope `read_users`; si no, queda vacío).
