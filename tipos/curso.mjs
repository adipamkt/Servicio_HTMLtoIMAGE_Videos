// Los cursos: sincrónico y asincrónico.
//
// Son dos productos distintos, no uno con una opción. Comparten el nodo en el
// workflow porque pasan por el mismo camino de datos, pero el diseño es otro:
// el sincrónico dice "¡Interacción en vivo!" y lleva fecha de inicio; el
// asincrónico dice "¡Estudia a tu ritmo!", da acceso por un año y no tiene
// fecha, porque se empieza cuando uno quiere.
//
// Por eso este archivo declara dos tipos y no uno: en el desplegable aparecen
// separados, como están en Monday.
//
// La otra particularidad, que vale para los dos: la pieza del catálogo no
// recibe los mismos datos que las de redes. En redes van los nombres de los
// docentes y los logos de las escuelas; en el catálogo, las fotos de los
// docentes y los escudos.
//
import { leerConstante, circulo, blob } from '../datos.mjs';
import { inyectar } from './_comun.mjs';
import { piezasV2 } from './_v2.mjs';

const NODO = 'Armar HTML curso';
const R = leerConstante(NODO, 'R');
const POR_LINEA = leerConstante(NODO, 'PLANTILLAS_POR_LINEA');

// El nombre de la escuela en Monday → el código de su logo y su escudo.
const CODIGOS = {
  'salud mental adultos': 'SMA',
  'salud mental infantojuvenil': 'SMIJ',
  'psicologia organizacional': 'PO',
  'psicosocial juridica': 'PSJ',
  'educacion y neurodesarrollo': 'EN',
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const codigos = escuelas => (escuelas || [])
  .map(e => CODIGOS[Object.keys(CODIGOS).find(k => norm(e).includes(k))])
  .filter(Boolean)
  .slice(0, 2);

const DOCENTES = [
  { nombre: 'Antonia Pérez Lillo', foto: circulo(0xdf, 0xd5, 0xff) },
  { nombre: 'Cristóbal Aguirre Soto', foto: circulo(0xcb, 0xe8, 0xff) },
];

// Lo que cambia entre una línea y la otra. El resto es idéntico.
const curso = ({ nombre, etiqueta, linea, descripcion, conFecha, ejemplo }) => ({
  nombre,
  etiqueta,
  descripcion,
  campos: [
    'nombre_programa',
    ...(conFecha ? ['fecha_inicio'] : []),
    'horas_certificadas', 'docentes', 'escuelas', 'ilustracion',
  ],

  // El país define qué Documento Maestro se lee: de ahí salen la fecha de
  // inicio y las horas certificadas.
  pais: 'documento',

  versiones: [1, 2],
  campos_v2: ['aprendizajes'],

  ejemplo,

  piezas: datos => {
    // En el diseño 2 cada línea es una clave distinta del mismo juego.
    if (Number(datos.version) === 2) return piezasV2('curso_' + linea, datos);

    // El sincrónico parte la fecha para escribir "12 de Mayo", así que necesita
    // día y mes. Sin esto la pieza sale con "undefined de undefined".
    if (conFecha && !/^\d{4}-\d{2}-\d{2}/.test(String(datos.fecha_inicio || '').trim())) {
      throw Object.assign(
        new Error(`La fecha de inicio va completa, como 2027-05-12 (llegó "${datos.fecha_inicio}"). Diplomado y acreditación sí aceptan "Mayo 2027".`),
        { codigo: 400 });
    }

    const cods = codigos(datos.escuelas);
    const docentes = (datos.docentes || []).slice(0, 2)
      .map(d => (typeof d === 'string' ? { nombre: d, foto: '' } : d));

    const comunes = {
      nombre_programa: datos.nombre_programa,
      fecha_inicio: datos.fecha_inicio,
      horas_certificadas: datos.horas_certificadas,
      ilustracion: datos.ilustracion,
    };

    const rrss = {
      ...comunes,
      modalidad: 'Online',
      docentes: docentes.map(d => d.nombre),
      escuelas: cods.map(c => R['logo_' + c]),
    };

    const catalogo = {
      ...comunes,
      docentes,
      logo_a: R['logo_' + cods[0]],
      escudos: cods.map(c => R['escudo_' + c]),
    };

    return Object.entries(POR_LINEA[linea]).map(([nombrePieza, p]) => ({
      nombre: nombrePieza,
      html: inyectar(p.html, nombrePieza.includes('CATALOGO') ? catalogo : rrss),
      w: p.w,
      h: p.h,
      formatos: p.formatos,
    }));
  },
});

export default [
  curso({
    nombre: 'curso-sincronico',
    etiqueta: 'Curso sincrónico',
    linea: 'CS',
    descripcion: 'Curso sincrónico: clases en vivo, con fecha de inicio.',
    conFecha: true,
    ejemplo: {
      nombre_programa: 'Curso de evaluación y manejo del trastorno del espectro autista',
      // Acá la fecha va completa, no "Mayo 2027" como en diplomado: la
      // plantilla la parte para escribir "12 de Mayo".
      fecha_inicio: '2027-05-12',
      horas_certificadas: '60',
      docentes: DOCENTES,
      escuelas: ['Salud Mental Infantojuvenil'],
      ilustracion: blob,           // el 1200X1200-POPUP
      aprendizajes: [
        'Aplicar los instrumentos de screening y confirmación diagnóstica.',
        'Diseñar apoyos para el aula y para la familia.',
      ],
    },
  }),

  curso({
    nombre: 'curso-asincronico',
    etiqueta: 'Curso asincrónico',
    linea: 'CA',
    descripcion: 'Curso asincrónico: a su ritmo, con un año de acceso al aula.',
    conFecha: false,
    ejemplo: {
      nombre_programa: 'Curso de evaluación y manejo del trastorno del espectro autista',
      horas_certificadas: '60',
      docentes: DOCENTES,
      escuelas: ['Salud Mental Infantojuvenil'],
      ilustracion: blob,
      // El asincrónico admite un solo aprendizaje, y de 247 caracteres.
      aprendizajes: ['Aplicar los instrumentos de screening y diseñar apoyos para el aula.'],
    },
  }),
];
