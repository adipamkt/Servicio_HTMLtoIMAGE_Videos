// Dónde quedan las piezas entre que se generan y que n8n las baja.
//
// Esto existe porque el servicio devuelve una dirección y recién después la
// visitan. En la máquina alcanza con el disco. En Vercel no: cada llamada
// puede caer en una copia distinta de la función y el disco se borra, así que
// un archivo escrito en una llamada no está en la siguiente. Ahí se usa Vercel
// Blob, que es almacenamiento de verdad.
//
// Las dos formas se ven igual desde afuera, así que el resto del código no
// sabe dónde está corriendo.
//
import fs from 'node:fs';
import path from 'node:path';

const EN_VERCEL = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const CARPETA = path.resolve('salida/render');

// En Vercel se guarda con el nombre exacto, sin sufijo al azar, para poder
// volver a encontrarlo sabiendo el id.
const opcionesBlob = { access: 'public', addRandomSuffix: false, allowOverwrite: true };

const MIMES = {
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  html: 'text/html; charset=utf-8',
  json: 'application/json',
};

export const mimeDe = nombre => MIMES[nombre.split('.').pop().toLowerCase()] || 'application/octet-stream';

export async function guardar(id, nombre, bytes) {
  if (EN_VERCEL) {
    const { put } = await import('@vercel/blob');
    const r = await put(`piezas/${id}/${nombre}`, bytes, { ...opcionesBlob, contentType: mimeDe(nombre) });
    return r.url;
  }
  const carpeta = path.join(CARPETA, id);
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, nombre), bytes);
  return null;
}

// Devuelve los bytes, o null si no está. En Vercel se baja del blob: cuesta
// una llamada, pero solo pasa cuando hay que armar un formato nuevo.
export async function leer(id, nombre) {
  if (EN_VERCEL) {
    const url = await direccion(id, nombre);
    if (!url) return null;
    const r = await fetch(url);
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  }
  const archivo = path.join(CARPETA, id, nombre);
  return fs.existsSync(archivo) ? fs.readFileSync(archivo) : null;
}

// La dirección pública del archivo, cuando la hay. En la máquina no existe:
// los archivos los sirve el propio servidor.
export async function direccion(id, nombre) {
  if (!EN_VERCEL) return null;
  const { head } = await import('@vercel/blob');
  try {
    return (await head(`piezas/${id}/${nombre}`)).url;
  } catch {
    return null;
  }
}

export async function existe(id, nombre) {
  if (EN_VERCEL) return !!(await direccion(id, nombre));
  return fs.existsSync(path.join(CARPETA, id, nombre));
}

export const enVercel = EN_VERCEL;
