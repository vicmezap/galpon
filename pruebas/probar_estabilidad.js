/* =====================================================================
   probar_estabilidad.js — AISC Cap. C y Apéndice 8

   Tres de estas comprobaciones MIDEN un conflicto con la E.090 en vez de
   describirlo: Cm con carga transversal, Pe1 con rigidez reducida y el
   factor RM. Los tres están decididos a favor del AISC en el inventario, y
   los tres tienen efecto numérico. Aquí se ve cuánto.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const M = require("../src/modelo.js");
const X = require("../src/estabilidad.js");

/* ---------- el nivel de carga · fila E.C1.nivel ------------------------ */
/* «All load-dependent effects shall be calculated at a level of loading
   corresponding to LRFD load combinations.» Con cargas de servicio el
   segundo orden sale subestimado y el resultado parece bueno. */
cierto("un modelo LRFD pasa", X.exigeLRFD(M.nuevo({ nivel: "LRFD" })) === true);
lanza("un modelo de servicio PARA",
  () => X.exigeLRFD(M.nuevo({ nivel: "servicio" })), "cargas FACTORIZADAS");

/* ---------- cargas nocionales · C2-1 ----------------------------------- */
comp("α vale 1,0 en LRFD", X.ALFA.LRFD, 1.0);
comp("y 1,6 en ASD", X.ALFA.ASD, 1.6);
cerca("Ni = 0,002·Yi con 100 000 kgf de gravedad",
  X.cargaNocional({ Yi_kgf: 100000 }).Ni_kgf, 200, 1e-12);
cerca("en ASD sube por α = 1,6",
  X.cargaNocional({ Yi_kgf: 100000, metodo: "ASD" }).Ni_kgf, 320, 1e-12);
/* EL 0,002 SALE DEL DESPLOME DE 1/500, que es la tolerancia de verticalidad
   del Code of Standard Practice. Con otra tolerancia justificada el
   coeficiente se ajusta en proporción, y por eso es un dato editable. */
comp("el desplome por omisión es 1/500", X.DESPLOME, 1 / 500);
cerca("con un desplome de 1/1000 el coeficiente se parte por dos",
  X.cargaNocional({ Yi_kgf: 100000, desplome: 1 / 1000 }).Ni_kgf, 100, 1e-12);
cerca("y el coeficiente sale explícito",
  X.cargaNocional({ Yi_kgf: 100000 }).coef, 0.002, 1e-12);
lanza("sin la gravedad del nivel PARA", () => X.cargaNocional({}), "Yi_kgf");

/* El cortante ficticio · C2.2b(a). Las nocionales meten un cortante en la
   base que no existe; el VOLTEO que generan sí es real y no se corrige. */
const fic = X.cortanteFicticio({ Ni_kgf: [200, 300], gravedadPorApoyo_kgf: [60000, 40000] });
cerca("el ficticio es igual y contrario a la suma de nocionales", fic.total_kgf, -500, 1e-12);
cerca("y se reparte en proporción a la gravedad de cada apoyo",
  fic.porApoyo_kgf[0], -300, 1e-12);
cerca("el otro apoyo se lleva el resto", fic.porApoyo_kgf[1], -200, 1e-12);
cierto("y avisa de que el volteo NO se corrige", /volteo|VOLTEO/i.test(fic.nota));

/* ---------- τb · C2-2 -------------------------------------------------- */
comp("con poca carga τb = 1,0",
  X.tauB({ Pr_kgf: 30, Pns_kgf: 100 }).tauB, 1.0);
comp("en el límite exacto α·Pr/Pns = 0,5 todavía vale 1,0",
  X.tauB({ Pr_kgf: 50, Pns_kgf: 100 }).tauB, 1.0);
cerca("pasado el límite, τb = 4·r·(1−r)",
  X.tauB({ Pr_kgf: 80, Pns_kgf: 100 }).tauB, 4 * 0.8 * 0.2, 1e-12);
cerca("con la columna al tope τb tiende a 0",
  X.tauB({ Pr_kgf: 100, Pns_kgf: 100 }).tauB, 0, 1e-12);
cierto("y avisa de que es iterativo",
  /ITERATIVO/i.test(X.tauB({ Pr_kgf: 80, Pns_kgf: 100 }).nota));

/* ---------- el 0,80 · C2.3(a) ------------------------------------------ */
comp("el factor de rigidez del Método Directo es 0,80", X.K_RIGIDEZ, 0.80);
comp("aplicado al axial", X.rigidezReducida({}).factorAxial, 0.80);
cerca("y a la flexión, multiplicado por τb",
  X.rigidezReducida({ tauB: 0.64 }).factorFlexion, 0.80 * 0.64, 1e-12);
/* EN UN TIJERAL MANDA EL 0,80, no τb: las barras trabajan axialmente y τb
   solo toca las rigideces de flexión. */
comp("sin τb, flexión y axial llevan el mismo factor",
  X.rigidezReducida({}).factorFlexion, X.rigidezReducida({}).factorAxial);

/* ---------- K = 1 · C3 · EL PREMIO DEL MÉTODO DIRECTO ------------------ */
const k = X.longitudEfectiva({ L_cm: 500 });
comp("K = 1", k.K, 1);
comp("y Lc = L", k.Lc_cm, 500);
cierto("con la cita textual del C3", /unbraced length/.test(k.nota));
/* Se acabó el ábaco de alineamiento, que supone columnas verticales y vigas
   horizontales: justo lo que un pórtico a dos aguas no tiene. */
cierto("y recuerda que el arriostre tiene que cumplir el Apéndice 6",
  /Ap.ndice 6/.test(k.aviso));

/* ---------- Cm · A-8-4 ------------------------------------------------- */
/* M1/M2 POSITIVO en curvatura doble, NEGATIVO en simple, y esa es toda la
   diferencia: 0,2 contra 1,0. */
cerca("curvatura doble, M1/M2 = +1 → Cm = 0,2",
  X.factorCm({ M1_kgfcm: 1000, M2_kgfcm: 1000 }).Cm, 0.2, 1e-12);
cerca("curvatura simple, M1/M2 = −1 → Cm = 1,0",
  X.factorCm({ M1_kgfcm: -1000, M2_kgfcm: 1000 }).Cm, 1.0, 1e-12);
cerca("momento en un solo extremo → Cm = 0,6",
  X.factorCm({ M1_kgfcm: 0, M2_kgfcm: 1000 }).Cm, 0.6, 1e-12);
comp("y nombra la curvatura",
  X.factorCm({ M1_kgfcm: -500, M2_kgfcm: 1000 }).curvatura, "simple");
cerca("la diferencia entre las dos curvaturas es un factor 5",
  X.factorCm({ M1_kgfcm: -1000, M2_kgfcm: 1000 }).Cm /
  X.factorCm({ M1_kgfcm: 1000, M2_kgfcm: 1000 }).Cm, 5, 1e-12);
lanza("intercambiar M1 y M2 PARA",
  () => X.factorCm({ M1_kgfcm: 2000, M2_kgfcm: 1000 }), "|M1|");
lanza("y no dar ninguno tampoco vale", () => X.factorCm({}), "PRIMER orden");

/* CONFLICTO MEDIDO · fila E.A8.Cm.transv. El AISC 360-22 quitó los 0,85 y
   1,00 tabulados y dejó «por análisis o 1,0». Con extremos restringidos la
   E.090 permitía 0,85 y el AISC pide 1,0: el AISC es un 18 % más severo, y
   es el caso de la columna de un pórtico rígido con viento en su altura. */
const ct = X.factorCm({ cargaTransversal: true });
comp("con carga transversal el AISC manda 1,0", ct.Cm, 1.0);
cerca("un 17,6 % más severo que el 0,85 de la E.090", ct.Cm / 0.85, 1.176, 1e-3);
cierto("y la decisión viaja escrita", /E\.090/.test(ct.nota));
comp("pero un Cm de análisis se respeta",
  X.factorCm({ cargaTransversal: true, CmAnalisis: 0.7 }).Cm, 0.7);

/* ---------- Pe1 · CONFLICTO MEDIDO · fila E.A8.Pe1 -------------------- */
const geo = { E_kgcm2: 2039000, I_cm4: 8491, Lc1_cm: 500 };
const pDir = X.Pe1(Object.assign({}, geo));
const pComp = X.Pe1(Object.assign({}, geo, { metodoDirecto: false }));
cerca("Pe1 con rigidez completa = π²EI/Lc²",
  pComp.Pe1_kgf, Math.PI * Math.PI * 2039000 * 8491 / (500 * 500), 1e-9);
cerca("con Método Directo baja al 80 %", pDir.Pe1_kgf / pComp.Pe1_kgf, 0.80, 1e-12);
/* Y como Pe1 está en el denominador de B1, un Pe1 menor da un B1 MAYOR: el
   Método Directo es más severo aquí, al revés de lo que suena. */
const b1Dir = X.B1({ Cm: 1, Pr_kgf: 20000, Pe1_kgf: pDir.Pe1_kgf }).B1;
const b1Comp = X.B1({ Cm: 1, Pr_kgf: 20000, Pe1_kgf: pComp.Pe1_kgf }).B1;
cierto("así que el Método Directo da un B1 mayor", b1Dir > b1Comp);
cerca("un 1,4 % más en este caso", b1Dir / b1Comp, 1.014, 0.01);
cerca("con τb también reducido, Pe1 baja más",
  X.Pe1(Object.assign({}, geo, { tauB: 0.5 })).Pe1_kgf / pComp.Pe1_kgf, 0.40, 1e-12);

/* ---------- B1 · A-8-3 ------------------------------------------------- */
cerca("B1 = Cm/(1 − α·Pr/Pe1)",
  X.B1({ Cm: 0.6, Pr_kgf: 25, Pe1_kgf: 100 }).B1, 1, 1e-12);
cerca("y cuando Cm/(1−r) pasa de 1, ese es el valor",
  X.B1({ Cm: 1.0, Pr_kgf: 50, Pe1_kgf: 100 }).B1, 2, 1e-12);
comp("nunca baja de 1", X.B1({ Cm: 0.2, Pr_kgf: 10, Pe1_kgf: 100 }).B1, 1);
lanza("si α·Pr/Pe1 ≥ 1 la barra pandea y PARA",
  () => X.B1({ Cm: 1, Pr_kgf: 100, Pe1_kgf: 100 }), "pandea");

/* ---------- RM · CONFLICTO · fila E.A8.RM ------------------------------ */
/* La E.090 no tiene este factor. En un pórtico a momento puro vale 0,85, o
   sea que Pe,story baja un 15 % y B2 sube. */
cerca("pórtico a momento puro → RM = 0,85",
  X.factorRM({ Pmf_kgf: 50000, Pstory_kgf: 50000 }).RM, 0.85, 1e-12);
comp("sistema arriostrado → RM = 1",
  X.factorRM({ Pmf_kgf: 0, Pstory_kgf: 50000 }).RM, 1);
cerca("mitad y mitad → 0,925",
  X.factorRM({ Pmf_kgf: 25000, Pstory_kgf: 50000 }).RM, 0.925, 1e-12);
lanza("Pmf mayor que Pstory PARA",
  () => X.factorRM({ Pmf_kgf: 60000, Pstory_kgf: 50000 }), "no puede superar");
cierto("y la decisión viaja escrita",
  /E\.090/.test(X.factorRM({ Pmf_kgf: 0, Pstory_kgf: 1 }).nota));

/* ---------- Pe,story y B2 · A-8-6 y A-8-7 ----------------------------- */
const pe = X.PeStory({ H_kgf: 5000, L_cm: 500, deltaH_cm: 1.0, RM: 0.85 });
cerca("Pe,story = RM·H·L/ΔH", pe.Pestory_kgf, 0.85 * 5000 * 500 / 1.0, 1e-9);
cierto("y recuerda que ΔH es de PRIMER orden y con rigidez reducida",
  /PRIMER orden/.test(pe.nota));
lanza("sin deriva PARA", () => X.PeStory({ H_kgf: 5000, L_cm: 500 }), "deltaH_cm");

cerca("B2 = 1/(1 − α·Pstory/Pe,story)",
  X.B2({ Pstory_kgf: 200000, Pestory_kgf: 1000000 }).B2, 1 / 0.8, 1e-12);
comp("nunca baja de 1", X.B2({ Pstory_kgf: 0, Pestory_kgf: 1000000 }).B2, 1);
lanza("un piso inestable por sí mismo PARA",
  () => X.B2({ Pstory_kgf: 1000000, Pestory_kgf: 900000 }), "inestable");

/* B2 ES la razón Δ₂ᵒ/Δ₁ᵉʳ, así que decide las dos simplificaciones de
   umbral 1,7: omitir P-δ en la respuesta global (C2.1b) y meter las
   nocionales solo en las combinaciones de gravedad (C2.2b(d)). */
comp("el umbral de las dos simplificaciones es 1,7", X.RAZON_2ORDEN, 1.7);
const flojo = X.B2({ Pstory_kgf: 200000, Pestory_kgf: 1000000 });
cierto("con B2 = 1,25 se permiten las dos simplificaciones",
  flojo.permiteOmitirPdeltaGlobal === true && flojo.permiteNocionalesSoloEnGravedad === true);
const duro = X.B2({ Pstory_kgf: 450000, Pestory_kgf: 1000000 });
cierto("con B2 = 1,82 ya no", duro.permiteOmitirPdeltaGlobal === false);
cerca("y ese B2 es 1,818", duro.B2, 1 / 0.55, 1e-12);

/* ---------- el resultado de segundo orden · A-8-1 y A-8-2 ------------- */
const so = X.segundoOrden({ B1: 1.2, B2: 1.5,
  Mnt_kgfcm: 100000, Mlt_kgfcm: 200000, Pnt_kgf: 10000, Plt_kgf: 4000 });
cerca("Mr = B1·Mnt + B2·Mlt", so.Mr_kgfcm, 1.2 * 100000 + 1.5 * 200000, 1e-9);
/* EL AXIAL TAMBIÉN SE AMPLIFICA, y es fácil de olvidar porque la fórmula
   famosa es la del momento. */
cerca("Pr = Pnt + B2·Plt", so.Pr_kgf, 10000 + 1.5 * 4000, 1e-9);
cierto("el axial amplificado supera al de primer orden", so.Pr_kgf > 14000);
cerca("en este caso un 14 % más que sumarlos sin amplificar",
  so.Pr_kgf / 14000, 1.1429, 1e-3);
lanza("un B1 menor que 1 PARA", () => X.segundoOrden({ B1: 0.9, B2: 1 }), "B1 ≥ 1");

/* ---------- analiza() ata el solucionador al Método Directo ----------- */
const m = M.nuevo({ nivel: "LRFD", nombre: "voladizo" });
M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
M.nudo(m, { id: "B", x_m: 5, y_m: 0 });
M.apoyo(m, { nudo: "A", ux: true, uy: true, rz: true });
M.barra(m, { id: "b", i: "A", j: "B", A_cm2: 50, I_cm4: 8000 });
M.cargaNudo(m, { nudo: "B", Fy_kgf: -1000 });
const r = X.analiza(m);
comp("analiza() usa el 0,80", r.factorRigidez, 0.80);
comp("y lo declara como Método Directo", r.metodo, "Directo");
cerca("con τb, el factor es 0,80·τb", X.analiza(m, { tauB: 0.5 }).factorRigidez, 0.40, 1e-12);
lanza("y se niega con un modelo de servicio",
  () => X.analiza(M.nuevo({ nivel: "servicio" })), "cargas FACTORIZADAS");

fin();
