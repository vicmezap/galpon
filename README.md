# Galpón · Estructuras Metálicas

Complemento de Excel (Office.js) para el prediseño, análisis y diseño de
galpones de estructura metálica. Segundo miembro de la suite **MEZAP**, junto a
**Retícula** (concreto armado).

```
pestaña de Excel   Galpón
repo               vicmezap/galpon
GitHub Pages       vicmezap.github.io/galpon
```

---

## La regla del proyecto

> **Ningún número entra al código sin fila en el inventario.
> Sin fuente primaria leída, no entra.**

No es una buena intención: está en `src/inventario.js` y la comprueba
`pruebas/probar_inventario.js`. Pedir una magnitud que no existe **lanza**, no
devuelve `undefined`. Un conflicto sin decisión escrita rompe la prueba.

El inventario son **390 filas en `inventario/*.json`**, una por cada número,
fórmula, límite y criterio que el complemento calcula, con su artículo de norma
o su página de libro:

```
316 verificado   ·   42 adoptado   ·   29 conflicto   ·   0 criterio propio   ·   3 pendientes
```

*Verificado* = leído en el texto original. *Adoptado* = fuente reconocida pero
no normativa, citada. *Conflicto* = dos normas discrepan y la decisión está
escrita. *Pendiente* = falta el documento.

Hay **tres pendientes**, y los tres son documentos que faltan, no cálculos sin
hacer:

**`J.anclaje.concreto`** — las ecuaciones del lado del concreto del perno de
anclaje viven en el ACI 318 Cap. 17, que es una norma de pago y no está en la
carpeta. No se transcribe de segunda mano.

**`G.peralte`** — no hay en toda la biblioteca del proyecto una relación
peralte/luz recomendada para armaduras de techo. Se buscó. Lo que McCormac
llama «la relación más conveniente de peralte a claro ≈ 1/24» está en el
párrafo de **largueros** y es del larguero; el 1/25 de la AASHTO es de puentes
y el 1/20 es contra vibración de entrepisos. Así que el peralte del tijeral es
dato de entrada obligatorio y `generador.js` se niega a inventarlo.

**`MT.alfa`** — el coeficiente de dilatación térmica del acero a temperatura
ambiente. El AISC 360-22 sí da uno, en el Apéndice 4: es el de **incendio**, y
el propio texto lo condiciona a temperaturas sobre 66 °C. Tomarlo para el salto
ambiental de 30 °C que manda la E.020 Art. 15 sería la misma falta que la del
párrafo anterior. Así que la longitud que no puede dilatar se da en metros y el
alargamiento en milímetros no se calcula.

La lista de pendientes está **fijada por nombre en la prueba**: cerrar uno es
una línea menos ahí, y abrir uno nuevo sale en rojo.

---

## Bases normativas

| Materia | Manda | Respaldo |
|---|---|---|
| Diseño de acero | **AISC 360-22** | E.090-2020 (doble referencia en cada `ART`) |
| Método | **LRFD** | |
| Combinaciones | **E.090 §1.4.1** | la crítica: `0,9D − 1,3W` |
| Cargas y viento | **E.020** Art. 7, 11 y 12 | |
| Sismo | **E.030-2026** | |
| Concreto | **E.060** | pedestal y zapata |
| Conformado en frío | AISI S100 | fase 2 |

**Unidades:** m · cm · kgf · kg/cm² · km/h. La conversión ocurre **una sola vez**,
al importar un catálogo (`src/unidades.js`). Aguas abajo no existe ninguna
pulgada.

---

## El complemento

`python scripts/hornear.py` deja en `complemento/` **dos** páginas, y la
separación es la del proyecto:

| | | |
|---|---|---|
| `panel.html` | 3 módulos · 262 KB | el **lanzador** en la franja de Excel: estado del libro y botones. No calcula, así que no lleva el catálogo. |
| `modelador.html` | 27 módulos · 1,7 MB | **la aplicación**, en un diálogo de 88 % × 88 % que abre el panel |

Más su `manifest.xml`, los iconos y una portada. GitHub Actions lo publica en
cada push a `main`, y **solo si las pruebas pasan**: hornear → probar →
publicar, en ese orden.

El modelador tiene barra de **pasos** (nueve, más las dos salidas), paleta de
herramientas, lienzo, métricas vivas y panel contextual. Y cuatro vistas:
**Pórtico**, **Planta de techo**, **Elevación longitudinal** y **3D** — la 3D
**arranca en isométrica a propósito**, porque en perspectiva dos pórticos
idénticos no miden lo mismo en pantalla y una vista que invita a comparar tiene
que poder compararse.

Los pasos que todavía no tienen pantalla **lo dicen y nombran el módulo que los
hará**, en vez de enseñar una maqueta: una pestaña que parece hecha y está
vacía engaña más que una que avisa.

Para instalarlo en Excel: *Insertar › Mis complementos › Cargar mi complemento*,
y se apunta a `https://vicmezap.github.io/galpon/manifest.xml`. Aparece una
pestaña **Galpón** en la cinta.

La misma página se abre en un navegador sin Excel, y es un uso legítimo: Office
solo añade poder volcar a la hoja.

**Ninguna cifra de la pantalla sale sin decir de dónde viene.** Las que son
normativas llevan un botón `fuente` que abre su fila del inventario con su
artículo; las demás llevan escrita su procedencia —dato, geometría, conteo o
medido— y **no** llevan botón, porque colgarle una norma a un número que salió
de contar barras invita a creérselo. Lo declara `src/vistas.js` y una línea sin
procedencia hace que el módulo lance.

---

## Cómo se corre

```bash
python scripts/hornear.py           # hornea lo publicable: visor, inventario, complemento
node pruebas/correr.js              # todas las pruebas, un veredicto
node pruebas/correr.js unidades     # solo las que coincidan
```

**Hornear primero.** Lo publicable no va versionado —es salida de un generador—,
así que en un clon limpio no existe, y dos pruebas comprueban precisamente que
corresponde al código. Python solo hace falta para los generadores: el motor de
cálculo es JavaScript puro y se prueba con el Node que traiga la máquina.

Las pruebas corren también en GitHub Actions en cada push, horneando antes.

Y antes de cada commit, si instalas los hooks:

```bash
sh scripts/instalar_hooks.sh     # una vez por clon
```

`githooks/pre-commit` corre las pruebas y **rechaza el commit si no pasan**.
Existe porque pasó: en E1b se arregló un fallo del CI y el arreglo salió con un
error de sintaxis, porque se cometió sin correr las pruebas. El error se habría
cazado en dos segundos. Para saltárselo con motivo: `git commit --no-verify`.

---

## Estructura

```
src/
  inventario.js    el inventario cargado como código · ART y DEF
  unidades.js      la frontera del sistema de unidades
  proyecto.js      guardar y abrir el proyecto .json
  bundle.js        alDiaOMuere() · ¿estoy probando lo que acabo de escribir?
  generador.js     el tijeral paramétrico · 4 cuerdas × 4 almas · Maxwell y rango
  montaje.js       el galpón entero en tres planos · el camino de carga
  vistas.js        las 4 pestañas como DATOS · ninguna cifra sin procedencia
  vista3d.js       cámara y proyección · isométrica, que sí se puede medir
  placabase.js     placa de apoyo, pernos y llave de corte · AISC J8 y Zapata 9.7-9.8
  conexiones.js    Cap. J · filetes, pernos, elementos de conexión, extremos empernados y soldados
  libro.js         el modelo en el libro · serializa, trocea, y las capas de edición
  panel.js         lo que enseña el panel de tareas · es un lanzador, no la aplicación
inventario/
  *.json           las filas del inventario, trece secciones (el total lo da inventario.html)
pruebas/
  correr.js        el runner
  _comun.js        comp · cerca · cierto · lanza · fin
  probar_*.js      una por módulo · 2350 comprobaciones
catalogos/
  aisc.json        1575 perfiles laminados    · AISC Shapes Database v13
  fam.json          391 perfiles soldados     · serie VS/CS/CVS, ABNT NBR 5884
  precor.json       442 conformados en frio   · L U C Z TC IC TU IU, en espera
  coberturas/
    tr4.json        tabla de cargas del panel · transcrita de una IMAGEN, verificada
                   2408 en total · 1966 calculables hoy · 442 esperan la AISI S100
scripts/
  gen_inventario.py    inventario/*.json  ->  inventario/inventario.html
  importa_aisc.py      lee el .xls del AISC (fuera del repo)
  importa_fam.py       extraccion posicional del PDF de FAM (fuera del repo)
  importa_precor.py    extraccion posicional del PDF de Precor, 15 paginas
  hornear.py           LOS TRES GENERADORES, en orden. El comando que hay que recordar
  gen_visor.py         el banco de cargas de E2
  gen_complemento.py   el complemento de Excel: taskpane, manifiesto, iconos, portada
  complemento.plantilla.html   la pagina, antes de hornearle los modulos dentro
```

El inventario vive **solo aquí**. No hay copia fuera del repositorio: el JSON es
la fuente, `inventario.html` es la vista y `src/inventario.js` es el acceso desde
el código. Tres usos, un solo dato.

---

## Dos guardas que existen desde el primer commit

**`bundle.alDiaOMuere()`** — comprueba que el complemento generado es posterior
a todo lo que lo genera. En Retícula esta guarda nació después de dos incidentes
en un mismo día: editar un módulo, no regenerar, y probar contra el bundle
viejo. Sale verde comprobando código que ya no existe.

**El proyecto guarda casos de carga, nunca combinaciones.** Viene de la fila
`Z.costura` del inventario: la E.090 (acero) usa `0,9D − 1,3W` y la E.060
(concreto) usa `0,9CM − 1,25CVi`. Cada norma tiene que armar las suyas. Pasar
una reacción ya combinada de una a otra es un error que ningún resultado
delata, y por eso `agregaCarga()` lo rechaza.

---

## Estado

**E0 a E6 cerradas.** El complemento calcula un galpón completo de punta a
punta —geometría, cargas, análisis, diseño— y además **se ve**: cuatro
pestañas, un manifiesto de Office y una página publicable. Todo verificable en
Node y en CI, incluida la página entera, que se ejecuta contra un DOM de
juguete en cada corrida.

| | | |
|---|---|---|
| **E0** esqueleto | runner · CI · `alDiaOMuere` · proyecto `.json` | ✅ |
| **E1** catálogos | 2408 perfiles · propiedades de sección | ✅ |
| **E2** cargas | E.020 · viento · E.030 · combinaciones | ✅ |
| **E3** motor | modelo · solver · estabilidad · solo-tracción | ✅ |
| **E4** AISC | caps. D, E, F, G y H con doble referencia | ✅ |
| **E5** piezas | elemento · bucle · correas · tijeral · columnas · arriostres | ✅ |
| **E6** interfaz | generador · montaje · complemento · vistas · vista3d | ✅ |
| **E7** conexiones | placa base · Cap. J: filetes, pernos, elementos, extremos | ✅ |
| **E8** cimentación | pedestal · zapatas | ⬜ |
| **E9** salida | hojas · metrado · planos | ⬜ |
| **E10** control | puente a SAP2000 | ⬜ |
