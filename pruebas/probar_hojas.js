/* =====================================================================
   probar_hojas.js — la hoja CARGAS, con fórmulas vivas · E9

   Tres cosas:
     1. cada fórmula da el número del motor (fila H.coincide)
     2. la hoja ES VIVA: se cambia un dato EN LA HOJA y el resultado sigue
        siendo el del motor con ese dato —zona, V̄s30, tipo, período—
     3. las ramas de la norma: nieve, pendientes, áreas pequeñas
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const H = require("../src/hojas.js");
const X = require("../src/excel.js");
const R = require("../src/resultados.js");
const MON = require("../src/montaje.js");
const L = require("../src/libro.js");
const P = require("../src/perfiles.js");
const INV = require("../src/inventario.js");
const E030 = require("../src/e030.js");
const E020 = require("../src/e020.js");
const VI = require("../src/viento.js");

comp("todas las filas que cita el módulo existen", Object.keys(H.ART).filter((id) => !INV.existe(id)), []);

const GEO = { luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
  peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5] };
const SITIO = { espesorCobertura_mm: 0.4, Dotras_kgfm2: 5, hayNieve: false, V_kmh: 75,
  tipoEdificacion: 1, aberturas: { izqDer: "repartidas", derIzq: "repartidas", longitudinal: "repartidas" },
  acero: "A36", zona: "Z4", suelo: "S2", categoria: "C", sistemaSismico: "OMF", industrial: false };
const NOMBRES = { "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4",
  "diagonal": "L2X2X3/16", "montante": "L2X2X3/16", "correa": "C8X11.5", "viga de alero": "C8X11.5" };
let mod = Object.assign(L.nuevo({}), { sitio: SITIO, sistema: { base: "empotrada", union: "rigida" } });
for (const k of Object.keys(NOMBRES)) mod = L.asignaPerfil(mod, { clase: k }, NOMBRES[k]).modelo;

const m3 = MON.monta(GEO);
const ai = R.analisis(m3, mod, P, "interior"), af = R.analisis(m3, mod, P, "fachada");
const hoja = (geo, sitio, conAnalisis) => {
  const m = geo ? MON.monta(Object.assign({}, GEO, geo)) : m3;
  const s = Object.assign({}, SITIO, sitio || {});
  return H.hojaCargas({ cargas: R.cargas(m, s), sitio: s, interior: conAnalisis === false ? null : ai.r,
    fachada: conAnalisis === false ? null : af.r, version: "v-prueba", fecha: "2026-10-02" });
};
const h0 = hoja();
const v = (h, n) => X.valor(h, n);
/* cambiar un dato EN LA HOJA, como lo haría quien abre el libro */
const cambia = (h, n, valor) => {
  const c = Object.assign({}, h.celdas);
  c[h.nombres[n]] = Object.assign({}, c[h.nombres[n]], { v: valor });
  return Object.assign({}, h, { celdas: c });
};

/* ================================================================
   1 · LA GUARDA · cada fórmula, el número del motor
   ================================================================ */
cierto("más de cien fórmulas comprobadas", h0.comprobacion.comprobadas > 100);
comp("y ninguna se separa del motor", h0.comprobacion.malas, []);
comp("solo con funciones que excel.js sabe evaluar", X.funciones(h0).filter((f) => !X.FUNCIONES[f]), []);
comp("el peso de la cobertura, de la tabla", v(h0, "Dcob"), E020.pesoCobertura(0.4).peso_kgfm2);
comp("la viva reducida, escrita como la norma", h0.celdas[h0.nombres.Lr].f, "=IF(Ai<=40,Lo,MAX(0.5*Lo,MIN(Lo,Lrb)))");
cerca("y da la del motor", v(h0, "Lr"), R.cargas(m3, SITIO).cargas.Lr_kgfm2, 1e-12);
cerca("el cortante basal del pórtico interior, el del análisis", v(h0, "V_i"), ai.r.sismo.V_kgf, 1e-9);
cerca("y el del de fachada, el suyo", v(h0, "V_f"), af.r.sismo.V_kgf, 1e-9);
comp("el período y el peso entran como valor, en verde (fila H.analisis)",
  [h0.celdas[h0.nombres.Tray_i].estilo, h0.celdas[h0.nombres.P_i].estilo, h0.celdas[h0.nombres.Tray_i].f], ["analisis", "analisis", undefined]);
cierto("y lo dice su fuente", /H\.analisis/.test(h0.celdas["F" + h0.nombres.P_i.slice(1)].v));
comp("las filas del viento: 10 por dirección transversal con Ci ±0,3, y 2 a lo largo", h0.filasViento, 22);

/* ---- los nombres: ninguno puede ser una celda de Excel ---- */
const malos = Object.keys(h0.nombres).filter((n) => /^[A-Za-z]{1,3}\d+$/.test(n) || /^[RrCc]$/.test(n) || /^[Rr]\d/.test(n));
comp("ningún nombre de la hoja se confunde con una celda (vs30 es la celda VS30)", malos, []);
lanza("y el armador lo impide", () => H.armador("X").nombra("vs30", "C1"), ["no puede ser un nombre de Excel"]);
lanza("y un nombre repetido", () => { const a = H.armador("X"); a.nombra("Vh", "C1"); a.nombra("Vh", "C2"); }, ["dos veces"]);
cierto("toda fuente que cita es una fila del inventario o un dato",
  Object.keys(h0.celdas).filter((k) => /^F/.test(k) && h0.celdas[k].estilo === "fuente")
    .every((k) => /^(dato del proyecto|Geometría)$/.test(h0.celdas[k].v) ||
      h0.celdas[k].v.split(" · ").some((p) => INV.existe(p.trim()))));

/* ================================================================
   2 · LA HOJA ES VIVA · se cambia un dato en la hoja y sigue al motor
   ================================================================ */
{
  const z = ai.r.sismo;
  const conZ3 = cambia(h0, "zona", "Z3");
  const V3 = E030.cortanteBasal({ zona: "Z3", suelo: "S2", categoria: "C", pendulo: false, sistema: "OMF",
    T_s: z.T_s, P_kgf: z.P_kgf });
  cerca("con la zona Z3 escrita en la hoja, V es el de la E.030 con Z3", v(conZ3, "V_i"), V3.V_kgf, 1e-9);
  cerca("(y S cambia con ella: Tabla N° 4)", v(conZ3, "S"), V3.S, 1e-12);
  for (const vs of [300, 400, 549, 600]) {
    const suelo = vs >= 550 ? "S1" : "S2";
    const st = E030.sitio({ zona: "Z4", suelo: suelo, vs30_ms: vs });
    const hv = cambia(cambia(h0, "vsMed", vs), "suelo", suelo);
    comp("con V̄s30 = " + vs + " m/s en " + suelo + ", S, TP y TL interpolados como el motor",
      [v(hv, "S"), v(hv, "TP"), v(hv, "TL")].map((x) => +x.toFixed(10)), [st.S, st.TP, st.TL].map((x) => +x.toFixed(10)));
  }
  const ht = cambia(h0, "tipoW", 2);
  const fila = h0.nombres.Vh;   /* una fila del viento cualquiera: la primera tras la cabecera */
  const filasPh = Object.keys(ht.celdas).filter((k) => /^E\d+$/.test(k) && /^=Kp\*D/.test(ht.celdas[k].f || ""));
  cierto("con el tipo 2 en la hoja, cada Ph sale 1,2 veces el del tipo 1",
    filasPh.length === 22 && filasPh.every((k) => Math.abs(v(ht, k) - 1.2 * v(h0, k)) < 1e-9) && !!fila);
  /* el período en sus tres tramos: C del motor */
  for (const T of [0.3, 0.9, 1.5, 3]) {
    const hT = cambia(h0, "Tray_i", T / 0.85);
    cerca("con T = " + T + " s, C es el de la E.030 (estático, sin rampa)", v(hT, "Cs_i"),
      E030.factorCestatico({ T_s: T, TP: 0.6, TL: 2.0 }).C, 1e-12);
  }
  cerca("con C/R por debajo del mínimo, manda 0,11", v(cambia(h0, "Tray_i", 50), "CRu_i"), E030.CR_MIN, 1e-12);
  comp("una plancha que no se fabrica (0,42 mm cae en un hueco) da #N/A, no un peso inventado",
    String(v(cambia(h0, "esp", 0.42), "Dcob")), "#N/A");
  comp("Z4 con S4 da #N/A: «requiere un análisis de respuesta de sitio»",
    String(v(cambia(h0, "suelo", "S4"), "S")), "#N/A");
  cerca("el péndulo invertido, R₀ = 2,5", v(cambia(h0, "sistema", "pendulo"), "Rs"), 2.5, 1e-12);
  cerca("y una irregularidad escrita en la hoja entra en R como en el motor", v(cambia(cambia(h0, "Ia", 0.75), "Ip", 0.9), "Rs"),
    E030.coefR({ pendulo: false, sistema: "OMF", Ia: 0.75, Ip: 0.9 }).R, 1e-12);
}

/* ================================================================
   3 · LAS RAMAS DE LA NORMA, con el motor al otro lado
   ================================================================ */
{
  /* la pendiente: 20 % es el inciso de ≤ 15°; 50 %, el de 15° a 60° */
  const h50 = hoja({ pendiente: 0.5 });
  comp("con 50 % de pendiente, la hoja sigue al motor", h50.comprobacion.malas, []);
  comp("y el techo toma el inciso de 15° a 60°", [v(h0, "casoTecho"), v(h50, "casoTecho")], ["inc15", "inc1560"]);
  /* el área pequeña: sin reducción */
  const hA = hoja({ luz_m: 6, largo_m: 25, sepPorticos_m: 5, paneles: 3, peralteApoyo_m: 0.6, panosArriostradosTecho: [2],
    panosArriostradosFachada: [2] }, null, false);
  comp("con Ai ≤ 40 m² tampoco se separa", hA.comprobacion.malas, []);
  comp("y Lr es Lo, sin reducir", v(hA, "Lr"), 30);
  /* la nieve, en sus tres incisos y con la desbalanceada */
  for (const [pend, inc] of [[0.2, "a"], [0.5, "b"], [1.2, "c"]]) {
    const hn = hoja({ pendiente: pend }, { hayNieve: true, Qs_kgfm2: 30 }, false);
    const th = v(hn, "theta");
    comp("con nieve y θ = " + th.toFixed(1) + "°, el inciso " + inc + ") del Art. 11.3: la hoja sigue al motor",
      hn.comprobacion.malas, []);
    if (inc === "a") comp("(y no hay desbalanceada con θ ≤ 15°)", v(hn, "QdA"), "no aplica");
    else cierto("(con su desbalanceada)", v(hn, "QdA") > 0);
  }
  const hn = hoja(null, { hayNieve: true, Qs_kgfm2: 30 }, false);
  comp("Qs sube al mínimo de 40", v(hn, "Qs"), 40);
  /* justo pasados los 15°: el techo cambia de inciso, y la nieve también */
  const h155 = hoja({ pendiente: Math.tan(15.5 * Math.PI / 180) }, { hayNieve: true, Qs_kgfm2: 50 }, false);
  comp("con θ = 15,5° la hoja sigue al motor", [h155.comprobacion.malas, v(h155, "casoTecho")], [[], "inc1560"]);
  /* la desbalanceada con semiluz ≤ 6 m: 1,3·Qt y nada en el otro faldón */
  const hc = hoja({ luz_m: 12, paneles: 4, peralteApoyo_m: 0.8, pendiente: 0.5 }, { hayNieve: true, Qs_kgfm2: 50 }, false);
  comp("con ℓ/2 = 6 m la desbalanceada es 1,3·Qt y 0, como el motor", [hc.comprobacion.malas, v(hc, "QdB")], [[], 0]);
  cerca("(1,3·Qt)", v(hc, "QdA"), 1.3 * v(hc, "Qt"), 1e-12);
  /* las aberturas a barlovento: un solo Ci */
  const hb = hoja(null, { aberturas: { izqDer: "barlovento", derIzq: "sotavento", longitudinal: "repartidas" } }, false);
  comp("con aberturas a barlovento y a sotavento, la hoja sigue al motor", hb.comprobacion.malas, []);
  comp("y tiene una fila por cada Ci: 5 + 5 + 2", hb.filasViento, 12);
  comp("sin análisis, el cortante no se escribe y se dice",
    [hb.nombres.V_i, Object.keys(hb.celdas).some((k) => /todavía no corre/.test(hb.celdas[k].v || ""))], [undefined, true]);
  /* el viento bajo el mínimo: manda 75 */
  const hv = hoja(null, { V_kmh: 40 }, false);
  comp("con V = 40 km/h manda el mínimo de 75", [hv.comprobacion.malas, v(hv, "Vh")], [[], 75]);
  cerca("y con V = 100, Vh = V·(h/10)^0,22", v(hoja(null, { V_kmh: 100 }, false), "Vh"),
    VI.velocidadDiseno({ V_kmh: 100, h_m: v(h0, "hc") }).Vh_kmh, 1e-12);
}

/* ================================================================
   4 · LAS COMBINACIONES Y LO DEMÁS
   ================================================================ */
{
  const textos = Object.keys(h0.celdas).map((k) => h0.celdas[k].v).filter((x) => typeof x === "string");
  cierto("las combinaciones del acero, con la que gobierna la gravedad", textos.indexOf("1.2 D + 1.6 Lr") >= 0);
  cierto("y las del concreto", textos.some((t) => /CM \+ 1\.7 CV/.test(t)));
  cierto("con sus factores en celdas", Object.keys(h0.celdas).some((k) => h0.celdas[k].v === 1.6 && h0.celdas[k].estilo === "norma"));
  lanza("sin las cargas completas no hay hoja", () => H.hojaCargas({ cargas: R.cargas(m3, {}), sitio: {} }), ["no están completas"]);
  comp("las hojas que hay y las que vienen", H.HOJAS.map((x) => [x.id, x.listo]),
    [["cargas", true], ["diseno", false], ["cimentacion", false], ["metrado", false]]);
  comp("todo texto lleva formato de texto: «1.4-3» no se vuelve una fecha al escribirse",
    Object.keys(h0.celdas).filter((k) => typeof h0.celdas[k].v === "string" && h0.celdas[k].fmt !== "@"), []);
}

fin();
