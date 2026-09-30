/* =====================================================================
   probar_acero_armados.js — AISC E4, E6 y E7

   Cierra el Capítulo E:
       probar_acero.js              · Cap. D · tracción
       probar_acero_compresion.js   · E3 y E5 · la columna y el ángulo simple
       probar_acero_armados.js      · E4, E6 y E7   ← este

   DOS AUTOVERIFICACIONES QUE NO NECESITAN VALOR TABULADO:

     · La Tabla E7.1 se comprueba a sí misma. c2 no es un dato independiente:
       sale de c1 por la ecuación E7-4. Así que calcularlo y contrastarlo
       contra la columna tabulada dice si la transcripción de c1 es correcta.

     · La E4-3 con H = 1 tiene que degenerar en min(Fey, Fez). H = 1 significa
       centro de corte en el centroide, o sea doble simetría, y entonces la
       torsión y la flexión se desacoplan. Que la fórmula lo cumpla es una
       comprobación del álgebra sin conocer ningún resultado.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const A = require("../src/acero.js");

const Fy = 2530;
const RAIZ_EFY = Math.sqrt(A.E_ACERO / Fy);

/* ---------- el módulo de corte ---------------------------------------- */
comp("G del acero, de la fila MAT.G", A.G_ACERO, 787000);
/* 11 200 ksi son 787 400 kgf/cm²; la fila guarda 787 000 y está en conflicto
   por eso mismo. Aquí solo se comprueba que el módulo usa la fila. */
cierto("y está en el orden de los 11 200 ksi",
  Math.abs(A.G_ACERO / (11200 * 70.307) - 1) < 0.001);

/* ---------- E4 · la exención de flexo-torsión · fila C.E4.aplica ------- */
/* «These provisions also apply to single angles with b/t > 0,71·√(E/Fy),
   where b is the width of the LONGEST leg and t is the thickness.» */
comp("el coeficiente de la exención es 0,71", A.COEF_EXENCION_FTB, 0.71);
cerca("con A36 el límite es b/t = 20,2", 0.71 * RAIZ_EFY, 20.16, 0.01);
cierto("un L de 10 cm y 9,5 mm no exige flexo-torsión",
  A.exigeFTB({ bLargo_cm: 10, t_cm: 0.95, Fy_kgcm2: Fy }).exige === false);
cierto("uno de 10 cm y 4,8 mm sí la exige",
  A.exigeFTB({ bLargo_cm: 10, t_cm: 0.48, Fy_kgcm2: Fy }).exige === true);
/* B ES EL LADO MÁS LARGO, y tomar el corto exime de revisar cuando sí hay que
   revisar: el error va del lado inseguro. La función lo pide por nombre para
   que no se confunda. */
lanza("sin el lado largo PARA, y explica por qué es el largo",
  () => A.exigeFTB({ t_cm: 0.48, Fy_kgcm2: Fy }), "MÁS LARGO");
cierto("el resultado cita las dos filas",
  A.exigeFTB({ bLargo_cm: 10, t_cm: 0.48, Fy_kgcm2: Fy }).artB.indexOf("E4") >= 0);

/* ---------- E4-9 y E4-8 · ro² y H ------------------------------------- */
/* En doble simetría el centro de corte coincide con el centroide: xo = yo = 0
   y H = 1 exactamente. */
const dob = A.roH({ Ix_cm4: 8491, Iy_cm4: 721, Ag_cm2: 49.354 });
comp("con xo = yo = 0, H = 1", dob.H, 1);
cerca("y ro² = (Ix+Iy)/Ag", dob.ro2, (8491 + 721) / 49.354, 1e-12);
/* Con el centro de corte desplazado, H baja de 1. */
const asim = A.roH({ Ix_cm4: 100, Iy_cm4: 100, Ag_cm2: 20, xo_cm: 2, yo_cm: 1 });
cierto("con el centro de corte desplazado, H < 1", asim.H < 1);
cerca("ro² incluye xo² + yo²", asim.ro2, 4 + 1 + 200 / 20, 1e-12);
cerca("y H = 1 − (xo²+yo²)/ro²", asim.H, 1 - 5 / asim.ro2, 1e-12);
lanza("roH() sin las inercias PARA", () => A.roH({ Ag_cm2: 20 }), "Ix_cm4");

/* ---------- E4-2 · doble simetría ------------------------------------- */
const fe2 = A.FeDobleSimetria({ Cw_cm6: 163000, J_cm4: 14.5, Lcz_cm: 400,
  Ix_cm4: 8491, Iy_cm4: 721 });
cerca("Fe = [π²E·Cw/Lcz² + G·J]/(Ix+Iy)",
  fe2.Fe_kgcm2,
  (Math.PI * Math.PI * A.E_ACERO * 163000 / (400 * 400) + A.G_ACERO * 14.5) / (8491 + 721),
  1e-12);
/* Alargar la longitud de torsión baja Fe: el término del alabeo se diluye y
   queda solo el de torsión pura G·J. */
cierto("al alargar Lcz, Fe baja",
  A.FeDobleSimetria({ Cw_cm6: 163000, J_cm4: 14.5, Lcz_cm: 800,
    Ix_cm4: 8491, Iy_cm4: 721 }).Fe_kgcm2 < fe2.Fe_kgcm2);
/* Y con Lcz muy grande tiende al valor de torsión pura. */
cerca("con Lcz enorme tiende a G·J/(Ix+Iy)",
  A.FeDobleSimetria({ Cw_cm6: 163000, J_cm4: 14.5, Lcz_cm: 1e6,
    Ix_cm4: 8491, Iy_cm4: 721 }).Fe_kgcm2,
  A.G_ACERO * 14.5 / (8491 + 721), 1e-6);
lanza("sin Cw PARA", () => A.FeDobleSimetria({ J_cm4: 14.5, Lcz_cm: 400,
  Ix_cm4: 100, Iy_cm4: 100 }), "Cw_cm6");

/* ---------- E4-7 · Fez, y la simplificación de la User Note ----------- */
const r0 = A.roH({ Ix_cm4: 100, Iy_cm4: 30, Ag_cm2: 18, yo_cm: 3 });
const fez = A.Fez({ Cw_cm6: 500, J_cm4: 2.5, Lcz_cm: 250, Ag_cm2: 18, ro2: r0.ro2 });
cerca("Fez = (π²E·Cw/Lcz² + G·J)/(Ag·ro²)",
  fez.Fez_kgcm2,
  (Math.PI * Math.PI * A.E_ACERO * 500 / (250 * 250) + A.G_ACERO * 2.5) / (18 * r0.ro2),
  1e-12);
/* La User Note de E4 autoriza omitir el término con Cw en tes y 2L: ahí el
   alabeo aporta muy poco (fila C.E4.Cw). Omitirlo es CONSERVADOR. */
const fezSinCw = A.Fez({ J_cm4: 2.5, Lcz_cm: 250, Ag_cm2: 18, ro2: r0.ro2 });
cierto("omitir Cw lo declara", fezSinCw.omitioCw === true);
cierto("y da un Fez menor, o sea conservador", fezSinCw.Fez_kgcm2 < fez.Fez_kgcm2);

/* ---------- E4-3 · LA AUTOVERIFICACIÓN DEL ÁLGEBRA ------------------- */
/* Con H = 1 el centro de corte está en el centroide, la torsión y la flexión
   se desacoplan, y la E4-3 tiene que degenerar en min(Fey, Fez). No hace
   falta conocer ningún resultado para comprobarlo. */
for (const [fey, fz] of [[1000, 3000], [3000, 1000], [2000, 2000]]) {
  const r = A.FeSimpleSimetria({ Fey_kgcm2: fey, Fez_kgcm2: fz, H: 1 });
  cerca("con H = 1 la E4-3 degenera en min(Fey, Fez) · " + fey + "/" + fz,
    r.Fe_kgcm2, Math.min(fey, fz), 1e-9);
}
/* Con H < 1 el acoplamiento baja Fe por debajo del menor de los dos: eso ES
   el efecto flexo-torsional. */
const aco = A.FeSimpleSimetria({ Fey_kgcm2: 2000, Fez_kgcm2: 3000, H: 0.6 });
cierto("con H < 1, Fe queda por debajo del menor de los dos", aco.Fe_kgcm2 < 2000);
cierto("y el radicando no es negativo", aco.radicando >= 0);
lanza("un H fuera de (0,1] PARA",
  () => A.FeSimpleSimetria({ Fey_kgcm2: 2000, Fez_kgcm2: 3000, H: 1.2 }), "H tiene que");
/* En un CANAL el eje de simetría es X y hay que pasar Fex, no Fey · fila
   C.E4.canal. La nota lo dice para que no se aplique al eje equivocado. */
cierto("la nota avisa del caso del canal", /canal/.test(aco.nota));

/* ---------- E6 · la diagonal 2L del tijeral --------------------------- */
comp("Ki de ángulos espalda con espalda", A.KI.angulos, 0.50);
comp("Ki de canales espalda con espalda", A.KI.canales, 0.75);
comp("Ki de los demás casos", A.KI.otros, 0.86);
comp("el umbral sin penalizar es a/ri = 40", A.A_RI_SIN_PENALIZAR, 40);

/* (a) pernos a AJUSTE APRETADO · E6-1: el término entra SIEMPRE y sin Ki. */
const ap = A.esbeltezModificada({ lr0: 100, a_cm: 60, ri_cm: 1.4, conexion: "apretado" });
cerca("apretado · (Lc/r)m = √[(Lc/r)o² + (a/ri)²]",
  ap.lrm, Math.sqrt(100 * 100 + Math.pow(60 / 1.4, 2)), 1e-12);
comp("y no lleva Ki", ap.Ki, 1);

/* (b) REQUINTADO · E6-2: por debajo de a/ri = 40 no se modifica nada. */
const sinPen = A.esbeltezModificada({ lr0: 100, a_cm: 50, ri_cm: 1.4,
  conexion: "requintado", tipo: "angulos" });
comp("requintado con a/ri ≤ 40 · la esbeltez no cambia", sinPen.lrm, 100);
cierto("y lo declara", sinPen.sinPenalizar === true);
const req = A.esbeltezModificada({ lr0: 100, a_cm: 60, ri_cm: 1.4,
  conexion: "requintado", tipo: "angulos" });
cerca("por encima · (Lc/r)m = √[(Lc/r)o² + (Ki·a/ri)²]",
  req.lrm, Math.sqrt(100 * 100 + Math.pow(0.50 * 60 / 1.4, 2)), 1e-12);
/* REQUINTAR SALE A CUENTA, medido: la misma separación penaliza menos. */
cierto("requintar da una esbeltez menor que apretar", req.lrm < ap.lrm);
cerca("un 6 % menos en este caso", ap.lrm / req.lrm, 1.064, 0.01);

/* ri ES EL RADIO MÍNIMO DEL COMPONENTE, textual · fila C.E6.ri. En un ángulo
   el mínimo es rz, no rx ni ry, y usar rx da una esbeltez del componente
   mucho menor que la real. */
lanza("sin ri PARA, y explica que es el mínimo",
  () => A.esbeltezModificada({ lr0: 100, a_cm: 60, conexion: "apretado" }), "MÍNIMO");
lanza("sin decir el tipo de conexión PARA",
  () => A.esbeltezModificada({ lr0: 100, a_cm: 60, ri_cm: 1.4 }), "apretado");
lanza("y un tipo de armado inventado también",
  () => A.esbeltezModificada({ lr0: 100, a_cm: 60, ri_cm: 1.4,
    conexion: "requintado", tipo: "tubos" }), "E6-2b");

/* E6.2(a) · la separación máxima. NO ES LA MISMA REGLA QUE EN TRACCIÓN: allí
   (D4) el criterio es que cada componente no pase de 300; aquí es tres
   cuartos de la esbeltez GOBERNANTE del conjunto, casi siempre más exigente. */
comp("la fracción es tres cuartos", A.FRACCION_COMPONENTE, 0.75);
const sep = A.separacionConectores({ a_cm: 60, ri_cm: 1.4, lrGobernante: 100 });
comp("con el conjunto en 100, el tope del componente es 75", sep.tope, 75);
cierto("a/ri = 42,9 cumple", sep.cumple === true);
cerca("y la separación máxima admisible es 105 cm", sep.aMax_cm, 105, 0.1);
cierto("una separación excesiva no cumple",
  A.separacionConectores({ a_cm: 200, ri_cm: 1.4, lrGobernante: 100 }).cumple === false);
cierto("y la nota avisa de que en tracción el criterio es otro",
  /TRACCI/.test(sep.nota));
/* Comprobado que es más exigente que el de tracción en el caso normal: con el
   conjunto en 100, el tope aquí es 75 y en tracción sería 300. */
cierto("el criterio de compresión es más exigente que el de tracción", sep.tope < 300);

/* ---------- E7 · LA TABLA QUE SE COMPRUEBA A SÍ MISMA ---------------- */
/* c2 sale de c1 por la E7-4: c2 = (1 − √(1−4c1))/(2c1). Los c2 tabulados son
   ése redondeado a tres cifras, así que calcularlos y contrastarlos dice si
   la transcripción de c1 es correcta. */
for (const t of ["atiesados", "hss", "otros"]) {
  const f = A.factoresE7(t);
  cierto("c2 calculado coincide con el tabulado en «" + t + "», dentro del redondeo",
    f.desvioTabla < 0.004);
}
cerca("atiesados · c1 = 0,18 da c2 = 1,30792", A.factoresE7("atiesados").c2, 1.30792, 1e-5);
cerca("HSS · c1 = 0,20 da c2 = 1,38197", A.factoresE7("hss").c2, 1.38197, 1e-5);
cerca("los demás · c1 = 0,22 da c2 = 1,48543", A.factoresE7("otros").c2, 1.48543, 1e-5);
comp("y la tabla guarda 1,31", A.E7_C2_TABLA.atiesados, 1.31);
/* El código usa el EXACTO, no el tabulado. */
cierto("el valor que usa el código es el exacto, no el de la tabla",
  A.factoresE7("otros").c2 !== A.E7_C2_TABLA.otros);
lanza("un c1 imposible PARA", () => A.c2DeC1(0.3), "0 < c1 < 0,25");
lanza("un caso que no está en la Tabla E7.1 PARA",
  () => A.factoresE7("almas"), "Tabla E7.1");

/* ---------- E7 · el umbral depende de Fn, y eso importa -------------- */
/* EL UMBRAL ES λr·√(Fy/Fn), NO λr A SECAS. Así que un elemento esbelto por
   B4.1a puede no necesitar reducción: en una barra esbelta Fn es bajo, el
   umbral sube, y be = b. Lo que no se puede es saltarse el E7 y suponerlo. */
const colEsb = A.compresion({ acero: "A36", Ag_cm2: 9.3, Lc_cm: 250, r_cm: 1.98,
  noEsbelta: true });
const lrAng = A.lambdaR({ caso: 3, Fy_kgcm2: Fy }).lambdaR;
const ae = A.anchoEfectivo({ lambda: 16, lambdaR: lrAng, Fy_kgcm2: Fy,
  Fn_kgcm2: colEsb.Fn_kgcm2, b_cm: 5.08, tipo: "otros" });
cerca("λr del lado de ángulo es 12,77", lrAng, 12.77, 1e-3);
cierto("b/t = 16 es esbelto por B4.1a", 16 > lrAng);
cerca("pero el umbral del E7 sube a 19,43 porque Fn es bajo", ae.umbral, 19.43, 0.01);
cierto("así que NO hay reducción: be = b", ae.reducido === false);
cerca("y be es el b entero", ae.be_cm, 5.08, 1e-12);
cierto("la nota lo explica", /no necesita reducci/.test(ae.nota));
/* Con una barra CORTA, Fn sube, el umbral baja, y entonces sí reduce. */
const colCorta = A.compresion({ acero: "A36", Ag_cm2: 9.3, Lc_cm: 60, r_cm: 1.98,
  noEsbelta: true });
const aeRed = A.anchoEfectivo({ lambda: 16, lambdaR: lrAng, Fy_kgcm2: Fy,
  Fn_kgcm2: colCorta.Fn_kgcm2, b_cm: 5.08, tipo: "otros" });
cierto("en una barra corta el umbral baja y sí reduce", aeRed.reducido === true);
cierto("y be queda por debajo de b", aeRed.be_cm < 5.08);
cerca("con Fel = (c2·λr/λ)²·Fy",
  aeRed.Fel_kgcm2, Math.pow(A.factoresE7("otros").c2 * lrAng / 16, 2) * Fy, 1e-9);
/* La guarda de compresion() sigue siendo correcta: manda al E7 SIN prometer
   que la capacidad baje. */
lanza("compresión con elemento esbelto manda al E7 sin prometer que baje",
  () => A.compresion({ acero: "A36", Ag_cm2: 9.3, Lc_cm: 250, r_cm: 1.98,
    elementos: [{ nombre: "lado", razon: 16, caso: 3 }] }), "PUEDE no reducir");

/* Ae por descuento de áreas · User Note de E7 */
const areaEf = A.areaEfectivaE7({ Ag_cm2: 9.3, Fy_kgcm2: Fy,
  Fn_kgcm2: colCorta.Fn_kgcm2,
  elementos: [{ nombre: "lado", razon: 16, caso: 3, b_cm: 5.08, t_cm: 0.32, n: 2,
    tipo: "otros" }] });
cierto("Ae queda por debajo de Ag", areaEf.Ae_cm2 < 9.3);
cerca("y el descuento es Σ(b − be)·t·n",
  areaEf.descuento_cm2, (5.08 - aeRed.be_cm) * 0.32 * 2, 1e-9);
cierto("con el detalle por elemento", areaEf.detalle[0].reducido === true);
lanza("si los anchos efectivos se comen la sección PARA",
  () => A.areaEfectivaE7({ Ag_cm2: 0.5, Fy_kgcm2: Fy, Fn_kgcm2: colCorta.Fn_kgcm2,
    elementos: [{ nombre: "lado", razon: 40, caso: 3, b_cm: 5.08, t_cm: 0.127, n: 2 }] }),
  "se comen");

/* ---------- E7 · HSS redondo y su tope duro -------------------------- */
cerca("el límite bajo es 0,11·E/Fy = 88,7", 0.11 * A.E_ACERO / Fy, 88.65, 0.01);
cerca("y el tope duro 0,45·E/Fy = 362,7", 0.45 * A.E_ACERO / Fy, 362.7, 0.1);
cierto("por debajo del límite bajo, Ae = Ag",
  A.areaEfectivaRedondo({ D_t: 60, Fy_kgcm2: Fy, Ag_cm2: 30 }).Ae_cm2 === 30);
const red = A.areaEfectivaRedondo({ D_t: 150, Fy_kgcm2: Fy, Ag_cm2: 30 });
cierto("en el tramo intermedio reduce", red.reducido === true);
cerca("Ae = [0,038E/(Fy·D/t) + 2/3]·Ag",
  red.Ae_cm2, (0.038 * A.E_ACERO / (Fy * 150) + 2 / 3) * 30, 1e-12);
/* El 0,45·E/Fy NO es un límite que se pase de largo: por encima el perfil
   queda FUERA del alcance del capítulo y no hay ecuación que aplicar. */
lanza("por encima del tope duro PARA, y dice que queda fuera del alcance",
  () => A.areaEfectivaRedondo({ D_t: 400, Fy_kgcm2: Fy, Ag_cm2: 30 }), "FUERA del alcance");

fin();
