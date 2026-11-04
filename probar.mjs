// Prueba el servicio contra donde esté corriendo.
//
//   node probar.mjs                                       contra la máquina
//   node probar.mjs https://servicio.vercel.app           contra el desplegado
//   node probar.mjs https://servicio.vercel.app usuario clave
//
// Hace lo mismo que hace n8n, con una pieza real del catálogo, y además mide
// lo único que no se puede saber de antemano: cuánto tarda el primer render
// cuando el servicio está frío.
//
import { catalogo } from './tipos/index.mjs';

const [base = 'http://localhost:3000', usuario, clave] = process.argv.slice(2);

const auth = usuario
  ? { authorization: 'Basic ' + Buffer.from(`${usuario}:${clave || ''}`).toString('base64') }
  : {};

const marca = (etiqueta, ok, detalle = '') =>
  console.log(`  ${ok ? '✓' : '✗'} ${etiqueta.padEnd(34)} ${detalle}`);

let fallos = 0;
const comprobar = (etiqueta, ok, detalle) => {
  if (!ok) fallos++;
  marca(etiqueta, ok, detalle);
};

// La pieza más pesada del catálogo: si anda esta, andan todas.
const tipo = catalogo['seminario'];
const pieza = tipo.piezas({ ...tipo.ejemplo }).find(p => p.nombre === '1080X1920-RRSS');

console.log(`\nProbando ${base}`);
console.log(`Pieza: ${pieza.nombre}  ${pieza.w}x${pieza.h}  (${(pieza.html.length / 1024).toFixed(0)} KB de HTML)\n`);

// --- 1. Sin credenciales, si el servicio las pide -----------------------------
if (usuario) {
  const r = await fetch(`${base}/v1/image`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ html: '<b>x</b>', viewport_width: 10, viewport_height: 10 }),
  });
  comprobar('rechaza sin credenciales', r.status === 401, `HTTP ${r.status}`);
}

// --- 2. El render, como lo pide n8n -------------------------------------------
const t0 = Date.now();
const res = await fetch(`${base}/v1/image`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...auth },
  body: JSON.stringify({
    html: pieza.html,
    google_fonts: 'Poppins:400,500,600,700',
    viewport_width: pieza.w,
    viewport_height: pieza.h,
    device_scale: 1,
    ms_delay: 1500,
  }),
});
const primero = Date.now() - t0;

let cuerpo = null;
try { cuerpo = await res.json(); } catch { /* respuesta que no es JSON */ }

comprobar('el render responde', res.status === 200, `HTTP ${res.status}  ${primero} ms`);
if (res.status !== 200) {
  console.log('\n  respuesta:', JSON.stringify(cuerpo).slice(0, 300));
  process.exit(1);
}
comprobar('devuelve una dirección', !!cuerpo?.url, cuerpo?.url || '');

// --- 3. Los tres formatos ------------------------------------------------------
const esperado = { '': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
for (const [ext, mime] of Object.entries(esperado)) {
  const t = Date.now();
  const r = await fetch(cuerpo.url + ext);
  const bytes = (await r.arrayBuffer()).byteLength;
  comprobar(
    `${(ext || '.png').padEnd(5)} se sirve`,
    r.status === 200 && (r.headers.get('content-type') || '').startsWith(mime) && bytes > 1000,
    `HTTP ${r.status}  ${(bytes / 1024).toFixed(0)} KB  ${Date.now() - t} ms`);
}

// --- 4. El segundo render, con el servicio ya caliente -------------------------
const t1 = Date.now();
const r2 = await fetch(`${base}/v1/image`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...auth },
  body: JSON.stringify({ html: pieza.html, viewport_width: 1200, viewport_height: 1200 }),
});
const segundo = Date.now() - t1;
comprobar('el segundo render responde', r2.status === 200, `HTTP ${r2.status}  ${segundo} ms`);

// --- 5. Una dirección que no existe --------------------------------------------
const r3 = await fetch(`${base}/i/00000000-0000-0000-0000-000000000000`);
comprobar('avisa si la pieza no está', r3.status === 404, `HTTP ${r3.status}`);

// --- Resumen --------------------------------------------------------------------
console.log('');
console.log(`  en frío    ${primero} ms`);
console.log(`  en caliente ${segundo} ms`);
console.log(`  la diferencia es lo que tarda Chrome en arrancar\n`);

if (fallos) {
  console.log(`${fallos} comprobación(es) fallaron.\n`);
  process.exit(1);
}
console.log('Todo bien.\n');
