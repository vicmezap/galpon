/* =====================================================================
   probar_solver.js — LA PRUEBA DE ORO DEL SOLUCIONADOR

   Un solucionador no se revisa leyéndolo. Se contrasta contra casos de
   solución CERRADA, donde el número correcto se conoce de antemano y sin
   opinión: viga simplemente apoyada, voladizo, barra axial, armadura. Si
   el ensamblaje, la rotación, la condensación o un signo estuvieran mal,
   estos no cuadrarían, y no cuadrarían por poco: fallarían por factores.

   Y encima hay dos comprobaciones que no necesitan solución conocida y
   valen para CUALQUIER estructura:

     · EQUILIBRIO · cargas aplicadas + reacciones = 0. Lo hace el propio
       solucionador en cada corrida y LANZA si no cuadra. Cazó el primer
       error de esta etapa a la primera: el signo de las fuerzas de
       empotramiento estaba invertido y ΣFy salía el doble de la carga.

     · RECIPROCIDAD DE MAXWELL · el desplazamiento en A por una carga
       unitaria en B es igual al desplazamiento en B por la misma carga en
       A. Es una propiedad de la matriz de rigidez, no del caso, así que
       delata un ensamblaje asimétrico sin saber la respuesta correcta.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const M = require("../src/modelo.js");
const S = require("../src/solver.js");

const E = 2039000;          /* kgf/cm² · MAT.E */
const I = 8491, A = 49.354; /* W12X26 */
const L = 6.0, Lc = 600;    /* m y cm */
const w = -1000, wc = -10;  /* kgf/m y kgf/cm, hacia abajo */

/* ---------- 1 · viga simplemente apoyada con carga repartida ----------- */
function vigaSimple() {
  const m = M.nuevo({ nivel: "servicio", nombre: "viga simple" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "C", x_m: L / 2, y_m: 0 });
  M.nudo(m, { id: "B", x_m: L, y_m: 0 });
  M.apoyo(m, { nudo: "A", ux: true, uy: true });
  M.apoyo(m, { nudo: "B", uy: true });
  const o = { A_cm2: A, I_cm4: I, E_kgcm2: E };
  M.barra(m, Object.assign({ id: "b1", i: "A", j: "C" }, o));
  M.barra(m, Object.assign({ id: "b2", i: "C", j: "B" }, o));
  M.cargaBarra(m, { barra: "b1", w_kgfm: w });
  M.cargaBarra(m, { barra: "b2", w_kgfm: w });
  return S.resuelve(m);
}
const v = vigaSimple();
cerca("viga simple · reacción = wL/2", v.reaccion("A", "uy"), -wc * Lc / 2, 1e-10);
cerca("viga simple · las dos reacciones iguales",
  v.reaccion("A", "uy"), v.reaccion("B", "uy"), 1e-10);
cerca("viga simple · momento en el centro = wL²/8",
  Math.abs(v.barra("b1").M_j_kgfcm), Math.abs(wc * Lc * Lc / 8), 1e-10);
cerca("viga simple · flecha = 5wL⁴/384EI",
  v.desplaza("C", "uy"), 5 * wc * Math.pow(Lc, 4) / (384 * E * I), 1e-10);
cierto("y el equilibrio cuadra", v.equilibrio.cuadra === true);
cerca("el momento en los apoyos es cero", v.barra("b1").M_i_kgfcm, 0, 1e-9);

/* ---------- 2 · voladizo ----------------------------------------------- */
const P = 1000;
function voladizo() {
  const m = M.nuevo({ nivel: "servicio", nombre: "voladizo" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "B", x_m: L, y_m: 0 });
  M.apoyo(m, { nudo: "A", ux: true, uy: true, rz: true });
  M.barra(m, { id: "b", i: "A", j: "B", A_cm2: A, I_cm4: I, E_kgcm2: E });
  M.cargaNudo(m, { nudo: "B", Fy_kgf: -P });
  return S.resuelve(m);
}
const c = voladizo();
cerca("voladizo · flecha = PL³/3EI",
  c.desplaza("B", "uy"), -P * Math.pow(Lc, 3) / (3 * E * I), 1e-10);
cerca("voladizo · momento en la base = PL",
  Math.abs(c.reaccion("A", "rz")), P * Lc, 1e-10);
cerca("voladizo · reacción vertical = P", c.reaccion("A", "uy"), P, 1e-10);
cerca("voladizo · giro en punta = PL²/2EI",
  Math.abs(c.desplaza("B", "rz")), P * Lc * Lc / (2 * E * I), 1e-10);

/* ---------- 3 · axial puro · no todo es flexión ------------------------ */
const N = 5000;
const ax = (function () {
  const m = M.nuevo({ nivel: "servicio", nombre: "barra axial" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "B", x_m: L, y_m: 0 });
  M.apoyo(m, { nudo: "A", ux: true, uy: true, rz: true });
  M.apoyo(m, { nudo: "B", uy: true, rz: true });
  M.barra(m, { id: "b", i: "A", j: "B", A_cm2: A, I_cm4: I, E_kgcm2: E });
  M.cargaNudo(m, { nudo: "B", Fx_kgf: N });
  return S.resuelve(m);
})();
cerca("axial · alargamiento = PL/EA", ax.desplaza("B", "ux"), N * Lc / (E * A), 1e-10);
cerca("axial · N recuperado", ax.barra("b").N_kgf, N, 1e-9);
cierto("y se declara en tracción", ax.barra("b").traccion === true);

/* ---------- 4 · LA ARMADURA SALE DEL PÓRTICO · fila E.armadura --------- */
/* Dos barras a 4 m de luz y 1,5 m de flecha, carga en la cumbre. Cada barra
   mide 2,5 m, así que su componente vertical es 1,5/2,5 = 0,6 y por
   equilibrio del nudo: 2·N·0,6 = P  →  N = P/1,2, en COMPRESIÓN. */
const arm = (function () {
  const m = M.nuevo({ nivel: "servicio", nombre: "armadura de dos barras" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "B", x_m: 4, y_m: 0 });
  M.nudo(m, { id: "C", x_m: 2, y_m: 1.5 });
  M.apoyo(m, { nudo: "A", ux: true, uy: true });
  M.apoyo(m, { nudo: "B", ux: true, uy: true });
  M.barraArmadura(m, { id: "d1", i: "A", j: "C", A_cm2: A, I_cm4: I, E_kgcm2: E });
  M.barraArmadura(m, { id: "d2", i: "C", j: "B", A_cm2: A, I_cm4: I, E_kgcm2: E });
  M.cargaNudo(m, { nudo: "C", Fy_kgf: -P });
  return S.resuelve(m);
})();
cerca("armadura · N = −P/1,2 por equilibrio del nudo",
  arm.barra("d1").N_kgf, -P / 1.2, 1e-9);
cierto("y está en compresión", arm.barra("d1").traccion === false);
cerca("las dos diagonales iguales por simetría",
  arm.barra("d1").N_kgf, arm.barra("d2").N_kgf, 1e-9);
cerca("momento nulo en toda barra de armadura",
  Math.abs(arm.barra("d1").M_i_kgfcm) + Math.abs(arm.barra("d1").M_j_kgfcm), 0, 1e-9);
cerca("reacción vertical = P/2 en cada apoyo", arm.reaccion("A", "uy"), P / 2, 1e-9);
/* EL GIRO DE LA CUMBRE NO TIENE RIGIDEZ, y no es un error: en ese nudo solo
   concurren barras con el giro liberado. El solucionador lo restringe solo y
   lo dice, en vez de sacar una matriz singular sin explicación. */
cierto("el giro de la cumbre se declara sin rigidez",
  arm.girosSinRigidez.indexOf("C") >= 0);
comp("en una armadura de 3 nudos son los 3", arm.girosSinRigidez.length, 3);

/* ---------- 5 · liberar los dos giros CON carga repartida -------------- */
/* Aquí es donde una liberación mal hecha se nota: si en vez de condensar se
   pusiera la inercia a cero, las reacciones saldrían mal. */
/* UNA SOLA BARRA, y el motivo importa: dos barras colineales biarticuladas
   con el nudo central cargado SON UN MECANISMO —el nudo baja sin que nada se
   oponga— y el solucionador tiene razón al negarse. Lo escribí con dos barras
   y la guarda de pivote lo cazó. */
const lib = (function () {
  const m = M.nuevo({ nivel: "servicio", nombre: "viga biarticulada" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "B", x_m: L, y_m: 0 });
  M.apoyo(m, { nudo: "A", ux: true, uy: true });
  M.apoyo(m, { nudo: "B", uy: true });
  M.barra(m, { id: "b1", i: "A", j: "B", A_cm2: A, I_cm4: I, E_kgcm2: E,
    liberaI: true, liberaJ: true });
  M.cargaBarra(m, { barra: "b1", w_kgfm: w });
  return S.resuelve(m);
})();
cerca("barra liberada · reacción sigue siendo wL/2",
  lib.reaccion("A", "uy"), -wc * Lc / 2, 1e-10);
cerca("y el momento en los extremos liberados es cero",
  Math.abs(lib.barra("b1").M_i_kgfcm), 0, 1e-9);
cierto("el equilibrio cuadra igual", lib.equilibrio.cuadra === true);

/* ---------- 6 · RECIPROCIDAD DE MAXWELL -------------------------------- */
/* No necesita conocer la respuesta: δ_AB = δ_BA es una propiedad de la matriz
   de rigidez. Un ensamblaje asimétrico —una rotación mal traspuesta, una
   condensación que toca solo la fila y no la columna— lo rompe. */
function porticoCon(cargaEn, direccion) {
  const m = M.nuevo({ nivel: "servicio", nombre: "pórtico" });
  M.nudo(m, { id: "1", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "2", x_m: 0, y_m: 4 });
  M.nudo(m, { id: "3", x_m: 8, y_m: 5 });
  M.nudo(m, { id: "4", x_m: 8, y_m: 0 });
  M.apoyo(m, { nudo: "1", ux: true, uy: true, rz: true });
  M.apoyo(m, { nudo: "4", ux: true, uy: true, rz: true });
  const o = { A_cm2: A, I_cm4: I, E_kgcm2: E };
  M.barra(m, Object.assign({ id: "c1", i: "1", j: "2" }, o));
  M.barra(m, Object.assign({ id: "v", i: "2", j: "3" }, o));
  M.barra(m, Object.assign({ id: "c2", i: "4", j: "3" }, o));
  const carga = { nudo: cargaEn };
  carga[direccion === "ux" ? "Fx_kgf" : "Fy_kgf"] = 1000;
  M.cargaNudo(m, carga);
  return S.resuelve(m);
}
const ab = porticoCon("2", "ux").desplaza("3", "uy");
const ba = porticoCon("3", "uy").desplaza("2", "ux");
cerca("Maxwell · δ(3,uy) por carga en 2 = δ(2,ux) por carga en 3", ab, ba, 1e-9);
cierto("y los dos son distintos de cero", Math.abs(ab) > 1e-6);

/* ---------- 7 · simetría ----------------------------------------------- */
/* Estructura simétrica + carga simétrica = respuesta simétrica. */
const sim = (function () {
  const m = M.nuevo({ nivel: "servicio", nombre: "pórtico a dos aguas" });
  M.nudo(m, { id: "1", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "2", x_m: 0, y_m: 5 });
  M.nudo(m, { id: "3", x_m: 10, y_m: 7 });
  M.nudo(m, { id: "4", x_m: 20, y_m: 5 });
  M.nudo(m, { id: "5", x_m: 20, y_m: 0 });
  M.apoyo(m, { nudo: "1", ux: true, uy: true, rz: true });
  M.apoyo(m, { nudo: "5", ux: true, uy: true, rz: true });
  const o = { A_cm2: A, I_cm4: I, E_kgcm2: E };
  M.barra(m, Object.assign({ id: "col1", i: "1", j: "2" }, o));
  M.barra(m, Object.assign({ id: "t1", i: "2", j: "3" }, o));
  M.barra(m, Object.assign({ id: "t2", i: "3", j: "4" }, o));
  M.barra(m, Object.assign({ id: "col2", i: "5", j: "4" }, o));
  /* MISMO SIGNO EN LOS DOS FALDONES, y eso ES lo simétrico: el eje local +y
     de cada barra apunta a la izquierda de su avance, así que al subir por un
     faldón y bajar por el otro las dos normales ya salen hacia arriba. Con
     w = −500 en las dos, las componentes verticales coinciden (−5000 kgf cada
     una) y las horizontales salen opuestas (+1000 y −1000): simetría exacta.
     Lo puse con signos opuestos al principio y era justo lo antisimétrico. */
  M.cargaBarra(m, { barra: "t1", w_kgfm: -500 });
  M.cargaBarra(m, { barra: "t2", w_kgfm: -500 });
  return S.resuelve(m);
})();
cerca("simetría · reacciones verticales iguales",
  sim.reaccion("1", "uy"), sim.reaccion("5", "uy"), 1e-8);
cerca("simetría · reacciones horizontales opuestas",
  sim.reaccion("1", "ux"), -sim.reaccion("5", "ux"), 1e-8);
cerca("simetría · la cumbre no se mueve en horizontal", sim.desplaza("3", "ux"), 0, 1e-7);
cerca("simetría · ni gira", sim.desplaza("3", "rz"), 0, 1e-9);
cierto("el equilibrio cuadra", sim.equilibrio.cuadra === true);

/* ---------- 8 · el factor de rigidez · fila E.C2.k080 ------------------ */
/* Reducir TODAS las rigideces por el mismo factor no cambia las fuerzas de
   una estructura isostática, y multiplica los desplazamientos por 1/factor.
   Es la comprobación de que el factor entra donde tiene que entrar. */
function voladizoK(fr) {
  const m = M.nuevo({ nivel: "LRFD", nombre: "voladizo" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "B", x_m: L, y_m: 0 });
  M.apoyo(m, { nudo: "A", ux: true, uy: true, rz: true });
  M.barra(m, { id: "b", i: "A", j: "B", A_cm2: A, I_cm4: I, E_kgcm2: E });
  M.cargaNudo(m, { nudo: "B", Fy_kgf: -P });
  return S.resuelve(m, { factorRigidez: fr });
}
cerca("con 0,80 de rigidez la flecha sube 1/0,80",
  voladizoK(0.8).desplaza("B", "uy"), voladizoK(1).desplaza("B", "uy") / 0.8, 1e-9);
cerca("y el momento en la base NO cambia: es isostático",
  voladizoK(0.8).reaccion("A", "rz"), voladizoK(1).reaccion("A", "rz"), 1e-9);
lanza("un factor de rigidez fuera de (0,1] PARA",
  () => voladizoK(1.5), "factorRigidez");

/* ---------- 9 · lo que tiene que PARAR --------------------------------- */
lanza("un mecanismo da matriz singular, con explicación",
  () => {
    const m = M.nuevo({ nivel: "servicio" });
    M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
    M.nudo(m, { id: "B", x_m: L, y_m: 0 });
    M.nudo(m, { id: "C", x_m: 2 * L, y_m: 0 });
    M.apoyo(m, { nudo: "A", ux: true, uy: true, rz: true });
    M.apoyo(m, { nudo: "C", uy: true });
    /* dos barras alineadas con rótula en B: B puede bajar sin oposición */
    M.barraArmadura(m, { id: "b1", i: "A", j: "B", A_cm2: A, I_cm4: I, E_kgcm2: E });
    M.barraArmadura(m, { id: "b2", i: "B", j: "C", A_cm2: A, I_cm4: I, E_kgcm2: E });
    M.cargaNudo(m, { nudo: "B", Fy_kgf: -P });
    return S.resuelve(m);
  }, "SINGULAR");

lanza("un momento aplicado en una rótula PARA",
  () => {
    const m = M.nuevo({ nivel: "servicio" });
    M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
    M.nudo(m, { id: "B", x_m: 4, y_m: 0 });
    M.nudo(m, { id: "C", x_m: 2, y_m: 1.5 });
    M.apoyo(m, { nudo: "A", ux: true, uy: true });
    M.apoyo(m, { nudo: "B", ux: true, uy: true });
    M.barraArmadura(m, { id: "d1", i: "A", j: "C", A_cm2: A, I_cm4: I, E_kgcm2: E });
    M.barraArmadura(m, { id: "d2", i: "C", j: "B", A_cm2: A, I_cm4: I, E_kgcm2: E });
    M.cargaNudo(m, { nudo: "C", Mz_kgfcm: 1000 });
    return S.resuelve(m);
  }, "no se puede equilibrar");

/* ---------- 10 · el equilibrio se comprueba SIEMPRE -------------------- */
/* No es una opción del usuario ni un modo de depuración: toda corrida lo
   pasa, y una que no lo pase no devuelve resultado. */
for (const r of [v, c, ax, arm, lib, sim]) {
  cierto("equilibrio comprobado en «" + r.nombre + "»", r.equilibrio.cuadra === true);
}
cierto("y con margen de sobra sobre la tolerancia",
  Math.max(v.equilibrio.relFx, v.equilibrio.relFy, v.equilibrio.relM) < S.TOL_EQUILIBRIO);

fin();
