// Monday: de dónde sale el aviso y adónde vuelve el estado.
//
//   node monday.mjs reglas            prueba la lectura de nombres, sin credencial
//   node monday.mjs item <item_id>    lee un ítem de verdad
//
// La parte que decide qué programa es —`interpretar`— no toca la red: son las
// reglas del negocio, escritas como función pura para poder probarlas sin
// credencial y sin tocar el tablero.
//
// Las columnas tienen nombres de máquina (`lookup_mm6471ev`) porque así las
// nombra Monday. Están todas acá arriba para no salir a buscarlas.

import { credencial } from './entorno.mjs';

const API = 'https://api.monday.com/v2';

// El tablero donde diseño pide las piezas: "Diseño Marketing", workspace
// Marketing. Verificado el 4 de noviembre de 2026.
export const TABLERO = '3396579896';

// Las columnas del tablero de Subida.
export const COLUMNAS = {
  doc_maestro: 'lookup_mm6471ev',   // Doc Maestro (espejo): texto con la URL del Google Doc
  carpeta: 'lookup_mm0hr93j',       // Entregable Solicitud Automatizada (espejo): carpeta de Drive
  paises: 'lookup_mm7yy6a5',        // País (espejo), separados por coma
  estado: 'color_mm7rge0',          // Crear Diseño: el estado que dispara y el que devolvemos
  mensaje: 'text_mm7z9eff',         // el aviso o el error que ve diseño
};

// Los estados que escribimos de vuelta. Son etiquetas de la columna, no texto
// libre: si no existen en el tablero, Monday rechaza el cambio.
export const ESTADOS = {
  generando: 'Generando piezas',
  revision: 'Revisión de piezas',
  incompletos: 'Datos incompletos',
  error: 'Error técnico',
};

// Los dos estados que disparan el flujo.
export const DISPARADORES = ['Generar piezas', 'Generar piezas V2'];

// ---------------------------------------------------------------------------
// Las reglas: qué programa es, según el nombre del ítem.
//
// El tipo no está en una columna: está en el prefijo del nombre. El orden de
// las comprobaciones importa, porque "Postítulo de Especialización…" es un
// diplomado y no una especialización: si se mirara primero la palabra
// "especialización", caería en la rama equivocada.
// ---------------------------------------------------------------------------
export function tipoDesdeNombre(nombreItem) {
  let nombre = (nombreItem || '').trim();

  // Hay ítems que llevan "V2" en el prefijo: "[V2 CS CL] Curso: …". Es una
  // etiqueta que le puso una persona, **no** un pedido: qué diseño se genera
  // lo decide el estado de la columna Crear Diseño, no el nombre. Acá el V2
  // solo se saca de en medio para poder leer el tipo que viene atrás.
  nombre = nombre.replace(/^\[\s*V2\s+/i, '[');

  // "Diplo" y "Diplomado" son lo mismo: en el tablero se usan los dos.
  const dip = nombre.match(/^\[\s*(pre-?\s*lanzamiento|lanzamiento)\s+diplo(?:mado)?\b/i);
  const acr = !dip && /^\[\s*(?:pre-?\s*)?lanzamiento\s+acreditaci[oó]n/i.test(nombre);

  // La especialización aparece de dos maneras: con la fase adelante
  // ("[Lanzamiento CL] Especialización …") y sin ella ("[Especialización CL] …").
  // Sin fase no se sabe si las piezas llevan el sello de descuento, así que se
  // reconoce el tipo igual y `interpretar` pide la fase como dato faltante.
  const espConFase = !dip && !acr
    && nombre.match(/^\[\s*(pre-?\s*lanzamiento|lanzamiento)\b[^\]]*\][\s\S]*especializaci[oó]n/i);
  const espSinFase = !dip && !acr && !espConFase && /^\[\s*especializaci[oó]n\b/i.test(nombre);
  const esp = espConFase || espSinFase;

  const prefijo = dip ? 'DIP' : acr ? 'AC' : esp ? 'ESP'
    : (nombre.match(/^\[\s*(SEMINARIO|CS|CA|S\s*MAGISTRAL)\b/i) || [])[1] || '';
  const linea = /^S\s*MAGISTRAL$/i.test(prefijo) ? 'SM' : prefijo.toUpperCase();

  // El nombre del tipo es el del catálogo de `tipos/`: los dos cursos están
  // separados ahí, así que acá también.
  const tipo = linea === 'SEMINARIO' ? 'seminario'
    : linea === 'SM' ? 'sesion'
    : linea === 'ESP' ? 'especializacion'
    : linea === 'DIP' ? 'diplomado'
    : linea === 'AC' ? 'acreditacion'
    : linea === 'CS' ? 'curso-sincronico'
    : linea === 'CA' ? 'curso-asincronico'
    : '';

  // Pre-lanzamiento o lanzamiento, solo donde cambia las piezas. Queda vacío
  // cuando el nombre no lo dice.
  const conFase = dip || espConFase;
  const fase = conFase ? (/^pre/i.test(conFase[1]) ? 'pre' : 'lanzamiento') : '';

  // La sesión magistral se dicta en un país y el prefijo lo dice.
  const pais_sm = tipo === 'sesion'
    ? ((nombre.match(/^\[\s*S\s*MAGISTRAL\s+(CL|MX|CO)\b/i) || [])[1] || 'CL').toUpperCase()
    : '';

  return { tipo, linea, fase, pais_sm };
}

const urlDe = s => ((s || '').match(/https?:\/\/\S+/) || [])[0] || '';

// Un ítem de Monday -> lo que necesita el catálogo para armar las piezas.
//
// Devuelve también `faltan`: la lista de lo que el ítem no trae. Si tiene algo,
// no se genera nada y se le avisa a diseño con el detalle, que es lo que hacía
// el flujo viejo.
export function interpretar(item, { estadoDisparador = '' } = {}) {
  const valor = id => (item.column_values || []).find(c => c.id === id) || {};
  const texto = id => valor(id).display_value || valor(id).text || '';

  const { tipo, linea, fase, pais_sm } = tipoDesdeNombre(item.name);

  const doc = texto(COLUMNAS.doc_maestro);
  const doc_url = urlDe(doc);
  // El Documento Maestro está escrito en la hora de un país, y el prefijo del
  // nombre lo dice: "Documento Maestro CL - …". De ahí sale la hora de los demás.
  const pais_doc = (doc.split(/https?:\/\//)[0].match(/\b(CL|MX|CO|AR)\b/) || [])[1] || '';

  const carpeta_url = urlDe(texto(COLUMNAS.carpeta));
  const paises = texto(COLUMNAS.paises).split(',').map(p => p.trim()).filter(Boolean);

  const faltan = [];
  if (!tipo) {
    faltan.push('tipo de programa: el nombre del ítem tiene que empezar con [SEMINARIO], '
      + '[CS …], [CA …], [S MAGISTRAL …], [Pre-lanzamiento …] / [Lanzamiento …] Especialización, '
      + '[PreLanzamiento Diplo …] / [Lanzamiento Diplo …] o [Lanzamiento Acreditación …]');
  }
  if (!doc_url) faltan.push('Documento Maestro');
  if (!carpeta_url) faltan.push('carpeta de Drive del programa');
  if (tipo === 'seminario' && !paises.length) faltan.push('País');
  if (['especializacion', 'diplomado'].includes(tipo) && !fase) {
    faltan.push('la fase en el nombre del ítem: "[Pre-lanzamiento …]" o "[Lanzamiento …]". '
      + 'De eso depende si las piezas llevan el sello de descuento');
  }
  if (tipo === 'seminario' && paises.length > 1 && !pais_doc) {
    faltan.push('prefijo de país en el nombre del Documento Maestro (CL, MX, CO o AR): '
      + 'con varios países hace falta saber de cuál es la hora');
  }

  return {
    item_id: String(item.id),
    nombre_item: item.name,
    tipo,
    linea,
    fase,
    pais_sm,
    doc_url,
    pais_doc,
    carpeta_id: (carpeta_url.match(/folders\/([^/?#]+)/) || [])[1] || '',
    paises,
    // Qué diseño se genera lo decide el estado, nada más. Un "[V2 …]" en el
    // nombre del ítem es una etiqueta de la persona, no un pedido.
    version: estadoDisparador === 'Generar piezas V2' ? 2 : 1,
    faltan,
  };
}

// El aviso que manda Monday cuando alguien cambia el estado.
//
// El primer pedido de todos no es un aviso: es un desafío para comprobar que
// la dirección existe. Hay que devolverle el mismo `challenge` o Monday no
// registra el webhook.
export function leerAviso(cuerpo) {
  if (cuerpo?.challenge) return { desafio: cuerpo.challenge };
  const ev = cuerpo?.event || {};
  const estado = ev.value?.label?.text || '';
  return {
    board_id: ev.boardId ? String(ev.boardId) : '',
    item_id: ev.pulseId ? String(ev.pulseId) : '',
    estado,
    disparar: DISPARADORES.includes(estado),
  };
}

// ---------------------------------------------------------------------------
// La red
// ---------------------------------------------------------------------------

const clave = () => credencial('MONDAY_API_KEY',
  'se saca en Monday, en tu avatar → Developers → My Access Tokens.');

async function consulta(query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { authorization: clave(), 'content-type': 'application/json', 'api-version': '2024-10' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors || json.error_message) {
    throw new Error(`Monday: ${json.error_message || json.errors.map(e => e.message).join('; ')}`);
  }
  return json.data;
}

// Las columnas espejo no traen su texto en `text`: hay que pedir
// `display_value` con un fragmento, o llegan vacías.
export async function leerItem(itemId) {
  const d = await consulta(`
    query ($ids: [ID!]) {
      items (ids: $ids) {
        id
        name
        column_values {
          id
          text
          ... on MirrorValue { display_value }
        }
      }
    }`, { ids: [String(itemId)] });

  const item = (d.items || [])[0];
  if (!item) throw new Error(`Monday no tiene el ítem ${itemId}.`);
  return item;
}

export async function marcarEstado(boardId, itemId, estado, mensaje = '') {
  if (!Object.values(ESTADOS).includes(estado)) {
    throw new Error(`Estado desconocido: "${estado}". Son: ${Object.values(ESTADOS).join(', ')}`);
  }
  return consulta(`
    mutation ($board: ID!, $item: ID!, $vals: JSON!) {
      change_multiple_column_values (board_id: $board, item_id: $item, column_values: $vals) { id }
    }`, {
    board: String(boardId),
    item: String(itemId),
    vals: JSON.stringify({
      [COLUMNAS.estado]: { label: estado },
      [COLUMNAS.mensaje]: mensaje,
    }),
  });
}

// ---------------------------------------------------------------------------

if (process.argv[1]?.endsWith('monday.mjs')) {
  const [orden, arg] = process.argv.slice(2);

  if (orden === 'item') {
    if (!arg) { console.error('Uso: node monday.mjs item <item_id>'); process.exit(1); }
    try {
      console.log(JSON.stringify(interpretar(await leerItem(arg)), null, 2));
    } catch (e) { console.error(e.message); process.exit(1); }
  } else {
    // Las reglas, contra los nombres tal como se escriben en el tablero.
    const casos = [
      '[SEMINARIO] Intervención en crisis',
      '[CS CL] Curso de evaluación del TEA',
      '[CA MX] Curso de duelo',
      '[S MAGISTRAL MX] Trauma complejo',
      '[S MAGISTRAL] Sin país',
      '[Pre-lanzamiento CL] Especialización en pareja y familia',
      '[Lanzamiento CL] Especialización en pareja y familia',
      '[PreLanzamiento Diplo CL] Intervención psicosocial',
      '[Lanzamiento Diplo CL] Postítulo de Especialización en algo',
      '[Lanzamiento Acreditación CL] Evaluación neuropsicológica',
      'Un ítem sin prefijo',
    ];
    console.log('nombre del ítem'.padEnd(56), 'tipo'.padEnd(18), 'fase'.padEnd(12), 'país');
    for (const n of casos) {
      const r = tipoDesdeNombre(n);
      console.log(n.slice(0, 55).padEnd(56), (r.tipo || '—').padEnd(18), (r.fase || '—').padEnd(12), r.pais_sm || '—');
    }
  }
}
