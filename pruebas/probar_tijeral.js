/* =====================================================================
   probar_tijeral.js — la armadura de cubierta

   TRES VERIFICACIONES, y la primera es exacta:

   1) MÉTODO DE LAS SECCIONES, a mano. En una armadura de dos paños con la
      carga en la cumbre, cortando por el centro y tomando momentos en el
      nudo de cumbre sale BI = R·L / (2·(h0 + L·s/2)) sin aproximación
      ninguna. Si el montaje de la geometría, el modelo o el solver
      estuvieran mal, esto no cuadraría.

   2) SIMETRÍA. Armadura simétrica con carga simétrica: las barras espejo
      tienen que llevar la misma fuerza. No hace falta saber cuánta.

   3) LA INVERSIÓN DE SIGNO bajo levantamiento, que es lo que justifica el
      módulo: la brida inferior pasa de tracción a COMPRESIÓN, y su longitud
      fuera del plano es la distancia entre arriostres laterales. Una barra
      que solo se mira con la envolvente de gravedad puede pasar y estar mal.

   Y la guarda que más vale: LA CARGA FUERA DE NUDO. El modelo resolvería
   igual de bien y daría axiales razonables, así que el error no se vería.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const T = require("../src/tijeral.js");
const S = require("../src/solver.js");
const P = require("../src/perfiles.js");
const AC = require("../src/acero.js");

const SEC = {
  "brida superior": P.busca("2L4X4X1/2"),
  "brida inferior": P.busca("2L4X4X1/2"),
  "diagonal": P.busca("L3X3X1/4"),
  "montante": P.busca("L3X3X1/4")
};

/* ---------- geometría ------------------------------------------------- */
const g = T.geometria({ luz_m: 20, paneles: 5, peralteApoyo_m: 1.2, pendiente: 0.20 });
comp("con 5 paneles por media luz, el paso es 2 m", g.paso_m, 2);
comp("y hay 22 nudos", g.nudos.length, 22);
comp("y 41 barras", g.barras.length, 41);
cerca("el peralte en la cumbre es h0 + (L/2)·s", g.peralteCumbre_m, 1.2 + 10 * 0.20, 1e-12);
/* La brida superior sube hasta la cumbre y baja: es simétrica. */
const sup = g.nudos.filter((n) => n.clase === "superior");
cerca("el nudo de cumbre está en L/2", sup[5].x_m, 10, 1e-12);
cerca("y es el más alto", sup[5].y_m, g.peralteCumbre_m, 1e-12);
for (let i = 0; i <= 5; i++) {
  cerca("la brida superior es simétrica en el nudo " + i, sup[i].y_m, sup[10 - i].y_m, 1e-12);
}
lanza("una geometría sin luz PARA", () => T.geometria({ paneles: 5 }), "luz_m");
lanza("y con paneles no entero tampoco",
  () => T.geometria({ luz_m: 20, paneles: 2.5, peralteApoyo_m: 1, pendiente: 0.2 }), "entero");

/* ---------- 1 · MÉTODO DE LAS SECCIONES, exacto --------------------- */
/* Dos paños, carga P solo en la cumbre. Cortando por el centro y tomando
   momentos en el nudo de cumbre —donde concurren la brida superior y la
   diagonal, y por donde pasa la propia carga— queda:
       R·(L/2) = BI · (h0 + L·s/2)      con R = P/2 */
const g2 = T.geometria({ luz_m: 12, paneles: 1, peralteApoyo_m: 1.0, pendiente: 0.25 });
const m2 = T.arma(g2, { secciones: SEC, combinacion: "prueba" });
const Pc = -10000;
T.cargaEnNudos(m2, g2, { xCorreas_m: [6], PporCorrea_kgf: Pc });
const r2 = S.resuelve(m2);
const R = Math.abs(Pc) / 2;
const brazo = 1.0 + 12 * 0.25 / 2;
const BI_exacto = R * (12 / 2) / brazo;
cerca("la reacción es la mitad de la carga", r2.reaccion("I0", "uy"), R, 1e-9);
cerca("y la brida inferior sale del método de las secciones",
  r2.barra("BI0").N_kgf, BI_exacto, 1e-9);
cierto("en tracción", r2.barra("BI0").traccion === true);
cierto("el equilibrio cuadra", r2.equilibrio.cuadra === true);

/* ---------- 2 · SIMETRÍA -------------------------------------------- */
function corre(Pnudo, nombre) {
  const m = T.arma(g, { secciones: SEC, combinacion: nombre });
  T.cargaEnNudos(m, g, { xCorreas_m: g.xNudosSuperiores, PporCorrea_kgf: Pnudo });
  return { combinacion: nombre, resultado: S.resuelve(m) };
}
const grav = corre(-2000, "1,2D + 1,6Lr");
comp("la reacción es la mitad de los 11 nudos cargados",
  Math.round(grav.resultado.reaccion("I0", "uy")), 11000);
for (let i = 0; i < 5; i++) {
  cerca("brida superior simétrica · BS" + i,
    grav.resultado.barra("BS" + i).N_kgf, grav.resultado.barra("BS" + (9 - i)).N_kgf, 1e-7);
  cerca("brida inferior simétrica · BI" + i,
    grav.resultado.barra("BI" + i).N_kgf, grav.resultado.barra("BI" + (9 - i)).N_kgf, 1e-7);
}
/* Y los signos son los que tienen que ser bajo gravedad. */
cierto("bajo gravedad la brida inferior TRACCIONA",
  grav.resultado.barra("BI2").traccion === true);
cierto("y la superior COMPRIME", grav.resultado.barra("BS2").traccion === false);

/* ---------- 3 · LA INVERSIÓN DE SIGNO · fila U.6 -------------------- */
const up = corre(+1500, "0,9D − 1,3W");
cierto("bajo levantamiento la brida inferior COMPRIME",
  up.resultado.barra("BI2").traccion === false);
cierto("y la superior tracciona", up.resultado.barra("BS2").traccion === true);

const inv = T.inversiones([grav, up]);
cierto("se detectan inversiones", inv.hay === true);
cierto("y son casi todas las barras", inv.cuantas >= 35);
const bi2 = inv.barras.find((b) => b.barra === "BI2");
cierto("BI2 está en la lista", !!bi2);
comp("con su combinación de tracción", bi2.combTraccion, "1,2D + 1,6Lr");
comp("y su combinación de compresión", bi2.combCompresion, "0,9D − 1,3W");
cierto("la nota dice que hay que comprobarlas en los dos sentidos",
  /DOS sentidos|dos sentidos/i.test(inv.nota));
cierto("y que la compresión pide la longitud fuera del plano",
  /fuera del plano/.test(inv.nota));
/* CON UNA SOLA CORRIDA NO HAY NADA QUE COMPARAR, y es justo así como se pasa
   por alto el levantamiento. */
lanza("con una sola corrida PARA, y dice por qué",
  () => T.inversiones([grav]), "una sola");
/* Sin inversión, lo dice sin alarmar. */
const grav2 = corre(-1000, "1,4D");
comp("dos combinaciones de gravedad no invierten nada",
  T.inversiones([grav, grav2]).cuantas, 0);

/* ---------- LA CARGA FUERA DE NUDO ---------------------------------- */
/* Es el error más caro y el más fácil de no ver: el modelo resuelve igual de
   bien y da axiales razonables. */
lanza("una correa entre nudos PARA",
  () => {
    const m = T.arma(g, { secciones: SEC });
    T.cargaEnNudos(m, g, { xCorreas_m: [0, 1.5, 3.0], PporCorrea_kgf: -2000 });
  }, "NO caen en un nudo");
lanza("y el mensaje explica que pasa a ser VIGA-COLUMNA del Cap. H",
  () => {
    const m = T.arma(g, { secciones: SEC });
    T.cargaEnNudos(m, g, { xCorreas_m: [1.5], PporCorrea_kgf: -2000 });
  }, "VIGA-COLUMNA");
lanza("y dice el paso del paño para poder casarlo",
  () => {
    const m = T.arma(g, { secciones: SEC });
    T.cargaEnNudos(m, g, { xCorreas_m: [1.5], PporCorrea_kgf: -2000 });
  }, "paso del paño");
/* Una correa a 1 cm del nudo sí se admite: es tolerancia de replanteo. */
cierto("una correa a menos de 1 cm del nudo se admite",
  (function () {
    const m = T.arma(g, { secciones: SEC });
    T.cargaEnNudos(m, g, { xCorreas_m: [2.005], PporCorrea_kgf: -2000 });
    return true;
  })());
comp("la tolerancia es de 1 cm", T.TOL_NUDO_M, 0.01);

/* ---------- el peso propio se reparte en los nudos ------------------ */
const m3 = T.arma(g, { secciones: SEC });
const pp = T.pesoPropio(m3, g, { peso_kgfm2: 12, anchoTributario_m: 6 });
cerca("el total es peso × luz × ancho tributario", pp.total_kgf, 12 * 20 * 6, 1e-9);
/* Los nudos de extremo toman la mitad del área tributaria, así que la suma
   de las cargas de nudo es exactamente el total. */
const sumaPP = m3.cargasNudo.reduce((a, c) => a + c.Fy_kgf, 0);
cerca("y la suma de las cargas de nudo es el total", Math.abs(sumaPP), pp.total_kgf, 1e-9);

/* ---------- las longitudes no arriostradas y sus hipótesis ---------- */
lanza("sin la separación de correas PARA",
  () => T.longitudes(g, { separacionArriostresInferior_m: 6 }), "separacionCorreas_m");
/* ES EL DATO QUE DECIDE EL LEVANTAMIENTO. */
lanza("y sin la separación de arriostres inferiores también, diciendo por qué",
  () => T.longitudes(g, { separacionCorreas_m: 2 }), "DECIDE EL LEVANTAMIENTO");
const lg = T.longitudes(g, { separacionCorreas_m: 2, separacionArriostresInferior_m: 6 });
comp("en el plano, la brida superior mide un paño", lg["brida superior"].enPlano_cm, 200);
comp("fuera del plano, la separación de correas", lg["brida superior"].fueraPlano_cm, 200);
comp("y la brida inferior, la de sus arriostres", lg["brida inferior"].fueraPlano_cm, 600);
/* LA DEUDA DEL APÉNDICE 6 queda anotada: decir que un punto está arriostrado
   sin comprobarlo da una longitud que no existe (fila E.C3.arriostre). */
cierto("la deuda del Apéndice 6 queda anotada", /Ap.ndice 6/.test(lg.deuda));
cierto("y la hipótesis de cada clase viaja escrita",
  /correas/.test(lg["brida superior"].hipotesis) &&
  /levantamiento/.test(lg["brida inferior"].hipotesis));

/* ---------- verificar una barra, por su clase ----------------------- */
/* Una diagonal de ángulo en COMPRESIÓN va por el E5, que mete la
   excentricidad dentro de una esbeltez efectiva (fila C.E5). */
const ang = P.busca("L3X3X1/4");
const diag = T.verificaBarra({ barra: "D2", clase: "diagonal", perfil: ang,
  acero: "A36", N_kgf: -2343, L_cm: 250, ra_cm: ang.rx_cm,
  condicionesE5: true, noEsbelta: true, arriostreComprobado: true,
  combinacion: "1,2D + 1,6Lr" });
cierto("una diagonal comprimida usa el E5", diag.E5 !== null);
cierto("y su esbeltez efectiva supera la geométrica", diag.E5.lr > 250 / ang.rx_cm);
cierto("el ratio sale del Capítulo E", diag.capitulo === "E");
cierto("y se recuerda que en un tijeral manda el 0,80, no τb",
  /0,80/.test(diag.notaRigidez));
/* Las cinco condiciones del E5 son obligatorias. */
lanza("sin confirmarlas PARA",
  () => T.verificaBarra({ barra: "D2", clase: "diagonal", perfil: ang, N_kgf: -2343,
    L_cm: 250, ra_cm: ang.rx_cm, noEsbelta: true }), "cinco condiciones");
/* En TRACCIÓN no hace falta el E5: no hay pandeo que corregir. */
const tirante = T.verificaBarra({ barra: "BI2", clase: "brida inferior",
  perfil: SEC["brida inferior"], acero: "A36", N_kgf: 17500, L_cm: 200,
  combinacion: "1,2D + 1,6Lr" });
comp("una barra traccionada no pasa por el E5", tirante.E5, null);
cierto("y se verifica por el Capítulo D", tirante.capitulo === "D");

/* ---------- lo que el montaje no tolera ----------------------------- */
lanza("armar sin la sección de una clase PARA, y lista las cuatro",
  () => T.arma(g, { secciones: { "brida superior": SEC["brida superior"] } }),
  "brida inferior");
comp("las clases son cuatro", T.CLASES.length, 4);

fin();
