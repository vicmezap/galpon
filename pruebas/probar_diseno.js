/* =====================================================================
   probar_diseno.js — el ratio de cada barra del pórtico

   Lo que más importa no es el número: es que LO QUE NO SE PUDO COMPROBAR
   NO CUENTE COMO COMPROBADO.  Una diagonal sin las condiciones del E5, unos
   separadores demasiado lejos o una columna de ala no compacta tienen que
   salir como «no cumple», aunque su ratio sea bajo.

   El E4 se valida con McCormac, Ejemplo 6-9: una WT10.5×66 con pandeo
   flexotorsional, resuelta paso a paso.  Es una te y no un 2L, pero la
   ecuación E4-3 es la misma y es lo que el 2L usa.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const DI = require("../src/diseno.js");
const A = require("../src/analisis.js");
const AC = require("../src/acero.js");
const MON = require("../src/montaje.js");
const P = require("../src/perfiles.js");
const UN = require("../src/unidades.js");
const INV = require("../src/inventario.js");

const KSI = UN.KSI_KGCM2, PLG = UN.PULGADA_CM, K = UN.KIP_KGF;

comp("todas las filas que cita el módulo existen", Object.keys(DI.ART).filter((id) => !INV.existe(id)), []);

/* ================================================================
   1 · EL E4 · McCormac 6-9, WT10.5×66, A992
   ================================================================ */
const ey = DI.feFlexotorsional({ Fey_kgcm2: 42.66 * KSI, J_cm4: 5.62 * Math.pow(PLG, 4),
  Cw_cm6: 23.4 * Math.pow(PLG, 6), Lcz_cm: 240 * PLG, Ag_cm2: 19.4 * PLG * PLG,
  ro2: 21.16 * PLG * PLG, H: 0.84517 });
/* McCormac usa G = 11 200 ksi; el proyecto, MAT.G = 784 000 kgf/cm² (11 151 ksi). E igual. */
cerca("McCORMAC 6-9 · Fez = 153,62 ksi (G del proyecto un 0,4 % distinto)", ey.Fez_kgcm2 / KSI, 153.62, 0.006);
cerca("McCORMAC 6-9 · Fe flexotorsional = 40,42 ksi", ey.Fe_kgcm2 / KSI, 40.42, 0.004);
cierto("y Fe ≤ Fey: el flexotorsional nunca es mayor que el de flexión", ey.Fe_kgcm2 <= 42.66 * KSI);
/* con el Fe de fuera, compresion() toma el menor: aquí manda la flexión en x */
const A992 = { Fy_kgcm2: 50 * KSI, Fu_kgcm2: 65 * KSI };
const cx = AC.compresion(Object.assign({ Ag_cm2: 19.4 * PLG * PLG, Lc_cm: 300 * PLG, r_cm: 3.06 * PLG,
  noEsbelta: true, Fe_kgcm2: ey.Fe_kgcm2 }, A992));
cerca("McCORMAC 6-9 · manda la flexión en x: Pn = 480,3 klb", cx.Pn_kgf / K, 480.3, 0.003);
comp("y lo dice", cx.feOrigen, "flexión (E3)");
const cft = AC.compresion(Object.assign({ Ag_cm2: 19.4 * PLG * PLG, Lc_cm: 120 * PLG, r_cm: 3.06 * PLG,
  noEsbelta: true, Fe_kgcm2: ey.Fe_kgcm2, feOrigen: "flexotorsional (E4)" }, A992));
cerca("si la x fuera corta, mandaría el E4: Pn = 577,9 klb", cft.Pn_kgf / K, 577.9, 0.004);
comp("y diría que es el flexotorsional", cft.feOrigen, "flexotorsional (E4)");

/* ================================================================
   2 · EL PÓRTICO
   ================================================================ */
const m3 = MON.monta({ luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
  peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5] });
const N = { "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4",
  "diagonal": "L3X3X1/4", "montante": "L3X3X1/4", "correa": "C8X11.5", "viga de alero": "C8X11.5" };
const sec = (b) => (N[b.clase] ? P.busca(N[b.clase]) : null);
const r = A.analiza({ m3: m3, seccion: sec, acero: "A36", sistema: { base: "empotrada", union: "rigida" },
  cargas: { D_kgfm2: 8.35, Lr_kgfm2: 20.1, viento: { V_kmh: 75, aberturas: "repartidas", tipo: 1 },
    sismo: { zona: "Z4", suelo: "S2", categoria: "C", sistema: "OMF" } } });
const DZ = { arriostreInferior_m: 3.33, separacionLargueros_m: 1.5, LbColumna_m: 3, cartela: "3/8",
  separadores_cm: 60, conexionSeparadores: "requintado", condicionesE5: true, uniones: "soldadas",
  soldadura_cm: 10, arriostreComprobado: true };
const corre = (dz, sc) => DI.verificaPortico({ analisis: r, m3: m3, seccion: sc || sec, acero: "A36", diseno: dz });

/* ---- sin datos, se piden, sin rellenar ninguno ---- */
const v0 = corre({});
comp("sin datos no se verifica", v0.ok, false);
comp("y se pide cada dato de diseño", v0.faltan.map((f) => f.campo).sort(),
  ["di_ap6", "di_arrinf", "di_cart", "di_consep", "di_e5", "di_larg", "di_lb", "di_sep", "di_un"]);
comp("con uniones soldadas, se pide la longitud de soldadura",
  corre(Object.assign({}, DZ, { soldadura_cm: undefined })).faltan.map((f) => f.campo), ["di_sold"]);
comp("con empernadas, los pernos",
  corre(Object.assign({}, DZ, { uniones: "empernadas" })).faltan.map((f) => f.campo), ["di_pern"]);

/* ---- con todo ---- */
const v = corre(DZ);
comp("con todo, se verifica", v.ok, true);
comp("todas las barras del pórtico", v.resumen.total, Object.keys(r.barras).length);
cierto("cada barra tiene ratio", Object.keys(v.barras).every((k) => typeof v.barras[k].ratio === "number"));
comp("las cinco clases, con su peor barra", Object.keys(v.porClase).sort(),
  ["brida inferior", "brida superior", "columna", "diagonal", "montante"]);

/* ---- LA TRACCIÓN REHECHA A MANO: la brida inferior ---- */
const bi = v.barras.BI3;
const pBI = P.busca("2L3X3X1/4"), L1 = P.busca("L3X3X1/4");
const Ubi = 1 - L1.xbar_cm / 10;
const tBI = r.barras.BI3.traccion.Pr_kgf;
const capBI = Math.min(0.9 * 2530 * pBI.A_cm2, 0.75 * 4080 * Ubi * pBI.A_cm2);
cierto("la brida inferior se verifica también en COMPRESIÓN (levantamiento)", bi.verificadas === 2);
cierto("y su ratio no es menor que el de la tracción hecha a mano: la envolvente toma el peor",
  bi.ratio >= tBI / capBI - 1e-12);
{
  /* la tracción sola, para compararla exacta */
  const EL = require("../src/elemento.js");
  const t = EL.verifica({ id: "BI3", perfil: pBI, acero: "A36", An_cm2: pBI.A_cm2, U: Ubi,
    fuerzas: { Pu_kgf: tBI }, longitudes: {} });
  cerca("la tracción de la brida inferior es exactamente la de la cuenta a mano", t.ratio, tBI / capBI, 1e-12);
}

/* ---- EL E4 ENTRA EN LAS BRIDAS COMPRIMIDAS ---- */
const bs = v.barras.BS4;
cierto("la brida superior comprimida lleva su E4", bs.E4 && bs.E4.Fe_kgcm2 > 0);
cierto("con Fe flexotorsional ≤ Fey", bs.E4.Fe_kgcm2 <= bs.E4.Fey_kgcm2 + 1e-9);

/* ---- LO QUE NO SE PUEDE COMPROBAR, NO CUMPLE ---- */
const sinE5 = corre(Object.assign({}, DZ, { condicionesE5: false }));
const dsin = Object.keys(sinE5.barras).map((k) => sinE5.barras[k]).filter((x) => x.clase === "diagonal");
cierto("SIN LAS CONDICIONES DEL E5, ninguna diagonal comprimida cumple",
  dsin.filter((x) => x.verificadas === 2).every((x) => !x.cumple && x.faltanEsenciales));
cierto("y dice por qué: es flexo-compresión del Cap. H",
  dsin.some((x) => x.omitidos.some((o) => /Cap\. H/.test(o.motivo))));
const lejos = corre(Object.assign({}, DZ, { separadores_cm: 300 }));
cierto("SEPARADORES DEMASIADO LEJOS: la brida comprimida no cumple aunque su ratio sea bajo",
  !lejos.barras.BS4.cumple && lejos.barras.BS4.omitidos.some((o) => /separadores/.test(o.que) && o.esencial));
cierto("y dice la separación máxima", lejos.barras.BS4.omitidos.some((o) => /como máximo/.test(o.motivo)));
cierto("los separadores lejos BAJAN la capacidad: la esbeltez modificada crece",
  lejos.barras.BS4.ratio >= v.barras.BS4.ratio);
const brida = corre(Object.assign({}, DZ, { arriostreInferior_m: 20 }));
cierto("SIN ARRIOSTRE en la brida inferior (20 m), su compresión de levantamiento sube",
  brida.barras.BI3.ratio > v.barras.BI3.ratio);
const pocos = corre(Object.assign({}, DZ, { uniones: "empernadas", pernosPorLinea: 2, diametroPerno: '5/8"' }));
cierto("con 2 pernos por línea el U no se puede tomar del caso 8, y se dice",
  Object.keys(pocos.barras).some((k) => pocos.barras[k].omitidos.some((o) => /retraso|U/.test(o.que + o.motivo))));
/* una columna de ala no compacta con A36: no se calcula por F2 */
const noComp = (b) => (b.clase === "columna" ? P.busca("W6X15") : sec(b));
const rN = A.analiza({ m3: m3, seccion: noComp, acero: "A36", sistema: { base: "empotrada", union: "rigida" },
  cargas: { D_kgfm2: 8.35, Lr_kgfm2: 20.1, viento: { V_kmh: 75, aberturas: "repartidas", tipo: 1 } } });
const vN = DI.verificaPortico({ analisis: rN, m3: m3, seccion: noComp, acero: "A36", diseno: DZ });
cierto("W6X15: bf/2tf = " + P.busca("W6X15").bf_2tf + " > 10,8 con A36: el ala NO es compacta",
  P.busca("W6X15").bf_2tf > 0.38 * Math.sqrt(AC.E_ACERO / 2530));
cierto("y la columna no se da por buena por F2: falta F3", !vN.barras.C0.cumple &&
  vN.barras.C0.omitidos.some((o) => /no compacta/.test(o.que)));

/* ---- CASOS QUE DISTINGUEN: con los perfiles de arriba estos controles no
   deciden, y un mutante que los rompía sobrevivía. ---- */
{
  /* EL E4, comprobado contra el catálogo: J del 2L = 2·J del ángulo, ro y H de la cartela */
  const L1b = P.busca("L3X3X1/4"), p2 = P.busca("2L3X3X1/4");
  const g = A.geometria(m3, r.sistema, r.eje);
  const bs4 = g.truss.filter((b) => b.id.split("@")[0] === "BS4")[0];
  const a = g.nudos.filter((n) => n.id === bs4.i)[0], c = g.nudos.filter((n) => n.id === bs4.j)[0];
  const Lc = Math.hypot(c.x_m - a.x_m, c.y_m - a.y_m) * 100;
  const e6 = AC.esbeltezModificada({ lr0: Lc / p2.ry_sep38_cm, a_cm: 60, ri_cm: L1b.rz_cm, conexion: "requintado" });
  const fe = DI.feFlexotorsional({ Fey_kgcm2: Math.PI * Math.PI * AC.E_ACERO / (e6.lrm * e6.lrm),
    J_cm4: 2 * L1b.J_cm4, Lcz_cm: Lc, Ag_cm2: p2.A_cm2, ro2: p2.ro_sep38_cm * p2.ro_sep38_cm, H: p2.H_sep38 });
  cerca("el Fe flexotorsional de la brida es el de la E4-3 con los datos del catálogo",
    v.barras.BS4.E4.Fe_kgcm2, fe.Fe_kgcm2, 1e-12);
  /* EL E6: con separadores a 100 cm, a/ri pasa de 40 y la esbeltez se modifica */
  const s100 = corre(Object.assign({}, DZ, { separadores_cm: 100 }));
  cierto("separadores a 100 cm: a/ri > 40 y la esbeltez SE MODIFICA (E6-2)",
    s100.barras.BS4.E6 && s100.barras.BS4.E6.lrm > s100.barras.BS4.E6.lr0);
  const s30 = corre(Object.assign({}, DZ, { separadores_cm: 30 }));
  cierto("a 30 cm no: a/ri ≤ 40 y la esbeltez se queda", s30.barras.BS4.E6 &&
    s30.barras.BS4.E6.lrm === s30.barras.BS4.E6.lr0);
  cerca("y Fey se calcula con la esbeltez modificada", s100.barras.BS4.E4.Fey_kgcm2,
    Math.PI * Math.PI * AC.E_ACERO / Math.pow(s100.barras.BS4.E6.lrm, 2), 1e-12);
  /* EL U DE LA SOLDADURA: con 5 cm gobierna la rotura y U decide */
  const s5 = corre(Object.assign({}, DZ, { soldadura_cm: 5 }));
  const U5 = 1 - L1b.xbar_cm / 5;
  const t3 = r.barras.BI3.traccion.Pr_kgf;
  cierto("con 5 cm de soldadura la rotura gobierna la tracción (U = " + U5.toFixed(3) + ")",
    0.75 * 4080 * U5 < 0.9 * 2530);
  cierto("y el ratio de la brida inferior es al menos Pu/(0,75·Fu·U·Ag)",
    s5.barras.BI3.ratio >= t3 / (0.75 * 4080 * U5 * p2.A_cm2) - 1e-12);
  /* EL CASO B4 DEL 2L: b/t = 14 es esbelto separado (caso 3, λr 12,8) y no en contacto (caso 1, 15,9) */
  const p35 = (b) => (b.clase === "brida superior" ? P.busca("2L3-1/2X3-1/2X1/4") : sec(b));
  const rr = A.analiza({ m3: m3, seccion: p35, acero: "A36", sistema: r.sistema,
    cargas: { D_kgfm2: 8.35, Lr_kgfm2: 20.1, viento: { V_kmh: 75, aberturas: "repartidas", tipo: 1 } } });
  const sepd = DI.verificaPortico({ analisis: rr, m3: m3, seccion: p35, acero: "A36", diseno: DZ });
  const cont = DI.verificaPortico({ analisis: rr, m3: m3, seccion: p35, acero: "A36",
    diseno: Object.assign({}, DZ, { cartela: "0" }) });
  cierto("2L3½×3½×¼ SEPARADO por la cartela: el lado es esbelto (caso 3) y la brida no se da por buena",
    !sepd.barras.BS4.cumple && sepd.barras.BS4.faltanEsenciales);
  cierto("EN CONTACTO continuo (caso 1) no es esbelto y se verifica", cont.barras.BS4.ratio > 0 &&
    !cont.barras.BS4.omitidos.some((o) => o.esencial));
}

/* ---- la columna: lo que dice columnas.verifica en la combinación que gobierna ---- */
const c0 = v.barras.C0;
cierto("la columna se verifica en TODAS las combinaciones", c0.verificadas === r.corridas.length);
cierto("y gobierna la interacción del Cap. H o un estado individual con su capítulo", !!c0.capitulo);


/* ================================================================
   LO QUE TRABAJA A LO LARGO · verificaLongitudinal()
   ================================================================ */
{
  const LG = require("../src/longitudinal.js");
  const m3L = MON.monta({ luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
    peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe", panosArriostradosTecho: [5],
    panosArriostradosFachada: [5], columnasHastiales: [5, 10, 15] });
  const NL = { "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4",
    "diagonal": "L3X3X1/4", "montante": "L3X3X1/4", "correa": "C8X11.5", "viga de alero": "C8X11.5",
    "columna hastial": "W8X18", "arriostre de techo": "L3X3X1/4", "arriostre de fachada": "VAR5/8",
    "arriostre vertical": "VAR1/2", "puntal inferior": "L3X3X1/4" };
  const secL = (nom) => (b) => (nom[b.clase] ? P.busca(nom[b.clase]) : null);
  const CL = { D_kgfm2: 8.35, Lr_kgfm2: 20.1, viento: { V_kmh: 75, aberturas: "repartidas", tipo: 1 },
    sismo: { zona: "Z4", suelo: "S2", categoria: "C", sistema: "OMF" } };
  const SL = { base: "empotrada", union: "rigida" };
  const ri = A.analiza({ m3: m3L, seccion: secL(NL), acero: "A36", sistema: SL, cargas: CL });
  const rf = A.analiza({ m3: m3L, seccion: secL(NL), acero: "A36", sistema: SL, cargas: CL, eje: 0 });
  const lg = LG.analiza({ m3: m3L, sistema: SL, viento: CL.viento, sismo: CL.sismo,
    P_interior_kgf: ri.sismo.P_kgf, P_fachada_kgf: rf.sismo.P_kgf });
  const DZL = { arriostreInferior_m: 3.33, separacionLargueros_m: 1.5, LbColumna_m: 3, arriostreComprobado: true,
    cartela: "3/8", separadores_cm: 60, conexionSeparadores: "requintado", condicionesE5: true,
    uniones: "soldadas", soldadura_cm: 10 };
  const verL = (nom) => DI.verificaLongitudinal({ lg: lg, interior: ri, fachada: rf, m3: m3L, seccion: secL(nom),
    acero: "A36", diseno: DZL, cerramiento_kgfm2: 8.35 });
  const v = verL(NL);
  const pz = (nombre) => v.piezas.filter((x) => x.pieza.indexOf(nombre) === 0)[0];
  const A36 = AC.material("A36");

  /* las varillas · fila T.varillas */
  const cruz = pz("cruz de fachada"), Ab = P.busca("VAR5/8").A_cm2;
  cerca("la cruz de fachada: Pu / mín(0,9·Fy·Ab, 0,75·0,75·Fu·Ab)", cruz.ratio,
    lg.envolvente.cruzFachada.valor / Math.min(0.9 * A36.Fy * Ab, 0.75 * 0.75 * A36.Fu * Ab), 1e-12);
  comp("con VAR5/8 no llega: el sismo a lo largo es de todo el galpón", cruz.cumple, false);
  const conAngulo = verL(Object.assign({}, NL, { "arriostre de fachada": "L3X3X1/4" }));
  cierto("un tirante solo a tracción que no es varilla se dice, y no cumple",
    conAngulo.piezas[0].faltanEsenciales && /VARILLA/.test(conAngulo.piezas[0].omitidos[0].motivo));
  comp("la diagonal del arriostre vertical, con la suya", pz("diagonal del arriostre vertical").demanda,
    lg.envolvente.verticalDiagonal.valor);

  /* las que van a los dos lados */
  const at = pz("arriostre de techo");
  const ellMax = Math.max.apply(null, lg.estados[0].armaduras[0].paneles.map((x) => x.ell_m)) * 100;
  cerca("el arriostre de techo, con su diagonal más larga", at.L_cm, ellMax, 1e-9);
  comp("y a tracción y a compresión", at.verificadas, 2);
  {
    const hss = verL(Object.assign({}, NL, { "arriostre de techo": "HSS4X4X1/4" })).piezas
      .filter((x) => x.pieza === "arriostre de techo")[0];
    const H4 = P.busca("HSS4X4X1/4");
    const cx4 = AC.compresion({ acero: "A36", Ag_cm2: H4.A_cm2, Lc_cm: ellMax, r_cm: Math.min(H4.rx_cm, H4.ry_cm),
      elementos: [{ nombre: "pared", razon: Math.max(H4.b_t, H4.h_t), caso: 6 }],
      Pu_kgf: lg.envolvente.armaduraTecho.valor });
    cerca("un tubo rectangular de arriostre de techo: su compresión con el r menor y la diagonal entera", hss.ratio,
      Math.max(cx4.ratio, lg.envolvente.armaduraTecho.valor / (0.9 * A36.Fy * H4.A_cm2)), 1e-9);
    cierto("y dice que el U de la tracción supone el tubo soldado en todo su contorno",
      hss.omitidos.some((o) => /U = 1/.test(o.motivo) && !o.esencial));
    const otra = verL(Object.assign({}, NL, { "arriostre de techo": "C8X11.5" })).piezas
      .filter((x) => x.pieza === "arriostre de techo")[0];
    cierto("una familia que no está conectada se dice SIN hablar del tijeral",
      otra.faltanEsenciales && /a lo largo/.test(otra.omitidos[0].motivo) && !/tijeral/.test(otra.omitidos[0].motivo));
  }
  cerca("el puntal del arriostre vertical, con la separación de pórticos", pz("puntal del arriostre vertical").L_cm, 600, 1e-12);

  /* la viga de alero de puntal y la columna hastial: con B1 · fila E.A8.Cm.transv */
  const va = pz("viga de alero de puntal");
  comp("la viga de alero de puntal se verifica con su axial", [va.demanda, typeof va.ratio], [lg.envolvente.aleroPuntal.valor, "number"]);
  const ch = pz("columna hastial");
  const W8 = P.busca("W8X18");
  const peorCol = lg.columnas.filter((c) => c.tipo === "hastial").reduce((a, c) => (c.M_kgfm > a.M_kgfm ? c : a));
  cerca("la columna hastial: la flecha de servicio 5·w·H⁴/(384·E·I), sin factorizar", ch.servicio.delta_cm,
    5 * (peorCol.w_kgfm / 100) * Math.pow(600, 4) / (384 * AC.E_ACERO * W8.Ix_cm4), 1e-9);
  comp("contra H/120", ch.servicio.limite_cm, 5);
  cerca("con 1,2 veces su peso y el muro de su franja", ch.Pu_kgf, 1.2 * (W8.peso_kgfm * 6 + 8.35 * 5 * 6), 1e-9);
  cierto("y con el 1,3 del viento sobre el momento", Math.abs(ch.demanda - 1.3 * peorCol.M_kgfm) < 1e-9);

  /* un S4X7.7: resiste el momento (0,7) pero flecta 5,08 cm, más que H/120 = 5 cm */
  const blanda = verL(Object.assign({}, NL, { "columna hastial": "S4X7.7" }))
    .piezas.filter((x) => x.pieza === "columna hastial")[0];
  cierto("una columna hastial que resiste pero flecta más de H/120 NO cumple, y dice por qué",
    blanda.ratio < 1 && blanda.servicio.pasa === false && blanda.cumple === false && /L\/120/.test(blanda.falla));
  /* lo pendiente se dice */
  const co = pz("correa de puntal");
  cierto("SIN EL DISEÑO DE LAS CORREAS, la correa de puntal no se da por buena, y se dice",
    co.cumple === false && co.faltanEsenciales && /no se han verificado/.test(co.omitidos[0].motivo));
  cerca("con su axial a la vista", co.demanda, lg.envolvente.correaPuntal.valor, 1e-12);

  /* la esquina y la brida del paño arriostrado */
  const es = pz("columna de esquina");
  const nLong = rf.corridas.filter((c) => c.id.split(" · ").slice(1).join(" ").split(" ")
    .some((t) => rf.casos.some((k) => k.id === t && k.direccion === "longitudinal"))).length;
  comp("la columna de esquina se mira en TODAS las corridas con viento longitudinal, y solo en ellas",
    [es.verificadas, nLong > 0], [nLong, true]);
  const bs = pz("brida superior del paño arriostrado");
  const peorB = Object.keys(ri.barras).map((k) => ri.barras[k]).filter((x) => x.clase === "brida superior")
    .reduce((a, x) => (x.compresion.Pr_kgf < a.compresion.Pr_kgf ? x : a));
  cerca("la brida del paño arriostrado: su mayor compresión más el cordón de la armadura", bs.demanda,
    -peorB.compresion.Pr_kgf + lg.envolvente.cordonTecho.valor, 1e-9);
  comp("el resumen cuenta lo que cumple y lo que falta", [v.resumen.total, v.resumen.conOmitidosEsenciales],
    [v.piezas.length, v.piezas.filter((x) => x.faltanEsenciales).length]);
  lanza("sin el análisis longitudinal no hay nada que verificar", () => DI.verificaLongitudinal({}), ["longitudinal.analiza"]);

  /* ================================================================
     LAS CORREAS · verificaCorreas()
     ================================================================ */
  const CRG = { D_kgfm2: 8.35, Lr_kgfm2: 20.1, viento: CL.viento, sismo: CL.sismo };
  const DC = { tensores: 1, panelTramos: 3, clipCorreas: true };
  const vc = (nom, dz, conLg) => DI.verificaCorreas({ m3: m3L, interior: ri, cargas: CRG, seccion: secL(nom),
    acero: "A36", diseno: dz || DC, espesor_mm: 0.4, lg: conLg === false ? null : lg });
  comp("sin datos, pide los tres: tensores, tramos de la plancha y clip",
    DI.verificaCorreas({ m3: m3L, interior: ri, cargas: CRG, seccion: secL(NL), acero: "A36", diseno: {} })
      .faltan.map((f) => f.campo), ["di_ten", "di_ptram", "di_clip"]);
  const sinClip = vc(NL, Object.assign({}, DC, { clipCorreas: false }));
  cierto("SIN CLIP la correa no se da por verificada (F1(b), fila F.hipotesis)",
    sinClip.cumple === false && /F1\(b\)/.test(sinClip.omitida.motivo));
  const precor = P.catalogo().filter((x) => x.estado === "espera" && x.familia === "C")[0];
  const fria = vc(Object.assign({}, NL, { "correa": precor.id }));
  cierto("una correa conformada en frío se dice: es el AISI, la fase 2", fria.omitida && /AISI/.test(fria.omitida.motivo));

  const c0 = vc(NL);
  const C8 = P.busca("C8X11.5");
  comp("una línea por nudo de brida superior: 13", c0.lineas.length, 13);
  const tipica = c0.lineas[3], alero = c0.lineas[0], cumbre = c0.lineas[6];
  const tr = 20 / 12, Lt = Math.hypot(tr, 0.2 * tr), th = Math.atan(0.2);
  cerca("la típica recoge medio tramo a cada lado, por la superficie", tipica.ancho_m, Lt, 1e-12);
  cerca("el alero, medio tramo", alero.ancho_m, Lt / 2, 1e-12);
  comp("la cumbrera queda horizontal: las componentes de los dos faldones se cancelan", cumbre.tipo, "cumbrera");
  cerca("(θ = 0 salvo el redondeo)", cumbre.theta_grad, 0, 1e-12);
  /* 1,4·D a mano: (D·ancho + peso) vertical, proyectada en el eje mayor; M = w·L²/8 */
  const f14 = tipica.fuerzas.filter((x) => x.combo === "1.4-1")[0];
  const wD = 8.35 * Lt + C8.peso_kgfm;
  cerca("1,4·D · eje mayor: 1,4·(D·ancho + peso)·cos θ", f14.wMayor_kgfm, 1.4 * wD * Math.cos(th), 1e-9);
  cerca("y el menor, con sen θ", Math.abs(f14.wMenor_kgfm), 1.4 * wD * Math.sin(th), 1e-9);
  cerca("Mux = w·L²/8 con la luz entera", f14.Mux_kgfcm, 1.4 * wD * Math.cos(th) / 100 * 600 * 600 / 8, 1e-6);
  cerca("Muy con la luz partida por el tensor: L/2", f14.Muy_kgfcm, 1.4 * wD * Math.sin(th) / 100 * 300 * 300 / 8, 1e-6);
  /* el viento: la MISMA presión que el pórtico, por tramo */
  const vw = A.casosViento(A.geometria(m3L, SL, ri.eje), CL.viento).casos;
  const w9 = vw.filter((x) => x.direccion === "longitudinal")[0];
  const fw = tipica.fuerzas.filter((x) => x.combo === "1.4-6 · " + w9.id)[0];
  /* la presión Ph es + hacia el techo: la succión es negativa y entra sumando */
  cerca("0,9·D − 1,3·W: la succión del techo levanta la correa", fw.wMayor_kgfm,
    0.9 * wD * Math.cos(th) + 1.3 * w9.techo[3] * Lt, 1e-9);
  cierto("(y es succión: la correa queda levantada)", fw.wMayor_kgfm < 0);
  /* el puntal: la axial del MISMO estado, con su Ci · fila CR.combinaciones */
  const eW = lg.estados.filter((e) => e.tipo === "W" && Math.abs(e.Ci - w9.Ci) < 1e-9)[0];
  const lineaH = c0.lineas.filter((l) => Math.abs(l.x_m - 5) < 1e-9)[0];
  const Nw = Math.max(eW.correas[lineaH.q].N_kgf, eW.armaduras[0].correas_kgf[lineaH.q]);
  cerca("en la línea de la columna hastial, la axial del viento longitudinal con su Ci y el 1,3",
    -lineaH.fuerzas.filter((x) => x.combo === "1.4-6 · " + w9.id)[0].Pu_kgf, 1.3 * Nw, 1e-9);
  {
    /* EL Ci IMPORTA cuando cada hastial tiene su paño: con un solo paño, la correa del paño lleva los dos
       hastiales sumados y 0,5 + 0,9 = 1,1 + 0,3; con los paños 0 y 9, cada uno lleva el suyo */
    const m3e = MON.monta({ luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
      peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe", panosArriostradosTecho: [0, 9],
      panosArriostradosFachada: [0, 9], columnasHastiales: [5, 10, 15] });
    const lge = LG.analiza({ m3: m3e, sistema: SL, viento: CL.viento, P_interior_kgf: 1, P_fachada_kgf: 1 });
    const ce = DI.verificaCorreas({ m3: m3e, interior: ri, cargas: Object.assign({}, CRG, { sismo: undefined }),
      seccion: secL(NL), acero: "A36", diseno: DC, espesor_mm: 0.4, lg: lge });
    const lh = ce.lineas.filter((l) => Math.abs(l.x_m - 5) < 1e-9)[0];
    const Nci = (w) => {
      const e = lge.estados.filter((x) => x.tipo === "W" && Math.abs(x.Ci - w.Ci) < 1e-9)[0];
      return Math.max.apply(null, e.armaduras.map((a) => a.correas_kgf[lh.q]));
    };
    const [wa, wb] = vw.filter((x) => x.direccion === "longitudinal");
    cierto("(con los paños 0 y 9, los dos Ci dan axiales distintas)", Math.abs(Nci(wa) - Nci(wb)) > 1);
    for (const w of [wa, wb]) {
      cerca("Ci " + w.Ci + ": la axial de SU estado longitudinal", -lh.fuerzas.filter((x) => x.combo === "1.4-6 · " + w.id)[0].Pu_kgf,
        1.3 * Nci(w), 1e-9);
    }
  }
  comp("con el viento transversal no hay axial", lineaH.fuerzas.filter((x) => x.combo === "1.4-6 · W1")[0].Pu_kgf, -0);
  cierto("las líneas que hacen de puntal se marcan", lineaH.puntal);
  const sin = vc(NL, DC, false);
  cierto("sin el sistema a lo largo la axial no está, y la correa sale menos cargada",
    sin.lineas.every((l) => !l.puntal) && sin.lineas[3].ratio <= c0.lineas[3].ratio + 1e-12);
  {
    const flaca = vc(Object.assign({}, NL, { "correa": "C3X4.1" }));
    const lp = flaca.lineas.filter((l) => l.puntal && l.faltanEsenciales)[0];
    cierto("una correa de puntal que pandea con su axial (Pr ≥ Pe1) se dice, no revienta",
      lp && /pandea/.test(lp.omitidos.filter((o) => o.esencial)[0].motivo) && !flaca.cumple);
  }
  /* el servicio y la plancha */
  cerca("la flecha con 0,5·Lr: 5·w·L⁴/(384·E·I)", c0.deflexion.delta_cm,
    5 * (0.5 * 20.1 * Lt * Math.cos(th) / 100) * Math.pow(600, 4) / (384 * AC.E_ACERO * C8.Ix_cm4), 1e-9);
  cerca("contra L/240", c0.deflexion.limite_cm, 2.5, 1e-12);
  cerca("la plancha: la viva contra la tabla del TR-4 con la separación de las correas",
    c0.panel.ratio, 20.1 / c0.panel.P_kgfm2, 1e-12);
  comp("con 3 tramos", c0.panel.tramos, 3);
  /* y la correa de puntal del sistema longitudinal sale de aquí */
  const vlc = DI.verificaLongitudinal({ lg: lg, interior: ri, fachada: rf, m3: m3L, seccion: secL(NL), acero: "A36",
    diseno: DZL, cerramiento_kgfm2: 8.35, correas: c0 });
  const cp = vlc.piezas.filter((x) => x.pieza === "correa de puntal")[0];
  const pts = c0.lineas.filter((l) => l.puntal);
  cerca("la correa de puntal del sistema a lo largo es la peor línea que hace de puntal", cp.ratio,
    Math.max.apply(null, pts.map((l) => l.ratio)), 1e-12);
  cierto("y ya no falta", !cp.faltanEsenciales);
}

fin();
