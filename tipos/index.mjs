// El catálogo de tipos de pieza.
//
// Cada archivo .mjs de esta carpeta es un tipo y se suma solo: no hay que
// anotarlo en ningún lado. Los que empiezan con "_" son código compartido, no
// tipos, y se saltean. Para agregar un tipo nuevo (un curso, un diplomado, un
// formato de video) se copia uno de los que hay y se cambia el contenido.
//
// Un tipo exporta por defecto:
//
//   nombre       cómo se lo pide por API            'seminario'
//   etiqueta     el nombre corto que se ve           'Seminario'
//   descripcion  una línea de detalle, para GET /tipos
//   pais         cómo entra el país: 'lista', 'uno' o 'documento'
//   versiones    qué diseños tiene: [1] o [1, 2]
//   campos       qué datos espera, en orden
//   campos_v2    los datos que pide de más el diseño 2
//   ejemplo      datos de muestra; rellenan lo que no venga en el pedido
//   piezas(d)    función que devuelve [{ nombre, html, w, h }]
//
// Un archivo puede declarar más de un tipo si exporta una lista: así están los
// cursos, que comparten casi todo pero son dos productos distintos.
//
import fs from 'node:fs';

const aqui = new URL('./', import.meta.url);

export const catalogo = {};

for (const archivo of fs.readdirSync(aqui).filter(f => f.endsWith('.mjs') && f !== 'index.mjs' && !f.startsWith('_'))) {
  const exportado = (await import(new URL(archivo, aqui))).default;
  for (const tipo of [exportado].flat()) catalogo[tipo.nombre] = tipo;
}

// Los valores del ejemplo que se pueden mostrar en un formulario. Las imágenes
// quedan afuera: son base64 de cientos de kilobytes y no se escriben a mano.
const mostrable = v => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return /^(data:|https?:)/.test(v) ? null : v;
  if (Array.isArray(v)) {
    const lista = v
      .map(x => (x && typeof x === 'object' ? [x.nombre, x.pais].filter(Boolean).join(', ') : x))
      .filter(x => typeof x === 'string' && !/^(data:|https?:)/.test(x));
    return lista.length ? lista : null;
  }
  return null;
};

// La versión para mostrar: sin el HTML ni las funciones. Se calcula una vez,
// porque el catálogo no cambia mientras el servidor está levantado.
const listado = Object.values(catalogo).map(t => {
  const versiones = t.versiones || [1];
  const campos_v2 = t.campos_v2 || [];
  return {
    nombre: t.nombre,
    etiqueta: t.etiqueta || t.nombre,
    descripcion: t.descripcion,
    pais: t.pais,
    versiones,
    campos: t.campos,
    campos_v2,
    valores: Object.fromEntries([...t.campos, ...campos_v2]
      .map(c => [c, mostrable(t.ejemplo[c])]).filter(([, v]) => v !== null && v !== undefined)),
    // Qué piezas da cada diseño, con los datos de ejemplo.
    piezas: Object.fromEntries(versiones.map(v =>
      [v, t.piezas({ ...t.ejemplo, version: v }).map(p => ({ nombre: p.nombre, ancho: p.w, alto: p.h }))])),
  };
});

export const listar = () => listado;
