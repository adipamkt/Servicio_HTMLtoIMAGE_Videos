// Genera las piezas desde la línea de comandos, sin levantar el servidor.
//
//   node imagen.mjs                      todas las piezas del seminario
//   node imagen.mjs curso-sincronico     las de otro tipo del catálogo
//   node imagen.mjs seminario 1080X1920-RRSS   una sola pieza
//
// El render es el mismo que usa el servidor (render.mjs): esto es solo la
// cáscara para probar a mano y ver los tiempos.
//
import fs from 'node:fs';
import path from 'node:path';
import { renderizar } from './piezas.mjs';
import { cerrar } from './navegador.mjs';
import { listar } from './tipos/index.mjs';

const SALIDA = 'salida/piezas';
const [tipo = 'seminario', ...soloPiezas] = process.argv.slice(2);

fs.mkdirSync(SALIDA, { recursive: true });

const t = Date.now();
let piezas;
try {
  piezas = await renderizar(tipo, {}, soloPiezas);
} catch (e) {
  console.error(e.message);
  console.error(`\nTipos en el catálogo: ${listar().map(x => x.nombre).join(', ')}`);
  process.exit(1);
}

let archivos = 0;
for (const p of piezas) {
  const pesos = p.archivos.map(a => {
    fs.writeFileSync(path.resolve(SALIDA, `${p.nombre}.${a.formato}`), a.bytes);
    archivos++;
    return `${a.formato} ${(a.bytes.length / 1024).toFixed(0)} KB`;
  });
  console.log(`${p.nombre.padEnd(20)} ${String(p.ancho).padStart(4)}x${String(p.alto).padEnd(4)}  ${pesos.join(' + ').padEnd(24)} ${p.ms} ms`);
  if (p.aviso) console.log(`${' '.repeat(20)} ⚠ ${p.aviso}`);
}
console.log(`\n${piezas.length} piezas, ${archivos} archivos en ${((Date.now() - t) / 1000).toFixed(1)} s  →  ${SALIDA}/`);

// Si no se cierra, el navegador queda abierto y el proceso puede no terminar.
await cerrar();
