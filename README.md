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

Habla el mismo idioma que htmlcsstoimage a propósito: en n8n se cambia la URL
del nodo y nada más.

## Qué hay acá

El repositorio tiene cuatro cosas, y conviene no confundirlas.

### El servicio

Es lo que se despliega en Vercel. Son siete archivos:

```
api/imagen.mjs       POST /v1/image
api/pieza.mjs        GET  /i/<id>
servicio.mjs         la lógica, igual en la máquina y en la nube
navegador.mjs        el Chrome que dibuja: el de acá o el de Vercel
render.mjs           HTML -> PNG y WEBP
editable.mjs         HTML -> SVG
convertidor-svg.js   corre dentro de la página y la vuelve a emitir como SVG
almacen.mjs          dónde quedan las piezas: disco acá, Vercel Blob allá
```

### Las herramientas de la máquina

Sirven para probar el servicio con las piezas reales de ADIPA, sin pasar por
n8n. No se despliegan.

```
npm run servidor     levanta http://localhost:3000 con una página de prueba
npm run piezas       genera las piezas de un tipo desde la línea de comandos
npm run editable     genera el SVG de una pieza
```

Detrás está el catálogo (`tipos/`), que lee las plantillas del export de n8n
(`origen/workflow-a-piezas.json`) y conoce las reglas de cada tipo de
programa: los países, las fases, los dos diseños.

### El video

En `video/`. Es un flujo aparte, para más adelante: la gráfica animada en MP4
y los avatares de HeyGen. Funciona, pero no es parte del servicio.

### Los lectores de n8n

En `n8n/`. Leen Monday y el Documento Maestro con las reglas de negocio ya
probadas contra los datos reales. **Hoy no se usan**, porque de eso sigue
encargándose n8n. Están guardados por si alguna vez se sale de ahí: el trabajo
difícil, que es entender las reglas, está hecho.

## Para trabajar

Hace falta Node 22 o superior y Google Chrome. FFmpeg solo para el video.

```
npm install
cp .env.ejemplo .env
npm run servidor
```

El detalle de todo —las reglas de cada tipo, las decisiones tomadas, lo que
falta— está en [ESTADO.md](ESTADO.md).
