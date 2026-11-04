// El Documento Maestro: de dónde salen los textos de la campaña.
//
//   node documento.mjs reglas         prueba la lectura de etiquetas, sin credencial
//   node documento.mjs leer <url>     lee un documento de verdad
//
// El documento es un Google Doc que escribe el equipo académico. Los datos no
// están en campos: están marcados en el texto con etiquetas, así:
//
//   [nombre_programa] Intervención en crisis [fin_nombre_programa]
//
// La parte que lee esas etiquetas —`extraerEtiquetas`— no toca la red: se
// puede probar con un documento de mentira, sin credencial.
//
import { pedir } from './google.mjs';

// El texto plano del documento. La API lo devuelve como una lista de párrafos
// partidos en trozos con formato; acá solo interesa el texto.
export function textoPlano(doc) {
  const trozos = [];
  const recorrer = elementos => {
    for (const el of elementos || []) {
      if (el.paragraph) {
        for (const p of el.paragraph.elements || []) {
          if (p.textRun?.content) trozos.push(p.textRun.content);
        }
        trozos.push('\n');
      }
      if (el.table) {
        for (const fila of el.table.tableRows || []) {
          for (const celda of fila.tableCells || []) recorrer(celda.content);
        }
      }
      if (el.tableOfContents) recorrer(el.tableOfContents.content);
    }
  };
  recorrer(doc?.body?.content);
  return trozos.join('');
}

// "$ 590.000" → 590000
const numero = s => parseInt(String(s || '').replace(/[^\d]/g, ''), 10) || 0;

// Las etiquetas sueltas del documento, sin interpretar.
export function etiquetas(texto) {
  const v = {};
  const re = /\[([^\]\n]+)\]([\s\S]*?)\[fin_\1\]/g;
  let m;
  while ((m = re.exec(texto || '')) !== null) v[m[1].trim()] = m[2].trim();
  return v;
}

// El documento -> los datos que pide el catálogo, más lo que falte.
//
// Qué se lee cambia según el tipo: un seminario necesita fecha y horario; una
// especialización, el director y los precios; una sesión magistral tiene a sus
// docentes dentro de [equipo_docente] y no lleva fecha.
export function extraerEtiquetas(texto, { tipo = '', fase = '' } = {}) {
  const v = etiquetas(texto);

  const esCurso = tipo.startsWith('curso');
  const esAsincronico = tipo === 'curso-asincronico';

  // Sesión Magistral: los docentes están anidados dentro de [equipo_docente],
  // porque en el resto del documento [docente_1] aparece con su biografía.
  let fuente = v;
  if (tipo === 'sesion') fuente = etiquetas(v.equipo_docente || '');

  let docentes = [1, 2, 3, 4, 5].map(n => (fuente['docente_' + n] || '').trim()).filter(Boolean);

  // En especialización y diplomado la cara de la pieza es la de quien dirige
  // el programa, no la de los docentes.
  if (tipo === 'especializacion' || tipo === 'diplomado') {
    docentes = [(v.director || v.director_programa || '').trim()].filter(Boolean);
  }
  if (tipo === 'acreditacion') docentes = docentes.slice(0, 1);

  const precio_pre = numero(v['precio_pre-lanzamiento'] || v.precio_prelanzamiento);
  const precio_normal = numero(v.precio_normal);

  // Una institución adicional que el diseño todavía no sabe poner: se avisa
  // para que diseño la agregue a mano. "No aplica" o un guion no cuentan.
  const extra = (v.institucion_adicional1 || '').trim();
  const institucion_extra = extra && !/^\(?\s*no\s+aplica\s*\)?$|^[-–—.]*$/i.test(extra) ? extra : '';

  const faltan = [];
  if (!v.nombre_programa) faltan.push('nombre_programa');

  if (esCurso) {
    if (!esAsincronico && !/^\d{4}-\d{2}-\d{2}/.test(v.fecha_inicio || '')) {
      faltan.push('fecha_inicio con formato AAAA-MM-DD HH:MM');
    }
    if (!/^\d+$/.test((v.horas_certificadas || '').trim())) faltan.push('horas_certificadas, solo el número');
  } else if (tipo === 'seminario') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha || '')) faltan.push('fecha con formato AAAA-MM-DD');
    if (!/^\d{1,2}:\d{2}$/.test(v.horario || '')) faltan.push('horario con formato HH:MM');
  }

  if (tipo === 'diplomado' || tipo === 'acreditacion') {
    const conMesYAño = /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\S]*\b20\d{2}\b|\d{4}-\d{2}-\d{2}/i;
    if (!conMesYAño.test(v.fecha_inicio || '')) {
      faltan.push('fecha_inicio con mes y año, por ejemplo "Viernes 05 de marzo de 2027"');
    }
  }

  if (['especializacion', 'diplomado', 'acreditacion'].includes(tipo)) {
    if (!/^\d+$/.test((v.horas_certificadas || '').trim())) faltan.push('horas_certificadas, solo el número');
    if (fase === 'pre' && !(precio_pre && precio_normal && precio_pre < precio_normal)) {
      faltan.push('precio_pre-lanzamiento y precio_normal, para calcular el % de descuento');
    }
  }

  if (!docentes.length) {
    faltan.push(
      tipo === 'sesion' ? 'al menos un docente dentro de [equipo_docente]'
      : tipo === 'especializacion' ? 'el director del programa, en [director]'
      : tipo === 'diplomado' ? 'el director del programa, en [director_programa]'
      : 'al menos un docente');
  }

  return {
    nombre_programa: v.nombre_programa || '',
    fecha: v.fecha || '',
    horario: v.horario || '',
    fecha_inicio: v.fecha_inicio || '',
    horas_certificadas: (v.horas_certificadas || '').trim(),
    docentes,
    // De acá sale el "¿Qué aprenderás?" del diseño 2 hasta que esté Gemini.
    objetivos_especificos: (v.objetivos_especificos || '').trim(),
    objetivo_general: (v.objetivo_general || '').trim(),
    ...(['especializacion', 'diplomado'].includes(tipo) ? { precio_pre, precio_normal } : {}),
    ...(tipo === 'diplomado' ? { institucion_extra } : {}),
    etiquetas_encontradas: Object.keys(v).length,
    faltan,
  };
}

// La URL del documento -> sus datos.
export async function leerDocumento(url, contexto = {}) {
  const id = (String(url).match(/\/document\/d\/([^/?#]+)/) || [])[1];
  if (!id) throw new Error(`Esa no es la URL de un Google Doc: ${url}`);
  const doc = await pedir(`https://docs.googleapis.com/v1/documents/${id}`);
  return extraerEtiquetas(textoPlano(doc), contexto);
}

// ---------------------------------------------------------------------------

if (process.argv[1]?.endsWith('documento.mjs')) {
  const [orden, arg] = process.argv.slice(2);

  if (orden === 'leer') {
    if (!arg) { console.error('Uso: node documento.mjs leer <url del Google Doc>'); process.exit(1); }
    try {
      console.log(JSON.stringify(await leerDocumento(arg), null, 2));
    } catch (e) { console.error(e.message); process.exit(1); }
  } else {
    // Un documento de mentira, con la forma del de verdad.
    const doc = `
Documento Maestro CL - Seminario

[nombre_programa] Intervención en crisis: herramientas para el abordaje inicial del riesgo suicida [fin_nombre_programa]
[fecha] 2026-11-20 [fin_fecha]
[horario] 19:00 [fin_horario]
[docente_1] Valentina Rojas Mena [fin_docente_1]
[docente_2] Matías Fuenzalida Soto [fin_docente_2]
[objetivos_especificos] Reconocer señales de riesgo. Aplicar un protocolo breve. [fin_objetivos_especificos]
`;
    const sesion = `
[equipo_docente]
  [docente_1] Janina Fisher [fin_docente_1]
  [docente_2] Paula Ibáñez Cerda [fin_docente_2]
[fin_equipo_docente]
[nombre_programa] Trauma complejo y disociación [fin_nombre_programa]
[docente_1] Janina Fisher, PhD, es una de las referentes... [fin_docente_1]
`;
    const diplo = `
[nombre_programa] Intervención psicosocial con infancias vulneradas [fin_nombre_programa]
[director_programa] Ignacio Valdés Moraga [fin_director_programa]
[fecha_inicio] Viernes 05 de marzo de 2027 [fin_fecha_inicio]
[horas_certificadas] 320 [fin_horas_certificadas]
[precio_pre-lanzamiento] $ 890.000 [fin_precio_pre-lanzamiento]
[precio_normal] $ 1.190.000 [fin_precio_normal]
[institucion_adicional1] No aplica [fin_institucion_adicional1]
`;

    for (const [etiqueta, texto, ctx] of [
      ['seminario', doc, { tipo: 'seminario' }],
      ['seminario sin horario', doc.replace(/\[horario\][^[]*\[fin_horario\]/, ''), { tipo: 'seminario' }],
      ['sesión magistral', sesion, { tipo: 'sesion' }],
      ['diplomado pre', diplo, { tipo: 'diplomado', fase: 'pre' }],
      ['diplomado sin precios', diplo.replace(/\[precio[\s\S]*?\[fin_precio_normal\]/, ''), { tipo: 'diplomado', fase: 'pre' }],
    ]) {
      const r = extraerEtiquetas(texto, ctx);
      console.log(`\n--- ${etiqueta} ---`);
      console.log(`  etiquetas: ${r.etiquetas_encontradas}  docentes: ${r.docentes.join(' / ') || '—'}`);
      console.log(`  falta: ${r.faltan.length ? r.faltan.join('; ') : 'nada'}`);
    }
  }
}
