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
  acero: "A36", distrito: "LIMA › LIMA · MIRAFLORES", suelo: "S2", uso: "deposito", riesgoAdicional: false, usoSecCat: "no", sistemaSismico: "OMF", industrial: false };
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
cierto("y lo dice en la fila", /del análisis/.test(h0.celdas["G" + h0.nombres.P_i.slice(1)].v));
comp("las filas del viento: 10 por dirección transversal con Ci ±0,3, y 2 a lo largo", h0.filasViento, 22);

/* ---- los nombres: ninguno puede ser una celda de Excel ---- */
comp("ningún nombre de la hoja se confunde con una celda (vs30 es la celda VS30)",
  Object.keys(h0.nombres).filter((n) => !H.nombreValido(n)), []);
comp("ni con la notación F1C1 de ningún idioma: «fc» lo rechazó el Excel en español; «Z» y «S», el alemán",
  ["fc", "F", "C", "F2C3", "Z", "S", "Z1S1", "L", "LC", "R", "RC", "R1", "K", "WK", "vs30", "A1"].filter(H.nombreValido), []);
comp("y los que sí valen", ["fpc", "Zf", "Sf", "Lr", "Lo", "Sc", "U", "fV", "CR_i", "FyCor"].filter((n) => !H.nombreValido(n)), []);
lanza("y el armador lo impide", () => H.armador("X").nombra("vs30", "C1"), ["no puede ser un nombre de Excel"]);
lanza("y un nombre repetido", () => { const a = H.armador("X"); a.nombra("Vh", "C1"); a.nombra("Vh", "C2"); }, ["dos veces"]);
{
  /* la columna Norma: cada celda es el artículo de una fila del inventario, o dice que es un dato */
  const arts = new Set(Object.keys(H.ART).map((id) => H.ART[id]).concat(
    require("../src/combinaciones.js").paraAcero({ casos: { D: true, Lr: true, W: true, E: true } }).combinaciones.map((c) => c.art),
    require("../src/combinaciones.js").paraConcreto({ casos: { D: true, Lr: true, W: true, E: true } }).combinaciones.map((c) => c.art)));
  const normas = Object.keys(h0.celdas).filter((k) => /^J\d+$/.test(k) && h0.celdas[k].estilo === "fuente");
  cierto("hay columna de norma en las tablas (" + normas.length + " celdas)", normas.length > 60);
  comp("y TODA cita es un artículo del inventario, o un dato del proyecto o del modelo",
    normas.filter((k) => !(arts.has(h0.celdas[k].v) || /^(dato del proyecto|del modelo)/.test(h0.celdas[k].v)))
      .map((k) => k + ": " + h0.celdas[k].v), []);
}

/* ================================================================
   2 · LA HOJA ES VIVA · se cambia un dato en la hoja y sigue al motor
   ================================================================ */
{
  const z = ai.r.sismo;
  const conZ3 = cambia(h0, "zona", "Z3");
  const V3 = E030.cortanteBasal({ zona: "Z3", suelo: "S2", categoria: "C", pendulo: false, sistema: "OMF",
    T_s: z.T_s, P_kgf: z.P_kgf });
  cerca("con la zona Z3 escrita en la hoja, V es el de la E.030 con Z3", v(conZ3, "V_i"), V3.V_kgf, 1e-9);
  cerca("(y S cambia con ella: Tabla N° 4)", v(conZ3, "Sf"), V3.S, 1e-12);
  for (const vs of [300, 400, 549, 600]) {
    const suelo = vs >= 550 ? "S1" : "S2";
    const st = E030.sitio({ zona: "Z4", suelo: suelo, vs30_ms: vs });
    const hv = cambia(cambia(h0, "vsMed", vs), "suelo", suelo);
    comp("con V̄s30 = " + vs + " m/s en " + suelo + ", S, TP y TL interpolados como el motor",
      [v(hv, "Sf"), v(hv, "TP"), v(hv, "TL")].map((x) => +x.toFixed(10)), [st.S, st.TP, st.TL].map((x) => +x.toFixed(10)));
  }
  const ht = cambia(h0, "tipoW", 2);
  const fila = h0.nombres.Vh;   /* una fila del viento cualquiera: la primera tras la cabecera */
  const filasPh = Object.keys(ht.celdas).filter((k) => /^G\d+$/.test(k) && /^=Kp\*F/.test(ht.celdas[k].f || ""));
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
    String(v(cambia(h0, "suelo", "S4"), "Sf")), "#N/A");
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
    [["datos", true], ["geometria", true], ["cargas", true], ["analisis", true], ["diseno", true], ["cimentacion", false],
      ["metrado", false]]);
  comp("todo texto lleva formato de texto: «1.4-3» no se vuelve una fecha al escribirse",
    Object.keys(h0.celdas).filter((k) => typeof h0.celdas[k].v === "string" && h0.celdas[k].fmt !== "@"), []);
}


/* la categoría de la hoja sale del uso de la edificación (Datos) */
{
  const hA2 = hoja(null, { uso: "industrial", riesgoAdicional: true }, false);
  comp("una nave con riesgo de incendio: la hoja dice el uso, A2, y U = 1,5, sin separarse del motor",
    [hA2.comprobacion.malas, v(hA2, "categoria"), v(hA2, "U")], [[], "A", 1.5]);
  cierto("con el uso escrito en la hoja", Object.keys(hA2.celdas).some((k) => hA2.celdas[k].v === "Nave industrial, fábrica o taller"));
}


/* EL TABLERO · el formato «pizarra»: se lee de arriba abajo, sin nada al costado */
{
  const X = require("../src/excel.js");
  const celdas = Object.keys(h0.celdas).map((k) => X.parte(k));
  const colMax = Math.max.apply(null, celdas.map((p) => p.c));
  comp("todo dentro del tablero B–K: nada corre a la derecha", X.colLetras(colMax) <= "K" && colMax <= 11, true);
  const secciones = Object.keys(h0.celdas).filter((k) => h0.celdas[k].estilo === "seccion")
    .sort((a, b) => X.parte(a).f - X.parte(b).f).map((k) => h0.celdas[k].v.split(".")[0]);
  comp("seis secciones numeradas, en orden: geometría, gravedad, viento, sismo, combinaciones y el anexo de tablas",
    secciones, ["1", "2", "3", "4", "5", "6"]);
  const filaDe = (n) => X.parte(h0.nombres[n].split(":")[0]).f;
  cierto("las tablas de la norma van al final, en el anexo, debajo de las combinaciones",
    filaDe("tZ_k") > filaDe("V_f") && filaDe("tCob_k") > filaDe("Lr"));
  /* las combinadas no se pisan */
  const ocupa = {};
  let pisa = [];
  for (const r of h0.combinar) {
    const [a, b] = r.split(":"), p = X.parte(a), q = X.parte(b);
    for (let f = p.f; f <= q.f; f++) for (let c = p.c; c <= q.c; c++) {
      const k = X.celda(c, f);
      if (ocupa[k]) pisa.push(r + " pisa " + ocupa[k]);
      ocupa[k] = r;
    }
  }
  comp("ninguna celda combinada pisa a otra", pisa, []);
  comp("ninguna celda escrita queda tapada dentro de una combinada (solo la de arriba a la izquierda)",
    Object.keys(h0.celdas).filter((k) => ocupa[k] && ocupa[k].split(":")[0] !== k), []);
  comp("ninguna fórmula en una celda de texto", Object.keys(h0.celdas).filter((k) => h0.celdas[k].f !== undefined &&
    h0.celdas[k].fmt === "@"), []);
  const rota = JSON.parse(JSON.stringify(h0));
  rota.celdas[rota.nombres.casoTecho].fmt = "@";
  cierto("y si la hubiera, la guarda la atrapa (fue el error del inciso de la Tabla 4)",
    !X.comprueba(rota).ok && /formato @/.test(X.comprueba(rota).malas[0].sale));
  lanza("y el armador no la deja escribir", () => { const a = H.armador("X"); a.pon("E9", { f: "=1", fmt: "@" }); },
    ["celda de texto"]);
  cierto("con marco y última fila", h0.marco === "B2:K" + h0.ultima && h0.ultima > 150);
  cierto("las tablas con rejilla, entre C y J", h0.bordes.length > 20 && h0.bordes.every((r) => /^C\d+:J\d+$/.test(r)));
  cierto("los textos largos piden fila más alta", Object.keys(h0.alturas).some((f) => h0.alturas[f] >= 32));
}


/* ================================================================
   DATOS y GEOMETRÍA · el usuario: «no he visto hojas de cálculo de
   por qué hay esta altura, esta separación… deberían ir también»
   ================================================================ */
{
  const EJ = require("../src/ejemplo.js");
  const em = EJ.modelo(), e3 = MON.monta(em.parametros);
  const eai = R.analisis(e3, em, P, "interior"), eaf = R.analisis(e3, em, P, "fachada");
  const ecr = R.correas(e3, em, P, eai, eaf), elo = R.longitudinal(e3, em, P, eai, eaf);
  const hd = H.hojaDatos({ modelo: em, version: "v", fecha: "2026-10-02" });
  const hg = H.hojaGeometria({ modelo: em, m3: e3, forma: R.forma(e3), interior: eai.r, fachada: eaf.r,
    correas: ecr, largo: elo, version: "v", fecha: "2026-10-02" });

  comp("DATOS: sus fórmulas dan el número del motor", [hd.nombre, hd.comprobacion.ok, hd.comprobacion.comprobadas], ["DATOS", true, 2]);
  cerca("Ec = 15000·√f'c (E.060 19.2.2), de la hoja", v(hd, "Ec"), 15000 * Math.sqrt(210), 1e-9);
  cierto("y es viva: f'c = 280 en la hoja da su Ec", Math.abs(v(cambia(hd, "fpc", 280), "Ec") - 15000 * Math.sqrt(280)) < 1e-9);
  cierto("la presión neta mínima, de la admisible, el relleno y la sobrecarga",
    Math.abs(v(hd, "snMin") - (1.5 - 1800 / 1e6 * 150 - 500 / 1e4)) < 1e-12);
  cierto("lleva los doce perfiles del ejemplo", Object.keys(EJ.PERFILES).every((k) =>
    Object.keys(hd.celdas).some((c) => hd.celdas[c].v === EJ.PERFILES[k])));
  const hd0 = H.hojaDatos({ modelo: L.nuevo({}), version: "v", fecha: "x" });
  cierto("sin datos, DATOS igual se arma: lo que falta dice «—», y no inventa un f'c",
    hd0.comprobacion.ok && hd0.nombres.Ec === undefined && Object.keys(hd0.celdas).some((c) => hd0.celdas[c].v === "—"));

  comp("GEOMETRIA: sus fórmulas dan el número del motor", [hg.nombre, hg.comprobacion.ok, hg.comprobacion.malas], ["GEOMETRIA", true, []]);
  cierto("con fórmulas para cada medida (al menos 25)", hg.comprobacion.comprobadas >= 25);
  comp("solo con funciones que excel.js sabe evaluar", X.funciones(hg).filter((f) => !X.FUNCIONES[f]), []);
  comp("la separación: paños = REDONDEAR(largo/sep pedida), separación real = largo/paños",
    [v(hg, "nPan"), v(hg, "sep"), v(hg, "nPort")], [e3.ejes.panos, e3.ejes.sepPorticos_m, e3.ejes.porticos]);
  cerca("la altura a la cumbre: columna + peralte + pendiente × media luz", v(hg, "hc"), 6 + 1.2 + 0.20 * 10, 1e-12);
  cerca("el ángulo del techo, atan(pendiente)", v(hg, "theta"), Math.atan(0.2) * 180 / Math.PI, 1e-9);
  cerca("la separación de correas sobre la pendiente", v(hg, "pasoI"), e3.tijeral.paso_m * Math.sqrt(1 + 0.04), 1e-12);
  const hg30 = cambia(hg, "pendPct", 30);
  cierto("es viva: 30 % en la hoja cambia el ángulo y la separación de correas",
    Math.abs(v(hg30, "theta") - Math.atan(0.3) * 180 / Math.PI) < 1e-9 &&
    Math.abs(v(hg30, "pasoI") - e3.tijeral.paso_m * Math.sqrt(1.09)) < 1e-12);
  cerca("la deriva por viento del pórtico interior, del análisis", v(hg, "rW_i"), v(hg, "dW_i") / 100 / v(hg, "hAl_i"), 1e-12);
  comp("las verificaciones de la deriva, contra H/100 y la Tabla N° 14", [v(hg, "rW_i") <= 0.01, v(hg, "rE_i") <= 0.01], [true, true]);
  cierto("la esbeltez de la correa contra 70 450/Fy", Math.abs(v(hg, "LdMax") - 70450 / 2530) < 1e-9);
  cierto("las tablas con rejilla y el marco", hg.bordes.length > 5 && hg.marco === "B2:K" + hg.ultima);
  comp("GEOMETRIA sin análisis igual se arma, sin lo que sale de él",
    (() => { const x = H.hojaGeometria({ modelo: em, m3: e3, forma: R.forma(e3), version: "v", fecha: "x" });
      return [x.comprobacion.ok, x.nombres.rW_i, x.nombres.LdCor]; })(), [true, undefined, undefined]);
  lanza("sin el galpón montado, no", () => H.hojaGeometria({ modelo: em }), ["necesita el galpón montado"]);
  comp("y ningún nombre de las dos hojas se confunde con una celda, en ningún idioma",
    Object.keys(hd.nombres).concat(Object.keys(hg.nombres)).filter((n) => !H.nombreValido(n)), []);

  /* ================================================================
     ANALISIS · el pórtico resuelto: lo que sale de la matriz en verde,
     y con fórmulas lo que la norma hace con ello (Apéndice 8)
     ================================================================ */
  const ha = H.hojaAnalisis({ modelo: em, interior: eai.r, fachada: eaf.r, version: "v", fecha: "2026-10-02" });
  comp("ANALISIS: sus fórmulas dan el número del motor", [ha.nombre, ha.comprobacion.ok, ha.comprobacion.malas], ["ANALISIS", true, []]);
  cierto("cientos de fórmulas: el equilibrio, B2 por combinación y las columnas", ha.comprobacion.comprobadas > 300);
  comp("solo con funciones que excel.js sabe evaluar", X.funciones(ha).filter((f) => !X.FUNCIONES[f]), []);
  comp("ningún nombre se confunde con una celda, en ningún idioma", Object.keys(ha.nombres).filter((n) => !H.nombreValido(n)), []);
  cerca("RM = 1 − 0,15·Pmf/Pstory = 0,85 en un pórtico a momento (A-8-8)", v(ha, "RM"), 0.85, 1e-12);
  /* el equilibrio: cada residuo, de la hoja, es cero */
  const residuos = Object.keys(ha.celdas).filter((k) => /residuo/.test(ha.celdas[k].que || "")).map((k) => Math.abs(X.valor(ha, k)));
  cierto("el equilibrio de cada caso, en los dos pórticos: ΣF + ΣR = 0 (" + residuos.length + " residuos)",
    residuos.length === 4 * eai.r.casos.length && residuos.every((x) => x < 1e-6));
  /* B2, de la hoja, es el del motor, y es vivo */
  const filaB2 = Object.keys(ha.celdas).filter((k) => /^I\d+$/.test(k) && / B2$/.test(ha.celdas[k].que || ""));
  comp("un B2 por combinación y pórtico", filaB2.length, eai.r.combinaciones.filter((c) => c.PeStory_kgf !== null).length +
    eaf.r.combinaciones.filter((c) => c.PeStory_kgf !== null).length);
  const b2max = Math.max(...filaB2.map((k) => X.valor(ha, k)));
  cerca("el mayor, el del motor", b2max, Math.max(eai.r.segundoOrden.maxB2, eaf.r.segundoOrden.maxB2), 1e-12);
  /* las columnas: Pe1, B1 y Mr */
  const tr = eai.r.barras.C0, cbm = eai.r.corridas.filter((x) => x.id === tr.momento.combo)[0], fz = cbm.fuerzas[tr.barra];
  cerca("Pe1 = π²·0,80·E·I/Lc1² (A-8-5, con la rigidez reducida)", v(ha, "Pe1_i1"),
    Math.PI * Math.PI * 0.8 * INV.num("MAT.E") * fz.det.Ix_cm4 / (fz.L_cm * fz.L_cm), 1e-9);
  cerca("Pr = Pnt + B2·Plt (A-8-2)", v(ha, "Pr_i1"), fz.det.Pnt_kgf + cbm.B2 * fz.det.Plt_kgf, 1e-9);
  cerca("B1 de la hoja, el del motor", v(ha, "B1_i1"), fz.B1, 1e-12);
  cerca("y Mr, el máximo de la parábola, el del motor (y el de la envolvente)", v(ha, "Mr_i1"), tr.momento.Mr_kgfcm, 1e-9);
  /* VIVA: si la columna fuera más rígida, Pe1 sube y B1 baja */
  const ha2 = cambia(ha, "Ix_i1", 2 * fz.det.Ix_cm4);
  cierto("es viva: con el doble de inercia, Pe1 se duplica y B1 baja (o se queda en 1)",
    Math.abs(v(ha2, "Pe1_i1") - 2 * v(ha, "Pe1_i1")) < 1e-6 && v(ha2, "B1_i1") <= v(ha, "B1_i1"));
  const ha3 = cambia(ha, "rPmf", 0);
  cierto("y en un sistema arriostrado (Pmf = 0) RM = 1 y Pe,story sube: B2 baja en todas",
    v(ha3, "RM") === 1 && filaB2.every((k) => X.valor(ha3, k) <= X.valor(ha, k) + 1e-15));
  comp("la envolvente: una fila por barra del pórtico, en los dos",
    Object.keys(ha.celdas).filter((k) => /^C\d+$/.test(k) && /^[A-Z]+\d+s? · (columna|brida superior|brida inferior|montante|diagonal)$/.test(ha.celdas[k].v)).length,
    Object.keys(eai.r.barras).length + Object.keys(eaf.r.barras).length);
  /* ================================================================
     DISENO · cada barra por su capítulo: la que manda de cada clase,
     calculada en la hoja, y su ratio igual al del motor
     ================================================================ */
  const R2 = require("../src/resultados.js");
  const ddi = R2.diseno(e3, em, P, eai), ddf = R2.diseno(e3, em, P, eaf);
  const hds = H.hojaDiseno({ modelo: em, interior: { an: eai.r, di: ddi.v }, fachada: { an: eaf.r, di: ddf.v },
    version: "v", fecha: "2026-10-02" });
  comp("DISENO: sus fórmulas dan el número del motor", [hds.nombre, hds.comprobacion.ok, hds.comprobacion.malas], ["DISENO", true, []]);
  cierto("cientos de fórmulas", hds.comprobacion.comprobadas > 250);
  comp("solo con funciones que excel.js sabe evaluar", X.funciones(hds).filter((f) => !X.FUNCIONES[f]), []);
  comp("ningún nombre se confunde con una celda, en ningún idioma (f34 era la celda F34)",
    Object.keys(hds.nombres).filter((n) => !H.nombreValido(n)), []);
  const ORDEN = ["columna", "brida superior", "brida inferior", "diagonal", "montante"];
  const clases = ORDEN.filter((c) => ddi.v.porClase[c]);
  comp("un ratio calculado por cada clase de barra y pórtico, igual al del motor",
    clases.map((c, i) => +X.valor(hds, "ratio_i" + (i + 1)).toFixed(12)), clases.map((c) => +ddi.v.porClase[c].ratio.toFixed(12)));
  const clasesF = ORDEN.filter((c) => ddf.v.porClase[c]);
  comp("y en el de fachada", clasesF.map((c, i) => +X.valor(hds, "ratio_f" + (i + 1)).toFixed(12)),
    clasesF.map((c) => +ddf.v.porClase[c].ratio.toFixed(12)));
  const filasRes = Object.keys(hds.celdas).filter((k) => /^[A-Z]+\d+s? veredicto$/.test(hds.celdas[k].que || ""));
  comp("el resumen: una fila con veredicto por barra, en los dos pórticos", filasRes.length,
    Object.keys(ddi.v.barras).length + Object.keys(ddf.v.barras).length);
  /* la columna, VIVA: con Lb = 6 m entra en otra zona de F2 y el ratio sube */
  cierto("la columna por H1: es viva — con el doble de Mr el ratio sube",
    X.valor(cambia(hds, "Mr_i1", 2 * v(hds, "Mr_i1")), "ratio_i1") > v(hds, "ratio_i1"));
  const hdLb = cambia(hds, "LbCol", 6);
  cierto("y con Lb = 6 m el Mn baja (pandeo lateral-torsional)", X.valor(hdLb, "Mn_i1") < v(hds, "Mn_i1"));
  /* la brida 2L, VIVA: separadores a 100 cm → a/ri > 40, la esbeltez se modifica con Ki = 0,50 */
  const hdSep = cambia(hds, "aSep", 100);
  const lr0 = v(hds, "lr0_i2"), ari100 = 100 / v(hds, "rz_i2");
  cerca("separadores a 100 cm: (Lc/r)m = √[(Lc/r)o² + (0,50·a/ri)²] (E6-2)", X.valor(hdSep, "lrm_i2"),
    Math.sqrt(lr0 * lr0 + Math.pow(0.5 * ari100, 2)), 1e-9);
  cierto("con pernos apretados, E6-1: el término entra entero", X.valor(cambia(hds, "conSep", "apretado"), "lrm_i2") >
    X.valor(hds, "lrm_i2"));
  comp("y si los separadores quedan muy lejos, la hoja lo dice", X.valor(cambia(hds, "aSep", 400), "topeA_i2") <
    400 / v(hds, "rz_i2"), true);
  const hdsSin = H.hojaDiseno({ modelo: em, interior: { an: eai.r, di: ddi.v }, fachada: null, version: "v", fecha: "x" });
  cierto("sin el de fachada, DISENO lo dice y sigue", hdsSin.comprobacion.ok &&
    Object.keys(hdsSin.celdas).some((k) => /todavía no corre/.test(hdsSin.celdas[k].v || "")));
  lanza("sin acero no hay diseño", () => H.hojaDiseno({ modelo: L.nuevo({}), interior: null, fachada: null }), ["acero"]);

  const haSin = H.hojaAnalisis({ modelo: em, interior: eai.r, fachada: null, version: "v", fecha: "x" });
  cierto("sin el de fachada, la hoja lo dice y sigue con el interior", haSin.comprobacion.ok &&
    Object.keys(haSin.celdas).some((k) => /todavía no corre/.test(haSin.celdas[k].v || "")));
}

fin();
