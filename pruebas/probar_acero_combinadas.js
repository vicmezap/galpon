/* =====================================================================
   probar_acero_combinadas.js — AISC Capítulo H

       probar_acero.js              · Cap. D · tracción
       probar_acero_compresion.js   · E3 y E5
       probar_acero_armados.js      · E4, E6 y E7
       probar_acero_flexion.js      · Cap. F
       probar_acero_corte.js        · Cap. G
       probar_acero_combinadas.js   · Cap. H   ← este, cierra E4

   LO QUE MÁS SE PRUEBA AQUÍ ES UNA GUARDA, NO UNA FÓRMULA. Pr y Mr no son
   las fuerzas del análisis de primer orden: el H1.1 las define «in
   accordance with Chapter C», o sea con el segundo orden ya dentro. Meter
   fuerzas de primer orden da un ratio menor, el elemento pasa, y no lo
   delata ningún resultado. Es el error silencioso más fácil de cometer en
   todo el diseño de un pórtico, así que el módulo se niega a calcular sin
   que se declare de dónde vienen.

   Y UNA OBSERVACIÓN DE ESTILO QUE CIERRA EL PATRÓN DE LOS OTROS CAPÍTULOS:
   el 8/9 de la H1-1a es una fracción EXACTA, y por eso la envolvente empalma
   perfecta en Pr/Pc = 0,2. Contrasta con el 4,71, el 1,95 y el 1,51 de E, F
   y G, que están redondeados y dejan saltos. Cuando la continuidad importa,
   el AISC conserva la fracción.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const A = require("../src/acero.js");

const BASE = { origen: "segundo-orden", Pc_kgf: 100000,
  Mcx_kgfcm: 1500000, Mcy_kgfcm: 400000 };
function h1(extra) { return A.interaccionH1(Object.assign({}, BASE, extra)); }

/* ---------- LA GUARDA · Pr y Mr son del Capítulo C · fila H.Pr -------- */
lanza("sin declarar el origen de Pr y Mr, no calcula",
  () => A.interaccionH1({ Pr_kgf: 10000, Pc_kgf: 100000 }), "Chapter C");
lanza("y con fuerzas de primer orden PARA, en vez de dar un ratio optimista",
  () => A.interaccionH1({ origen: "primer-orden", Pr_kgf: 10000, Pc_kgf: 100000 }),
  "PRIMER ORDEN");
cierto("con fuerzas de segundo orden sí calcula",
  h1({ Pr_kgf: 10000, Mrx_kgfcm: 600000 }).valor > 0);
/* El mensaje tiene que decir CÓMO arreglarlo, no solo que está mal. */
lanza("y el mensaje dice cómo amplificarlas",
  () => A.interaccionH1({ origen: "primer-orden", Pr_kgf: 1, Pc_kgf: 1 }), "B1 y B2");

/* ---------- H1-1a y H1-1b · las dos ramas --------------------------- */
comp("el umbral es Pr/Pc = 0,2", A.H1_UMBRAL, 0.2);
cerca("y el coeficiente es 8/9 exacto", A.H1_COEF, 8 / 9, 1e-15);
const baja = h1({ Pr_kgf: 10000, Mrx_kgfcm: 600000 });
cierto("con Pr/Pc = 0,10 manda la H1-1b", baja.ecuacion.indexOf("H1-1b") >= 0);
cerca("valor = Pr/(2Pc) + ΣM/Mc", baja.valor, 0.05 + 0.4, 1e-12);
const alta = h1({ Pr_kgf: 30000, Mrx_kgfcm: 600000 });
cierto("con Pr/Pc = 0,30 manda la H1-1a", alta.ecuacion.indexOf("H1-1a") >= 0);
cerca("valor = Pr/Pc + (8/9)·ΣM/Mc", alta.valor, 0.30 + (8 / 9) * 0.4, 1e-12);
/* Justo EN 0,2 manda la H1-1a: el límite es «≥», no «>». */
cierto("justo en 0,2 manda la H1-1a",
  h1({ Pr_kgf: 20000, Mrx_kgfcm: 600000 }).ecuacion.indexOf("H1-1a") >= 0);
/* Los dos ejes de flexión se suman. */
cerca("los dos momentos se suman",
  h1({ Pr_kgf: 30000, Mrx_kgfcm: 600000, Mry_kgfcm: 80000 }).sumaMomentos,
  0.4 + 0.2, 1e-12);
/* TODOS LOS TÉRMINOS SE TOMAN POSITIVOS · User Note de H1.1. */
cerca("un momento negativo se toma en valor absoluto",
  h1({ Pr_kgf: 30000, Mrx_kgfcm: -600000 }).valor, alta.valor, 1e-12);
cerca("y una axial negativa también",
  h1({ Pr_kgf: -30000, Mrx_kgfcm: 600000 }).valor, alta.valor, 1e-12);
cierto("y se dice en la nota", /POSITIVOS/.test(alta.nota));
cierto("cumple cuando el valor no pasa de 1", alta.cumple === true);
cierto("y no cumple cuando lo pasa",
  h1({ Pr_kgf: 80000, Mrx_kgfcm: 900000 }).cumple === false);
lanza("con Mrx pero sin Mcx PARA",
  () => A.interaccionH1({ origen: "segundo-orden", Pr_kgf: 1000, Pc_kgf: 100000,
    Mrx_kgfcm: 500000 }), "Mcx_kgfcm");

/* ---------- LA ENVOLVENTE EMPALMA EXACTA EN Pr/Pc = 0,2 ------------- */
/* En la frontera las dos ecuaciones dan la MISMA capacidad de momento sobre
   la línea de unidad: H1-1a pide 0,2 + (8/9)·M = 1 → M = 0,9, y H1-1b pide
   0,1 + M = 1 → M = 0,9. Eso solo cuadra porque el 8/9 es EXACTO. */
cerca("H1-1a en la frontera admite ΣM/Mc = 0,9", (1 - 0.2) * 9 / 8, 0.9, 1e-15);
cerca("H1-1b en la frontera admite lo mismo", 1 - 0.2 / 2, 0.9, 1e-15);
/* Y se comprueba con el módulo: en Pr/Pc = 0,2 y ΣM/Mc = 0,9 el valor es 1
   exacto por las dos ramas. */
cerca("el módulo da exactamente 1,0 en ese punto",
  h1({ Pr_kgf: 20000, Mrx_kgfcm: 1500000 * 0.9 }).valor, 1.0, 1e-12);
/* SI EL 8/9 ESTUVIERA REDONDEADO A 0,89 la envolvente saltaría un 0,1 %.
   Contraste deliberado con el 4,71, el 1,95 y el 1,51 de E, F y G. */
cerca("con 0,89 en vez de 8/9 saltaría un 0,1 %",
  (0.2 + 0.89 * 0.9) / (0.2 + (8 / 9) * 0.9), 1.001, 1e-4);
cierto("así que aquí el AISC NO redondeó, y por eso empalma",
  Math.abs(A.H1_COEF - 8 / 9) < 1e-15);

/* ---------- la divergencia del φc, propagada · fila H.phi ----------- */
/* Las ecuaciones son idénticas en las dos normas. Lo que cambia es el φc que
   hay DENTRO de Pc, y la E.090 §8.1.1.2 lo dice textualmente. */
cierto("con el φc de la E.090 el ratio empeora", alta.valor_E090 > alta.valor);
cerca("el término axial sube en la razón 0,90/0,85",
  (alta.valor_E090 - (8 / 9) * 0.4) / (alta.valor - (8 / 9) * 0.4), 0.90 / 0.85, 1e-9);
cierto("la decisión viaja escrita", /AISC/.test(alta.notaPhi));
/* Un elemento puede cumplir con el AISC y no con la E.090: se busca uno. */
const filo = h1({ Pr_kgf: 62000, Mrx_kgfcm: 600000 });
cierto("y hay casos que cumplen con el AISC y no con la E.090",
  filo.cumple === true && filo.valor_E090 > 1);

/* ---------- H1.2 · el bono de Cb por tracción · fila H.Cb.bono ------ */
/* PREMIO QUE CASI NADIE USA: la tracción axial estabiliza contra el pandeo
   lateral-torsional. Es la brida inferior del tijeral bajo gravedad. */
const bono = A.bonoCbTraccion({ dobleSimetria: true, Pr_kgf: 20000,
  Iy_cm4: 720, Lb_cm: 300 });
cerca("Pey = π²·E·Iy/Lb²", bono.Pey_kgf,
  Math.PI * Math.PI * A.E_ACERO * 720 / (300 * 300), 1e-9);
cerca("el factor es √(1 + α·Pr/Pey)", bono.factor,
  Math.sqrt(1 + 1.0 * 20000 / bono.Pey_kgf), 1e-12);
cierto("y siempre mejora, nunca empeora", bono.factor > 1);
comp("α vale 1,0 en LRFD", bono.alfa, 1.0);
comp("y 1,6 en ASD",
  A.bonoCbTraccion({ dobleSimetria: true, Pr_kgf: 20000, Iy_cm4: 720,
    Lb_cm: 300, metodo: "ASD" }).alfa, 1.6);
/* Con más tracción, más bono; con la barra más larga, Pey baja y el bono sube. */
cierto("más tracción da más bono",
  A.bonoCbTraccion({ dobleSimetria: true, Pr_kgf: 40000, Iy_cm4: 720,
    Lb_cm: 300 }).factor > bono.factor);
cierto("y una barra más larga también, porque Pey baja",
  A.bonoCbTraccion({ dobleSimetria: true, Pr_kgf: 20000, Iy_cm4: 720,
    Lb_cm: 600 }).factor > bono.factor);
/* SOLO PARA DOBLE SIMETRÍA. */
lanza("sin doble simetría el bono no aplica y PARA",
  () => A.bonoCbTraccion({ Pr_kgf: 20000, Iy_cm4: 720, Lb_cm: 300 }), "doble simetr");
lanza("y con compresión en vez de tracción tampoco",
  () => A.bonoCbTraccion({ dobleSimetria: true, Pr_kgf: 0, Iy_cm4: 720, Lb_cm: 300 }),
  "TRACCI");

/* ---------- H1.3 · separar en el plano y fuera del plano ------------ */
/* Permitido solo con Lcz ≤ Lcy, Mry/Mcy < 0,05 y perfil laminado compacto de
   doble simetría. La E.090 NO lo trae: es opción, no defecto. */
comp("el tope de Mry/Mcy es 0,05", A.H1_3_MRY_MAX, 0.05);
const sep = A.puedeSepararH13({ Lcz_cm: 300, Lcy_cm: 400, Mry_kgfcm: 1000,
  Mcy_kgfcm: 400000, laminadoCompactoDobleSimetria: true });
cierto("con las tres condiciones, se puede separar", sep.puede === true);
cerca("y Mry/Mcy sale 0,0025", sep.razonMry, 0.0025, 1e-9);
const noSep = A.puedeSepararH13({ Lcz_cm: 500, Lcy_cm: 400, Mry_kgfcm: 40000,
  Mcy_kgfcm: 400000, laminadoCompactoDobleSimetria: false });
cierto("si falla alguna, no se puede", noSep.puede === false);
comp("y se listan las tres razones", noSep.razones.length, 3);
cierto("una de ellas es el Lcz ≤ Lcy", /Lcz/.test(noSep.razones.join(" ")));
/* LA E.090 NO TRAE H1.3 · fila H.1_3.div */
cierto("y se avisa de que la E.090 no lo tiene", /E\.090/.test(sep.nota));

/* H1-3 · la ecuación de fuera del plano */
const fp = A.fueraDelPlanoH13({ origen: "segundo-orden", Pr_kgf: 30000,
  Pcy_kgf: 80000, Mrx_kgfcm: 600000, McxCb1_kgfcm: 1200000, Cb: 1.3 });
const pp = 30000 / 80000, mm = 600000 / (1.3 * 1200000);
cerca("valor = (Pr/Pcy)(1,5 − 0,5·Pr/Pcy) + (Mrx/(Cb·Mcx))²",
  fp.valor, pp * (1.5 - 0.5 * pp) + mm * mm, 1e-12);
cierto("y el término de flexión es CUADRÁTICO, no lineal",
  Math.abs(fp.terminoFlexion - mm * mm) < 1e-12);
/* Mcx se pasa CON Cb = 1,0 y el Cb entra aparte: si se pasa un Mcx que ya lo
   lleva, se aplica dos veces. */
lanza("sin el Mcx calculado con Cb = 1 PARA, y explica por qué",
  () => A.fueraDelPlanoH13({ origen: "segundo-orden", Pr_kgf: 1, Pcy_kgf: 1,
    Mrx_kgfcm: 1, Cb: 1.3 }), "dos veces");
/* Cb·Mcx PUEDE superar φb·Mpx y es correcto: la fluencia la captura H1-1a/b. */
cerca("Cb·Mcx se expone", fp.CbMcx_kgfcm, 1.3 * 1200000, 1e-9);
cierto("y la nota explica que puede superar φb·Mpx", /Mpx/.test(fp.nota));
/* La guarda del segundo orden también vale aquí. */
lanza("H1-3 con fuerzas de primer orden PARA",
  () => A.fueraDelPlanoH13({ origen: "primer-orden", Pr_kgf: 1, Pcy_kgf: 1,
    Mrx_kgfcm: 1, McxCb1_kgfcm: 1, Cb: 1 }), "PRIMER ORDEN");

/* ---------- H2 · por ESFUERZOS y CON SIGNO -------------------------- */
/* Al contrario que H1: aquí el signo importa y los términos se suman o se
   restan. Y se usa el módulo S del punto concreto que se analiza. */
const h2 = A.interaccionH2({ origen: "segundo-orden", signosRevisados: true,
  fra_kgcm2: 400, Fca_kgcm2: 1800,
  frbw_kgcm2: 600, Fcbw_kgcm2: 2100,
  frbz_kgcm2: -100, Fcbz_kgcm2: 2100 });
cerca("valor = fra/Fca + frbw/Fcbw + frbz/Fcbz",
  h2.valor, 400 / 1800 + 600 / 2100 - 100 / 2100, 1e-12);
cierto("un término negativo RESTA, no se toma en positivo", h2.terminoZ < 0);
/* Ésa es la diferencia con H1, donde todo va en positivo. */
cierto("al contrario que en H1", h1({ Pr_kgf: 30000, Mrx_kgfcm: -600000 }).sumaMomentos > 0);
cierto("y la nota lo dice", /signo/.test(h2.nota));
lanza("sin revisar los signos en el punto crítico PARA",
  () => A.interaccionH2({ origen: "segundo-orden", fra_kgcm2: 400, Fca_kgcm2: 1800 }),
  "SIGNO");
lanza("y sin declarar el segundo orden tampoco",
  () => A.interaccionH2({ signosRevisados: true, fra_kgcm2: 400, Fca_kgcm2: 1800 }),
  "Chapter C");
lanza("con frbw pero sin Fcbw PARA",
  () => A.interaccionH2({ origen: "segundo-orden", signosRevisados: true,
    fra_kgcm2: 400, Fca_kgcm2: 1800, frbw_kgcm2: 600 }), "Fcbw_kgcm2");

/* ---------- H2 SE PUEDE USAR SIEMPRE · comprobación cruzada --------- */
/* «It is permitted to use the provisions of this section for any shape in
   lieu of the provisions of Section H1.» Dos caminos independientes para el
   mismo elemento: sirve de control del propio complemento. Con una sección
   de doble simetría, esfuerzos uniformes y los mismos cocientes, H2 tiene
   que dar la SUMA SIMPLE de los términos, que es la H1-1b sin el medio en el
   axial — o sea, H2 es más severa en el término axial y menos en el de
   flexión. Lo que se comprueba aquí es que los dos caminos existen y son
   coherentes en magnitud. */
const cruzado = A.interaccionH2({ origen: "segundo-orden", signosRevisados: true,
  fra_kgcm2: 0.1 * 1800, Fca_kgcm2: 1800,
  frbw_kgcm2: 0.4 * 2100, Fcbw_kgcm2: 2100 });
cerca("H2 con los mismos cocientes da 0,1 + 0,4", cruzado.valor, 0.5, 1e-12);
const porH1 = h1({ Pr_kgf: 10000, Mrx_kgfcm: 600000 });
cerca("y la H1-1b da 0,05 + 0,4", porH1.valor, 0.45, 1e-12);
cierto("H2 es más severa en el término axial, que es lo esperable",
  cruzado.valor > porH1.valor);
cierto("y las dos rutas están declaradas como intercambiables",
  cruzado.artOpcion.length > 0);

/* ---------- las citas viajan ---------------------------------------- */
cierto("cada resultado trae su artículo del AISC",
  alta.art.indexOf("H1") >= 0 && h2.art.indexOf("H2") >= 0);

fin();
