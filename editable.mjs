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

// Un HTML cualquiera -> su SVG.
//
// Es lo que usa el servicio: n8n manda el HTML ya armado y no sabe nada del
// catálogo de tipos.
export async function svgDesdeHtml(html, ancho, alto) {
  return conPagina(html, ancho, alto, async pagina => {
    // La función viaja a la página y se ejecuta allá, donde está el dibujo.
    const svg = await pagina.evaluate(aSvg, ancho, alto);
    return Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' + svg, 'utf8');
  });
}
