# Propuesta de interfaz · Galpón

> Escrito el 01-10-2026, al parar E7. **Nada de esto está construido todavía.**
> Lo que hay construido es el motor (E0–E7a) y una cáscara equivocada
> (E6c–E6e) que hay que tirar.

---

## Por qué se reescribe la cáscara

Lo entregado en E6c–E6e es **una página estática de cuatro pestañas de solo
mirar**, registrada como panel de tareas. En Excel sale aplastada en una franja
de 320 px, no deja editar nada y no escribe una sola celda. No es lo que el
proyecto necesita ni lo que el diagrama pedía.

**Dos errores, y conviene dejarlos escritos:**

1. **El diagrama lo decía y no se leyó.** «Modelo 3D, **edición en 2D**, visor
   WebGL», y en el PASO 2: «el tijeral se genera de parámetros **y después se
   edita**». Se construyeron cuatro vistas de lectura. Lo editable era el punto.

2. **Se dio por imposible lo que estaba a una URL de distancia.** El commit E6e
   afirma que «el código de Retícula no está en este repositorio y lo que hay de
   ella en el disco son carpetas de exportación de ETABS», y de ahí concluye que
   no se puede adaptar su renderizador. **Eso es falso y queda corregido aquí:**
   Retícula está publicada en `vicmezap.github.io/reticula/` —la dirección que el
   propio diagrama escribe— con `taskpane.html` de 425 KB y `dialogo.html` de
   2,0 MB. Se buscó en el disco, no se encontró, y se paró en vez de mirar donde
   el diagrama señalaba.

**Lo que sí sirve y no se toca:** el motor entero, E0 a E7a, 2020 comprobaciones
y 382 filas de inventario. La parte difícil está bien. Lo que está mal es la
cáscara.

---

## La arquitectura, leída del código publicado de Retícula

| pieza | qué hace |
|---|---|
| `taskpane.html` 425 KB | El panel estrecho **es un lanzador**. Estado del libro, botón grande, guardar. Tiene los ~20 `Excel.run`: es quien escribe las hojas. |
| `dialogo.html` 2,0 MB | La aplicación entera, en `Office.context.ui.displayDialogAsync`, casi a pantalla completa. Devuelve con `messageParent`. |
| el libro | El modelo se guarda **dentro del libro**. |

Galpón copia **esta separación** y nada más. El contenido es suyo.

---

## 1 · El panel de tareas · el lanzador

Estrecho, sobrio, cuatro cosas y se acabó. No se mete aquí nada que se pueda
mirar mejor en el modelador.

```
┌────────────────────────────────────┐
│ Galpón                             │
│ Prediseño, análisis y diseño de    │
│ galpones de estructura metálica.   │
│                                    │
│ Versión        v1 · 01-10-2026     │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ LIBRO ACTUAL                   │ │
│ │ Modelo guardado            no  │ │
│ │ Pórticos                    —  │ │
│ │ Última pasada               —  │ │
│ │ Comprobaciones              —  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ╔════════════════════════════════╗ │
│ ║      ABRIR MODELADOR           ║ │
│ ╚════════════════════════════════╝ │
│ ┌────────────────────────────────┐ │
│ │  Guardar modelo en el libro    │ │
│ └────────────────────────────────┘ │
│                                    │
│ Modelador abierto.                 │
│                                    │
│ CÓMO SE USA                        │
│ 1. Abre el modelador y define el   │
│    galpón. Se predimensiona solo.  │
│ 2. En Hojas Excel elige las hojas  │
│    y púlsalo: salen rellenas.      │
│ 3. Cierra con Guardar y cerrar:    │
│    el modelo queda en el libro.    │
└────────────────────────────────────┘
```

**Diferencia con Retícula:** la ficha del libro enseña **la pasada** y **las
comprobaciones**, porque en acero el dimensionamiento es un bucle y en concreto
no. Es lo primero que uno quiere saber al volver a abrir el archivo.

---

## 2 · El modelador · el diálogo grande

Aquí vive todo. Casi a pantalla completa, como Retícula.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Galpón  [PROTOTIPO · PANEL DE EXCEL] [V1 · 01-10-2026]    GUARDADO 20:31  [Proyectos] [Guardar] │
│ Diseña el galpón entero. El cálculo se queda en las hojas.                               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ESTADO   PASO 1    PASO 2 · MODELO    PASO 3    PASO 4     PASO 5    PASO 6     PASO 7   │
│ ┌─────┐ ┌───────┐ ┌──────────┬──────┐┌────────┐┌─────────┐┌───────┐┌─────────┐┌────────┐ │
│ │INICIO│ │ DATOS │ │GEOMETRÍA │CARGAS││ANÁLISIS││ DISEÑO  ││CONEX. ││CIMENTAC.││COMPROB.│ │
│ └─────┘ └───────┘ └──────────┴──────┘└────────┘└─────────┘└───────┘└─────────┘└───⑦────┘ │
│ SALIDA   ┌─────────────┐┌──────────┐┌──────────┐                                         │
│          │ HOJAS EXCEL ││ AUTOCAD  ││ MEMORIA  │                                         │
│          └─────────────┘└──────────┘└──────────┘                                         │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ VISTA  ┌────────┐┌───────────────┐┌────────────┐┌────┐      [+ Pórtico][Duplicar][Borrar]│
│        │PÓRTICO ││PLANTA DE TECHO││ELEVACIÓN   ││ 3D │                                   │
│        └────────┘└───────────────┘└────────────┘└────┘                                   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ LUZ 20,00 m │ LARGO 60,00 m │ PÓRTICOS 11 @ 6,00 │ TECHADA 1 200 m² │ ACERO 2 309 m ·     │
│ 14,8 t │ PASADA 3 de 6 │ COMBINACIÓN  0,9D − 1,3W ▾                                      │
├───────────────┬──────────────────────────────────────────────┬───────────────────────────┤
│ DIBUJAR       │                                              │ DIAGONAL  D7              │
│               │          ╱╲                                  │ ───────────────────────── │
│ ▣ Selección   │        ╱    ╲                                │ Perfil   L2½x2½x¼  ▾      │
│   ver medidas │      ╱ ╲  ╱  ╲                               │                           │
│               │    ╱   ╲╱     ╲                              │ Pu      −4 820 kgf  compr.│
│ ■ Columna     │  ╱  ╱╲  ╱╲  ╱╲ ╲                             │ φPn      11 240 kgf       │
│ ■ Brida       │ ├──┴──┴──┴──┴──┤                             │ ratio     0,429       ✓   │
│ ■ Diagonal    │ │              │                             │ Lc/r        112           │
│ ■ Montante    │ │              │                             │ gobierna  pandeo flexión  │
│ ■ Correa      │ │              │                             │           AISC E3 [fuente]│
│ ▨ Arriostre   │ │              │                             │ ───────────────────────── │
│ ▨ C. hastial  │ │              │                             │ ⚠ AVISOS DE ESTA VISTA  2 │
│ □ Portón      │ ╧              ╧                             │ · La correa en x = 3,20 m │
│ ⌖ Apoyo       │                                              │   NO cae en un nudo.      │
│               │  [−] [▣] [+]            ejes · acotados · ⌗  │   [ver] [casar paños]     │
│               │                                              │ · Sin arriostre de techo  │
│               │                                              │   en los paños 0 a 4.     │
└───────────────┴──────────────────────────────────────────────┴───────────────────────────┘
```

---

## 3 · Lo que es propio de Galpón y no de Retícula

### 3.1 · Las vistas son del galpón, no niveles

Retícula tiene pestañas de nivel porque un edificio se apila. **Un galpón no cabe
en una planta** —lo dice el diagrama— así que las pestañas son las cuatro vistas,
y **tres de ellas se editan**:

| vista | qué se edita ahí |
|---|---|
| **PÓRTICO** | la principal. Luz, altura, tijeral, paños, perfiles. Se arrastran nudos. |
| **PLANTA DE TECHO** | correas y **arriostres de techo**: se pincha un paño y se arriostra. |
| **ELEVACIÓN** | arriostres de fachada, portones, columnas hastiales. |
| **3D** | solo ver. Isométrica, que sí se puede medir. |

### 3.2 · La pasada, en la barra de métricas

En concreto predimensionas y sigues. En acero cambias la sección, cambia la
rigidez y hay que reanalizar. **`PASADA 3 de 6`** siempre a la vista, y al
cambiar un perfil se pone en amarillo hasta que se reanaliza. Retícula no tiene
esto porque no lo necesita.

### 3.3 · El selector de combinación

**`COMBINACIÓN 0,9D − 1,3W ▾`** en la barra de métricas, y el dibujo cambia con
ella: las barras se colorean por ratio y **los signos se invierten**. La diagonal
que en gravedad tracciona, en levantamiento comprime. Es la tesis del proyecto
puesta donde se ve.

### 3.4 · Los avisos del panel derecho SON LAS GUARDAS

Retícula dice «CRUCE VACÍO · Sin columna en B-2'». Galpón tiene ya escritos sus
avisos, y cada uno viene de un módulo que hoy **lanza una excepción**:

| aviso | de dónde sale |
|---|---|
| «La correa en x = 3,20 m NO cae en un nudo» | `tijeral.js`, fila `G.correa.nudo` |
| «Sin arriostre de techo: no resiste a lo largo» | `montaje.js`, fila `MT.dos.direcciones` |
| «Techo y fachada en paños distintos: 30 m de alero a axial» | `montaje.js`, fila `MT.mismo.pano` |
| «Resiste pero NO arriostra» | `arriostres.js`, Apéndice 6 |
| «Hay cortante en la base y no hay llave» | `placabase.js`, fila `J.anclaje.solo.traccion` |

**Y cada aviso lleva su botón de acción**, que es lo que lo convierte en
herramienta: *[casar paños]* llama a `generador.panelesParaCorreas()`,
*[arriostrar]* marca el paño. El motor ya sabe decir qué hay que hacer; falta
que el botón lo haga.

### 3.5 · El botón `fuente`, en todas partes

Lo único de la cáscara entregada que se salva. Cada cifra con su fila del
inventario y su artículo de norma. En el modelador grande vale mucho más: se
pincha el ratio de una barra y sale el AISC E3 con su texto.

### 3.6 · La insignia de COMPROBACIÓN

Como el `86` de Retícula, pero contando **los avisos de los módulos**, no errores
de dibujo. Y al lado, lo que es de Galpón: `382 filas · 0 sin fuente · 3
pendientes`.

---

## 4 · Orden de construcción propuesto

| | | |
|---|---|---|
| **1** | `panel.js` + el diálogo vacío con la barra de pasos | que abra y cierre, que guarde en el libro |
| **2** | La vista **PÓRTICO**, editable | arrastrar nudos, cambiar perfiles, repintar |
| **3** | El panel contextual + los avisos | convertir las excepciones en avisos con acción |
| **4** | **PLANTA** y **ELEVACIÓN** editables | pinchar un paño y arriostrarlo |
| **5** | **HOJAS EXCEL** | `Excel.run` escribiendo las hojas de cálculo |
| **6** | **3D** y **AUTOCAD** | lo último, que es lo que menos falta hace |

Lo 1 a 3 es lo que convierte esto en una herramienta. Lo demás es ampliar.

---

## 5 · Lo que queda pendiente del motor

- **`conexiones.js`** — Capítulo J: soldaduras de filete, pernos, aplastamiento
  y desgarramiento. El inventario ya tiene sus 19 filas levantadas. **Es donde
  nos quedamos.**
- E8 cimentación · E9 salida · E10 puente a SAP2000
- Tres pendientes de norma: `J.anclaje.concreto` (ACI 318 Cap. 17),
  `G.peralte`, `MT.alfa`

---

## 6 · La fontanería de Retícula, leída de su código publicado

Cinco cosas que no hay que inventar. Las cinco salen de
`vicmezap.github.io/reticula/taskpane.html`.

**El diálogo.** `displayDialogAsync(url, {height:88, width:88, displayInIframe:false})`.
88 % × 88 % y **fuera de iframe**: eso es el «menú grande».

**El sello de minuto en la URL**, y su comentario explica por qué:
«el modelador cachea con ganas. Poner solo BUILD no basta: si el propio panel
quedó viejo en caché, pediría la URL vieja y WebView2 le devolvería el diálogo
viejo. El sello de minuto rompe esa cadena.» La URL lleva `?v=BUILD&t=minuto`.

**El canal.** JSON con campo de acción `a`. El diálogo pide con `{a:"pide"}`;
el panel contesta con `messageChild`, que **exige DialogApi 1.2** —hoy el
manifiesto de Galpón solo declara ExcelApi 1.1—. Los mensajes largos van
troceados: `{a, i, n, d}` y se recomponen al otro lado.

**El modelo vive en hojas dedicadas del libro**, serializado a texto y escrito
**en trozos por la columna A, `A1:A200`**, con tope duro: si pasa de 200 trozos,
«el modelo no cabe en la hoja oculta». Retícula usa cuatro hojas: MODELO, ETABS,
RESULTADOS y BIBLIOTECA.

**Y la trampa que ya costó un fallo**, documentada en su propio código: «ANTES
esto se leía de localStorage, y esa era la mitad del fallo: la ventana del
modelador tiene su propia partición de almacenamiento, así que lo que ella
guardaba nunca llegaba aquí.» **El diálogo y el panel NO comparten
`localStorage`.** El modelo viaja por mensaje, obligatoriamente.

---

## 7 · DECISIÓN TOMADA · parámetros contra ediciones

**Manda la edición: el modelo se suelta.** En cuanto se toca algo a mano, el
modelo se desengancha de los parámetros y estos quedan de **solo lectura**, como
el historial de cómo nació. Para volver a parametrizar hay que **regenerar desde
cero**, y eso se pide a propósito y se confirma.

Lo que esto obliga, y es bueno que obligue:

- El modelo tiene estado: `paramétrico` → `suelto`, y el paso es de ida.
  La vuelta existe pero es un botón explícito, *Regenerar desde los parámetros*,
  que descarta lo editado y lo dice antes.
- **La pantalla nunca puede mentir**: no existe un estado en el que los
  parámetros que se ven no describan la geometría que se ve. Con las otras dos
  opciones sí existía, y por eso esta es la que se eligió.
- Es comprobable en Node, sin Excel: una máquina de estados pequeña.

**Y una consecuencia en `vistas.js` que hay que atender.** Hoy hay cinco
procedencias —`norma`, `entrada`, `geometria`, `conteo`, `medido`— y una cota
arrastrada a mano no es ninguna de ellas. Hace falta una sexta:

    editado    lo movió el proyectista a mano

No es burocracia: una dimensión que viene de un parámetro **es reproducible** y
una que se arrastró **no lo es**, y en una pantalla que presume de decir de
dónde sale cada número, esa diferencia es justo la que hay que declarar.

---

## 8 · El siguiente paso · E6'a, el lanzador y el diálogo vacío

No dibuja nada. Prueba la fontanería, que es lo único que no se puede
comprobar desde fuera de Excel.

| | | probable en Node |
|---|---|---|
| `src/libro.js` | serializar, trocear en ≤200 celdas, recomponer · negarse si no cabe | **sí** |
| `src/panel.js` | el estado de la ficha del libro · la máquina paramétrico/suelto | **sí** |
| `gen_complemento.py` | hornear DOS páginas: `taskpane.html` estrecho y `modelador.html` grande | sí |
| el manifiesto | añadir **DialogApi 1.2** | parcial |
| el diálogo | abre a 88×88, barra de pasos, pide el modelo, lo devuelve al cerrar | **no — solo en Excel** |

---

## 9 · RECTIFICACIÓN · el galpón no se dibuja

> 01-10-2026. Lo señaló el proyectista mirando la primera versión:
> «entiendo que yo no voy a dibujar; si yo no voy a dibujar esa opción no
> sirve, solo serviría si es que me va a aislar elementos».

Tenía razón, y el error fue **de método, no de gusto**.

**El criterio debería haber sido: ¿qué tiene de libre este modelo?** En
Retícula la planta es libre de verdad —las columnas van donde van, los vanos
son irregulares, hay vacíos y ejes inclinados—, y ahí una paleta de dibujo es
imprescindible. **En un galpón no hay nada libre:** todo sale de la luz, el
largo, la separación de pórticos, la pendiente, los paños y la tipología del
alma. No hay nada que dibujar a mano.

Se copió la forma de la herramienta de al lado sin preguntar si el problema de
debajo era el mismo. No lo era.

### Lo que un galpón sí necesita

Un modelo de **733 barras que no se dibuja** necesita poder **mirarse**:

| | |
|---|---|
| **Ver y aislar** | apagar las correas para ver el alma, aislar las diagonales. Una capa por clase, con su cuenta y su botón de *solo*. |
| **Seleccionar** | pinchar una barra y que diga qué es: clase, nudos, longitud, perfil, peso. El equivalente del «CRUCE VACÍO · Sin columna en B-2'» de Retícula. |
| **Girar la 3D arrastrando** | azimut y elevación como campos numéricos no es «moverla a tu gusto». |

Eso sustituye a la paleta. **La maquinaria de capas de edición (§7) se queda**
—cuesta poco y cubre la excepción de mover un nudo suelto— pero deja de ser el
centro: la interacción principal de Galpón es **elegir, filtrar e inspeccionar**,
no dibujar.

### Lo que esto cambia del orden de construcción (§8)

El paso «la vista PÓRTICO, editable» **ya no es el siguiente**. Lo siguiente de
verdad es el **PASO 3, ANÁLISIS**, porque es lo único que falta para que la
selección diga un ratio en vez de «falta el análisis», y el ratio es lo que el
proyectista viene a buscar.
