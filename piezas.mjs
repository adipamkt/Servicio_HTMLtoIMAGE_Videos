// Renderizar las piezas del catálogo.
//
// El motor que captura está en `render.mjs` y no sabe nada de tipos ni de
// plantillas: recibe HTML y devuelve imagen. Esto es la capa de arriba, la que
// sí conoce el catálogo.
//
// Están separados a propósito: el servicio que llama n8n solo necesita el
// motor, y cargar el catálogo le haría leer el export entero del workflow en
// cada arranque.
//
import { capturar } from './render.mjs';
import { svgDesdeHtml } from './editable.mjs';
import { catalogo } from './tipos/index.mjs';

// Un tipo del catálogo + los datos del programa -> todas sus piezas.
//
// `datos` puede venir incompleto: lo que falte se completa con el ejemplo del
// tipo. Así se puede pedir una pieza mandando solo el nombre y la fecha, sin
// tener que repetir el logo y las banderas en cada llamada.
//
// `soloPiezas` es opcional: una lista de nombres para generar menos de cinco.
export async function renderizar(nombreTipo, datos = {}, soloPiezas = null) {
  const tipo = catalogo[nombreTipo];
  if (!tipo) {
    throw Object.assign(
      new Error(`No existe el tipo "${nombreTipo}". Disponibles: ${Object.keys(catalogo).join(', ')}`),
      { codigo: 400 });
  }

  let piezas = tipo.piezas({ ...tipo.ejemplo, ...datos });

  if (soloPiezas?.length) {
    const pedidas = new Set(soloPiezas);
    const desconocidas = soloPiezas.filter(n => !piezas.some(p => p.nombre === n));
    if (desconocidas.length) {
      throw Object.assign(
        new Error(`El tipo "${nombreTipo}" no tiene la pieza ${desconocidas.join(', ')}. Tiene: ${piezas.map(p => p.nombre).join(', ')}`),
        { codigo: 400 });
    }
    piezas = piezas.filter(p => pedidas.has(p.nombre));
  }

  return Promise.all(piezas.map(async p => {
    const t = Date.now();
    const archivos = await capturar(p.html, p.w, p.h, p.formatos || ['png']);
    return { nombre: p.nombre, ancho: p.w, alto: p.h, archivos, ms: Date.now() - t, aviso: p.aviso };
  }));
}

// Un tipo del catálogo -> el SVG de una de sus piezas.
export async function renderizarSvg(nombreTipo, { datos = {}, pieza = null } = {}) {
  const tipo = catalogo[nombreTipo];
  if (!tipo) {
    throw Object.assign(
      new Error(`No existe el tipo "${nombreTipo}". Disponibles: ${Object.keys(catalogo).join(', ')}`),
      { codigo: 400 });
  }

  const piezas = tipo.piezas({ ...tipo.ejemplo, ...datos });
  const elegida = pieza
    ? piezas.find(p => p.nombre === pieza)
    : piezas.find(p => /^1080X1920/.test(p.nombre)) || piezas[0];

  if (!elegida) {
    throw Object.assign(
      new Error(`El tipo "${nombreTipo}" no tiene la pieza "${pieza}". Tiene: ${piezas.map(p => p.nombre).join(', ')}`),
      { codigo: 400 });
  }

  const t = Date.now();
  return {
    pieza: elegida.nombre,
    ancho: elegida.w,
    alto: elegida.h,
    svg: await svgDesdeHtml(elegida.html, elegida.w, elegida.h),
    ms: Date.now() - t,
  };
}
