# MiniVi — Identidad aplicada al portal

Resumen del manual de marca para lo que el portal necesita. Fuente: manual de identidad (páginas 20–21).

## Logotipo

Minúscula geométrica, terminales de corte recto, puntos cuadrados sobre las íes. Un solo peso.

| archivo | uso |
|---|---|
| `public/logo.svg` | oro sobre superficie oscura (sidebar, login) |
| `public/logo-dark.svg` | tabaco sobre crema/blanco (PDFs, móvil) |
| `public/logo-crema.svg` | crema sobre tabaco/tinta |
| `public/isotipo.svg` | los tres cuadrados de las íes; favicon y tamaños chicos |

Los SVG están dibujados a partir del manual (trazo 28 sobre 190 de alto, x-height 130). Si tenés el archivo vectorial oficial, reemplazá `logo.svg` y `logo-dark.svg` sin cambiar el nombre: el componente `<Logo />` los toma de ahí. El isotipo es provisional hasta tener el oficial.

Reglas:
- **Un solo peso.** No hay versión gruesa.
- **Contraojo.** Al tamaño final, el hueco de la `m` nunca queda más angosto que el trazo.
- **Área de respeto** igual al alto del cuadrado de la `i`, por los cuatro lados.
- **Piso de 13 px.** Debajo, usar el isotipo. En el punzón de la pieza (~2 mm) solo va el isotipo.
- No: terminales redondeados, estirar o comprimir, oro sobre oro, sombras, degradados, relieve.

## Color

| nombre | hex | token Tailwind | uso en el portal |
|---|---|---|---|
| Oro | `#C08E3A` | `oro` | acento: logo, botón principal, indicador activo, filetes |
| Oro claro | `#D9B876` | `oro-claro` | texto destacado sobre fondo oscuro |
| Oro profundo | `#7E5F28` | `oro-profundo` | eyebrows, links, acentos sobre crema |
| Oro oscuro | `#523D16` | `oro-oscuro` | detalles |
| Tabaco | `#3E2D1E` | `tabaco` | botón por defecto, logo sobre claro |
| Tinta | `#221C17` | `tinta` | sidebar, texto principal, kiosco |
| Arena | `#E1D8C8` | `arena` | bordes, separadores |
| Crema | `#F9F6F0` | `crema` | fondo de la app |

**La regla del oro:** es acento, nunca fondo. Una superficie grande de oro plano se ve barata. El único bloque de oro permitido es el botón principal (`variant="gold"`), y uno por pantalla.

Los tokens semánticos de shadcn (`background`, `primary`, `muted`, `border`…) están mapeados sobre esta paleta en `src/app/globals.css`. Usar los semánticos para UI general y los de marca (`oro`, `tinta`…) solo cuando el color es intencional.

## Tipografía

| fuente | variable | uso |
|---|---|---|
| Jost 400/500 | `font-display` | logotipo, títulos h1–h4, títulos de tarjetas |
| DM Sans 400/500/600 | `font-sans` (default) | texto, formularios, tablas |
| IBM Plex Mono 400/500 | `font-mono` | pesos, precios, SKU, fechas, todo dato numérico |

Cargadas con `next/font/google` en `src/app/layout.tsx`. Números siempre tabulares (`tabular-nums`, activado globalmente en tablas).

## Voz

Interfaz en español rioplatense, corta, sin exclamaciones. Todo lo que sale al público (Shopify, TikTok, etiquetas) en inglés, nunca "solid gold": usar "real 14k gold", "stamped 14k", "no plating".
