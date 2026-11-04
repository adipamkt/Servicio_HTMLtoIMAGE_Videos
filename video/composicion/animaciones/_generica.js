// La animación de reserva: la que se usa cuando una pieza todavía no tiene la
// suya escrita a mano.
//
// No sabe qué es cada cosa. Separa los bloques que llevan texto de los que son
// decoración y los hace entrar en el orden en que están escritos en la página,
// que en estas plantillas es el orden en que se leen.
//
// Queda por debajo de una animación propia, que sabe lo que está moviendo: la
// del seminario despliega el bloque morado desde su borde de arriba y hace
// entrar a cada docente junto con su foto. Esto no puede saber eso. Lo que sí
// comparte son los tres recursos que hacen que una pieza no parezca una lista
// de elementos apareciendo: la cámara, el texto que asoma por palabra y los
// acentos repartidos en la segunda mitad.
//
// Por qué por orden del documento y no por posición en la pantalla: varias
// plantillas colocan sus bloques con un script, después de ajustar el título a
// la tipografía ya cargada. Medir posiciones obliga a esperar a que eso
// termine, y para entonces el runtime ya capturó los primeros cuadros: el
// video salía con el afiche entero en el cuadro 0 y los bloques desapareciendo
// después. El orden del documento ya es correcto apenas se arma la página.
//
// Reglas de HyperFrames: la timeline se crea en pausa y el runtime la va
// posicionando frame por frame, a veces con varios procesos en paralelo que
// saltan a distintos momentos. Por eso se animan transform y opacity nada más,
// y todo va con `fromTo` y valores absolutos: con un valor relativo, cada
// proceso leería algo distinto y el video saldría con saltos.

(() => {
  const tl = gsap.timeline({ paused: true });
  const escena = document.querySelector('.escena');
  if (!escena) return;

  const visible = el => {
    const e = getComputedStyle(el);
    return e.display !== 'none' && e.visibility !== 'hidden' && Number(e.opacity) > 0;
  };

  const bloques = [...escena.children].filter(visible);

  // Con texto es contenido: una píldora, un título, una fecha, una tarjeta de
  // datos. Sin texto es decoración: manchas, ondas, ilustraciones, el logo.
  const conTexto = el => el.textContent.trim().length > 0;
  const contenido = bloques.filter(conTexto);
  const decoracion = bloques.filter(el => !conTexto(el));

  // --- La cámara --------------------------------------------------------------
  // Un acercamiento de punta a punta: el encuadre nunca está del todo quieto.
  const cam = A.camara(escena);
  tl.fromTo(cam, { scale: 1.05, y: 12 }, { scale: 1, y: 0, duration: 8, ease: 'power1.out' }, 0);

  // --- Decoración: cada capa a su velocidad ----------------------------------
  // Que no se muevan todas igual es lo que da profundidad. Nunca desaparece:
  // está desde el cuadro 0 y solo deriva.
  decoracion.forEach((el, i) => {
    const fuerza = 1 + (i % 3) * 0.6;
    el.style.transformOrigin = 'center center';
    tl.fromTo(el,
      { scale: 1 + 0.022 * fuerza, y: -7 * fuerza, rotation: i % 2 ? 0.5 : -0.5 },
      { scale: 1, y: 0, rotation: 0, duration: 8, ease: 'power1.out' }, 0);
  });

  // --- Encabezado: ya está en el cuadro 0, solo se asienta -------------------
  // Ese cuadro es la miniatura en el feed de Meta: si arranca vacío, la pieza
  // se ve muerta antes de que alguien la reproduzca. Por eso acá el texto se
  // asienta y no se revela: revelarlo dejaría el título fuera del cuadro 0.
  contenido.slice(0, 2).forEach((el, i) => {
    el.style.transformOrigin = 'left center';
    const pal = A.palabras(el);
    if (pal.length > 1) {
      tl.fromTo(pal, { y: 12 }, { y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.03 }, i * 0.08);
    } else {
      tl.fromTo(el, { y: 12, scale: 1.015 }, { y: 0, scale: 1, duration: 0.8, ease: 'expo.out' }, i * 0.08);
    }
  });

  // --- El resto entra con ritmo ----------------------------------------------
  const resto = contenido.slice(2);

  if (resto.length) {
    const paso = Math.min(0.24, 2.4 / resto.length);

    resto.forEach((el, i) => {
      el.style.transformOrigin = 'center center';
      const t = 0.6 + i * paso;

      // Uno sí y uno no entra de costado; el resto sube. Mezclar las dos cosas
      // da variedad sin que se vuelva un desfile de bloques volando, que es a
      // lo que suena cuando todo entra de la misma manera.
      const costado = i % 2 === 1;
      tl.fromTo(el,
        costado
          ? { x: 38, y: 0, scale: 0.96, opacity: 0 }
          : { x: 0, y: 30, scale: 0.96, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.75, ease: 'back.out(1.7)' }, t);

      // Y su texto asoma por palabra desde atrás del renglón, un instante
      // después de que llegó el bloque. Solo en los cortos: en un párrafo
      // largo el escalonado se haría eterno y se leería como un teletipo.
      const pal = A.palabras(el);
      if (pal.length > 1 && pal.length <= 10) {
        tl.fromTo(pal,
          { yPercent: 110 },
          { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.05 }, t + 0.18);
      }
    });

    // --- Los acentos -----------------------------------------------------------
    // En vez de repetir el mismo latido sobre el último bloque, el acento va
    // pasando de uno a otro: la mirada se mueve por la pieza en la segunda
    // mitad, que si no queda muerta.
    const ultimos = resto.slice(-3);
    [4.5, 5.6, 6.8].forEach((t, i) => {
      A.acento(tl, ultimos[i % ultimos.length], t, 1.04 + i * 0.012);
    });
  }

  // El runtime busca la timeline acá, con el id de la composición como clave.
  window.__timelines = window.__timelines || {};
  window.__timelines['root'] = tl;
})();
