// GET /i/<id>[.webp|.svg] — entrega la pieza ya generada.
//
// El PNG ya existe desde que se pidió la imagen, así que esto responde al
// toque. El WEBP y el SVG se arman la primera vez que alguien los pide y
// quedan guardados.
import { autorizado, servir } from '../servicio.mjs';

export const config = {
  memory: 2048,
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (!autorizado(req)) {
    res.setHeader('www-authenticate', 'Basic realm="piezas"');
    res.status(401).json({ error: 'Usuario o clave incorrectos.' });
    return;
  }
  await servir(req, res, req.query?.archivo || '');
}
