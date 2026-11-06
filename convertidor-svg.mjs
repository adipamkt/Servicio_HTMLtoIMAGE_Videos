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
// Corre dentro de la página, después de que la plantilla se armó.

// Se exporta como función y no como archivo suelto a propósito: así la
// importa quien la usa, y el empaquetador de Vercel la ve y la incluye. Leída
// del disco con `readFileSync` no la veía, y el SVG fallaba una vez desplegado
// aunque anduviera en la máquina.
//
// Tiene que ser autónoma —sin nada de afuera— porque viaja a la página como
// texto: Puppeteer la convierte en string y la ejecuta allá adentro.
export const aSvg = (ancho, alto) => {
  const raiz = document.body;
  const base = raiz.getBoundingClientRect();

  // Los degradados, los recortes y los desvanecidos se declaran una vez acá y
  // se nombran desde el dibujo.
  const defs = [];
  let cuenta = 0;
  const nuevoId = p => `${p}-${++cuenta}`;

  // Las comillas también: el nombre de una tipografía con espacios viene
  // entrecomillado desde el navegador —"Times New Roman"— y metido tal cual
  // dentro de un atributo rompe el archivo. Illustrator no abre un SVG que no
  // sea XML válido.
  const esc = s => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const n = v => Math.round(v * 100) / 100;

  // Un color CSS que no pinta nada: transparente o alfa 0.
  const pinta = c => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)$/.test(c);

  const rel = r => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });

  // El radio de las esquinas, acotado para que no se pase del bloque.
  //
  // Puede venir en porcentaje: `border-radius: 50%` es el círculo que la
  // plantilla usa para las manchas de fondo y para las fotos redondas, y mide
  // la mitad del bloque, no 50 píxeles. Van los dos ejes por separado porque
  // con un bloque que no es cuadrado el círculo es una elipse.
  const radioDe = (estilo, r) => {
    const v = String(estilo.borderTopLeftRadius || '0').trim().split(/\s+/);
    const eje = (txt, total) => txt.endsWith('%')
      ? (parseFloat(txt) || 0) * total / 100
      : (parseFloat(txt) || 0);
    return {
      rx: Math.min(eje(v[0], r.w), r.w / 2),
      ry: Math.min(eje(v[1] || v[0], r.h), r.h / 2),
    };
  };

  // Los atributos de las esquinas de un <rect>, o nada si es recto.
  const esquinasDe = (rx, ry) =>
    rx > 0 || ry > 0 ? `rx="${n(rx)}" ry="${n(ry)}" ` : '';

  // --- Leer valores de CSS ----------------------------------------------------
  //
  // Chrome devuelve los valores ya normalizados: los colores siempre como
  // rgb()/rgba() y los degradados sin la dirección cuando es la de por
  // defecto. Lo que sigue está escrito contra eso, no contra lo que dice la
  // hoja de estilos.

  // Corta por las comas de primer nivel: las de rgb(...) no cuentan.
  const porComas = s => {
    const salida = [];
    let prof = 0, act = '';
    for (const ch of s) {
      if (ch === '(') prof++;
      else if (ch === ')') prof--;
      if (ch === ',' && prof === 0) { salida.push(act.trim()); act = ''; continue; }
      act += ch;
    }
    if (act.trim()) salida.push(act.trim());
    return salida;
  };

  const alfaDe = color => {
    const m = String(color).match(/^rgba?\(([^)]*)\)$/);
    if (!m) return color === 'transparent' ? 0 : 1;
    const partes = m[1].split(',').map(v => v.trim());
    return partes.length > 3 ? Number(partes[3]) : 1;
  };

  // La dirección del degradado, en grados de CSS: 0 es hacia arriba y crece en
  // el sentido de las agujas del reloj.
  const RUMBOS = {
    'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270,
    'to top right': 45, 'to right top': 45,
    'to bottom right': 135, 'to right bottom': 135,
    'to bottom left': 225, 'to left bottom': 225,
    'to top left': 315, 'to left top': 315,
  };
  const esRumbo = t => /^(to\s|[-\d.]+(deg|grad|rad|turn)$)/i.test(t.trim());
  const gradosDe = t => {
    const txt = t.trim().toLowerCase();
    let m;
    if ((m = txt.match(/^([-\d.]+)deg$/))) return Number(m[1]);
    if ((m = txt.match(/^([-\d.]+)turn$/))) return Number(m[1]) * 360;
    if ((m = txt.match(/^([-\d.]+)rad$/))) return Number(m[1]) * 180 / Math.PI;
    if ((m = txt.match(/^([-\d.]+)grad$/))) return Number(m[1]) * 0.9;
    return RUMBOS[txt] ?? 180;
  };

  // Las paradas de color: "rgb(1,2,3) 0%" -> { color, pos }. Las que no traen
  // posición se reparten parejo, como hace el navegador.
  const paradasDe = trozos => {
    const paradas = trozos.map(t => {
      const m = t.match(/^(.*?)\s+([-\d.]+)%$/);
      return m ? { color: m[1].trim(), pos: Number(m[2]) } : { color: t.trim(), pos: null };
    });
    if (paradas.length) {
      if (paradas[0].pos === null) paradas[0].pos = 0;
      if (paradas[paradas.length - 1].pos === null) paradas[paradas.length - 1].pos = 100;
    }
    // Los huecos del medio se reparten entre la parada conocida anterior y la
    // siguiente.
    for (let i = 0; i < paradas.length; i++) {
      if (paradas[i].pos !== null) continue;
      let j = i;
      while (j < paradas.length && paradas[j].pos === null) j++;
      const desde = paradas[i - 1].pos, hasta = paradas[j].pos;
      const pasos = j - i + 1;
      for (let k = i; k < j; k++) paradas[k].pos = desde + (hasta - desde) * (k - i + 1) / pasos;
      i = j - 1;
    }
    return paradas;
  };

  // Los dos extremos de la línea del degradado, dentro del bloque. Es la
  // fórmula de CSS: el largo de la línea es la proyección del bloque sobre
  // ella, no su diagonal.
  const extremos = (grados, r) => {
    const t = (grados % 360) * Math.PI / 180;
    const dx = Math.sin(t), dy = -Math.cos(t);
    const largo = Math.abs(r.w * dx) + Math.abs(r.h * dy);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return {
      x1: cx - dx * largo / 2, y1: cy - dy * largo / 2,
      x2: cx + dx * largo / 2, y2: cy + dy * largo / 2,
    };
  };

  // Un degradado de CSS -> un <linearGradient>/<radialGradient> declarado.
  // Devuelve con qué pintar, o null si no se entendió.
  //
  // `comoAlfa` es para los desvanecidos: ahí lo que importa no es el color de
  // cada parada sino su transparencia, así que se emite blanco con esa misma
  // transparencia. Un degradado de negro opaco a negro transparente tapa y
  // destapa; si se copiaran los colores tal cual, el negro opaco taparía todo.
  const degradado = (css, r, comoAlfa = false) => {
    const m = String(css).match(/^(linear|radial)-gradient\((.*)\)$/s);
    if (!m) return null;

    const trozos = porComas(m[2]);
    if (!trozos.length) return null;

    const rumbo = esRumbo(trozos[0]) || /^(at\s|circle|ellipse|closest|farthest)/i.test(trozos[0])
      ? trozos.shift() : null;
    const paradas = paradasDe(trozos);
    if (paradas.length < 2) return null;

    const dentro = paradas.map(p => {
      const color = comoAlfa ? 'rgb(255,255,255)' : p.color;
      const op = alfaDe(p.color);
      return `<stop offset="${n(p.pos)}%" stop-color="${esc(color)}"`
        + (op < 1 ? ` stop-opacity="${n(op)}"` : '') + '/>';
    }).join('');

    const id = nuevoId(comoAlfa ? 'fade' : 'deg');
    if (m[1] === 'radial') {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const rad = Math.sqrt((r.w / 2) ** 2 + (r.h / 2) ** 2);
      defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" `
        + `cx="${n(cx)}" cy="${n(cy)}" r="${n(rad)}">${dentro}</radialGradient>`);
    } else {
      const e = extremos(gradosDe(rumbo || 'to bottom'), r);
      defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" `
        + `x1="${n(e.x1)}" y1="${n(e.y1)}" x2="${n(e.x2)}" y2="${n(e.y2)}">${dentro}</linearGradient>`);
    }
    return { id, pintura: `url(#${id})` };
  };

  // El desvanecido (mask-image) -> un <mask> declarado. Devuelve su id.
  const desvanecido = (estilo, r) => {
    const css = estilo.maskImage && estilo.maskImage !== 'none'
      ? estilo.maskImage
      : (estilo.webkitMaskImage && estilo.webkitMaskImage !== 'none' ? estilo.webkitMaskImage : null);
    if (!css) return null;

    const g = degradado(css, r, true);
    if (!g) return null;

    const id = nuevoId('mascara');
    defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" `
      + `x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}">`
      + `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" fill="${g.pintura}"/>`
      + `</mask>`);
    return id;
  };

  // El recorte (clip-path) -> un <clipPath> declarado. Las coordenadas del
  // path van desde la esquina del bloque, no desde la de la página.
  const recorte = (estilo, r) => {
    const css = String(estilo.clipPath || 'none');
    if (css === 'none') return null;

    const p = css.match(/^path\((?:[a-z-]+\s*,\s*)?["']([^"']+)["']\)$/i);
    if (!p) return null;

    const id = nuevoId('recorte');
    defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse">`
      + `<path d="${esc(p[1])}" transform="translate(${n(r.x)} ${n(r.y)})"/></clipPath>`);
    return id;
  };

  // --- Texto ------------------------------------------------------------------
  //
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

  // Lo que la plantilla pide con text-transform. El navegador lo aplica al
  // dibujar, pero el texto del documento sigue como se escribió: sin esto los
  // títulos salían en minúscula en el SVG y en mayúscula en el PNG.
  const transformar = (s, como) =>
    como === 'uppercase' ? s.toUpperCase()
      : como === 'lowercase' ? s.toLowerCase()
        : como === 'capitalize' ? s.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase())
          : s;

  // Una línea por cada renglón que el navegador armó.
  //
  // El texto se parte donde lo partió el navegador, no donde lo partiría el
  // editor: así el SVG se ve igual que el PNG. Para saber dónde cortó cada
  // renglón se mide carácter por carácter y se agrupan los que quedaron a la
  // misma altura.
  const texto = (nodo, estilo, salida) => {
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
    const como = estilo.textTransform;

    renglones.forEach((l, i) => {
      // Los espacios seguidos se juntan en uno, como hace el navegador: si no,
      // la sangría del HTML se cuela en el SVG y abre huecos en el texto.
      //
      // El espacio del final no se saca: cuando el texto sigue en otro
      // elemento —"¡Cupos Limitados!" y después "Inscríbete ahora" en
      // negrita— ese espacio es lo único que los separa. El del principio sí,
      // pero solo cuando el renglón viene de un corte de línea: ahí el
      // navegador lo descarta y el SVG arrancaría corrido.
      const limpio = transformar(
        (i === 0 ? l.texto : l.texto.replace(/^\s+/, '')).replace(/\s+/g, ' '), como);
      if (!limpio.trim()) return;

      const m = baseDe(fuente, limpio);
      // La línea de base va centrada dentro del renglón que armó el navegador.
      const linea = l.top - base.top + (l.alto - (m.arriba + m.abajo)) / 2 + m.arriba;

      // El texto no se estira con textLength: forzarlo al ancho exacto
      // deforma las letras y encima se nota contra el PNG. Con Poppins
      // instalada cae igual, y sin ella es preferible que se vea una
      // tipografía distinta y no uno apretujado.
      salida.push(
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

  // --- El fondo de un bloque --------------------------------------------------
  const fondo = (el, estilo, r, salida) => {
    if (!(r.w > 0 && r.h > 0)) return;
    const { rx, ry } = radioDe(estilo, r);
    const esquinas = esquinasDe(rx, ry);

    // El color, si pinta.
    if (pinta(estilo.backgroundColor)) {
      salida.push(`<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" `
        + `${esquinas}fill="${estilo.backgroundColor}"/>`);
    }

    // El degradado, encima del color. Es lo que pinta el fondo de casi todas
    // las piezas: sin esto el SVG salía transparente.
    const img = estilo.backgroundImage;
    if (img && img !== 'none') {
      const g = degradado(img, r);
      if (g) {
        salida.push(`<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" `
          + `${esquinas}fill="${g.pintura}"/>`);
      } else {
        // Una foto puesta como fondo: se incrusta igual que un <img>.
        const u = img.match(/^url\(["']?([^"')]+)["']?\)$/);
        if (u) {
          const ajuste = estilo.backgroundSize === 'contain' ? 'xMidYMid meet'
            : estilo.backgroundSize === 'cover' ? 'xMidYMid slice' : 'none';
          salida.push(`<image x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" `
            + `preserveAspectRatio="${ajuste}" href="${esc(u[1])}"/>`);
        }
      }
    }

    // El borde. Casi nunca es el bloque entero: la plantilla marca los
    // docentes y las viñetas con una barra de un solo lado, así que cada lado
    // se mira por separado. Dibujarlos como un recuadro, que es lo que se
    // hacía, dejaba esas barras afuera.
    const lados = [
      ['Top', r.x, r.y, r.w, null],
      ['Right', null, r.y, null, r.h],
      ['Bottom', r.x, null, r.w, null],
      ['Left', r.x, r.y, null, r.h],
    ].map(([lado, x, y, w, h]) => ({
      lado, x, y, w, h,
      grosor: parseFloat(estilo[`border${lado}Width`]) || 0,
      color: estilo[`border${lado}Color`],
      trazo: estilo[`border${lado}Style`],
    })).filter(s => s.grosor > 0 && s.trazo !== 'none' && s.trazo !== 'hidden' && pinta(s.color));

    if (!lados.length) return;

    // Los cuatro lados iguales son un recuadro, y así respeta las esquinas
    // redondeadas.
    const todosIguales = lados.length === 4
      && lados.every(s => s.grosor === lados[0].grosor && s.color === lados[0].color);

    if (todosIguales) {
      const g = lados[0].grosor;
      salida.push(
        `<rect x="${n(r.x + g / 2)}" y="${n(r.y + g / 2)}" `
        + `width="${n(Math.max(0, r.w - g))}" height="${n(Math.max(0, r.h - g))}" `
        + esquinasDe(Math.max(0, rx - g / 2), Math.max(0, ry - g / 2))
        + `fill="none" stroke="${lados[0].color}" stroke-width="${n(g)}"/>`);
      return;
    }

    for (const s of lados) {
      const x = s.lado === 'Right' ? r.x + r.w - s.grosor : r.x;
      const y = s.lado === 'Bottom' ? r.y + r.h - s.grosor : r.y;
      const w = s.w === null ? s.grosor : s.w;
      const h = s.h === null ? s.grosor : s.h;
      salida.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" `
        + `fill="${s.color}"/>`);
    }
  };

  // Las funciones de una lista de CSS: "grayscale(1) contrast(1.05)" ->
  // [['grayscale','1'], ['contrast','1.05']].
  //
  // Hay que contar los paréntesis en vez de buscar el primero que cierra,
  // porque adentro puede haber otro: Chrome escribe los colores como
  // `rgb(255, 255, 255)` y el contorno blanco de las fotos recortadas se
  // perdía por eso.
  const funciones = css => {
    const salida = [];
    const re = /([a-z-]+)\(/gi;
    let m;
    while ((m = re.exec(css))) {
      let prof = 1, j = re.lastIndex;
      while (j < css.length && prof > 0) {
        if (css[j] === '(') prof++;
        else if (css[j] === ')') prof--;
        j++;
      }
      salida.push([m[1].toLowerCase(), css.slice(re.lastIndex, j - 1).trim()]);
      re.lastIndex = j;
    }
    return salida;
  };

  // Una sombra de CSS -> el paso de filtro que la dibuja. Sirve igual para
  // `drop-shadow(...)` y para `box-shadow`, que se escriben parecido: el
  // color puede ir antes o después de los números.
  const sombra = txt => {
    const color = (txt.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i) || ['#000'])[0];
    const [dx = 0, dy = 0, desenfoque = 0] =
      (txt.replace(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
    return `<feDropShadow dx="${n(dx)}" dy="${n(dy)}" stdDeviation="${n(desenfoque / 2)}" `
      + `flood-color="${esc(color)}"/>`;
  };

  // Las sombras del bloque. Pueden venir varias separadas por coma; las de
  // adentro (`inset`) no se pueden hacer así y se saltean.
  const sombras = estilo => {
    const css = String(estilo.boxShadow || 'none');
    if (css === 'none') return [];
    return porComas(css).filter(s => !/\binset\b/.test(s)).map(sombra);
  };

  // --- Filtros ----------------------------------------------------------------
  //
  // `filter: grayscale(1)` es lo que deja en blanco y negro la foto de fondo de
  // casi todas las piezas. Sin esto salía a todo color.
  const filtro = estilo => {
    const css = String(estilo.filter || 'none');
    const pasos = [];
    for (const [fn, arg] of (css === 'none' ? [] : funciones(css))) {
      // Los porcentajes y los números dicen lo mismo: 35% es 0,35.
      const num = (txt, porDefecto) => {
        if (!txt) return porDefecto;
        return txt.endsWith('%') ? parseFloat(txt) / 100 : parseFloat(txt);
      };
      // Un cambio lineal de cada canal: brillo mueve la pendiente, contraste
      // la mueve y recentra.
      const lineal = (pendiente, corte) => `<feComponentTransfer>`
        + ['R', 'G', 'B'].map(c =>
          `<feFunc${c} type="linear" slope="${n(pendiente)}" intercept="${n(corte)}"/>`).join('')
        + `</feComponentTransfer>`;

      if (fn === 'grayscale') pasos.push(`<feColorMatrix type="saturate" values="${n(1 - num(arg, 1))}"/>`);
      else if (fn === 'saturate') pasos.push(`<feColorMatrix type="saturate" values="${n(num(arg, 1))}"/>`);
      else if (fn === 'brightness') pasos.push(lineal(num(arg, 1), 0));
      else if (fn === 'contrast') { const k = num(arg, 1); pasos.push(lineal(k, (1 - k) / 2)); }
      else if (fn === 'opacity') pasos.push(`<feComponentTransfer><feFuncA type="linear" slope="${n(num(arg, 1))}" intercept="0"/></feComponentTransfer>`);
      else if (fn === 'invert') pasos.push(`<feComponentTransfer>`
        + ['R', 'G', 'B'].map(c => `<feFunc${c} type="table" tableValues="${n(num(arg, 1))} ${n(1 - num(arg, 1))}"/>`).join('')
        + `</feComponentTransfer>`);
      else if (fn === 'blur') pasos.push(`<feGaussianBlur stdDeviation="${n(parseFloat(arg) || 0)}"/>`);
      else if (fn === 'drop-shadow') pasos.push(sombra(arg));
    }

    // La sombra del bloque es otra propiedad, pero en SVG se dibuja con lo
    // mismo. El desparramo (el cuarto número) no tiene equivalente y se
    // ignora: son sombras de adorno, de uno o dos píxeles.
    for (const s of sombras(estilo)) pasos.unshift(s);

    if (!pasos.length) return null;

    const id = nuevoId('filtro');
    // La zona del filtro se agranda: una sombra que se sale del bloque se
    // cortaría con el recuadro de por defecto.
    defs.push(`<filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" `
      + `color-interpolation-filters="sRGB">${pasos.join('')}</filter>`);
    return id;
  };

  // --- Recorrido --------------------------------------------------------------
  //
  // Devuelve lo que dibuja el elemento y todo lo que tiene adentro.
  const recorrer = el => {
    const estilo = getComputedStyle(el);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') return [];
    const opacidad = Number(estilo.opacity);
    if (opacidad === 0) return [];

    const r = rel(el.getBoundingClientRect());
    const tag = el.tagName.toLowerCase();
    const salida = [];

    if (tag === 'svg') {
      // Un <svg> del afiche se copia entero: ya es vectorial.
      const vb = el.getAttribute('viewBox');
      salida.push(
        `<svg x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}"`
        + `${vb ? ` viewBox="${vb}"` : ''}>${el.innerHTML}</svg>`);
    } else if (tag === 'img') {
      // Una imagen se incrusta tal cual: una foto no se puede vectorizar.
      const src = el.currentSrc || el.src;
      if (src) {
        // object-fit dice si la imagen se recorta o entra entera;
        // object-position, desde qué borde. Sin lo segundo, el doodle y las
        // fotos de docentes quedan corridos: la plantilla las ancla arriba o
        // abajo, no al centro.
        const [px, py] = (estilo.objectPosition || '50% 50%').split(/\s+/);
        const eje = (v, chico, medio, grande) => {
          if (/^(0%|0px|left|top)$/.test(v)) return chico;
          if (/^(100%|right|bottom)$/.test(v)) return grande;
          return medio;
        };
        const alineado = 'x' + eje(px || '50%', 'Min', 'Mid', 'Max') + 'Y' + eje(py || '50%', 'Min', 'Mid', 'Max');
        const ajuste = estilo.objectFit === 'cover' ? `${alineado} slice`
          : estilo.objectFit === 'contain' ? `${alineado} meet` : 'none';
        salida.push(
          `<image x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" `
          + `preserveAspectRatio="${ajuste}" href="${esc(src)}"/>`);
      }
    } else {
      // Un texto en línea con fondo —las frases resaltadas— se parte en
      // varios renglones, y cada uno tiene su propio recuadro. Pintar la caja
      // que los abarca a todos taparía el hueco del final de cada renglón.
      const cajas = el.getClientRects();
      if (cajas.length > 1) for (const c of cajas) fondo(el, estilo, rel(c), salida);
      else fondo(el, estilo, r, salida);

      for (const hijo of el.childNodes) {
        if (hijo.nodeType === 3) texto(hijo, estilo, salida);
        else if (hijo.nodeType === 1) salida.push(...recorrer(hijo));
      }
    }

    if (!salida.length) return [];

    // --- Lo que envuelve al bloque --------------------------------------------
    //
    // El recorte, el desvanecido y la transparencia se aplican al conjunto, no
    // a cada pieza: por eso van en un <g> alrededor. `overflow: hidden` entra
    // acá también, porque en SVG no existe: hay que recortar a mano con la
    // forma del propio bloque.
    const atributos = [];

    const idRecorte = recorte(estilo, r);
    const { rx, ry } = radioDe(estilo, r);

    // Chrome dice que una imagen recorta su propio desborde, lo cual en un SVG
    // no significa nada: recortarla a su propia caja no cambia el dibujo y
    // solo agrega ruido al archivo. Lo que sí cambia es el redondeo, que en un
    // <image> no existe: las fotos redondas de los docentes hay que recortarlas
    // a mano o salen cuadradas.
    const reemplazado = tag === 'img' || tag === 'svg';
    const recortaDesborde = reemplazado
      ? rx > 0 || ry > 0
      : estilo.overflow === 'hidden' || estilo.overflow === 'clip';

    if (idRecorte) {
      atributos.push(`clip-path="url(#${idRecorte})"`);
    } else if (recortaDesborde && r.w > 0 && r.h > 0) {
      const id = nuevoId('caja');
      defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse">`
        + `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" `
        + `${esquinasDe(rx, ry)}/></clipPath>`);
      atributos.push(`clip-path="url(#${id})"`);
    }

    const idMascara = desvanecido(estilo, r);
    if (idMascara) atributos.push(`mask="url(#${idMascara})"`);

    const idFiltro = filtro(estilo);
    if (idFiltro) atributos.push(`filter="url(#${idFiltro})"`);

    // El modo de fusión: la plantilla apoya el logo de ADIPA con `multiply`
    // para que su fondo blanco desaparezca. Va como estilo y no como atributo
    // porque en SVG es una propiedad de CSS.
    const fusion = estilo.mixBlendMode;
    if (fusion && fusion !== 'normal') atributos.push(`style="mix-blend-mode:${fusion}"`);

    if (opacidad < 1) atributos.push(`opacity="${opacidad}"`);

    return atributos.length
      ? [`<g ${atributos.join(' ')}>`, ...salida, '</g>']
      : salida;
  };

  // --- Orden de capas ---------------------------------------------------------
  //
  // El SVG pinta en el orden en que están escritas las cosas; el navegador usa
  // además z-index. Sin esto el doodle quedaba detrás del bloque morado en vez
  // de encima. Se agrupa por bloque de primer nivel, se ordena por z-index y
  // se conserva el orden original entre los que empatan.
  const partes = [];

  // El fondo del propio <body> va primero y aparte: el recorrido arranca en
  // sus hijos, así que antes no se dibujaba nunca. Es el degradado de la
  // pieza entera.
  fondo(raiz, getComputedStyle(raiz), rel(base), partes);

  const grupos = [];
  for (const hijo of raiz.childNodes) {
    const dibujo = [];
    if (hijo.nodeType === 3) texto(hijo, getComputedStyle(raiz), dibujo);
    else if (hijo.nodeType === 1) dibujo.push(...recorrer(hijo));
    else continue;
    if (!dibujo.length) continue;

    const z = hijo.nodeType === 1 ? parseInt(getComputedStyle(hijo).zIndex, 10) : 0;
    grupos.push({ z: Number.isFinite(z) ? z : 0, orden: grupos.length, dibujo });
  }
  grupos.sort((a, b) => a.z - b.z || a.orden - b.orden);
  for (const g of grupos) partes.push(...g.dibujo);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" `
    + `width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">\n`
    + (defs.length ? `<defs>\n${defs.join('\n')}\n</defs>\n` : '')
    + partes.join('\n') + '\n</svg>';
};
