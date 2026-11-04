// HeyGen: la locución y los avatares.
//
//   node heygen.mjs voces              las voces en español
//   node heygen.mjs looks              los avatares disponibles
//   node heygen.mjs avatar <nombre> <foto.jpg>   crea un avatar de foto
//   node heygen.mjs locucion "texto" <voice_id>  genera el audio
//
// Se usa la API v3. Los endpoints v2 todavía responden pero su fecha de
// retiro era el 31 de octubre de 2026: están vencidos, y casi todos los
// tutoriales que hay dando vueltas los usan.
//
// El saldo de la API se carga aparte de los planes web (Creator, Pro, Team):
// los créditos de esos planes no alimentan la API. Sin saldo, todo lo que
// genere devuelve "insufficient_credit"; lo que solo lee funciona igual.
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.heygen.com';

// fileURLToPath y no la ruta cruda de la URL: esta carpeta tiene espacios y
// acentos, que en una URL vienen escritos como %20 y %C3%B1.
const aqui = p => path.join(path.dirname(fileURLToPath(import.meta.url)), p);

// El .env se lee a mano: una dependencia menos para una cosa de seis líneas.
function clave() {
  const archivo = aqui('../.env');
  if (!fs.existsSync(archivo)) {
    throw new Error('Falta el archivo .env. Copiá .env.ejemplo y completá HEYGEN_API_KEY.');
  }
  const linea = fs.readFileSync(archivo, 'utf8')
    .split('\n').find(l => l.startsWith('HEYGEN_API_KEY='));
  const k = linea && linea.slice('HEYGEN_API_KEY='.length).trim();
  if (!k) throw new Error('Falta HEYGEN_API_KEY en .env.');
  return k;
}

// Un pedido a la API, con los dos errores que más van a pasar explicados.
async function pedir(metodo, ruta, cuerpo, crudo = false) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: { 'x-api-key': clave(), ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });

  const texto = await res.text();
  let json;
  try { json = JSON.parse(texto); } catch { json = null; }

  if (!res.ok) {
    const e = json?.error || {};
    if (e.code === 'insufficient_credit' || /insufficient credit/i.test(e.message || '')) {
      throw Object.assign(
        new Error('HeyGen no tiene saldo de API. Se carga en el panel de desarrolladores '
          + '(Billing → Add funds), desde US$ 5. Ojo: los créditos de los planes web no sirven acá.'),
        { codigo: 402 });
    }
    throw Object.assign(
      new Error(`HeyGen ${res.status} en ${metodo} ${ruta}: ${e.message || texto.slice(0, 200)}`),
      { codigo: res.status });
  }

  // El aviso de endpoint vencido viene en el cuerpo, no en una cabecera.
  if (json?.warning?.sunset_date) {
    console.warn(`  aviso: ${ruta} está vencido desde ${json.warning.sunset_date}`);
  }
  // `crudo` devuelve la respuesta entera: las listas paginadas traen
  // has_more y next_token al lado de data.
  return crudo ? json : (json?.data ?? json);
}

// --- Leer (funciona sin saldo) ----------------------------------------------

// El catálogo viene paginado y filtra por idioma del lado del servidor: pedirlo
// entero y filtrar acá traía las primeras 100 voces, todas en inglés.
export async function voces(idioma = 'Spanish', tope = 200) {
  const juntas = [];
  let token = null;
  do {
    const q = new URLSearchParams({ limit: '100', ...(idioma ? { language: idioma } : {}), ...(token ? { token } : {}) });
    const r = await pedir('GET', `/v3/voices?${q}`, null, true);
    juntas.push(...(r.data || []));
    token = r.has_more ? r.next_token : null;
  } while (token && juntas.length < tope);
  return juntas;
}

// Los "looks" son las poses de un avatar. El id de un look es lo que se pasa
// como `avatar_id` al armar el video; el del grupo no sirve para eso.
//
// Devuelve también los del catálogo público. Los propios son los que comparten
// el group_id del avatar de la cuenta.
export const looks = async (grupo = null) => {
  const d = await pedir('GET', '/v3/avatars/looks' + (grupo ? `?group_id=${grupo}` : ''));
  return Array.isArray(d) ? d : d.looks || [];
};

// --- Avatar de foto ----------------------------------------------------------

// Sube una imagen y devuelve su asset_id. Va por multipart; el endpoint que
// recibe JSON es el viejo.
export async function subirImagen(ruta) {
  const datos = new FormData();
  const tipo = ruta.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  datos.append('file', new Blob([fs.readFileSync(ruta)], { type: tipo }), path.basename(ruta));

  const res = await fetch(API + '/v3/assets', {
    method: 'POST',
    headers: { 'x-api-key': clave() },
    body: datos,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`No se pudo subir la imagen: ${json?.error?.message || res.status}`);
  return json.data;
}

// Crea el avatar a partir de una foto. El entrenamiento es asincrónico: se
// consulta después con `estadoAvatar`.
//
// `file` acepta tres formas —`url`, `asset_id` o `base64`— y el tipo va
// adentro del objeto, no afuera.
export async function crearAvatarFoto(nombre, { archivo = null, url = null } = {}) {
  let file;
  if (url) {
    file = { type: 'url', url };
  } else if (archivo) {
    const subida = await subirImagen(archivo);
    file = { type: 'url', url: subida.url };
  } else {
    throw new Error('Hace falta una foto: pasá `archivo` (ruta local) o `url`.');
  }
  return pedir('POST', '/v3/avatars', { name: nombre, type: 'photo', file });
}

export const estadoAvatar = grupo => pedir('GET', `/v3/avatar-groups/${grupo}`);

// --- Locución ----------------------------------------------------------------

// El audio con las marcas de tiempo de cada carácter. Esos tiempos son los que
// después mueven la animación, para que cada elemento del afiche entre justo
// cuando la voz lo nombra.
export const locutar = (texto, voiceId) =>
  pedir('POST', '/v3/models/audio/tts', { text: texto, voice_id: voiceId, with_timestamps: true });

// --- Video con avatar ---------------------------------------------------------

// El audio puede venir de tres formas y la tercera es la que une los dos
// videos: se genera la locución una sola vez, se usa para sincronizar la
// gráfica animada, y el mismo archivo se le pasa al avatar. La voz queda
// idéntica en los dos y se paga una sola locución.
export const videoAvatar = ({ avatarId, audioUrl = null, texto = null, voiceId = null, resolucion = '1080p' }) =>
  pedir('POST', '/v3/videos', {
    type: 'avatar',
    avatar_id: avatarId,
    aspect_ratio: 'auto',
    resolution: resolucion,
    ...(audioUrl ? { audio_url: audioUrl } : { script: texto, voice_id: voiceId }),
  });

export const estadoVideo = id => pedir('GET', `/v3/videos/${id}`);

// --- Línea de comandos --------------------------------------------------------

if (process.argv[1]?.endsWith('heygen.mjs')) {
  const [orden, ...resto] = process.argv.slice(2);
  try {
    if (orden === 'voces') {
      const v = await voces();
      console.log(`${v.length} voces en español`);
      v.slice(0, 15).forEach(x => console.log(`  ${x.voice_id}  ${x.gender.padEnd(6)}  ${x.name}`));
    } else if (orden === 'looks') {
      const l = await looks(resto[0] || null);
      const grupos = [...new Set(l.map(x => x.group_id))];
      console.log(`${l.length} looks en ${grupos.length} grupos`);
      for (const g of grupos) {
        console.log(`
grupo ${g}`);
        l.filter(x => x.group_id === g).slice(0, 8).forEach(x =>
          console.log(`  ${x.id}  ${(x.avatar_type || '').padEnd(13)}  ${(x.status || '').padEnd(10)}  ${x.name}`));
      }
    } else if (orden === 'avatar') {
      const [nombre, foto] = resto;
      if (!nombre || !foto) throw new Error('Uso: node heygen.mjs avatar "<nombre>" <foto.jpg>');
      console.log(JSON.stringify(await crearAvatarFoto(nombre, { archivo: foto }), null, 2));
    } else if (orden === 'locucion') {
      const [texto, voiceId] = resto;
      if (!texto || !voiceId) throw new Error('Uso: node heygen.mjs locucion "<texto>" <voice_id>');
      console.log(JSON.stringify(await locutar(texto, voiceId), null, 2));
    } else {
      console.log('Órdenes: voces | looks [group_id] | avatar "<nombre>" <foto> | locucion "<texto>" <voice_id>');
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
