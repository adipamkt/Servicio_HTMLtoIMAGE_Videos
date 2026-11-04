// Convierte el afiche ya dibujado en un SVG editable.
//
// No es una captura: recorre la página y vuelve a emitir cada cosa como lo que
// es. Un bloque de color sale como rectángulo, el texto sale como texto (se
// puede corregir una tilde en Illustrator), las fotos salen como imágenes
// incrustadas y los dibujos que ya eran SVG se copian tal cual.
//
// Lo contrario sería meter el HTML dentro de un <foreignObject>: el archivo
// tendría extensión .svg y se vería bien en un navegador, pero Illustrator y
// Figma no lo abren. Eso no es editable, es un PNG con otro nombre.
//
// Corre dentro de la página, después de que la plantilla se armó. Reemplaza el
// documento por el SVG para que `chrome --dump-dom` lo pueda sacar.

window.aSvg = (raiz, ancho, alto) => {
  const base = raiz.getBoundingClientRect();
  const partes = [];

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const n = v => Math.round(v * 100) / 100;

  // Un color CSS que no pinta nada: transparente o alfa 0.
  const pinta = c => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)$/.test(c);

  // Las medidas de la tipografía, para apoyar el texto en su línea de base.
  // Se preguntan al propio navegador con un canvas: calcularlas a ojo deja el
  // texto corrido unos píxeles, que en un afiche se nota.
  const lienzo = document.createElement('canvas').getContext('2d');
  const baseDe = (fuente, texto) => {
    lienzo.font = fuente;
    const m = lienzo.measureText(texto);
    return {
      arriba: m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || 0,
      abajo: m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || 0,
    };
  };

  const rel = r => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });

  // --- Texto: una línea por cada renglón que el navegador armó ---------------
  //
  // El texto se parte donde lo partió el navegador, no donde lo partiría el
  // editor: así el SVG se ve igual que el PNG. Para saber dónde cortó cada
  // renglón se mide carácter por carácter y se agrupan los que quedaron a la
  // misma altura.
  const texto = (nodo, estilo) => {
    const contenido = nodo.textContent;
    if (!contenido.trim()) return;

    const rango = document.createRange();
    const renglones = [];

    for (let i = 0; i < contenido.length; i++) {
      rango.setStart(nodo, i);
      rango.setEnd(nodo, i + 1);
      const r = rango.getBoundingClientRect();
      if (!r.width && !r.height) continue;

      const ultimo = renglones[renglones.length - 1];
      if (ultimo && Math.abs(ultimo.top - r.top) < 2) {
        ultimo.texto += contenido[i];
        ultimo.derecha = r.right;
      } else {
        renglones.push({ top: r.top, alto: r.height, izquierda: r.left, derecha: r.right, texto: contenido[i] });
      }
    }

    const fuente = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`;
    const tam = parseFloat(estilo.fontSize);

    renglones.forEach((l, i) => {
      // Los espacios seguidos se juntan en uno, como hace el navegador: si no,
      // la sangría del HTML se cuela en el SVG y abre huecos en el texto.
      //
      // El espacio del final no se saca: cuando el texto sigue en otro
      // elemento —"¡Cupos Limitados!" y después "Inscríbete ahora" en
      // negrita— ese espacio es lo único que los separa. El del principio sí,
      // pero solo cuando el renglón viene de un corte de línea: ahí el
      // navegador lo descarta y el SVG arrancaría corrido.
      const limpio = (i === 0 ? l.texto : l.texto.replace(/^\s+/, '')).replace(/\s+/g, ' ');
      if (!limpio.trim()) return;

      const m = baseDe(fuente, limpio);
      // La línea de base va centrada dentro del renglón que armó el navegador.
      const linea = l.top - base.top + (l.alto - (m.arriba + m.abajo)) / 2 + m.arriba;

      // El texto no se estira con textLength: forzarlo al ancho exacto
      // deforma las letras y encima se nota contra el PNG. Con Poppins
      // instalada cae igual, y sin ella es preferible que se vea una
      // tipografía distinta y no uno apretujado.
      partes.push(
        `<text x="${n(l.izquierda - base.left)}" y="${n(linea)}" `
        + `font-family="${esc(estilo.fontFamily)}" font-size="${n(tam)}" `
        + `font-weight="${estilo.fontWeight}" fill="${estilo.color}" `
        // El interletrado va aparte: la plantilla lo usa en las píldoras y en
        // los datos, y sin copiarlo el texto sale más angosto o más ancho.
        + (estilo.letterSpacing && estilo.letterSpacing !== 'normal'
          ? `letter-spacing="${estilo.letterSpacing}" ` : '')
        + (estilo.fontStyle && estilo.fontStyle !== 'normal' ? `font-style="${estilo.fontStyle}" ` : '')
        + `xml:space="preserve">${esc(limpio)}</text>`);
    });
  };

  // --- Recorrido --------------------------------------------------------------
  const recorrer = el => {
    const estilo = getComputedStyle(el);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') return;
    const opacidad = Number(estilo.opacity);
    if (opacidad === 0) return;

    const r = rel(el.getBoundingClientRect());
    const tag = el.tagName.toLowerCase();
    const grupo = opacidad < 1 ? ` opacity="${opacidad}"` : '';

    // Un <svg> del afiche se copia entero: ya es vectorial.
    if (tag === 'svg') {
      const vb = el.getAttribute('viewBox');
      partes.push(
        `<svg x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}"`
        + `${vb ? ` viewBox="${vb}"` : ''}${grupo}>${el.innerHTML}</svg>`);
      return;
    }

    // Una imagen se incrusta tal cual: una foto no se puede vectorizar.
    if (tag === 'img') {
      if (!el.currentSrc && !el.src) return;
      // object-fit dice si la imagen se recorta o entra entera; object-position,
      // desde qué borde. Sin lo segundo, el doodle y las fotos de docentes
      // quedan corridos: la plantilla las ancla arriba o abajo, no al centro.
      const [px, py] = (estilo.objectPosition || '50% 50%').split(/\s+/);
      const eje = (v, chico, medio, grande) => {
        if (/^(0%|0px|left|top)$/.test(v)) return chico;
        if (/^(100%|right|bottom)$/.test(v)) return grande;
        return medio;
      };
      const alineado = 'x' + eje(px || '50%', 'Min', 'Mid', 'Max') + 'Y' + eje(py || '50%', 'Min', 'Mid', 'Max');
      const ajuste = estilo.objectFit === 'cover' ? `${alineado} slice`
        : estilo.objectFit === 'contain' ? `${alineado} meet` : 'none';
      partes.push(
        `<image x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" `
        + `preserveAspectRatio="${ajuste}"${grupo} href="${esc(el.currentSrc || el.src)}"/>`);
      return;
    }

    // El fondo del bloque, con sus esquinas redondeadas.
    if (pinta(estilo.backgroundColor) && r.w > 0 && r.h > 0) {
      const rx = Math.min(parseFloat(estilo.borderTopLeftRadius) || 0, r.w / 2, r.h / 2);
      partes.push(
        `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" `
        + `${rx ? `rx="${n(rx)}" ` : ''}fill="${estilo.backgroundColor}"${grupo}/>`);
    }

    // El borde, si lo tiene.
    const borde = parseFloat(estilo.borderTopWidth) || 0;
    if (borde > 0 && pinta(estilo.borderTopColor)) {
      const rx = Math.min(parseFloat(estilo.borderTopLeftRadius) || 0, r.w / 2, r.h / 2);
      partes.push(
        `<rect x="${n(r.x + borde / 2)}" y="${n(r.y + borde / 2)}" `
        + `width="${n(Math.max(0, r.w - borde))}" height="${n(Math.max(0, r.h - borde))}" `
        + `${rx ? `rx="${n(Math.max(0, rx - borde / 2))}" ` : ''}`
        + `fill="none" stroke="${estilo.borderTopColor}" stroke-width="${n(borde)}"${grupo}/>`);
    }

    for (const hijo of el.childNodes) {
      if (hijo.nodeType === 3) texto(hijo, estilo);
      else if (hijo.nodeType === 1) recorrer(hijo);
    }
  };

  // --- Orden de capas ---------------------------------------------------------
  //
  // El SVG pinta en el orden en que están escritas las cosas; el navegador usa
  // además z-index. Sin esto el doodle quedaba detrás del bloque morado en vez
  // de encima. Se agrupa por bloque de primer nivel, se ordena por z-index y
  // se conserva el orden original entre los que empatan.
  const grupos = [];
  for (const hijo of raiz.childNodes) {
    const desde = partes.length;
    if (hijo.nodeType === 3) texto(hijo, getComputedStyle(raiz));
    else if (hijo.nodeType === 1) recorrer(hijo);
    else continue;

    if (partes.length === desde) continue;
    const z = hijo.nodeType === 1 ? parseInt(getComputedStyle(hijo).zIndex, 10) : 0;
    grupos.push({ z: Number.isFinite(z) ? z : 0, orden: grupos.length, dibujo: partes.splice(desde) });
  }
  grupos.sort((a, b) => a.z - b.z || a.orden - b.orden);
  for (const g of grupos) partes.push(...g.dibujo);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" `
    + `width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">\n`
    + partes.join('\n') + '\n</svg>';
};
