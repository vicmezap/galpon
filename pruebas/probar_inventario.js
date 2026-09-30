/* =====================================================================
   probar_inventario.js

   El inventario es datos, no código, y por eso hay que probarlo MÁS, no
   menos: nadie lo compila, nadie le hace type-check, y se edita a mano.

   Lo que se comprueba aquí es la regla del proyecto hecha aserción:
   toda fila usable tiene fuente primaria, todo conflicto dice cuál fue la
   decisión, y pedir una magnitud que no existe PARA en vez de devolver
   undefined.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const INV = require("../src/inventario.js");

/* ---------- integridad de los datos ---------------------------------- */
const fallos = INV.integridad();
comp("el inventario no tiene fallos de integridad", fallos, []);

/* ---------- tamaño y secciones --------------------------------------- */
const r = INV.resumen();
cierto("hay más de 250 filas", r.total > 250);
comp("no queda ninguna fila sin fuente («criterio propio»)", r.sin_fuente, 0);

const secs = INV.secciones().sort();
comp("están las diez secciones", secs, [
  "cargas", "cimentacion", "compresion", "conexiones", "corte-flexocompresion",
  "estabilidad", "flexion", "perfiles", "sismo", "traccion"
].sort());

/* ---------- consultas que deben funcionar ---------------------------- */
comp("Fy del A36", INV.def("MAT.A36.Fy"), "2530");

/* ---------- num() · EL VALOR COMO NUMERO ------------------------------
   def() devuelve TEXTO de presentacion: MAT.E vale «2 039 000», con
   separadores de millar, y Number() sobre eso da NaN. Un NaN no avisa: se
   propaga por toda una matriz de rigidez y sale al final como una celda
   vacia. Paso de verdad al escribir modelo.js. num() normaliza lo
   normalizable y LANZA con todo lo demas. */
cerca("num() lee MAT.E aunque tenga separadores de millar", INV.num("MAT.E"), 2039000, 1e-12);
cerca("y MAT.G igual", INV.num("MAT.G"), 787000, 1e-12);
cerca("un valor sin separadores tambien", INV.num("MAT.A36.Fy"), 2530, 1e-12);
cerca("y la coma decimal se respeta", INV.num("MAT.mu"), 0.30, 1e-12);
cierto("Number() sobre el texto crudo de MAT.E SI da NaN, que es el fallo que evita",
  isNaN(Number(INV.def("MAT.E"))));
lanza("pedir como numero una fila que guarda una tabla PARA",
  () => INV.num("S.Z"), "no es un número");
lanza("y una que guarda una formula tambien",
  () => INV.num("S.V"), "no es un número");
comp("la carga viva de techo liviano", INV.def("Lr.liviana"), "30");
cierto("la fuente del A36 menciona la E.090", INV.art("MAT.A36.Fy").indexOf("E.090") >= 0);
cierto("la combinación que gobierna cita la E.090", INV.art("U.6").indexOf("E.090") >= 0);

const t = INV.todo("W.T5.barlovento");
comp("el caso del portón a barlovento vale +0,8", t.valor, "+ 0,8");
cierto("y está marcado como clave", t.clave === true);
cierto("y su nota explica la consecuencia", t.nota.indexOf("50 %") >= 0);

/* ---------- lo que tiene que PARAR ------------------------------------ */
lanza("pedir una magnitud inexistente para",
  () => INV.def("NO.EXISTE.ESTA"), "NO TIENE FILA");
lanza("y el mensaje explica la regla",
  () => INV.art("TAMPOCO.EXISTE"), "sin fila en el inventario");
lanza("usar una fila PENDIENTE para",
  () => INV.def("J.anclaje.concreto"), "PENDIENTE");

/* ---------- el ART de un módulo --------------------------------------- */
const ART = INV.declara("prueba", ["T.fluencia", "T.rotura", "C.phi"]);
cierto("declara() devuelve las citas", ART["C.phi"].indexOf("AISC") >= 0);
lanza("declarar un id inexistente para el módulo entero",
  () => INV.declara("prueba", ["T.fluencia", "INVENTADO.XYZ"]), "INVENTADO.XYZ");

/* ---------- los conflictos están resueltos, no solo señalados --------- */
let sinDecision = 0;
for (const id of INV.ids()) {
  const f = INV.fila(id);
  if (f.estado === "conflicto" && !f.nota) sinDecision++;
}
comp("todo conflicto tiene su decisión escrita", sinDecision, 0);

/* ---------- LOS HUECOS CONOCIDOS, FIJADOS POR NOMBRE -------------------
   Un «pendiente» es un agujero declarado: falta el documento y por eso el
   número no entra. Se fija la lista, como se fijan las cinco filas de
   espesor malo del AISC, porque las dos formas de que esto se pudra son
   silenciosas: que aparezca un pendiente nuevo y nadie lo note, o que
   alguien cierre uno rellenando el hueco de segunda mano.

   Cerrar uno de estos es una LINEA MENOS aquí, y tiene que ser deliberado.

   J.anclaje.concreto · ACI 318 Cap. 17 es una norma de pago y no está en la
   carpeta. Faltan SOLO las ecuaciones del lado del concreto: el requisito
   (E.060 15.8.3.3) y el refuerzo (E.060 7.10.5.6) sí están leídos. */
const PENDIENTES_CONOCIDOS = ["J.anclaje.concreto"];
const pendientes = INV.ids().filter((id) => INV.fila(id).estado === "pendiente").sort();
comp("los pendientes son exactamente los conocidos", pendientes,
  PENDIENTES_CONOCIDOS.slice().sort());

/* Un pendiente sin nota no sirve de nada: hay que saber qué falta y qué
   bloquea, o dentro de un mes nadie se acuerda de por qué está ahí. */
for (const id of pendientes) {
  cierto("el pendiente " + id + " dice qué falta y qué bloquea",
    /falta|FALTA/.test(INV.fila(id).nota || "") &&
    /BLOQUEA|bloquea/.test(INV.fila(id).nota || ""));
}

/* «sin_fuente» es peor que pendiente: es un número SIN procedencia. Cero. */
comp("ninguna fila sin fuente",
  INV.ids().filter((id) => INV.fila(id).estado === "sin_fuente").length, 0);

/* ---------- las filas que el resto del proyecto va a necesitar -------- */
/* Si alguna de estas desaparece del inventario, esta prueba avisa antes de
   que el módulo que la use falle en mitad de un cálculo. */
const IMPRESCINDIBLES = [
  "MAT.E", "MAT.G", "MAT.A36.Fy", "MAT.A36.Fu",
  "U.6", "W.Ph", "W.Vh", "W.V.min", "Lr.liviana",
  "T.fluencia", "T.rotura", "T.Ae", "T.U.c8",
  "C.Pn", "C.phi", "C.Fn.a", "C.Fn.b", "C.Fe",
  "F.phi", "F.Lp", "F.Lr", "F.Cb",
  "V.Vn", "H.1a", "H.1b",
  "E.C2.Ni", "E.C2.k080", "E.C3.K",
  "J.base.Pp1", "J.costura",
  "S.V", "S.pendulo", "S.despl",
  "Z.dos.niveles", "Z.costura", "Z.levantamiento"
];
const ausentes = IMPRESCINDIBLES.filter((id) => !INV.existe(id));
comp("están todas las magnitudes imprescindibles", ausentes, []);

fin();
