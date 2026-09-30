/* =====================================================================
   probar_acero_flexion.js — AISC Capítulo F

       probar_acero.js              · Cap. D · tracción
       probar_acero_compresion.js   · E3 y E5
       probar_acero_armados.js      · E4, E6 y E7
       probar_acero_flexion.js      · Cap. F   ← este

   DOS VERIFICACIONES FUERTES, y la primera no es autoconsistencia:

     1) CONTRASTE CONTRA EL MANUAL DEL AISC. La Tabla 3-2 tabula Lp, Lr y rts
        para cada perfil W. Para W12X26 con Fy = 50 ksi da 5,33 ft, 14,90 ft
        y 1,75 in, y los tres salen exactos. Valida de un golpe rts (F2-7),
        Lp (F2-5), Lr (F2-6) con sus coeficientes, la conversión de unidades
        y las propiedades del catálogo. Es la prueba más fuerte del capítulo.

     2) LAS DOS RAMAS DEL LTB COINCIDEN EN Lb = Lr, porque Lr se DEFINE como
        el punto donde Fcr vale 0,7·Fy. Y aquí sale algo que conviene saber:
        con los coeficientes tabulados (1,95 y 6,76) la continuidad falla en
        0,13 %, y con los exactos derivados cuadra en 1e-16. O sea que ese
        salto es REDONDEO DE LA NORMA y no un error del código. Sin esta
        prueba, el día que alguien mida la discontinuidad la buscaría donde
        no está.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const A = require("../src/acero.js");
const P = require("../src/perfiles.js");

const Fy = 2530, FY50 = 3515;
const W = P.busca("W12X26");
const HO = W.d_cm - W.tf_cm;

/* ---------- φb coincide, al contrario que en compresión ---------------- */
comp("φb = 0,90", A.PHI_B, 0.90);
cierto("y aquí las dos normas SÍ coinciden, al contrario que en compresión",
  A.PHI_B === 0.90 && A.PHI_C !== A.PHI_C_E090);

/* ---------- CONTRASTE CONTRA EL MANUAL DEL AISC ----------------------- */
/* Tabla 3-2, W12X26 con Fy = 50 ksi. OJO AL Fy: el Manual tabula con 50 ksi
   y nuestro caso base es A36; comparar con A36 no cuadra y parece un error. */
const rt = A.rts({ Iy_cm4: W.Iy_cm4, Cw_cm6: W.Cw_cm6, Sx_cm3: W.Sx_cm3 }).rts_cm;
cerca("W12X26 · rts = 1,75 in del Manual", rt / 2.54, 1.75, 3e-3);
const lp50 = A.Lp({ ry_cm: W.ry_cm, Fy_kgcm2: FY50 }).Lp_cm;
cerca("W12X26 con 50 ksi · Lp = 5,33 ft del Manual", lp50 / 30.48, 5.33, 2e-3);
const lr50 = A.Lr({ rts_cm: rt, Fy_kgcm2: FY50, J_cm4: W.J_cm4, c: 1,
  Sx_cm3: W.Sx_cm3, ho_cm: HO }).Lr_cm;
cerca("W12X26 con 50 ksi · Lr = 14,90 ft del Manual", lr50 / 30.48, 14.90, 2e-3);

/* ---------- Lp · coincide con la E.090 -------------------------------- */
const lp = A.Lp({ ry_cm: W.ry_cm, Fy_kgcm2: Fy }).Lp_cm;
cerca("Lp = 1,76·ry·√(E/Fy)", lp, 1.76 * W.ry_cm * Math.sqrt(A.E_ACERO / Fy), 1e-12);
/* La E.090 lo escribe 788·ry/√Fyf con Fy en MPa: es la MISMA expresión con E
   ya sustituido. Se comprueba convirtiendo. */
const FyMPa = Fy * 0.0980665;
cerca("y coincide con el 788·ry/√Fy de la E.090, con Fy en MPa",
  lp, 787.1 * W.ry_cm / Math.sqrt(FyMPa), 2e-3);
cierto("y el resultado lo dice", /E\.090/.test(A.Lp({ ry_cm: 4, Fy_kgcm2: Fy }).nota));
lanza("Lp sin ry PARA", () => A.Lp({ Fy_kgcm2: Fy }), "ry_cm");

/* ---------- LA CONTINUIDAD EN Lb = Lr, y por qué no es exacta --------- */
/* Invirtiendo la F2-4 en Fcr = 0,7·Fy salen los coeficientes exactos:
   √(π⁴·0,078/2) = 1,949091  y  4/(π⁴·0,078²) = 6,7495.
   La norma imprime 1,95 y 6,76. */
const C1_EXACTO = Math.sqrt(Math.pow(Math.PI, 4) * 0.078 / 2);
const C2_EXACTO = 4 / (Math.pow(Math.PI, 4) * 0.078 * 0.078);
cerca("el primer coeficiente exacto es 1,949091", C1_EXACTO, 1.949091, 1e-6);
cerca("y el de dentro de la raíz, 6,7495", C2_EXACTO, 6.7495, 1e-4);
cerca("la norma redondea el primero un 0,047 %", 1.95 / C1_EXACTO, 1.00047, 1e-5);
cerca("y el segundo un 0,156 %", 6.76 / C2_EXACTO, 1.00156, 1e-5);

function FcrEnLr(w, lrValor) {
  const rtw = A.rts({ Iy_cm4: w.Iy_cm4, Cw_cm6: w.Cw_cm6, Sx_cm3: w.Sx_cm3 }).rts_cm;
  const ho = w.d_cm - w.tf_cm;
  const x = lrValor / rtw;
  return Math.PI * Math.PI * A.E_ACERO / (x * x) *
    Math.sqrt(1 + 0.078 * (w.J_cm4 / (w.Sx_cm3 * ho)) * x * x);
}
function LrExacto(w) {
  const rtw = A.rts({ Iy_cm4: w.Iy_cm4, Cw_cm6: w.Cw_cm6, Sx_cm3: w.Sx_cm3 }).rts_cm;
  const ho = w.d_cm - w.tf_cm;
  const B = w.J_cm4 / (w.Sx_cm3 * ho), mm = 0.7 * Fy / A.E_ACERO;
  return C1_EXACTO * rtw * (1 / mm) * Math.sqrt(B + Math.sqrt(B * B + C2_EXACTO * mm * mm));
}
let peorTab = 0, peorExa = 0;
for (const nom of ["W12X26", "W18X50", "W24X84", "W8X31", "W40X149"]) {
  const w = P.busca(nom), ho = w.d_cm - w.tf_cm;
  const rtw = A.rts({ Iy_cm4: w.Iy_cm4, Cw_cm6: w.Cw_cm6, Sx_cm3: w.Sx_cm3 }).rts_cm;
  const lrTab = A.Lr({ rts_cm: rtw, Fy_kgcm2: Fy, J_cm4: w.J_cm4, c: 1,
    Sx_cm3: w.Sx_cm3, ho_cm: ho }).Lr_cm;
  peorTab = Math.max(peorTab, Math.abs(FcrEnLr(w, lrTab) - 0.7 * Fy) / (0.7 * Fy));
  peorExa = Math.max(peorExa, Math.abs(FcrEnLr(w, LrExacto(w)) - 0.7 * Fy) / (0.7 * Fy));
}
cierto("con los coeficientes TABULADOS la continuidad falla en ~1,3e-3",
  peorTab > 5e-4 && peorTab < 3e-3);
cierto("con los EXACTOS cuadra a precisión de máquina", peorExa < 1e-14);
/* Y ÉSA ES LA CONCLUSIÓN QUE VALE: el salto del 0,13 % en Lr es redondeo de
   la norma, no un error del código. El código usa los tabulados a propósito,
   porque son los que imprime la norma y los que usará cualquier revisor. */
cierto("el salto es redondeo de la norma, no del código", peorTab / peorExa > 1e10);

/* ---------- las tres zonas del LTB ------------------------------------ */
const lr = A.Lr({ rts_cm: rt, Fy_kgcm2: Fy, J_cm4: W.J_cm4, c: 1,
  Sx_cm3: W.Sx_cm3, ho_cm: HO }).Lr_cm;
const base = { acero: "A36", Zx_cm3: W.Zx_cm3, Sx_cm3: W.Sx_cm3,
  Lp_cm: lp, Lr_cm: lr, Cb: 1.0, rts_cm: rt, J_cm4: W.J_cm4, c: 1, ho_cm: HO };
function f2(Lb, extra) { return A.flexionF2(Object.assign({}, base, { Lb_cm: Lb }, extra)); }

const zona1 = f2(100);
cerca("Lb ≤ Lp · Mn = Mp = Fy·Zx", zona1.Mn_kgfcm, Fy * W.Zx_cm3, 1e-9);
cierto("y la zona se nombra", zona1.zona.indexOf("fluencia") >= 0);
comp("φb = 0,90 sobre Mn", zona1.Md_kgfcm, 0.90 * zona1.Mn_kgfcm);
/* EN Lb = Lp todavía se alcanza Mp: el límite es «≤», no «<». */
cerca("justo en Lp todavía da Mp", f2(lp).Mn_kgfcm, Fy * W.Zx_cm3, 1e-9);
/* La rama inelástica arranca EXACTAMENTE en Mp: continuidad en Lp. */
cerca("y la rama inelástica arranca en Mp · continuidad en Lp",
  f2(lp + 1e-6).Mn_kgfcm, Fy * W.Zx_cm3, 1e-6);

const zona2 = f2(250);
cierto("Lp < Lb ≤ Lr · zona inelástica", zona2.zona.indexOf("inel") >= 0);
cierto("y Mn queda por debajo de Mp", zona2.Mn_kgfcm < zona1.Mn_kgfcm);
/* La recta entre Mp en Lp y 0,7·Fy·Sx en Lr: se comprueba el punto medio. */
const medio = (lp + lr) / 2;
cerca("a mitad de camino, Mn es la media de Mp y 0,7·Fy·Sx",
  f2(medio).Mn_kgfcm, (Fy * W.Zx_cm3 + 0.7 * Fy * W.Sx_cm3) / 2, 1e-9);
/* En Lb = Lr la rama inelástica da exactamente 0,7·Fy·Sx. */
cerca("en Lr da 0,7·Fy·Sx", f2(lr).Mn_kgfcm, 0.7 * Fy * W.Sx_cm3, 1e-9);

const zona3 = f2(800);
cierto("Lb > Lr · zona elástica", zona3.zona.indexOf("elástico") >= 0);
cierto("y Mn sigue bajando", zona3.Mn_kgfcm < zona2.Mn_kgfcm);
/* La User Note permite tomar el término de la raíz igual a 1,0: eso deja el
   pandeo lateral puro sin el aporte de torsión, y es CONSERVADOR. */
cierto("tomar la raíz igual a 1,0 es conservador",
  f2(800, { raizUno: true }).Mn_kgfcm < zona3.Mn_kgfcm);
lanza("en la zona elástica sin los datos de torsión PARA, y ofrece la salida",
  () => A.flexionF2({ acero: "A36", Zx_cm3: W.Zx_cm3, Sx_cm3: W.Sx_cm3,
    Lb_cm: 800, Lp_cm: lp, Lr_cm: lr }), "raizUno");
/* Mn nunca pasa de Mp, en ninguna zona. */
for (const Lb of [50, 200, 300, 560, 700, 1200]) {
  cierto("Mn ≤ Mp en Lb = " + Lb, f2(Lb).Mn_kgfcm <= Fy * W.Zx_cm3 + 1e-6);
}
/* Cb amplifica pero el tope de Mp sigue mandando. */
cerca("Cb amplifica la zona inelástica", f2(250, { Cb: 1.3 }).Mn_kgfcm / zona2.Mn_kgfcm,
  Math.min(1.3, Fy * W.Zx_cm3 / zona2.Mn_kgfcm), 1e-9);
cerca("pero con Cb grande el tope es Mp", f2(250, { Cb: 3 }).Mn_kgfcm, Fy * W.Zx_cm3, 1e-9);

/* ---------- Cb · F1-1 ------------------------------------------------- */
/* IDÉNTICA en las dos normas. */
cerca("momento uniforme → Cb = 1,0",
  A.Cb({ Mmax_kgfcm: 100, MA_kgfcm: 100, MB_kgfcm: 100, MC_kgfcm: 100 }).Cb, 1.0, 1e-12);
/* Valores típicos de la User Note (fila F.Cb.tipicos): curvatura inversa con
   extremos iguales da 2,27 y con un extremo en cero da 1,67. Se reproducen con
   la distribución lineal correspondiente. */
cerca("curvatura inversa, extremos iguales → 2,27",
  A.Cb({ Mmax_kgfcm: 100, MA_kgfcm: 50, MB_kgfcm: 0, MC_kgfcm: 50 }).Cb, 2.273, 5e-3);
cerca("un extremo en cero, variación lineal → 1,67",
  A.Cb({ Mmax_kgfcm: 100, MA_kgfcm: 25, MB_kgfcm: 50, MC_kgfcm: 75 }).Cb, 1.667, 5e-3);
/* Voladizo · F1(c), y la E.090 dice lo mismo. */
comp("voladizo → Cb = 1,0", A.Cb({ voladizo: true }).Cb, 1.0);
cierto("y cita el artículo del voladizo",
  A.Cb({ voladizo: true }).art.indexOf("F1") >= 0 ||
  A.Cb({ voladizo: true }).art.indexOf("E.090") >= 0);
comp("un tramo sin momento da Cb = 1,0",
  A.Cb({ Mmax_kgfcm: 0, MA_kgfcm: 0, MB_kgfcm: 0, MC_kgfcm: 0 }).Cb, 1.0);
lanza("Cb sin los cuatro momentos PARA, y explica que son del tramo no arriostrado",
  () => A.Cb({ Mmax_kgfcm: 100 }), "ARRIOSTRADO");

/* ---------- la divergencia del tope de Mp · fila F.Mp.tope ------------ */
/* En EJE MAYOR el factor de forma Zx/Sx anda por 1,1-1,2, así que el tope de
   1,5·My de la E.090 rara vez actúa. */
cerca("Zx/Sx de un W12X26 es 1,114", zona1.factorForma, 1.114, 2e-3);
cierto("y el tope de la E.090 no actúa en eje mayor", zona1.topeE090Actua === false);
cierto("la decisión viaja escrita", /AISC/.test(zona1.notaTope));
/* Y la hipótesis de fondo, que sostiene todo el capítulo. */
cierto("recuerda que F1(b) supone los apoyos sin girar sobre su eje",
  /clip/.test(zona1.notaHipotesis));

/* ---------- F6 · eje menor · EL EJE DÉBIL DE LA CORREA --------------- */
comp("el tope de F6-1 es 1,6", A.TOPE_F6, 1.6);
const f6 = A.flexionF6({ acero: "A36", Zy_cm3: W.Zy_cm3, Sy_cm3: W.Sy_cm3 });
cerca("Mp = Fy·Zy", f6.Mp_kgfcm, Fy * W.Zy_cm3, 1e-9);
cerca("Zy/Sy de un W12X26 es 1,530", f6.factorForma, 1.530, 2e-3);
cierto("aquí no actúa el tope, por poco", f6.topeActua === false);
/* PERO SÍ ACTÚA EN 46 DE LOS 331 PERFILES I DEL CATÁLOGO, medido: los de ala
   ancha y gruesa. El máximo Zy/Sy del catálogo es 1,860, no 1,6. */
const conTope = P.activos("I").filter((p) => p.Zy_cm3 && p.Sy_cm3 &&
  p.Zy_cm3 / p.Sy_cm3 > 1.6);
cierto("46 perfiles I del catálogo pasan de 1,6", conTope.length === 46);
const peorForma = Math.max.apply(null, P.activos("I")
  .filter((p) => p.Zy_cm3 && p.Sy_cm3).map((p) => p.Zy_cm3 / p.Sy_cm3));
cerca("y el máximo Zy/Sy es 1,860", peorForma, 1.860, 2e-3);
const g = conTope[0];
const f6t = A.flexionF6({ acero: "A36", Zy_cm3: g.Zy_cm3, Sy_cm3: g.Sy_cm3 });
cierto("en uno de ellos el tope SÍ actúa", f6t.topeActua === true);
cerca("y Mn queda en 1,6·Fy·Sy", f6t.Mn_kgfcm, 1.6 * Fy * g.Sy_cm3, 1e-9);
cierto("y el estado lo dice", f6t.estado.indexOf("topada") >= 0);
/* NO HAY LTB EN EL EJE MENOR, y la razón es física. */
cierto("se declara que no hay pandeo lateral-torsional", /no hay pandeo lateral/.test(f6.notaSinLTB));
/* Pandeo local del ala, con el b que toca: en una I es la MITAD del ala. */
const f6l = A.flexionF6({ acero: "A36", Zy_cm3: W.Zy_cm3, Sy_cm3: W.Sy_cm3,
  b_cm: W.bf_cm / 2, tf_cm: W.tf_cm });
cierto("el ala de un W12X26 sale compacta en eje menor", f6l.local.clase === "compacta");
cerca("con λ = bf/(2·tf)", f6l.local.lambda, W.bf_cm / 2 / W.tf_cm, 1e-12);
/* Un ala muy esbelta pasa por F6-4. */
const f6e = A.flexionF6({ acero: "A36", Zy_cm3: 100, Sy_cm3: 70, b_cm: 20, tf_cm: 0.5 });
cierto("un ala esbelta baja Mn por F6-4", f6e.estado.indexOf("esbelta") >= 0);
cerca("con Fcr = 0,70·E/(b/tf)²", f6e.local.Fcr_kgcm2, 0.70 * A.E_ACERO / (40 * 40), 1e-12);

/* ---------- Tabla B4.1b · NO es la de compresión --------------------- */
/* En flexión hay TRES clases porque sí hay redistribución plástica; en
   compresión solo dos. Y los λr son más altos. */
const c10 = A.clasificaFlexion({ caso: 10, razon: 8, Fy_kgcm2: Fy });
cerca("caso 10 · λp = 0,38·√(E/Fy) = 10,79", c10.lambdaP, 10.79, 0.01);
cerca("y λr = 1,0·√(E/Fy) = 28,39", c10.lambdaR, 28.39, 0.01);
comp("con razón 8, compacta", c10.clase, "compacta");
comp("con razón 20, no compacta",
  A.clasificaFlexion({ caso: 10, razon: 20, Fy_kgcm2: Fy }).clase, "no compacta");
comp("con razón 35, esbelta",
  A.clasificaFlexion({ caso: 10, razon: 35, Fy_kgcm2: Fy }).clase, "esbelta");
/* EL λr DE FLEXIÓN ES MÁS ALTO QUE EL DE COMPRESIÓN, y confundirlos declara
   no esbelta una sección que sí lo es en compresión. */
cierto("el λr de flexión del ala supera el de compresión",
  c10.lambdaR > A.lambdaR({ caso: 1, Fy_kgcm2: Fy }).lambdaR);
cerca("28,39 contra 15,90: casi el doble",
  c10.lambdaR / A.lambdaR({ caso: 1, Fy_kgcm2: Fy }).lambdaR, 1.786, 0.01);
/* El alma de una I: λp = 106,7 y λr = 161,8 con A36. */
cerca("caso 15 · λp del alma = 106,7",
  A.clasificaFlexion({ caso: 15, razon: 50, Fy_kgcm2: Fy }).lambdaP, 106.75, 0.05);
cerca("y λr = 161,8",
  A.clasificaFlexion({ caso: 15, razon: 50, Fy_kgcm2: Fy }).lambdaR, 161.81, 0.05);
/* El caso 11, ala de I ARMADA, lleva kc y FL: es la serie VS/CVS. */
const c11 = A.clasificaFlexion({ caso: 11, razon: 10, Fy_kgcm2: Fy, h_tw: 100 });
cerca("caso 11 · kc = 4/√(h/tw) acotado", c11.kc, 0.40, 1e-12);
cerca("y λr = 0,95·√(kc·E/FL)",
  c11.lambdaR, 0.95 * Math.sqrt(0.40 * A.E_ACERO / (0.7 * Fy)), 1e-12);
lanza("el caso 11 sin h/tw PARA", () => A.clasificaFlexion({ caso: 11, razon: 10, Fy_kgcm2: Fy }), "h_tw");
lanza("un caso fuera de B4.1b PARA, y avisa de la confusión con compresión",
  () => A.clasificaFlexion({ caso: 99, razon: 10, Fy_kgcm2: Fy }), "FLEXI");

/* ---------- FL · MISMO SÍMBOLO, DEFINICIÓN DISTINTA ------------------ */
/* El AISC lo define como 0,7·Fy; la E.090 como Fyf − Fr, con Fr = 70 MPa
   laminado y 115 MPa soldado (fila F.FL). */
cerca("FL del AISC en sección simétrica = 0,7·Fy",
  A.FL({ Fy_kgcm2: Fy }).FL_kgcm2, 0.7 * Fy, 1e-12);
cerca("en sección muy asimétrica, FL = Fy·Sxt/Sxc",
  A.FL({ Fy_kgcm2: Fy, Sxt_cm3: 60, Sxc_cm3: 100 }).FL_kgcm2, Fy * 0.6, 1e-12);
cerca("con piso en 0,5·Fy",
  A.FL({ Fy_kgcm2: Fy, Sxt_cm3: 30, Sxc_cm3: 100 }).FL_kgcm2, 0.5 * Fy, 1e-12);
/* LA DIVERGENCIA MEDIDA: el laminado queda al 2,6 %, despreciable, pero el
   SOLDADO queda un 23,4 % por debajo. Y Lr crece al bajar FL, así que la
   E.090 da un Lr bastante mayor en la serie VS/CVS que usa Zapata. */
const flLam = A.FL_E090({ Fy_kgcm2: Fy, fabricacion: "laminado" }).FL_kgcm2;
const flSol = A.FL_E090({ Fy_kgcm2: Fy, fabricacion: "soldado" }).FL_kgcm2;
cerca("E.090 laminado queda un 2,6 % por encima del AISC", flLam / (0.7 * Fy), 1.026, 2e-3);
cerca("E.090 soldado queda un 23,4 % por debajo", flSol / (0.7 * Fy), 0.766, 2e-3);
cerca("o sea que el AISC es un 30,5 % mayor", (0.7 * Fy) / flSol, 1.305, 2e-3);
/* Y el efecto en Lr, calculado con la misma forma del AISC para aislar el
   efecto del FL: con el FL de la E.090 soldado, Lr sale mayor. */
const lrSol = A.Lr({ rts_cm: rt, Fy_kgcm2: Fy, J_cm4: W.J_cm4, c: 1,
  Sx_cm3: W.Sx_cm3, ho_cm: HO, FL_kgcm2: flSol }).Lr_cm;
cierto("con el FL de la E.090 soldado, Lr sale mayor", lrSol > lr);
cierto("y el resultado explica la dirección", /CRECE al bajar FL/.test(
  A.Lr({ rts_cm: rt, Fy_kgcm2: Fy, J_cm4: W.J_cm4, c: 1, Sx_cm3: W.Sx_cm3,
    ho_cm: HO }).nota));
lanza("FL_E090 sin decir la fabricación PARA",
  () => A.FL_E090({ Fy_kgcm2: Fy }), "laminado");

/* ---------- el coeficiente c · canales dentro de F2 ------------------ */
comp("una I de doble simetría tiene c = 1", A.coefC({ tipo: "I" }).c, 1);
const cc = A.coefC({ tipo: "canal", ho_cm: 20, Iy_cm4: 100, Cw_cm6: 5000 });
cerca("un canal tiene c = (ho/2)·√(Iy/Cw)", cc.c, 10 * Math.sqrt(100 / 5000), 1e-12);
cierto("y se recuerda que el 360-22 metió los canales en F2", /360-22/.test(cc.nota));
lanza("un tipo que no es I ni canal PARA", () => A.coefC({ tipo: "te" }), "canal");

/* ---------- F10 · el ángulo simple ----------------------------------- */
/* QUÉ EJES SE USAN es lo primero: sin restricción lateral continua, un ángulo
   flexiona respecto a sus ejes PRINCIPALES, inclinados respecto a los lados.
   Usar los geométricos sin tener la restricción es el error clásico. */
lanza("sin decir si hay restricción lateral continua PARA",
  () => A.ejesAnguloF10({}), "CONTINUA");
comp("con restricción continua, ejes geométricos",
  A.ejesAnguloF10({ restriccionLateralContinua: true }).ejes, "geométricos (x, y)");
comp("sin ella, ejes principales",
  A.ejesAnguloF10({ restriccionLateralContinua: false }).ejes, "principales");
/* Y la E.090 tampoco legisla el ángulo simple: remite al AISC, igual que en
   compresión. */
cierto("la remisión de la E.090 viaja citada",
  A.ejesAnguloF10({ restriccionLateralContinua: false }).artDivergencia.indexOf("E.090") >= 0);
/* Cuándo hay que ir a H2: es el caso de una brida de tijeral de ángulo con
   carga fuera de nudo. */
cierto("momento en los dos ejes principales exige H2",
  A.requiereH2({ momentoEnDosEjesPrincipales: true }).requiere === true);
cierto("un eje principal más carga axial también",
  A.requiereH2({ conCargaAxial: true }).requiere === true);
cierto("y ninguno de los dos, no",
  A.requiereH2({}).requiere === false);
cierto("con la cita textual", /combined stress ratio/.test(A.requiereH2({}).nota));

/* ---------- el ratio y el estado límite que gobierna ----------------- */
const conRatio = f2(250, { Mu_kgfcm: 900000 });
cerca("ratio = Mu/Md", conRatio.ratio, 900000 / conRatio.Md_kgfcm, 1e-12);
cierto("y dice si cumple", typeof conRatio.cumple === "boolean");
cierto("y qué zona gobierna", conRatio.zona.length > 0);

fin();
