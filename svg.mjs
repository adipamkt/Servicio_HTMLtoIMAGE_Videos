// La versión editable desde la línea de comandos.
//
//   node svg.mjs                       el seminario, su afiche vertical
//   node svg.mjs diplomado             otro tipo del catálogo
//   node svg.mjs seminario 1200X1200-RRSS   otra pieza
//
// Es la misma pieza que sale en PNG. Se abre en Illustrator o en Figma y se
// puede corregir una tilde, mover un bloque o cambiar un color sin volver a
// generar nada.
//
import fs from 'node:fs';
import path from 'node:path';
import { renderizarSvg } from './piezas.mjs';
import { cerrar } from './navegador.mjs';

// ---------------------------------------------------------------------------

if (process.argv[1]?.endsWith('svg.mjs')) {
  const [tipo = 'seminario', pieza = null] = process.argv.slice(2);
  const SALIDA = 'salida/editables';

  try {
    const v = await renderizarSvg(tipo, { pieza });

    fs.mkdirSync(SALIDA, { recursive: true });
    const archivo = path.resolve(SALIDA, `${tipo}-${v.pieza}.svg`);
    fs.writeFileSync(archivo, v.svg);

    const texto = v.svg.toString('utf8');
    console.log(`${v.pieza}  ${v.ancho}x${v.alto}  ${(v.svg.length / 1024).toFixed(0)} KB  ${v.ms} ms`);
    console.log(`${(texto.match(/<text /g) || []).length} textos, `
      + `${(texto.match(/<rect /g) || []).length} rectángulos, `
      + `${(texto.match(/<image /g) || []).length} imágenes`);
    console.log(`→ ${archivo}`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    // Si no se cierra, el navegador queda abierto y el proceso nunca termina.
    await cerrar();
  }
}
