// Diplomado y postítulo: igual que especialización en cuanto a fases, pero con
// dos ilustraciones —una horizontal y una vertical opcional— en vez de los
// logos de escuela.
//
import { leerNodo, circulo, fondo as degradado } from '../datos.mjs';
import { porFase, descuento } from './_comun.mjs';
import { piezasV2 } from './_v2.mjs';

const { R, plantillas } = leerNodo('Armar HTML diplomado');

export default {
  nombre: 'diplomado',
  etiqueta: 'Diplomado',
  descripcion: 'Diplomado o postítulo: tres piezas de redes en lanzamiento, cinco con sello de descuento en pre-lanzamiento.',
  campos: ['nombre_programa', 'fecha_inicio', 'horas_certificadas', 'docente', 'pronombre', 'fase', 'precio_pre', 'precio_normal', 'foto_docente', 'popup', 'popup_vertical'],

  pais: 'documento',

  // Los dos diseños. La versión 2 son dos piezas y no depende de la fase.
  versiones: [1, 2],
  campos_v2: ['aprendizajes'],

  ejemplo: {
    nombre_programa: 'Diplomado en intervención psicosocial con infancias vulneradas',
    fecha_inicio: 'Abril 2027',
    horas_certificadas: '320',
    docente: 'Ignacio Valdés Moraga',
    pronombre: 'Director',
    fase: 'pre',                 // 'pre' o 'lanzamiento'
    precio_pre: 890000,
    precio_normal: 1190000,
    foto_docente: circulo(0xcb, 0xe8, 0xff),
    // Las dos ilustraciones van a sangre, con object-fit: cover. El marcador
    // tiene que ser opaco y del alto correcto: uno con bordes transparentes
    // deja ver el negro de la página donde todavía no hay ilustración.
    popup: degradado(1920, 1080, [0x70, 0x4e, 0xfd], [0x2c, 0xb7, 0xff]),
    popup_vertical: degradado(1080, 1920, [0x70, 0x4e, 0xfd], [0xcb, 0xe8, 0xff]),
    aprendizajes: [
      'Diseñar un plan de intervención psicosocial con enfoque de derechos.',
      'Coordinar el trabajo en red con escuela, salud y tribunales.',
    ],
  },

  piezas: datos => {
    if (Number(datos.version) === 2) return piezasV2('diplomado', datos);

    const d = {
      ...datos,
      prelanzamiento: datos.fase === 'pre',
      descuento: descuento(datos.fase, datos.precio_pre, datos.precio_normal),
      logo_adipa: R.logo_adipa,
      icono_calendario: R.icono_calendario,
    };

    // La portada de la web va sin la ilustración vertical ni la foto: es
    // apaisada y no hay lugar para ninguna de las dos.
    return porFase(datos.fase, plantillas, d, (dat, clave) =>
      clave === '1200X675-SW' ? { ...dat, popup_vertical: '', foto_docente: '' } : dat);
  },
};
