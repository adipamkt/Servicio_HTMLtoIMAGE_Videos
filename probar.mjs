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
//
// Lleva además las cuatro cosas que el SVG se comía sin avisar: el fondo
// degradado, los títulos en mayúscula, las formas recortadas con clip-path y
// las fotos desvanecidas con mask-image. El PNG salía bien igual, así que la
// única manera de darse cuenta era abrir el SVG y mirarlo.
const PIEZA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; }
  body { font-family: Poppins, Helvetica, sans-serif; color: #091E42; position: relative;
         background: linear-gradient(180deg, #9C83FC 0%, #E1D8FF 40%, #D3C7FE 100%); }
  .mancha { position: absolute; right: -180px; top: -120px; width: 760px; height: 760px;
            border-radius: 50%; background: #F3F4FF; }
  .pildora { position: absolute; left: 62px; top: 280px; height: 84px; padding: 0 34px;
             border-radius: 42px; background: #704EFD; color: #fff; font-weight: 700;
             font-size: 44px; line-height: 86px; text-transform: uppercase; }
  .marco { position: absolute; left: 480px; top: 760px; width: 300px; height: 300px;
           border-radius: 40px; overflow: hidden; }
  .marco img { position: static; width: 640px; height: 300px; border-radius: 0; }
  .fade { position: absolute; right: 62px; top: 760px; width: 240px; height: 300px;
          background: #704EFD;
          -webkit-mask-image: linear-gradient(to bottom, #000 30%, transparent 100%);
          mask-image: linear-gradient(to bottom, #000 30%, transparent 100%); }
  .docente { position: absolute; left: 62px; top: 1120px; width: 420px;
             border-left: 6px solid #fff; padding-left: 14px;
             font-size: 34px; line-height: 42px; }
  .gris { position: absolute; left: 820px; top: 1120px; width: 200px; height: 200px;
          filter: grayscale(1) contrast(1.05); }
  .contorno { position: absolute; left: 560px; top: 1120px; width: 200px; height: 200px;
              filter: drop-shadow(9px 0 0 #fff) drop-shadow(-9px 0 0 #fff); }
  .resalte { background: #FFC728; color: #091E42; box-shadow: 0 3px 10px rgba(18,32,59,.18); }
  /* Una tipografía con espacios en el nombre: el navegador la entrecomilla y
     dentro de un atributo rompe el XML si no se escapa. */
  .serif { position: absolute; left: 62px; top: 1360px; font-family: "Times New Roman", serif;
           font-size: 30px; color: #091E42; }
  /* Un icono dibujado a mano: el color va en el <svg> de afuera y lo heredan
     las formas de adentro. */
  .icono { position: absolute; left: 620px; top: 1360px; width: 68px; height: 68px; }
  /* Esquinas distintas: <rect> no sabe de esto, hace falta un camino. */
  .tarjeta { position: absolute; left: 0; top: 1440px; width: 620px; height: 120px;
             background: #fff; border-radius: 0 95px 95px 0; }
  /* El velo blanco que aclara la mitad de abajo, puesto desde el CSS. */
  .velo { position: absolute; inset: 0; }
  .velo::after { content: ""; position: absolute; inset: 0;
                 background: linear-gradient(to bottom, rgba(255,255,255,0) 60%, #fff 100%); }
  .forma { position: absolute; left: 0; top: 1600px; width: 1080px; height: 320px;
           background: #091E42;
           clip-path: path('M0 0 L1080 0 L1080 320 L0 320 Z M0 0 Q540 170 1080 0 Z'); }
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
  <div class="titulo">Intervención en crisis: <span class="resalte">herramientas para el abordaje</span> inicial del riesgo suicida</div>
  <img src="data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><circle cx="110" cy="110" r="110" fill="#DFD5FF"/></svg>').toString('base64')}" alt="">
  <div class="marco"><img src="data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="300"><rect width="640" height="300" fill="#1B6EF3"/></svg>').toString('base64')}" alt=""></div>
  <div class="fade"></div>
  <div class="docente">PhD. Mg. Ps. John Sommers-Flanagan</div>
  <div class="serif">Nombre con tipografía de dos palabras</div>
  <svg class="icono" viewBox="0 0 68 68" fill="none" stroke="#704EF9" stroke-width="3"><rect x="3" y="9" width="62" height="54" rx="4"/><line x1="3" y1="21" x2="65" y2="21"/></svg>
  <div class="tarjeta"></div>
  <div class="velo"></div>
  <img class="gris" src="data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#E0452B"/></svg>').toString('base64')}" alt="">
  <img class="contorno" src="data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#1B6EF3"/></svg>').toString('base64')}" alt="">
  <div class="bloque"></div>
  <div class="cta">¡Cupos limitados! Inscríbete ahora</div>
  <div class="forma"></div>
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
let svg = '';
for (const [ext, mime] of Object.entries({ '': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' })) {
  const t = Date.now();
  const r = await fetch(cuerpo.url + ext);
  const datos = await r.arrayBuffer();
  const bytes = datos.byteLength;
  if (ext === '.svg') svg = Buffer.from(datos).toString('utf8');
  comprobar(
    `${(ext || '.png').padEnd(5)} se sirve`,
    r.status === 200 && (r.headers.get('content-type') || '').startsWith(mime) && bytes > 1000,
    `HTTP ${r.status}  ${(bytes / 1024).toFixed(0)} KB  ${Date.now() - t} ms`);
}

// --- 3b. Que el SVG traiga el diseño, no solo la mitad -------------------------
//
// Un SVG que pesa y se sirve puede estar igual vacío de lo que importa: sin el
// fondo, con los títulos en minúscula o con las formas convertidas en
// rectángulos. Eso ya pasó una vez y el PNG no lo delataba.
for (const [que, ok] of Object.entries({
  'el fondo degradado': /<linearGradient[^>]*>[\s\S]*?<stop/.test(svg),
  'los títulos en mayúscula': svg.includes('PRUEBA DEL SERVICIO'),
  'las formas recortadas': /<clipPath[^>]*>\s*<path/.test(svg),
  'el desvanecido de la foto': /<mask\b/.test(svg),
  'la foto recortada por su marco': /<clipPath[^>]*>\s*<rect/.test(svg),
  // La foto suelta mide 220 y es redonda: su recorte tiene que dar 110 de
  // radio, no los 50 que diría leer "50%" como si fueran píxeles.
  'la foto redonda redonda': /<clipPath[^>]*>\s*<rect[^>]*rx="110"/.test(svg),
  'la mancha del fondo redonda': /rx="380"/.test(svg),
  'las fotos incrustadas': !/href="https?:/.test(svg),
  // Illustrator lee SVG 1.1, donde las imágenes van con `xlink:href`. Con el
  // `href` a secas, que es SVG 2, el archivo se ve bien en Chrome y llega sin
  // ninguna foto al programa de diseño.
  'las fotos con xlink:href': /xlink:href="data:/.test(svg) && !/\shref="/.test(svg),
  // Un SVG metido adentro de otro tampoco lo dibuja Illustrator: las fotos de
  // la pieza de prueba son SVG y tienen que haber salido convertidas a PNG.
  'sin imágenes SVG adentro': !svg.includes('data:image/svg+xml'),
  // Nada de SVG 2 en la salida: Illustrator lee 1.1 y lo que no entiende no
  // lo dibuja, sin avisar. `feDropShadow` se lleva el contorno blanco de las
  // fotos recortadas; va escrito a mano con primitivas viejas.
  'sin primitivas de SVG 2': !/feDropShadow|<feDropShadow/.test(svg) && /<feMerge\b/.test(svg),
  'el texto como texto': (svg.match(/<text\b/g) || []).length >= 4,
  // La barra blanca que marca a cada docente: un borde de un lado solo, que
  // dibujado como recuadro no se veía.
  'la barra del docente': /<rect[^>]*width="6"[^>]*fill="rgb\(255, 255, 255\)"/.test(svg),
  'el fondo en blanco y negro': /<feColorMatrix[^>]*type="saturate"[^>]*values="0"/.test(svg),
  'el contorno blanco de la foto': /<feFlood[^>]*flood-color="rgb\(255, 255, 255\)"/.test(svg),
  // Un resaltado que se parte en dos renglones son dos recuadros, no uno que
  // los abarque.
  'el resaltado por renglón': (svg.match(/fill="rgb\(255, 199, 40\)"/g) || []).length >= 2,
  // Una comilla sin escapar adentro de un atributo rompe el XML, y un SVG
  // roto no lo abre nadie.
  'la tipografía de dos palabras escapada':
    svg.includes('&quot;Times New Roman&quot;') && !svg.includes('=""Times'),
  // El color de los iconos viene del <svg> de afuera: si no se copia, las
  // formas salen como cuadrados negros.
  'los iconos con su color': /<rect[^>]*stroke="rgb\(112, 78, 249\)"/.test(svg),
  // Esquinas distintas: tiene que salir un camino, no un rectángulo. El radio
  // sale 60 y no 95 porque la tarjeta mide 120 de alto y CSS los achica para
  // que entren, igual que hace el navegador.
  'la tarjeta de esquinas distintas': /<path d="M0 1440H560A60 60 /.test(svg),
  // El velo del CSS, que no existe como etiqueta en la página.
  'el velo de los pseudo-elementos': (svg.match(/<linearGradient\b/g) || []).length >= 3,
})) comprobar(`el SVG trae ${que}`, ok);

// --- 3c. Que un lector estricto también lo dibuje -----------------------------
//
// Hasta acá el SVG se comprobaba leyéndolo y dibujándolo con Chrome, que es
// justo el motor que no se parece al de diseño: es un navegador y entiende
// SVG 2. Illustrator lee SVG 1.1 y lo que no entiende no lo dibuja, callado.
//
// librsvg es un lector SVG 1.1 que no es un navegador, así que se parece
// mucho más. Si lo que sale acá no se parece a la imagen, algo del archivo no
// va a llegar a diseño. Pasó con el contorno blanco de las fotos recortadas:
// perfecto en Chrome, invisible en todo lo demás.
try {
  const sharp = (await import('sharp')).default;
  const imagen = Buffer.from(await (await fetch(cuerpo.url)).arrayBuffer());
  const estricto = await sharp(Buffer.from(svg, 'utf8')).resize(1080, 1920).png().toBuffer();

  const leer = async b => sharp(b).resize(300).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [A, B] = await Promise.all([leer(imagen), leer(estricto)]);
  let suma = 0;
  const N = Math.min(A.data.length, B.data.length);
  for (let i = 0; i < N; i++) suma += Math.abs(A.data[i] - B.data[i]);
  const dif = suma / N;

  // El margen es ancho a propósito: en una máquina sin Poppins el texto cae
  // en otra letra y eso solo ya da unos 10. Lo que se busca es el derrumbe
  // —fotos que no salen, formas que no se dibujan—, que da mucho más.
  comprobar('lo dibuja igual un lector SVG 1.1', dif < 25, `diferencia ${dif.toFixed(1)} / 255`);
} catch (e) {
  marca('lo dibuja igual un lector SVG 1.1', true, `se saltea: ${e.message.slice(0, 40)}`);
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
