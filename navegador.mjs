// El navegador que dibuja las piezas.
//
// Es un solo camino para los dos lugares donde corre el servicio: la máquina,
// donde usa el Chrome que ya está instalado, y Vercel, donde no hay ninguno y
// usa el que viene empaquetado en `@sparticuz/chromium`.
//
// Antes esto se hacía lanzando `chrome.exe --screenshot` y leyendo el archivo
// que dejaba. Funcionaba, pero en Vercel no hay un Chrome que lanzar ni un
// disco donde dejar el archivo. Manejándolo por su protocolo de control se
// resuelven las dos cosas, y de paso:
//
//   - el WEBP sale del propio Chrome y FFmpeg deja de hacer falta;
//   - el SVG se arma leyendo la página en vez del truco de `--dump-dom`;
//   - se puede reusar el navegador entre piezas, que es casi todo el tiempo
//     de un render en frío.
//
import fs from 'node:fs';
import os from 'node:os';
import puppeteer from 'puppeteer-core';

const EN_VERCEL = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Dónde está Chrome en esta máquina. Se puede forzar con la variable CHROME.
const CANDIDATOS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${os.homedir()}/AppData/Local/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export const CHROME_LOCAL = CANDIDATOS.find(c => c && fs.existsSync(c));

// Un solo navegador para todas las piezas. Arrancarlo es lo que más tarda, así
// que se deja abierto: en Vercel la función se reusa entre llamadas y eso
// convierte un arranque en frío de varios segundos en uno solo.
let navegador = null;

async function abrir() {
  if (navegador?.connected) return navegador;

  if (EN_VERCEL) {
    const { default: chromium } = await import('@sparticuz/chromium');
    navegador = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    if (!CHROME_LOCAL) {
      throw new Error('No se encontró Chrome. Instalalo, o definí la variable CHROME con la ruta al ejecutable.');
    }
    navegador = await puppeteer.launch({
      executablePath: CHROME_LOCAL,
      headless: true,
      args: ['--disable-gpu', '--hide-scrollbars', '--no-sandbox'],
    });
  }
  return navegador;
}

export async function cerrar() {
  if (navegador?.connected) await navegador.close();
  navegador = null;
}

// Abre el HTML en una página del tamaño pedido y te la deja lista para
// trabajar. Cierra la página pase lo que pase.
//
// `espera` son los milisegundos que pedía htmlcsstoimage con `ms_delay`: se
// respetan como margen extra después de que la página dijo que terminó.
export async function conPagina(html, ancho, alto, tarea, { espera = 0 } = {}) {
  const nav = await abrir();
  const pagina = await nav.newPage();

  try {
    await pagina.setViewport({ width: ancho, height: alto, deviceScaleFactor: 1 });

    // networkidle0: espera a que no queden pedidos en curso, que es lo que
    // hace falta para que la tipografía de Google llegue antes de medir.
    await pagina.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // La tipografía puede estar descargada pero todavía no aplicada. Sin esto
    // el texto se mide con la de reserva y los renglones salen cortados en
    // otro lado.
    await pagina.evaluate(() => document.fonts?.ready);

    if (espera > 0) await new Promise(listo => setTimeout(listo, Math.min(espera, 5000)));

    return await tarea(pagina);
  } finally {
    await pagina.close().catch(() => {});
  }
}
