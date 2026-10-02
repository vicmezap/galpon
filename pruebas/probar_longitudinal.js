/* =====================================================================
   probar_longitudinal.js — el galpón a lo largo, del hastial al suelo

   Todo es estática de un sistema isostático, así que cada fuerza se puede
   rehacer a mano o, mejor, con una ecuación de equilibrio que el módulo no
   usa: lo que entra al hastial tiene que salir por las bases.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const LG = require("../src/longitudinal.js");
const MON = require("../src/montaje.js");
const VI = require("../src/viento.js");
const E030 = require("../src/e030.js");
const INV = require("../src/inventario.js");

const D = { luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6, peralteApoyo_m: 1.2,
  pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe", panosArriostradosTecho: [5],
  panosArriostradosFachada: [5], columnasHastiales: [5, 10, 15] };
const m3 = MON.monta(D);
const RIG = { base: "empotrada", union: "rigida" };
const VIENTO = { V_kmh: 75, tipo: 1, aberturas: "repartidas" };
const SISMO = { zona: "Z4", suelo: "S2", categoria: "C" };
const r = LG.analiza({ m3: m3, sistema: RIG, viento: VIENTO, sismo: SISMO, P_interior_kgf: 2800, P_fachada_kgf: 1500 });
const q = 0.005 * 75 * 75;     /* Ph = 0,005·C·V² con V = 75 en el mínimo */

/* ================================================================
   1 · LA GEOMETRÍA
   ================================================================ */
comp("las líneas del hastial: dos esquinas y las tres hastiales",
  r.geometria.lineas.map((L) => [L.x, L.tipo]), [[0, "esquina"], [5, "hastial"], [10, "hastial"], [15, "hastial"], [20, "esquina"]]);
comp("cada una con su franja, a medio camino de las vecinas",
  r.geometria.lineas.map((L) => [L.a, L.b]), [[0, 2.5], [2.5, 7.5], [7.5, 12.5], [12.5, 17.5], [17.5, 20]]);
comp("la esquina sube hasta el alero (unión rígida) y la hastial hasta la brida inferior",
  r.geometria.lineas.map((L) => L.H_m), [7.2, 6, 6, 6, 7.2]);
const rA = LG.analiza({ m3: m3, sistema: { base: "empotrada", union: "apoyado" }, viento: VIENTO });
comp("con el tijeral apoyado, la esquina llega a la cabeza de columna", rA.geometria.lineas[0].H_m, 6);

/* ================================================================
   2 · EL VIENTO EN LOS HASTIALES · fila LG.viento.hastial
   ================================================================ */
const W = r.estados.filter((e) => e.tipo === "W");
comp("un estado por cada Ci de las aberturas", W.map((e) => e.Ci), VI.ci("repartidas").Ci);
for (const e of W) {
  cerca("Ci " + e.Ci + " · barlovento C = 0,8 − Ci", e.pInicio_kgfm2, q * (0.8 - e.Ci), 1e-12);
  cerca("Ci " + e.Ci + " · sotavento: la succión C = −0,6 − Ci también empuja hacia +z", e.pFinal_kgfm2,
    -q * (-0.6 - e.Ci), 1e-12);
}
/* el muro del hastial: rectángulo de 20 × 7,2 más el triángulo hasta la cumbrera a 9,2 */
const Ahastial = 20 * 7.2 + 20 * 2 / 2;
for (const e of W) {
  const sumaI = e.hastialInicio.reduce((a, c) => a + c.Rbase_kgf + c.Rcabeza_kgf, 0);
  cerca("EQUILIBRIO · lo que reciben las columnas del hastial = p·área del muro (" + e.id + ")",
    sumaI, e.pInicio_kgfm2 * Ahastial, 1e-6);
}
{
  const e = W[1], c = e.hastialInicio[1];
  cerca("la columna hastial lleva su franja de 5 m: w = p·5", c.w_kgfm, e.pInicio_kgfm2 * 5, 1e-9);
  cerca("como viga simplemente apoyada: M = w·H²/8", c.M_kgfm, c.w_kgfm * 36 / 8, 1e-9);
  cerca("abajo w·H/2", c.Rbase_kgf, c.w_kgfm * 3, 1e-9);
  /* encima de la cabeza: el muro entre 6 m y el techo, en la franja de 2,5 a 7,5 */
  const ySup = (x) => 7.2 + 0.2 * x;
  cerca("arriba w·H/2 más todo el muro que queda por encima de su cabeza", c.Rcabeza_kgf,
    c.w_kgfm * 3 + e.pInicio_kgfm2 * ((ySup(2.5) + ySup(7.5)) / 2 - 6) * 5, 1e-6);
  const s = e.hastialInicio[0];
  cerca("la esquina, con su franja de 2,5 m y toda la altura hasta el alero", s.w_kgfm, e.pInicio_kgfm2 * 2.5, 1e-9);
}
comp("cada columna se diseña con el peor de sus dos papeles y de los Ci",
  r.columnas.map((c) => c.papel), ["barlovento", "barlovento", "barlovento", "barlovento", "barlovento"]);
cerca("(el barlovento con Ci −0,3 empuja con 1,1·q, más que el sotavento: 0,9·q)", r.columnas[1].w_kgfm, 1.1 * q * 5, 1e-9);

/* ================================================================
   3 · EL CAMINO · filas LG.vertical, LG.correa.puntal, LG.techo.armadura, LG.fachada.cruz
   ================================================================ */
for (const e of r.estados) {
  const a = e.armaduras[0];
  const entra = a.cargas_kgf.reduce((s, f) => s + f, 0);
  cerca(e.id + " · la armadura de techo cierra: el cortante del último panel es la reacción derecha",
    a.cierre_kgf, 0, 1e-9);
  cerca(e.id + " · Rizq + Rder = todo lo que entra al paño", a.Rizq_kgf + a.Rder_kgf, entra, 1e-9);
  cerca(e.id + " · y todo baja por las dos cruces de fachada",
    e.cruces.reduce((s, c) => s + c.H_kgf, 0), entra, 1e-9);
}
{
  const e = W[0];
  const cabezas = e.hastialInicio.concat(e.hastialFinal).reduce((s, c) => s + c.Rcabeza_kgf, 0);
  cerca("con un solo paño arriostrado, le llegan las cabezas de LOS DOS hastiales",
    e.armaduras[0].cargas_kgf.reduce((s, f) => s + f, 0), cabezas, 1e-9);
  const a = e.armaduras[0], p0 = a.paneles[0];
  cerca("primer panel: V = Rizq − lo que entra por el alero", p0.V_kgf, a.Rizq_kgf - a.cargas_kgf[0], 1e-9);
  /* el panel va del alero (x = 0) a x = 20/12, en el techo de pendiente 0,2 */
  const dx = 20 / 12, ell = Math.sqrt(dx * dx + Math.pow(0.2 * dx, 2) + 36);
  cerca("su diagonal: N = V·ℓ/s con ℓ en el plano inclinado del techo", p0.diagonal_kgf, p0.V_kgf * ell / 6, 1e-9);
  cerca("con cargas simétricas, las dos reacciones son iguales", a.Rizq_kgf, a.Rder_kgf, 1e-9);
  const c = e.cruces[0], ellc = Math.sqrt(36 + 36);
  cerca("la cruz de fachada: T = H·√(s² + h²)/s", c.diagonal_kgf, c.H_kgf * ellc / 6, 1e-9);
  cerca("y el tirón en la base: H·h/s", c.vertical_kgf, c.H_kgf * 6 / 6, 1e-9);
  comp("en las bases del paño arriostrado", c.bases, ["B0@5", "B0@6"]);
  /* la cruz vertical en la línea x = 10 del hastial z = 0: peralte 9,2 − 6 = 3,2 */
  const v = e.vertical.filter((x) => x.extremo === "inicio" && x.x === 10)[0];
  cerca("arriostre vertical: R = la cabeza de la columna hastial", v.R_kgf, e.hastialInicio[2].Rcabeza_kgf, 1e-9);
  cerca("su diagonal: R·√(s² + peralte²)/s, con el peralte del tijeral en esa línea", v.diagonal_kgf,
    v.R_kgf * Math.sqrt(36 + 3.2 * 3.2) / 6, 1e-9);
  cerca("y el puntal de la brida inferior lleva R entera", v.puntal_kgf, v.R_kgf, 1e-12);
  const qLinea = e.correas.filter((x) => x.x === 10)[0];
  cerca("la correa de esa línea la lleva como puntal hasta el paño 5", qLinea.N_kgf,
    Math.max(v.R_kgf, e.vertical.filter((x) => x.extremo === "final" && x.x === 10)[0].R_kgf), 1e-9);
  comp("una línea de correa sin columna hastial no lleva viento a lo largo",
    e.correas.filter((x) => Math.abs(x.x - 20 / 12) < 1e-9)[0].N_kgf, 0);
  cierto("dentro del paño, cada correa lleva a lo sumo lo que entra a su línea (no el cortante del panel)",
    a.correas_kgf.every((f, k) => Math.abs(f - Math.abs(a.cargas_kgf[k])) < 1e-12));
}

/* ================================================================
   4 · EL SISMO · filas LG.sismo.sistema y LG.sismo.peso
   ================================================================ */
{
  const s = r.sismo;
  cerca("P = 2·P de fachada + 8·P interior", s.P_kgf, 2 * 1500 + 9 * 2800, 1e-9);
  cerca("T = hn/45, con hn hasta el alero", s.T_s, 7.2 / 45, 1e-12);
  const V = E030.cortanteBasal({ zona: "Z4", suelo: "S2", categoria: "C", sistema: "OCBF", pendulo: false,
    T_s: 7.2 / 45, P_kgf: s.P_kgf });
  cerca("V con OCBF, R₀ = 4", s.V_kgf, V.V_kgf, 1e-9);
  comp("R = 4", s.R, 4);
  cerca("cada pórtico aporta V·Pe/P, y suman V", s.porEje_kgf.reduce((a, x) => a + x, 0), s.V_kgf, 1e-9);
  const e = r.estados.filter((x) => x.tipo === "E")[0];
  cerca("todo el sismo llega al único paño arriostrado", e.armaduras[0].Rizq_kgf + e.armaduras[0].Rder_kgf,
    s.V_kgf, 1e-9);
  cerca("en el paño, el alero recibe su parte del sismo por su ancho de techo: medio panel de 20",
    e.armaduras[0].cargas_kgf[0], s.V_kgf * (10 / 12) / 20, 1e-9);
  cerca("y una línea interior, un panel entero", e.armaduras[0].cargas_kgf[3], s.V_kgf * (20 / 12) / 20, 1e-9);
  /* la correa del alero junta, hasta el paño 5, los ejes 0 a 4 por su ancho de techo (medio panel de 20/12) */
  const ejes04 = s.porEje_kgf.slice(0, 5).reduce((a, x) => a + x, 0);
  const ejes711 = s.porEje_kgf.slice(7).reduce((a, x) => a + x, 0);
  cerca("la correa del alero lleva a lo largo la parte de los ejes de un lado, por su ancho",
    e.correas[0].N_kgf, Math.max(ejes04, ejes711) * (10 / 12 / 20), 1e-9);
}
{
  /* paños arriostrados en los dos extremos: cada hastial va al suyo, y el eje central se reparte */
  const m3b = MON.monta(Object.assign({}, D, { panosArriostradosTecho: [0, 9], panosArriostradosFachada: [0, 9] }));
  const rb = LG.analiza({ m3: m3b, sistema: RIG, viento: VIENTO, sismo: SISMO, P_interior_kgf: 2800, P_fachada_kgf: 1500 });
  const e = rb.estados[0];
  comp("con los extremos arriostrados, las correas no llevan el viento a lo largo",
    e.correas.filter((x) => !x.esAlero).every((x) => x.N_kgf === 0), true);
  cerca("el paño 0 recibe las cabezas del hastial z = 0", e.armaduras[0].cargas_kgf.reduce((s, f) => s + f, 0),
    e.hastialInicio.reduce((s, c) => s + c.Rcabeza_kgf, 0), 1e-9);
  comp("el eje 5 está a 4 paños de los dos: mitad a cada uno", LG.destinos([0, 9], 5), [{ pano: 0, f: 0.5 }, { pano: 9, f: 0.5 }]);
  comp("el eje 1 toca el paño 0", LG.destinos([0, 9], 1), [{ pano: 0, f: 1 }]);
  const es = rb.estados.filter((x) => x.tipo === "E")[0];
  cerca("y entre los dos paños llega todo el sismo",
    es.armaduras.reduce((s, a) => s + a.Rizq_kgf + a.Rder_kgf, 0), rb.sismo.V_kgf, 1e-9);
}
{
  /* techo y fachada en paños distintos: la viga de alero lleva la reacción · fila MT.mismo.pano */
  const m3c = MON.monta(Object.assign({}, D, { panosArriostradosTecho: [5], panosArriostradosFachada: [0] }));
  const rc = LG.analiza({ m3: m3c, sistema: RIG, viento: VIENTO });
  const e = rc.estados[0];
  comp("la viga de alero lleva la reacción del paño 5 al 0, 30 m", [e.vigaAlero.length, e.vigaAlero[0].recorrido_m], [2, 30]);
  cerca("con la reacción entera del alero", e.vigaAlero[0].N_kgf, e.armaduras[0].Rizq_kgf, 1e-12);
  comp("y la cruz queda en el paño 0", e.cruces.map((c) => c.pano), [0, 0]);
  cierto("sin sismo, se dice", rc.avisos.some((x) => /sismo longitudinal no entra/.test(x)));
}

/* ================================================================
   5 · LOS FACTORES Y LA ENVOLVENTE · fila LG.factores
   ================================================================ */
comp("de la E.090: 1,3 para el viento y 1,0 para el sismo", r.factor, { W: 1.3, E: 1 });
{
  const pW = Math.max.apply(null, W.map((e) => e.cruces[0].diagonal_kgf));
  const pE = r.estados.filter((x) => x.tipo === "E")[0].cruces[0].diagonal_kgf;
  cerca("la cruz de fachada se diseña con el mayor de 1,3·W y 1,0·E", r.envolvente.cruzFachada.valor,
    Math.max(1.3 * pW, pE), 1e-9);
}
cierto("avisa del tramo entre la brida superior y la cabeza de columna",
  r.avisos.some((x) => /1,20 m más abajo/.test(x)));
cierto("con el tijeral apoyado también hay tramo: la cabeza está en la brida inferior y el alero 1,2 m arriba",
  rA.avisos.some((x) => /LG\.alero\.nivel/.test(x)));
{
  const sinH = MON.monta(Object.assign({}, D, { columnasHastiales: [] }));
  const rs = LG.analiza({ m3: sinH, sistema: RIG, viento: VIENTO });
  comp("sin columnas hastiales, solo las dos esquinas", rs.geometria.lineas.length, 2);
  cierto("y se avisa", rs.avisos.some((x) => /no hay columnas hastiales/.test(x)));
}
lanza("sin viento no hay nada que analizar", () => LG.analiza({ m3: m3, sistema: RIG }), ["V_kmh"]);
lanza("el sismo sin pesos de los pórticos se rechaza",
  () => LG.analiza({ m3: m3, sistema: RIG, viento: VIENTO, sismo: SISMO }), ["peso sísmico"]);
for (const id of ["LG.viento.hastial", "LG.vertical", "LG.techo.armadura", "LG.fachada.cruz", "LG.sismo.sistema"]) {
  cierto("la fila " + id + " existe y tiene fuente", INV.existe(id) && !!INV.fila(id).fuente);
}

fin();
