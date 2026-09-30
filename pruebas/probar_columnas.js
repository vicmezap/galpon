/* =====================================================================
   probar_columnas.js — la columna del pórtico y la hastial

   LO QUE MÁS VALE DE ESTE ARCHIVO ES UNA MEDICIÓN que cambia una decisión
   de detalle. La misma columna, la misma carga:

       por H1.1 (interacción única)   ratio 1,010  → NO cumple
       por H1.3 (separando planos)    ratio 0,702  → cumple, un 30,5 % menos

   Y la condición que bloquea H1.3 en un galpón NO es la de Mry/Mcy, que es
   la que uno mira: es Lcz ≤ Lcy. El larguero sujeta lateralmente pero no
   impide el GIRO de la sección, así que Lcz se queda en la altura entera.
   Para usar H1.3 hay que diseñar la conexión del larguero para que tuerza
   también, no solo para que empuje. Es un detalle con un 30 % de capacidad
   detrás.

   Y la otra cosa que distingue a esta pieza: SUS TRES LONGITUDES EFECTIVAS
   SON DISTINTAS. Con largueros cada 1,5 m y 7 m de altura, Lcx/Lcy = 4,67.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const CO = require("../src/columnas.js");
const P = require("../src/perfiles.js");
const A = require("../src/acero.js");

const Fy = 2530;
const W = P.busca("W12X65");
const HO = W.d_cm - W.tf_cm;
const RT = A.rts({ Iy_cm4: W.Iy_cm4, Cw_cm6: W.Cw_cm6, Sx_cm3: W.Sx_cm3 }).rts_cm;

function geoF2(Lb_cm) {
  return {
    Lp_cm: A.Lp({ ry_cm: W.ry_cm, Fy_kgcm2: Fy }).Lp_cm,
    Lr_cm: A.Lr({ rts_cm: RT, Fy_kgcm2: Fy, J_cm4: W.J_cm4, c: 1,
      Sx_cm3: W.Sx_cm3, ho_cm: HO }).Lr_cm,
    rts_cm: RT, J_cm4: W.J_cm4, c: 1, ho_cm: HO
  };
}

/* ---------- LAS TRES LONGITUDES SON DISTINTAS ----------------------- */
const L = CO.longitudes({ altura_m: 7, separacionLargueros_m: 1.5 });
comp("en el plano, la altura entera", L.Lcx_cm, 700);
comp("fuera del plano, la separación de largueros", L.Lcy_cm, 150);
/* LA TORSIÓN SE TOMA CON LA ALTURA ENTERA salvo que se declare arriostrada:
   el larguero sujeta lateralmente, pero impedir el GIRO pide algo más. */
comp("la torsión, la altura entera por omisión", L.Lcz_cm, 700);
cierto("y se dice por qué", /GIRO/.test(L.nota));
comp("declarándola arriostrada, baja a la del larguero",
  CO.longitudes({ altura_m: 7, separacionLargueros_m: 1.5, torsionArriostrada: true }).Lcz_cm, 150);
cerca("la razón Lcx/Lcy es 4,67", L.razonLcxLcy, 4.667, 1e-3);
comp("K = 1 en las tres, por Método Directo", L.K, 1);
/* Meterlas todas iguales es tirar media columna o quedarse corto. */
cerca("Lc/r en el plano", 700 / W.rx_cm, 52.2, 0.1);
cerca("y fuera del plano", 150 / W.ry_cm, 19.6, 0.1);
lanza("sin la separación de largueros PARA, y explica el coste",
  () => CO.longitudes({ altura_m: 7 }), "media columna");
lanza("y un larguero más separado que la altura no tiene sentido",
  () => CO.longitudes({ altura_m: 7, separacionLargueros_m: 9 }), "no puede superar");
/* La deuda del Apéndice 6 queda anotada. */
cierto("la deuda del Apéndice 6 del larguero se anota", /Ap.ndice 6/.test(L.deuda));

/* ---------- LA MEDICIÓN QUE CAMBIA UN DETALLE · H1.1 contra H1.3 ---- */
function columna(torsionArriostrada) {
  const lg = CO.longitudes({ altura_m: 7, separacionLargueros_m: 1.5,
    torsionArriostrada: torsionArriostrada });
  const geo = geoF2(lg.Lcy_cm);
  const Pcy = A.compresion({ acero: "A36", Ag_cm2: W.A_cm2, Lc_cm: lg.Lcy_cm,
    r_cm: W.ry_cm, noEsbelta: true }).Pd_kgf;
  const McxCb1 = A.flexionF2(Object.assign({ acero: "A36", Zx_cm3: W.Zx_cm3,
    Sx_cm3: W.Sx_cm3, Lb_cm: lg.Lcy_cm, Cb: 1.0 }, geo)).Md_kgfcm;
  const Mcy = A.flexionF6({ acero: "A36", Zy_cm3: W.Zy_cm3, Sy_cm3: W.Sy_cm3 }).Md_kgfcm;
  return CO.verifica({ id: "COL", perfil: W, acero: "A36", fabricacion: "laminado",
    combinacion: "1,2D + 1,3W", origenFuerzas: "segundo-orden",
    noEsbelta: true, arriostreComprobado: true,
    Pu_kgf: -90000, Mux_kgfcm: 2600000, Vu_kgf: 5000,
    longitudes: lg, geometriaF2: geo, Cb: 1.0,
    H13: { Pcy_kgf: Pcy, McxCb1_kgfcm: McxCb1, Mcy_kgfcm: Mcy, Cb: 1.4,
      laminadoCompactoDobleSimetria: true } });
}
const sinTors = columna(false), conTors = columna(true);
cerca("por H1.1 el ratio es 1,010 y NO cumple", sinTors.ratio, 1.010, 0.005);
cierto("no cumple", sinTors.cumpleResistencia === false);
/* CON EL LARGUERO QUE SOLO EMPUJA, H1.3 NO APLICA. Y la razón no es la que
   uno mira primero: es Lcz ≤ Lcy. */
cierto("sin arriostrar la torsión, H1.3 no se puede usar", sinTors.H13.puede === false);
cierto("y la razón es Lcz ≤ Lcy", /Lcz/.test(sinTors.H13.razones.join(" ")));
comp("una sola razón lo bloquea", sinTors.H13.razones.length, 1);
/* CON LA CONEXIÓN QUE TAMBIÉN IMPIDE EL GIRO, sí aplica. */
cierto("arriostrando la torsión, sí se puede", conTors.H13.puede === true);
cerca("y el ratio baja a 0,702", conTors.H13.ratioH13, 0.702, 0.005);
cerca("un 30,5 % menos", conTors.H13.ahorro, 0.305, 0.01);
cierto("con la misma columna pasando de no cumplir a cumplir",
  sinTors.ratio > 1 && conTors.H13.ratioH13 < 1);
/* Y el H1.1 no cambia: lo que cambia es que se puede usar el otro camino. */
cerca("la interacción única da lo mismo en los dos casos",
  sinTors.ratio, conTors.ratio, 1e-12);
/* LA E.090 NO TIENE H1.3, así que es opción y no defecto. */
cierto("y se recuerda que la E.090 no lo trae", /E\.090/.test(conTors.H13.nota));
cierto("con el comentario de que hay que justificarlo",
  /justificar/.test(conTors.H13.comentario));

/* ---------- la columna como viga-columna ---------------------------- */
cierto("trae los cuatro controles", sinTors.ratios.length === 4);
cierto("y gobierna la interacción", sinTors.capitulo === "H");
cierto("se dice cuál plano gobiera el pandeo",
  /gobierna EN el plano/.test(sinTors.notaLongitudes));
cierto("porque Lc/r en el plano supera al de fuera", sinTors.lrx > sinTors.lry);
/* La guarda del segundo orden vale aquí como en todo el Cap. H. */
lanza("con fuerzas de primer orden PARA",
  () => CO.verifica({ id: "X", perfil: W, acero: "A36", fabricacion: "laminado",
    origenFuerzas: "primer-orden", noEsbelta: true,
    Pu_kgf: -50000, Mux_kgfcm: 1000000, longitudes: L, geometriaF2: geoF2(150) }),
  "PRIMER ORDEN");
lanza("sin las longitudes PARA",
  () => CO.verifica({ id: "X", perfil: W, Pu_kgf: -50000 }), "longitudes()");

/* ---------- el péndulo invertido · fila S.pendulo -------------------- */
/* No lo decide el módulo: detecta la geometría candidata y lo pregunta,
   porque la consecuencia es un factor 1,6 en la fuerza sísmica. */
const pen = CO.esPenduloInvertido({ baseEmpotrada: true, cumbreArticulada: true,
  masaConcentradaArriba: true });
cierto("con las tres señales, es candidato", pen.candidato === true);
comp("y se listan las tres razones", pen.razones.length, 3);
comp("R₀ sería 2,5", pen.R0siLoEs, 2.5);
cierto("y se dice cuánto cuesta equivocarse", /62,5 %/.test(pen.nota));
cierto("pero NO lo decide el módulo", /lo decide el proyectista/.test(pen.nota));
cierto("y deja la pregunta hecha", pen.pregunta !== null);
cierto("con una sola señal no es candidato",
  CO.esPenduloInvertido({ baseEmpotrada: true }).candidato === false);
cierto("y entonces no hay pregunta que hacer",
  CO.esPenduloInvertido({ baseEmpotrada: true }).pregunta === null);

/* ---------- servicio · los tres criterios ADOPTADOS ----------------- */
/* Los tres vienen del AISC Design Guide 3, que el propio J9 recomienda por
   nombre. NO son norma: el LRFD no fija límites de deflexión. */
comp("la deriva es H/100", CO.DERIVA_VIENTO, 100);
const dv = CO.deriva({ altura_cm: 700, desplazamiento_cm: 5 });
comp("con 7 m, el límite es 7 cm", dv.limite_cm, 7);
cierto("5 cm pasa", dv.pasa === true);
cerca("con razón 0,71", dv.razon, 0.714, 1e-3);
cierto("9 cm no pasa", CO.deriva({ altura_cm: 700, desplazamiento_cm: 9 }).pasa === false);
/* AVISO, NO RECHAZO. */
cierto("pero NO es un rechazo", dv.esRechazo === false);
/* Y se declara de dónde viene y por qué queda del lado seguro: el DG3 lo da
   con viento de 10 años y aquí se usa con el de la E.020, de 50. */
cierto("se declara adoptado del DG3", /Design Guide 3/.test(dv.nota));
cierto("y que queda del lado seguro por el período de retorno",
  /10 años/.test(dv.nota) && /50/.test(dv.nota));

comp("el larguero es L/120", CO.DEFLEX_LARGUERO, 120);
const dl = CO.deflexionLarguero({ L_cm: 600, desplazamiento_cm: 4 });
comp("con 6 m, el límite es 5 cm", dl.limite_cm, 5);
cierto("4 cm pasa", dl.pasa === true);
cierto("y tampoco es rechazo", dl.esRechazo === false);

/* ---------- la columna hastial -------------------------------------- */
/* Otra pieza: no lleva la carga del techo del pórtico, lleva VIENTO sobre el
   hastial y trabaja como viga vertical. */
const H = P.busca("W8X31");
const HOH = H.d_cm - H.tf_cm;
const RTH = A.rts({ Iy_cm4: H.Iy_cm4, Cw_cm6: H.Cw_cm6, Sx_cm3: H.Sx_cm3 }).rts_cm;
const geoH = { Lp_cm: A.Lp({ ry_cm: H.ry_cm, Fy_kgcm2: Fy }).Lp_cm,
  Lr_cm: A.Lr({ rts_cm: RTH, Fy_kgcm2: Fy, J_cm4: H.J_cm4, c: 1,
    Sx_cm3: H.Sx_cm3, ho_cm: HOH }).Lr_cm,
  rts_cm: RTH, J_cm4: H.J_cm4, c: 1, ho_cm: HOH };
const ha = CO.columnaHastial({ id: "H-1", perfil: H, acero: "A36",
  fabricacion: "laminado", altura_m: 6, wViento_kgfm: 300,
  separacionLargueros_m: 2, geometriaF2: geoH, Cb: 1.0,
  desplazamiento_cm: 4, combinacion: "1,2D + 1,3W" });
/* Simplemente apoyada entre la base y el tijeral: M = wL²/8. */
cerca("el momento es wL²/8", ha.Mu_kgfcm, (300 / 100) * 600 * 600 / 8, 1e-9);
cerca("y el cortante wL/2", ha.Vu_kgf, (300 / 100) * 600 / 2, 1e-9);
comp("su Lb es la separación de largueros", ha.Lb_cm, 200);
cierto("se verifica por flexión y cortante", ha.ratios.length >= 2);
/* Su criterio de servicio es L/120 · fila SV.hastial.L, que tenía la nota
   «no teníamos criterio para este elemento» hasta que se leyó el DG3. */
comp("el límite de servicio es L/120", ha.servicio.limite_cm, 5);
cierto("4 cm pasa", ha.servicio.pasa === true);
cierto("y no es rechazo", ha.servicio.esRechazo === false);
cierto("y se dice que no lleva la carga del techo del pórtico",
  /NO lleva la carga del techo/.test(ha.nota));
lanza("la hastial sin separación de largueros PARA",
  () => CO.columnaHastial({ perfil: H, altura_m: 6, wViento_kgfm: 300 }),
  "altura entera");
lanza("y sin la carga de viento tampoco",
  () => CO.columnaHastial({ perfil: H, altura_m: 6, separacionLargueros_m: 2 }),
  "wViento_kgfm");

fin();
