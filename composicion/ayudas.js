// Los recursos de animación que comparten todas las piezas.
//
// Se inyecta antes que la animación, así que `A` ya existe cuando esta corre.
//
// Acá están las tres cosas que separan una animación hecha de una lista de
// elementos que aparecen: una cámara que se mueve, texto que se revela por
// palabra detrás de una máscara, y un sacudón corto para marcar un acento.

window.A = (() => {
  // --- La cámara --------------------------------------------------------------
  //
  // La escena es la raíz de la composición y no se puede transformar, así que
  // se le mete adentro una capa que contiene todo y esa sí se mueve. Un
  // acercamiento lento durante los 8 segundos es lo que hace que la pieza se
  // lea como video y no como un afiche con cosas que entran.
  const camara = escena => {
    const cam = document.createElement('div');
    cam.className = 'camara';
    cam.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 50%';
    while (escena.firstChild) cam.appendChild(escena.firstChild);
    escena.appendChild(cam);
    return cam;
  };

  // --- Texto por palabra, detrás de una máscara -------------------------------
  //
  // Cada palabra queda dentro de una cajita que recorta, y adentro un span que
  // sube desde abajo. El efecto es que las palabras asoman desde atrás del
  // renglón en vez de aparecer de la nada.
  //
  // Se respeta el HTML que ya tenía el elemento: el título trae un <b> con la
  // primera parte, y eso se conserva. Solo se tocan los nodos de texto.
  //
  // Las palabras se separan con espacios de verdad, no con margen, así el
  // texto sigue cortando los renglones donde los cortaba antes.
  const palabras = el => {
    if (!el) return [];
    const interiores = [];

    const partir = nodo => {
      for (const hijo of [...nodo.childNodes]) {
        if (hijo.nodeType === 3) {
          const trozos = hijo.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          for (const trozo of trozos) {
            if (!trozo) continue;
            if (/^\s+$/.test(trozo)) { frag.appendChild(document.createTextNode(trozo)); continue; }
            const caja = document.createElement('span');
            caja.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:bottom';
            const dentro = document.createElement('span');
            dentro.style.cssText = 'display:inline-block';
            dentro.textContent = trozo;
            caja.appendChild(dentro);
            frag.appendChild(caja);
            interiores.push(dentro);
          }
          nodo.replaceChild(frag, hijo);
        } else if (hijo.nodeType === 1) {
          partir(hijo);
        }
      }
    };

    partir(el);
    return interiores;
  };

  // --- Un acento ---------------------------------------------------------------
  //
  // Un golpe corto de escala para marcar un momento. Va con fromTo y valores
  // absolutos para que dé igual en qué momento del video se posicione el
  // runtime: con varios procesos renderizando en paralelo, un valor relativo
  // sale distinto en cada uno.
  const acento = (tl, objetivo, cuando, fuerza = 1.04) => {
    if (!objetivo) return;
    tl.fromTo(objetivo, { scale: 1 }, { scale: fuerza, duration: 0.26, ease: 'sine.out', immediateRender: false }, cuando);
    tl.fromTo(objetivo, { scale: fuerza }, { scale: 1, duration: 0.44, ease: 'sine.inOut', immediateRender: false }, cuando + 0.26);
  };

  return { camara, palabras, acento };
})();
