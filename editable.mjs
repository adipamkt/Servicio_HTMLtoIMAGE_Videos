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
import sharp from 'sharp';
import { conPagina } from './navegador.mjs';
import { aSvg } from './convertidor-svg.mjs';

// Una imagen que a su vez es un SVG no se puede dejar incrustada: Illustrator
// no abre un SVG metido adentro de otro, y la foto desaparece. Se pasa a PNG
// al doble de la medida con la que se ve, para que aguante un acercamiento.
//
// Hoy las plantillas mandan todo en PNG, así que esto casi nunca actúa. Está
// por si mañana alguien incrusta un logo vectorial.
async function aplanarSvgIncrustados(svg) {
  const encontrados = [...svg.matchAll(
    /<image[^>]*?width="([\d.]+)"[^>]*?height="([\d.]+)"[^>]*?xlink:href="(data:image\/svg\+xml[^"]*)"/g)];
  if (!encontrados.length) return svg;

  let salida = svg;
  for (const [, ancho, alto, uri] of encontrados) {
    try {
      const coma = uri.indexOf(',');
      const datos = uri.slice(coma + 1);
      const bytes = /;base64/.test(uri.slice(0, coma))
        ? Buffer.from(datos, 'base64')
        : Buffer.from(decodeURIComponent(datos), 'utf8');
      const png = await sharp(bytes, { density: 192 })
        .resize({ width: Math.max(1, Math.round(Number(ancho) * 2)), fit: 'inside' })
        .png().toBuffer();
      salida = salida.split(uri).join(`data:image/png;base64,${png.toString('base64')}`);
    } catch {
      // Si no se puede convertir, se deja como está: mejor eso que nada.
    }
  }
  return salida;
}

// Un SVG tiene que valerse por sí mismo: quien lo abre en Illustrator puede
// no tener internet, y Illustrator no sale a buscar imágenes de todos modos.
// Las fotos que la plantilla puso como enlace se bajan y se guardan adentro.
//
// Casi todas ya vienen en base64 desde el flujo, así que lo normal es que esto
// no tenga nada que hacer.
async function incrustarImagenes(svg) {
  const enlaces = [...new Set(
    [...svg.matchAll(/xlink:href="(https?:\/\/[^"]+)"/g)].map(m => m[1]))];
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
    salida = salida.split(`xlink:href="${url}"`).join(`xlink:href="${bajadas[i]}"`);
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
  const completo = await aplanarSvgIncrustados(await incrustarImagenes(svg));
  return Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' + completo, 'utf8');
}
