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

El inventario son **349 filas en `inventario/*.json`**, una por cada número,
fórmula, límite y criterio que el complemento calcula, con su artículo de norma
o su página de libro:

```
308 verificado   ·   11 adoptado   ·   29 conflicto   ·   0 criterio propio   ·   1 pendiente
```

*Verificado* = leído en el texto original. *Adoptado* = fuente reconocida pero
no normativa, citada. *Conflicto* = dos normas discrepan y la decisión está
escrita. *Pendiente* = falta el documento.

El único pendiente es **`J.anclaje.concreto`**: las ecuaciones del lado del
concreto del perno de anclaje viven en el ACI 318 Cap. 17, que es una norma de
pago y no está en la carpeta. No se transcribe de segunda mano. La lista de
pendientes está **fijada por nombre en la prueba**: cerrar uno es una línea
menos ahí, y abrir uno nuevo sale en rojo.

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

## Cómo se corre

```bash
node pruebas/correr.js              # todas las pruebas, un veredicto
node pruebas/correr.js unidades     # solo las que coincidan
```

Sin dependencias. El motor de cálculo es JavaScript puro y se prueba con el Node
que traiga la máquina. Las pruebas corren también en GitHub Actions en cada push.

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
inventario/
  *.json           las 349 filas, diez secciones
pruebas/
  correr.js        el runner
  _comun.js        comp · cerca · cierto · lanza · fin
  probar_*.js      una por módulo · 1410 comprobaciones
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
  gen_complemento.py   genera lo publicable a GitHub Pages   (etapa E6)
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

**Etapa E0** — esqueleto, runner, CI, guarda de bundle y proyecto `.json`.

Siguientes: E1 catálogos y propiedades de sección · E2 cargas · E3 solucionador ·
E4 diseño AISC · E5 elementos. Con E0–E5 el complemento calcula un galpón
completo **sin una sola pantalla**, verificable en CI.
