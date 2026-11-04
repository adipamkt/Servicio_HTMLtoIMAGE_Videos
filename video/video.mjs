// La gráfica animada: el mismo afiche, en movimiento.
//
//   node video.mjs                       el seminario, su afiche vertical
//   node video.mjs curso-sincronico      otro tipo del catálogo
//   node video.mjs seminario 1200X1200-RRSS   otra pieza
//
// No se duplica el diseño. La pieza es exactamente la que devuelve el catálogo
// —la misma que sale en PNG— y acá solo se la envuelve en una composición de
// HyperFrames y se le cuelga una timeline de GSAP. Si diseño cambia el afiche,
// el video queda al día sin tocar nada.
//
// La animación se busca en composicion/animaciones/<tipo>-<pieza>.js. Si no
// hay una escrita para esa pieza, se usa la genérica, que mueve lo que haya
// sin saber qué es. Queda bien, pero una animación propia siempre queda mejor:
// la del seminario sabe que los docentes entran uno detrás del otro.
//
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { catalogo } from '../tipos/index.mjs';

const correr = promisify(execFile);

const SEGUNDOS = 8;
const FPS = 30;

// fileURLToPath y no la ruta cruda de la URL: esta carpeta tiene espacios y
// acentos, que en una URL vienen escritos como %20 y %C3%B1.
const aqui = p => path.join(path.dirname(fileURLToPath(import.meta.url)), p);

const GSAP = aqui('composicion/vendor/gsap.min.js');
const AYUDAS = aqui('composicion/ayudas.js');
const ANIMACIONES = aqui('composicion/animaciones');

// La animación de esta pieza, o la genérica si todavía no tiene una propia.
function animacionDe(tipo, pieza) {
  const propia = path.join(ANIMACIONES, `${tipo}-${pieza}.js`);
  const elegida = fs.existsSync(propia) ? propia : path.join(ANIMACIONES, '_generica.js');
  return { js: fs.readFileSync(elegida, 'utf8'), propia: elegida === propia };
}

// Afiche estático -> composición de HyperFrames.
export function componer(html, ancho, alto, animacion, { segundos = SEGUNDOS, fps = FPS } = {}) {
  // 1. La escena es el contexto de posicionamiento: mismo tamaño que el body,
  //    así los `position: absolute` del afiche caen exactamente donde estaban.
  let salida = html.replace('</style>',
    '\n  /* Envoltorio de la composición (agregado por video.mjs) */\n'
    + `  .escena { position: relative; width: ${ancho}px; height: ${alto}px; overflow: hidden; }\n</style>`);

  // 2. Envolver el contenido del body.
  const apertura = '<div class="escena" data-composition-id="root"'
    + ` data-width="${ancho}" data-height="${alto}"`
    + ` data-fps="${fps}" data-duration="${segundos}">`;
  salida = salida.replace(/<body([^>]*)>/, `<body$1>\n${apertura}`);

  // 3. Cerrar la escena y colgar GSAP, las ayudas y la timeline, después del
  //    script que llena el afiche. Van incrustados y no enlazados: el render no
  //    debe salir a buscar nada, y el linter necesita ver la registración de
  //    window.__timelines.
  return salida.replace('</body>',
    '</div>\n'
    + `<script>${fs.readFileSync(GSAP, 'utf8')}</script>\n`
    + `<script>\n${fs.readFileSync(AYUDAS, 'utf8')}</script>\n`
    + `<script>\n${animacion}</script>\n</body>`);
}

// Un tipo del catálogo -> el MP4 de una de sus piezas.
export async function renderizarVideo(nombreTipo, { datos = {}, pieza = null, segundos = SEGUNDOS, fps = FPS } = {}) {
  const tipo = catalogo[nombreTipo];
  if (!tipo) {
    throw Object.assign(
      new Error(`No existe el tipo "${nombreTipo}". Disponibles: ${Object.keys(catalogo).join(', ')}`),
      { codigo: 400 });
  }

  const piezas = tipo.piezas({ ...tipo.ejemplo, ...datos });
  // Por defecto, la vertical: es el formato de historias y de reels.
  const elegida = pieza
    ? piezas.find(p => p.nombre === pieza)
    : piezas.find(p => /^1080X1920/.test(p.nombre)) || piezas[0];

  if (!elegida) {
    throw Object.assign(
      new Error(`El tipo "${nombreTipo}" no tiene la pieza "${pieza}". Tiene: ${piezas.map(p => p.nombre).join(', ')}`),
      { codigo: 400 });
  }

  const animacion = animacionDe(nombreTipo, elegida.nombre);

  const proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'video-'));
  const destino = path.join(proyecto, 'salida.mp4');
  try {
    fs.writeFileSync(path.join(proyecto, 'index.html'),
      componer(elegida.html, elegida.w, elegida.h, animacion.js, { segundos, fps }));

    // Se llama al binario con node y no por npx: evita la shell, que con una
    // ruta con espacios es un problema esperando pasar.
    const t = Date.now();
    await correr(process.execPath,
      [aqui('../node_modules/hyperframes/bin/hyperframes.mjs'), 'render', proyecto, '-o', destino, '--quiet'],
      { cwd: aqui('..'), maxBuffer: 32 * 1024 * 1024 });

    return {
      pieza: elegida.nombre,
      ancho: elegida.w,
      alto: elegida.h,
      segundos,
      fps,
      animacion: animacion.propia ? 'propia' : 'generica',
      mp4: fs.readFileSync(destino),
      ms: Date.now() - t,
    };
  } finally {
    fs.rmSync(proyecto, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('video.mjs')) {
  const [tipo = 'seminario', pieza = null] = process.argv.slice(2);
  const SALIDA = 'salida/videos';

  let v;
  try {
    v = await renderizarVideo(tipo, { pieza });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  fs.mkdirSync(SALIDA, { recursive: true });
  const archivo = path.resolve(SALIDA, `${tipo}-${v.pieza}.mp4`);
  fs.writeFileSync(archivo, v.mp4);

  console.log(`${v.pieza}  ${v.ancho}x${v.alto}  ${v.segundos}s a ${v.fps}fps`);
  console.log(`animación ${v.animacion}  ${(v.mp4.length / 1024 / 1024).toFixed(1)} MB  ${(v.ms / 1000).toFixed(1)} s`);
  console.log(`→ ${archivo}`);
}
