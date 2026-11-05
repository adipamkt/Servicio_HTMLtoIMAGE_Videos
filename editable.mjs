// El convertidor a SVG: una página dibujada -> su versión editable.
//
// Corre dentro de la página, cuando ya está armada y con la tipografía
// cargada: recorre lo que hay y lo vuelve a emitir como SVG. No es una
// captura: los bloques salen como rectángulos y el texto como texto.
//
// Está separado del catálogo a propósito: el servicio que llama n8n solo
// necesita esto, y cargar el catálogo le haría leer el export entero del
// workflow en cada arranque.
//
import { conPagina } from './navegador.mjs';
import { aSvg } from './convertidor-svg.mjs';

// Un SVG tiene que valerse por sí mismo: quien lo abre en Illustrator puede
// no tener internet, y Illustrator no sale a buscar imágenes de todos modos.
// Las fotos que la plantilla puso como enlace se bajan y se guardan adentro.
//
// Casi todas ya vienen en base64 desde el flujo, así que lo normal es que esto
// no tenga nada que hacer.
async function incrustarImagenes(svg) {
  const enlaces = [...new Set(
    [...svg.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]))];
  if (!enlaces.length) return svg;

  const bajadas = await Promise.all(enlaces.map(async url => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return null;
      const tipo = r.headers.get('content-type') || 'image/png';
      const bytes = Buffer.from(await r.arrayBuffer());
      return `data:${tipo.split(';')[0]};base64,${bytes.toString('base64')}`;
    } catch {
      // Si no se puede bajar, se deja el enlace: mejor un SVG con una imagen
      // que falta que ningún SVG.
      return null;
    }
  }));

  let salida = svg;
  enlaces.forEach((url, i) => {
    if (!bajadas[i]) return;
    salida = salida.split(`href="${url}"`).join(`href="${bajadas[i]}"`);
  });
  return salida;
}

// Un HTML cualquiera -> su SVG.
//
// Es lo que usa el servicio: n8n manda el HTML ya armado y no sabe nada del
// catálogo de tipos.
export async function svgDesdeHtml(html, ancho, alto) {
  const svg = await conPagina(html, ancho, alto, async pagina => {
    // La función viaja a la página y se ejecuta allá, donde está el dibujo.
    return pagina.evaluate(aSvg, ancho, alto);
  });
  const completo = await incrustarImagenes(svg);
  return Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' + completo, 'utf8');
}
