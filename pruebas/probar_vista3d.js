/* =====================================================================
   probar_vista3d.js — la cámara y la proyección

   Una vista 3D no se comprueba mirándola: se comprueba con geometría que
   ya se sabe cómo tiene que salir.  Aquí hay tres clases de comprobación y
   ninguna es «parece correcto»:

   1) PROPIEDADES EXACTAS de la proyección paralela.  Dos segmentos iguales
      y paralelos miden lo mismo en pantalla estén donde estén; en una
      isométrica de verdad, un metro en x, uno en y y uno en z miden lo
      mismo.  El ángulo atan(1/√2) se comprueba MIDIÉNDOLO, no citándolo.

   2) LA MATRIZ Y proyecta() TIENEN QUE COINCIDIR, punto por punto.  La MVP
      existe para que el día que entre WebGL el cambio sea de una línea; si
      nadie la comprobara, ese día se descubriría que no sirve.

   3) LA CIFRA QUE DECIDE LA PROYECCIÓN POR OMISIÓN: cuánto miente la
      perspectiva sobre dos pórticos idénticos.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const V3 = require("../src/vista3d.js");
const MON = require("../src/montaje.js");
const INV = require("../src/inventario.js");

const D = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20,
  cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5],
  columnasHastiales: [5, 10, 15]
};
const m3 = MON.monta(D);

/* ================================================================
   1 · LA ISOMÉTRICA ES LA ISOMÉTRICA, Y SE MIDE
   ================================================================ */
cerca("la elevación isométrica es atan(1/√2)", V3.ISO_ELEVACION,
  Math.atan(1 / Math.SQRT2) * 180 / Math.PI, 1e-12);
cerca("o sea 35,2644°", V3.ISO_ELEVACION, 35.264390, 1e-6);
comp("y el azimut, 45°", V3.ISO_AZIMUT, 45);

/* LO QUE ESE ÁNGULO SIGNIFICA, medido: un metro en cada eje tiene que dar
   el MISMO largo en pantalla.  Si la elevación fuera otra, no. */
const iso = V3.camara({ tipo: "isometrica", objetivo: [0, 0, 0],
  distancia_m: 100, anchoVista_m: 10, aspecto: 1 });
const o = V3.proyecta(iso, [0, 0, 0]);
const largo = (p) => {
  const q = V3.proyecta(iso, p);
  return Math.sqrt(Math.pow(q.x - o.x, 2) + Math.pow(q.y - o.y, 2));
};
const lx = largo([1, 0, 0]), ly = largo([0, 1, 0]), lz = largo([0, 0, 1]);
cerca("un metro en x y uno en y miden lo mismo en pantalla", lx, ly, 1e-12);
cerca("y uno en z, igual", lx, lz, 1e-12);
cierto("los tres miden algo, no cero", lx > 0);

/* Y con otra elevación DEJA de cumplirse: la prueba de arriba no pasa sola. */
const torcida = V3.camara({ tipo: "ortografica", azimut: 45, elevacion: 20,
  objetivo: [0, 0, 0], distancia_m: 100, anchoVista_m: 10, aspecto: 1 });
const o2 = V3.proyecta(torcida, [0, 0, 0]);
const largo2 = (p) => {
  const q = V3.proyecta(torcida, p);
  return Math.sqrt(Math.pow(q.x - o2.x, 2) + Math.pow(q.y - o2.y, 2));
};
cierto("a 20° de elevación, el metro vertical YA NO mide igual que el horizontal",
  Math.abs(largo2([0, 1, 0]) - largo2([1, 0, 0])) > 1e-3);

/* ================================================================
   2 · LA PROYECCIÓN PARALELA NO DEFORMA
   ================================================================ */
const orto = V3.camara({ tipo: "ortografica", azimut: 30, elevacion: 25,
  objetivo: [0, 0, 0], distancia_m: 200, anchoVista_m: 100, aspecto: 1 });
function mide(c, a, b) {
  const pa = V3.proyecta(c, a), pb = V3.proyecta(c, b);
  return Math.sqrt(Math.pow(pb.x - pa.x, 2) + Math.pow(pb.y - pa.y, 2));
}
/* dos segmentos verticales iguales, uno a 40 m del otro en profundidad */
const cerca1 = mide(orto, [0, 0, -20], [0, 6, -20]);
const lejos1 = mide(orto, [0, 0, 20], [0, 6, 20]);
cerca("en paralela, dos columnas iguales miden lo mismo", cerca1, lejos1, 1e-12);
cierto("y están de verdad a distinta profundidad",
  Math.abs(V3.proyecta(orto, [0, 0, -20]).prof - V3.proyecta(orto, [0, 0, 20]).prof) > 10);

const persp = V3.camara({ tipo: "perspectiva", azimut: 30, elevacion: 25,
  objetivo: [0, 0, 0], distancia_m: 200, anchoVista_m: 100, aspecto: 1 });
const cerca2 = mide(persp, [0, 0, -20], [0, 6, -20]);
const lejos2 = mide(persp, [0, 0, 20], [0, 6, 20]);
cierto("en perspectiva NO miden lo mismo", Math.abs(cerca2 - lejos2) > 1e-6);
cierto("y la de más lejos sale más pequeña, que es lo que tiene que pasar",
  (V3.proyecta(persp, [0, 0, 20]).prof > V3.proyecta(persp, [0, 0, -20]).prof)
    ? lejos2 < cerca2 : cerca2 < lejos2);

/* Las dos cámaras enseñan EL MISMO ancho EN EL PLANO DEL OBJETIVO: sin eso,
   comparar la deformación sería comparar dos encuadres distintos.
   El segmento tiene que estar DENTRO de ese plano, no cruzarlo: lo escribí
   primero a lo largo de x y fallaba por 5 · 10⁻⁴, porque sus extremos están
   a profundidades distintas y en perspectiva eso ya deforma. Va a lo largo
   del vector «derecha» de la cámara, que es el plano del objetivo. */
const r = orto.base.r;
const pA = [orto.objetivo[0] - 10 * r[0], orto.objetivo[1] - 10 * r[1],
  orto.objetivo[2] - 10 * r[2]];
const pB = [orto.objetivo[0] + 10 * r[0], orto.objetivo[1] + 10 * r[1],
  orto.objetivo[2] + 10 * r[2]];
cerca("ahí sí, paralela y perspectiva encuadran exactamente igual",
  mide(orto, pA, pB), mide(persp, pA, pB), 1e-12);
cerca("y los dos extremos están a la misma profundidad, que es la condición",
  V3.proyecta(persp, pA).prof, V3.proyecta(persp, pB).prof, 1e-12);

/* ================================================================
   3 · LA MATRIZ Y proyecta() DAN EL MISMO PUNTO
   La MVP existe para que entre WebGL con un cambio de una línea. Si nadie
   la comprobara, ese día se descubriría que no sirve.
   ================================================================ */
for (const [nombre, c] of [["ortográfica", orto], ["perspectiva", persp], ["isométrica", iso]]) {
  const M = V3.matriz(c);
  comp("la MVP " + nombre + " tiene 16 números", M.length, 16);
  comp("y ninguno es NaN", M.filter((x) => isNaN(x)).length, 0);
  let peor = 0;
  for (const n of m3.nudos) {
    const p = [n.x_m, n.y_m, n.z_m];
    const a = V3.proyecta(c, p);
    const b = V3.aplica(M, p);
    peor = Math.max(peor, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  cierto("la matriz " + nombre + " coincide con proyecta() en los 314 nudos (peor: " +
    peor.toExponential(1) + ")", peor < 1e-9);
}
/* Y la multiplicación de matrices es la de verdad: identidad por M da M. */
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const Mo = V3.matriz(orto);
comp("I·M = M", V3.multiplica(I, Mo).map((x) => +x.toFixed(12)),
  Mo.map((x) => +x.toFixed(12)));

/* ================================================================
   4 · EL ENCUADRE
   ================================================================ */
const enc = V3.encuadra(m3, V3.camara({ tipo: "isometrica", aspecto: 16 / 9 }));
let dentro = 0, fuera = 0;
for (const n of m3.nudos) {
  const q = V3.proyecta(enc, [n.x_m, n.y_m, n.z_m]);
  if (Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1) dentro++; else fuera++;
}
comp("encuadrado, NINGÚN nudo se sale del cuadro", fuera, 0);
comp("y están los 314 dentro", dentro, m3.nudos.length);
cierto("la cámara apunta al centro del galpón",
  Math.abs(enc.objetivo[2] - 30) < 1e-9 && Math.abs(enc.objetivo[0] - 10) < 1e-9);
cierto("y todo queda delante de la cámara, no detrás",
  m3.nudos.every((n) => V3.proyecta(enc, [n.x_m, n.y_m, n.z_m]).prof > 0));

/* En perspectiva, el encuadre tiene que alejarse lo suficiente o habría
   puntos detrás de la cámara, que no se pueden proyectar. */
const encP = V3.encuadra(m3, V3.camara({ tipo: "perspectiva", aspecto: 16 / 9 }));
cierto("también en perspectiva todo queda delante",
  m3.nudos.every((n) => V3.proyecta(encP, [n.x_m, n.y_m, n.z_m]).prof > 0));
comp("y nada se sale del cuadro",
  m3.nudos.filter((n) => {
    const q = V3.proyecta(encP, [n.x_m, n.y_m, n.z_m]);
    return Math.abs(q.x) > 1.0001 || Math.abs(q.y) > 1.0001;
  }).length, 0);

/* ================================================================
   5 · LA ESCENA · fila V.profundidad
   ================================================================ */
const esc = V3.escena(m3, enc);
comp("un segmento por barra", esc.segmentos.length, m3.barras.length);
let monotono = true;
for (let i = 1; i < esc.segmentos.length; i++) {
  if (esc.segmentos[i].prof > esc.segmentos[i - 1].prof + 1e-12) monotono = false;
}
cierto("ORDENADOS DE ATRÁS HACIA DELANTE, sin una sola excepción", monotono);
cierto("y la atenuación los acompaña: el primero más tenue que el último",
  esc.segmentos[0].atenuacion <= esc.segmentos[esc.segmentos.length - 1].atenuacion);
cerca("lo más cercano va a opacidad plena",
  esc.segmentos[esc.segmentos.length - 1].atenuacion, 1, 1e-9);
cerca("y lo más lejano al mínimo declarado", esc.segmentos[0].atenuacion,
  V3.ATENUACION_MIN, 1e-9);
comp("todas las atenuaciones caen dentro del rango",
  esc.segmentos.filter((s) => s.atenuacion < V3.ATENUACION_MIN - 1e-9 ||
    s.atenuacion > 1 + 1e-9).length, 0);

/* NO SE QUITAN LÍNEAS OCULTAS, y se dice: un alambre no tiene caras. */
cierto("la escena declara que no hay líneas ocultas", esc.lineasOcultas === false);
cierto("y explica por qué", /no tiene caras/.test(esc.nota));

/* ================================================================
   6 · LA CIFRA QUE DECIDE LA PROYECCIÓN · fila V.isometrica
   ================================================================ */
const dIso = V3.distorsion(m3, enc);
const dPer = V3.distorsion(m3, encP);
cerca("en isométrica, dos columnas idénticas miden EXACTAMENTE lo mismo",
  dIso.razon, 1, 1e-12);
comp("y por eso el dibujo se puede medir", dIso.medible, true);
cierto("las dos columnas comparadas están lejos de verdad",
  dIso.masLejos.prof - dIso.masCerca.prof > 40);

cierto("en perspectiva, la lejana sale más pequeña", dPer.razon < 1);
cierto("y el error no es despreciable: más del 15 %", dPer.errorPorCiento > 15);
comp("así que esa vista NO se puede medir", dPer.medible, false);
cierto("y la nota lo dice con el número delante",
  /% de la m[áa]s cercana/.test(dPer.nota) && /no se puede medir/.test(dPer.nota));
cierto("la cámara por omisión es la que SÍ se puede medir",
  V3.camara({}).tipo === "isometrica" && V3.camara({}).paralela === true);

/* ================================================================
   7 · LO QUE TIENE QUE PARAR
   ================================================================ */
lanza("una proyección que no existe PARA", () => V3.camara({ tipo: "fotografica" }),
  "no existe");
lanza("mirar desde el cenit exacto PARA",
  () => V3.camara({ tipo: "ortografica", elevacion: 90 }), "indefinida");
cierto("y explica que la base se vuelve indefinida",
  (() => {
    try { V3.camara({ tipo: "ortografica", elevacion: 90 }); }
    catch (e) { return /cenit/.test(e.message) && /arriba/.test(e.message); }
  })());
lanza("distancia cero PARA", () => V3.camara({ distancia_m: 0 }), "distancia_m");
lanza("ancho de vista cero PARA", () => V3.camara({ anchoVista_m: 0 }), "anchoVista_m");

/* UN PUNTO DETRÁS DE LA CÁMARA NO SE PROYECTA, y no se proyecta a medias:
   lo que saldría es el punto espejado, una barra donde no está. */
const pegada = V3.camara({ tipo: "perspectiva", azimut: 0, elevacion: 0,
  objetivo: [0, 0, 0], distancia_m: 10, anchoVista_m: 20, aspecto: 1 });
lanza("un punto detrás de la cámara PARA", () => V3.proyecta(pegada, [0, 0, 100]),
  "detrás de la cámara");
cierto("y avisa de que dibujaría una barra donde no está",
  (() => {
    try { V3.proyecta(pegada, [0, 0, 100]); }
    catch (e) { return /espejado/.test(e.message); }
  })());
cierto("delante sí se proyecta", V3.proyecta(pegada, [0, 0, -5]).prof > 0);

/* ================================================================
   8 · ÓRBITA
   ================================================================ */
const g = V3.gira(enc, 30, 10);
cerca("girar suma al azimut", g.azimut, enc.azimut + 30, 1e-12);
cerca("y a la elevación", g.elevacion, enc.elevacion + 10, 1e-12);
cierto("AL GIRAR DEJA DE SER ISOMÉTRICA, y se dice: ya no se cumple el ángulo",
  enc.tipo === "isometrica" && g.tipo === "ortografica");
cierto("pero sigue siendo paralela, así que se sigue pudiendo medir", g.paralela === true);
const gg = V3.gira(enc, 0, 500);
cerca("la elevación se topa en 89°, no se pasa al cenit", gg.elevacion, 89, 1e-12);

/* ================================================================
   8b · LAS CUATRO VISTAS DE UN CLIC · el cubo de Revit

   En una herramienta técnica casi nunca se quiere un ángulo cualquiera:
   se quiere «desde el frente» o «desde el hastial». Y las cuatro tienen
   que poder medirse, o no sirven para mirar un plano.
   ================================================================ */
comp("hay cuatro vistas", Object.keys(V3.PRESETS).sort(),
  ["iso", "lateral", "planta", "portico"]);
comp("la iso es la isométrica exacta", V3.PRESETS.iso.tipo, "isometrica");
cerca("con su ángulo clavado", V3.PRESETS.iso.elevacion, V3.ISO_ELEVACION, 1e-12);
comp("el pórtico mira a lo largo de z", [V3.PRESETS.portico.azimut,
  V3.PRESETS.portico.elevacion], [0, 0]);
comp("la lateral a lo largo de x", [V3.PRESETS.lateral.azimut,
  V3.PRESETS.lateral.elevacion], [90, 0]);
comp("y la planta desde arriba", V3.PRESETS.planta.elevacion, 89);
cierto("89 y no 90: a 90 la base se vuelve indefinida y camara() se niega",
  V3.PRESETS.planta.elevacion < 90);
lanza("y a 90 se niega de verdad",
  () => V3.camara({ tipo: "ortografica", elevacion: 90 }), "indefinida");

/* LAS CUATRO SON PARALELAS, así que las cuatro SE PUEDEN MEDIR */
for (const k of Object.keys(V3.PRESETS)) {
  const pr = V3.PRESETS[k];
  const c = V3.encuadra(m3, V3.camara({ tipo: pr.tipo, azimut: pr.azimut,
    elevacion: pr.elevacion, aspecto: 16 / 9 }));
  const dd = V3.distorsion(m3, c);
  cierto("la vista «" + pr.nombre + "» se puede medir", dd.medible === true);
  cerca("y no deforma nada: razón 1", dd.razon, 1, 1e-12);
}
lanza("una vista que no existe PARA", () => V3.preset("trasera"), "no existe");
comp("preset() devuelve la que se pide", V3.preset("iso").nombre, "Iso");

/* ───── Y LO QUE DE VERDAD FALLABA ─────
   Girar escribía el azimut y la cámara LO TIRABA, porque la isométrica
   tiene los ángulos clavados: es lo que la hace medible. */
const isoFija = V3.camara({ tipo: "isometrica", azimut: 123, elevacion: 70 });
cerca("pedirle otro azimut a una isométrica no hace nada", isoFija.azimut, 45, 1e-12);
cerca("ni otra elevación", isoFija.elevacion, V3.ISO_ELEVACION, 1e-12);
const ortoLibre = V3.camara({ tipo: "ortografica", azimut: 123, elevacion: 70 });
cerca("en ortográfica sí obedece", ortoLibre.azimut, 123, 1e-12);
cerca("los dos ángulos", ortoLibre.elevacion, 70, 1e-12);
cierto("por eso gira() cambia el tipo: ya no se cumple el ángulo",
  V3.gira(V3.camara({ tipo: "isometrica" }), 10, 0).tipo === "ortografica");

/* ================================================================
   9 · LAS FILAS DEL INVENTARIO
   ================================================================ */
for (const id of ["V.isometrica", "V.profundidad", "MT.ejes"]) {
  cierto("la fila " + id + " existe y tiene fuente",
    INV.existe(id) && !!INV.fila(id).fuente);
}
cierto("V.isometrica explica el riesgo de la pestaña «solo ver»",
  /solo ver/.test(INV.fila("V.isometrica").nota) &&
  /atan\(1\/√2\)/.test(INV.fila("V.isometrica").nota));
cierto("V.profundidad dice que no hay líneas ocultas y por qué conviene",
  /no tiene caras/.test(INV.fila("V.profundidad").nota) &&
  /a trav[ée]s de la nave/.test(INV.fila("V.profundidad").nota));

fin();
