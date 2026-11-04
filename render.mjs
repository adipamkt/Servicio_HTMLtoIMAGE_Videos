// Motor de render: HTML -> imagen.
//
// Dibuja la página con Chrome y la captura. Es lo mismo que hacía
// htmlcsstoimage —Chrome en un servidor ajeno— pero sin el viaje de ida y
// vuelta y sin costo por imagen.
//
// Quién maneja ese Chrome está en `navegador.mjs`: el instalado en la máquina
// cuando corre acá, el empaquetado cuando corre en Vercel. Acá solo se pide la
// captura.
//
// El WEBP se arma a partir del PNG, sin pérdida: es la misma imagen pixel por
// pixel y en estos diseños planos pesa menos de la mitad. Antes lo hacía
// FFmpeg, que en Vercel no existe. El WEBP que da Chrome directo no sirve acá:
// es con pérdida y en dibujos planos sale más pesado que el PNG.
//
import sharp from 'sharp';
import { conPagina } from './navegador.mjs';

// Una página HTML -> los archivos de esa pieza, en memoria.
//
// `formatos` es lo que pide la plantilla: ['png'] o ['png', 'webp'].
export async function capturar(html, ancho, alto, formatos = ['png'], { espera = 0 } = {}) {
  const desconocido = formatos.find(f => !['png', 'webp'].includes(f));
  if (desconocido) throw new Error(`Formato de salida desconocido: ${desconocido}`);

  return conPagina(html, ancho, alto, async pagina => {
    // Una sola captura, y de ahí salen los formatos que se pidan.
    const png = await pagina.screenshot({ type: 'png', optimizeForSpeed: false });

    const archivos = [];
    for (const formato of formatos) {
      archivos.push({
        formato,
        bytes: formato === 'png' ? png : await sharp(png).webp({ lossless: true }).toBuffer(),
      });
    }
    return archivos;
  }, { espera });
}
