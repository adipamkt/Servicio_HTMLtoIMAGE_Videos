// Las plantillas del export de n8n y los datos de ejemplo del seminario.
//
// El diseño no se copia: se lee del propio JSON del workflow, así las piezas y
// el video siempre usan el mismo afiche. Para actualizarlo, exportar de nuevo
// desde n8n y pisar `origen/workflow-a-piezas.json`.
//
// Cada tipo de programa es un nodo distinto del workflow y trae sus propias
// plantillas y sus propios recursos incrustados (logos, íconos, banderas), así
// que `leerNodo()` recibe el nombre del nodo y devuelve los dos.

import fs from 'node:fs';
import zlib from 'node:zlib';

const WORKFLOW = new URL('./origen/workflow-a-piezas.json', import.meta.url);
const NODOS = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8')).nodes;

// ---------------------------------------------------------------------------
// Leer un nodo "Armar HTML …" del export.
//
// El nodo es código: adentro tiene `const R = {…}` con los recursos en base64 y
// `const PLANTILLAS = {…}` con el HTML de cada formato. Los dos son JSON, así
// que se recortan por sus bordes y se parsean.
// ---------------------------------------------------------------------------
// Entre el final de una constante y el comienzo de la siguiente puede haber
// comentarios: se descartan antes de parsear, junto con el punto y coma.
const limpiar = texto => {
  const lineas = texto.trimEnd().split('\n');
  while (lineas.length && lineas[lineas.length - 1].trimStart().startsWith('//')) lineas.pop();
  return lineas.join('\n').trim().replace(/;$/, '');
};

const codigoDe = nombre => {
  const nodo = NODOS.find(n => n.name === nombre);
  if (!nodo) throw new Error(`El export no tiene el nodo "${nombre}".`);
  return nodo.parameters.jsCode;
};

// Una constante suelta de un nodo, por nombre. Termina donde empieza la
// siguiente declaración de nivel superior.
export function leerConstante(nombreNodo, nombreConstante) {
  const codigo = codigoDe(nombreNodo);
  const desde = `const ${nombreConstante} = `;
  const i = codigo.indexOf(desde);
  if (i < 0) throw new Error(`El nodo "${nombreNodo}" no tiene "${nombreConstante}".`);
  const j = codigo.indexOf('\nconst ', i + desde.length);
  return JSON.parse(limpiar(codigo.slice(i + desde.length, j < 0 ? undefined : j)));
}

const cache = new Map();

export function leerNodo(nombre) {
  if (cache.has(nombre)) return cache.get(nombre);

  const leido = {
    R: leerConstante(nombre, 'R'),
    plantillas: leerConstante(nombre, 'PLANTILLAS'),
  };
  cache.set(nombre, leido);
  return leido;
}

// ---------------------------------------------------------------------------
// PNG mínimo en RGBA: fotos de docentes, fondos y doodles de ejemplo, sin
// dependencias. Son los marcadores que ocupan el lugar de lo que todavía baja
// de Drive.
// ---------------------------------------------------------------------------
const crcTabla = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const trozo = (tipo, datos) => {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const suma = Buffer.alloc(4); suma.writeUInt32BE(crc(cuerpo));
  return Buffer.concat([largo, cuerpo, suma]);
};
const png = (w, h, pintar) => {
  const filas = [];
  for (let y = 0; y < h; y++) {
    const fila = Buffer.alloc(1 + w * 4);
    for (let x = 0; x < w; x++) fila.set(pintar(x, y), 1 + x * 4);
    filas.push(fila);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(Buffer.concat(filas))),
    trozo('IEND', Buffer.alloc(0)),
  ]);
};
const uri = buf => 'data:image/png;base64,' + buf.toString('base64');

// Un círculo de color: foto de docente de ejemplo.
export const circulo = (r, g, b) => uri(png(300, 300, (x, y) => {
  const dx = x - 150, dy = y - 150;
  return dx * dx + dy * dy <= 150 * 150 ? [r, g, b, 255] : [0, 0, 0, 0];
}));

// Un rectángulo con un degradado suave: fondo de ejemplo, para ver que la
// plantilla lo coloca y lo recorta donde corresponde.
export const fondo = (w, h, [r1, g1, b1], [r2, g2, b2]) => uri(png(w, h, (x, y) => {
  const t = (x / w + y / h) / 2;
  return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t, 255].map(Math.round);
}));

// Márgenes transparentes a propósito: así se ejercita el recorte por alfa.
export const blob = uri(png(600, 400, (x, y) => {
  const dx = (x - 300) / 230, dy = (y - 200) / 150;
  return dx * dx + dy * dy <= 1 ? [0x2c, 0xb7, 0xff, 255] : [0, 0, 0, 0];
}));

// ---------------------------------------------------------------------------
// El seminario, que es el tipo que ya está andando de punta a punta.
// ---------------------------------------------------------------------------
const seminario = leerNodo('Armar HTML piezas');

export const R = seminario.R;
export const plantillas = seminario.plantillas;
export const plantilla = plantillas['1080X1920-RRSS'];

export const datos = {
  nombre_programa: 'Intervención en crisis: herramientas para el abordaje inicial del riesgo suicida',
  fecha: '2026-11-20',
  horario: '19:00',
  pais_doc: 'CL',
  paises: ['chile'],
  docentes: [
    { nombre: 'Valentina Rojas Mena', foto: circulo(0xde, 0xd4, 0xfe) },
    { nombre: 'Matías Fuenzalida Soto', foto: circulo(0xcb, 0xe8, 0xff) },
  ],
  doodle: blob,
  bandera: R.bandera_cl,
  logo: R.logo_adipa,
  icono_certificado: R.icono_certificado,
};
