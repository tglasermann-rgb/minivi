# Google Drive — fotos de producto

El portal busca las fotos de cada producto en una carpeta de Google Drive, por nombre de archivo, y las copia a un bucket público de Supabase (`product-images`) para que Shopify pueda descargarlas.

## Cómo nombrar las fotos

Dentro de la carpeta raíz, cualquiera de estas dos formas:

- Archivos con el SKU al principio del nombre: `MV-NK-0001.jpg`, `MV-NK-0001-2.jpg`, `MV-NK-0001-3.png`.
- Una subcarpeta llamada exactamente como el SKU (`MV-NK-0001`) con las fotos adentro, con cualquier nombre.

El orden es alfabético natural: `MV-NK-0001.jpg` va primero, después `-2`, `-3`… La primera es la principal en Shopify.

## Crear la cuenta de servicio (una sola vez, 10 minutos)

1. Entrá a https://console.cloud.google.com con la cuenta de Google del negocio.
2. Arriba a la izquierda, creá un proyecto nuevo: nombre `minivi-os`.
3. Menú ☰ → **APIs y servicios** → **Biblioteca** → buscá **Google Drive API** → **Habilitar**.
4. Menú ☰ → **IAM y administración** → **Cuentas de servicio** → **Crear cuenta de servicio**.
   - Nombre: `minivi-portal`. Siguiente, siguiente, Listo (no hace falta darle roles).
5. Hacé clic en la cuenta creada → pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → **JSON** → Crear. Se descarga un archivo `.json`. **Guardalo, es secreto.**
6. Abrí el archivo con un editor de texto. Copiá el email que dice `client_email` (termina en `iam.gserviceaccount.com`).
7. En Google Drive, hacé clic derecho sobre la carpeta de fotos → **Compartir** → pegá ese email → permiso **Lector** → Enviar.
8. Copiá el ID de la carpeta: es la parte final de la URL cuando la abrís (`https://drive.google.com/drive/folders/ESTE-ID`).

## Cargar en el portal

1. En Vercel → Settings → Environment Variables, creá `GOOGLE_SERVICE_ACCOUNT_JSON` (tipo Secret, All Environments). El valor es **todo el contenido del archivo JSON en una sola línea**. Si te resulta más cómodo, podés pegarlo tal cual: el portal acepta el JSON con saltos de línea o en base64.
2. Redeploy.
3. En el portal → **Configuración** → **Carpeta raíz de fotos en Google Drive (ID)** → pegá el ID de la carpeta → Guardar.

## Usar

- En la ficha de un producto: botón **Buscar fotos**.
- En la lista: seleccioná varios → **Buscar fotos**.

Cada corrida es idempotente: fotos ya copiadas no se duplican; fotos nuevas en Drive se agregan al final.

## Problemas comunes

- "Falta GOOGLE_SERVICE_ACCOUNT_JSON": no está la variable en Vercel o no se hizo redeploy.
- "Drive API files: 403": la carpeta no está compartida con el email de la cuenta de servicio, o la Drive API no está habilitada en el proyecto.
- "0 fotos encontradas": revisá que el nombre del archivo empiece exactamente con el SKU (mayúsculas no importan) o que la subcarpeta se llame como el SKU.
