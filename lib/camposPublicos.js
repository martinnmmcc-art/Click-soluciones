// Columnas de "Productos" que puede ver cualquier visitante.
//
// Lo que NO está acá (costo, márgenes, porcentajes, datos del proveedor,
// precio manual, texto original del proveedor...) es información interna
// del negocio: la base de datos se la niega al público, así que si una
// pantalla de la tienda pide "*" o una de esas columnas, la consulta falla.
// Por eso la tienda siempre pide esta lista y nunca "*".
export const CAMPOS_PUBLICOS = [
  "id",
  "nombre",
  "descripcion",
  "precio",
  "precio_oferta",
  "imagen_url",
  "imagen_url_2",
  "imagen_url_3",
  "imagen_url_4",
  "imagen_url_5",
  "imagen_url_6",
  "video_url",
  "categoria",
  "activo",
  "destacado",
  "created_at",
  "caracteristicas",
  "accesorios",
  "stock",
  "stock_minimo",
  "bajo_pedido",
  "fecha_ingreso",
  "actualizado_en",
  "campana_id",
  "codigo_barras",
  "esperando_foto",
  "retirado_por_proveedor",
  "nombre_busqueda",
  "orden_novedad",
  "sin_stock_proveedor",
  "sin_stock_proveedor_desde",
  "prioridad_lista",
  "descripcion_propia_en"
].join(", ");
