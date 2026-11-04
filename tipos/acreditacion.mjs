// Acreditación: las cinco piezas, versión sencilla.
//
// El texto de la certificación lo agrega diseño a mano, así que los campos de
// institución van vacíos a propósito: la plantilla deja el hueco.
//
import { leerNodo, circulo, fondo as degradado, blob } from '../datos.mjs';
import { inyectar } from './_comun.mjs';
import { piezasV2 } from './_v2.mjs';

const { R, plantillas } = leerNodo('Armar HTML acreditación');

export default {
  nombre: 'acreditacion',
  etiqueta: 'Acreditación',
  descripcion: 'Acreditación: afiche vertical, cuadrado, horizontal, catálogo y portada web.',
  campos: ['nombre_programa', 'fecha_inicio', 'horas_certificadas', 'docente', 'foto_docente', 'popup', 'fondo'],

  // El país define qué Documento Maestro se lee: de ahí salen las horas
  // certificadas y la fecha de inicio. La pieza en sí no cambia de forma.
  pais: 'documento',

  // Los dos diseños. La versión 2 son otras dos piezas, no estas cinco.
  versiones: [1, 2],
  campos_v2: ['aprendizajes'],

  ejemplo: {
    nombre_programa: 'Acreditación en evaluación neuropsicológica infantil',
    fecha_inicio: 'Marzo 2027',
    horas_certificadas: '120',
    docente: 'Rodrigo Cáceres Pinto',
    foto_docente: circulo(0xdf, 0xd5, 0xff),
    acreditacion_docente: '',
    institucion: '',
    logo_institucion: '',
    logo_institucion_horizontal: '',
    popup: blob,
    fondo: degradado(1080, 1920, [0x09, 0x1e, 0x42], [0x70, 0x4e, 0xfd]),
    aprendizajes: [
      'Administrar y puntuar las pruebas del protocolo infantil.',
      'Redactar un informe neuropsicológico que la escuela pueda usar.',
      'Devolver resultados a la familia con lenguaje claro.',
    ],
  },

  piezas: datos => {
    if (Number(datos.version) === 2) return piezasV2('acreditacion', datos);

    const d = { ...datos, logo_adipa: R.logo_adipa, icono_calendario: R.icono_calendario };

    return Object.entries(plantillas).map(([nombre, p]) => ({
      nombre,
      // El catálogo no usa el fondo: se omite para que pese menos.
      html: inyectar(p.html, nombre.includes('CATALOGO') ? { ...d, fondo: '' } : d),
      w: p.w,
      h: p.h,
      formatos: p.formatos,
    }));
  },
};
