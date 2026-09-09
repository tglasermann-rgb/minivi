# Guía fácil: poner el portal en internet (sin instalar nada)

Vas a usar tres páginas web: **Supabase** (la base de datos, ya la creaste), **Vercel** (el servidor que muestra el portal) y **GitHub** (donde está el código, ya está). No hace falta instalar nada en tu computadora.

Tiempo estimado: 15 minutos.

---

## Paso 1 — Copiar 5 datos de Supabase

Abrí tu proyecto en https://supabase.com/dashboard y dejá abierto un bloc de notas para ir pegando.

### 1a. La dirección y las dos claves
1. En el menú de la izquierda, abajo de todo, hacé clic en el **engranaje** (Project Settings).
2. Hacé clic en **API Keys**.
3. Copiá y pegá en el bloc de notas:
   - **Project URL** (empieza con `https://` y termina en `.supabase.co`).
   - La clave que dice **anon** o **publishable** (un texto larguísimo).
   - La clave que dice **service_role** o **secret** (hay que hacer clic en "Reveal" para verla). Esta es secreta: no la mandes por chat ni por mail.

### 1b. Las dos direcciones de la base de datos
1. Arriba de la pantalla, hacé clic en el botón **Connect**.
2. Buscá la sección **Transaction pooler**. Copiá esa dirección larga que empieza con `postgresql://`. Es la número 1.
3. Buscá la sección **Session pooler**. Copiá esa dirección. Es la número 2.
4. Las dos tienen escrito `[YOUR-PASSWORD]` en el medio. Borrá eso (con los corchetes) y escribí ahí la contraseña de la base de datos que pusiste cuando creaste el proyecto.
   - ¿No la anotaste? Engranaje → **Database** → botón **Reset database password**. Te da una nueva. Guardala.

### 1c. Crear tu usuario para entrar al portal
1. Menú de la izquierda → **Authentication**.
2. Arriba, pestaña **Users** → botón **Add user** → **Create new user**.
3. Escribí tu email y una contraseña (esta es la que vas a usar para entrar al portal).
4. Si aparece la casilla **Auto Confirm User**, marcala.
5. Repetí lo mismo con el email de Nissim.

---

## Paso 2 — Crear cuenta en Vercel y conectar GitHub

1. Entrá a https://vercel.com/signup.
2. Elegí **Continue with GitHub** y aceptá los permisos (usá la misma cuenta de GitHub donde está el repo `minivi`).
3. Cuando te pregunte el plan, elegí **Hobby** (gratis).

---

## Paso 3 — Importar el proyecto

1. En Vercel, botón **Add New…** → **Project**.
2. Buscá `minivi` en la lista y hacé clic en **Import**.
   - Si no aparece, hacé clic en "Adjust GitHub App Permissions" y dale acceso al repo `minivi`.
3. Te muestra una pantalla de configuración. **No toques nada** de Framework ni Build.

---

## Paso 4 — Pegar los datos (variables de entorno)

En esa misma pantalla, abrí la sección **Environment Variables**. Vas a cargar 6 renglones. En cada uno escribís un **nombre** a la izquierda (exacto, en mayúsculas) y pegás el **valor** a la derecha, y apretás **Add**.

| Nombre (izquierda) | Valor (derecha) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | la Project URL del paso 1a |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clave anon / publishable del paso 1a |
| `SUPABASE_SERVICE_ROLE_KEY` | la clave service_role / secret del paso 1a |
| `DATABASE_URL` | la dirección número 1 (Transaction pooler) con tu contraseña |
| `DIRECT_URL` | la dirección número 2 (Session pooler) con tu contraseña |
| `OWNER_EMAILS` | tu email y el de Nissim, separados por coma, sin espacios. Ejemplo: `tomas@gmail.com,nissim@gmail.com` |

Cuando estén los 6, hacé clic en **Deploy**.

---

## Paso 5 — Esperar y entrar

1. Vercel tarda 2 a 4 minutos. Cuando termina, aparecen fuegos artificiales y un botón **Visit** (o **Continue to Dashboard** y después la dirección del sitio).
2. Hacé clic. Se abre el portal con la pantalla **Entrar**.
3. Escribí el email y la contraseña que creaste en el paso 1c.
4. Tenés que ver el menú: Inicio, Compras, Inventario, Ventas, Gastos, Empleados, Reportes, Configuración.

La dirección va a ser algo como `https://minivi-xxxx.vercel.app`. Guardala: es tu portal. Funciona desde el celular también.

---

## Paso 6 — Probar que todo anda

1. Entrá a **Configuración**.
2. Cambiá "Precio por gramo" de 300 a 310 y apretá **Guardar cambios**.
3. Tiene que aparecer "Configuración guardada" y, más abajo, una fila en "Historial de cambios" con tu email, 30000 y 31000 (está en centavos).
4. Volvé a **Inicio**: el subtítulo dice el precio nuevo.
5. Volvé a Configuración y dejalo en 300 de nuevo.

Si algo de esto no pasa, sacale una captura de pantalla a lo que ves y mandámela.

---

## Si Vercel muestra un error rojo al desplegar

Casi siempre es una de estas tres cosas:
- Una variable quedó con el nombre mal escrito. Revisá que sean exactamente los 6 nombres de la tabla.
- Quedó `[YOUR-PASSWORD]` sin reemplazar en `DATABASE_URL` o `DIRECT_URL`.
- La contraseña de la base tiene un símbolo raro (`@`, `#`, `%`). Solución: Reset database password en Supabase, elegir una solo con letras y números, y actualizar las dos variables en Vercel (Settings → Environment Variables), después **Redeploy**.

Para volver a intentar: en Vercel, pestaña **Deployments** → los tres puntos del último → **Redeploy**.

---

## De ahora en más

Cada vez que yo suba una fase nueva y vos la apruebes, Vercel actualiza el portal solo. No tenés que repetir nada de esto.
