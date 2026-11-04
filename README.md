# Servicio de render de piezas — ADIPA

Recibe el HTML que arma el flujo de n8n y devuelve la imagen. Reemplaza a
htmlcsstoimage.com, y de paso suma algo que ese servicio no da: el **SVG
editable**.

```
POST /v1/image      { html, viewport_width, viewport_height } -> { url }
GET  /i/<id>        el PNG
GET  /i/<id>.webp   el mismo render en WEBP, sin pérdida
GET  /i/<id>.svg    el mismo diseño en SVG editable
```

Habla el mismo idioma que htmlcsstoimage a propósito: **en n8n se cambia la
URL del nodo y nada más**. El cuerpo del pedido, la respuesta y el nodo que
baja la imagen quedan igual.

## Qué hay acá

```
api/imagen.mjs       POST /v1/image         las funciones de Vercel
api/pieza.mjs        GET  /i/<id>
servicio.mjs         la lógica, igual en la máquina y en la nube
navegador.mjs        el Chrome que dibuja: el de acá o el de Vercel
render.mjs           HTML -> PNG y WEBP
editable.mjs         HTML -> SVG
convertidor-svg.mjs   corre dentro de la página y la vuelve a emitir como SVG
almacen.mjs          dónde quedan las piezas: disco acá, Vercel Blob allá
local.mjs            el servicio en la máquina, para probar
probar.mjs           la prueba, contra donde esté corriendo
```

## Probar

```bash
node local.mjs                                      # en una terminal
node probar.mjs                                     # en otra
node probar.mjs https://la-direccion.vercel.app     # contra el desplegado
```

Hace lo mismo que hace n8n y mide el render en frío contra el caliente. La
diferencia es lo que tarda Chrome en arrancar.

## Desplegar

1. Importar el repositorio en Vercel.
2. **Storage → Blob**: crear un almacén y conectarlo al proyecto. Sin esto el
   servicio no guarda las piezas y falla al primer render.
3. **Settings → Environment Variables**: `SERVICIO_USUARIO` y
   `SERVICIO_CLAVE`. Sin ellas el servicio queda abierto a cualquiera que
   tenga la dirección.
4. Redesplegar para que tome las variables.

Las variables están explicadas una por una en [.env.ejemplo](.env.ejemplo).

## Tres cosas que hay que saber

**Las versiones de `puppeteer-core` y `@sparticuz/chromium` van emparejadas.**
Una trae Chrome y la otra lo maneja: si no coinciden, el navegador arranca
pero falla al hablarle. Hoy son `25.11.0` y `153`. Para actualizar, mirar qué
Chromium espera la versión nueva de puppeteer, en
`node_modules/puppeteer-core/lib/puppeteer/revisions.js`.

**La clave protege el POST, no la descarga.** El POST es el que gasta tiempo
de máquina. El GET queda abierto porque la dirección lleva un identificador al
azar de 128 bits —htmlcsstoimage hacía lo mismo— y porque el nodo de n8n que
baja la imagen no manda credenciales.

**Vercel rechaza pedidos de más de 4,5 MB**, y no se puede subir en ningún
plan. Las fotos viajan adentro del HTML en base64, así que el pedido pesa lo
que pesan las imágenes. La respuesta trae `kb` para poder ver el margen real
con campañas de verdad.

## Para trabajar

Node 22 o superior y Google Chrome. Si Chrome está en un lugar raro, la
variable `CHROME`.

```bash
npm install
cp .env.ejemplo .env
node local.mjs
```
