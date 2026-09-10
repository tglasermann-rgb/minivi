# Etiquetas con código de barras

## Modelo de etiqueta

Etiqueta de joyería tipo **mariposa** (también llamada "dumbbell" o "rat-tail"), **2.2" × 0.5"** (55.9 × 12.7 mm): dos alas cuadradas en los extremos unidas por una cola angosta que se enrolla en la pieza y se pega ala con ala.

```
|  ala izquierda 0.75"  |   cola 0.70"   |  ala derecha 0.75"  |
|  [ Code 128 ]         |   MV-NK-0001   |   $630              |
|   MV-NK-0001          |                |   2.10 g · 14k      |
```

- Ala izquierda: código de barras **Code 128** con el SKU, y el SKU en texto.
- Cola: el SKU en texto chico (queda visible aunque la pieza tape las alas).
- Ala derecha: precio, gramos y kilataje.

Referencias compatibles: Zebra `10010064`/`LV-10010064` (2.2" × 0.5" jewelry tag), Dymo `30299` es 3/8" × 3/4" (más chica, **no** usar con esta plantilla). Cualquier rollo "jewelry butterfly 2.2 × 0.5 in" de marca genérica sirve.

## Cómo imprimir

1. Inventario → seleccioná los productos → **Etiquetas**. Se abre un PDF con **una etiqueta por página** (página de 2.2" × 0.5").
2. Imprimir con la impresora de etiquetas, escala **100 % / tamaño real** (nunca "ajustar a página").
3. Para varias copias del mismo SKU: agregá `&copies=3` a la URL del PDF.

## Calibrar la impresora

### Zebra ZD421
1. Cargar el rollo y cerrar. Mantener apretado el botón de **Feed** hasta que la luz parpadee dos veces: la impresora mide las etiquetas (auto-calibración).
2. En la computadora: instalar **Zebra Setup Utilities**, elegir la impresora, **Configure Printer Settings** → tamaño de etiqueta 2.20 × 0.50 in, tipo "gap/notch", velocidad 2 ips, oscuridad 20.
3. Al imprimir el PDF, en el diálogo de impresión elegir tamaño de papel "2.2 × 0.5" o "Custom".

### Dymo LabelWriter 550
1. Dymo Connect → Preferencias → agregar tamaño personalizado 2.2 × 0.5 in.
2. Imprimir el PDF desde el visor con "tamaño real". Si sale desplazado, ajustar el margen en Dymo Connect → "Print alignment".

## Escaneo
Cualquier lector de códigos de barras USB o Bluetooth (o la cámara del celular en la fase 7) lee Code 128 y devuelve el SKU. En Shopify POS, el SKU/barcode del producto coincide con el de la etiqueta, así que escanear en el mostrador agrega la pieza al carrito.
