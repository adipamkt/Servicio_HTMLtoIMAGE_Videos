// El servicio de render: HTML a imagen y HTML a SVG.
//
// Esto es lo que reemplaza a htmlcsstoimage.com. El flujo de n8n sigue
// haciendo todo lo demás —leer Monday, leer el Documento Maestro, bajar y
// subir a Drive— y arma el HTML como siempre; lo único que cambia es a quién
// le pide la imagen.
//
// Habla el mismo idioma que htmlcsstoimage a propósito. En n8n se cambia la
// URL del nodo y nada más: el cuerpo del pedido, la respuesta y el nodo que
// baja la imagen quedan iguales.
//
//   POST /v1/image      { html, viewport_width, viewport_height, … } -> { url }
//   GET  /i/<id>        el PNG
//   GET  /i/<id>.webp   el mismo render en WEBP
//   GET  /i/<id>.svg    el mismo diseño en SVG editable
//
// Lo del `.webp` no es un invento nuestro: htmlcsstoimage ya servía la imagen
// en otros formatos agregando la extensión a la misma URL, y el nodo
// "Formatos de salida" del flujo cuenta con eso. El `.svg` sigue el mismo
// camino, así que para sumarlo alcanza con agregar 'svg' a la lista de
// formatos de una pieza.
//
// El mismo código corre en la máquina y en Vercel: lo único que cambia es
// dónde quedan los archivos, y de eso se encarga `almacen.mjs`.
//
import crypto from 'node:crypto';
import { capturar } from './render.mjs';
import { svgDesdeHtml } from './editable.mjs';
import { guardar, leer, direccion, existe, mimeDe, enVercel } from './almacen.mjs';

// El SVG y el WEBP se arman la primera vez que alguien los pide. La promesa se
// guarda para que dos pedidos a la vez no lo hagan dos veces.
const enCurso = new Map();

const json = (res, codigo, cuerpo) => {
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo, null, 2));
};

// Usuario y clave, si están puestos. htmlcsstoimage usa autenticación básica,
// así que la credencial que ya existe en n8n sirve tal cual: solo hay que
// cambiarle el usuario y la clave.
export function autorizado(req) {
  const usuario = process.env.SERVICIO_USUARIO;
  const clave = process.env.SERVICIO_CLAVE;
  if (!usuario && !clave) return true;   // sin credenciales configuradas, abierto

  const cabecera = req.headers.authorization || '';
  if (!cabecera.startsWith('Basic ')) return false;
  const [u, c] = Buffer.from(cabecera.slice(6), 'base64').toString('utf8').split(':');

  // Comparación de tiempo constante: con `===` se puede adivinar la clave
  // midiendo cuánto tarda en responder.
  const igual = (a, b) => {
    const x = Buffer.from(String(a || ''));
    const y = Buffer.from(String(b || ''));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  return igual(u, usuario) && igual(c, clave);
}

const leerCuerpo = req => new Promise((listo, falla) => {
  // En Vercel el cuerpo puede venir ya parseado.
  if (req.body !== undefined) return listo(req.body);
  let texto = '';
  req.on('data', t => {
    texto += t;
    if (texto.length > 32e6) { falla(new Error('El pedido es demasiado grande.')); req.destroy(); }
  });
  req.on('end', () => listo(texto));
  req.on('error', falla);
});

// Si el pedido nombra tipografías de Google y el HTML no las carga, se agrega
// el enlace. htmlcsstoimage hacía eso, y sin la tipografía el texto cae con
// otra y los renglones se corren.
export function conTipografias(html, fuentes) {
  if (!fuentes || /fonts\.googleapis\.com/.test(html)) return html;
  const familias = String(fuentes).split('|').map(f => 'family=' + f.replace(/\s+/g, '+')).join('&');
  const enlace = `<link href="https://fonts.googleapis.com/css2?${familias}&display=block" rel="stylesheet">`;
  return /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, m => m + '\n' + enlace)
    : enlace + '\n' + html;
}

// POST /v1/image
export async function generar(req, res) {
  let pedido;
  try {
    const cuerpo = await leerCuerpo(req);
    pedido = typeof cuerpo === 'string' ? JSON.parse(cuerpo || '{}') : (cuerpo || {});
  } catch {
    return json(res, 400, { error: 'El cuerpo del pedido no es JSON válido.' });
  }

  const {
    html,
    viewport_width: ancho = 1080,
    viewport_height: alto = 1920,
    google_fonts: fuentes = '',
    ms_delay: espera = 0,
  } = pedido;

  if (!html || typeof html !== 'string') {
    return json(res, 400, { error: 'Falta "html": el contenido de la pieza.' });
  }

  const w = Number(ancho) | 0;
  const h = Number(alto) | 0;
  if (w < 1 || h < 1 || w > 8000 || h > 8000) {
    return json(res, 400, { error: `Medidas fuera de rango: ${ancho}x${alto}.` });
  }

  const pagina = conTipografias(html, fuentes);
  const id = crypto.randomUUID();
  const t = Date.now();

  try {
    const [png] = await capturar(pagina, w, h, ['png'], { espera: Number(espera) || 0 });
    await guardar(id, 'pieza.png', png.bytes);
    // El HTML se guarda para poder armar el WEBP o el SVG después sin que
    // n8n tenga que mandarlo de nuevo.
    await guardar(id, 'pieza.html', Buffer.from(pagina, 'utf8'));
    await guardar(id, 'medidas.json', Buffer.from(JSON.stringify({ ancho: w, alto: h }), 'utf8'));
  } catch (e) {
    return json(res, 500, { error: e.message });
  }

  const base = process.env.SERVICIO_URL
    || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  json(res, 200, { url: `${base}/i/${id}`, ms: Date.now() - t });
}

// Arma el formato pedido a partir del HTML guardado, una sola vez.
async function armar(id, formato) {
  const llave = `${id}.${formato}`;
  if (!enCurso.has(llave)) {
    enCurso.set(llave, (async () => {
      const medidas = await leer(id, 'medidas.json');
      const html = await leer(id, 'pieza.html');
      if (!medidas || !html) throw new Error('Esa pieza ya no está guardada.');

      const { ancho, alto } = JSON.parse(medidas.toString('utf8'));
      const bytes = formato === 'svg'
        ? await svgDesdeHtml(html.toString('utf8'), ancho, alto)
        : (await capturar(html.toString('utf8'), ancho, alto, ['webp']))[0].bytes;

      await guardar(id, `pieza.${formato}`, bytes);
      return bytes;
    })().finally(() => enCurso.delete(llave)));
  }
  return enCurso.get(llave);
}

// GET /i/<id>[.webp|.svg]
export async function servir(req, res, archivo) {
  const m = String(archivo).match(/^([0-9a-f-]{36})(?:\.(webp|svg|png))?$/i);
  if (!m) return json(res, 400, { error: 'Dirección de pieza inválida.' });

  const [, id, formato = 'png'] = m;
  const nombre = `pieza.${formato}`;

  if (!(await existe(id, nombre))) {
    if (formato === 'png') return json(res, 404, { error: 'Esa pieza ya no está.' });
    try {
      await armar(id, formato);
    } catch (e) {
      return json(res, 500, { error: `No se pudo armar el ${formato.toUpperCase()}: ${e.message}` });
    }
  }

  // En Vercel el archivo vive en el blob: se manda a buscarlo ahí en vez de
  // hacerlo pasar por la función, que sería más lento y más caro.
  const url = await direccion(id, nombre);
  if (url) {
    res.writeHead(302, { location: url, 'cache-control': 'public, max-age=86400' });
    return res.end();
  }

  const bytes = await leer(id, nombre);
  if (!bytes) return json(res, 404, { error: 'Esa pieza ya no está.' });
  res.writeHead(200, { 'content-type': mimeDe(nombre), 'cache-control': 'public, max-age=86400' });
  res.end(bytes);
}

// El servicio entero, para que lo monte el servidor de la máquina.
export async function manejar(req, res, ruta) {
  if (!autorizado(req)) {
    res.writeHead(401, { 'www-authenticate': 'Basic realm="piezas"', 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Usuario o clave incorrectos.' }));
  }
  if (req.method === 'POST' && ruta === '/v1/image') return generar(req, res);
  if (req.method === 'GET' && ruta.startsWith('/i/')) return servir(req, res, ruta.slice(3));
  return false;
}

export const esRutaDelServicio = ruta => ruta === '/v1/image' || ruta.startsWith('/i/');
export { enVercel };
