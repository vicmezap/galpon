/* =====================================================================
   probar_acero_corte.js — AISC Capítulo G

       probar_acero.js              · Cap. D · tracción
       probar_acero_compresion.js   · E3 y E5
       probar_acero_armados.js      · E4, E6 y E7
       probar_acero_flexion.js      · Cap. F
       probar_acero_corte.js        · Cap. G   ← este

   LA VERIFICACIÓN MÁS BONITA DE TODO E4 ESTÁ AQUÍ, y no la inventé yo: la
   User Note de G2.1(a) NOMBRA los ocho perfiles W/S/HP que NO cumplen su
   criterio con Fy = 50 ksi. Recorriendo el catálogo y comparando h/tw contra
   2,24·√(E/Fy) tienen que salir esos ocho, ni uno más ni uno menos. Valida
   de un golpe la columna h/tw del catálogo, el umbral, la conversión de
   unidades y el valor de E — contra una lista impresa en la propia norma.

   Y EL PATRÓN DEL REDONDEO, que es lo que más va a ahorrar tiempo a futuro:
   el AISC redondea a tres cifras los coeficientes que son expresiones
   derivadas, y eso deja saltos del 0,05 al 0,2 % en las fronteras entre
   ramas. Aquí se mide en el 1,51 de la G2-11 y se comprueba que con el valor
   exacto (1,10×1,37) el empalme es perfecto. Tercer sitio donde aparece.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const A = require("../src/acero.js");
const P = require("../src/perfiles.js");

const Fy = 2530, FY50 = 3515;
const W = P.busca("W12X26");

/* ---------- LA LISTA DE LA USER NOTE · verificación externa ----------- */
/* «All current ASTM A6/A6M W, S, and HP shapes except W44×230, W40×149,
   W36×135, W33×118, W30×90, W24×55, W16×26, and W12×14 meet the criteria
   stated in Section G2.1(a) for Fy = 50 ksi.» */
const NOMBRADOS = ["W44X230", "W40X149", "W36X135", "W33X118", "W30X90",
  "W24X55", "W16X26", "W12X14"];
const umbral50 = A.COEF_PHI_V1 * Math.sqrt(A.E_ACERO / FY50);
cerca("el umbral 2,24·√(E/Fy) con 50 ksi es 53,95", umbral50, 53.95, 0.01);
const fallan = P.todos
  .filter((p) => /^(W|S|HP)[0-9]/.test(p.nombre) && p.fabricacion === "laminado" && p.h_tw > 0)
  .filter((p) => p.h_tw > umbral50)
  .map((p) => p.nombre);
comp("del catálogo salen exactamente ocho", fallan.length, 8);
comp("y son los ocho que nombra la User Note",
  fallan.slice().sort().join(" "), NOMBRADOS.slice().sort().join(" "));
/* Que coincidan los ocho valida la columna h/tw, el umbral, las unidades y E
   a la vez, contra una lista impresa en la norma. */
cierto("ninguno de los nombrados falta en el cálculo",
  NOMBRADOS.every((n) => fallan.indexOf(n) >= 0));
cierto("y el cálculo no añade ninguno de su cuenta",
  fallan.every((n) => NOMBRADOS.indexOf(n) >= 0));

/* ---------- el ÚNICO φ = 1,00 de la especificación · fila V.phi1 ------ */
comp("φv general = 0,90", A.PHI_V, 0.90);
comp("φv del alma laminada = 1,00", A.PHI_V_ALMA, 1.00);
comp("y la E.090 se queda en 0,90 siempre", A.PHI_V_E090, 0.90);
const lam = A.corteAlma({ acero: "A36", d_cm: W.d_cm, tw_cm: W.tw_cm,
  h_tw: W.h_tw, fabricacion: "laminado", Vu_kgf: 8000 });
cierto("un W12X26 laminado cae en G2.1(a)", lam.enG21a === true);
comp("con φv = 1,00", lam.phi, 1.00);
comp("y Cv1 = 1 por definición", lam.Cv1, 1.0);
/* LA DIVERGENCIA MEDIDA: 11 % de capacidad en toda viga laminada. */
cerca("el AISC da un 11,1 % más que la E.090", lam.Vd_kgf / lam.Vd_E090_kgf, 1.111, 1e-3);
cierto("y el ratio de la E.090 sale peor", lam.ratio_E090 > lam.ratio);
cierto("la decisión viaja escrita", /AISC/.test(lam.notaPhi));
/* EL MISMO PERFIL COMO SOLDADO NO TIENE EL PREMIO: G2.1(a) dice LAMINADO. */
const sol = A.corteAlma({ acero: "A36", d_cm: W.d_cm, tw_cm: W.tw_cm,
  h_tw: W.h_tw, fabricacion: "soldado" });
cierto("el mismo perfil como soldado NO cae en G2.1(a)", sol.enG21a === false);
comp("y vuelve a 0,90", sol.phi, 0.90);
cerca("o sea un 11 % menos de capacidad por la fabricación",
  lam.Vd_kgf / sol.Vd_kgf, 1.111, 1e-3);
lanza("sin decir la fabricación PARA, y explica que son 11 %",
  () => A.corteAlma({ acero: "A36", d_cm: 30, tw_cm: 0.6, h_tw: 47 }), "LAMINADO");
/* Un alma muy esbelta sale de G2.1(a) aunque sea laminada. */
cierto("un alma de h/tw = 100 laminada ya no cae en G2.1(a)",
  A.corteAlma({ acero: "A36", d_cm: 60, tw_cm: 0.6, h_tw: 100,
    fabricacion: "laminado" }).enG21a === false);

/* ---------- Aw es d·tw, el peralte TOTAL · fila V.Aw ----------------- */
cerca("Aw = d·tw", lam.Aw_cm2, W.d_cm * W.tw_cm, 1e-12);
/* Usar h en vez de d subestima el área: se mide cuánto en este perfil.
   h = h_tw · tw es la altura libre menos filetes; Aw con h sería h·tw. */
const hLibre = W.h_tw * W.tw_cm;
const AwConH = hLibre * W.tw_cm;
cierto("usar h en vez de d subestimaría el área", AwConH < lam.Aw_cm2);
cerca("un 12,4 % menos en un W12X26", lam.Aw_cm2 / AwConH, 1.124, 0.01);
lanza("corteAlma() sin h_tw PARA, y explica que h depende de la fabricación",
  () => A.corteAlma({ acero: "A36", d_cm: 30, tw_cm: 0.6, fabricacion: "laminado" }),
  "FABRIC");

/* ---------- kv · la divergencia con la E.090 ------------------------- */
comp("sin rigidizadores el AISC da kv = 5,34", A.kv({}).kv, 5.34);
comp("y la E.090 da 5,0", A.kv({}).kv_E090, 5.0);
/* El umbral de Cv1 = 1 pasa de 69,8 a 72,2 con A36: un 3,6 %. */
cerca("el umbral pasa de 69,83 con kv = 5",
  1.10 * Math.sqrt(5.0 * A.E_ACERO / Fy), 69.83, 0.01);
cerca("a 72,16 con kv = 5,34", 1.10 * Math.sqrt(5.34 * A.E_ACERO / Fy), 72.16, 0.01);
cerca("un 3,3 % de diferencia", Math.sqrt(5.34 / 5.0), 1.0333, 1e-3);
cierto("la divergencia viaja escrita", /E\.090/.test(A.kv({}).notaDivergencia));
/* Con rigidizadores · G2-5 */
cerca("con a/h = 1, kv = 5 + 5 = 10",
  A.kv({ conRigidizadores: true, a_h: 1 }).kv, 10, 1e-12);
cerca("con a/h = 2, kv = 5 + 1,25", A.kv({ conRigidizadores: true, a_h: 2 }).kv, 6.25, 1e-12);
/* Por encima de a/h = 3 la norma vuelve a 5,34: rigidizadores tan separados
   no cuentan. NO es por continuidad — 5 + 5/9 = 5,556, no 5,34. */
comp("con a/h > 3 vuelve a 5,34", A.kv({ conRigidizadores: true, a_h: 4 }).kv, 5.34);
cierto("y no es por continuidad: 5 + 5/9 sería 5,556",
  Math.abs(5 + 5 / 9 - 5.34) > 0.2);
lanza("con rigidizadores sin a/h PARA",
  () => A.kv({ conRigidizadores: true }), "a_h");

/* ---------- Cv1 tiene DOS tramos y Cv2 tiene TRES · fila V.Cv2 ------- */
const KV = 5.34;
comp("Cv1 = 1 por debajo del umbral", A.Cv1({ h_tw: 50, Fy_kgcm2: Fy, kv: KV }).Cv1, 1.0);
cerca("y por encima es lineal en 1/(h/tw)",
  A.Cv1({ h_tw: 150, Fy_kgcm2: Fy, kv: KV }).Cv1,
  1.10 * Math.sqrt(KV * A.E_ACERO / Fy) / 150, 1e-12);
/* Cv2 coincide con Cv1 en el primer tramo y en el segundo, y se separa en el
   tercero, que es CUADRÁTICO. Ahí está la diferencia que importa. */
cerca("Cv1 y Cv2 coinciden en el tramo lineal",
  A.Cv1({ h_tw: 80, Fy_kgcm2: Fy, kv: KV }).Cv1,
  A.Cv2({ h_tw: 80, Fy_kgcm2: Fy, kv: KV }).Cv2, 1e-12);
const c1_200 = A.Cv1({ h_tw: 200, Fy_kgcm2: Fy, kv: KV }).Cv1;
const c2_200 = A.Cv2({ h_tw: 200, Fy_kgcm2: Fy, kv: KV }).Cv2;
cierto("pero en el tercer tramo Cv2 es mucho menor", c2_200 < c1_200);
cerca("un factor 2,2 con h/tw = 200", c1_200 / c2_200, 2.22, 0.02);
cierto("y el tramo se nombra",
  A.Cv2({ h_tw: 200, Fy_kgcm2: Fy, kv: KV }).tramo.indexOf("cuadr") >= 0);
cerca("el tercer tramo va con 1,51·kv·E/((h/tw)²·Fy)",
  c2_200, 1.51 * KV * A.E_ACERO / (200 * 200 * Fy), 1e-12);

/* ---------- EL PATRÓN DEL REDONDEO · fila V.Cv2.coef ----------------- */
/* Las tres ramas de Cv2 tienen que empalmar. En el primer umbral empalman
   exactas; en el segundo NO, y la causa es que el 1,51 es 1,10×1,37 = 1,507
   redondeado. */
const u1 = 1.10 * Math.sqrt(KV * A.E_ACERO / Fy);
const u2 = 1.37 * Math.sqrt(KV * A.E_ACERO / Fy);
cerca("en el primer umbral el empalme es exacto",
  A.Cv2({ h_tw: u1, Fy_kgcm2: Fy, kv: KV }).Cv2, 1.0, 1e-12);
const ramaLineal = u1 / u2;
const ramaCuadTab = 1.51 * KV * A.E_ACERO / (u2 * u2 * Fy);
const ramaCuadExa = (1.10 * 1.37) * KV * A.E_ACERO / (u2 * u2 * Fy);
cerca("la rama lineal en u2 da 1,10/1,37 = 0,802920", ramaLineal, 0.802920, 1e-6);
cerca("con el 1,51 tabulado la cuadrática da 0,804518", ramaCuadTab, 0.804518, 1e-6);
cerca("o sea un salto del 0,199 %", ramaCuadTab / ramaLineal, 1.00199, 1e-5);
cierto("con 1,10×1,37 = 1,507 el empalme es perfecto",
  Math.abs(ramaCuadExa / ramaLineal - 1) < 1e-12);
cerca("y el redondeo de la norma es del 0,199 %", 1.51 / (1.10 * 1.37), 1.00199, 1e-5);
/* TERCER SITIO CON EL MISMO PATRÓN: el 4,71 del E3 es 1,5·π, el 1,95 y el
   6,76 de la F2-6 son 1,949091 y 6,7495, y este 1,51 es 1,507. La regla: el
   AISC redondea a tres cifras los coeficientes derivados, y eso deja saltos
   del 0,05 al 0,2 % en las fronteras. No es un error del código. */
cerca("recordatorio · el 4,71 del E3 es 1,5·π", 1.5 * Math.PI, 4.712389, 1e-6);
cerca("y el 1,95 de la F2-6 es √(π⁴·0,078/2)",
  Math.sqrt(Math.pow(Math.PI, 4) * 0.078 / 2), 1.949091, 1e-6);
cierto("los tres redondeos están por debajo del 0,2 %",
  Math.max(Math.abs(4.71 / (1.5 * Math.PI) - 1),
    Math.abs(1.95 / Math.sqrt(Math.pow(Math.PI, 4) * 0.078 / 2) - 1),
    Math.abs(1.51 / (1.10 * 1.37) - 1)) < 0.002);

/* ---------- los DOS umbrales parecidos · fila V.G2.rig --------------- */
/* El 2,24 de G2.1(a) es el de φv = 1,00; el 2,54 de G2.4(a) es el de «no
   hacen falta rigidizadores». Son distintos y no significan lo mismo. */
comp("el coeficiente de φv = 1,00 es 2,24", A.COEF_PHI_V1, 2.24);
comp("y el de los rigidizadores, 2,54", A.COEF_SIN_RIGID, 2.54);
cerca("con A36 dan 63,59 y 72,11", A.COEF_PHI_V1 * Math.sqrt(A.E_ACERO / Fy), 63.59, 0.01);
cerca("el segundo", A.COEF_SIN_RIGID * Math.sqrt(A.E_ACERO / Fy), 72.11, 0.01);
/* Y EL 2,54 NO ES ARBITRARIO: es 1,10·√5,34 = 2,54187, o sea el punto donde
   Cv1 = 1 sin rigidizadores. No hacen falta si el alma no pandea de todas
   formas. */
cerca("el 2,54 es 1,10·√5,34 = 2,541928", 1.10 * Math.sqrt(5.34), 2.541928, 1e-6);
const rg = A.requiereRigidizadores({ Fy_kgcm2: Fy, h_tw: 60 });
cierto("con h/tw = 60 no hacen falta", rg.requiere === false);
cierto("con h/tw = 100 sí",
  A.requiereRigidizadores({ Fy_kgcm2: Fy, h_tw: 100 }).requiere === true);
cerca("y los dos umbrales coinciden dentro del redondeo",
  rg.umbral / rg.umbralEquivalente, 1.0, 1e-3);
cierto("y se avisa de no cruzar el 2,24 con el 2,54", /2,24/.test(rg.nota));

/* ---------- el límite peruano de 260 · fila V.lim260 ----------------- */
comp("el límite de la E.090 es h/tw ≤ 260", A.LIM_H_TW_E090, 260);
cierto("un alma normal lo pasa", lam.pasaLim260 === true);
const muyEsbelta = A.corteAlma({ acero: "A36", d_cm: 200, tw_cm: 0.6, h_tw: 320,
  fabricacion: "soldado" });
cierto("una de h/tw = 320 no", muyEsbelta.pasaLim260 === false);
cierto("y avisa de a dónde manda la E.090",
  /Ap.ndice|Cap\. 7/.test(muyEsbelta.avisoLim260));

/* ---------- G3 · ángulos y almas de tes ------------------------------ */
comp("kv del G3 es 1,2", A.KV_G3, 1.2);
const ang = A.corteAngulo({ acero: "A36", b_cm: 10, t_cm: 0.95, Vu_kgf: 2000 });
cerca("Vn = 0,6·Fy·b·t·Cv2", ang.Vn_kgf, 0.6 * Fy * 10 * 0.95 * ang.Cv2, 1e-9);
comp("φv = 0,90, sin la excepción del alma", ang.phi, 0.90);
comp("un ángulo grueso no pandea: Cv2 = 1", ang.Cv2, 1.0);
cerca("ratio = Vu/Vd", ang.ratio, 2000 / ang.Vd_kgf, 1e-12);
/* Un lado muy esbelto sí reduce. */
cierto("un lado de b/t = 40 sí reduce",
  A.corteAngulo({ acero: "A36", b_cm: 10, t_cm: 0.25 }).Cv2 < 1);
lanza("sin el ancho del lado PARA, y dice qué es b",
  () => A.corteAngulo({ acero: "A36", t_cm: 0.95 }), "resiste");

/* ---------- G4 · HSS rectangular · EL FACTOR 2 ----------------------- */
comp("kv del G4 es 5", A.KV_G4, 5);
const hss = A.corteHSS({ acero: "A36", dimExterior_cm: 20, t_cm: 0.6, Vu_kgf: 5000 });
/* h = dimensión exterior menos TRES veces el espesor, cuando el radio de
   esquina no se conoce. */
cerca("h = 20 − 3·0,6 = 18,2", hss.h_cm, 18.2, 1e-12);
cierto("y dice cómo lo dedujo", /3.t|exterior/.test(hss.comoH));
/* Aw = 2·h·t porque el tubo tiene DOS almas. */
cerca("Aw = 2·h·t", hss.Aw_cm2, 2 * 18.2 * 0.6, 1e-12);
cierto("y la nota explica el factor 2", /DOS almas/.test(hss.nota));
cerca("Vn = 0,6·Fy·Aw·Cv2", hss.Vn_kgf, 0.6 * Fy * hss.Aw_cm2 * hss.Cv2, 1e-9);
/* Si se da h directamente, se usa tal cual. */
cerca("con h dado, se respeta",
  A.corteHSS({ acero: "A36", h_cm: 17, t_cm: 0.6 }).h_cm, 17, 1e-12);
lanza("sin h ni dimensión exterior PARA, y explica la regla del radio",
  () => A.corteHSS({ acero: "A36", t_cm: 0.6 }), "radio");

/* ---------- G5 · HSS redondo · la fila que faltaba ------------------- */
const rd = A.corteRedondo({ acero: "A36", D_t: 50, Lv_cm: 300, D_cm: 20, Ag_cm2: 30 });
/* El Ag/2 es porque solo la mitad de la sección resiste el corte. */
cerca("Vn = Fcr·Ag/2", rd.Vn_kgf, rd.Fcr_kgcm2 * 30 / 2, 1e-9);
cierto("y la nota lo explica", /mitad/.test(rd.nota));
/* En secciones corrientes manda la fluencia y Fcr = 0,6·Fy (User Note). */
cierto("con D/t = 50 manda la fluencia", rd.mandaFluencia === true);
cerca("y Fcr = 0,6·Fy", rd.Fcr_kgcm2, 0.6 * Fy, 1e-9);
/* Con D/t alto manda el pandeo, como avisa la User Note. */
const rd2 = A.corteRedondo({ acero: "A36", D_t: 200, Lv_cm: 300, D_cm: 20, Ag_cm2: 30 });
cierto("con D/t = 200 manda el pandeo", rd2.mandaFluencia === false);
cierto("y Fcr queda por debajo de 0,6·Fy", rd2.Fcr_kgcm2 < 0.6 * Fy);
cierto("Fcr es el MAYOR de las dos expresiones",
  Math.abs(rd2.Fcr_kgcm2 - Math.max(rd2.Fcr_a, rd2.Fcr_b)) < 1e-9);

/* ---------- G6 · el corte de la correa en su eje débil --------------- */
comp("kv del G6 es 1,2", A.KV_G6, 1.2);
const em = A.corteEjeMenor({ acero: "A36", bf_cm: W.bf_cm, tf_cm: W.tf_cm, tipo: "I" });
cerca("la razón de una I es bf/(2·tf)", em.razon, W.bf_cm / (2 * W.tf_cm), 1e-12);
/* EN UN CANAL ES bf/tf, el DOBLE: la misma asimetría que en F6, y
   confundirlos cambia la clasificación. */
cerca("y en un canal es bf/tf, el doble",
  A.corteEjeMenor({ acero: "A36", bf_cm: W.bf_cm, tf_cm: W.tf_cm, tipo: "canal" }).razon,
  W.bf_cm / W.tf_cm, 1e-12);
lanza("sin decir el tipo PARA, y explica que es un factor de 2",
  () => A.corteEjeMenor({ acero: "A36", bf_cm: 16, tf_cm: 1 }), "factor de 2");
/* Se calcula POR ELEMENTO que resiste corte, o sea por ala: dos en una I. */
comp("por omisión son dos elementos", em.elementos, 2);
cerca("Vn total = 2 × el de un ala", em.Vn_kgf, 2 * em.VnPorElemento_kgf, 1e-12);
cerca("y el de un ala es 0,6·Fy·bf·tf·Cv2",
  em.VnPorElemento_kgf, 0.6 * Fy * W.bf_cm * W.tf_cm * em.Cv2, 1e-9);

/* ---------- LA OTRA USER NOTE VERIFICABLE · fila V.G6.lista ---------- */
/* «Cv2 = 1,0 for all ASTM A6/A6M W, S, M, and HP shapes, when Fy ≤ 70 ksi.» */
const FY70 = 70 * 70.307;
const umbralG6 = 1.10 * Math.sqrt(A.KV_G6 * A.E_ACERO / FY70);
cerca("el umbral con 70 ksi y kv = 1,2 es 24,53", umbralG6, 24.53, 0.01);
const peorBf2tf = Math.max.apply(null, P.todos
  .filter((p) => /^(W|S|M|HP)[0-9]/.test(p.nombre) && p.fabricacion === "laminado" && p.bf_2tf > 0)
  .map((p) => p.bf_2tf));
cerca("y el máximo bf/(2tf) del catálogo es 14,40", peorBf2tf, 14.40, 0.01);
cierto("así que la User Note se cumple con holgura", peorBf2tf <= umbralG6);
comp("y en la práctica Cv2 = 1 en el eje menor de un laminado", em.Cv2, 1.0);

fin();
