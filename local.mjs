// El servicio corriendo en la máquina.
//
//   node local.mjs            http://localhost:3000
//   PUERTO=4000 node local.mjs
//
// En Vercel no se usa esto: ahí cada ruta es una función (ver `api/`). Acá
// alcanza con un servidor chico, porque la lógica es la misma en los dos
// lados y vive en `servicio.mjs`.
//
// Sirve para probar un cambio antes de desplegarlo, con `node probar.mjs`.
import http from 'node:http';
import fs from 'node:fs';
import { manejar, esRutaDelServicio } from './servicio.mjs';

// Las credenciales del .env, si hay. Node sabe leerlo desde la versión 20.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const PUERTO = Number(process.env.PUERTO) || 3000;

const servidor = http.createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (esRutaDelServicio(ruta)) return await manejar(req, res, ruta);
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `No hay nada en ${req.method} ${ruta}.` }));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

servidor.listen(PUERTO, () => {
  const clave = process.env.SERVICIO_USUARIO ? 'con usuario y clave' : 'sin credenciales (abierto)';
  console.log(`Servicio de piezas  →  http://localhost:${PUERTO}  ${clave}`);
  console.log(`Probalo con:  node probar.mjs http://localhost:${PUERTO}`);
});
