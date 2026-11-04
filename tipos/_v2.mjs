// La versión 2: el segundo diseño, el que tienen todos los productos.
//
// No es otro tipo de programa: es otro diseño del mismo. Un seminario tiene su
// afiche de la versión 1 y su afiche de la versión 2, con los mismos datos
// puestos de otra manera. Por eso vive acá y no en un archivo de tipo: cada
// tipo le delega cuando le piden `version: 2`.
//
// Son dos piezas, no cinco: la cuadrada de feed y la vertical de historias.
//
import { leerConstante } from '../datos.mjs';
import { horarios, banderaDocente } from '../paises.mjs';
import { inyectar } from './_comun.mjs';

const NODO = 'Armar HTML V2';

const R = leerConstante(NODO, 'R');
const CUADRADA = leerConstante(NODO, 'PLANTILLAS');
const HISTORIA = leerConstante(NODO, 'PLANTILLAS_H');

// "¿Qué aprenderás?": cuántos aprendizajes entran y con cuántos caracteres en
// total. Salen del PDF de variables de la V2 y cambian según el tipo, porque
// el bloque ocupa un lugar distinto en cada diseño. Se tolera un 10 % de más
// (la plantilla achica la letra); pasado eso el bloque sale vacío y lo
// completa diseño a mano, porque es preferible un hueco a un texto cortado.
const LIMITES = {
  seminario: [295, 2],
  curso_CS: [306, 2],
  curso_CA: [247, 1],
  diplomado: [402, 2],
  acreditacion: [277, 3],
  especializacion: [301, 2],
  sesion: [354, 3],
};

// En la versión 2 las banderas son rectangulares, no los círculos de la V1.
const CON_BANDERA_RECTANGULAR = {
  CHI: 'https://flagcdn.com/w160/cl.png',
  COL: 'https://flagcdn.com/w160/co.png',
  MEX: 'https://flagcdn.com/w160/mx.png',
  ARG: 'https://flagcdn.com/w160/ar.png',
};

// Los logos de escuela, igual que en la versión 1.
const CODIGOS = {
  'salud mental adultos': 'SMA',
  'salud mental infantojuvenil': 'SMIJ',
  'psicologia organizacional': 'PO',
  'psicosocial juridica': 'PSJ',
  'educacion y neurodesarrollo': 'EN',
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const clavesV2 = Object.keys(CUADRADA);

export const limiteV2 = clave => LIMITES[clave] || [295, 2];

// Los aprendizajes que entran en el diseño. Devuelve [] si no entran, como
// hace el workflow: nunca texto recortado.
export function aprendizajesV2(clave, aprendizajes) {
  const [maxCar, maxAp] = limiteV2(clave);
  const lista = (aprendizajes || []).map(a => String(a).trim()).filter(Boolean);

  if (!lista.length) return { aprendizajes: [], aviso: 'no hay aprendizajes escritos' };
  if (lista.length > maxAp) return { aprendizajes: [], aviso: `son ${lista.length} aprendizajes y entran ${maxAp}` };

  const total = lista.join('').length;
  if (total > Math.floor(maxCar * 1.1)) {
    return { aprendizajes: [], aviso: `son ${total} caracteres y entran ${maxCar}` };
  }
  return { aprendizajes: lista, aviso: '' };
}

// Las dos piezas de la versión 2 para un tipo.
//
// `clave` es el tipo tal como lo nombra el nodo: los cursos se separan por
// línea (curso_CS y curso_CA), el resto se llama igual que el tipo.
export function piezasV2(clave, datos) {
  const cuadrada = CUADRADA[clave];
  if (!cuadrada) {
    throw Object.assign(
      new Error(`La versión 2 todavía no está para "${clave}". Está para: ${clavesV2.join(', ')}`),
      { codigo: 400 });
  }

  const { aprendizajes, aviso } = aprendizajesV2(clave, datos.aprendizajes);

  const d = {
    nombre_programa: datos.nombre_programa,
    fecha: datos.fecha,
    fecha_inicio: datos.fecha_inicio,
    paises: [],
    escuelas: [],
    docentes: [],
    aprendizajes,
    logo_adipa: R.logo_adipa,
  };

  if (clave === 'seminario') {
    d.paises = horarios(datos.paises, datos.fecha, datos.horario, datos.pais_doc)
      .map(p => ({ ...p, bandera: CON_BANDERA_RECTANGULAR[p.sigla] || p.bandera }));
  }

  if (clave === 'sesion') {
    // La sesión trae las fotos en una sola imagen (el 1200X1200-POPUP) y los
    // docentes con su banderita, igual que en la versión 1.
    d.docentes = (datos.docentes || []).slice(0, 3).map(x => {
      const o = typeof x === 'string'
        ? { nombre: x.split(',')[0].trim(), pais: x.split(',').slice(1).join(',').trim() }
        : x;
      return { nombre: o.nombre, bandera: o.bandera || (o.pais ? banderaDocente(o.pais) : '') };
    });
    d.fotos = datos.fotos;
    d.logo_psy = R.logo_psy;
  } else {
    d.docentes = (datos.docentes || []).slice(0, 2).map(x => (
      typeof x === 'string' ? { nombre: x, foto: '' } : { nombre: x.nombre, foto: x.foto || '' }));
  }

  if (clave.startsWith('curso')) {
    d.escuelas = (datos.escuelas || [])
      .map(e => CODIGOS[Object.keys(CODIGOS).find(k => norm(e).includes(k))])
      .filter(Boolean).slice(0, 2).map(c => R['logo_' + c]);
  }

  // Diplomado, especialización y acreditación muestran una sola persona: quien
  // dirige el programa.
  if (['diplomado', 'especializacion', 'acreditacion'].includes(clave)) {
    d.docente = { nombre: datos.docente || '', foto: datos.foto_docente || '' };
    d.pronombre = datos.pronombre || '';
  }

  const piezas = [{ nombre: '1200X1200-RRSS-V2', plantilla: cuadrada }];
  if (HISTORIA[clave]) piezas.push({ nombre: '1080X1920-RRSS-V2', plantilla: HISTORIA[clave] });

  return piezas.map(({ nombre, plantilla }) => ({
    nombre,
    html: inyectar(plantilla.html, d),
    w: plantilla.w,
    h: plantilla.h,
    ...(aviso ? { aviso: `"¿Qué aprenderás?" salió vacío porque ${aviso}. Lo completa diseño a mano.` } : {}),
  }));
}
