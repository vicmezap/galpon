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
