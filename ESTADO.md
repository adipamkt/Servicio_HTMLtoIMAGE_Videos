# Automatización diseño Marketing

Servicio de render para las piezas de campaña de ADIPA. Recibe el HTML que
arma el flujo de n8n y devuelve la imagen —y el SVG editable—. Reemplaza al
servicio pago htmlcsstoimage.com.

## Alcance

**n8n se queda.** Sigue leyendo Monday, leyendo el Documento Maestro, bajando
y subiendo a Drive, y armando el HTML de cada pieza, como hasta ahora.

**Esto es el servicio de render.** Reemplaza únicamente a htmlcsstoimage.com:
recibe el HTML y devuelve la imagen. Y de paso suma algo que htmlcsstoimage no
da: el **SVG editable**.

El video va a ir en un flujo aparte, más adelante. Lo que ya está hecho para
video queda guardado y funciona, pero no es parte de esto.

### El cambio en n8n es un solo campo

El servicio habla el mismo idioma que htmlcsstoimage a propósito. En el nodo
"HTML/CSS to Image" se cambia la URL y nada más: el cuerpo del pedido, la
respuesta y el nodo "Descargar imagen" quedan igual.

```
antes   https://hcti.io/v1/image
ahora   https://<nuestro-servidor>/v1/image
```

| | |
|---|---|
| `POST /v1/image` | `{ html, viewport_width, viewport_height, google_fonts, ms_delay }` → `{ url }` |
| `GET /i/<id>` | el PNG |
| `GET /i/<id>.webp` | el mismo render en WEBP |
| `GET /i/<id>.svg` | el mismo diseño en SVG editable |

Lo del `.webp` no es un invento: htmlcsstoimage ya servía otros formatos
agregando la extensión a la misma URL, y el nodo "Formatos de salida" del
flujo cuenta con eso. **El `.svg` sigue el mismo camino**, así que para que una
pieza salga también en editable alcanza con agregar `'svg'` a su lista de
formatos en ese nodo.

La autenticación es básica, igual que htmlcsstoimage: la credencial que ya
existe en n8n sirve, solo hay que cambiarle usuario y clave. Se configuran con
`SERVICIO_USUARIO` y `SERVICIO_CLAVE` en `.env`; sin ellas el servicio queda
abierto, que sirve para probar en la máquina pero no para dejarlo expuesto.

### Desplegar en Vercel

El servicio está preparado para correr ahí: `api/` tiene las dos funciones,
`vercel.json` la configuración y `.vercelignore` deja afuera lo que no tiene
que viajar. La función arrastra seis archivos y dos paquetes —`sharp` y
`puppeteer-core`—; el catálogo, las plantillas y el export de n8n se quedan,
porque el servicio no los necesita.

Los pasos, en orden:

1. **Subir el repositorio a GitHub** e importarlo en Vercel.
2. **Crear un almacén de Blob** (Storage → Blob) y conectarlo al proyecto.
   Vercel carga solo la variable `BLOB_READ_WRITE_TOKEN`.
3. **Poner `SERVICIO_USUARIO` y `SERVICIO_CLAVE`** en Settings → Environment
   Variables. Sin eso el servicio queda abierto a cualquiera que tenga la
   dirección.
4. **Probar** con una pieza real y mirar cuánto tarda el primer render.
5. **Cambiar la URL en n8n** y cargar esos usuario y clave en la credencial
   que ya existe.

**Lo que hay que medir en el paso 4**, porque acá no se puede saber: el Chrome
empaquetado es otro binario y arranca más lento que el de la máquina. Acá el
primer render tarda 3,6 segundos y los siguientes 2; allá hay que ver cuánto
da. El límite está puesto en 60 segundos, así que hay margen, pero conviene
saber el número real antes de poner una campaña entera a depender de esto.

**Lo que no cambia:** las piezas siguen saliendo iguales. El motor es el mismo
Chrome, solo que empaquetado.

### Lo que falta para enchufarlo

**n8n está en la nube y necesita una dirección pública a la que llamar.** Eso
lo resuelve el despliegue en Vercel, que es el camino elegido. Mientras tanto
se prueba en la máquina, en `localhost:3000`, que es lo que está funcionando
ahora.

(Si alguna vez hiciera falta probar desde n8n sin desplegar, un túnel tipo
Cloudflare Tunnel deja la máquina alcanzable sin abrir puertos. Sirve para una
prueba, no para producción: la dirección cambia en cada reinicio y la máquina
tiene que quedar prendida.)

### Lo que quedó guardado y no se usa por ahora

`monday.mjs`, `documento.mjs` y `google.mjs` leen Monday y el Documento
Maestro, con sus reglas probadas contra los datos reales de ADIPA. No hacen
falta mientras n8n siga encargándose, pero quedan escritos: si alguna vez se
quiere salir de n8n, el trabajo difícil —entender las reglas— ya está hecho.
Lo mismo con `video.mjs` y las animaciones.

## Qué entrega

## Qué funciona hoy

**HTML → PNG con Chrome.** `node imagen.mjs` genera las cinco piezas de un tipo
en poco más de 2 segundos: se renderizan todas a la vez, en procesos separados.
Reemplaza a htmlcsstoimage: es el mismo motor (Chrome), sin el viaje de ida y
vuelta a un servidor ajeno y sin costo por imagen.

**Los siete tipos de programa, con sus dos diseños.** Con sus plantillas leídas
del export de n8n y sus reglas de país y de fase. Son 49 piezas distintas:

```
node imagen.mjs seminario
node imagen.mjs curso-sincronico
node imagen.mjs curso-asincronico
node imagen.mjs sesion
node imagen.mjs especializacion
node imagen.mjs diplomado
node imagen.mjs acreditacion
```

**El servidor.** `node servidor.mjs` levanta la app en http://localhost:3000.

| | |
|---|---|
| `GET /` | una página para probarlo a mano: se completan los datos y aparecen los afiches |
| `GET /tipos` | qué tipos hay, qué diseños tiene cada uno y qué datos pide |
| `POST /piezas` | `{ tipo, version, datos, piezas? }` → los archivos |
| `POST /video` | `{ tipo, version, datos, pieza? }` → la gráfica animada en MP4 |
| `POST /editable` | `{ tipo, version, datos, pieza? }` → la pieza en SVG editable |

Los archivos quedan en `salida/entregas/<id>/` y el servidor los sirve desde
ahí. Cada pieza puede dejar más de un archivo: ver "Piezas y archivos". Lo
que no venga en `datos` se completa con el ejemplo del tipo, así se puede pedir
una pieza mandando solo el nombre y la fecha. `piezas` es opcional: una lista de
nombres para generar menos de cinco.

**El editable en SVG.** `node svg.mjs <tipo>` saca la pieza en SVG en poco más
de un segundo, y pesa menos de la mitad que el PNG. No es una captura metida en
un archivo: recorre la página y vuelve a emitir cada cosa como lo que es. Un
bloque de color sale como rectángulo, **el texto sale como texto** —se puede
corregir una tilde en Illustrator—, las fotos van incrustadas y los dibujos que
ya eran vectores se copian tal cual.

Lo contrario sería meter el HTML dentro de un `<foreignObject>`: tendría
extensión `.svg` y se vería bien en un navegador, pero Illustrator y Figma no lo
abren. Eso no es editable, es un PNG con otro nombre.

Comparado contra el PNG de la misma pieza da **0,97 de SSIM**, o sea
prácticamente idéntico. Lo que falta para el 1 son diferencias de suavizado de
bordes.

**Hace falta Poppins instalada** en la máquina que abra el archivo. Es la
tipografía de la marca, así que diseño ya la tiene; sin ella el texto cae con
otra tipografía y los renglones se corren. La respuesta del endpoint lo avisa.

Cuatro cosas que hubo que resolver y que conviene no volver a tropezar:

| | |
|---|---|
| Orden de capas | El SVG pinta en el orden en que está escrito; el navegador usa además `z-index`. Sin ordenar, el doodle quedaba detrás del bloque morado |
| Interletrado | Las píldoras lo usan. Sin copiarlo el texto sale más ancho y se desalinea |
| Espacios | Los seguidos se juntan en uno, como hace el navegador; el del final se conserva (separa "¡Cupos Limitados!" de "Inscríbete ahora") y el del principio se saca solo cuando el renglón viene de un corte de línea |
| `object-position` | La plantilla ancla imágenes arriba o abajo, no al centro. Sin copiarlo, el doodle queda corrido |

El convertidor corre dentro de la página, cuando ya está dibujada y con la
tipografía cargada, y devuelve el SVG. Es el mismo Chrome que saca los PNG.

**Colores de marca corregidos.** `marca.mjs` tiene los hex oficiales de ADIPA y
corrige la plantilla antes de renderizar. Ver `CORRECCION-COLORES.md`.

**La gráfica animada.** `node video.mjs <tipo>` saca un MP4 de 8 segundos a 30
cuadros por segundo del afiche vertical, para cualquiera de los siete tipos y
los dos diseños. Tarda unos 20 segundos. Es la misma pieza que sale en PNG
—no hay un diseño duplicado para el video—: se la envuelve en una composición
de HyperFrames y se le cuelga una timeline de GSAP.

Cada pieza puede tener su animación en `composicion/animaciones/<tipo>-<pieza>.js`.
Si no la tiene, se usa `_generica.js`. Hoy la única propia es la del seminario
vertical; la respuesta del endpoint avisa cuál se usó.

La diferencia entre una y otra es cuánto sabe de lo que mueve. La del seminario
despliega el bloque morado desde su borde de arriba, hace entrar a cada docente
junto con su foto y gira el sello del certificado al acomodarlo. La genérica
separa los bloques con texto de la decoración y los hace entrar en el orden en
que están escritos, alternando los que suben con los que entran de costado.

Las dos usan los recursos de `composicion/ayudas.js`, que es lo que separa una
animación de una lista de elementos apareciendo:

| | Qué hace |
|---|---|
| `A.camara()` | mete todo en una capa y la acerca despacio durante los 8 segundos. La escena es la raíz de la composición y no se puede transformar, por eso la capa |
| `A.palabras()` | parte un texto en palabras, cada una dentro de una cajita que recorta, para que asomen desde atrás del renglón una detrás de otra |
| `A.acento()` | un golpe corto de escala para marcar un momento |

Y las dos tienen tres momentos, no uno: la cascada de entrada hasta los 3,4
segundos; una pausa donde solo se mueven la cámara y la decoración; y una
tercera parte con acentos que van pasando de un elemento a otro. Una pieza
donde todo entra a los 3 segundos y después se congela parece un PNG con unos
pasos al principio.

**El texto del encabezado se asienta, no se revela.** Revelarlo por palabra
dejaría el cuadro 0 sin título, y ese cuadro es la miniatura en el feed. El
revelado con máscara se usa donde sí se puede: los nombres de los docentes y
las líneas del certificado, que no están en el cuadro 0.

Falta la locución.

### Las cuatro reglas de las animaciones

Están escritas en los dos archivos, pero conviene tenerlas juntas:

1. **Solo transform y opacity.** HyperFrames deja animar opacity, x, y, scale,
   rotation, width, height y visibility, nada más. Y de esas, mover y
   transparentar son las únicas que no obligan al navegador a recalcular la
   página: si no, el título se corre de donde lo dejó el ajuste de tamaño.

2. **Todo con `fromTo` y valores absolutos.** Nada de `'+='` ni de valores que
   GSAP tenga que leer de la página al vuelo. El render usa varios procesos en
   paralelo que saltan a momentos distintos del video: si un valor depende de
   lo que había antes, cada proceso lee algo distinto y el video sale con
   saltos.

3. **El cuadro 0 ya muestra marca y título.** Ese cuadro es la miniatura en el
   feed de Meta. Si arranca en negro o a medio armar, la pieza se ve muerta
   antes de que alguien la reproduzca.

4. **Nada queda del todo quieto.** Cuando terminó de entrar todo, la decoración
   sigue derivando y el botón respira. Una pieza que se congela a los 3
   segundos parece un PNG con unos pasos al principio.

### Dos cosas que costaron encontrar

**No se puede medir la página.** La primera versión de la genérica decidía qué
mover según dónde estaba cada cosa en la pantalla. No funciona: varias
plantillas colocan sus bloques con un script, después de ajustar el título a la
tipografía ya cargada, así que al momento de armar la animación la fecha y los
datos todavía están en la posición cero. Esperar a que termine tampoco sirve
—para entonces el runtime ya capturó los primeros cuadros— y
`requestAnimationFrame` directamente no corre si la pestaña no está al frente.
Por eso la genérica va por **orden del documento**, que ya es correcto apenas se
arma la página.

**El bloque morado del seminario es un `<svg>` del tamaño de toda la página**,
con la forma dibujada adentro. Para desplegarlo desde su borde de arriba hay que
calcular el ancla desde el dibujo (`getBBox`) y no usar `center top`, que es la
esquina de la página: si no, aparece una barra morada arriba de todo.

## Cómo está armado

```
servicio.mjs   el servicio que llama n8n: /v1/image y /i/<id>
api/           el mismo servicio como funciones de Vercel
navegador.mjs  el Chrome que dibuja: el de la máquina o el de Vercel
render.mjs     el motor: HTML → PNG y WEBP
editable.mjs   el motor: HTML → SVG
almacen.mjs    dónde quedan las piezas: disco acá, Vercel Blob allá
piezas.mjs     lo mismo pero sobre el catálogo de tipos
servidor.mjs   el servidor de la máquina: el servicio más la página de prueba
pagina.mjs     la página de prueba que sirve en /
svg.mjs        la versión editable desde la línea de comandos
video.mjs      el afiche → MP4 con HyperFrames (flujo aparte, más adelante)
heygen.mjs     la locución y los avatares (API v3)
monday.mjs     el aviso, los datos del programa y el estado de vuelta
google.mjs     entrar a Google con una cuenta de servicio
documento.mjs  lee el Documento Maestro y saca sus etiquetas
tipos/         el catálogo: un archivo por tipo de pieza
imagen.mjs     el mismo render desde la línea de comandos
datos.mjs      lee las plantillas del export de n8n y arma datos de ejemplo
marca.mjs      colores oficiales + corrección + cálculo de contraste
guion.mjs      texto de la locución (a medio hacer)
origen/        el export de n8n y la plantilla extraída
composicion/   las animaciones, las ayudas, el convertidor a SVG y GSAP
```

**Agregar un tipo de pieza** es dejar un archivo en `tipos/`: se suma solo al
catálogo, sin tocar el servidor. Un archivo puede declarar varios tipos si
exporta una lista, como hacen los dos cursos. Cada tipo dice cómo se llama, qué datos pide, un
ejemplo, y una función que devuelve sus piezas en HTML. Los formatos de video
entran por el mismo lugar.

El tipo declara también sus `campos`, y con eso la página de prueba le arma el
formulario sola: un tipo nuevo tiene su formulario sin tocar `pagina.mjs`. Los
archivos que empiezan con `_` son código compartido, no tipos.

## Los tres ejes: tipo, diseño y país

Lo que sale no depende solo del tipo de programa.

### El diseño

Todos los productos tienen **dos diseños**, y son piezas distintas, no la misma
pieza con otro color:

| | Qué da | Formatos |
|---|---|---|
| Diseño 1 | tres a cinco piezas según el tipo y la fase | vertical, cuadrada, horizontal, catálogo, portada web |
| Diseño 2 | **dos piezas** | cuadrada de feed (1200×1200) e historia (1080×1920) |

## Piezas y archivos

No son lo mismo. De las cinco piezas del diseño 1, **tres son de redes** (las
`-RRSS`, o `-PL` en pre-lanzamiento) y dos son del sitio: la ficha del catálogo
y la portada. En el seminario no hay ficha de catálogo: en su lugar va la
portada de YouTube.

Y la ficha del catálogo y la portada se guardan **dos veces, en PNG y en
WEBP** —la misma imagen, que el sitio sirve en WEBP—, así que salen más
archivos que piezas:

| Tipo | Piezas | Archivos |
|---|---|---|
| Seminario | 5 | 6 |
| Curso sincrónico y asincrónico | 5 | 7 |
| Sesión magistral en Chile | 5 | 7 |
| Sesión magistral en México o Colombia | 3 | 3 |
| Especialización y diplomado, pre-lanzamiento | 5 | 7 |
| Especialización y diplomado, lanzamiento | 3 | 3 |
| Cualquiera, diseño 2 | 2 | 2 |

El WEBP se arma a partir del PNG **sin pérdida**: es la misma imagen pixel por
pixel, y en estos diseños planos pesa menos de la mitad (50 KB contra 118 en la
ficha de catálogo).

Ojo con una trampa acá: Chrome sabe sacar la captura directamente en WEBP, pero
solo con pérdida, y en dibujos planos eso comprime **peor** que el PNG — en la
prueba dio 157 KB contra 118. Por eso el WEBP lo hace `sharp` a partir del PNG.

El diseño 2 pide un dato que el 1 no usa: **"¿Qué aprenderás?"**. Cada tipo
tiene su límite —cuántos aprendizajes entran y con cuántos caracteres en
total— porque el bloque ocupa un lugar distinto en cada diseño. Si no entran,
el bloque sale **vacío** y lo completa diseño a mano: nunca sale el texto
cortado. La página avisa cuándo pasó eso y por qué.

| Tipo | Aprendizajes | Caracteres |
|---|---|---|
| seminario | 2 | 295 |
| curso sincrónico | 2 | 306 |
| curso asincrónico | 1 | 247 |
| especialización | 2 | 301 |
| diplomado | 2 | 402 |
| acreditación | 3 | 277 |
| sesión magistral | 3 | 354 |

En el workflow esos textos los escribe Gemini. Acá se escriben a mano hasta
tener la credencial; el límite y la validación ya funcionan igual.

### Los dos cursos

En el workflow el curso es un solo nodo con dos juegos de plantillas, pero son
dos productos distintos —así están en Monday— y acá aparecen separados:

| | Qué muestra |
|---|---|
| **Curso sincrónico** | "¡Interacción en vivo!", con fecha de inicio |
| **Curso asincrónico** | "¡Estudia a tu ritmo!", acceso por un año, **sin** fecha de inicio |

Por eso el sincrónico pide la fecha completa (`2027-05-12`, que la plantilla
convierte en "12 de Mayo") y el asincrónico ni siquiera muestra el campo: no la
usa en ninguna de sus cinco plantillas. Diplomado y acreditación, en cambio,
aceptan texto libre tipo "Mayo 2027". Si al sincrónico le llega una fecha que no
puede partir, el endpoint lo dice en vez de sacar la pieza con "undefined de
undefined".

Los dos comparten una particularidad: la pieza del catálogo **no recibe los
mismos datos** que las de redes. En redes van los nombres de los docentes y los
logos de las escuelas; en el catálogo, las fotos de los docentes y los escudos.

### El país

La gráfica no depende solo del tipo de programa. El país también la cambia, y no
de la misma forma en cada tipo. Esto estaba repartido entre varios nodos de n8n;
puesto junto queda así:

| Tipo | Cómo entra el país | |
|---|---|---|
| seminario | **Todos los países en la misma pieza**: una fila de banderas con la hora local de cada uno | ✅ |
| sesión magistral | **Un país por pieza**. Chile arma las cinco piezas; México y Colombia, solo las tres de redes | ✅ |
| especialización | El país define qué Documento Maestro se lee → precios, y de ahí el % de descuento | ✅ |
| diplomado | Igual que especialización, más dos ilustraciones | ✅ |
| acreditación | El país define el Documento Maestro: fecha de inicio y horas certificadas | ✅ |
| curso sincrónico | El país define el Documento Maestro | ✅ |
| curso asincrónico | El país define el Documento Maestro | ✅ |

Además de la fase: especialización y diplomado arman **cinco** piezas en
pre-lanzamiento (las tres de redes con el sello de descuento, renombradas a
`-PL`, más catálogo y portada web) y **tres** en lanzamiento, sin sello.

El caso del seminario ya está resuelto en `paises.mjs`: tiene los cuatro países
con su bandera y su zona horaria, y convierte la hora. El Documento Maestro está
escrito en la hora de un país (el prefijo `CL`/`MX`/`CO`/`AR` del nombre del
documento) y de ahí sale la hora de los demás, con horario de verano incluido.

```
19:00 en Chile  →  CHI 19:00   MEX 16:00   COL 17:00   ARG 19:00
```

Con un país marcado el afiche muestra la fecha grande y una bandera; con cuatro,
la fila de cuatro horas. Es la misma plantilla: cambia el dato.

El diseño no se duplica: las plantillas se leen del export de n8n
(`origen/workflow-a-piezas.json`), así el video y las imágenes siempre usan el
mismo afiche. Para actualizarlo, exportar de nuevo desde n8n y pisar ese archivo.

## Decisiones tomadas

**Todo en código, sin n8n.** De los 73 nodos del workflow, 44 son lógica dibujada
como cajas (19 Code + 15 Sticky Note + 10 If) y dejan de existir. Las conexiones
reales con el mundo son solo cuatro: Monday, Google Docs, Google Drive y Gemini.

**Chrome en vez de una librería de imágenes.** Chrome ya dibuja la página.
Mismo resultado que el servicio pago, porque es el mismo motor.

**Manejado por su protocolo, no por línea de comandos.** La primera versión
lanzaba `chrome.exe --screenshot` y leía el archivo que dejaba. Funcionaba,
pero en Vercel no hay un Chrome que lanzar ni un disco donde dejar el archivo.
Manejándolo con `puppeteer-core` sirve en los dos lados, se puede reusar el
navegador entre piezas —que es casi todo el tiempo de un render en frío— y de
paso el SVG se lee de la página en vez del truco de `--dump-dom`.

**Escala 1, no 2.** Renderizar al doble y reducir da SSIM 0,995 contra el render
normal: la diferencia es invisible y cuesta el doble. La calidad actual es el techo.

**HyperFrames en vez de Remotion** para el video: no obliga a reescribir el diseño
en React y su licencia es Apache-2.0.

**HeyGen para la voz, sin ElevenLabs.** HeyGen hace las dos cosas, así que es una
cuenta sola y una factura sola en vez de dos. Su API genera audio sin avatar
(`POST /v3/voices/speech`, "Third Party Speech") y devuelve las marcas de tiempo
que necesita la animación: `POST /v3/models/audio/tts` con `with_timestamps: true`
responde `original_characters`, con el inicio y el fin **de cada carácter**. Es
más fino que por palabra, y las palabras se arman agrupando caracteres. Los
videos con avatar, además, siempre devuelven su `subtitle_url`.

**Confirmado contra la API real** (3 de noviembre de 2026). La clave está en
`.env` y funciona: el catálogo devuelve 2.951 voces, 63 en español. El endpoint
de locución es `POST /v3/models/audio/tts`, pide `voice_id` y acepta
`with_timestamps`. La documentación nombraba varios endpoints de voz y no
coincidía consigo misma; este es el que responde.

Lo único que falta es **saldo**: una locución de prueba devuelve
`402 insufficient_credit`. El saldo de API se carga aparte de los planes web.

**Usar la API v3, no la v2.** Los endpoints `v2` todavía responden pero avisan
que su fecha de retiro era el 31 de octubre de 2026, o sea que ya pasó. La
mayoría de los tutoriales que hay dando vueltas usan v2.

### El avatar propio

Hay dos clases y se consiguen distinto:

| | Cómo se crea | Por API |
|---|---|---|
| **De foto** | desde una imagen fija | sí, entero: `POST /v3/avatars` con `type: "photo"` crea y entrena, `POST /v3/avatars/looks` agrega poses |
| **Grabado** | grabando video de la persona en el sitio de HeyGen | no se crea por API, pero una vez hecho se usa igual |

**El avatar de la cuenta ya está hecho.** El grupo "Gonzalo Martínez" tiene
cuatro looks, los cuatro `completed`, y todos apuntan a la voz clonada del
mismo nombre:

```
bf3f0b3234e5409bbbddfc370aafbc59  photo_avatar   Smiling professional in blue shirt
84d3eb45ec1349859d656f4de21e0181  photo_avatar   Photo Avatar
49741c02d46f48aaa30926958a84dc79  digital_twin   Gonzalo Martínez -- 1
0e5b3f554dde43409c1bfd5edfdc39d0  photo_avatar   Gonzalo Martínez
voz  a2963eef24334e89acb8adae2e611e2f
```

No hay que crear ni entrenar nada. Ojo con una trampa: el listado viejo
(`/v2/avatar_group.list`) dice `train_status: empty` para ese grupo, y es
mentira —  el listado v3 de looks dice `completed`. Otra razón para no usar v2.

**El `avatar_id` que pide el video es el del look, no el del grupo.**

Si alguna vez hay que crear uno nuevo, el camino es: subir la foto a
`POST /v3/assets` (multipart, campo `file`), y después `POST /v3/avatars` con
`{ name, type: "photo", file: { type: "url" | "asset_id" | "base64", … } }`.
El `type` va adentro del objeto `file`, no afuera.

Para armar el video: `POST /v3/videos` con `type: "avatar"`, el `avatar_id` del
look y el audio. El audio puede venir de tres formas, y la tercera es la que
nos sirve:

```
script + voice_id     HeyGen locuta el texto
audio_url             se le pasa un audio ya hecho
audio_asset_id        lo mismo, con un archivo subido antes
```

**`audio_url` es la pieza que une los dos videos.** Se genera la locución una
sola vez con sus marcas de tiempo, se usa para sincronizar la gráfica animada,
y el mismo archivo se le pasa al avatar. Así la voz es idéntica en los dos y se
paga una sola locución.

## Cómo seguir

**Primero probar si el video sirve, después automatizarlo.** Automatizar los
tres tipos de video es bastante trabajo, y no tiene sentido hacerlo antes de
saber si a la audiencia de ADIPA le rinden. La prueba es barata; el desarrollo
no.

**Prueba (barata, en paralelo con todo lo demás).** Elegir dos campañas reales
que vengan y sacar las piezas a mano:

| | Costo | Necesita |
|---|---|---|
| La gráfica animada | **cero** | nada, ya funciona |
| Dos videos de avatar | **~US$ 5** | cargar el saldo |

Publicarlos contra la pieza estática en la misma campaña, mismo público, mismo
presupuesto, cambiando solo la creatividad. Lo que se mira: retención a los 3
segundos (si el primer cuadro frena el scroll), reproducciones completas, clics
a la landing y costo por inscripción.

Con dos campañas no hay significancia estadística: esto sirve para ver una
diferencia grande, no una chica. Si el video rinde parecido a la estática, la
respuesta es que no vale la pena automatizarlo.

**Una pregunta de fondo antes de grabar el guion:** el avatar de la cuenta es
de marketing, no del docente. Para un seminario clínico, la cara que da
confianza probablemente sea la de quien lo dicta. Conviene decidir de quién
tiene que ser el avatar antes de invertir en automatizarlo.

**Mientras tanto, el trabajo de desarrollo va a las integraciones.** Las piezas
estáticas ya están probadas —reemplazan un flujo que ADIPA usa todos los días—
y lo único que las frena son las credenciales de Monday y Google. Eso rinde
haya video o no.

## Lo que falta

1. **Una animación propia por pieza.** Hoy solo el seminario vertical tiene la
   suya; el resto usa la genérica. Se agregan dejando un archivo en
   `composicion/animaciones/`.
2. **Terminar las integraciones.** Monday y el Documento Maestro ya están
   escritos (`monday.mjs`, `documento.mjs`), con sus reglas de negocio probadas
   sin credencial. Falta Drive —bajar las imágenes y subir las piezas—, Gemini,
   y el orquestador que una todo. Y falta probar los dos primeros contra los
   datos de verdad, que necesita las credenciales.
3. **Locución con HeyGen.** El plan es pedir el audio con marcas de tiempo y
   usar esos tiempos para que cada elemento del afiche entre justo cuando la voz
   lo nombra.
4. **Avatares con HeyGen.** El avatar entra como `<video>` dentro del HTML, no se
   pega después. Pendiente de probar: si el fondo transparente sobrevive al render,
   que usa JPEG por defecto (`--video-frame-format png` sería el arreglo).
5. **Historial de ejecuciones.** Es lo único que se pierde al salir de n8n: saber
   qué falló y con qué datos.
6. **Los colores de los otros tipos.** El seminario ya está corregido; los
   demás todavía traen los hex aproximados del gotero. Ver la tabla al final de
   `CORRECCION-COLORES.md`: hay al menos diez morados apenas distintos donde
   debería haber uno.
7. **Las imágenes reales de cada tipo.** Hoy las fotos de docentes, los fondos
   y las ilustraciones son marcadores de color generados en `datos.mjs`: las de
   verdad salen de Drive y de Monday. Los textos y los números sí son reales y
   se pueden escribir en la página, los aprendizajes del diseño 2 incluidos.

## Las integraciones

### Qué dispara el flujo

Monday manda un aviso cuando alguien cambia la columna **Crear Diseño** a
"Generar piezas" o "Generar piezas V2" (ese segundo estado es el que pide el
diseño 2). El primer pedido de todos no es un aviso sino un desafío: hay que
devolverle el mismo `challenge` o Monday no registra la dirección.

### Qué se lee del ítem

El tipo de programa **no está en una columna**: está en el prefijo del nombre
del ítem, y el orden de las comprobaciones importa. "Postítulo de
Especialización…" es un **diplomado**, así que diplomado se mira antes que
especialización; mirando primero la palabra "especialización" caería en la
rama equivocada. Las once variantes de nombre están probadas en
`node monday.mjs reglas`.

| Columna | Qué trae |
|---|---|
| `lookup_mm6471ev` | Doc Maestro: la URL, y el prefijo CL/MX/CO/AR que dice de qué país es la hora |
| `lookup_mm0hr93j` | la carpeta de Drive del programa |
| `lookup_mm7yy6a5` | los países, separados por coma |
| `color_mm7rge0` | el estado: dispara, y es donde devolvemos el resultado |
| `text_mm7z9eff` | el mensaje de error o el aviso que ve diseño |

Las columnas espejo no traen su texto en `text`: hay que pedir `display_value`
con un fragmento de GraphQL o llegan vacías.

**Verificado contra el tablero real** (4 de noviembre de 2026).

El tablero es **"Diseño Marketing"**, id `3396579896`, workspace Marketing.
Las cinco columnas coinciden exactamente con las del export de n8n. La columna
"Crear Diseño" tiene además dos etiquetas que todavía no usamos: *Generando
video* y *Revisión de video*, así que el tablero ya está preparado para el
video.

**892 nombres de campaña del tablero, 892 reconocidos.** Para llegar ahí hubo
que cubrir tres formas de escribir que el flujo de n8n **tampoco** reconoce
—son huecos que ya existían, no algo que rompimos—:

| Lo que aparece en el tablero | Cuántos | Qué pasaba |
|---|---|---|
| `[PRELANZAMIENTO DIPLOMADO CL]` | 33 | n8n busca "Diplo", acá dice "Diplomado" |
| `[V2 CS CL] Curso: …` | 4 | el "V2" del prefijo tapaba el tipo que venía atrás |
| `[Especialización CL] …` | 2 | sin la fase adelante |

El de la fase no se puede adivinar: sin saber si es pre-lanzamiento o
lanzamiento no se sabe si las piezas llevan el sello de descuento. Se reconoce
el tipo y se pide la fase como dato faltante, en vez de suponer.

**Qué diseño se genera lo decide el estado, no el nombre.** El "V2" que
aparece en algunos prefijos es una etiqueta que puso una persona para
ubicarse, no un pedido: el ítem `[V2 CS CL] Curso: …` con el estado "Generar
piezas" tiene que dar el diseño 1, y solo con "Generar piezas V2" da el 2. En
el código el V2 del nombre se saca únicamente para poder leer el tipo que
viene atrás.

La columna "Crear Diseño" tiene doce etiquetas. Las dos que disparan son
**Generar piezas** y **Generar piezas V2**; las demás son estados de avance
(*Generando piezas*, *Revisión de piezas*, *Piezas aprobadas*, *Corregir
Piezas*, *Completado*) o de error (*Datos incompletos*, *Error técnico*).

Para el video ya existen *Generando video* y *Revisión de video*, pero **no
hay una etiqueta "Generar video"**: cuando llegue el momento de dispararlo
desde Monday, hay que agregarla.

Los otros 269 ítems con corchetes que no se reconocen **no son campañas**:
son pedidos de diseño de otra cosa (`[LOGO INSTITUCIÓN]`, `[CONGRESO]`,
`[PRODUCT DECK]`, `[REDISEÑO]`). Está bien que se rechacen, y además nunca
llegan: el flujo solo corre cuando alguien pone "Generar piezas".

### El Documento Maestro

Es un Google Doc que escribe el equipo académico. Los datos están marcados en
el texto con etiquetas `[nombre_programa] … [fin_nombre_programa]`. Qué se lee
depende del tipo: un seminario necesita fecha y horario, una especialización
el director y los precios, una sesión magistral tiene a sus docentes anidados
dentro de `[equipo_docente]` —porque en el resto del documento `[docente_1]`
aparece con la biografía entera— y no lleva fecha.

Probado con documentos de mentira en `node documento.mjs reglas`.

### Lo que no se genera

Si al ítem o al documento les falta algo, **no se genera nada**: se escribe
"Datos incompletos" en Monday con el detalle de qué falta, igual que hacía el
flujo viejo. Es preferible a sacar una pieza con un hueco.

## Credenciales pendientes

Ninguna está configurada todavía. Van en `.env`, que está en `.gitignore`.

| Para qué | Dónde se saca |
|---|---|
| Monday | Avatar → Developers → My Access Tokens |
| Google Docs y Drive | una cuenta de servicio (archivo JSON), y compartirle las carpetas |
| Gemini | Google AI Studio |
| HeyGen | **la clave ya está en `.env` y funciona.** Falta cargar saldo de API, que es aparte de los planes web |

Si ADIPA ya tiene cuenta de HeyGen, usar esa y no crear una nueva.

**Ojo con qué se contrata en HeyGen.** Los créditos de los planes web (Creator,
Pro, Team) **no alimentan la API**: son dos bolsillos separados, y lo dice la
propia documentación de HeyGen. Lo que necesita esta app es el saldo de API,
que se carga aparte, arranca en US$ 5, no pide suscripción mensual y vence a
los 12 meses. Desde febrero de 2026 no hay créditos de API gratis.

Un plan web igual sirve, pero para otra cosa: hacer videos a mano en su sitio,
sacar la marca de agua ahí, y crear un avatar propio con la cara y la voz de
alguien de ADIPA en vez de usar un presentador de catálogo.

### Cuánto cuesta cada cosa

Tarifas reales del panel de la cuenta (3 de noviembre de 2026). Se cobra **por
segundo de video generado**, del saldo prepago en dólares.

**La gráfica animada no cuesta nada**: se renderiza con el Chrome de la
máquina. Dato curioso: HeyGen cobra HyperFrames —el mismo motor que usamos
nosotros— a US$ 0,15 el minuto en 1080p/30fps. Es exactamente lo que nos
ahorramos por correrlo acá.

**La locución es gratis en la práctica.** Text to speech Turbo cuesta US$ 4 por
millón de caracteres, y un guion de seminario tiene unos 400: **US$ 0,0016 por
video**. Hay una promoción de 50% hasta el 30 de noviembre de 2026; después se
duplica y sigue siendo nada.

**El avatar es lo único que se paga de verdad**, y el precio depende de qué
avatar y qué motor:

| Opción | US$/seg | 30 s | 60 s | 20 videos/mes |
|---|---|---|---|---|
| Avatar III · grabado | 0,0100 | 0,30 | 0,60 | **6** |
| Avatar III · foto | 0,0165 | 0,49 | 0,99 | 10 |
| **Avatar IV · foto** | 0,0385 | 1,16 | 2,31 | **23** |
| Avatar IV · grabado | 0,0805 | 2,42 | 4,83 | 48 |
| Avatar V · grabado | 0,1200 | 3,60 | 7,20 | 72 |

Avatar IV es el motor por defecto. La cuenta ya tiene los dos avatares: los
looks de foto y uno grabado (`digital_twin`).

**Dos cosas que no son obvias en esa tabla:**

El avatar **grabado sale más barato que el de foto** en Avatar III (0,0100
contra 0,0165) y más caro en Avatar IV (0,0805 contra 0,0385). O sea que la
decisión barato/caro no es foto contra grabado: es qué motor.

Con los **US$ 5 del mínimo** alcanza para unos 130 segundos en Avatar IV foto:
cuatro videos de 30 segundos, suficiente para probar.

**Cada regeneración se paga de nuevo.** Si el guion no está aprobado y hay que
rehacer la toma, se paga dos veces. Conviene cerrar el texto antes de generar.

## Lo que falta

1. **Una animación propia por pieza.** Hoy solo el seminario vertical tiene la
   suya; el resto usa la genérica. Se agregan dejando un archivo en
   `composicion/animaciones/`.
2. **Las cuatro integraciones** que hoy hace n8n: recibir el aviso de Monday, leer
   Monday, leer el Documento Maestro (Docs), bajar y subir a Drive, y Gemini para
   los aprendizajes.
3. **Locución con HeyGen.** El plan es pedir el audio con marcas de tiempo y
   usar esos tiempos para que cada elemento del afiche entre justo cuando la voz
   lo nombra.
4. **Avatares con HeyGen.** El avatar entra como `<video>` dentro del HTML, no se
   pega después. Pendiente de probar: si el fondo transparente sobrevive al render,
   que usa JPEG por defecto (`--video-frame-format png` sería el arreglo).
5. **Historial de ejecuciones.** Es lo único que se pierde al salir de n8n: saber
   qué falló y con qué datos.
6. **Los colores de los otros tipos.** El seminario ya está corregido; los
   demás todavía traen los hex aproximados del gotero. Ver la tabla al final de
   `CORRECCION-COLORES.md`: hay al menos diez morados apenas distintos donde
   debería haber uno.
7. **Las imágenes reales de cada tipo.** Hoy las fotos de docentes, los fondos
   y las ilustraciones son marcadores de color generados en `datos.mjs`: las de
   verdad salen de Drive y de Monday. Los textos y los números sí son reales y
   se pueden escribir en la página, los aprendizajes del diseño 2 incluidos.

## Credenciales pendientes

Ninguna está configurada todavía. Van en `.env`, que está en `.gitignore`.

| Para qué | Dónde se saca |
|---|---|
| Monday | Avatar → Developers → My Access Tokens |
| Google Docs y Drive | una cuenta de servicio (archivo JSON), y compartirle las carpetas |
| Gemini | Google AI Studio |
| HeyGen | **la clave ya está en `.env` y funciona.** Falta cargar saldo de API, que es aparte de los planes web |

Si ADIPA ya tiene cuenta de HeyGen, usar esa y no crear una nueva.

**Ojo con qué se contrata en HeyGen.** Los créditos de los planes web (Creator,
Pro, Team) **no alimentan la API**: son dos bolsillos separados, y lo dice la
propia documentación de HeyGen. Lo que necesita esta app es el saldo de API,
que se carga aparte, arranca en US$ 5, no pide suscripción mensual y vence a
los 12 meses. Desde febrero de 2026 no hay créditos de API gratis.

Un plan web igual sirve, pero para otra cosa: hacer videos a mano en su sitio,
sacar la marca de agua ahí, y crear un avatar propio con la cara y la voz de
alguien de ADIPA en vez de usar un presentador de catálogo.

### Cuánto cuesta cada cosa

**La gráfica animada no cuesta nada.** Se renderiza con el Chrome de la máquina.
Lo único que se paga a HeyGen es la voz y el avatar.

HeyGen **no publica la tabla de tarifas de la API**: está detrás del panel
(barra lateral → Pricing). Los sitios de terceros no coinciden entre sí, así
que lo de abajo es un rango, no un presupuesto:

| | Rango que citan los terceros |
|---|---|
| Avatar III | ~US$ 1 el minuto |
| Avatar IV (el que viene por defecto) | US$ 3 a 5 el minuto |
| Avatar V | US$ 3 a 7 el minuto |

Con Avatar IV, un video de 30 segundos sale entre **US$ 1,5 y 2,5**. Los US$ 5
del mínimo alcanzan para dos o tres pruebas.

**Cada regeneración se paga de nuevo.** Si el guion no está aprobado y hay que
rehacer la toma, se paga dos veces. Conviene cerrar el texto antes de generar.

**La locución es otra cosa y puede salir gratis.** Se cobra por caracteres, no
por minuto de video, y la documentación dice que *HeyGen Voice Turbo* es
gratis **hasta el 30 de noviembre de 2026**, con límites de pedidos. O sea que
el video de gráfica con voz —el primero que conviene hacer— puede costar casi
cero si se prueba antes de esa fecha.

## Requisitos de la máquina

- Node 22 o superior
- Google Chrome. Se busca solo en las rutas habituales; si está en otro lado,
  la variable `CHROME` en `.env`
- FFmpeg, **solo para el video**. Las imágenes y los SVG ya no lo usan
