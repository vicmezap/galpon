/* =====================================================================
   probar_zapatas.js — E8, la zapata aislada del galpón

   Sin un ejemplo de libro con viento E.020, sismo E.030-2026 y momento en
   la base, se comprueba lo que no puede fallar:
     · la presión en sus tres formas cerradas: uniforme, e = L/6, triangular
     · que la presión equilibra la fuerza Y el momento
     · las combinaciones de servicio y de la E.060, contadas
     · el levantamiento, el punzonamiento con Jc de la Fig. 11.12.6 y el
       acero, rehechos a mano
     · que las medidas que busca sean las MÍNIMAS: 5 cm menos ya no cumple
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const Z = require("../src/zapatas.js");
const A = require("../src/analisis.js");
const MON = require("../src/montaje.js");
const P = require("../src/perfiles.js");
const UN = require("../src/unidades.js");
const INV = require("../src/inventario.js");

comp("todas las filas que cita el módulo existen", Object.keys(Z.ART).filter((id) => !INV.existe(id)), []);

/* ================================================================
   1 · LA PRESIÓN, sin tracción
   ================================================================ */
const B = 200, L = 250, N = 50000;
const p0 = Z.presion(N, 0, B, L);
cerca("e = 0: uniforme N/(B·L)", p0.qmax, N / (B * L), 1e-12);
const p6 = Z.presion(N, L / 6, B, L);
cerca("e = L/6: el mínimo llega a cero", p6.qmin + 1, 1, 1e-12);
cerca("y el máximo es 2N/(B·L)", p6.qmax, 2 * N / (B * L), 1e-12);
comp("todavía trapecio", p6.forma, "trapecio");
const p3 = Z.presion(N, L / 3, B, L);
comp("e = L/3: triángulo", p3.forma, "triángulo");
cerca("con contacto 3·(L/2 − e) = L/2", p3.contacto, L / 2, 1e-12);
cerca("y máximo 4N/(B·L)", p3.qmax, 4 * N / (B * L), 1e-12);
comp("e ≥ L/2: vuelca", Z.presion(N, L / 2, B, L).vuelca, true);
comp("N ≤ 0: se levanta", Z.presion(-10, 0, B, L).levanta, true);
for (const [nom, pr, e] of [["trapecio", Z.presion(N, 20, B, L), 20], ["triángulo", p3, L / 3],
  ["triángulo al otro lado", Z.presion(N, -L / 3, B, L), -L / 3]]) {
  cerca(nom + " · ∫q·B = N", Z.integra((x) => pr.q(x) * B, -L / 2, L / 2), N, 1e-6);
  cerca(nom + " · ∫q·B·x = N·e: la resultante cae donde dice e",
    Z.integra((x) => pr.q(x) * B * x, -L / 2, L / 2), N * e, 1e-6);
}

/* ================================================================
   2 · EL GALPÓN
   ================================================================ */
const m3 = MON.monta({ luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
  peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5] });
const NOM = { "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4",
  "diagonal": "L3X3X1/4", "montante": "L3X3X1/4", "correa": "C8X11.5", "viga de alero": "C8X11.5" };
const sec = (b) => (NOM[b.clase] ? P.busca(NOM[b.clase]) : null);
const r = A.analiza({ m3: m3, seccion: sec, acero: "A36", sistema: { base: "empotrada", union: "apoyado" },
  cargas: { D_kgfm2: 8.35, Lr_kgfm2: 20.1, viento: { V_kmh: 75, aberturas: "repartidas", tipo: 1 },
    sismo: { zona: "Z4", suelo: "S2", categoria: "C", sistema: "pendulo" } } });
const D0 = { casos: r.casos,
  suelo: { sigmaAdm_kgfcm2: 1.5, esNeta: false, Df_cm: 150, gammaRelleno_kgfm3: 1800, sc_kgfm2: 250, mu: 0.45 },
  concreto: { fc_kgcm2: 210, grado: "60", rec_cm: 7.5, barra: "5/8" },
  pedestal: { b_cm: 40, l_cm: 50, sobreTerreno_cm: 20 } };

/* ---- sin datos, se piden ---- */
comp("sin datos no diseña y pide cada uno", Z.disena({ casos: r.casos }).faltan.map((f) => f.campo).sort(),
  ["ci_barra", "ci_df", "ci_fc", "ci_gr", "ci_grado", "ci_neta", "ci_ped", "ci_rec", "ci_sc", "ci_sigma", "ci_sobre"]);

/* ---- las combinaciones ---- */
const est = Z.estados(r.casos);
const cs = Z.combosServicio(est);
cierto("servicio: D, D + Lr, y cada viento con y sin techo", cs.some((c) => c.id === "D") &&
  cs.some((c) => c.id === "D + Lr") && cs.some((c) => c.id === "D + W1") && cs.some((c) => c.id === "D + Lr + W1"));
cierto("el sismo al 80 % (fila Z.sismo80)", cs.filter((c) => /0,8·E/.test(c.id))
  .every((c) => c.partes.some(([s, f]) => s.tipo === "E" && f === 0.8)));
comp("con viento o sismo la combinación es temporal: +30 %",
  cs.filter((c) => c.temporal).length, cs.filter((c) => /W|E/.test(c.id)).length);
comp("1 + 1 + 2·10 + 4 combinaciones de servicio", cs.length, 1 + 1 + 2 * 10 + 4);
const ce = Z.combosE060(est);
cierto("E.060: solo la variante + con estados físicos (fila Z.signo)", ce.every((c) => !/−/.test(c.id)));
comp("9-1 · 9-2 × 10 · 9-3 × 10 · 9-4 × 4 · 9-5 × 4", ce.length, 1 + 10 + 10 + 4 + 4);
cierto("la 9-3 lleva 0,9 sobre la muerta", ce.filter((c) => c.base === "9-3").every((c) => c.factorCM === 0.9));

/* ---- una zapata dada, rehecha a mano ---- */
const dims = { B_cm: 220, L_cm: 220, h_cm: 50 };
const v = Z.verifica(D0, dims);
const gc = 2400 / 1e6, gr = 1800 / 1e6;
cerca("presión neta = σ − γr·(Df − h) − s/c (fila Z.sigma.neta)", v.sigmaN, 1.5 - gr * 100 - 250 / 1e4, 1e-12);
cerca("peso de la zapata = γc·B·L·h", v.pesos.zapata, gc * 220 * 220 * 50, 1e-9);
cerca("el pedestal sube del techo de la zapata a 20 cm sobre el terreno", v.altPedestal_cm, 100 + 20, 1e-12);
cerca("relleno sobre la zapata, sin el pedestal", v.pesos.relleno, gr * (220 * 220 - 40 * 50) * 100, 1e-9);
/* el levantamiento a mano: la peor */
const lev = v.levantamiento;
if (lev.combo) {
  const id = lev.combo.split(" · ")[1];
  const caso = r.casos.filter((c) => c.id === id)[0];
  const f = /^9-3/.test(lev.combo) ? 1.25 : 1.0;
  const muerta = r.casos[0].reacciones[lev.base].Ry_kgf + v.pesos.pedestal + v.pesos.zapata + v.pesos.relleno;
  cerca("levantamiento = f·(tirón) / (0,9·(D + pedestal + zapata + relleno))", lev.ratio,
    f * -caso.reacciones[lev.base].Ry_kgf / (0.9 * muerta), 1e-12);
}
/* el deslizamiento */
const sl = v.servicio.deslizamiento;
cerca("deslizamiento = μ·(N + relleno)/|H|", sl.deslizamiento, 0.45 * (sl.N + v.pesos.relleno) / Math.abs(sl.H), 1e-12);

/* ---- EL +30 % Y EL BRAZO DEL CORTANTE, rehechos a mano ---- */
{
  const fW = v.servicio.filas.filter((x) => x.combo === "D + W1" && x.base === "B0")[0];
  const fD = v.servicio.filas.filter((x) => x.combo === "D" && x.base === "B0")[0];
  cerca("con viento la admisible sube un 30 % (fila Z.inc30)", fW.admisible, 1.3 * v.sigmaN, 1e-12);
  cerca("sin carga temporal, la admisible tal cual", fD.admisible, v.sigmaN, 1e-12);
  /* e desde las reacciones: P = Ry, H = −Rx, M = −Mz sobre la zapata; M en el fondo = M − H·brazo */
  const R0 = r.casos[0].reacciones.B0, RW = r.casos.filter((c) => c.id === "W1")[0].reacciones.B0;
  const P0 = R0.Ry_kgf + RW.Ry_kgf, H0 = -(R0.Rx_kgf + RW.Rx_kgf), M0 = -(R0.Mz_kgfcm + RW.Mz_kgfcm);
  const Nn = P0 + v.pesos.pedestal + v.pesos.zapata;
  const brazo = v.altPedestal_cm + dims.h_cm;
  cerca("e = −(M − H·brazo)/N, con el cortante llevado al fondo de la zapata", fW.e, -(M0 - H0 * brazo) / Nn, 1e-12);
}

/* ---- EL CORTANTE COMO VIGA, a d de la cara, con presión uniforme exacta ---- */
{
  const sint = [
    { id: "D", tipo: "D", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 20000, Mz_kgfcm: 0 } } },
    { id: "Lr", tipo: "Lr", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 10000, Mz_kgfcm: 0 } } }];
  const vs = Z.verifica(Object.assign({}, D0, { casos: sint }), dims);
  /* la presión lleva TODO el peso con 1,4 (fila Z.peso), y al volado se le quita lo que
     pesan la zapata y el relleno de encima: lo que dobla es la diferencia */
  const Nu = 1.4 * (20000 + vs.pesos.pedestal + vs.pesos.zapata + vs.pesos.relleno) + 1.7 * 10000;
  const q = Nu / (220 * 220) - 1.4 * (gc * 50 + gr * 100);
  const dL = vs.concreto.dL;
  cerca("Vu a d de la cara = q·B·(L/2 − c1/2 − d) (fila Z.Vc.viga)", vs.concreto.cortL.Vu,
    q * 220 * (110 - 25 - dL), 1e-6);
  cerca("y φVc = 0,85·0,17·√f'c·B·d", vs.concreto.cortL.phiVc,
    0.85 * 0.17 * Math.sqrt(210 / UN.MPA_KGCM2) * UN.MPA_KGCM2 * 220 * dL, 1e-9);
  cerca("el momento en la cara = q·B·(L/2 − c1/2)²/2", vs.concreto.flexL.Mu, q * 220 * Math.pow(110 - 25, 2) / 2, 1e-6);
  comp("con presión uniforme no hay momento negativo", vs.concreto.aceroSup, null);
  const cB = (220 - 40) / 2, dB = vs.concreto.dB, dp = (dL + dB) / 2;
  cerca("dirección B: Mu = q·L·cB²/2", vs.concreto.flexB.Mu, q * 220 * cB * cB / 2, 1e-6);
  cerca("y Vu a d de la cara = q·L·(cB − d)", vs.concreto.cortB.Vu, q * 220 * (cB - dB), 1e-6);
  cerca("punzonamiento: Vu = q·(B·L − (c1+d)·(c2+d)), lo de fuera de la sección crítica",
    vs.concreto.punz.Vu, q * (220 * 220 - (50 + dp) * (40 + dp)), 1e-6);
}

/* ---- MUY EXCÉNTRICA: el volado que no apoya se dobla al revés ---- */
{
  /* M grande: con 1,4·D la resultante cae cerca del borde y el volado del otro lado
     queda entero sin suelo debajo · su momento es solo su peso: w·B·(L/2 − c1/2)²/2 */
  const sint = [{ id: "D", tipo: "D", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 20000, Mz_kgfcm: -3.2e6 } } },
    { id: "Lr", tipo: "Lr", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 0, Mz_kgfcm: 0 } } }];
  const vs = Z.verifica(Object.assign({}, D0, { casos: sint }), dims);
  const pr = Z.presion(1.4 * (20000 + vs.pesos.pedestal + vs.pesos.zapata + vs.pesos.relleno), 3.2e6 /
    (20000 + vs.pesos.pedestal + vs.pesos.zapata + vs.pesos.relleno), 220, 220);
  cierto("(el caso: la base solo apoya en el lado contrario, más allá de la cara)",
    pr.forma === "triángulo" && pr.contacto < 110 - 25);
  const w = 1.4 * (gc * 50 + gr * 100);
  cerca("momento negativo = w·B·(L/2 − c1/2)²/2 en la cara del lado que no apoya", (vs.concreto.negL || {}).Mu,
    w * 220 * Math.pow(110 - 25, 2) / 2, 1e-6);
  cierto("y pide parrilla superior", vs.concreto.aceroSup && vs.concreto.aceroSup.n >= 2 && vs.concreto.aceroSup.As > 0);
  comp("sin sumarle otra vez el mínimo, que ya lo pone la de abajo", (vs.concreto.aceroSup || {}).As_min, 0);
  const sup = vs.concreto.aceroSup || {};
  cierto("con poco momento, el número de barras lo fija la separación máxima, y así lo dice",
    sup.manda === "separación" && sup.As > 2 * sup.As_req && sup.s <= 40 + 1e-9 &&
    (220 - 2 * 7.5 - 1.5875) / (sup.n - 2) > 40);
  /* y si la amplificada cae fuera de la base, no hay equilibrio: falla, no se salta */
  const fuera = [{ id: "D", tipo: "D", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 20000, Mz_kgfcm: -4e6 } } },
    { id: "Lr", tipo: "Lr", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 0, Mz_kgfcm: 0 } } }];
  const vf = Z.verifica(Object.assign({}, D0, { casos: fuera }), dims);
  cierto("resultante amplificada fuera de la base: falla por vuelco (fila Z.vuelco)",
    vf.vuelcoAmplificado.length > 0 && vf.fallas.indexOf("vuelco con cargas amplificadas") >= 0);
  const zf = Z.disena(Object.assign({}, D0, { casos: fuera }));
  cierto("y al buscar medidas, el lado crece hasta que la resultante cae dentro",
    zf.vuelcoAmplificado.length === 0 && zf.zapata.B_cm > 220);
  /* el caso fino: el servicio ya cumple, pero 0,9·D + 1,25·W lleva la resultante 1,39
     veces más lejos y se sale · el lado tiene que seguir creciendo por eso */
  const viento = [{ id: "D", tipo: "D", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 5000, Mz_kgfcm: 0 } } },
    { id: "Lr", tipo: "Lr", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 0, Mz_kgfcm: 0 } } },
    { id: "W1", tipo: "W", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 0, Mz_kgfcm: -5e5 } } }];
  const dv = Object.assign({}, D0, { casos: viento,
    suelo: Object.assign({}, D0.suelo, { sigmaAdm_kgfcm2: 10, esNeta: true, Df_cm: 80 }) });
  const zv = Z.disena(dv);
  const antes = Z.verifica(dv, { B_cm: zv.zapata.B_cm - 5, L_cm: zv.zapata.L_cm - 5, h_cm: zv.zapata.h_cm });
  cierto("con el servicio cumpliendo 5 cm antes, lo que hace crecer el lado es el vuelco amplificado",
    zv.vuelcoAmplificado.length === 0 && antes.servicio.peor.ratio <= 1 && antes.vuelcoAmplificado.length > 0);
}

/* ---- el punzonamiento, con la Fig. 11.12.6 ---- */
const pz = v.concreto.punz;
const d = pz.d, c1 = 50, c2 = 40;
cerca("γv = 1 − 1/(1 + ⅔·√((c1+d)/(c2+d))) (ec. 13-1 y 11-39)", pz.gv,
  1 - 1 / (1 + (2 / 3) * Math.sqrt((c1 + d) / (c2 + d))), 1e-12);
cerca("bo = 2·(c1 + c2 + 2d)", pz.bo, 2 * (c1 + c2 + 2 * d), 1e-12);
const Ac = 2 * d * (c1 + c2 + 2 * d);
const Jc = d * Math.pow(c1 + d, 3) / 6 + (c1 + d) * Math.pow(d, 3) / 6 + d * (c2 + d) * Math.pow(c1 + d, 2) / 2;
cerca("vu = Vu/Ac + γv·Mu·(c1+d)/2/Jc, con Ac y Jc de la figura", pz.vu,
  pz.Vu / Ac + pz.gv * pz.Mt * (c1 + d) / 2 / Jc, 1e-12);
cierto("y el momento transferido NO es despreciable: γv·Mt sube el esfuerzo",
  pz.gv * pz.Mt * (c1 + d) / 2 / Jc > 0.1 * pz.Vu / Ac);
const rf = Math.sqrt(210 / UN.MPA_KGCM2) * UN.MPA_KGCM2;
const beta = 50 / 40;
cerca("φvn = 0,85·mín de las tres ecuaciones (11-33 a 11-35) en kgf/cm²", pz.phivn,
  0.85 * rf * Math.min(0.17 * (1 + 2 / beta), 0.083 * (40 * d / pz.bo + 2), 0.33), 1e-12);
cerca("el 0,17 √MPa en kgf/cm² es 0,543: Retícula usa 0,53", 0.17 * Math.sqrt(UN.MPA_KGCM2), 0.5429, 1e-3);

/* ---- el acero: reproduce su momento ---- */
const aL = v.concreto.aceroL, fy = 420 * UN.MPA_KGCM2;
const a = aL.As_req * fy / (0.85 * 210 * aL.b);
cerca("φ·As·fy·(d − a/2) = Mu: el acero calculado reproduce su momento",
  0.9 * aL.As_req * fy * (aL.d - a / 2), aL.Mu, 1e-9);
cerca("mínimo 0,0018 con Grado 60 (420 MPa)", aL.As_min, 0.0018 * 220 * 50, 1e-12);
cerca("y 0,0020 con Grado 40 (280 MPa < 420)",
  Z.verifica(Object.assign({}, D0, { concreto: Object.assign({}, D0.concreto, { grado: "40" }) }), dims).concreto.aceroL.As_min,
  0.0020 * 220 * 50, 1e-12);
cierto("separación ≤ 3h y ≤ 40 cm", aL.s <= Math.min(150, 40) + 1e-9);
cierto("y el acero puesto cubre el que hace falta", aL.As >= Math.max(aL.As_req, aL.As_min) - 1e-9);

/* ---- DISEÑAR: las medidas que busca son las mínimas ---- */
const z = Z.disena(D0);
comp("busca medidas y cumple", [z.auto, z.cumple], [true, true]);
comp("y NINGUNA combinación de la E.060 se queda fuera del diseño del concreto",
  z.avisos.filter((x) => /no apoya/.test(x)), []);
const menos = Z.verifica(D0, { B_cm: z.zapata.B_cm - 5, L_cm: z.zapata.L_cm - 5, h_cm: z.zapata.h_cm });
cierto("5 cm menos de lado ya NO cumple el suelo o el levantamiento",
  menos.servicio.peor.ratio > 1 || menos.levantamiento.ratio > 1);
cierto("el peralte respeta 300 mm sobre el acero + recubrimiento (fila Z.peralte.min)",
  z.zapata.h_cm >= 30 + 7.5 + 1.5875 - 1e-9);
cierto("con columnas empotradas MANDA EL MOMENTO: la presión sale triangular",
  z.servicio.peor.forma === "triángulo");
const rA = A.analiza({ m3: m3, seccion: sec, acero: "A36", sistema: { base: "articulada", union: "rigida" },
  cargas: { D_kgfm2: 8.35, Lr_kgfm2: 20.1, viento: { V_kmh: 75, aberturas: "repartidas", tipo: 1 },
    sismo: { zona: "Z4", suelo: "S2", categoria: "C", sistema: "OMF" } } });
const zA = Z.disena(Object.assign({}, D0, { casos: rA.casos }));
cierto("con base articulada la zapata sale MENOR: no hay momento de la columna",
  zA.zapata.B_cm < z.zapata.B_cm);
/* el viento que levanta: con poco peso, la zapata se dimensiona por levantamiento */
const ligero = Z.disena(Object.assign({}, D0, { casos: rA.casos,
  suelo: Object.assign({}, D0.suelo, { sigmaAdm_kgfcm2: 4, Df_cm: 60 }) }));
cierto("con buen suelo y poco desplante, el levantamiento se acerca a lo que decide",
  ligero.levantamiento.ratio > 0.3);

/* ---- avisos y rechazos ---- */
cierto("sin nada a lo largo, avisa de que es la zapata de un pórtico interior típico", z.avisos.some((x) => /no le llega nada a lo largo/.test(x)));
cierto("y del anclaje del perno, pendiente de norma", z.avisos.some((x) => /J\.anclaje\.concreto/.test(x)));
const recBajo = Z.verifica(Object.assign({}, D0, { concreto: Object.assign({}, D0.concreto, { rec_cm: 5 }) }), dims);
cierto("un recubrimiento de 5 cm contra el suelo NO cumple (70 mm, fila Z.rec)",
  recBajo.fallas.indexOf("recubrimiento") >= 0);
const conPed = Z.disena(Object.assign({}, D0, { hMinPedestal_cm: 52 }));
cierto("con el mínimo que piden las barras del pedestal, el peralte sube a 55 (pasos de 5)", conPed.zapata.h_cm === 55);
cierto("y con medidas dadas por debajo, falla por el anclaje del pedestal",
  Z.verifica(Object.assign({}, D0, { hMinPedestal_cm: 52 }), dims).fallas.indexOf("anclaje del pedestal") >= 0 &&
  Z.verifica(D0, dims).fallas.indexOf("anclaje del pedestal") < 0);
const sinMu = Z.disena(Object.assign({}, D0, { suelo: Object.assign({}, D0.suelo, { mu: undefined }) }));
cierto("sin μ se dice que el deslizamiento no se comprobó", sinMu.avisos.some((x) => /deslizamiento/.test(x)));


/* ================================================================
   EL MOMENTO EN LAS DOS DIRECCIONES · filas Z.biaxial, Z.longitudinal.articulada, Z.punzon.biaxial
   ================================================================ */
{
  const Nb = 40000, Bb = 150, Lb = 200;
  const vol = (pr, f) => Z.integra2((x, y) => pr.q2(x, y) * f(x, y), -Lb / 2, Lb / 2, -Bb / 2, Bb / 2, 200, 200);
  /* dentro del núcleo: el plano entero, cerrado */
  const pk = Z.presion2(Nb, 15, 10, Bb, Lb);
  comp("con |ex|/L + |ey|/B ≤ 1/6, el plano entero", pk.forma, "plano entero");
  cerca("qmax = N/A·(1 + 6·ex/L + 6·ey/B)", pk.qmax, Nb / (Bb * Lb) * (1 + 6 * 15 / Lb + 6 * 10 / Bb), 1e-12);
  for (const [nom, pr, ex, ey] of [["núcleo", pk, 15, 10], ["fuera del núcleo", Z.presion2(Nb, 50, 35, Bb, Lb), 50, 35]]) {
    cerca(nom + " · EQUILIBRIO: ∫∫q = N", vol(pr, () => 1), Nb, nom === "núcleo" ? 1e-9 : 2e-3);
    cerca(nom + " · ∫∫q·x = N·ex", vol(pr, (x) => x), Nb * ex, nom === "núcleo" ? 1e-9 : 3e-3);
    cerca(nom + " · ∫∫q·y = N·ey", vol(pr, (x, y) => y), Nb * ey, nom === "núcleo" ? 1e-9 : 3e-3);
  }
  const pt = Z.presion2(Nb, 50, 35, Bb, Lb);
  cierto("fuera del núcleo: el plano truncado, sin tracción, y parte de la base sin contacto",
    pt.forma === "plano truncado" && pt.qmin === 0 && pt.contacto < 1 && pt.convergio);
  /* CERRADO: la resultante en la diagonal de un cuadrado, cerca de la esquina. El contacto es un
     triángulo rectángulo de catetos a en la esquina; la cuña tiene volumen qmax·a²/6 y su centroide
     a a/4 de la esquina en cada eje: a = 4·u y qmax = 6N/a² */
  {
    const S0 = 200, u = 20, pr = Z.presion2(Nb, S0 / 2 - u, S0 / 2 - u, S0, S0), a = 4 * u;
    cerca("resultante en la diagonal, a 20 cm de cada borde: qmax = 6·N/(4u)² (la cuña de la esquina)",
      pr.qmax, 6 * Nb / (a * a), 0.02);
    cerca("y el contacto es el triángulo: a²/2 de la base", pr.contacto, a * a / 2 / (S0 * S0), 0.05);
  }
  {
    /* justo fuera del núcleo (0,2 > 1/6): el plano entero ya daría tracción en una esquina */
    const p2 = Z.presion2(Nb, 24, 15, Bb, Lb);
    cierto("con |ex|/L + |ey|/B = 0,22, fuera del núcleo: truncado, sin tracción",
      p2.forma === "plano truncado" && p2.qmin === 0 && p2.contacto < 1);
    cierto("(el plano entero ahí tendría una esquina en tracción)",
      Nb / (Bb * Lb) * (1 - 6 * 24 / Lb - 6 * 15 / Bb) < 0);
  }
  /* los casos límite vuelven a lo de siempre */
  cerca("con ey = 0 es el trapecio de siempre", Z.presion2(Nb, 20, 0, Bb, Lb).qmax, Z.presion(Nb, 20, Bb, Lb).qmax, 1e-12);
  cerca("con ex = 0 es el mismo problema girado", Z.presion2(Nb, 0, 30, Bb, Lb).qmax, Z.presion(Nb, 30, Lb, Bb).qmax, 1e-12);
  comp("con la resultante fuera de la base en B, vuelca", Z.presion2(Nb, 10, Bb / 2, Bb, Lb).vuelca, true);

  /* EN LA ZAPATA: el mismo cortante a lo largo debe hacer en B lo que hace en L · zapata y pedestal cuadrados */
  const Dq = Object.assign({}, D0, { pedestal: { b_cm: 45, l_cm: 45, sobreTerreno_cm: 20 } });
  const caso = (Rx, Rz) => [{ id: "D", tipo: "D", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 20000, Mz_kgfcm: 0 } } },
    { id: "Lr", tipo: "Lr", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 0, Mz_kgfcm: 0 } } },
    { id: "W1", tipo: "W", reacciones: { B0: { Rx_kgf: Rx, Ry_kgf: 0, Mz_kgfcm: 0, Rz_kgf: Rz } } }];
  const dq = { B_cm: 200, L_cm: 200, h_cm: 50 };
  const enL = Z.verifica(Object.assign({}, Dq, { casos: caso(-3000, 0) }), dq);
  const enB = Z.verifica(Object.assign({}, Dq, { casos: caso(0, -3000) }), dq);
  cerca("Hz a lo largo flexiona en B lo mismo que Hx en L (cuadrada)", enB.concreto.flexB.Mu, enL.concreto.flexL.Mu, 1e-9);
  cerca("y la presión de servicio es la misma", enB.servicio.peor.qmax, enL.servicio.peor.qmax, 1e-9);
  cerca("en el punzonamiento, el momento a lo largo es Hz·(altura del pedestal), con la base articulada",
    enB.concreto.punz.MtZ, 1.25 * 3000 * enB.altPedestal_cm, 1e-9);
  cerca("y transfiere con SU γv, igual al del otro eje en un pedestal cuadrado", enB.concreto.punz.gvZ, enL.concreto.punz.gv, 1e-12);
  {
    const vd = Z.verifica(Object.assign({}, Dq, { casos: caso(-3000, -4000) }), dq);
    const fw = vd.servicio.filas.filter((x) => x.combo === "D + W1")[0];
    cerca("el deslizamiento usa la resultante de los dos cortantes: μ·(N + relleno)/√(3000² + 4000²)",
      fw.deslizamiento, 0.45 * (fw.N + vd.pesos.relleno) / 5000, 1e-12);
  }
  const ambos = Z.verifica(Object.assign({}, Dq, { casos: caso(-3000, -3000) }), dq);
  cierto("con los dos a la vez, la presión es mayor que con cualquiera de los dos solos",
    ambos.servicio.peor.qmax > enL.servicio.peor.qmax);
  cierto("y el punzonamiento suma los dos momentos", ambos.concreto.punz.vu > enL.concreto.punz.vu);
}


/* ================================================================
   E.030 · EL VOLTEO (Art. 64) Y LAS VIGAS DE CONEXIÓN (Art. 65.1)
   ================================================================ */
{
  /* el volteo a mano: FS = N·(L/2)/M con D + 1,0·E, sin el 0,8, y todo el peso que sujeta */
  const sv = [{ id: "D", tipo: "D", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 10000, Mz_kgfcm: 0 } } },
    { id: "Lr", tipo: "Lr", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 0, Mz_kgfcm: 0 } } },
    /* reacciones con el signo de un pórtico real: el cortante de la base suma su momento en el fondo */
    { id: "E1", tipo: "E", reacciones: { B0: { Rx_kgf: 2000, Ry_kgf: 0, Mz_kgfcm: -8e5 } } }];
  const dv = { B_cm: 160, L_cm: 160, h_cm: 50 };
  const vv = Z.verifica(Object.assign({}, D0, { casos: sv }), dv);
  const N = 10000 + vv.pesos.pedestal + vv.pesos.zapata + vv.pesos.relleno;
  const M = 8e5 + 2000 * (vv.altPedestal_cm + 50);
  cerca("volteo: FS = N·(L/2)/M, con pedestal, zapata y relleno sujetando (fila Z.volteo.E030)", vv.volteo.fs,
    N * 80 / M, 1e-12);
  comp("con D + E, SIN el 0,8 del Art. 29", vv.volteo.combo, "D + E1");
  cierto("(y aquí pasa de 1,2)", vv.volteo.cumple && vv.volteo.fs > 1.2);
  /* con más momento no llega: FS = 1,1, entre 1,0 y 1,2, falla */
  const Mz11 = N * 80 / 1.1 - 2000 * (vv.altPedestal_cm + 50);
  const sv2 = sv.map((c) => c.id === "E1" ? { id: "E1", tipo: "E", reacciones: { B0: { Rx_kgf: 2000, Ry_kgf: 0, Mz_kgfcm: -Mz11 } } } : c);
  const vf = Z.verifica(Object.assign({}, D0, { casos: sv2 }), dv);
  cerca("(el caso: FS = 1,1)", vf.volteo.fs, 1.1, 1e-9);
  cierto("con FS = 1,1 < 1,2 falla por volteo", !vf.volteo.cumple && vf.fallas.indexOf("volteo con sismo (E.030 Art. 64)") >= 0);
  /* con un suelo muy bueno la presión no manda: lo que hace crecer el lado es el volteo */
  const Dbueno = Object.assign({}, D0, { casos: sv2, suelo: Object.assign({}, D0.suelo, { sigmaAdm_kgfcm2: 20, esNeta: true }) });
  const zf = Z.disena(Dbueno);
  const antes = Z.verifica(Dbueno, { B_cm: zf.zapata.B_cm - 5, L_cm: zf.zapata.L_cm - 5, h_cm: zf.zapata.h_cm });
  cierto("al buscar medidas, el lado crece hasta FS ≥ 1,2 aunque la presión no lo pida",
    zf.volteo.cumple && !antes.volteo.cumple && antes.servicio.peor.ratio < 1);
  /* a lo largo: el mismo FS con Hz en B */
  const svz = [sv[0], sv[1], { id: "E1", tipo: "E", reacciones: { B0: { Rx_kgf: 0, Ry_kgf: 0, Mz_kgfcm: 0, Rz_kgf: -2000 } } }];
  const vz = Z.verifica(Object.assign({}, D0, { casos: svz }), { B_cm: 120, L_cm: 200, h_cm: 50 });
  comp("a lo largo se mira en B", vz.volteo.direccion, "B");

  /* LAS VIGAS DE CONEXIÓN · fila Z.conexion */
  comp("S3 en zona 4: se exigen", Z.conexionExigida({ suelo: "S3", zona: "Z4", sigmaAdm_kgfcm2: 2 }).exigida, true);
  comp("S3 en zona 2: no, si la presión es buena", Z.conexionExigida({ suelo: "S3", zona: "Z2", sigmaAdm_kgfcm2: 2 }).exigida, false);
  comp("S2 en zona 4: no", Z.conexionExigida({ suelo: "S2", zona: "Z4", sigmaAdm_kgfcm2: 1.5 }).exigida, false);
  comp("y con presión admisible menor que 0,10 MPa, siempre", Z.conexionExigida({ suelo: "S1", zona: "Z1",
    sigmaAdm_kgfcm2: 0.9 }).exigida, true);
  cerca("0,10 MPa son 1,02 kgf/cm²", Z.conexionExigida({}).sigmaLimite_kgfcm2, 0.10 * UN.MPA_KGCM2, 1e-12);
  const vg = Z.vigaConexion({ Pu_kgf: 60000, b_cm: 25, h_cm: 40, fc_kgcm2: 210, grado: "60", barra: "5/8" });
  cerca("la fuerza: el 10 % de la carga amplificada de la columna", vg.F_kgf, 6000, 1e-12);
  cerca("a tracción: F/(0,9·fy)", vg.As_traccion_cm2, 6000 / (0.9 * 420 * UN.MPA_KGCM2), 1e-12);
  comp("con el 1 % de 25 × 40 = 10 cm² manda el mínimo: 6 barras de 5/8\" (11,9 cm²)", vg.n, 6);
  const As = 6 * Math.PI * 1.5875 * 1.5875 / 4;
  cerca("a compresión: 0,80·0,70·(0,85·f'c·(Ag − Ast) + fy·Ast)", vg.phiPn_kgf,
    0.56 * (0.85 * 210 * (1000 - As) + 420 * UN.MPA_KGCM2 * As), 1e-9);
  lanza("sin sección no se diseña", () => Z.vigaConexion({ Pu_kgf: 1, fc_kgcm2: 210, grado: "60", barra: "5/8" }), ["b y h"]);
}

fin();
