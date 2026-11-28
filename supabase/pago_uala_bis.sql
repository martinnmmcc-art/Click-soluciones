-- Pago con tarjeta por Ualá Bis
-- Correr UNA vez en Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede correr de nuevo sin romper nada.

-- 1) Dónde guardamos la orden de Ualá de cada pedido
alter table pedidos add column if not exists pago_uala_uuid text;
alter table pedidos add column if not exists pago_uala_monto numeric(12,2);
create index if not exists pedidos_pago_uala_uuid_idx on pedidos (pago_uala_uuid);

-- 2) Que el pedido acepte "uala_bis" como forma de pago.
--    (El control viejo solo dejaba 'transferencia' y 'efectivo'. Si ya lo
--    habías sacado para Naranja X o Mercado Pago, esto no hace nada.)
alter table pedidos drop constraint if exists pedidos_metodo_pago_check;

-- 3) La opción en el checkout. Queda APAGADA: la prendés desde
--    /admin → Formas de pago cuando cargues las claves en Vercel.
insert into metodos_pago (clave, nombre, descripcion, icono, activo, orden)
select 'uala_bis', 'Tarjeta de débito o crédito', 'Pagás ahora, seguro con Ualá Bis. También en cuotas.', '💳', false, 2
where not exists (select 1 from metodos_pago where clave = 'uala_bis');
