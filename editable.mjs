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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conPagina } from './navegador.mjs';

// fileURLToPath y no la ruta cruda de la URL: esta carpeta tiene espacios y
// acentos, que en una URL vienen escritos como %20 y %C3%B1.
const aqui = p => path.join(path.dirname(fileURLToPath(import.meta.url)), p);

const CONVERTIDOR = aqui('composicion/a-svg.js');

// Un HTML cualquiera -> su SVG.
//
// Es lo que usa el servicio: n8n manda el HTML ya armado y no sabe nada del
// catálogo de tipos.
export async function svgDesdeHtml(html, ancho, alto) {
  return conPagina(html, ancho, alto, async pagina => {
    await pagina.addScriptTag({ content: fs.readFileSync(CONVERTIDOR, 'utf8') });
    const svg = await pagina.evaluate(
      (w, h) => window.aSvg(document.body, w, h), ancho, alto);
    return Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n' + svg, 'utf8');
  });
}
