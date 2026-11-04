// Los cuatro países donde se dicta, y la hora local de cada uno.
//
// Esto estaba enterrado dentro del nodo "Armar HTML piezas" de n8n, repetido en
// el nodo "Armar HTML V2". Acá está una sola vez porque lo usan varios tipos de
// pieza.
//
// El país no se agrega a la gráfica como un dato más: cambia lo que se ve. Un
// seminario en Chile muestra una bandera y una hora; el mismo seminario en
// cuatro países muestra cuatro banderas con cuatro horas distintas, y hay que
// convertirlas desde la hora del Documento Maestro.
//
import { R } from './datos.mjs';

export const PAISES = {
  chile:     { cod: 'CL', sigla: 'CHI', zona: 'America/Santiago',               bandera: R.bandera_cl },
  colombia:  { cod: 'CO', sigla: 'COL', zona: 'America/Bogota',                 bandera: R.bandera_co },
  mexico:    { cod: 'MX', sigla: 'MEX', zona: 'America/Mexico_City',            bandera: R.bandera_mx },
  argentina: { cod: 'AR', sigla: 'ARG', zona: 'America/Argentina/Buenos_Aires', bandera: R.bandera_ar },
};

// "México" y "mexico" son el mismo país: se saca el acento y se baja a minúscula.
export const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Los cuatro de arriba son los países donde ADIPA dicta. Un docente, en cambio,
// puede ser de cualquier lado: en Sesión Magistral la bandera que va al lado
// del nombre sale de esta tabla. Las banderas son las provisorias de
// flagcdn.com, igual que en el workflow; un país nuevo se agrega acá.
const CODIGOS_BANDERA = {
  'estados unidos': 'us', 'eeuu': 'us', 'ee.uu.': 'us', 'usa': 'us',
  chile: 'cl', argentina: 'ar', mexico: 'mx', colombia: 'co',
  inglaterra: 'gb-eng',
};

export const banderaDocente = pais => {
  const cod = CODIGOS_BANDERA[norm(pais)];
  if (!cod) {
    throw Object.assign(
      new Error(`País sin bandera configurada: ${pais}. Hay: ${[...new Set(Object.values(CODIGOS_BANDERA))].join(', ')}`),
      { codigo: 400 });
  }
  return `https://flagcdn.com/w160/${cod}.png`;
};

// Acepta el nombre ("Chile"), la sigla ("CHI") o el código ("CL").
export const buscar = p => PAISES[norm(p)]
  || Object.values(PAISES).find(x => x.sigla === String(p).toUpperCase() || x.cod === String(p).toUpperCase());

// Cuánto se corre una zona horaria respecto de UTC en ese instante. Se calcula
// preguntándole al propio sistema, así el horario de verano sale bien solo.
const desfase = (zona, t) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - t;
};

// La fila de banderas del afiche: una por país, con la hora local de cada uno.
//
// `fecha` y `horario` son los del Documento Maestro, que está escrito en la hora
// de un país (`paisBase`). Desde ahí se saca el instante real y de ese instante
// la hora en cada país. Con un solo país, ese país es la base.
export function horarios(paises, fecha, horario, paisBase) {
  const pedidos = (paises || []).map(p => (typeof p === 'object' ? p : buscar(p)));

  const desconocidos = (paises || []).filter((p, i) => !pedidos[i]);
  if (desconocidos.length) {
    throw Object.assign(
      new Error(`País sin configurar: ${desconocidos.join(', ')}. Hay: ${Object.keys(PAISES).join(', ')}`),
      { codigo: 400 });
  }
  if (!pedidos.length) {
    throw Object.assign(new Error('Falta "paises": al menos uno.'), { codigo: 400 });
  }

  // Ya vienen con hora resuelta (por ejemplo, los datos de ejemplo).
  if (pedidos.every(p => p.hora)) return pedidos;

  const base = (paisBase && buscar(paisBase)) || (pedidos.length === 1 ? pedidos[0] : null);
  if (!base) {
    throw Object.assign(
      new Error('Con más de un país hace falta "pais_doc" (CL, MX, CO o AR): de qué país es la hora del Documento Maestro.'),
      { codigo: 400 });
  }

  const [Y, M, D] = String(fecha).split('-').map(Number);
  const [h, mi] = String(horario).trim().split(':').map(Number);
  const local = Date.UTC(Y, M - 1, D, h, mi);
  // Dos pasadas: la primera estima el desfase, la segunda lo corrige si el
  // primer tanteo cayó del otro lado de un cambio de horario de verano.
  let t = local - desfase(base.zona, local);
  t = local - desfase(base.zona, t);

  const horaEn = zona => new Intl.DateTimeFormat('en-GB', {
    timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(t));

  return pedidos.map(p => ({ sigla: p.sigla, hora: horaEn(p.zona), bandera: p.bandera }));
}
