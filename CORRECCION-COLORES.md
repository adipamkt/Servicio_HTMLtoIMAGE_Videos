# Corrección de colores — nodo `Armar HTML piezas`

Buscar y reemplazar dentro del código del nodo. Son 31 reemplazos en total,
repartidos entre las cinco plantillas que contiene el nodo.

| Buscar | Reemplazar | Veces | Qué es |
|---|---|---|---|
| `#6F4EFC` | `#704EFD` | 9 | morado de identidad |
| `#FAFAFF` | `#FFFFFF` | 5 | fondo de página |
| `#EDEFFF` | `#F3F4FF` | 4 | manchas del fondo |
| `#FCC460` | `#FFC728` | 4 | amarillo de énfasis |
| `#93F1F1` | `#CBE8FF` | 3 | "Participación" sobre el morado |
| `#0A1C42` | `#091E42` | 3 | navy de texto |
| `#DED4FE` | `#DFD5FF` | 3 | fondo de la foto de docente |

Después queda el bloque `:root` así:

```css
:root {
  --morado: #704EFD;
  --amarillo: #FFC728;
  --azul-oscuro: #091E42;
  --cian: #CBE8FF;
  --fondo: #FFFFFF;
}
```

## Las dos decisiones que no son un reemplazo mecánico

**El fondo pasa a blanco.** La plantilla usaba dos grises distintos (`#FAFAFF` de
página y `#EDEFFF` de manchas) para que las manchas se notaran. En el manual hay
un solo gris de marca, así que la página pasa a blanco y las manchas al gris
oficial. Se mantiene la misma diferencia entre capa y capa.

**El turquesa NO va al cian secundario.** Lo lógico sería `#93F1F1 → #2CB7FF`,
pero sobre el bloque morado ese cian da **2.22 de contraste** y deja de ser
legible (el mínimo accesible es 3.0). El cian secundario es para fondos claros.
Sobre morado corresponde el azul claro `#CBE8FF`, que da **3.94** — el mismo
nivel que tenía el turquesa aproximado.

Contraste antes y después:

| | Antes | Después |
|---|---|---|
| Botón: morado sobre amarillo | 3.15 | 3.21 |
| Certificado: azul sobre morado | 3.86 | 3.94 |

## Pendiente: los otros seis nodos

Los demás tipos de programa tienen el mismo problema, peor. Hay al menos diez
morados apenas distintos entre sí donde debería haber uno:

| Nodo | Colores distintos | Fuera del manual |
|---|---|---|
| Armar HTML piezas | 18 | 17 |
| Armar HTML curso | 48 | 45 |
| Armar HTML sesión | 8 | 4 |
| Armar HTML especialización | 20 | 18 |
| Armar HTML diplomado | 11 | 11 |
| Armar HTML acreditación | 15 | 13 |
| Armar HTML V2 | 33 | 33 |

Ejemplos del mismo color repetido con variaciones: `704EF9`, `704EFC`, `6F4EFA`,
`6F4EFC`, `6F4EF8`, `674FF8` — todos deberían ser `#704EFD`. Y en amarillo:
`FFC35A`, `FFC760`, `FDC660`, `FBC360`, `FAC167`, `FCC460`.

Es el patrón típico de sacar el color con gotero desde una captura, que es
justamente lo que el manual prohíbe.

**No se corrigieron acá** porque no es un reemplazo mecánico: cada caso necesita
revisar el contraste, como pasó con el turquesa. Y algunos grises (`#5B5B5B`,
`#B2B2B2`, `#7D8DB0`) pueden ser texto secundario intencional, que el manual no
especifica.
