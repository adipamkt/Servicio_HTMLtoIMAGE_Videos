// Especialización: las piezas cambian según la fase de la campaña.
//
// En pre-lanzamiento son cinco y las de redes llevan el sello con el % de
// descuento; en lanzamiento son tres y sin sello. El % se calcula con los dos
// precios del Documento Maestro, y el Documento Maestro es de un país: ahí
// entra el país en este tipo.
//
import { leerNodo, circulo, blob } from '../datos.mjs';
import { inyectar, porFase, descuento } from './_comun.mjs';
import { piezasV2 } from './_v2.mjs';

const { R, plantillas } = leerNodo('Armar HTML especialización');

// El nombre de la escuela en Monday → el logo incrustado en el nodo.
const CODIGOS = {
  'salud mental adultos': 'SMA',
  'salud mental infantojuvenil': 'SMIJ',
  'psicologia organizacional': 'PO',
  'psicosocial juridica': 'PSJ',
  'educacion y neurodesarrollo': 'EN',
};
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const logosEscuela = escuelas => (escuelas || [])
  .map(e => CODIGOS[Object.keys(CODIGOS).find(k => norm(e).includes(k))])
  .filter(Boolean)
  .slice(0, 2)
  .map(c => R['logo_' + c]);

export default {
  nombre: 'especializacion',
  etiqueta: 'Especialización',
  descripcion: 'Especialización: tres piezas de redes en lanzamiento, cinco con sello de descuento en pre-lanzamiento.',
  campos: ['nombre_programa', 'docente', 'pronombre', 'horas_certificadas', 'fase', 'precio_pre', 'precio_normal', 'escuelas', 'foto_docente', 'popup'],

  pais: 'documento',

  // Los dos diseños. La versión 2 son dos piezas y no depende de la fase.
  versiones: [1, 2],
  campos_v2: ['aprendizajes'],

  ejemplo: {
    nombre_programa: 'Especialización en psicoterapia de pareja y familia',
    docente: 'Francisca Donoso Ruiz',
    pronombre: 'Directora',
    horas_certificadas: '200',
    fase: 'pre',                 // 'pre' o 'lanzamiento'
    precio_pre: 590000,
    precio_normal: 790000,
    escuelas: ['Salud Mental Adultos'],
    foto_docente: circulo(0xdf, 0xd5, 0xff),
    popup: blob,
    aprendizajes: [
      'Conducir una primera sesión de pareja sin tomar partido.',
      'Intervenir en crisis de pareja con foco en el vínculo.',
    ],
  },

  piezas: datos => {
    if (Number(datos.version) === 2) return piezasV2('especializacion', datos);

    const d = {
      ...datos,
      escuelas: logosEscuela(datos.escuelas),
      prelanzamiento: datos.fase === 'pre',
      descuento: descuento(datos.fase, datos.precio_pre, datos.precio_normal),
      logo_adipa: R.logo_adipa,
    };
    return porFase(datos.fase, plantillas, d);
  },
};
