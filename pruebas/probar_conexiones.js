/* =====================================================================
   probar_conexiones.js — Capítulo J

   SE REPRODUCEN NUEVE EJEMPLOS RESUELTOS, de dos libros:
     McCormac 5.ª ed. (AISC 360-10): 12-1, 12-2, 14-1, 14-2, 14-4, 14-5
     Zapata (LRFD de su época):      4.4, 5.1, 5.3

   Los dos libros redondean y usan constantes un poco distintas de las del
   proyecto.  Donde hay diferencia, la tolerancia se dice con su CAUSA al
   lado; no se abre la tolerancia para que pase.  Las causas son cuatro:
     · McCormac redondea la garganta a 0,177 plg (es 0,17678)
     · McCormac usa Ab = 0,60 y 0,44 plg² (exactos: 0,6013 y 0,4418)
     · el AISC da 470 MPa donde McCormac usa 68 ksi (= 468,8 MPa)
     · el proyecto descuenta el agujero +2 mm (T.An.agujero), McCormac
       +1/16 plg (1,59 mm)

   Y SALEN TRES COSAS QUE NO SE BUSCABAN, y quedan escritas abajo:
     · el caso 4 de la Tabla D3.1 estaba mal en la fila y en acero.js
     · con la E.090 en la columna de corte, McCormac 12-2 pide 9 pernos
     · con la E.090, en un ángulo de 6 mm soldado a una cartela de 16 mm
       NO CABE ningún filete
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const C = require("../src/conexiones.js");
const AC = require("../src/acero.js");
const UN = require("../src/unidades.js");
const INV = require("../src/inventario.js");

const K = UN.KIP_KGF, P = UN.PULGADA_CM, KSI = UN.KSI_KGCM2;
const kip = (kgf) => kgf / K;
const A36 = { Fy_kgcm2: 36 * KSI, Fu_kgcm2: 58 * KSI };       /* como McCormac */
const GR50 = { Fy_kgcm2: 50 * KSI, Fu_kgcm2: 65 * KSI };

/* ================================================================
   0 · LAS FILAS
   ================================================================ */
comp("todas las filas que cita el módulo existen",
  Object.keys(C.ART).filter((id) => !INV.existe(id)), []);
cierto("y son más de treinta", Object.keys(C.ART).length >= 35);

/* ================================================================
   1 · SOLDADURAS
   ================================================================ */

/* ---- el electrodo: el número está en el nombre ---- */
cerca("E70 = 70 ksi", C.fexx("E70").FEXX_kgcm2, 70 * KSI, 1e-9);
cerca("E60XX se lee igual que E60", C.fexx("E60XX").FEXX_kgcm2, 60 * KSI, 1e-9);
lanza("un electrodo sin fila se niega", () => C.fexx("E80"), "E60 ó E70");

/* ---- Zapata 5.1 · 1/4 plg con E60XX: 4,77 klb/plg ---- */
const z51 = C.filete({ w_mm: 25.4 / 4, L_cm: 30 * P, electrodo: "E60" });
cerca("ZAPATA 5.1 · 4,77 klb/plg con E60XX", kip(z51.phiRnPorCm_kgf * P), 4.77, 0.003);

/* ---- McCormac 14-1 · 1/4 plg, E70 ---- */
const m141 = (Lplg) => C.filete({ w_mm: 25.4 / 4, L_cm: Lplg * P, electrodo: "E70" });
/* McCormac: 0,60·70·(1/4·0,707) = 7,4235 → φ = 5,5676, y escribe 5,56:
   TRUNCA en vez de redondear. Con 0,7071 exacto sale 5,5685. */
cerca("McCORMAC 14-1a · φRn = 5,56 klb/plg (el libro trunca 5,568)",
  kip(m141(10).phiRnPorCm_kgf * P), 5.56, 0.0016);
cerca("y con la garganta exacta, 0,75·0,60·70·0,7071/4", kip(m141(10).phiRnPorCm_kgf * P),
  0.75 * 0.60 * 70 * Math.SQRT1_2 / 4, 1e-9);
cerca("McCORMAC 14-1b · 20 plg, L/w = 80 < 100: entera, 111,2 klb (= 5,56 × 20, la misma truncadura)",
  kip(m141(20).phiRn_kgf), 111.2, 0.0016);
comp("sin reducción", m141(20).beta, 1);
cerca("McCORMAC 14-1c · 30 plg, L/w = 120: β = 0,96", m141(30).beta, 0.96, 1e-12);
cerca("y φRn = 160,1 klb", kip(m141(30).phiRn_kgf), 160.1, 0.002);
/* LA E.090 · 70·w = 17,5 plg de longitud efectiva */
cerca("la E.090 toparía en 70·w y daría 97,4 klb, un 39 % menos",
  kip(m141(30).phiRnE090_kgf), 5.568 * 17.5, 0.001);
cierto("y el módulo lo avisa", m141(30).avisos.some((a) => /70/.test(a.que)));
cierto("con 20 plg (L/w = 80) también", m141(20).avisos.some((a) => /70/.test(a.que)));
cierto("con 10 plg (L/w = 40) no", !m141(10).avisos.length);
/* los tramos de J2-1 */
cerca("L > 300w → longitud efectiva 180w",
  C.filete({ w_mm: 5, L_cm: 0.5 * 400 }).Lef_cm, 180 * 0.5, 1e-9);

/* ---- McCormac 14-4 · la dirección de la carga ---- */
const m144a = C.filete({ w_mm: 25.4 / 4, L_cm: 24 * P });
const m144b = C.filete({ w_mm: 25.4 / 4, L_cm: 24 * P, theta_grados: 45 });
cerca("McCORMAC 14-4a · 133,8 klb (garganta redondeada en el libro)", kip(m144a.phiRn_kgf), 133.8, 0.002);
cerca("McCORMAC 14-4b · a 45°, 173,6 klb", kip(m144b.phiRn_kgf), 173.6, 0.002);
cerca("kds = 1 + 0,5·sen^1,5(45°)", m144b.kds, 1 + 0.5 * Math.pow(Math.SQRT1_2, 1.5), 1e-12);
cerca("transversal: kds = 1,5", C.filete({ w_mm: 6, L_cm: 10, theta_grados: 90 }).kds, 1.5, 1e-12);
cierto("un filete transversal no está cargado en el extremo: sin β",
  !C.filete({ w_mm: 5, L_cm: 300, theta_grados: 90 }).extremo);

/* ---- McCormac 14-5 · longitudinal + transversal ---- */
const m145 = C.grupoFiletes({ w_mm: 25.4 * 5 / 16, Llong_cm: 16 * P, Ltrans_cm: 10 * P });
cerca("McCORMAC 14-5 · Rnwl = 148,5 klb", kip(m145.Rnwl_kgf), 148.5, 0.002);
cerca("Rnwt = 92,8 klb (SIN kds: J2-6 lo define así)", kip(m145.Rnwt_kgf), 92.8, 0.002);
cerca("suma = 241,3", kip(m145.suma_kgf), 241.3, 0.002);
cerca("J2-6 = 265,4", kip(m145.J26_kgf), 265.4, 0.002);
comp("gobierna J2-6, el mayor de los dos permitidos", m145.gobierna, "J2-6");
cerca("φRn = 199 klb", kip(m145.phiRn_kgf), 199, 0.002);
lanza("sin transversal no es un grupo: va por filete()",
  () => C.grupoFiletes({ w_mm: 5, Llong_cm: 10 }), "filete()");

/* ---- longitud mínima: 4·w o se castiga ---- */
const corto = C.filete({ w_mm: 8, L_cm: 2 });
cerca("un cordón de 2 cm con filete de 8 mm se calcula con 5 mm (L/4)", corto.wCalc_mm, 5, 1e-9);
cierto("y avisa", corto.avisos.some((a) => /4 veces/.test(a.que)));

/* ---- Zapata 5.3 · junta traslapada, E60XX, plancha de 1/2 plg ---- */
const z53 = C.filete({ w_mm: 8, L_cm: 50, electrodo: "E60" });
/* Zapata redondea E60 a 4,2 t/cm² y su tabla da 1,068 t/cm; con 60 ksi
   exacto (4218 kgf/cm²) sale 1,074 */
cerca("ZAPATA 5.3 · φRnw = 1,068 t/cm (Zapata redondea FEXX a 4,2)",
  z53.phiRnPorCm_kgf / 1000, 1.068, 0.006);
const Pu53 = 1.2 * 8000 + 1.6 * 25000;
comp("Pu = 1,2·8 + 1,6·25 = 49,6 t", Pu53, 49600);
cerca("longitud de cordón = 46 cm", Pu53 / z53.phiRnPorCm_kgf, 46, 0.01);
const t53 = C.tamanosFilete({ t1_mm: 12.7, t2_mm: 12.7 });
comp("tamaño mínimo: 5 mm para la plancha de 1/2 plg", t53.wMin_mm, 5);
/* Zapata escribe 12 − 1,6 ≈ 10: usa 1/16 plg; el AISC métrico dice 2 mm */
cerca("tamaño máximo: 12,7 − 2 mm (Zapata pone 1,6 mm, de la versión en pulgadas)",
  t53.wMax_mm, 10.7, 1e-9);

/* ---- TAMAÑOS · la divergencia de la tabla J2.4 ---- */
const ang = C.tamanosFilete({ t1_mm: 6, t2_mm: 16 });
comp("ángulo de 6 a cartela de 16 · AISC, la delgada: 3 mm", ang.wMin_mm, 3);
comp("E.090, la gruesa: 6 mm", ang.wMinE090_mm, 6);
comp("máximo en el borde del ángulo: 6 − 2 = 4 mm", ang.wMax_mm, 4);
comp("CON EL AISC CABE", ang.cabe, true);
comp("CON LA E.090 NO CABRÍA NINGÚN FILETE", ang.cabeE090, false);
cierto("y el módulo lo dice con esas palabras", /NO CABRÍA NINGÚN FILETE/.test(ang.avisoE090));
comp("en el borde de un material de menos de 6 mm, el máximo es su espesor",
  C.tamanosFilete({ t1_mm: 5, t2_mm: 10 }).wMax_mm, 5);
comp("los escalones de la tabla", [6, 6.1, 13, 13.1, 19, 19.1].map(C.minimoTabla), [3, 5, 5, 6, 6, 8]);

/* ================================================================
   2 · PERNOS
   ================================================================ */

/* ---- diámetros y agujeros ---- */
cerca("M20 · agujero 22 mm", C.diametro("M20").agujero_cm, 2.2, 1e-12);
cerca("3/4\" · agujero 13/16\"", C.diametro('3/4"').agujero_cm, 13 / 16 * P, 1e-12);
cerca("1\" · agujero 1⅛\", NO 1 1/16", C.diametro('1"').agujero_cm, 18 / 16 * P, 1e-12);
cerca("M42 · agujero d + 3 y borde 1,25·d", C.diametro("M42").borde_cm, 1.25 * 4.2, 1e-12);
cerca("5/8\" · borde 7/8\"", C.diametro("5/8").borde_cm, 14 / 16 * P, 1e-12);
lanza("un diámetro que no está se niega con la lista", () => C.diametro("M18"), "M12");

/* ---- Zapata 4.4 · seis pernos A325 de 3/4 a tracción ---- */
const z44 = C.perno({ grado: "A325", diametro: '3/4"' });
/* Zapata: 0,75·(0,75·120)·0,44 = 29,7 klb; el área exacta es 0,4418 */
cerca("ZAPATA 4.4 · φRnt = 29,7 klb (Zapata usa Ab = 0,44)", kip(z44.phiRnt_kgf), 29.7, 0.005);
comp("y salen 6 pernos para Pu = 152 klb", Math.ceil(152 * K / z44.phiRnt_kgf), 6);
cerca("Fnt = 620 MPa en las dos normas", z44.Fnt_kgcm2, 620 * UN.MPA_KGCM2, 1e-9);

/* ---- LA DIVERGENCIA DEL CORTE · fila J.pernos.Fnv.divergencia ---- */
comp("por omisión manda la E.090 en el corte", z44.norma, "E090");
cerca("A325-N · E.090 330 MPa", z44.conLasDos.E090.Fnv_kgcm2, 330 * UN.MPA_KGCM2, 1e-9);
cerca("A325-N · AISC 370 MPa", z44.conLasDos.AISC.Fnv_kgcm2, 370 * UN.MPA_KGCM2, 1e-9);
cerca("la E.090 queda un 10,8 % abajo", z44.diferenciaCorte, 1 - 330 / 370, 1e-12);
const x490 = C.perno({ grado: "A490", diametro: "M20", roscas: "X" });
cerca("A490-X · 520 contra 580", x490.conLasDos.E090.Fnv_kgcm2 / x490.conLasDos.AISC.Fnv_kgcm2,
  520 / 580, 1e-12);
cerca("A307 · 165 contra 190, con o sin roscas",
  C.perno({ grado: "A307", diametro: "M16", roscas: "X" }).conLasDos.E090.Fnv_kgcm2, 165 * UN.MPA_KGCM2, 1e-9);
cerca("doble corte duplica", C.perno({ grado: "A325", diametro: "M20", planos: 2 }).phiRnv_kgf,
  2 * C.perno({ grado: "A325", diametro: "M20" }).phiRnv_kgf, 1e-9);

/* ---- McCormac 12-2 · cuántos pernos A325 de 3/4, roscas excluidas ---- */
const m122 = C.pernosNecesarios({ Pu_kgf: 345 * K, grado: "A325", diametro: '3/4"', roscas: "X",
  planos: 2, le_cm: 2 * P, s_cm: 3 * P, aplastamientoEn: [{ t_cm: 0.75 * P, Fu_kgcm2: 58 * KSI }] });
cerca("McCORMAC 12-2 · aplastamiento por perno 78,3 klb (gobierna sobre el desgarramiento)",
  kip(m122.aplastamientoPorPerno_kgf / 0.75), 78.3, 0.002);
/* McCormac: 2·0,44·68 = 59,8 → φ 44,8 klb; con Ab exacto y 470 MPa, 45,2 */
cerca("corte por perno 44,8 klb (McCormac usa Ab = 0,44 y 68 ksi)",
  kip(m122.conLasDos.AISC.porPerno_kgf), 44.8, 0.01);
comp("gobierna el corte", m122.gobierna, "corte");
comp("CON EL AISC: 8 pernos, como McCormac", m122.conLasDos.AISC.n, 8);
comp("CON LA E.090: 9 PERNOS", m122.conLasDos.E090.n, 9);
comp("la decisión cuesta un perno, y el módulo lo dice", m122.cuestaLaE090, 1);
comp("y por omisión responde con la E.090", m122.n, 9);

/* ---- McCormac 12-1 · la conexión entera ---- */
const m121 = C.extremoEmpernado({
  Pu_kgf: 150 * K, grado: "A325", diametro: '7/8"', roscas: "X", planos: 1, norma: "AISC",
  porLinea: 2, lineas: 2, s_cm: 3 * P, le_cm: 3 * P, g_cm: 6 * P, lt_cm: 3 * P,
  placas: [Object.assign({ nombre: "PL 1/2 × 12", t_cm: P / 2, ancho_cm: 12 * P }, A36)]
});
const est = (re) => m121.estados.filter((e) => re.test(e.estado))[0] || { phiRn_kgf: NaN };
cerca("McCORMAC 12-1a · fluencia de la plancha 194,4 klb", kip(est(/fluencia/).phiRn_kgf), 194.4, 1e-4);
/* McCormac: An = 5,00 plg² con +1/16; el proyecto descuenta +2 mm y le
   salen 4,984: un 0,3 % menos */
cerca("McCORMAC 12-1b · rotura 217,5 klb (el proyecto descuenta 2 mm, el libro 1/16)",
  kip(est(/rotura/).phiRn_kgf), 217.5, 0.004);
cerca("McCORMAC 12-1c · aplastamiento 182,7 klb", kip(m121.grupo.aplastamiento_kgf), 182.7, 0.001);
/* McCormac: 68·0,6·4 = 163,2 → φ 122,4; con Ab exacto 0,6013 y 470 MPa, 123,0 */
cerca("McCORMAC 12-1d · corte de los pernos 122,4 klb (Ab = 0,60 y 68 ksi en el libro)",
  kip(m121.grupo.corte_kgf), 122.4, 0.006);
comp("Y GOBIERNA EL CORTE, como en el libro", m121.gobierna, "pernos: corte");
cerca("con la E.090 en el corte: 108,6 klb, un 11,7 % menos",
  kip(m121.grupo.conLasDos.E090), kip(m121.grupo.corte_kgf) * 415 / 470, 0.001);
cierto("el bloque de cortante también se comprueba, aunque el libro no lo haga",
  m121.estados.some((e) => /bloque/.test(e.estado)));
cerca("ratio con Pu = 150 klb", m121.ratio, 150 * K / m121.phiRn_kgf, 1e-12);
comp("no cumple con 150", m121.cumple, false);

/* ---- aplastamiento contra desgarramiento ---- */
const ap = C.aplastamiento({ d_cm: 2, t_cm: 1, lc_cm: 1, acero: "A36" });
comp("con lc corto gobierna el desgarramiento", ap.gobierna, "desgarramiento");
cerca("1,2·lc·t·Fu", ap.desgarramiento_kgf, 1.2 * 1 * 1 * 4080, 1e-9);
cerca("sin deformación importante: 3,0 y 1,5",
  C.aplastamiento({ d_cm: 2, t_cm: 1, lc_cm: 10, acero: "A36", deformacion: false }).Rn_kgf,
  3.0 * 2 * 1 * 4080, 1e-9);

/* ---- EL PERNO DEL BORDE DESGARRA · un caso donde lc decide ----
   En los ejemplos de los libros gobierna el aplastamiento y lc no pinta
   nada, así que quitarle medio agujero al lc del borde pasaba sin que nada
   fallara: el mutante sobrevivió. Aquí el borde es corto y el perno de la
   fila del borde desgarra antes de aplastar. M20, A325-N, A36 de 10 mm,
   le = 30 mm, s = 80 mm, una línea de dos. */
const gb = C.grupoPernos({ grado: "A325", diametro: "M20", porLinea: 2, lineas: 1,
  le_cm: 3, s_cm: 8, aplastamientoEn: [{ t_cm: 1, acero: "A36" }] });
cerca("lc del borde = le − agujero/2 = 30 − 11 = 19 mm", gb.lcBorde_cm, 1.9, 1e-12);
cerca("lc interior = s − agujero = 80 − 22 = 58 mm", gb.lcInterior_cm, 5.8, 1e-12);
const vM20 = 0.75 * 330 * UN.MPA_KGCM2 * Math.PI * 4 / 4;
const desgB = 0.75 * 1.2 * 1.9 * 1 * 4080;
cierto("el caso elegido SÍ distingue: el borde desgarra antes que el corte", desgB < vM20);
cerca("el grupo: perno del borde por desgarramiento + perno interior por corte",
  gb.phiRn_kgf, desgB + vM20, 1e-9);
comp("y la geometría es legal: 30 mm ≥ 26 de la tabla, 80 ≥ 3·d; desgarrar no es un error de detalle",
  gb.distancias.lista, []);

/* ---- tracción y corte combinados ---- */
const tc = C.traccionCorte({ grado: "A325", diametro: "M20", Tu_kgf: 6000, Vu_kgf: 4000 });
cerca("pendiente = Fnt/(φ·Fnv) = 620/(0,75·330) = 2,505, como dice la fila",
  tc.pendiente, 620 / (0.75 * 330), 1e-12);
cerca("F'nt = 1,3·Fnt − pendiente·frv", tc.Fntp_kgcm2,
  Math.min(620 * UN.MPA_KGCM2, 1.3 * 620 * UN.MPA_KGCM2 - tc.pendiente * tc.frv_kgcm2), 1e-9);
cierto("con poco corte, F'nt se topa en Fnt",
  C.traccionCorte({ grado: "A325", diametro: "M20", Tu_kgf: 1000, Vu_kgf: 100 }).Fntp_kgcm2 ===
  620 * UN.MPA_KGCM2);
cierto("y la exención del 30 % se dice",
  C.traccionCorte({ grado: "A325", diametro: "M20", Tu_kgf: 1000, Vu_kgf: 100 }).exentoPor30);
lanza("si el corte solo ya agota el perno, se niega",
  () => C.traccionCorte({ grado: "A325", diametro: "M16", Tu_kgf: 0, Vu_kgf: 20000 }), "más pernos");

/* ---- separaciones y bordes ---- */
const ds = C.distancias({ diametro: "M20", s_cm: 5, le_cm: 2.2, bordeCizallado: true, t_cm: 0.8 });
comp("s = 5 cm < 2⅔·20 mm: error", ds.lista[0].nivel, "error");
cierto("borde corto pero ≥ d: AVISA, no se niega (nota [a])",
  ds.lista.some((x) => x.nivel === "aviso" && /nota \[a\]/.test(x.que)));
cierto("y avisa de lo que pediría la E.090 en borde cizallado: 34 mm",
  ds.lista.some((x) => /3\.40 cm/.test(x.que)));
cierto("por debajo de d SÍ es error",
  C.distancias({ diametro: "M20", le_cm: 1.9 }).lista.some((x) => x.nivel === "error"));
cierto("borde > 12·t: error",
  C.distancias({ diametro: "M20", le_cm: 10, t_cm: 0.6 }).lista.some((x) => /12·t/.test(x.que)));
comp("3·d sin problemas: nada que decir", C.distancias({ diametro: "M20", s_cm: 6, le_cm: 3 }).lista, []);

/* ---- juntas largas ---- */
const largo = C.perno({ grado: "A325", diametro: "M20", longitudJunta_cm: 100 });
cerca("junta de 100 cm: corte × 0,833", largo.phiRnv_kgf,
  0.833 * C.perno({ grado: "A325", diametro: "M20" }).phiRnv_kgf, 1e-9);
cierto("y se avisa", largo.avisos.length === 1);

/* ---- LO QUE NO ESTÁ, SE NIEGA ---- */
lanza("deslizamiento crítico: se niega con su motivo", () => C.deslizamiento(), "J.deslizamiento");
lanza("y pedido como opción también",
  () => C.perno({ grado: "A325", diametro: "M20", deslizamientoCritico: true }), "DESLIZAMIENTO");
lanza("agujero agrandado en aplastamiento: prohibido",
  () => C.perno({ grado: "A325", diametro: "M20", agujero: "agrandado" }), "prohibidos");
lanza("un grado que no está se niega", () => C.perno({ grado: "A449", diametro: "M20" }), "A307");
lanza("roscas solo N ó X", () => C.perno({ grado: "A325", diametro: "M20", roscas: "S" }), "excluidas");

/* ================================================================
   3 · ELEMENTOS DE CONEXIÓN
   ================================================================ */
const et = C.elementoTraccion({ acero: "A36", Ag_cm2: 20, An_cm2: 19 });
cerca("fluencia 0,90·Fy·Ag", et.fluencia_kgf, 0.9 * 2530 * 20, 1e-9);
cerca("rotura 0,75·Fu·Ae", et.rotura_kgf, 0.75 * 4080 * 19, 1e-9);
comp("An/Ag = 0,95 > 0,85: la E.090 toparía", et.topeE090, true);
cerca("con el tope de la E.090", et.roturaE090_kgf, 0.75 * 4080 * 17, 1e-9);
/* CON A36 EL TOPE NUNCA GOBIERNA: la rotura solo manda si An/Ag < 0,744 y
   el tope solo muerde por encima de 0,85. Con A572 Gr.50 sí: la rotura
   manda hasta An/Ag = 0,923, y entre 0,85 y 0,92 el tope decide. */
comp("con A36 y An/Ag = 0,95 el tope no gobierna: manda la fluencia", et.avisoE090, undefined);
const et572 = C.elementoTraccion({ acero: "A572", Ag_cm2: 20, An_cm2: 18 });
cierto("con A572 y An/Ag = 0,90 el tope SÍ gobernaría, y se avisa", /0,85/.test(et572.avisoE090 || ""));
cerca("y daría la rotura con 0,85·Ag", et572.phiRnE090_kgf, 0.75 * 4570 * 17, 1e-9);
cierto("con An/Ag = 0,80 no hay nada que avisar",
  !C.elementoTraccion({ acero: "A36", Ag_cm2: 20, An_cm2: 16 }).avisoE090);

const ec = C.elementoCorte({ acero: "A36", Agv_cm2: 10, Anv_cm2: 9.5 });
cerca("fluencia en corte, φ = 1,00", ec.fluencia_kgf, 1.0 * 0.6 * 2530 * 10, 1e-9);
cerca("la E.090, φ = 0,90", ec.fluenciaE090_kgf, 0.9 * 0.6 * 2530 * 10, 1e-9);
cerca("rotura, φ = 0,75", ec.rotura_kgf, 0.75 * 0.6 * 4080 * 9.5, 1e-9);

cerca("compresión corta: 0,90·Fy·Ag",
  C.elementoCompresion({ acero: "A36", Ag_cm2: 10, Lc_cm: 20, r_cm: 1 }).phiRn_kgf, 0.9 * 2530 * 10, 1e-9);
lanza("esbelta: se niega y remite al Capítulo E",
  () => C.elementoCompresion({ acero: "A36", Ag_cm2: 10, Lc_cm: 30, r_cm: 1 }), "acero.compresion()");

cierto("el bloque de cortante es el de acero.js, sin copia",
  C.bloqueCortante({ acero: "A36", Agv_cm2: 10, Anv_cm2: 8, Ant_cm2: 3 }).Rd_kgf ===
  AC.bloqueCortante({ acero: "A36", Agv_cm2: 10, Anv_cm2: 8, Ant_cm2: 3 }).Rd_kgf);

/* ================================================================
   4 · McCORMAC 14-2 · plancha soldada, y EL CASO 4 QUE ESTABA MAL
   PL 3/4 × 10 A572 Gr.50, filetes de 7/16 E70 de 10 plg a cada lado.
   ================================================================ */
const m142 = C.extremoSoldado({ Pu_kgf: 150 * K, w_mm: 25.4 * 7 / 16, electrodo: "E70",
  Llado_cm: 10 * P, tOtra_mm: 19.05,
  placa: Object.assign({ t_cm: 0.75 * P, ancho_cm: 10 * P }, GR50) });
const e142 = (re) => m142.estados.filter((e) => re.test(e.estado))[0];
cerca("McCORMAC 14-2 · soldadura 194,9 klb", kip(e142(/soldadura/).phiRn_kgf), 194.9, 0.001);
cerca("fluencia de la plancha 337,5 klb", kip(e142(/fluencia/).phiRn_kgf), 337.5, 1e-4);
/* l = w = 10 plg → U = 0,75 con la fórmula del 360-22 y con los escalones
   del 2010 que usa McCormac: coinciden en este punto */
comp("U = 0,75: l = w", e142(/rotura/).U, 0.75);
cerca("rotura 274,0 klb (McCormac redondea Ae a 5,62)", kip(e142(/rotura/).phiRn_kgf), 274.0, 0.001);
comp("GOBIERNA LA SOLDADURA", m142.gobierna, "soldadura");
/* EL CASO 4 ESTABA MAL: con U = 1,0 la rotura salía un 33 % alta */
cerca("con el U = 1,0 de antes, la rotura habría salido un 33 % alta",
  kip(e142(/rotura/).phiRn_kgf) / 0.75, 0.75 * 65 * 7.5, 0.001);


/* ================================================================
   LA TABLA J2.4 EN PULGADAS · fila J.filete.pulgadas
   En 1/4" = 6,35 mm la columna en milímetros salta de escalón y la
   de pulgadas no: con material en pulgadas se usa la de pulgadas.
   ================================================================ */
{
  const mm = C.tamanosFilete({ t1_mm: 6.35, t2_mm: 9.525, tBorde_mm: 6.35 });
  comp("en mm, un ángulo de 1/4\" a una cartela de 3/8\": mínimo 5 mm", mm.wMin_mm, 5);
  cerca("y máximo 6,35 − 2", mm.wMax_mm, 4.35, 1e-12);
  comp("LEÍDO EN MILÍMETROS NO CABE NINGÚN FILETE", mm.cabe, false);
  const pg = C.tamanosFilete({ t1_mm: 6.35, t2_mm: 9.525, tBorde_mm: 6.35, sistema: "pulgadas" });
  cerca("en pulgadas: hasta 1/4\" inclusive, mínimo 1/8\"", pg.wMin_mm, 25.4 / 8, 1e-12);
  cerca("y máximo 1/4 − 1/16 = 3/16\"", pg.wMax_mm, 25.4 * 3 / 16, 1e-12);
  comp("y cabe", pg.cabe, true);
  cierto("con su fila", /J2\.4/.test(pg.artSistema));
  comp("los escalones en pulgadas, pasados exactos (en 1/32\")",
    [6.35, 6.36, 12.7, 12.71, 19.05, 19.06].map((t) => Math.round(C.minimoTabla(t, "pulgadas") * 32 / 25.4)),
    [4, 6, 6, 8, 8, 10]);
  comp("el borde de menos de 1/4\" admite su espesor",
    C.tamanosFilete({ t1_mm: 6.3, t2_mm: 10, sistema: "pulgadas" }).wMax_mm, 6.3);
  comp("de qué sistema es un perfil: el de su catálogo",
    [C.sistemaDe({ origen: "imperial" }), C.sistemaDe({ origen: "metrico" }), C.sistemaDe(null)], ["pulgadas", "mm", "mm"]);
  lanza("un sistema que no existe", () => C.tamanosFilete({ t1_mm: 6, t2_mm: 6, sistema: "plg" }), ["«pulgadas»"]);
}

/* ================================================================
   LA BARRA DEL TIJERAL A SU CARTELA · fila J.union.angulo
   2L3X3X1/4 A36 a una cartela de 3/8", a mano.
   ================================================================ */
{
  const PF = require("../src/perfiles.js");
  const p = PF.busca("2L3X3X1/4");
  const A36 = AC.material("A36"), tg = 0.9525, t = 0.635, b = 7.62, T30 = Math.tan(Math.PI / 6);
  const base = { perfil: p, acero: "A36", tCartela_cm: tg, Nt_kgf: 10000, Nc_kgf: 5000 };
  const s = C.unionAngulo(Object.assign({ union: "soldadas", Lw_cm: 10, w_mm: 4, electrodo: "E70" }, base));
  const es = (re) => s.estados.filter((e) => re.test(e.estado))[0];
  cerca("SOLDADA · 4 filetes (talón y punta de cada ángulo): 4 · 0,75·0,60·FEXX·0,707·w·L",
    es(/soldadura/).phiRn_kgf, 4 * 0.75 * 0.6 * C.fexx("E70").FEXX_kgcm2 * Math.SQRT1_2 * 0.4 * 10, 1e-9);
  cerca("Whitmore: W = b + 2·L·tan 30°", s.W_cm, b + 2 * 10 * T30, 1e-12);
  cerca("fluencia en Whitmore: 0,9·Fy·W·tg", es(/fluencia en la sección de Whitmore/).phiRn_kgf,
    0.9 * A36.Fy * (b + 20 * T30) * tg, 1e-9);
  cerca("rotura en Whitmore, sin agujeros: 0,75·Fu·W·tg", es(/rotura en la sección de Whitmore/).phiRn_kgf,
    0.75 * A36.Fu * (b + 20 * T30) * tg, 1e-9);
  /* bloque: cortante por los dos filetes, tracción a través del ala */
  const blq = (tt) => 0.75 * (Math.min(0.6 * A36.Fu, 0.6 * A36.Fy) * 2 * 10 * tt + A36.Fu * b * tt);
  cerca("bloque de cortante de la cartela, sin agujeros (fila J.bloque.soldado)", es(/cartela: bloque/).phiRn_kgf, blq(tg), 1e-9);
  cerca("y el de los dos ángulos", es(/ángulo: bloque/).phiRn_kgf, 2 * blq(t), 1e-9);
  comp("gobierna la soldadura", s.gobierna, "soldadura: 4 filetes de 4 mm × 10 cm");
  cerca("con su ratio", s.ratio, 10000 / es(/soldadura/).phiRn_kgf, 1e-12);
  comp("la cartela a compresión se dice, sin bloquear", s.omitidos.map((o) => [o.que, o.esencial]),
    [["la cartela a compresión", false]]);
  comp("y cumple", s.cumple, true);
  /* el mismo ángulo en milímetros: no cabe ningún filete, y entonces no cumple */
  const pm = Object.assign({}, p, { origen: "metrico" });
  const sm = C.unionAngulo(Object.assign({ union: "soldadas", Lw_cm: 10, w_mm: 4, electrodo: "E70" }, base, { perfil: pm }));
  cierto("con el ángulo en mm, el filete de 4 mm queda fuera y es esencial", sm.faltanEsenciales && !sm.cumple &&
    sm.omitidos.some((o) => o.que === "el tamaño del filete" && o.esencial));
  /* un filete de 6 mm en el ángulo de 1/4": pasa el máximo de 3/16" */
  const s6 = C.unionAngulo(Object.assign({ union: "soldadas", Lw_cm: 10, w_mm: 6, electrodo: "E70" }, base));
  cierto("un filete de 6 mm en el borde de 1/4\" supera 3/16\": no cumple", !s6.cumple && s6.faltanEsenciales);
  /* solo compresión: sin Whitmore ni bloque */
  const sc = C.unionAngulo(Object.assign({ union: "soldadas", Lw_cm: 10, w_mm: 4, electrodo: "E70" }, base, { Nt_kgf: 0 }));
  comp("a compresión sola, solo la soldadura", sc.estados.map((e) => e.estado), ["soldadura: 4 filetes de 4 mm × 10 cm"]);

  /* EMPERNADA · 3 pernos A325 de 5/8" en corte doble */
  const e = C.unionAngulo(Object.assign({ union: "empernadas", porLinea: 3, diametro: "5/8", grado: "A325",
    s_cm: 5, le_cm: 3, g_cm: 4.5 }, base, { Nc_kgf: 0 }));
  const ee = (re) => e.estados.filter((x) => re.test(x.estado))[0];
  const gp = C.grupoPernos({ grado: "A325", diametro: "5/8", porLinea: 3, lineas: 1, s_cm: 5, le_cm: 3, lt_cm: b - 4.5,
    planos: 2, aplastamientoEn: [{ t_cm: tg, acero: "A36" }, { t_cm: 2 * t, acero: "A36" }] });
  cerca("los pernos: el grupo en corte doble, con la cartela y los dos ángulos aplastando", ee(/pernos/).phiRn_kgf, gp.phiRn_kgf, 1e-9);
  const h = C.diametro("5/8").agujero_cm;
  cerca("Whitmore con pernos: W = 2·(n − 1)·s·tan 30°", e.W_cm, 2 * 10 * T30, 1e-12);
  cerca("rotura en Whitmore, menos un agujero (+2 mm)", ee(/rotura en la sección de Whitmore/).phiRn_kgf,
    0.75 * A36.Fu * (20 * T30 - (h + 0.2)) * tg, 1e-9);
  const hn = h + 0.2, lv = 3 + 2 * 5;
  const be = 0.75 * (Math.min(0.6 * A36.Fu * (lv - 2.5 * hn) * t, 0.6 * A36.Fy * lv * t) + A36.Fu * (b - 4.5 - hn / 2) * t);
  cerca("bloque del ángulo: lv = le + 2s, medio agujero en la tracción", ee(/ángulo: bloque/).phiRn_kgf, 2 * be, 1e-9);
  comp("cumple", e.cumple, true);
  const ec = C.unionAngulo(Object.assign({ union: "empernadas", porLinea: 3, diametro: "5/8", grado: "A325",
    s_cm: 5, le_cm: 1, g_cm: 4.5 }, base));
  cierto("con el borde de 1 cm, las distancias no cumplen y es esencial", !ec.cumple &&
    ec.omitidos.some((o) => o.que === "las distancias de los pernos" && o.esencial));

  lanza("una W no es ángulo", () => C.unionAngulo(Object.assign({}, base, { perfil: PF.busca("W8X10"), union: "soldadas" })),
    ["ángulo"]);
  lanza("sin fuerza", () => C.unionAngulo(Object.assign({}, base, { Nt_kgf: 0, Nc_kgf: 0, union: "soldadas" })), ["fuerza"]);
  lanza("ni soldada ni empernada", () => C.unionAngulo(Object.assign({}, base, { union: "remachada" })), ["soldadas"]);
  lanza("empernada sin gramil", () => C.unionAngulo(Object.assign({}, base, { union: "empernadas", porLinea: 2,
    diametro: "5/8", grado: "A325", s_cm: 5, le_cm: 3 })), ["gramil"]);
}

fin();
