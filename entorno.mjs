// Carga las credenciales del .env a las variables de entorno.
//
// Se importa desde cada módulo que necesite una credencial. Node ya sabe leer
// un .env desde la versión 20, así que no hace falta ninguna dependencia.
//
// El archivo puede no estar: todo lo que no toca servicios de afuera —generar
// las piezas, los videos, los SVG— funciona igual sin credenciales.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const archivo = fileURLToPath(new URL('./.env', import.meta.url));
if (fs.existsSync(archivo)) process.loadEnvFile(archivo);

// El nombre de la variable que falta, dicho de manera que se entienda qué hacer.
export function credencial(nombre, donde) {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta ${nombre} en .env — ${donde}`);
  return v;
}
