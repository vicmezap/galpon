/* =====================================================================
   probar_acero.js — AISC Capítulo D · tracción

   Las pruebas de acero.js van POR CAPÍTULO, porque el módulo cubre cinco y
   un archivo con todo dentro deja de leerse:
       probar_acero.js              · Cap. D · tracción   ← este
       probar_acero_compresion.js   · Cap. E · compresión

   Lo que se comprueba aquí, por orden de importancia:

     1) LAS DOS DIVERGENCIAS CON LA E.090, medidas. El factor U y el bloque
        de cortante. Las dos decididas a favor del AISC en el inventario, y
        el módulo calcula las dos para que la diferencia se vea.

     2) EL CASO DEL TIJERAL. Una diagonal de ángulo conectada por un solo
        lado cae en el caso 8 de la Tabla D3.1. Calcularla con U = 1 es el
        error clásico y aquí está medido en los dos sentidos: el término de
        rotura sube un 67 % y la capacidad gobernante un 36 %, porque la
        fluencia tapa el resto.

     3) CUÁL ESTADO LÍMITE GOBIERNA, que es lo que sirve para decidir qué
        cambiar. Un ratio sin nombre de estado límite no sirve de nada.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const A = require("../src/acero.js");

const Fy = 2530, Fu = 4080;     /* A36 · filas MAT.A36.* */

/* ---------- materiales ------------------------------------------------- */
comp("A36 · Fy", A.ACEROS.A36.Fy, Fy);
comp("A36 · Fu", A.ACEROS.A36.Fu, Fu);
comp("A572 Gr.50 · Fy", A.ACEROS.A572.Fy, 3515);
lanza("un acero sin fila en el inventario PARA",
  () => A.material("A992"), "no tiene");

/* ---------- los dos factores de resistencia ---------------------------- */
comp("fluencia · φ = 0,90", A.PHI.tFluencia, 0.90);
comp("rotura · φ = 0,75", A.PHI.tRotura, 0.75);
/* La rotura lleva φ menor porque es FRÁGIL: no avisa antes de romper. */
cierto("la rotura se castiga más que la fluencia", A.PHI.tRotura < A.PHI.tFluencia);

/* ---------- D2 · los dos estados límite -------------------------------- */
const plana = A.traccion({ acero: "A36", Ag_cm2: 50 });
cerca("fluencia · Pn = Fy·Ag", plana.fluencia.Pn_kgf, Fy * 50, 1e-12);
cerca("y Pd = 0,90·Fy·Ag", plana.fluencia.Pd_kgf, 0.90 * Fy * 50, 1e-12);
cerca("rotura · Pd = 0,75·Fu·Ae", plana.rotura.Pd_kgf, 0.75 * Fu * 50, 1e-12);
comp("sin agujeros y con U = 1 manda la fluencia", plana.manda, "fluencia en el área total");
cerca("y Pd es el menor de los dos", plana.Pd_kgf, 0.90 * Fy * 50, 1e-12);

/* EL UMBRAL EXACTO donde cambia el estado límite gobernante, derivado:
   0,90·Fy·Ag = 0,75·Fu·Ae  →  Ae/Ag = 0,90·Fy/(0,75·Fu).
   Con A36 sale 0,744, y eso es un dato de diseño: por debajo de ese cociente
   la rotura manda y el material bueno no sirve de nada. */
const umbral = (0.90 * Fy) / (0.75 * Fu);
cerca("el umbral Ae/Ag donde cambia el gobernante · A36", umbral, 0.7441, 1e-3);
comp("justo por encima manda la fluencia",
  A.traccion({ acero: "A36", Ag_cm2: 100, An_cm2: 100, U: umbral + 0.01 }).manda,
  "fluencia en el área total");
comp("justo por debajo manda la rotura",
  A.traccion({ acero: "A36", Ag_cm2: 100, An_cm2: 100, U: umbral - 0.01 }).manda,
  "rotura en el área neta efectiva");

/* ---------- el ratio demanda/capacidad --------------------------------- */
const r = A.traccion({ acero: "A36", Ag_cm2: 50, Pu_kgf: 80000 });
cerca("ratio = Pu/Pd", r.ratio, 80000 / (0.90 * Fy * 50), 1e-12);
cierto("y dice si cumple", r.cumple === true);
cierto("con Pu mayor que Pd, no cumple",
  A.traccion({ acero: "A36", Ag_cm2: 50, Pu_kgf: 200000 }).cumple === false);

/* ---------- área neta · B4.3b ------------------------------------------ */
/* El agujero se cuenta 2 mm MAYOR que el nominal: el taladrado daña el borde. */
const an = A.areaNeta({ Ag_cm2: 24.7, t_cm: 0.95, nAgujeros: 1, dAgujero_cm: 2.06 });
cerca("el descuento lleva los 2 mm de más", an.descuento_cm2, (2.06 + 0.2) * 0.95, 1e-12);
cerca("An = Ag − descuento", an.An_cm2, 24.7 - (2.06 + 0.2) * 0.95, 1e-12);
comp("sin agujeros, An = Ag", A.areaNeta({ Ag_cm2: 24.7 }).An_cm2, 24.7);
lanza("agujeros que se comen la sección PARAN",
  () => A.areaNeta({ Ag_cm2: 5, t_cm: 1, nAgujeros: 3, dAgujero_cm: 2 }), "se comen");
lanza("con agujeros hace falta el espesor",
  () => A.areaNeta({ Ag_cm2: 24.7, nAgujeros: 1, dAgujero_cm: 2.06 }), "t_cm");

/* ---------- Tabla D3.1 · el factor U ----------------------------------- */
comp("caso 1 · carga por todos los elementos → U = 1", A.factorU({ caso: "1" }).U, 1.0);
cerca("caso 2 · U = 1 − x̄/l",
  A.factorU({ caso: "2", xbar_cm: 2.5, l_cm: 20 }).U, 1 - 2.5 / 20, 1e-12);
lanza("caso 2 con la conexión más corta que la excentricidad PARA",
  () => A.factorU({ caso: "2", xbar_cm: 25, l_cm: 20 }), "no es");

/* EL CASO 8 ES EL DEL TIJERAL · ángulo conectado por un solo lado. */
comp("caso 8 · 4 o más pernos por línea → 0,80",
  A.factorU({ caso: "8", pernosPorLinea: 4 }).U, 0.80);
comp("caso 8 · exactamente 3 pernos → 0,60",
  A.factorU({ caso: "8", pernosPorLinea: 3 }).U, 0.60);
/* Con menos de 3 la tabla MANDA usar el caso 2, no inventar un valor. */
lanza("caso 8 con 2 pernos remite al caso 2",
  () => A.factorU({ caso: "8", pernosPorLinea: 2 }), "CASO 2");
lanza("un caso que no está en la tabla PARA",
  () => A.factorU({ caso: "9" }), "Tabla D3.1");
/* La tabla permite tomar el MAYOR entre el tabulado y el caso 2. */
const mejor = A.factorU({ caso: "8", pernosPorLinea: 3, xbar_cm: 2.0, l_cm: 20 });
cerca("si el caso 2 da más, se toma el mayor", mejor.U, 1 - 2.0 / 20, 1e-12);
cierto("y se dice de dónde vino la mejora", mejor.mejorado !== null);
/* Y el piso por área conectada · fila T.U.piso. */
const piso = A.factorU({ caso: "8", pernosPorLinea: 3, Aconectada_cm2: 18, Ag_cm2: 24.7 });
cerca("el piso por área conectada sube U", piso.U, 18 / 24.7, 1e-12);

/* ---------- DIVERGENCIA 1 · el factor U · fila T.U.divergencia --------- */
/* La E.090 tiene UNA fórmula con tope 0,90; el AISC tiene ocho casos.
   Divergen en los DOS sentidos, y aquí están los dos. */
const largo = A.factorU({ caso: "2", xbar_cm: 1.0, l_cm: 40 });
cerca("conexión larga · el AISC da 0,975", largo.U, 0.975, 1e-12);
comp("y la E.090 la corta en su tope de 0,90", largo.U_E090, 0.90);
cierto("ahí el AISC es MENOS conservador", largo.U > largo.U_E090);
const tres = A.factorU({ caso: "8", pernosPorLinea: 3, xbar_cm: 2.5, l_cm: 20 });
cierto("con 3 pernos, en cambio, el AISC puede obligar a menos que la E.090",
  A.factorU({ caso: "8", pernosPorLinea: 3 }).U < 0.90);
cierto("la decisión viaja escrita en cada resultado",
  /AISC 360-22/.test(tres.notaDivergencia));

/* ---------- EL ERROR CLÁSICO DEL TIJERAL, medido en los dos sentidos ---- */
/* Ángulo L4x4x3/8 aproximado: Ag = 24,7 cm², un agujero de 3/4", 3 pernos. */
const conU = A.traccion({ acero: "A36", Ag_cm2: 24.7, An_cm2: an.An_cm2, U: 0.60 });
const sinU = A.traccion({ acero: "A36", Ag_cm2: 24.7, An_cm2: an.An_cm2, U: 1.00 });
comp("con U = 0,60 manda la rotura", conU.manda, "rotura en el área neta efectiva");
comp("con U = 1 pasa a mandar la fluencia", sinU.manda, "fluencia en el área total");
/* El término de ROTURA sube 1/0,60 = 67 %... */
cerca("el término de rotura sube un 67 %",
  sinU.rotura.Pd_kgf / conU.rotura.Pd_kgf, 1 / 0.60, 1e-12);
/* ...pero la capacidad GOBERNANTE solo sube un 36 %, porque la fluencia la
   tapa. Los dos números importan: el 67 % es del estado límite y el 36 % es
   lo que de verdad te llevarías al diseño. */
cerca("pero la capacidad gobernante sube un 35,8 %",
  sinU.Pd_kgf / conU.Pd_kgf, 1.358, 0.01);
cierto("y en los dos casos el error va del lado INSEGURO", sinU.Pd_kgf > conU.Pd_kgf);

/* ---------- bloque de cortante · J4-5 --------------------------------- */
const bl = A.bloqueCortante({ acero: "A36", Anv_cm2: 12, Agv_cm2: 15, Ant_cm2: 4 });
cerca("rotura en corte = 0,60·Fu·Anv", bl.corteRotura_kgf, 0.60 * Fu * 12, 1e-12);
cerca("fluencia en corte = 0,60·Fy·Agv", bl.corteFluencia_kgf, 0.60 * Fy * 15, 1e-12);
cerca("tracción = Ubs·Fu·Ant", bl.tracRotura_kgf, 1.0 * Fu * 4, 1e-12);
/* UNA ecuación: el corte es el MENOR de rotura y fluencia, más la tracción. */
cerca("Rn = min(corte) + tracción",
  bl.Rn_kgf, Math.min(0.60 * Fu * 12, 0.60 * Fy * 15) + Fu * 4, 1e-12);
comp("φ = 0,75", bl.phi, 0.75);
comp("y dice qué rama del corte acotó", bl.rama, "fluencia en corte (acota)");
comp("Ubs = 1,0 por omisión", bl.Ubs, 1.0);
lanza("un Ubs que no es 1,0 ni 0,5 PARA",
  () => A.bloqueCortante({ acero: "A36", Anv_cm2: 12, Agv_cm2: 15, Ant_cm2: 4, Ubs: 0.7 }),
  "1,0");
lanza("Anv mayor que Agv PARA",
  () => A.bloqueCortante({ acero: "A36", Anv_cm2: 20, Agv_cm2: 15, Ant_cm2: 4 }), "no puede superar");

/* ---------- DIVERGENCIA 2 · el bloque · fila T.bloque.divergencia ------ */
/* Con Ubs = 1 y esta geometría las dos normas quedan al 1 %: la divergencia
   no siempre muerde, y decirlo es parte del trabajo. */
cerca("con Ubs = 1 las dos normas quedan al 1 %", bl.Rd_E090_kgf / bl.Rd_kgf, 1.010, 0.005);
/* DONDE SÍ MUERDE es con Ubs = 0,5, porque la E.090 NO TIENE Ubs: se lleva
   el término de tracción entero y da bastante más. */
const b05 = A.bloqueCortante({ acero: "A36", Anv_cm2: 12, Agv_cm2: 15, Ant_cm2: 8, Ubs: 0.5 });
cierto("con Ubs = 0,5 la E.090 da bastante más que el AISC",
  b05.Rd_E090_kgf > b05.Rd_kgf * 1.15);
/* UN 41,7 % MÁS, y es mucho más de lo que parecía: la E.090 se lleva el
   término de tracción ENTERO (32 640 kgf) donde el AISC solo toma la mitad
   (16 320). En una cartela despatinada con dos filas de pernos, diseñar con
   la E.090 daría una conexión un 42 % más débil de lo que el AISC admite. */
cerca("un 41,7 % más, medido", b05.Rd_E090_kgf / b05.Rd_kgf, 1.4175, 1e-3);
cierto("porque la E.090 no tiene Ubs", /no tiene Ubs/.test(b05.notaDivergencia));

/* ---------- esbeltez en tracción · D1 --------------------------------- */
/* AVISO, no rechazo: el AISC dice en texto obligatorio que NO hay límite. */
const esb = A.esbeltezTraccion({ L_cm: 600, r_cm: 1.5 });
cerca("l/r se calcula", esb.lr, 400, 1e-12);
cierto("pasa de 300 y lo dice", esb.pasa === false);
cierto("pero NO es un rechazo", esb.esRechazo === false);
cierto("y cita el texto obligatorio del AISC",
  /no maximum slenderness limit/.test(esb.nota));
/* Las dos normas excluyen las varillas: por eso una riostra de 5/8" con
   l/r de 600 es legal. */
comp("una varilla no entra en el límite",
  A.esbeltezTraccion({ L_cm: 900, esVarilla: true }).aplica, false);

/* ---------- varilla roscada · J3.7 y D2 ------------------------------- */
const va = A.varillaRoscada({ acero: "A36", Ab_cm2: 1.98 });
cerca("rotura de la parte roscada · 0,75·(0,75·Fu)·Ab",
  va.rotura.Pd_kgf, 0.75 * 0.75 * Fu * 1.98, 1e-12);
cerca("fluencia en el área total · 0,90·Fy·Ab",
  va.fluencia.Pd_kgf, 0.90 * Fy * 1.98, 1e-12);
/* EN A36 LOS DOS EMPATAN AL 0,8 %, así que no se puede elegir uno. */
cierto("en A36 los dos estados límite empatan", va.empatan === true);
cerca("y el empate es del 0,8 %",
  va.rotura.Pd_kgf / va.fluencia.Pd_kgf, 1.008, 0.002);
comp("en A36 manda la fluencia, por poco", va.manda, "fluencia en el área total (D2a)");
/* En A572 Gr.50 la cosa cambia y manda la rotura: por eso hay que calcular
   los dos y no fijar uno por costumbre. */
comp("en A572 Gr.50 manda la rotura",
  A.varillaRoscada({ acero: "A572", Ab_cm2: 1.98 }).manda,
  "rotura de la parte roscada (J3.7)");
lanza("sin el área gruesa PARA, y explica la trampa",
  () => A.varillaRoscada({ acero: "A36" }), "dos veces");

/* ---------- las citas viajan ------------------------------------------ */
cierto("cada resultado trae su artículo del AISC",
  plana.fluencia.art.indexOf("D2") >= 0 && bl.art.indexOf("J4") >= 0);

fin();
