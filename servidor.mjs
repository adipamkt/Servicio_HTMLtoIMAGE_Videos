// El servidor que genera las piezas.
//
//   node servidor.mjs        → http://localhost:3000
//
// Tres cosas:
//
//   GET  /          una página para probarlo a mano
//   GET  /tipos     qué tipos de pieza hay y qué datos pide cada uno
//   POST /piezas    { tipo, version, datos } -> los PNG
//   POST /video     { tipo, version, datos, pieza } -> la gráfica animada en MP4
//   POST /editable  { tipo, version, datos, pieza } -> la pieza en SVG editable
//
// Los archivos quedan en salida/entregas/<id>/ y se sirven desde ahí, así se
// pueden abrir en el navegador o bajar sin pasar por base64. Algunas piezas
// salen en PNG y en WEBP: son dos archivos de la misma pieza.
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { renderizar } from './piezas.mjs';
import { renderizarVideo } from './video/video.mjs';
import { renderizarSvg } from './piezas.mjs';
import { manejar as servicioRender, esRutaDelServicio } from './servicio.mjs';
import { listar } from './tipos/index.mjs';
import { pagina } from './pagina.mjs';

const PUERTO = Number(process.env.PUERTO) || 3000;
const ENTREGAS = path.resolve('salida/entregas');

const json = (res, codigo, cuerpo) => {
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo, null, 2));
};

const leerCuerpo = req => new Promise((listo, falla) => {
  let texto = '';
  req.on('data', t => {
    texto += t;
    if (texto.length > 20e6) { falla(new Error('El pedido es demasiado grande (más de 20 MB).')); req.destroy(); }
  });
  req.on('end', () => listo(texto));
  req.on('error', falla);
});

// POST /piezas  { tipo, version, datos, piezas? }
async function generar(req, res) {
  const texto = await leerCuerpo(req);

  let pedido;
  try {
    pedido = texto ? JSON.parse(texto) : {};
  } catch {
    return json(res, 400, { error: 'El cuerpo del pedido no es JSON válido.' });
  }

  const { tipo, version = 1, datos = {}, piezas: soloPiezas = null } = pedido;
  if (!tipo) return json(res, 400, { error: 'Falta "tipo". Mirá GET /tipos para ver cuáles hay.' });

  const t = Date.now();
  let resultado;
  try {
    // El diseño es parte de los datos: el tipo decide qué plantillas usar.
    resultado = await renderizar(tipo, { ...datos, version }, soloPiezas);
  } catch (e) {
    return json(res, e.codigo || 500, { error: e.message });
  }

  const id = nuevaEntrega();
  const carpeta = path.join(ENTREGAS, id);

  const salida = resultado.map(p => {
    const archivos = p.archivos.map(a => {
      const nombreArchivo = `${p.nombre}.${a.formato}`;
      fs.writeFileSync(path.join(carpeta, nombreArchivo), a.bytes);
      return {
        formato: a.formato,
        kb: Math.round(a.bytes.length / 1024),
        url: `/entregas/${id}/${nombreArchivo}`,
      };
    });
    return {
      nombre: p.nombre,
      ancho: p.ancho,
      alto: p.alto,
      ms: p.ms,
      archivos,
      ...(p.aviso ? { aviso: p.aviso } : {}),
    };
  });

  json(res, 200, {
    tipo, version, id,
    ms: Date.now() - t,
    archivos: salida.reduce((n, p) => n + p.archivos.length, 0),
    piezas: salida,
  });
}

// Una carpeta por pedido: así dos campañas no se pisan.
const nuevaEntrega = () => {
  const id = `${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
  fs.mkdirSync(path.join(ENTREGAS, id), { recursive: true });
  return id;
};

// POST /video  { tipo, version, datos, pieza?, segundos? }
//
// Tarda bastante más que las imágenes: hay que dibujar un cuadro por cada
// treintavo de segundo y después armar el MP4.
async function generarVideo(req, res) {
  const texto = await leerCuerpo(req);

  let pedido;
  try {
    pedido = texto ? JSON.parse(texto) : {};
  } catch {
    return json(res, 400, { error: 'El cuerpo del pedido no es JSON válido.' });
  }

  const { tipo, version = 1, datos = {}, pieza = null, segundos } = pedido;
  if (!tipo) return json(res, 400, { error: 'Falta "tipo". Mirá GET /tipos para ver cuáles hay.' });

  let v;
  try {
    v = await renderizarVideo(tipo, { datos: { ...datos, version }, pieza, ...(segundos ? { segundos } : {}) });
  } catch (e) {
    return json(res, e.codigo || 500, { error: e.message });
  }

  const id = nuevaEntrega();
  const nombreArchivo = `${v.pieza}.mp4`;
  fs.writeFileSync(path.join(ENTREGAS, id, nombreArchivo), v.mp4);

  json(res, 200, {
    tipo,
    version,
    id,
    pieza: v.pieza,
    ancho: v.ancho,
    alto: v.alto,
    segundos: v.segundos,
    fps: v.fps,
    // "generica" avisa que esta pieza todavía no tiene animación propia.
    animacion: v.animacion,
    mb: +(v.mp4.length / 1024 / 1024).toFixed(1),
    ms: v.ms,
    url: `/entregas/${id}/${nombreArchivo}`,
  });
}

// POST /editable  { tipo, version, datos, pieza? }
//
// La misma pieza en SVG: bloques, texto e imágenes, para abrir en Illustrator
// o en Figma. Tarda como un PNG.
async function generarEditable(req, res) {
  const texto = await leerCuerpo(req);

  let pedido;
  try {
    pedido = texto ? JSON.parse(texto) : {};
  } catch {
    return json(res, 400, { error: 'El cuerpo del pedido no es JSON válido.' });
  }

  const { tipo, version = 1, datos = {}, pieza = null } = pedido;
  if (!tipo) return json(res, 400, { error: 'Falta "tipo". Mirá GET /tipos para ver cuáles hay.' });

  let v;
  try {
    v = await renderizarSvg(tipo, { datos: { ...datos, version }, pieza });
  } catch (e) {
    return json(res, e.codigo || 500, { error: e.message });
  }

  const id = nuevaEntrega();
  const nombreArchivo = `${v.pieza}.svg`;
  fs.writeFileSync(path.join(ENTREGAS, id, nombreArchivo), v.svg);

  json(res, 200, {
    tipo, version, id,
    pieza: v.pieza,
    ancho: v.ancho,
    alto: v.alto,
    kb: Math.round(v.svg.length / 1024),
    ms: v.ms,
    url: `/entregas/${id}/${nombreArchivo}`,
    // Para que el texto caiga donde corresponde, quien lo abra necesita
    // Poppins instalada. Es la tipografía de la marca.
    tipografia: 'Poppins',
  });
}

// GET /entregas/<id>/<pieza>.<png|webp|mp4|svg>
const TIPO_MIME = { png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', svg: 'image/svg+xml' };

function servirArchivo(req, res, ruta) {
  // Solo nombres simples: nada de subir de carpeta con "..".
  const partes = ruta.split('/').filter(Boolean).slice(1);
  if (partes.length !== 2 || partes.some(p => !/^[\w.-]+$/.test(p))) {
    return json(res, 400, { error: 'Ruta de archivo inválida.' });
  }
  const archivo = path.join(ENTREGAS, ...partes);
  if (!fs.existsSync(archivo)) return json(res, 404, { error: 'No existe esa pieza.' });
  const mime = TIPO_MIME[path.extname(archivo).slice(1).toLowerCase()];
  if (!mime) return json(res, 400, { error: 'Ese archivo no es una pieza.' });
  res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
  fs.createReadStream(archivo).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  try {
    // El servicio de render, el que llama n8n. Va primero porque es el que
    // tiene que responder rápido y el que lleva autenticación propia.
    if (esRutaDelServicio(ruta)) return await servicioRender(req, res, ruta);

    if (req.method === 'GET' && ruta === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(pagina(listar()));
    }
    if (req.method === 'GET' && ruta === '/tipos') return json(res, 200, listar());
    if (req.method === 'POST' && ruta === '/piezas') return await generar(req, res);
    if (req.method === 'POST' && ruta === '/video') return await generarVideo(req, res);
    if (req.method === 'POST' && ruta === '/editable') return await generarEditable(req, res);
    if (req.method === 'GET' && ruta.startsWith('/entregas/')) return servirArchivo(req, res, ruta);

    json(res, 404, { error: `No hay nada en ${req.method} ${ruta}.` });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Piezas ADIPA  →  http://localhost:${PUERTO}`);
  console.log(`Tipos cargados: ${listar().map(t => t.nombre).join(', ')}`);
});
