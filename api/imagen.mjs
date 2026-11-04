// POST /v1/image — la función que atiende a n8n en Vercel.
//
// Es la misma que corre en la máquina: toda la lógica está en `servicio.mjs`.
// Acá solo se la envuelve en la forma que pide Vercel.
import { autorizado, generar } from '../servicio.mjs';

export const config = {
  // Chrome necesita memoria; con menos de 1 GB se cae en piezas grandes.
  memory: 2048,
  // Arrancar Chrome en frío son unos segundos. 60 da margen de sobra.
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Usá POST.' });
    return;
  }
  if (!autorizado(req)) {
    res.setHeader('www-authenticate', 'Basic realm="piezas"');
    res.status(401).json({ error: 'Usuario o clave incorrectos.' });
    return;
  }
  await generar(req, res);
}
