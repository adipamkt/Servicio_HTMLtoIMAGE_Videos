// Lo que comparten todos los tipos de pieza.
//
// Los archivos que empiezan con "_" no son tipos: el catálogo los saltea.

import { corregir } from '../marca.mjs';

// El afiche es una página normal: se le inyectan los datos donde dice __DATOS__.
//
// El < es para que un "<" dentro de un dato no corte el <script>. El
// reemplazo va como función y no como texto para que un "$" en el nombre del
// programa no se lea como un patrón de reemplazo.
export const inyectar = (html, datos) => {
  const json = JSON.stringify(datos).replace(/</g, '\\u003c');
  return corregir(html).replace('__DATOS__', () => json);
};

// Los tipos pagos (especialización, diplomado) arman distintas piezas según la
// fase de la campaña:
//
//   pre-lanzamiento  las tres de redes con el sello de descuento, renombradas
//                    a -PL, más la del catálogo y la de la web
//   lanzamiento      solo las tres de redes, sin sello
//
// El catálogo y la web nunca llevan sello, aunque estemos en pre-lanzamiento, y
// salen en PNG y en WEBP. Acá los formatos no vienen de la plantilla: los fija
// la fase, igual que en el nodo del workflow.
const RRSS = ['1080X1920-RRSS', '1200X1200-RRSS', '1200X628-RRSS'];

export const porFase = (fase, plantillas, datos, ajustar = d => d) => {
  const pre = fase === 'pre';
  const lista = pre
    ? [
        ...RRSS.map(n => [n, n.replace('-RRSS', '-PL'), ['png']]),
        ['1200X1200-CATALOGO', '1200X1200-CATALOGO', ['png', 'webp']],
        ['1200X675-SW', '1200X675-SW', ['png', 'webp']],
      ]
    : RRSS.map(n => [n, n, ['png']]);

  return lista.map(([clave, nombre, formatos]) => {
    const p = plantillas[clave];
    const d = ajustar(RRSS.includes(clave) ? datos : { ...datos, prelanzamiento: false }, clave);
    return { nombre, html: inyectar(p.html, d), w: p.w, h: p.h, formatos };
  });
};

// El % de descuento que va en el sello, solo en pre-lanzamiento.
export const descuento = (fase, pre_, normal) =>
  fase === 'pre' && normal && pre_ ? String(Math.round((1 - pre_ / normal) * 100)) : '';
