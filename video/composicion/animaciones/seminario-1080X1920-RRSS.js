// Animación del afiche de seminario. Este es el archivo que se toca para
// cambiar el movimiento.
//
// Reglas de HyperFrames: la timeline se crea en pausa y el runtime la va
// posicionando frame por frame, a veces con varios procesos en paralelo que
// saltan a distintos momentos. Por eso:
//
//   - Se animan transform y opacity, nada más. No disparan relayout, así que
//     el render es rápido y el texto no se corre de donde lo dejó el ajuste de
//     tamaño del título.
//   - Todo va con `fromTo` y valores absolutos. Nada de '+=' ni de valores que
//     GSAP tenga que leer de la página al vuelo: dos procesos que saltan a
//     momentos distintos leerían cosas distintas y el video saldría con saltos.
//
// La pieza tiene tres momentos, no uno:
//
//   0 a 3,4 s   entra todo, en cascada
//   3,4 a 5 s   respira: solo la cámara y el doodle se mueven
//   5 a 8 s     dos acentos y el botón, para cerrar con energía
//
// Un afiche donde todo termina de entrar a los 3 segundos y después se congela
// parece un PNG con unos pasos al principio. La cámara y los acentos son lo que
// sostiene la segunda mitad.

(() => {
  const tl = gsap.timeline({ paused: true });
  const uno = s => document.querySelector(s);
  const todos = s => [...document.querySelectorAll(s)];

  // El punto desde el que crece cada cosa. Va en el estilo y no en la
  // timeline: no se anima, se fija una vez.
  const anclar = (sel, origen) => todos(sel).forEach(el => { el.style.transformOrigin = origen; });
  anclar('.pill-seminario, .pill-gratuito', 'left center');
  anclar('.cta, #doodle, #icono_certificado', 'center center');

  // El bloque morado es un <svg> del tamaño de toda la página con la forma
  // dibujada adentro, así que "center top" sería la esquina de la página y no
  // la del bloque: achicándolo aparecía una barra morada arriba de todo. El
  // ancla se calcula desde el dibujo.
  const bloque = uno('svg.bloque');
  const forma = bloque && bloque.querySelector('path');
  if (forma) {
    const caja = forma.getBBox();
    bloque.style.transformOrigin = `${caja.x + caja.width / 2}px ${caja.y}px`;
  }

  // --- La cámara --------------------------------------------------------------
  // Un acercamiento de punta a punta. Es lo primero que hace que la pieza se
  // lea como video: el encuadre nunca está del todo quieto.
  const cam = A.camara(uno('.escena'));
  tl.fromTo(cam, { scale: 1.055, y: 14 }, { scale: 1, y: 0, duration: 8, ease: 'power1.out' }, 0);

  // El fondo se mueve además al revés que la cámara, apenas. Esa diferencia
  // entre capas es lo que da profundidad.
  tl.fromTo('.fondo', { scale: 1.03, y: -8 }, { scale: 1, y: 0, duration: 8, ease: 'none' }, 0);
  tl.fromTo('.doodle-fondo',
    { scale: 1.1, y: 22, rotation: -1.2 },
    { scale: 1, y: 0, rotation: 0, duration: 8, ease: 'power1.out' }, 0);

  // --- Cuadro 0: la miniatura -------------------------------------------------
  // Marca y encabezado ya están: ese cuadro es lo que se ve en el feed de Meta
  // antes de reproducir, y si arranca vacío la pieza se ve muerta.
  tl.fromTo('.pill-seminario', { x: -16, scaleX: 0.93 }, { x: 0, scaleX: 1, duration: 0.8, ease: 'expo.out' }, 0);
  tl.fromTo('.pill-gratuito',
    { x: -12, scale: 0.88, rotation: -4 },
    { x: 0, scale: 1, rotation: 0, duration: 0.85, ease: 'back.out(3)' }, 0.1);
  tl.fromTo('#logo', { y: -14, opacity: 0.3 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out' }, 0.12);

  // --- El título se asienta palabra por palabra -------------------------------
  // Cada palabra cae en su lugar un instante después de la anterior. No se
  // revela desde cero —se vería el cuadro 0 sin título, que es la miniatura en
  // el feed— pero el escalonado se nota igual y le saca la rigidez de un
  // bloque de texto que se mueve entero.
  const pal = A.palabras(uno('#titulo'));
  if (pal.length) {
    tl.fromTo(pal,
      { y: 13 },
      { y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.035 }, 0);
  }

  // --- El bloque morado se despliega ------------------------------------------
  // scaleY desde su borde de arriba: se desenrolla hacia abajo en vez de
  // aparecer. Es la diferencia entre una transición y un corte.
  //
  // La opacidad se enciende aparte y rápido: si fuera parte del mismo tween el
  // bloque entraría desvaído todo el despliegue, y arrancando en 0 se evita que
  // en el cuadro 0 quede una raya morada suelta en medio del afiche.
  const entraBloque = 0.55 + pal.length * 0.045 * 0.4;
  tl.fromTo('svg.bloque', { opacity: 0 }, { opacity: 1, duration: 0.14, ease: 'none' }, entraBloque);
  tl.fromTo('svg.bloque', { scaleY: 0.04 }, { scaleY: 1, duration: 0.9, ease: 'expo.out' }, entraBloque);

  // --- Docentes: fila y foto, en dos tiempos ----------------------------------
  // La fila entra desde la izquierda y la foto crece un pelo después. Ese
  // desfase de poco más de una décima es lo que hace que se lea como una
  // persona presentándose y no como un rectángulo que apareció.
  // El nombre, además, se revela palabra por palabra detrás de una máscara:
  // asoma desde atrás del renglón. Acá sí se puede, porque el bloque de
  // docentes no está en el cuadro 0.
  todos('#docentes .docente').forEach((fila, i) => {
    const t = entraBloque + 0.4 + i * 0.24;
    tl.fromTo(fila, { x: -52, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'expo.out' }, t);

    const foto = fila.querySelector('img');
    if (foto) {
      foto.style.transformOrigin = 'center center';
      tl.fromTo(foto,
        { scale: 0.35, rotation: -18 },
        { scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(2.4)' }, t + 0.14);
    }

    const nombre = A.palabras(fila.querySelector('.nombre'));
    if (nombre.length) {
      tl.fromTo(nombre,
        { yPercent: 110 },
        { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.06 }, t + 0.2);
    }
  });

  // --- Doodle: entra con rebote y después flota -------------------------------
  tl.fromTo('#doodle',
    { opacity: 0, scale: 0.7, rotation: 10 },
    { opacity: 1, scale: 1, rotation: 0, duration: 0.85, ease: 'back.out(2.2)' }, 1.45);
  // Nunca se queda quieto: sostiene la parte media del video.
  tl.fromTo('#doodle',
    { y: 0, rotation: 0 },
    { y: -14, rotation: 1.8, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: 3, immediateRender: false },
    2.4);

  // --- Fecha ------------------------------------------------------------------
  // Con un país se ve el bloque grande; con varios, la lista de banderas.
  const varios = uno('#fecham') && getComputedStyle(uno('#fecham')).display !== 'none';

  if (varios) {
    tl.fromTo('#m_num', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(2.8)' }, 1.75);
    tl.fromTo('#m_mes', { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'expo.out' }, 1.88);
    // Una fila por país, una detrás de otra: se lee como una lista que se
    // escribe sola, no como un bloque que apareció.
    todos('#m_lista .fila').forEach((f, i) => {
      tl.fromTo(f, { x: -26, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, 2.0 + i * 0.14);
    });
  } else {
    tl.fromTo('#bandera',
      { scale: 0.3, rotation: -20, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: 'back.out(2.8)' }, 1.75);
    tl.fromTo('#dia', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, 1.95);
    tl.fromTo('#hora', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'expo.out' }, 2.08);
  }

  // --- Certificado: el sello gira al acomodarse ------------------------------
  tl.fromTo('#icono_certificado',
    { scale: 0.3, rotation: -55, opacity: 0 },
    { scale: 1, rotation: 0, opacity: 1, duration: 0.9, ease: 'back.out(2.2)' }, 2.3);
  // Las dos líneas del certificado también asoman por palabra.
  [['.certificado .l1', 2.45], ['.certificado .l2', 2.56]].forEach(([sel, t]) => {
    const p = A.palabras(uno(sel));
    if (p.length) tl.fromTo(p, { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.05 }, t);
  });

  // --- El botón, al final de la cascada ---------------------------------------
  tl.fromTo('.cta',
    { y: 30, scale: 0.86, opacity: 0 },
    { y: 0, scale: 1, opacity: 1, duration: 0.9, ease: 'back.out(2.6)' }, 2.8);

  // --- Tercer momento: los acentos --------------------------------------------
  // En vez de repetir el mismo latido tres veces sobre el botón, el acento va
  // pasando de un elemento a otro. La mirada se mueve por la pieza.
  A.acento(tl, uno('.pill-gratuito'), 4.5, 1.08);
  A.acento(tl, uno(varios ? '#fecham' : '.fecha'), 5.4, 1.04);
  A.acento(tl, uno('.cta'), 6.3, 1.05);
  A.acento(tl, uno('.cta'), 7.2, 1.07);

  // El runtime busca la timeline acá, con el id de la composición como clave.
  window.__timelines = window.__timelines || {};
  window.__timelines['root'] = tl;
})();
