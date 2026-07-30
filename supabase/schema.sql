-- ============================================================
-- CLIC SOLUCIONES - Esquema de base de datos para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Extensión para generar UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TABLA: usuarios
-- ------------------------------------------------------------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null unique,
  localidad text,
  codigo_verificacion text,
  verificado boolean default false,
  created_at timestamp with time zone default now()
);

-- ------------------------------------------------------------
-- TABLA: productos
-- ------------------------------------------------------------
create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric(12,2) not null default 0,
  precio_oferta numeric(12,2),
  imagen_url text,
  categoria text not null default 'hogar',
  destacado boolean default false,
  activo boolean default true,
  stock integer default 0,
  created_at timestamp with time zone default now()
);

-- ------------------------------------------------------------
-- TABLA: pedidos
-- ------------------------------------------------------------
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido text not null unique,
  usuario_id uuid references usuarios(id),
  nombre_cliente text not null,
  telefono_cliente text not null,
  localidad text,
  metodo_entrega text not null check (metodo_entrega in ('retiro', 'envio')),
  direccion_envio text,
  metodo_pago text not null check (metodo_pago in ('transferencia', 'efectivo')),
  nota_cliente text,
  total numeric(12,2) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado')),
  created_at timestamp with time zone default now()
);

-- ------------------------------------------------------------
-- TABLA: items_pedido
-- ------------------------------------------------------------
create table if not exists items_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedidos(id) on delete cascade,
  producto_id uuid references productos(id),
  nombre_producto text not null,
  precio_unitario numeric(12,2) not null,
  cantidad integer not null default 1,
  subtotal numeric(12,2) not null
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- MVP: acceso abierto con clave anon para simplificar el demo.
-- Antes de producción real, restringir "with check" / "using"
-- a políticas más estrictas (por usuario autenticado, etc).
-- ------------------------------------------------------------
alter table usuarios enable row level security;
alter table productos enable row level security;
alter table pedidos enable row level security;
alter table items_pedido enable row level security;

drop policy if exists "usuarios_all" on usuarios;
create policy "usuarios_all" on usuarios for all using (true) with check (true);

drop policy if exists "productos_select" on productos;
create policy "productos_select" on productos for select using (true);

drop policy if exists "productos_write" on productos;
create policy "productos_write" on productos for all using (true) with check (true);

drop policy if exists "pedidos_all" on pedidos;
create policy "pedidos_all" on pedidos for all using (true) with check (true);

drop policy if exists "items_pedido_all" on items_pedido;
create policy "items_pedido_all" on items_pedido for all using (true) with check (true);

-- ------------------------------------------------------------
-- DATOS DE EJEMPLO (productos)
-- ------------------------------------------------------------
insert into productos (nombre, descripcion, precio, precio_oferta, imagen_url, categoria, destacado, stock)
values
('Lámpara colgante nórdica', 'Lámpara colgante de madera y metal, ideal para living o comedor. Luz cálida incluida.', 24999, 19999, 'https://images.unsplash.com/photo-1543198126-cc1a2b512b21?w=600', 'iluminacion', true, 12),
('Set de ollas antiadherentes x5', 'Juego de 5 ollas y sartenes antiadherentes, aptas para todo tipo de cocina.', 54999, null, 'https://images.unsplash.com/photo-1584990347449-a8f1a1e6a9e5?w=600', 'cocina', true, 8),
('Organizador modular apilable', 'Set de 3 cajas organizadoras apilables, ideales para placares y alacenas.', 8999, 6999, 'https://images.unsplash.com/photo-1600166898405-da9535204843?w=600', 'organizacion', true, 20),
('Velador táctil regulable', 'Velador con control táctil de intensidad, 3 tonos de luz.', 12999, null, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600', 'iluminacion', false, 15),
('Juego de utensilios de cocina x10', 'Set de utensilios de silicona con soporte, resistentes al calor.', 15999, 12999, 'https://images.unsplash.com/photo-1590794056486-cd8c19aa10bd?w=600', 'cocina', false, 10),
('Cesto multiuso de tela', 'Cesto plegable para ropa u organización, varios colores.', 6999, null, 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=600', 'organizacion', false, 25),
('Tira LED RGB 5 metros', 'Tira LED con control remoto, múltiples colores y efectos.', 11999, 8999, 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600', 'iluminacion', true, 18),
('Cafetera eléctrica 12 tazas', 'Cafetera de filtro con jarra de vidrio y placa de mantenimiento de calor.', 34999, null, 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600', 'cocina', false, 6)
on conflict do nothing;
