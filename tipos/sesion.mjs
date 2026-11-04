// Sesión Magistral: las cinco piezas, con fondo de foto y logo de psychotherapy.net.
//
// Es el tipo donde el país manda más: la sesión se dicta en un país y solo en
// ese. En Chile salen las cinco piezas; en México y Colombia salen únicamente
// las tres de redes, porque el catálogo y la portada de la web son del sitio
// chileno. Las de redes van después a la carpeta de Drive de cada país.
//
// Ojo: el país del docente es otra cosa, y es la banderita que va al lado de
// su nombre. Un docente de sesión magistral puede ser de cualquier país.
//
import { leerNodo, fondo as degradado, blob } from '../datos.mjs';
import { banderaDocente } from '../paises.mjs';
import { inyectar } from './_comun.mjs';
import { piezasV2 } from './_v2.mjs';

const { R, plantillas } = leerNodo('Armar HTML sesión');

const SOLO_RRSS = nombre => /-RRSS$/.test(nombre);

// Un docente puede venir como objeto { nombre, pais } o como "Nombre, País".
const normalizar = d => {
  const o = typeof d === 'string'
    ? { nombre: d.split(',')[0].trim(), pais: d.split(',').slice(1).join(',').trim() }
    : d;
  return { nombre: o.nombre, bandera: o.bandera || (o.pais ? banderaDocente(o.pais) : '') };
};

export default {
  nombre: 'sesion',
  etiqueta: 'Sesión magistral',
  descripcion: 'Sesión Magistral: afiche vertical, cuadrado, horizontal, catálogo y portada web.',
  campos: ['nombre_programa', 'pais', 'docentes', 'fotos', 'fondo'],

  // Un país por pieza. CL arma las cinco; MX y CO, solo las tres de redes.
  pais: 'uno',

  // Los dos diseños. La versión 2 son otras dos piezas, no estas cinco.
  versiones: [1, 2],
  campos_v2: ['aprendizajes'],

  ejemplo: {
    nombre_programa: 'Trauma complejo y disociación: abordajes actuales en psicoterapia',
    pais: 'CL',
    docentes: [
      { nombre: 'Janina Fisher', pais: 'Estados Unidos' },
      { nombre: 'Paula Ibáñez Cerda', pais: 'Chile' },
    ],
    fotos: blob,                                        // el 1200X1200-POPUP
    fondo: degradado(1080, 1920, [0x70, 0x4e, 0xfd], [0x2c, 0xb7, 0xff]),
    aprendizajes: [
      'Distinguir trauma simple de trauma complejo en la clínica.',
      'Trabajar la disociación sin retraumatizar a la persona.',
      'Ordenar la terapia en fases, con criterios de avance.',
    ],
  },

  piezas: datos => {
    if (Number(datos.version) === 2) return piezasV2('sesion', datos);

    const pais = String(datos.pais || 'CL').toUpperCase();
    const d = {
      ...datos,
      docentes: (datos.docentes || []).slice(0, 3).map(normalizar),
      logo_adipa: R.logo_adipa,
      logo_psy: R.logo_psy,
    };

    return Object.entries(plantillas)
      .filter(([nombre]) => pais === 'CL' || SOLO_RRSS(nombre))
      .map(([nombre, p]) => ({
        nombre,
        // El catálogo no usa el fondo: se omite para que pese menos.
        html: inyectar(p.html, nombre.includes('CATALOGO') ? { ...d, fondo: '' } : d),
        w: p.w,
        h: p.h,
        formatos: p.formatos,
      }));
  },
};
