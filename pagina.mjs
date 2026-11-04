// La página de prueba que sirve el servidor en /.
//
// Es una herramienta interna para ver las piezas sin escribir un comando: se
// elige el tipo, se completan los datos y aparecen los PNG. Usa los colores y
// la tipografía del manual de ADIPA.
//
// El formulario no está escrito a mano: se arma con los `campos` que declara
// cada tipo del catálogo. Un tipo nuevo que declare sus campos tiene su
// formulario sin tocar este archivo.
//
import { PAISES } from './paises.mjs';

const opcionesPaisDoc = Object.entries(PAISES)
  .map(([clave, p]) => [p.cod, clave[0].toUpperCase() + clave.slice(1) + ' (' + p.cod + ')']);

const casillasPais = Object.keys(PAISES).map(c => [c, c[0].toUpperCase() + c.slice(1)]);

export const pagina = tipos => `<!doctype html>
<html lang="es">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Piezas ADIPA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --morado: #704EFD;
    --cian: #2CB7FF;
    --gris: #F3F4FF;
    --navy: #091E42;
    --borde: #E3E8F3;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 40px 24px;
    font: 400 15px/1.5 Poppins, Helvetica, sans-serif;
    color: var(--navy); background: #fff;
  }
  main { max-width: 1040px; margin: 0 auto; }
  h1 { font-weight: 700; font-size: 28px; margin: 0 0 4px; }
  h1 span { color: var(--morado); }
  p.sub { margin: 0 0 32px; color: #5B6B8C; }
  form, .resultado {
    background: #fff; border: 1px solid var(--borde); border-radius: 8px;
    padding: 24px; box-shadow: 0 1px 3px rgb(0 0 0 / .15);
  }
  .campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
  label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px; }
  input, select, textarea {
    width: 100%; padding: 10px 12px; font: inherit; color: inherit;
    border: 1px solid var(--borde); border-radius: 6px; background: var(--gris);
  }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--morado); outline-offset: -1px; background: #fff; }
  textarea { resize: vertical; min-height: 76px; }
  .ancho { grid-column: 1 / -1; }
  .casillas { display: flex; flex-wrap: wrap; gap: 8px; }
  .casillas label {
    display: flex; align-items: center; gap: 8px; margin: 0; font-weight: 500; font-size: 14px;
    padding: 9px 14px; border: 1px solid var(--borde); border-radius: 6px; background: var(--gris); cursor: pointer;
  }
  .casillas label:has(:checked) { border-color: var(--morado); background: #fff; color: var(--morado); }
  .casillas input { width: auto; accent-color: var(--morado); }
  .nota { font-size: 12px; color: #5B6B8C; margin: 8px 0 0; }
  button {
    margin-top: 20px; padding: 12px 28px; font: 500 15px Poppins, Helvetica, sans-serif;
    color: #fff; background: var(--morado); border: 0; border-radius: 6px; cursor: pointer;
  }
  button:hover { background: #5B3BE0; }
  button:disabled { opacity: .5; cursor: progress; }
  button.segundo { margin-left: 10px; background: #fff; color: var(--morado); border: 1px solid var(--morado); }
  button.segundo:hover { background: var(--gris); }
  video { width: 100%; max-width: 300px; display: block; border: 1px solid var(--borde); border-radius: 8px; }
  .resultado { margin-top: 24px; }
  .estado { font-weight: 600; margin: 0 0 16px; }
  .error { color: #B20000; }
  .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
  figure { margin: 0; }
  figure img {
    width: 100%; display: block; border: 1px solid var(--borde); border-radius: 8px; background: var(--gris);
  }
  figcaption { font-size: 12px; color: #5B6B8C; margin-top: 8px; }
  figcaption b { display: block; color: var(--navy); font-size: 13px; }
  figcaption a { color: var(--morado); text-decoration: none; font-weight: 500; }
  figcaption a:hover { text-decoration: underline; }
  figcaption .aviso { display: block; margin-top: 4px; color: #CC6A00; }
</style>

<main>
  <h1>Piezas <span>ADIPA</span></h1>
  <p class="sub">Elegí el tipo de programa, completá los datos y se generan las piezas.</p>

  <form id="f">
    <div class="campos">
      <div class="ancho">
        <label for="tipo">Tipo de programa</label>
        <select id="tipo">
          ${tipos.map(t => `<option value="${t.nombre}">${t.etiqueta}</option>`).join('')}
        </select>
      </div>
      <div class="ancho" id="cajaVersion">
        <label>Diseño</label>
        <div class="casillas" id="version"></div>
      </div>
    </div>
    <div class="campos" id="propios"></div>
    <button id="b">Generar piezas</button>
    <button id="bv" class="segundo" type="button">Generar el video</button>
    <button id="be" class="segundo" type="button">Generar el editable</button>
  </form>

  <div class="resultado" id="r" hidden></div>
</main>

<script>
const TIPOS = ${JSON.stringify(tipos)};
const PAIS_DOC = ${JSON.stringify(opcionesPaisDoc)};
const CASILLAS_PAIS = ${JSON.stringify(casillasPais)};

// Cómo se dibuja y cómo se lee cada campo. Un campo que no esté acá no se
// muestra: son las imágenes y los logos, que salen del ejemplo hasta que estén
// conectados Drive y Monday.
const CAMPOS = {
  nombre_programa:    { etiqueta: 'Nombre del programa', clase: 'ancho' },
  fecha:              { etiqueta: 'Fecha', atributos: { type: 'date' } },
  horario:            { etiqueta: 'Horario del Documento Maestro' },
  fecha_inicio:       { etiqueta: 'Inicio' },
  horas_certificadas: { etiqueta: 'Horas certificadas' },
  docente:            { etiqueta: 'Director o docente' },
  pronombre:          { etiqueta: 'Cómo se le nombra', nota: 'Director, Directora o Dirección' },
  precio_pre:         { etiqueta: 'Precio de pre-lanzamiento', atributos: { type: 'number' }, numero: true },
  precio_normal:      { etiqueta: 'Precio normal', atributos: { type: 'number' }, numero: true },
  fase:               { etiqueta: 'Fase de la campaña', opciones: [['pre', 'Pre-lanzamiento (cinco piezas, con sello)'], ['lanzamiento', 'Lanzamiento (tres piezas, sin sello)']] },
  pais_doc:           { etiqueta: 'País del Documento Maestro', opciones: PAIS_DOC },
  pais:               { etiqueta: 'País donde se dicta', opciones: [['CL', 'Chile — las cinco piezas'], ['MX', 'México — solo las de redes'], ['CO', 'Colombia — solo las de redes']] },
  paises:             { etiqueta: 'Países donde se dicta', casillas: CASILLAS_PAIS, clase: 'ancho',
                        nota: 'Cada país suma su bandera con la hora local. Con uno solo, el afiche muestra la fecha grande sin fila de banderas.' },
  docentes:           { etiqueta: 'Docentes (uno por línea)', lineas: true, clase: 'ancho',
                        nota: 'Para la banderita de Sesión Magistral: "Nombre, País".' },
  escuelas:           { etiqueta: 'Escuelas (una por línea)', lineas: true, clase: 'ancho' },
  aprendizajes:       { etiqueta: '¿Qué aprenderás? (uno por línea)', lineas: true, clase: 'ancho',
                        nota: 'Solo en el diseño 2. Si no entran en el bloque, sale vacío y lo completa diseño: nunca se corta el texto.' },
};

const escapar = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Qué diseño está elegido. Cada tipo puede tener uno o dos.
const versionElegida = () => {
  const marcado = version.querySelector('input:checked');
  return marcado ? Number(marcado.value) : 1;
};

function dibujarVersiones() {
  const t = TIPOS.find(x => x.nombre === tipo.value);
  const elegida = t.versiones.includes(versionElegida()) ? versionElegida() : t.versiones[0];
  cajaVersion.hidden = t.versiones.length < 2;
  version.innerHTML = t.versiones.map(v =>
    '<label><input type="radio" name="version" value="' + v + '"' + (v === elegida ? ' checked' : '') +
    '>Diseño ' + v + ' — ' + t.piezas[v].length + (t.piezas[v].length === 1 ? ' pieza' : ' piezas') + '</label>').join('');
}

function dibujar() {
  const t = TIPOS.find(x => x.nombre === tipo.value);
  const campos = versionElegida() === 2 ? [...t.campos, ...t.campos_v2] : t.campos;
  const visibles = campos.filter(c => CAMPOS[c]);
  const ocultos = campos.filter(c => !CAMPOS[c]);

  propios.innerHTML = visibles.map(c => {
    const spec = CAMPOS[c];
    const valor = t.valores[c];
    let control;

    if (spec.casillas) {
      const marcados = Array.isArray(valor) ? valor : [];
      control = '<div class="casillas">' + spec.casillas.map(([v, et]) =>
        '<label><input type="checkbox" data-campo="' + c + '" value="' + v + '"' +
        (marcados.includes(v) ? ' checked' : '') + '>' + et + '</label>').join('') + '</div>';
    } else if (spec.opciones) {
      control = '<select data-campo="' + c + '">' + spec.opciones.map(([v, et]) =>
        '<option value="' + v + '"' + (v === valor ? ' selected' : '') + '>' + et + '</option>').join('') + '</select>';
    } else if (spec.lineas) {
      control = '<textarea data-campo="' + c + '">' + escapar((valor || []).join('\\n')) + '</textarea>';
    } else {
      const atrs = Object.entries(spec.atributos || {}).map(([k, v]) => k + '="' + v + '"').join(' ');
      control = '<input data-campo="' + c + '" ' + atrs + ' value="' + escapar(valor == null ? '' : valor) + '">';
    }

    return '<div class="' + (spec.clase || '') + '"><label>' + spec.etiqueta + '</label>' + control +
      (spec.nota ? '<p class="nota">' + spec.nota + '</p>' : '') + '</div>';
  }).join('') + (ocultos.length
    ? '<p class="nota ancho">Fotos, fondos e ilustraciones (' + ocultos.join(', ') +
      ') salen del ejemplo: todavía no están conectados Drive ni Monday.</p>'
    : '');
}

function reunir() {
  const datos = {};
  for (const el of propios.querySelectorAll('[data-campo]')) {
    const c = el.dataset.campo;
    const spec = CAMPOS[c];
    if (el.type === 'checkbox') {
      if (el.checked) (datos[c] = datos[c] || []).push(el.value);
    } else if (spec.lineas) {
      datos[c] = el.value.split('\\n').map(s => s.trim()).filter(Boolean);
    } else if (spec.numero) {
      datos[c] = Number(el.value);
    } else {
      datos[c] = el.value;
    }
  }
  return datos;
}

// El editable: la misma pieza en SVG, para abrir en Illustrator o Figma.
be.addEventListener('click', async () => {
  b.disabled = bv.disabled = be.disabled = true;
  r.hidden = false;
  r.innerHTML = '<p class="estado">Armando el editable…</p>';

  try {
    const res = await fetch('/editable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: tipo.value, version: versionElegida(), datos: reunir() }),
    });
    const v = await res.json();

    if (!res.ok) {
      r.innerHTML = '<p class="estado error">' + escapar(v.error) + '</p>';
    } else {
      r.innerHTML = '<p class="estado">Editable en ' + (v.ms / 1000).toFixed(1) + ' s</p>' +
        '<div class="grilla"><figure><a href="' + v.url + '" target="_blank">' +
        '<img src="' + v.url + '" alt="' + v.pieza + '"></a>' +
        '<figcaption><b>' + v.pieza + '</b>' + v.ancho + '×' + v.alto + ' · ' +
        '<a href="' + v.url + '" target="_blank">SVG ' + v.kb + ' KB</a>' +
        '<span class="aviso">Para que el texto caiga donde corresponde hace falta ' +
        v.tipografia + ' instalada.</span>' +
        '</figcaption></figure></div>';
    }
  } catch (e) {
    r.innerHTML = '<p class="estado error">' + escapar(e.message) + '</p>';
  } finally {
    b.disabled = bv.disabled = be.disabled = false;
  }
});

// La gráfica animada: la misma pieza vertical, en movimiento. Tarda bastante
// más que las imágenes porque hay que dibujar un cuadro cada treintavo de
// segundo, así que va en su propio botón y no junto con las piezas.
bv.addEventListener('click', async () => {
  b.disabled = bv.disabled = be.disabled = true;
  r.hidden = false;
  r.innerHTML = '<p class="estado">Armando el video… esto tarda cerca de medio minuto.</p>';

  try {
    const res = await fetch('/video', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: tipo.value, version: versionElegida(), datos: reunir() }),
    });
    const v = await res.json();

    if (!res.ok) {
      r.innerHTML = '<p class="estado error">' + escapar(v.error) + '</p>';
    } else {
      r.innerHTML = '<p class="estado">Video en ' + (v.ms / 1000).toFixed(0) + ' s</p>' +
        '<div class="grilla"><figure><video src="' + v.url + '" controls autoplay muted loop></video>' +
        '<figcaption><b>' + v.pieza + '</b>' + v.ancho + '×' + v.alto + ' · ' + v.segundos + 's a ' + v.fps + 'fps · ' +
        '<a href="' + v.url + '" target="_blank">MP4 ' + v.mb + ' MB</a>' +
        (v.animacion === 'generica'
          ? '<span class="aviso">⚠ Con la animación genérica: esta pieza todavía no tiene una propia.</span>'
          : '') +
        '</figcaption></figure></div>';
    }
  } catch (e) {
    r.innerHTML = '<p class="estado error">' + escapar(e.message) + '</p>';
  } finally {
    b.disabled = bv.disabled = be.disabled = false;
  }
});

tipo.addEventListener('change', () => { dibujarVersiones(); dibujar(); });
version.addEventListener('change', dibujar);
dibujarVersiones();
dibujar();

f.addEventListener('submit', async ev => {
  ev.preventDefault();
  b.disabled = bv.disabled = be.disabled = true;
  r.hidden = false;
  r.innerHTML = '<p class="estado">Generando…</p>';

  try {
    const res = await fetch('/piezas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: tipo.value, version: versionElegida(), datos: reunir() }),
    });
    const cuerpo = await res.json();

    if (!res.ok) {
      r.innerHTML = '<p class="estado error">' + escapar(cuerpo.error) + '</p>';
    } else {
      r.innerHTML = '<p class="estado">' + cuerpo.piezas.length + ' piezas, ' +
        cuerpo.archivos + ' archivos en ' + (cuerpo.ms / 1000).toFixed(1) + ' s</p><div class="grilla">' +
        cuerpo.piezas.map(p => {
          // La vista previa es siempre el PNG; el WEBP es la misma imagen.
          const previa = (p.archivos.find(a => a.formato === 'png') || p.archivos[0]).url;
          const enlaces = p.archivos.map(a =>
            '<a href="' + a.url + '" target="_blank">' + a.formato.toUpperCase() + ' ' + a.kb + ' KB</a>').join(' · ');
          return '<figure><a href="' + previa + '" target="_blank"><img src="' + previa + '" alt="' + p.nombre + '"></a>' +
            '<figcaption><b>' + p.nombre + '</b>' + p.ancho + '×' + p.alto + ' · ' + enlaces +
            (p.aviso ? '<span class="aviso">⚠ ' + escapar(p.aviso) + '</span>' : '') + '</figcaption></figure>';
        }).join('') + '</div>';
    }
  } catch (e) {
    r.innerHTML = '<p class="estado error">' + escapar(e.message) + '</p>';
  } finally {
    b.disabled = bv.disabled = be.disabled = false;
  }
});
</script>
`;
