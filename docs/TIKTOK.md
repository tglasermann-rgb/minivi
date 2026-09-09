# TikTok Shop

## Cómo se conecta

TikTok Shop se conecta a Shopify como **canal de ventas**; el portal no habla con TikTok directamente.

1. Admin de Shopify → **Settings** → **Apps and sales channels** → **Shopify App Store** → buscar **TikTok** (app oficial "TikTok") → Add app → Add sales channel.
2. Dentro de la app: **Connect** con la cuenta de TikTok for Business / TikTok Shop del negocio y aceptar los términos de TikTok Shop US.
3. En la app de TikTok en Shopify → **Products**: elegir qué productos se sincronizan. Se sincronizan los productos **activos** con al menos una imagen, precio y stock. Los productos en borrador no se publican.
4. Las órdenes de TikTok Shop entran a Shopify como órdenes normales con `source_name = tiktok`; el portal las reconoce en la fase 5.

## Qué productos publicar en TikTok

Recomendación para empezar: los `bestseller` y `essential` de menos de $700, con 3 o más fotos. TikTok exige título, descripción, categoría, precio, stock, peso e imágenes; el portal ya manda todo eso a Shopify.

## CSV manual (por si hace falta)

Si TikTok Seller Center pide una carga masiva: Inventario → seleccionar productos → **Exportar** → **CSV para TikTok Shop**. Columnas: Product Name, Product Description, Category, Brand, Seller SKU, Variation Name, Variation Value, Price, Quantity, Package Weight (g), Main Image URL, Image URL 2–5.

TikTok cambia su plantilla con frecuencia: en Seller Center → Products → Batch upload → descargar la plantilla vigente y copiar las columnas de nuestro CSV a la de ellos. Las categorías de nuestro CSV usan el árbol "Jewelry Accessories & Derivatives > Fine Jewelry > …"; si TikTok pide un ID numérico de categoría, se elige en su plantilla.

## Reglas de texto

Todo en inglés, nunca "solid gold". Usar "real 14k gold", "stamped 14k", "no plating". El portal bloquea guardar productos con esa frase.
