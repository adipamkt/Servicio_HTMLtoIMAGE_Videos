// Colores oficiales de ADIPA y la corrección de la plantilla.
//
// La plantilla del workflow trae colores aproximados, no los del manual. Acá
// están los hex oficiales en un solo lugar, y `corregir()` los aplica sobre
// cualquier plantilla antes de renderizar. Así las piezas salen con la marca
// correcta aunque el nodo de n8n todavía no esté actualizado.
//
//   node marca.mjs    → informe de qué cambia y con cuánto contraste
//
import { plantillas } from './datos.mjs';

// Manual de marca. No aproximar: estos son los valores exactos.
export const ADIPA = {
  primary: '#704EFD',        // morado de identidad
  secondary: '#2CB7FF',      // cian de acento
  surfaceSoft: '#F3F4FF',    // gris de marca
  textStrong: '#091E42',     // navy de texto
  blueSoft: '#CBE8FF',
  lavender: '#DFD5FF',
  activoAmarillo: '#FFC728', // color activo, solo para énfasis y con moderación
  blanco: '#FFFFFF',
};

// De lo que hay en la plantilla a lo que corresponde.
//
// Dos notas sobre decisiones que no son obvias:
//
// 1. El fondo y las manchas eran dos grises distintos (#FAFAFF y #EDEFFF) para
//    que las manchas se vieran. Oficial hay un solo gris de marca, así que el
//    fondo pasa a blanco y las manchas al gris. Se mantiene la misma relación.
//
// 2. El amarillo no tiene equivalente en la paleta base; #FFC728 es un color
//    activo. Se usa solo en la píldora "Gratuito" y en el botón, que es
//    exactamente el "énfasis con moderación" que permite el manual.
//
// 3. El turquesa de "Participación" NO va al cian secundario #2CB7FF: sobre el
//    morado da 2.22 de contraste y deja de ser legible. El cian es para fondos
//    claros. Sobre morado corresponde el azul claro #CBE8FF, que da 3.94 —
//    el mismo nivel que tenía el turquesa aproximado (3.86).
export const MAPA = {
  '#6F4EFC': ADIPA.primary,
  '#93F1F1': ADIPA.blueSoft,
  '#0A1C42': ADIPA.textStrong,
  '#EDEFFF': ADIPA.surfaceSoft,
  '#FAFAFF': ADIPA.blanco,
  '#DED4FE': ADIPA.lavender,
  '#FCC460': ADIPA.activoAmarillo,
};

export const corregir = html =>
  Object.entries(MAPA).reduce(
    (acc, [viejo, nuevo]) => acc.replace(new RegExp(viejo, 'gi'), nuevo),
    html);

// --- Contraste WCAG, para no romper la legibilidad al cambiar un color -------
const canal = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luz = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};
export const contraste = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

if (process.argv[1]?.endsWith('marca.mjs')) {
  const html = plantillas['1080X1920-RRSS'].html;
  const cuenta = h => (h.match(/#[0-9a-f]{6}/gi) || []).length;

  console.log('COLOR        OFICIAL      VECES  ROL');
  for (const [viejo, nuevo] of Object.entries(MAPA)) {
    const n = (html.match(new RegExp(viejo, 'gi')) || []).length;
    console.log(`${viejo}  ->  ${nuevo}   ${String(n).padStart(2)}`);
  }

  // Los dos pares de texto sobre color que pueden volverse ilegibles.
  const pares = [
    ['Botón: morado sobre amarillo', ADIPA.primary, ADIPA.activoAmarillo, '#704EFD', '#FCC460'],
    ['Certificado: azul sobre morado', ADIPA.blueSoft, ADIPA.primary, '#93F1F1', '#6F4EFC'],
  ];
  console.log('\nCONTRASTE                        ANTES   AHORA   (AA texto grande: 3.0)');
  for (const [que, f1, b1, f0, b0] of pares) {
    console.log(`${que.padEnd(32)} ${contraste(f0, b0).toFixed(2)}    ${contraste(f1, b1).toFixed(2)}`);
  }
  console.log(`\nTotal de colores en la plantilla: ${cuenta(html)}`);
}
