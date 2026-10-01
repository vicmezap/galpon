/* =====================================================================
   probar_analisis.js — el pórtico entero

   No hay un ejemplo de libro que reproducir: ni Zapata ni McCormac
   analizan un galpón con viento E.020 y Método Directo de punta a punta.
   Así que se comprueba lo que NO puede fallar si el análisis está bien:

     · el equilibrio de cada caso, contando también la carga repartida
     · la simetría: el viento de izquierda a derecha es el espejo del de
       derecha a izquierda
     · dos soluciones cerradas: el voladizo con carga repartida, y el
       reparto del empuje entre dos voladizos iguales unidos por el tijeral
     · B2 rehecho a mano con los números que devuelve el propio análisis
     · LA FÍSICA DEL GALPÓN: la brida inferior tracciona con la gravedad y
       COMPRIME con el viento que levanta, y la combinación que la comprime
       es la 0,9D + 1,3W
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const A = require("../src/analisis.js");
const MON = require("../src/montaje.js");
const M = require("../src/modelo.js");
const SV = require("../src/solver.js");
const ES = require("../src/estabilidad.js");
const VI = require("../src/viento.js");
const P = require("../src/perfiles.js");
const INV = require("../src/inventario.js");

const D = { luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
  peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5] };
const m3 = MON.monta(D);
const NOMBRES = { "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4",
  "diagonal": "L2X2X3/16", "montante": "L2X2X3/16", "correa": "C8X11.5", "viga de alero": "C8X11.5" };
const seccion = (b) => (NOMBRES[b.clase] ? P.busca(NOMBRES[b.clase]) : null);
const CARGAS = { D_kgfm2: 8, Lr_kgfm2: 30, viento: { V_kmh: 75, aberturas: "repartidas", tipo: 1 } };
const RIGIDO = { base: "empotrada", union: "rigida" };
const PENDULO = { base: "empotrada", union: "apoyado" };
const ARTIC = { base: "articulada", union: "rigida" };

comp("todas las filas que cita el módulo existen", Object.keys(A.ART).filter((id) => !INV.existe(id)), []);

/* ================================================================
   1 · EL SISTEMA · sin valor por omisión
   ================================================================ */
lanza("sin sistema se niega, y explica que lo decide el proyectista", () => A.sistema(), "proyectista");
lanza("articulada + apoyado es un MECANISMO", () => A.sistema({ base: "articulada", union: "apoyado" }),
  "MECANISMO");
comp("empotrada + apoyado es candidato a péndulo invertido", A.sistema(PENDULO).pendulo, true);
cierto("y lo dice con su R₀", /2,5/.test(A.sistema(PENDULO).notaPendulo));
comp("el pórtico rígido no lo es", A.sistema(RIGIDO).pendulo, false);
lanza("una base que no existe se niega", () => A.sistema({ base: "semi", union: "rigida" }), "empotrada");

/* ================================================================
   2 · LA GEOMETRÍA DEL PÓRTICO
   ================================================================ */
const gR = A.geometria(m3, RIGIDO), gP = A.geometria(m3, PENDULO);
comp("se analiza el pórtico interior central", gR.eje, Math.floor(m3.ejes.porticos / 2));
cerca("con el ancho tributario entero", gR.trib_m, 6, 1e-9);
comp("con unión rígida la columna sube hasta la brida superior: 4 tramos",
  gR.columnas.length, 4);
comp("y los montantes de apoyo, que ocupaba la columna, salen", gR.omitidas.length, 2);
comp("con el tijeral apoyado, 2 columnas y ningún montante fuera", [gP.columnas.length, gP.omitidas.length], [2, 0]);
comp("el ladeo se impide en la cabeza de columna: brida inferior si apoyado",
  gP.ladeo.split("@")[0], "I0");
comp("y en el alero si la unión es rígida", gR.ladeo.split("@")[0], "S0");
lanza("el eje de fachada no se analiza aquí", () => A.anchoTributario(m3, 0), "fachada");
/* Sin peralte en el apoyo no habría unión rígida posible, y analisis.js se
   negaría; pero el generador ya no deja llegar ahí: el peralte es obligatorio. */
lanza("el generador ya impide un tijeral sin peralte en el apoyo",
  () => MON.monta(Object.assign({}, D, { peralteApoyo_m: 0 })), "peralteApoyo_m");

/* ================================================================
   3 · EL CONVENIO DE MOMENTOS · el voladizo con carga repartida
   ================================================================ */
const mv = M.nuevo({ nivel: "LRFD" });
M.nudo(mv, { id: "a", x_m: 0, y_m: 0 }); M.nudo(mv, { id: "b", x_m: 0, y_m: 5 });
M.apoyo(mv, { nudo: "a", ux: true, uy: true, rz: true });
M.barra(mv, { id: "c", i: "a", j: "b", A_cm2: 50, I_cm4: 5000 });
M.cargaBarra(mv, { barra: "c", w_kgfm: 100 });
const fv = SV.resuelve(mv).barra("c");
const mm = A.momentoMaximo(fv, 100);
cerca("voladizo · momento en el empotramiento = w·L²/2", mm.Mi_kgfcm, 1 * 500 * 500 / 2, 1e-9);
cerca("y cero en la punta", Math.abs(mm.Mj_kgfcm) + 1, 1, 1e-9);
cerca("el máximo es el del empotramiento", mm.max_kgfcm, 125000, 1e-9);

/* ================================================================
   4 · LAS CARGAS
   ================================================================ */
const tramos = A.tramosTecho(gR);
const Lsup = tramos.reduce((a, t) => a + t.L_m, 0);
const Lhor = tramos.reduce((a, t) => a + Math.abs(t.dx_m), 0);
cerca("la proyección horizontal del techo es la luz", Lhor, 20, 1e-9);
const suma = (L) => {
  let fx = 0, fy = 0;
  for (const n of Object.keys(L.nudos)) { fx += L.nudos[n].Fx_kgf; fy += L.nudos[n].Fy_kgf; }
  for (const b of L.barras) fx += -b.w_kgfm * 0;   /* las repartidas se cuentan aparte */
  return { fx: fx, fy: fy };
};
cerca("Lr sobre la SUPERFICIE inclinada (fila A.Lr.area): 30 · ΣL · 6",
  -suma(A.casoViva(gR, 30).cargas).fy, 30 * Lsup * 6, 1e-9);
cierto("y eso es más que sobre la proyección: queda del lado seguro", Lsup > Lhor);
const nieve = A.casosNieve(gR, { Qt_kgfm2: 40, desbalanceada: { faldonA_kgfm2: 40, faldonB_kgfm2: 20 } });
cerca("la nieve sobre la PROYECCIÓN HORIZONTAL (E.020 11.3): 40 · luz · 6",
  -suma(nieve[0].cargas).fy, 40 * 20 * 6, 1e-9);
comp("balanceada y desbalanceada en los dos sentidos", nieve.map((s) => s.id), ["S", "S-izq", "S-der"]);
cerca("la desbalanceada lleva 40 en un faldón y 20 en el otro", -suma(nieve[1].cargas).fy,
  (40 + 20) * 10 * 6, 1e-9);
const dm = A.casoMuerta(gR, m3, seccion, 8);
cerca("D = cobertura sobre la superficie + peso propio + correas",
  -suma(dm.cargas).fy, 8 * Lsup * 6 + dm.pesoPropio_kgf + dm.pesoCorreas_kgf, 1e-9);
cierto("el peso propio sale de los perfiles", dm.pesoPropio_kgf > 100);

/* ---- el viento ---- */
const vw = A.casosViento(gR, CARGAS.viento);
comp("10 estados: 2 direcciones × 2 Ci × 2 Ce de barlovento + 2 longitudinales", vw.casos.length, 10);
cerca("Vh = 75 km/h por debajo de 10 m (el piso)", vw.Vh_kmh, 75, 1e-9);
/* un tramo a mano: el primero, a barlovento con Ce +0,3 y Ci +0,3 → C = 0 */
const w1 = vw.casos[0];
const t0 = tramos[0];
const Ph = (C) => VI.presion({ C: C, Vh_kmh: 75, tipo: 1 }).Ph_kgfm2;
cerca("Ph = 0,005·C·Vh²", Ph(1), 0.005 * 75 * 75, 1e-12);
/* el muro de barlovento de W1: C = 0,8 − 0,3, empuja hacia +x */
const wMuro = w1.cargas.barras.filter((b) => b.barra.indexOf("C0@") === 0)[0];
cerca("muro de barlovento: w = Ph·trib, empujando hacia +x (w local = −fx)",
  wMuro.w_kgfm, -Ph(0.8 - 0.3) * 6, 1e-12);
/* longitudinal: todo el techo a −0,7 − Ci, hacia arriba */
const wl = vw.casos.filter((c) => c.direccion === "longitudinal")[0];
cierto("el viento longitudinal LEVANTA el techo", suma(wl.cargas).fy > 0);
cerca("y lo levanta con (0,7 + 0,3)·Ph sobre toda la superficie, en vertical la proyección",
  suma(wl.cargas).fy, -Ph(-0.7 - 0.3) * Lhor * 6, 1e-9);
lanza("las aberturas no tienen valor por omisión",
  () => A.casosViento(gR, { V_kmh: 75 }), "aberturas");

/* ================================================================
   5 · EQUILIBRIO Y SIMETRÍA, caso por caso
   ================================================================ */
for (const caso of [dm].concat(vw.casos.slice(0, 3))) {
  const r = A.resuelveCaso(gR, seccion, caso);
  const s = suma(caso.cargas);
  let wx = 0;
  for (const b of caso.cargas.barras) {
    const c = gR.columnas.filter((x) => x.id === b.barra)[0];
    const yi = gR.yDe[c.i], yj = gR.yDe[c.j];
    wx += -b.w_kgfm * Math.abs(yj - yi);
  }
  const R = r.reacciones;
  cerca(caso.id + " · ΣRy + ΣFy = 0", R.B0.Ry_kgf + R.B1.Ry_kgf + s.fy + 1, 1, 1e-6);
  cerca(caso.id + " · ΣRx + ΣFx = 0 (con el viento repartido en las columnas)",
    R.B0.Rx_kgf + R.B1.Rx_kgf + s.fx + wx + 1, 1, 1e-6);
}
const rW1 = A.resuelveCaso(gR, seccion, vw.casos[0]);
const rW5 = A.resuelveCaso(gR, seccion, vw.casos[4]);
comp("W1 y W5 son la misma corrida en las dos direcciones", [vw.casos[0].Ci, vw.casos[4].Ci], [0.3, 0.3]);
cerca("ESPEJO · la reacción vertical izquierda de W1 es la derecha de W5",
  rW1.reacciones.B0.Ry_kgf, rW5.reacciones.B1.Ry_kgf, 1e-9);
cerca("y la horizontal, cambiada de signo", rW1.reacciones.B0.Rx_kgf, -rW5.reacciones.B1.Rx_kgf, 1e-9);
cerca("la D es simétrica", A.resuelveCaso(gR, seccion, dm).reacciones.B0.Ry_kgf,
  A.resuelveCaso(gR, seccion, dm).reacciones.B1.Ry_kgf, 1e-9);

/* ---- dos voladizos iguales unidos por el tijeral se reparten el empuje ---- */
const empuje = { id: "H", tipo: "H", desc: "1 t en la cabeza izquierda", cargas: { nudos: {}, barras: [] } };
empuje.cargas.nudos[gP.cabeza.izq] = { Fx_kgf: 1000, Fy_kgf: 0 };
const rh = A.resuelveCaso(gP, seccion, empuje);
const hcol = gP.yDe[gP.cabeza.izq] * 100;
cerca("VOLADIZOS · cada base toma la mitad del empuje (el tijeral es casi rígido axialmente)",
  rh.reacciones.B0.Rx_kgf, -500, 0.01);
cerca("y cada base, la mitad del momento: H·h/2", Math.abs(rh.reacciones.B0.Mz_kgfcm), 500 * hcol, 0.01);

/* ================================================================
   6 · TODO JUNTO
   ================================================================ */
const r = A.analiza({ m3: m3, seccion: seccion, acero: "A36", sistema: RIGIDO, cargas: CARGAS });
comp("36 corridas: 1.4-1, -2 y -3 sin viento en dos sentidos de nocional (6) + 3 × 10 con viento",
  r.combinaciones.length, 36);
const grav = r.combinaciones.filter((c) => !c.lateral);
comp("las de gravedad van en los dos sentidos de nocional (C2.2b(b))",
  grav.filter((c) => /N→/.test(c.id)).length, grav.filter((c) => /N←/.test(c.id)).length);
const g14 = grav.filter((c) => c.base === "1.4-1")[0];
cerca("la nocional de gravedad es 0,002·Yi", Math.abs(g14.nocional_kgf), 0.002 * g14.Pstory_kgf, 1e-9);
comp("y las de viento no llevan nocional (B2 ≤ 1,7)",
  r.combinaciones.filter((c) => c.lateral && c.nocional_kgf !== 0).length, 0);
cierto("B2 ≥ 1 siempre", r.combinaciones.every((c) => c.B2 >= 1));
cierto("y en un galpón ligero queda cerca de 1", r.segundoOrden.maxB2 < 1.2);

/* B2 REHECHO A MANO con los números que devuelve el análisis */
const fila = r.corridas.filter((f) => f.id === g14.id)[0];
const sol = A.resuelveCombinacion(A.geometria(m3, RIGIDO), seccion,
  (function () {
    const g = A.geometria(m3, RIGIDO);
    const d0 = A.casoMuerta(g, m3, seccion, 8).cargas;
    const L = { nudos: {}, barras: [] };
    for (const n of Object.keys(d0.nudos)) L.nudos[n] = { Fx_kgf: 1.4 * d0.nudos[n].Fx_kgf, Fy_kgf: 1.4 * d0.nudos[n].Fy_kgf };
    return L;
  })(), { nocional: g14.nocional_kgf });
const PeS = 0.85 * sol.H_kgf * (A.geometria(m3, RIGIDO).hLadeo_m * 100) / sol.dH_cm;
cerca("B2 = 1/(1 − Pstory/Pe,story) con Pe,story = 0,85·H·L/ΔH, rehecho a mano",
  fila.B2, 1 / (1 - sol.Pstory_kgf / PeS), 1e-9);

/* ---- nt + lt = EL ANÁLISIS SIN APOYO FICTICIO ----
   Es la definición del Apéndice 8: sin amplificar (B2 = 1), la suma de los
   dos análisis tiene que dar el primer orden de la estructura libre. Un lt
   con la reacción mal firmada lo rompe en todas las barras. */
{
  const g = A.geometria(m3, RIGIDO);
  const w = A.casosViento(g, CARGAS.viento).casos[0];
  const sol2 = A.resuelveCombinacion(g, seccion, w.cargas, { nocional: 0 });
  const ml = A.modelo(g, seccion);
  for (const n of Object.keys(w.cargas.nudos)) {
    M.cargaNudo(ml, { nudo: n, Fx_kgf: w.cargas.nudos[n].Fx_kgf, Fy_kgf: w.cargas.nudos[n].Fy_kgf });
  }
  for (const b of w.cargas.barras) M.cargaBarra(ml, { barra: b.barra, w_kgfm: b.w_kgfm });
  const rl = ES.analiza(ml);
  const malas = g.columnas.concat(g.truss).filter((b) =>
    Math.abs(sol2.rnt.barra(b.id).N_kgf + sol2.rlt.barra(b.id).N_kgf - rl.barra(b.id).N_kgf) > 1e-6 *
    (1 + Math.abs(rl.barra(b.id).N_kgf))).map((b) => b.id);
  comp("nt + lt = el análisis de la estructura libre, barra por barra (Apéndice 8)", malas, []);
  cerca("y la deriva lt es la del pórtico libre bajo la reacción del apoyo ficticio",
    sol2.rnt.desplaza(g.ladeo, "ux") + sol2.rlt.desplaza(g.ladeo, "ux") + 1,
    rl.desplaza(g.ladeo, "ux") + 1, 1e-6);
}

/* ---- W1 ES DE IZQUIERDA A DERECHA DE VERDAD ----
   En un techo simétrico, cambiar barlovento por sotavento da los mismos
   estados en espejo y la envolvente no cambia: hay que mirar el estado
   suelto. W1: Ce +0,3 a barlovento y Ci +0,3 → C = 0 en el faldón
   IZQUIERDO, que es el que sube en la dirección del viento; el derecho a
   −0,6 − 0,3 = −0,9, levantando. */
{
  const g = A.geometria(m3, RIGIDO);
  const W1 = A.casosViento(g, CARGAS.viento).casos[0];
  const mitad = D.luz_m / 2;
  const fyDe = (pred) => g.nudos.filter((n) => n.clase === "superior" && pred(n.x_m))
    .reduce((a, n) => a + ((W1.cargas.nudos[n.id] || { Fy_kgf: 0 }).Fy_kgf), 0);
  cerca("W1 · el faldón IZQUIERDO, a barlovento con C = 0, no lleva carga de techo",
    fyDe((x) => x < mitad - 1e-9) + 1, 1, 1e-9);
  cierto("y el DERECHO, a sotavento, levanta", fyDe((x) => x > mitad + 1e-9) > 0);
}

/* ---- Cm EN LA COLUMNA · el convenio de signos ----
   Un pórtico de base empotrada bajo gravedad dobla la columna en curvatura
   DOBLE: Cm = 0,6 − 0,4·|M1/M2| < 0,6. Con el convenio mal pasado saldría
   curvatura simple y Cm > 0,6. En un galpón B1 casi siempre es 1 porque P/Pe
   es pequeño, así que esto no se ve en la envolvente: hay que mirar Cm. */
{
  const f = r.corridas.filter((c) => c.base === "1.4-1")[0];
  const c0 = f.fuerzas["C0@" + r.eje];
  cierto("la columna está comprimida en la 1.4-1", c0.Pr_kgf < 0);
  cierto("CURVATURA DOBLE: Cm < 0,6", c0.Cm !== null && c0.Cm < 0.6);
  cierto("y Cm ≥ 0,2, el mínimo de la fórmula", c0.Cm >= 0.2 - 1e-12);
}

/* ---- SIMETRÍA DE LA ENVOLVENTE ----
   Galpón simétrico, viento en las dos direcciones, nocional en los dos
   sentidos: las dos columnas tienen que dar lo mismo. Se vio en pantalla que
   no lo hacían —3,63 contra 3,79 t·m— porque se sumaban el máximo de Mnt y
   el de Mlt por separado, y el reparto nt/lt depende de en qué alero va el
   apoyo ficticio. Queda solo el residuo de que B2 amplifique la parte lt. */
for (const [nom, rr] of [["rígido empotrado", r], ["péndulo", A.analiza({ m3: m3, seccion: seccion,
  acero: "A36", sistema: PENDULO, cargas: CARGAS })]]) {
  cerca(nom + " · las dos columnas, el mismo momento máximo",
    rr.barras.C0.momento.Mr_kgfcm, rr.barras.C1.momento.Mr_kgfcm, 0.005);
  cerca(nom + " · y la misma compresión", rr.barras.C0.compresion.Pr_kgf, rr.barras.C1.compresion.Pr_kgf, 0.005);
}

/* ---- LA FÍSICA DEL GALPÓN ---- */
const bi = r.barras.BI3;
cierto("la brida inferior TRACCIONA con la gravedad", bi.traccion.Pr_kgf > 0);
comp("y la tracción máxima viene de la 1.4-3 (1,2D + 1,6Lr)", bi.traccion.combo.split(" ")[0], "1.4-3");
cierto("y COMPRIME con el viento que levanta", bi.compresion.Pr_kgf < 0);
comp("LA QUE LA COMPRIME ES LA 0,9D + 1,3W", bi.compresion.combo.split(" ")[0], "1.4-6");
comp("la envolvente lo marca: la barra INVIERTE", bi.invierte, true);
cierto("las barras del tijeral no llevan momento (armadura)", r.barras.D1.momento.Mr_kgfcm === 0);
cierto("las columnas sí", r.barras.C0.momento.Mr_kgfcm > 0);
cierto("y B1 ≥ 1 en la columna comprimida", r.barras.C0.compresion.B1 >= 1);

/* ---- lo que sale para la cimentación: CASOS, no combinaciones ---- */
comp("las reacciones salen por caso sin factorizar (fila A.reacciones.casos)",
  r.casos.map((c) => c.id).slice(0, 3), ["D", "Lr", "W1"]);
cierto("con momento en la base si está empotrada", Math.abs(r.casos[0].reacciones.B0.Mz_kgfcm) > 0);
const rA = A.analiza({ m3: m3, seccion: seccion, acero: "A36", sistema: ARTIC, cargas: CARGAS });
comp("y sin momento si está articulada", rA.casos.every((c) => c.reacciones.B0.Mz_kgfcm === 0), true);
cierto("la base articulada deriva más que la empotrada",
  rA.deriva.peor.deriva_cm > r.deriva.peor.deriva_cm);
cerca("la deriva se compara con H/100 (fila SV.viento.H)", r.deriva.limite, 0.01, 1e-12);

/* ---- con nieve: S y sus dos desbalanceadas sustituyen a Lr ---- */
const rS = A.analiza({ m3: m3, seccion: seccion, acero: "A36", sistema: RIGIDO,
  cargas: { D_kgfm2: 8, S: { Qt_kgfm2: 40, desbalanceada: { faldonA_kgfm2: 40, faldonB_kgfm2: 20 } },
    viento: CARGAS.viento } });
comp("con nieve no hay Lr", rS.casos.filter((c) => c.tipo === "Lr").length, 0);
comp("y hay tres estados de nieve", rS.casos.filter((c) => c.tipo === "S").length, 3);

/* ---- lo que falta, se niega ---- */
lanza("sin perfiles no hay análisis, y dice cuáles faltan",
  () => A.analiza({ m3: m3, seccion: () => null, acero: "A36", sistema: RIGIDO, cargas: CARGAS }), "faltan perfiles");
lanza("sin acero tampoco: no hay valor por omisión",
  () => A.analiza({ m3: m3, seccion: seccion, sistema: RIGIDO, cargas: CARGAS }), "acero");
lanza("sin carga de techo tampoco",
  () => A.analiza({ m3: m3, seccion: seccion, acero: "A36", sistema: RIGIDO,
    cargas: { D_kgfm2: 8, viento: CARGAS.viento } }), "carga de techo");

/* ---- τb: con una columna muy cargada entra la nocional de C2.3(c) ---- */
/* Una columna esbelta muy cargada PANDEA antes de llegar a 0,5·Pns, y B1 se
   niega con su motivo: es la respuesta correcta, no un fallo. */
const flaca = (b) => (b.clase === "columna" ? P.busca("W4X13") : seccion(b));
lanza("una columna que pandea no se amplifica: se niega con «la barra pandea»",
  () => A.analiza({ m3: m3, seccion: flaca, acero: "A36", sistema: RIGIDO,
    cargas: { D_kgfm2: 120, Lr_kgfm2: 100, viento: CARGAS.viento } }), "pandea");
/* Una columna ROBUSTA con mucha carga sí llega a α·Pr/Pns > 0,5 sin pandear */
const rT = A.analiza({ m3: m3, seccion: seccion, acero: "A36", sistema: RIGIDO,
  cargas: { D_kgfm2: 1200, Lr_kgfm2: 100, viento: CARGAS.viento } });
comp("una columna con α·Pr/Pns > 0,5 dispara la alternativa de C2.3(c)", rT.segundoOrden.tauBalt, true);
cierto("y lo dice", /0,001/.test(rT.segundoOrden.nota));
comp("sin eso, τb = 1 y no hace falta", r.segundoOrden.tauBalt, false);

fin();
