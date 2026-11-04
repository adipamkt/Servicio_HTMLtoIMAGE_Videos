// Seminario gratuito: las cinco piezas de una campaña.
//
// El diseño no se copia acá: se lee del export de n8n (ver datos.mjs), así los
// afiches y el video siempre usan la misma plantilla. Los colores se corrigen
// antes de renderizar porque la plantilla de n8n trae hex aproximados.
//
// El país cambia la pieza: el seminario se dicta en varios países a la vez y
// el afiche muestra una bandera y una hora local por cada uno. Con un país se
// ve una sola; con cuatro, cuatro horas distintas.
//
import { plantillas, datos as ejemplo } from '../datos.mjs';
import { horarios } from '../paises.mjs';
import { inyectar } from './_comun.mjs';
import { piezasV2 } from './_v2.mjs';

// Un docente puede llegar solo con el nombre: la foto la pone Monday y todavía
// no está conectado. Mientras tanto se le presta una de las del ejemplo para
// que el afiche no quede con un hueco.
const conFoto = docentes => docentes.map((d, i) => ({
  ...(typeof d === 'string' ? { nombre: d } : d),
  foto: (typeof d === 'object' && d.foto) || ejemplo.docentes[i % ejemplo.docentes.length].foto,
}));

export default {
  nombre: 'seminario',
  etiqueta: 'Seminario',
  descripcion: 'Seminario gratuito: afiche vertical, cuadrado, horizontal, portada web y YouTube.',
  campos: ['nombre_programa', 'fecha', 'horario', 'docentes', 'paises', 'pais_doc', 'doodle'],

  // Cómo entra el país en este tipo: todos los países van dentro de la misma
  // pieza, como fila de banderas con la hora local de cada uno.
  pais: 'lista',

  // Los dos diseños. La versión 2 son otras dos piezas, no estas cinco.
  versiones: [1, 2],
  campos_v2: ['aprendizajes'],

  ejemplo: {
    ...ejemplo,
    aprendizajes: [
      'Reconocer señales de riesgo suicida en la primera entrevista.',
      'Aplicar un protocolo breve de contención y derivación.',
    ],
  },

  piezas: datos => {
    if (Number(datos.version) === 2) return piezasV2('seminario', datos);

    const paises = horarios(datos.paises, datos.fecha, datos.horario, datos.pais_doc);
    const d = {
      ...datos,
      docentes: conFoto(datos.docentes ?? ejemplo.docentes),
      paises,
      horario: paises[0].hora,   // el bloque grande muestra la hora del primer país
      bandera: paises[0].bandera,
    };
    return Object.entries(plantillas).map(([nombre, p]) => ({
      nombre,
      html: inyectar(p.html, d),
      w: p.w,
      h: p.h,
      formatos: p.formatos,
    }));
  },
};
