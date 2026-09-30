/* =====================================================================
   probar_arriostres.js — el Apéndice 6, y el caso que lo justifica

   EL NÚMERO QUE HAY QUE VER ESTÁ AQUÍ. Una varilla de 5/8" arriostrando
   una columna de 90 tonf, con la diagonal de 4 m a 45°:

       resistencia   0,282   → sobra
       RIGIDEZ       1,269   → NO llega

   Resiste de sobra y NO arriostra. Y si no arriostra, la longitud no
   arriostrada que se supuso en el Capítulo E no existe, así que el cálculo
   de la columna entera se apoya en un punto que no está sujeto. El AISC
   pide las dos cosas y la segunda casi nunca se comprueba.

   Y el Apéndice 6 confirma por escrito dos decisiones que el proyecto ya
   había deducido: que arriostrar lateralmente no es arriostrar contra el
   giro (por eso la Lcz de columnas.js va con la altura entera), y que las
   vigas deben estar restringidas contra la rotación en los apoyos (que es
   el clip de la correa).
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const AR = require("../src/arriostres.js");
const AC = require("../src/acero.js");
const M = require("../src/modelo.js");

const AB58 = Math.PI * Math.pow(1.5875, 2) / 4;   /* varilla 5/8" */
const COS45 = Math.cos(Math.PI / 4);

/* ---------- 6.2 · arriostre de columna ------------------------------ */
const pan = AR.columna({ Pr_kgf: 90000, Lbr_cm: 150, tipo: "panel" });
const pun = AR.columna({ Pr_kgf: 90000, Lbr_cm: 150, tipo: "punto" });
cerca("panel · Vbr = 0,005·Pr", pan.Vbr_kgf, 450, 1e-9);
cerca("panel · βbr = (1/0,75)·(2Pr/Lbr)", pan.beta_kgfcm, (1 / 0.75) * 2 * 90000 / 150, 1e-9);
cerca("puntual · Pbr = 0,01·Pr", pun.Pbr_kgf, 900, 1e-9);
cerca("puntual · βbr = (1/0,75)·(8Pr/Lbr)", pun.beta_kgfcm, (1 / 0.75) * 8 * 90000 / 150, 1e-9);
/* NO ES LO MISMO, y por eso hay que decir cuál es: el puntual pide el doble
   de fuerza y CUATRO VECES la rigidez. */
cerca("el puntual pide el doble de fuerza", pun.Pbr_kgf / pan.Vbr_kgf, 2, 1e-12);
cerca("y cuatro veces la rigidez", pun.beta_kgfcm / pan.beta_kgfcm, 4, 1e-12);
comp("φ = 0,75 en los dos", pan.phi, 0.75);
lanza("sin decir el tipo PARA, y explica que no es lo mismo",
  () => AR.columna({ Pr_kgf: 90000, Lbr_cm: 150, tipo: "otro" }), "CUATRO VECES");
lanza("sin Lbr PARA, y dice cuál es en cada caso",
  () => AR.columna({ Pr_kgf: 90000, tipo: "punto" }), "adyacente al punto");

/* EL ALIVIO DEL Ap. 6.2.2 · Lbr no hace falta tomarlo menor que la Lc máxima
   admisible para el Pr requerido. Como βbr va con 1/Lbr, un Lbr mayor BAJA
   la rigidez exigida: si la columna va holgada, el arriostre puede ser menor. */
const alv = AR.columna({ Pr_kgf: 90000, Lbr_cm: 150, tipo: "punto",
  LcMaxAdmisible_cm: 300 });
cierto("con la columna holgada, el alivio se aplica", alv.alivio !== null);
comp("y Lbr pasa de 150 a 300", alv.Lbr_cm, 300);
cerca("con lo que la rigidez exigida se parte por dos",
  alv.beta_kgfcm, pun.beta_kgfcm / 2, 1e-9);
cierto("y se dice de dónde sale", /6\.2\.2/.test(alv.alivio.nota));

/* ---------- 6.3 · arriostre lateral de viga ------------------------- */
const vp = AR.viga({ Mr_kgfcm: 2000000, Lbr_cm: 200, ho_cm: 30, tipo: "punto" });
cerca("puntual · Pbr = 0,02·Mr·Cd/ho", vp.Pbr_kgf, 0.02 * 2000000 * 1 / 30, 1e-9);
cerca("y βbr = (1/0,75)·(10·Mr·Cd/(Lbr·ho))",
  vp.beta_kgfcm, (1 / 0.75) * 10 * 2000000 * 1 / (200 * 30), 1e-9);
const vpa = AR.viga({ Mr_kgfcm: 2000000, Lbr_cm: 200, ho_cm: 30, tipo: "panel" });
cerca("panel · Vbr = 0,01·Mr·Cd/ho", vpa.Vbr_kgf, 0.01 * 2000000 / 30, 1e-9);
cerca("el puntual vuelve a pedir el doble de fuerza", vp.Pbr_kgf / vpa.Vbr_kgf, 2, 1e-12);
/* Cd = 2,0 SOLO en el arriostre más cercano al punto de inflexión de una
   viga en curvatura doble · fila A6.Cd. */
comp("Cd normal es 1,0", vp.Cd, 1.0);
comp("y 2,0 cerca del punto de inflexión",
  AR.viga({ Mr_kgfcm: 2000000, Lbr_cm: 200, ho_cm: 30, tipo: "punto",
    cercaInflexion: true }).Cd, 2.0);
cerca("lo que dobla la demanda",
  AR.viga({ Mr_kgfcm: 2000000, Lbr_cm: 200, ho_cm: 30, tipo: "punto",
    cercaInflexion: true }).Pbr_kgf / vp.Pbr_kgf, 2, 1e-12);
/* Dos reglas de colocación que se olvidan. */
cierto("el arriostre va en el ala COMPRIMIDA, salvo el voladizo",
  /ala comprimida/i.test(vp.notaColocacion) && /voladizo/.test(vp.notaColocacion));
cierto("y el punto de inflexión NO cuenta como arriostrado si no hay arriostre",
  /gratis y falso/.test(vp.notaInflexion));
lanza("la viga sin ho PARA", () => AR.viga({ Mr_kgfcm: 2e6, Lbr_cm: 200, tipo: "punto" }),
  "centroides de alas");

/* ---------- LA RIGIDEZ QUE APORTA UNA DIAGONAL · el cos² ----------- */
/* β = (A·E/Ld)·cos²θ. El cos² sale de proyectar el desplazamiento y la
   fuerza, y castiga mucho una diagonal tendida. */
const r45 = AR.rigidezDiagonal({ A_cm2: 5.067, Ld_cm: 300, theta_grad: 45 });
cerca("β = (A·E/Ld)·cos²θ", r45.beta_kgfcm, (5.067 * AC.E_ACERO / 300) * 0.5, 1e-9);
cerca("a 45° el cos² es 0,5", r45.cos2, 0.5, 1e-12);
/* A 75° la diagonal aporta la cuarta parte que a 45, con la misma área. */
const r75 = AR.rigidezDiagonal({ A_cm2: 5.067, Ld_cm: 300, theta_grad: 75 });
cerca("a 75° el cos² cae a 0,067", r75.cos2, 0.0670, 1e-3);
cierto("o sea la séptima parte de rigidez con la misma área",
  r45.beta_kgfcm / r75.beta_kgfcm > 7);
cierto("y la nota explica de dónde sale el cos²", /proyectar/.test(r45.nota));
lanza("una diagonal a 90° no arriostra nada y PARA",
  () => AR.rigidezDiagonal({ A_cm2: 5, Ld_cm: 300, theta_grad: 90 }), "theta_grad");

/* ---------- EL CASO QUE JUSTIFICA EL MÓDULO ------------------------- */
/* Varilla de 5/8", columna de 90 tonf, arriostre puntual con Lbr = 150 cm. */
function varilla(Ld) {
  return AR.verifica({ demanda: pun, A_cm2: AB58, Ld_cm: Ld, theta_grad: 45,
    cosTheta: COS45, esVarilla: true });
}
const corta = varilla(300), larga = varilla(400);
/* CON 3 m APENAS LLEGA. */
cerca("con 3 m de diagonal, la resistencia sobra", corta.resistencia.ratio, 0.282, 0.005);
cerca("y la rigidez va al límite", corta.rigidez.ratio, 0.951, 0.005);
cierto("cumple, pero por poco", corta.cumple === true);
cierto("y ya gobierna la RIGIDEZ, no la resistencia", corta.gobierna === "RIGIDEZ");
/* CON 4 m RESISTE DE SOBRA Y NO ARRIOSTRA. Ése es el caso. */
cerca("con 4 m la resistencia sigue sobrando", larga.resistencia.ratio, 0.282, 0.005);
cierto("la resistencia cumple", larga.resistencia.cumple === true);
cerca("pero la rigidez se pasa", larga.rigidez.ratio, 1.269, 0.005);
cierto("y NO cumple", larga.cumple === false);
cierto("el resumen lo dice con todas las letras",
  /resiste pero NO arriostra/.test(larga.resumen));
/* Y LA CONSECUENCIA, que es lo grave: la longitud no arriostrada que se
   supuso en el Capítulo E no existe. */
cierto("y nombra la consecuencia sobre el Cap. E", /Cap\. E/.test(larga.resumen));
/* Subir la varilla arregla la rigidez, y se ve cuánto hace falta. */
const gorda = AR.verifica({ demanda: pun, A_cm2: Math.PI * Math.pow(2.54, 2) / 4,
  Ld_cm: 400, theta_grad: 45, cosTheta: COS45, esVarilla: true });
cierto("con una varilla de 1\" sí arriostra", gorda.cumple === true);
cierto("y la resistencia queda ridículamente holgada", gorda.resistencia.ratio < 0.15);
/* La varilla se comprueba por sus DOS estados límite · fila T.varillas. */
cierto("la varilla usa sus dos estados límite",
  /fluencia|rotura/.test(corta.resistencia.manda));

/* ---------- las dos exigencias, dichas ------------------------------ */
cierto("cada demanda cita la fila que dice que son DOS exigencias",
  pan.artDos.length > 0 && pun.artDos.length > 0 && vp.artDos.length > 0);
cierto("y la conexión del arriostre de panel se recuerda aparte",
  /conexión/i.test(pan.nota) && /E7/.test(pan.nota));

/* ---------- lo que el Apéndice 6 confirma · fila A6.giro ------------ */
/* Dos textuales que confirman decisiones que el proyecto ya había tomado
   deduciéndolas. */
cierto("el resultado de viga cita la fila del giro", vp.artGiro.length > 0);

/* ---------- la esbeltez del tirante · E.090 §2.7 -------------------- */
/* Una varilla de 5/8" con l/r de 600 es LEGAL. */
const et = AR.esbeltezTirante({ L_cm: 600, esVarilla: true });
comp("a una varilla no se le aplica el límite", et.aplica, false);
cierto("y se cita la exención de la E.090 §2.7", /2\.7/.test(et.notaExencion));
cierto("con el texto de la compresión reducida",
  /compresión reducida/.test(et.notaExencion));
/* A un perfil sí se le mira, como aviso. */
const ea = AR.esbeltezTirante({ L_cm: 600, r_cm: 1.5 });
cierto("a un perfil sí, y pasa de 300", ea.aplica === true && ea.pasa === false);
cierto("pero sigue sin ser rechazo", ea.esRechazo === false);

/* ---------- la cruz usa la iteración de riostras.js ----------------- */
/* No se reimplementa: se llama. */
const m = M.nuevo({ nivel: "LRFD", nombre: "panel" });
M.nudo(m, { id: "1", x_m: 0, y_m: 0 }); M.nudo(m, { id: "2", x_m: 6, y_m: 0 });
M.nudo(m, { id: "3", x_m: 0, y_m: 5 }); M.nudo(m, { id: "4", x_m: 6, y_m: 5 });
M.apoyo(m, { nudo: "1", ux: true, uy: true }); M.apoyo(m, { nudo: "2", ux: true, uy: true });
const o = { A_cm2: 100, I_cm4: 20000 };
M.barra(m, Object.assign({ id: "c1", i: "1", j: "3" }, o));
M.barra(m, Object.assign({ id: "c2", i: "2", j: "4" }, o));
M.barra(m, Object.assign({ id: "v", i: "3", j: "4" }, o));
const cr = AR.cruz(m, M, { id: "x", inferiorIzq: "1", superiorDer: "4",
  inferiorDer: "2", superiorIzq: "3", A_cm2: AB58 });
comp("la cruz crea dos diagonales", cr.ids.length, 2);
M.cargaNudo(m, { nudo: "3", Fx_kgf: 4000 });
const sol = AR.resuelveCruz(m, { soloTraccion: cr.ids });
comp("y la iteración deja una sola activa", sol.riostras.activas.length, 1);
cierto("con la otra desactivada", sol.riostras.desactivadas.length === 1);
cierto("la activa en tracción", sol.barra(sol.riostras.activas[0]).N_kgf > 0);

fin();
