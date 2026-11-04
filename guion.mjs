// El guion de la locución, armado desde los mismos datos que el afiche.
//
// Se parte en tramos y no en un texto corrido a propósito: cada tramo se graba
// por separado, así se sabe el segundo exacto en que empieza y termina cada
// frase. Esos tiempos son los que después mueven la animación, y por eso cada
// elemento del afiche entra justo cuando la voz lo nombra.
//
// El `id` de cada tramo es el que busca animacion.js.
//
//   node guion.mjs    → escribe salida/guion.json
//
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { datos } from './datos.mjs';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "19:00" → "19 horas"; "19:30" → "19 y 30". Escrito así porque el sintetizador
// lee "19:00" como una cifra y suena raro.
const enPalabras = hhmm => {
  const [h, m] = hhmm.trim().split(':').map(Number);
  return m ? `${h} y ${m}` : `${h} horas`;
};

export function guion(d) {
  const [, mm, dd] = d.fecha.split('-').map(Number);
  const cuando = `el ${dd} de ${MESES[mm - 1]}`;
  // Con varios países cada uno tiene su hora, así que la voz solo dice la fecha.
  const paises = d.paises || [];
  const hora = paises.length > 1 ? '' : `, a las ${enPalabras(d.horario)}`;

  const nombres = d.docentes.filter(x => x.nombre && x.nombre.trim()).map(x => x.nombre.trim());

  const tramos = [
    { id: 'intro', texto: 'ADIPA te invita a participar en un seminario online gratuito:' },
    { id: 'titulo', texto: d.nombre_programa.trim().replace(/\s*[.:]\s*$/, '') + '.' },
  ];

  // Un tramo por docente: así cada foto aparece cuando se dice ese nombre.
  nombres.forEach((nombre, i) => {
    tramos.push({
      id: `docente${i}`,
      texto: i === 0
        ? `Impartido por ${nombre}${nombres.length === 1 ? '.' : ','}`
        : `${i === nombres.length - 1 ? 'y ' : ''}${nombre}${i === nombres.length - 1 ? '.' : ','}`,
    });
  });

  tramos.push({ id: 'fecha', texto: `Participa ${cuando}${hora}` });
  tramos.push({ id: 'cierre', texto: 'y recibe tu certificado de participación.' });

  return tramos;
}

// Ejecutado directo: deja el guion en disco para que lo lea voz.ps1.
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const tramos = guion(datos);
  fs.mkdirSync('salida', { recursive: true });
  fs.writeFileSync('salida/guion.json', JSON.stringify(tramos, null, 2));
  for (const t of tramos) console.log(`${t.id.padEnd(10)} ${t.texto}`);
}
