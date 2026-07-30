# Clic Soluciones 🛒

PWA de e-commerce para venta de productos para el hogar (iluminación, cocina, organización y ofertas).

**Stack:** Next.js 14 (App Router) + React + Tailwind CSS + Supabase (DB/Auth) + Vercel (deploy).

---

## 1. Requisitos previos

- Node.js 18 o superior instalado (https://nodejs.org)
- Una cuenta gratuita en [Supabase](https://supabase.com)
- Una cuenta gratuita en [Vercel](https://vercel.com)
- Una cuenta en [GitHub](https://github.com)

---

## 2. Ejecutar el proyecto en tu computadora (local)

```bash
# 1. Entrar a la carpeta del proyecto
cd clic-soluciones

# 2. Instalar dependencias
npm install

# 3. Copiar el archivo de variables de entorno
cp .env.local.example .env.local

# 4. Completar .env.local con tus datos de Supabase (ver paso 4 más abajo)

# 5. Levantar el servidor de desarrollo
npm run dev
```

Abrí http://localhost:3000 en el navegador. Deberías ver la home de Clic Soluciones (sin productos hasta que configures Supabase y cargues datos).

---

## 3. Subir el proyecto a GitHub

```bash
cd clic-soluciones
git init
git add .
git commit -m "Primer commit: Clic Soluciones MVP"
```

1. Entrá a https://github.com/new y creá un repositorio nuevo (por ejemplo `clic-soluciones`). No lo inicialices con README (ya tenemos uno).
2. Copiá la URL del repo (algo como `https://github.com/TU_USUARIO/clic-soluciones.git`) y ejecutá:

```bash
git remote add origin https://github.com/TU_USUARIO/clic-soluciones.git
git branch -M main
git push -u origin main
```

Tu código ya está en GitHub. El archivo `.env.local` **no se sube** (está en `.gitignore`), así que tus claves quedan seguras.

---

## 4. Configurar Supabase (base de datos)

1. Entrá a https://supabase.com/dashboard y creá un **New Project** (elegí una contraseña de base de datos y guardala).
2. Cuando el proyecto esté listo, andá a **SQL Editor > New query**.
3. Abrí el archivo `supabase/schema.sql` de este proyecto, copiá todo su contenido, pegalo en el editor SQL de Supabase y presioná **Run**.
   - Esto crea las 4 tablas (`usuarios`, `productos`, `pedidos`, `items_pedido`), las políticas de seguridad (RLS) y carga 8 productos de ejemplo para que la tienda no arranque vacía.
4. Andá a **Project Settings > API**. Ahí vas a encontrar:
   - **Project URL** → esto va en `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → esto va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Pegá esos dos valores en tu archivo `.env.local`.

### Sobre las tablas

| Tabla | Uso |
|---|---|
| `usuarios` | Registro/login por teléfono (nombre, teléfono, localidad, código de verificación) |
| `productos` | Catálogo: nombre, precio, precio de oferta, imagen, categoría, destacado, activo, stock |
| `pedidos` | Cabecera del pedido: cliente, entrega, pago, nota, total, estado |
| `items_pedido` | Detalle de cada pedido (productos, cantidades, subtotales) |

### Nota de seguridad para producción

En este MVP las políticas de Row Level Security están abiertas (`using (true)`) para simplificar las pruebas iniciales con la clave `anon`. Antes de manejar pedidos reales con dinero de por medio, conviene restringir esas políticas (por ejemplo, permitir escritura en `productos` solo desde una API protegida con la `service_role key`, nunca expuesta en el frontend).

---

## 5. Variables de entorno (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY

# WhatsApp de contacto del negocio (código de país + número, sin +, sin espacios)
NEXT_PUBLIC_WHATSAPP_NUMBER=5492944000000

# Clave para entrar al panel admin (MVP simple, sin Supabase Auth)
NEXT_PUBLIC_ADMIN_PASSWORD=elegí-una-clave-segura
```

---

## 6. Conectar con Vercel (deploy)

1. Entrá a https://vercel.com/new e importá el repositorio de GitHub que acabás de crear (autorizá el acceso si te lo pide).
2. Vercel detecta automáticamente que es un proyecto Next.js.
3. Antes de darle a **Deploy**, abrí **Environment Variables** y cargá las mismas 4 variables del paso 5 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_ADMIN_PASSWORD`).
4. Hacé clic en **Deploy**. En 1-2 minutos vas a tener tu tienda online en una URL como `https://clic-soluciones.vercel.app`.
5. Cada vez que hagas `git push` a la rama `main`, Vercel vuelve a desplegar automáticamente.

---

## 7. Instalar la PWA en el celular

**Android (Chrome):**
1. Abrí la URL de tu tienda en Chrome.
2. Tocá el menú (⋮) → **Instalar app** (o **Agregar a pantalla de inicio**).
3. Confirmá. El ícono de Clic Soluciones va a aparecer como una app más en el celular.

**iPhone (Safari):**
1. Abrí la URL en Safari.
2. Tocá el botón de compartir (el cuadrado con la flecha hacia arriba).
3. Elegí **Agregar a pantalla de inicio**.
4. Confirmá el nombre y tocá **Agregar**.

La app funciona en pantalla completa (sin barra del navegador) y cachea los recursos básicos para cargar más rápido en visitas repetidas.

---

## 8. Cómo usar el panel de administración

1. Andá a `/admin` (por ejemplo `https://clic-soluciones.vercel.app/admin`).
2. Ingresá la clave que configuraste en `NEXT_PUBLIC_ADMIN_PASSWORD`.
3. Desde ahí podés:
   - Ver todos los productos cargados.
   - Crear un producto nuevo (`+ Nuevo`).
   - Editar o eliminar cualquier producto existente.
4. Los cambios se ven reflejados al instante en la tienda (catálogo y home).

---

## 9. Estructura del proyecto

```
clic-soluciones/
├── app/
│   ├── layout.js                  # Layout raíz (PWA, carrito, auth, nav inferior)
│   ├── page.js                    # Home: banner, categorías, destacados
│   ├── catalogo/page.js           # Listado de productos con filtros
│   ├── producto/[id]/page.js      # Detalle de producto
│   ├── carrito/page.js            # Carrito de compras
│   ├── checkout/page.js           # Entrega, pago y confirmación de pedido
│   ├── confirmacion/page.js       # Pantalla de "Pedido recibido"
│   ├── login/page.js              # Registro/login por teléfono (código mock)
│   └── admin/                     # Panel protegido: CRUD de productos
├── components/                    # Header, ProductCard, BottomNav, etc.
├── context/                       # CartContext, AuthContext, AdminContext
├── lib/                           # Cliente de Supabase, categorías, helpers de WhatsApp
├── public/                        # manifest.json, service worker, íconos
├── supabase/schema.sql            # Script SQL para crear las tablas en Supabase
└── .env.local.example             # Plantilla de variables de entorno
```

---

## 10. Próximos pasos sugeridos (no incluidos en este MVP)

- Reemplazar el envío de código "mock" por SMS real (Twilio o Supabase Phone Auth).
- Subida de imágenes de productos directamente desde el admin (Supabase Storage) en vez de pegar una URL.
- Notificaciones push para avisar cambios de estado del pedido.
- Panel admin con listado y cambio de estado de pedidos (hoy los pedidos quedan en la tabla `pedidos`, visibles desde el SQL Editor de Supabase).
- Políticas de RLS más estrictas para producción.
