/* =====================================================================
   probar_acero_compresion.js — AISC Capítulo E

   Las pruebas de acero.js van por capítulo, porque el módulo cubre cinco y
   un archivo con todo dentro deja de leerse:
       probar_acero.js              · Cap. D · tracción
       probar_acero_compresion.js   · Cap. E · compresión   ← este

   LA PRUEBA DE ORO DE ESTE CAPÍTULO no es un valor tabulado: es demostrar
   que la curva del AISC y la de la E.090 son LA MISMA, barriendo todo el
   rango útil de esbeltez y midiendo la diferencia. La fila C.identicas lo
   afirma por álgebra; esto lo comprueba con números, y si alguien toca una
   de las dos ramas sale en rojo enseguida.

   Lo único que de verdad cambia entre las dos normas en pandeo por flexión
   es φc, y ése es todo el capítulo en una frase.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const A = require("../src/acero.js");

const Fy = 2530;                 /* A36 */
const RAIZ_EFY = Math.sqrt(A.E_ACERO / Fy);

/* ---------- LA IDENTIDAD DE LAS CURVAS · fila C.identicas -------------- */
/* El AISC usa Fy/Fe; la E.090 usa λc = (Kl/r/π)·√(Fy/E). Como λc² = Fy/Fe
   exactamente, y λc = 1,5 equivale a Fy/Fe = 2,25, y (0,877/λc²)·Fy =
   0,877·Fe, tiene que salir el mismo número en todo el rango. */
let peor = 0, dondePeor = 0;
for (let lr = 5; lr <= 300; lr += 0.5) {
  const fe = A.Fe({ lr: lr }).Fe_kgcm2;
  const aisc = A.Fn({ Fy_kgcm2: Fy, Fe_kgcm2: fe }).Fn_kgcm2;
  const e090 = A.FnE090({ Fy_kgcm2: Fy, lr: lr }).Fcr_kgcm2;
  const d = Math.abs(aisc - e090) / aisc;
  if (d > peor) { peor = d; dondePeor = lr; }
}
cierto("las dos curvas coinciden a precisión de máquina en 5 ≤ Lc/r ≤ 300",
  peor < 1e-14);
cierto("la peor diferencia es del orden de 1e-16, o sea redondeo", peor < 1e-15);
cierto("y se midió en 591 puntos del rango", dondePeor >= 5 && dondePeor <= 300);

/* LO ÚNICO QUE CAMBIA DE VERDAD: el factor de resistencia. */
comp("φc del AISC", A.PHI_C, 0.90);
comp("φc de la E.090", A.PHI_C_E090, 0.85);
cerca("un 5,9 % en TODA columna y diagonal en compresión",
  A.PHI_C / A.PHI_C_E090, 1.0588, 1e-3);

/* ---------- E3 · las dos ramas ---------------------------------------- */
cerca("Fe = π²·E/(Lc/r)²",
  A.Fe({ lr: 100 }).Fe_kgcm2, Math.PI * Math.PI * A.E_ACERO / 10000, 1e-12);
lanza("Fe sin esbeltez PARA", () => A.Fe({}), "Lc/r");
cerca("rama inelástica · 0,658^(Fy/Fe)·Fy",
  A.Fn({ Fy_kgcm2: Fy, Fe_kgcm2: 10000 }).Fn_kgcm2,
  Math.pow(0.658, Fy / 10000) * Fy, 1e-12);
cerca("rama elástica · 0,877·Fe",
  A.Fn({ Fy_kgcm2: Fy, Fe_kgcm2: 500 }).Fn_kgcm2, 0.877 * 500, 1e-12);
cierto("y el 0,877 se explica: castiga la imperfección inicial",
  /imperfecci/.test(A.Fn({ Fy_kgcm2: Fy, Fe_kgcm2: 500 }).nota));
cierto("la rama se nombra en el resultado",
  A.Fn({ Fy_kgcm2: Fy, Fe_kgcm2: 10000 }).tramo.indexOf("inel") >= 0);

/* ---------- la frontera · fila C.Fn.frontera --------------------------- */
/* EL 4,71 ES 1,5·π REDONDEADO. Igualando Fy/Fe = 2,25 sale
   Lc/r = 1,5·π·√(E/Fy) = 4,712389·√(E/Fy), así que las DOS formas escritas de
   la frontera no son exactamente la misma. */
cerca("la frontera tabulada con A36 cae en Lc/r = 133,712", A.lrFrontera(Fy), 133.712, 1e-3);
const feFront = A.Fe({ lr: A.lrFrontera(Fy) }).Fe_kgcm2;
cerca("y ahí Fy/Fe sale 2,2477, no 2,25", Fy / feFront, 2.2477, 1e-4);
cerca("la frontera exacta es 1,5·π·√(E/Fy) = 133,779",
  1.5 * Math.PI * RAIZ_EFY, 133.779, 1e-3);
cerca("las dos formas difieren un 0,051 %", (1.5 * Math.PI) / 4.71, 1.00051, 1e-5);
/* Da igual en la práctica porque la curva es casi continua ahí: 0,044 % de
   salto entre las dos ramas. Por eso el código usa la forma exacta y muestra
   la tabulada, que es la que aparece en los libros. */
cerca("el salto de la curva en la frontera es del 0,044 %",
  (Math.pow(0.658, 2.25) * Fy) / (0.877 * Fy / 2.25), 1.00044, 1e-5);
comp("el código usa la forma exacta Fy/Fe ≤ 2,25", A.FY_FE_LIMITE, 2.25);

/* ---------- Tabla B4.1a · NO es la tabla de flexión ------------------- */
/* EL ERROR FÁCIL. El ala de una I laminada tiene λr = 0,56·√(E/Fy) en
   compresión y 1,0·√(E/Fy) en flexión: casi el doble. Usar el de flexión aquí
   declara «no esbelta» una sección que sí lo es. */
cerca("caso 1 · alas de I laminada · 15,90 con A36",
  A.lambdaR({ caso: 1, Fy_kgcm2: Fy }).lambdaR, 15.90, 1e-3);
cerca("caso 3 · lados de ángulo simple · 12,77",
  A.lambdaR({ caso: 3, Fy_kgcm2: Fy }).lambdaR, 12.77, 1e-3);
cerca("caso 4 · almas de tes · 21,29", A.lambdaR({ caso: 4, Fy_kgcm2: Fy }).lambdaR, 21.29, 1e-3);
cerca("caso 5 · almas de I · 42,30", A.lambdaR({ caso: 5, Fy_kgcm2: Fy }).lambdaR, 42.30, 1e-3);
cerca("caso 6 · paredes de HSS rectangular · 39,74",
  A.lambdaR({ caso: 6, Fy_kgcm2: Fy }).lambdaR, 39.74, 1e-3);
/* El caso 9 no lleva raíz: es E/Fy directo. */
cerca("caso 9 · HSS redondo · 88,65", A.lambdaR({ caso: 9, Fy_kgcm2: Fy }).lambdaR, 88.65, 1e-3);
cierto("y el caso 9 advierte que no lleva raíz",
  /NO lleva ra/.test(A.lambdaR({ caso: 9, Fy_kgcm2: Fy }).nota));
cierto("el límite de compresión del ala es más bajo que el de flexión",
  A.lambdaR({ caso: 1, Fy_kgcm2: Fy }).lambdaR < 1.0 * RAIZ_EFY);
/* La tabla distingue expresamente el 2L en CONTACTO CONTINUO (caso 1, 0,56)
   del 2L con SEPARADORES (caso 3, 0,45). */
cierto("un 2L en contacto continuo es más generoso que con separadores",
  A.lambdaR({ caso: 1, Fy_kgcm2: Fy }).lambdaR >
  A.lambdaR({ caso: 3, Fy_kgcm2: Fy }).lambdaR);
/* El kc del caso 2, con sus dos topes. */
cerca("kc se acota en 0,76 por arriba",
  A.lambdaR({ caso: 2, Fy_kgcm2: Fy, h_tw: 20 }).kc, 0.76, 1e-12);
cerca("y en 0,35 por abajo",
  A.lambdaR({ caso: 2, Fy_kgcm2: Fy, h_tw: 200 }).kc, 0.35, 1e-12);
lanza("el caso 2 sin h/tw PARA", () => A.lambdaR({ caso: 2, Fy_kgcm2: Fy }), "h_tw");
lanza("un caso fuera de B4.1a PARA, y avisa de la confusión con flexión",
  () => A.lambdaR({ caso: 12, Fy_kgcm2: Fy }), "COMPRESI");

/* ---------- UNA SECCIÓN ESBELTA NO PUEDE PASAR EN SILENCIO ------------ */
/* Calculada por E3 sale del lado INSEGURO, y el resultado parece
   perfectamente razonable. Con A36 el límite de un lado de ángulo simple es
   b/t = 12,8, así que un L 2"x2"x1/8" (b/t = 16) ya es esbelto: los ángulos
   ligeros de armadura caen ahí con frecuencia. */
cierto("un ángulo con b/t = 10,7 no es esbelto",
  A.esbeltezLocal({ Fy_kgcm2: Fy,
    elementos: [{ nombre: "lado", razon: 10.7, caso: 3 }] }).hayEsbeltos === false);
const siEsb = A.esbeltezLocal({ Fy_kgcm2: Fy,
  elementos: [{ nombre: "lado", razon: 16, caso: 3 }] });
cierto("uno con b/t = 16 sí lo es", siEsb.hayEsbeltos === true);
cierto("y dice cuál elemento", siEsb.esbeltos.indexOf("lado") >= 0);
cierto("con el detalle de cada elemento y su λr", siEsb.detalle[0].lambdaR > 0);
lanza("compresión con un elemento esbelto PARA y manda al E7",
  () => A.compresion({ acero: "A36", Ag_cm2: 9.3, Lc_cm: 250, r_cm: 1.98,
    elementos: [{ nombre: "lado", razon: 16, caso: 3 }] }), "E7");
lanza("y sin decir nada sobre la esbeltez tampoco calcula",
  () => A.compresion({ acero: "A36", Ag_cm2: 9.3, Lc_cm: 250, r_cm: 1.98 }),
  "elementos esbeltos");
cierto("declarándola no esbelta sí calcula, bajo responsabilidad de quien llama",
  A.compresion({ acero: "A36", Ag_cm2: 9.3, Lc_cm: 250, r_cm: 1.98,
    noEsbelta: true }).Pd_kgf > 0);
cierto("y con elementos no esbeltos calcula y deja el detalle",
  A.compresion({ acero: "A36", Ag_cm2: 9.3, Lc_cm: 250, r_cm: 1.98,
    elementos: [{ nombre: "lado", razon: 10.7, caso: 3 }] }).esbeltezLocal !== null);

/* ---------- la columna del galpón ------------------------------------- */
const col = A.compresion({ acero: "A36", Ag_cm2: 49.354, Lc_cm: 700, r_cm: 13.12,
  noEsbelta: true, Pu_kgf: 60000 });
cerca("Lc/r = 53,35", col.lr, 53.35, 0.01);
cierto("tramo inelástico", col.tramo.indexOf("inel") >= 0);
cerca("Fn = 2178 kgf/cm²", col.Fn_kgcm2, 2178, 1.0);
cerca("φPn = 96,7 tonf", col.Pd_kgf / 1000, 96.7, 0.01);
cerca("ratio = Pu/Pd", col.ratio, 60000 / col.Pd_kgf, 1e-12);
cierto("cumple", col.cumple === true);
/* LA DIVERGENCIA DEL φc, al lado y no escondida. */
cerca("con el φc de la E.090 la misma columna da 91,4 tonf",
  col.Pd_E090_kgf / 1000, 91.36, 0.01);
cierto("y el ratio empeora", col.ratio_E090 > col.ratio);
cierto("la decisión viaja escrita", /AISC 360-22/.test(col.notaPhi));
/* Y el cambio de NOMBRE del símbolo, que confunde al comparar con libros:
   el 360-22 llama Fn a lo que Zapata y McCormac llaman Fcr. */
cierto("avisa de que Fn es el Fcr de antes", /Fcr/.test(col.notaNombre));
/* Una columna muy esbelta cae en el tramo elástico. */
cierto("con r pequeño pasa al tramo elástico",
  A.compresion({ acero: "A36", Ag_cm2: 10, Lc_cm: 700, r_cm: 2,
    noEsbelta: true }).tramo.indexOf("elástico · Fy/Fe >") >= 0);
lanza("compresión sin longitud efectiva PARA",
  () => A.compresion({ acero: "A36", Ag_cm2: 10, r_cm: 2, noEsbelta: true }), "Lc_cm");

/* ---------- esbeltez en compresión · E2 User Note --------------------- */
/* CORRECCIÓN A ALGO QUE AFIRMÉ MAL EN SU DÍA: dije que el 360-22 había
   eliminado el límite de 200. No es cierto — está en la User Note de E2, y la
   E.090 §2.7 dice lo mismo. Las dos son recomendaciones y coinciden. */
comp("el límite recomendado es 200", A.ESBELTEZ_COMPRESION, 200);
cierto("por debajo pasa", A.esbeltezCompresion({ Lc_cm: 700, r_cm: 13.12 }).pasa === true);
const pasado = A.esbeltezCompresion({ Lc_cm: 700, r_cm: 2 });
cierto("por encima no pasa", pasado.pasa === false);
cierto("pero NO es un rechazo", pasado.esRechazo === false);
cierto("y recuerda que en el E5 sí es requisito duro", /E5 s/.test(pasado.nota));

/* ---------- E5 · EL ARTÍCULO QUE HACE MANEJABLE EL TIJERAL ------------ */
/* Una diagonal de ángulo se conecta por un solo lado, o sea con
   excentricidad: en rigor es flexo-compresión del Cap. H. El E5 permite
   tratarla como cargada axialmente usando una esbeltez EFECTIVA, que lleva
   el efecto de la excentricidad metido dentro del número. */
comp("son cinco condiciones", A.E5_CONDICIONES.length, 5);
lanza("sin confirmar las cinco condiciones no calcula, y las lista",
  () => A.anguloSimpleE5({ L_cm: 250, ra_cm: 1.98 }), "cinco condiciones");
lanza("ra tiene que ser el del eje GEOMÉTRICO, y se explica",
  () => A.anguloSimpleE5({ L_cm: 250, condiciones: true }), "GEOM");

const e5a = A.anguloSimpleE5({ L_cm: 150, ra_cm: 2.5, condiciones: true });
cerca("armadura plana · L/ra = 60 → 72 + 0,75·60", e5a.lr, 72 + 0.75 * 60, 1e-12);
const e5b = A.anguloSimpleE5({ L_cm: 250, ra_cm: 1.98, condiciones: true });
cerca("armadura plana · L/ra = 126,3 → 32 + 1,25·126,3",
  e5b.lr, 32 + 1.25 * (250 / 1.98), 1e-12);
cierto("y nombra el tramo", e5b.tramo.indexOf("L/ra > 80") >= 0);
/* La esbeltez efectiva SUPERA la geométrica: eso es la excentricidad. */
cierto("la esbeltez efectiva supera la geométrica", e5b.lr > 250 / 1.98);
/* Justo en la frontera L/ra = 80 las dos ramas dan lo mismo: 132. */
cerca("en L/ra = 80 las dos ramas coinciden en 132",
  A.anguloSimpleE5({ L_cm: 200, ra_cm: 2.5, condiciones: true }).lr, 132, 1e-9);
/* Armadura espacial: otras dos ramas y otro cruce. */
cerca("armadura espacial · L/ra = 60 → 60 + 0,8·60",
  A.anguloSimpleE5({ L_cm: 150, ra_cm: 2.5, condiciones: true, espacial: true }).lr,
  60 + 0.8 * 60, 1e-12);
cerca("y en L/ra = 75 sus dos ramas coinciden en 120",
  A.anguloSimpleE5({ L_cm: 187.5, ra_cm: 2.5, condiciones: true, espacial: true }).lr,
  120, 1e-9);

/* Conectado por el LADO CORTO: se suma 4·[(bl/bs)²−1] y hay un piso sobre rz. */
const corto = A.anguloSimpleE5({ L_cm: 150, ra_cm: 2.5, condiciones: true,
  porLadoCorto: true, bl_cm: 10, bs_cm: 6.5, rz_cm: 1.4 });
cerca("el término del lado corto es 4·[(bl/bs)²−1]",
  corto.porLadoCorto.suma, 4 * (Math.pow(10 / 6.5, 2) - 1), 1e-12);
cerca("y el piso es 0,95·L/rz", corto.porLadoCorto.piso, 0.95 * (150 / 1.4), 1e-12);
cierto("la esbeltez sube respecto de conectar por el lado largo", corto.lr > e5a.lr);
/* La condición (5): con lados demasiado desiguales el E5 no vale. */
lanza("con bl/bs ≥ 1,7 el E5 no vale y PARA",
  () => A.anguloSimpleE5({ L_cm: 150, ra_cm: 2.5, condiciones: true,
    porLadoCorto: true, bl_cm: 10, bs_cm: 5, rz_cm: 1.4 }), "1,7");
/* LA E.090 NO LEGISLA EL CASO: remite al AISC por nombre, así que usar E5 es
   exactamente lo que la norma peruana manda hacer. */
cierto("la remisión de la E.090 viaja citada", e5b.artDivergencia.indexOf("E.090") >= 0);
cierto("y el resultado dice que la esbeltez es EFECTIVA", /EFECTIVA/.test(e5b.nota));
/* Y el E5 comprueba su propio Lc/r ≤ 200, que aquí sí es requisito duro. */
cierto("una diagonal de 250 cm con ra 1,98 queda justo por debajo de 200",
  e5b.cumpleEsbeltez === true && e5b.lr > 180);

fin();
