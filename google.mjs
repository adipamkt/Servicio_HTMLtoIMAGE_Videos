// Entrar a Google con una cuenta de servicio.
//
// Una cuenta de servicio es un usuario que no es una persona: se le comparten
// las carpetas de Drive y el Documento Maestro como se le compartiría a un
// compañero, y entra sola sin que nadie tenga que apretar "Permitir".
//
// Se baja un JSON de la consola de Google Cloud y se apunta a él desde .env:
//
//   GOOGLE_CUENTA_SERVICIO=C:/ruta/a/la-cuenta.json
//
// El token se pide firmando un JWT con la clave privada de ese archivo. Son
// cuarenta líneas con el `crypto` que ya trae Node, así que no se agrega
// ninguna dependencia por esto.
//
import fs from 'node:fs';
import crypto from 'node:crypto';
import { credencial } from './entorno.mjs';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Lo mínimo para leer el Documento Maestro y mover archivos en Drive.
export const PERMISOS = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive',
].join(' ');

const base64url = buf => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function cuenta() {
  const ruta = credencial('GOOGLE_CUENTA_SERVICIO',
    'es la ruta al archivo JSON de la cuenta de servicio de Google Cloud.');
  if (!fs.existsSync(ruta)) throw new Error(`No existe el archivo de la cuenta de servicio: ${ruta}`);
  const j = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  if (!j.client_email || !j.private_key) {
    throw new Error('Ese JSON no parece una cuenta de servicio: le faltan client_email o private_key.');
  }
  return j;
}

// El token dura una hora; se guarda hasta un minuto antes de vencer para no
// pedir uno nuevo en cada llamada.
let guardado = { token: null, vence: 0 };

export async function token() {
  if (guardado.token && Date.now() < guardado.vence) return guardado.token;

  const { client_email, private_key } = cuenta();
  const ahora = Math.floor(Date.now() / 1000);

  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = base64url(JSON.stringify({
    iss: client_email,
    scope: PERMISOS,
    aud: TOKEN_URL,
    iat: ahora,
    exp: ahora + 3600,
  }));

  const firma = base64url(
    crypto.createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(private_key));

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecera}.${cuerpo}.${firma}`,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google no dio el token: ${json.error_description || json.error || res.status}`);
  }

  guardado = { token: json.access_token, vence: Date.now() + (json.expires_in - 60) * 1000 };
  return guardado.token;
}

// Un pedido a cualquier API de Google, ya autenticado.
//
// `crudo` devuelve la respuesta sin tocar, para bajar archivos.
export async function pedir(url, { metodo = 'GET', cuerpo = null, cabeceras = {}, crudo = false } = {}) {
  const res = await fetch(url, {
    method: metodo,
    headers: { authorization: `Bearer ${await token()}`, ...cabeceras },
    ...(cuerpo ? { body: cuerpo } : {}),
  });

  if (crudo) {
    if (!res.ok) throw new Error(`Google ${res.status} en ${url}: ${(await res.text()).slice(0, 200)}`);
    return res;
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const m = json?.error?.message || `HTTP ${res.status}`;
    // El error más probable al empezar, y el que no se adivina solo.
    const pista = res.status === 404 || res.status === 403
      ? ' — ¿le compartiste el archivo o la carpeta a la cuenta de servicio?' : '';
    throw new Error(`Google: ${m}${pista}`);
  }
  return json;
}

// El correo de la cuenta de servicio: es el que hay que invitar a las carpetas.
export const correoCuenta = () => cuenta().client_email;
