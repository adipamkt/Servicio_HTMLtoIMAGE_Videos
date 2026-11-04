// Prueba el servicio contra donde esté corriendo.
//
//   node probar.mjs                                       contra la máquina
//   node probar.mjs https://servicio.vercel.app           contra el desplegado
//   node probar.mjs https://servicio.vercel.app usuario clave
//
// Hace lo mismo que hace n8n y mide lo único que no se puede saber de
// antemano: cuánto tarda el primer render con el servicio frío contra el
// segundo, ya caliente.
//
// La pieza de prueba va acá adentro a propósito: así el servicio se puede
// probar sin depender de nada más.

const [base = 'http://localhost:3000', usuario, clave] = process.argv.slice(2);

const auth = usuario
  ? { authorization: 'Basic ' + Buffer.from(`${usuario}:${clave || ''}`).toString('base64') }
  : {};

// Una pieza con lo que tienen las de verdad: tipografía de Google, texto que
// se ajusta, bloques de color con esquinas redondeadas y una imagen.
const PIEZA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; }
  body { font-family: Poppins, Helvetica, sans-serif; background: #FFFFFF; color: #091E42; position: relative; }
  .mancha { position: absolute; right: -180px; top: -120px; width: 760px; height: 760px;
            border-radius: 50%; background: #F3F4FF; }
  .pildora { position: absolute; left: 62px; top: 280px; height: 84px; padding: 0 34px;
             border-radius: 42px; background: #704EFD; color: #fff; font-weight: 700;
             font-size: 44px; line-height: 86px; }
  .titulo { position: absolute; left: 62px; top: 410px; width: 900px; font-size: 76px;
            font-weight: 700; line-height: 1.12; }
  .bloque { position: absolute; left: 62px; top: 1080px; width: 956px; height: 420px;
            border-radius: 48px; background: #704EFD; }
  .cta { position: absolute; left: 110px; top: 1420px; width: 860px; height: 128px;
         border-radius: 64px; background: #FFC728; color: #704EFD; font-weight: 700;
         font-size: 46px; line-height: 128px; text-align: center; }
  img { position: absolute; left: 62px; top: 800px; width: 220px; height: 220px;
        border-radius: 50%; }
</style>
</head>
<body>
  <div class="mancha"></div>
  <div class="pildora">Prueba del servicio</div>
  <div class="titulo">Intervención en crisis: herramientas para el abordaje inicial del riesgo suicida</div>
  <img src="data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><circle cx="110" cy="110" r="110" fill="#DFD5FF"/></svg>').toString('base64')}" alt="">
  <div class="bloque"></div>
  <div class="cta">¡Cupos limitados! Inscríbete ahora</div>
</body>
</html>`;

const marca = (etiqueta, ok, detalle = '') =>
  console.log(`  ${ok ? '✓' : '✗'} ${etiqueta.padEnd(34)} ${detalle}`);

let fallos = 0;
const comprobar = (etiqueta, ok, detalle) => {
  if (!ok) fallos++;
  marca(etiqueta, ok, detalle);
};

console.log(`\nProbando ${base}`);
console.log(`Pieza de prueba: 1080x1920  (${(PIEZA.length / 1024).toFixed(0)} KB de HTML)\n`);

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
    html: PIEZA,
    google_fonts: 'Poppins:400,500,600,700',
    viewport_width: 1080,
    viewport_height: 1920,
    device_scale: 1,
    ms_delay: 1500,
  }),
});
const primero = Date.now() - t0;

let cuerpo = null;
try { cuerpo = await res.json(); } catch { /* respuesta que no es JSON */ }

comprobar('el render responde', res.status === 200, `HTTP ${res.status}  ${primero} ms`);
if (res.status !== 200) {
  console.log('\n  respuesta:', JSON.stringify(cuerpo).slice(0, 400), '\n');
  process.exit(1);
}
comprobar('devuelve una dirección', !!cuerpo?.url, cuerpo?.url || '');

// --- 3. Los tres formatos ------------------------------------------------------
for (const [ext, mime] of Object.entries({ '': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' })) {
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
  body: JSON.stringify({ html: PIEZA, viewport_width: 1200, viewport_height: 1200 }),
});
const segundo = Date.now() - t1;
comprobar('el segundo render responde', r2.status === 200, `HTTP ${r2.status}  ${segundo} ms`);

// --- 5. Una dirección que no existe --------------------------------------------
const r3 = await fetch(`${base}/i/00000000-0000-0000-0000-000000000000`);
comprobar('avisa si la pieza no está', r3.status === 404, `HTTP ${r3.status}`);

// --- Resumen --------------------------------------------------------------------
console.log('');
console.log(`  en frío     ${primero} ms`);
console.log(`  en caliente ${segundo} ms`);
console.log('  la diferencia es lo que tarda Chrome en arrancar\n');

if (fallos) {
  console.log(`${fallos} comprobación(es) fallaron.\n`);
  process.exit(1);
}
console.log('Todo bien.\n');
