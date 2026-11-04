// GET /i/<id>[.webp|.svg] — entrega la pieza ya generada.
//
// El PNG ya existe desde que se pidió la imagen, así que esto responde al
// toque. El WEBP y el SVG se arman la primera vez que alguien los pide y
// quedan guardados.
//
// No pide usuario ni clave, a propósito: la dirección lleva un identificador
// al azar de 128 bits que no se adivina, igual que hacía htmlcsstoimage, y el
// nodo de n8n que baja la imagen no manda credenciales. Lo que sí se protege
// es el POST que genera, que es el que gasta tiempo de máquina.
import { servir } from '../servicio.mjs';

export const config = {
  memory: 2048,
  maxDuration: 60,
};

export default async function handler(req, res) {
  await servir(req, res, req.query?.archivo || '');
}
