/* =====================================================================
   probar_correas.js — la correa de techo

   LA PRUEBA DE ORO DE ESTE MÓDULO ES LA TABLA DEL TR-4, y no por lo que
   vale sino por CÓMO ENTRÓ: el PDF del fabricante la trae como imagen, así
   que la extracción de texto solo devuelve 27 de los 120 números. Se
   rasterizó la página a 400 dpi y se transcribió leyéndola.

   Una transcripción a ojo no se acepta porque sí, así que se verifica
   mecánicamente aquí, cada vez que corren las pruebas:
     · decrece con la luz en las 12 filas
     · crece con el espesor en las 30 columnas
     · más tramos nunca dan menos capacidad
   y encima cuadra con los dos valores que el inventario ya tenía ANTES de
   digitalizarla, y con los cuatro pesos de panel de D.cobertura.peso.

   Y se comprueba una propiedad rara de la ficha que conviene no olvidar: 1
   y 2 tramos dan LO MISMO hasta 2,50 m. No se sabe por qué y no se inventa
   una razón; lo que importa es la consecuencia, que la tabla no es una
   familia mecánica suave y no se extrapola.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const C = require("../src/correas.js");
const P = require("../src/perfiles.js");
const A = require("../src/acero.js");
const EL = require("../src/elemento.js");

const Fy = 2530;
const TR4 = C.TR4;

/* ---------- LA TABLA SE VERIFICA A SÍ MISMA -------------------------- */
let fallos = 0;
for (const t of ["1", "2", "3"]) {
  for (const fila of TR4.tramos[t]) {
    const v = fila.filter((x) => x !== null);
    for (let k = 1; k < v.length; k++) if (v[k] >= v[k - 1]) fallos++;
  }
}
comp("la capacidad decrece con la luz en las 12 filas", fallos, 0);

let subeConEspesor = 0;
for (const t of ["1", "2", "3"]) {
  for (let j = 0; j < TR4.luces_m.length; j++) {
    const col = TR4.tramos[t].map((f) => f[j]).filter((x) => x !== null);
    for (let k = 1; k < col.length; k++) if (col[k] <= col[k - 1]) subeConEspesor++;
  }
}
comp("y crece con el espesor en las 30 columnas", subeConEspesor, 0);

let masTramosMenos = 0;
for (let i = 0; i < 4; i++) {
  for (let j = 0; j < TR4.luces_m.length; j++) {
    const a = TR4.tramos["1"][i][j], b = TR4.tramos["2"][i][j], c = TR4.tramos["3"][i][j];
    if (a !== null && b !== null && b < a) masTramosMenos++;
    if (b !== null && c !== null && c < b) masTramosMenos++;
  }
}
comp("más tramos nunca dan menos capacidad", masTramosMenos, 0);

/* LAS ANCLAS · los dos valores que el inventario ya tenía antes de
   digitalizar la tabla, y los cuatro pesos de panel. */
comp("0,45-0,50 a 1,50 m con 1 tramo son 150 kgf/m²",
  C.capacidadPanel({ espesor_mm: 0.45, separacion_m: 1.50, tramos: 1 }).P_kgfm2, 150);
comp("y con 3 tramos, 188",
  C.capacidadPanel({ espesor_mm: 0.45, separacion_m: 1.50, tramos: 3 }).P_kgfm2, 188);
cerca("un 25 % más por la continuidad", 188 / 150, 1.253, 1e-3);
comp("los cuatro pesos de panel coinciden con D.cobertura.peso",
  TR4.chapas.map((c) => c.peso_kgfm2).join(","), "3.35,4.3,5.26,7.17");

/* LA PROPIEDAD RARA · 1 y 2 tramos coinciden hasta 2,50 m en las cuatro
   chapas, y solo difieren después. */
let iguales = 0, distintos = 0;
for (let i = 0; i < 4; i++) {
  for (let j = 0; j < TR4.luces_m.length; j++) {
    const a = TR4.tramos["1"][i][j], b = TR4.tramos["2"][i][j];
    if (a === null || b === null) continue;
    if (TR4.luces_m[j] <= 2.50) { if (a === b) iguales++; }
    else if (a !== b) distintos++;
  }
}
comp("hasta 2,50 m, 1 y 2 tramos coinciden en las 28 celdas", iguales, 28);
cierto("y a partir de 2,75 difieren", distintos > 0);
cierto("la anomalía queda anotada en el catálogo", /no se inventa/.test(TR4.anomalia));

/* ---------- lo que la tabla NO deja hacer ---------------------------- */
lanza("una separación fuera del rango PARA, y dice que no se extrapola",
  () => C.capacidadPanel({ espesor_mm: 0.45, separacion_m: 3.5, tramos: 3 }),
  "extrapola");
/* Las celdas vacías son «no se recomienda», no «cero». */
lanza("una celda vacía PARA, y explica que no es cero",
  () => C.capacidadPanel({ espesor_mm: 0.35, separacion_m: 3.0, tramos: 1 }),
  "no «cero»");
/* Los huecos entre rangos de espesor, igual que en el catálogo de perfiles. */
lanza("un espesor en el hueco entre rangos PARA",
  () => C.capacidadPanel({ espesor_mm: 0.42, separacion_m: 1.5, tramos: 1 }),
  "no se fabrica");
lanza("sin decir cuántos tramos PARA, y dice cuánto cambia",
  () => C.capacidadPanel({ espesor_mm: 0.45, separacion_m: 1.5 }), "25 %");

/* Se interpola EN LA LUZ, que es la única dirección que se comporta como
   curva; entre número de tramos no, que son tablas distintas. */
const interp = C.capacidadPanel({ espesor_mm: 0.45, separacion_m: 1.60, tramos: 1 });
cierto("entre dos luces se interpola", interp.interpolado === true);
cerca("linealmente entre 150 y 109", interp.P_kgfm2, 150 + 0.4 * (109 - 150), 1e-9);
cierto("y se dice entre qué valores", interp.entre[0] === 1.5 && interp.entre[1] === 1.75);

/* ---------- LA CARGA DE LA TABLA ES NETA ----------------------------- */
/* El peso del panel YA está dentro. Sumarlo es contarlo dos veces. */
const vp = C.verificaPanel({ espesor_mm: 0.45, separacion_m: 2.0, tramos: 3,
  vivaNeta_kgfm2: 60 });
cerca("ratio = demanda/capacidad", vp.ratio, 60 / 104, 1e-12);
cierto("cumple", vp.cumple === true);
cierto("y el resultado recuerda que la carga es neta", vp.neta === true);
cierto("con la cita textual de la ficha", /peso propio del panel/.test(vp.notaNeta));
lanza("sin la carga viva neta PARA, y avisa de no sumar el panel",
  () => C.verificaPanel({ espesor_mm: 0.45, separacion_m: 2.0, tramos: 3 }),
  "contarlo dos veces");
/* El criterio de deflexión con el que está hecha la tabla. */
comp("la tabla se hizo con L/200", vp.deflexion, "L/200");

/* ---------- la carga se descompone porque la correa está inclinada --- */
const th = Math.atan(0.20) * 180 / Math.PI;   /* pendiente del 20 % */
cerca("el 20 % de pendiente son 11,31°", th, 11.31, 0.01);
const g = C.descompone({ theta_grad: th, vertical_kgfm: 200 });
cerca("la gravedad se proyecta al eje mayor", g.wMayor_kgfm, 200 * Math.cos(th * Math.PI / 180), 1e-12);
cerca("y deja una componente en el eje menor", g.wMenor_kgfm, 200 * Math.sin(th * Math.PI / 180), 1e-12);
cerca("que en este caso es el 20 % de la mayor", g.wMenor_kgfm / g.wMayor_kgfm, 0.20, 1e-9);
/* EL VIENTO NO SE DESCOMPONE: actúa perpendicular al techo. Esa diferencia
   es la razón de que gravedad y viento pidan cosas distintas de la misma
   correa. */
const w = C.descompone({ theta_grad: th, perpendicular_kgfm: 200 });
comp("el viento va entero al eje mayor", w.wMayor_kgfm, 200);
comp("y no toca el menor", w.wMenor_kgfm, 0);
lanza("una inclinación imposible PARA", () => C.descompone({ theta_grad: 95 }), "theta_grad");

/* ---------- los tensores · SOLO en el eje menor ---------------------- */
const t0 = C.luces({ L_m: 6, tensores: 0 });
const t1 = C.luces({ L_m: 6, tensores: 1 });
const t2 = C.luces({ L_m: 6, tensores: 2 });
comp("los tensores NO tocan la luz del eje mayor", t1.LMayor_m, 6);
comp("y parten la del menor", t1.LMenor_m, 3);
cerca("con dos, en tres", t2.LMenor_m, 2, 1e-12);
/* Como M va con L², dos tensores dividen el momento débil por NUEVE. */
cerca("un tensor divide el momento menor por 4", t1.factorMomentoMenor, 0.25, 1e-12);
cerca("y dos, por 9", t2.factorMomentoMenor, 1 / 9, 1e-12);
comp("sin tensores no cambia nada", t0.factorMomentoMenor, 1);
lanza("un número de tensores no entero PARA", () => C.luces({ L_m: 6, tensores: 1.5 }), "entero");

/* ---------- la esbeltez de la correa · criterio ADOPTADO ------------- */
const ld = C.esbeltezLd({ L_cm: 600, d_cm: 25.4, Fy_kgcm2: Fy });
cerca("el límite es 70450/Fy", ld.limite, 70450 / Fy, 1e-12);
cerca("que con A36 son 27,85", ld.limite, 27.85, 0.01);
cerca("L/d de una correa de 6 m y 10 pulgadas", ld.Ld, 600 / 25.4, 1e-12);
cierto("pasa", ld.pasa === true);
/* NO ES NORMA y se dice: el LRFD no fija límites de deflexión. */
cierto("pero NO es un rechazo", ld.esRechazo === false);
cierto("y se declara adoptado, con su procedencia", /ADOPTADO/.test(ld.nota));

/* ---------- la correa entera ---------------------------------------- */
const per = P.busca("C10X15.3");          /* un canal, que es lo normal */
const HO = per.d_cm - per.tf_cm;
const RT = A.rts({ Iy_cm4: per.Iy_cm4, Cw_cm6: per.Cw_cm6, Sx_cm3: per.Sx_cm3 }).rts_cm;
const CC = A.coefC({ tipo: "canal", ho_cm: HO, Iy_cm4: per.Iy_cm4, Cw_cm6: per.Cw_cm6 }).c;
const GEO = {
  Lp_cm: A.Lp({ ry_cm: per.ry_cm, Fy_kgcm2: Fy }).Lp_cm,
  Lr_cm: A.Lr({ rts_cm: RT, Fy_kgcm2: Fy, J_cm4: per.J_cm4, c: CC,
    Sx_cm3: per.Sx_cm3, ho_cm: HO }).Lr_cm,
  rts_cm: RT, J_cm4: per.J_cm4, c: CC, ho_cm: HO
};
function correa(n) {
  return C.verifica({ id: "C-" + n, perfil: per, acero: "A36", fabricacion: "laminado",
    combinacion: "1,2D + 1,6Lr", theta_grad: th, wVertical_kgfm: 200, L_m: 6,
    tensores: n, geometriaF2: GEO, Cb: 1.0, bF6_cm: per.bf_cm });
}
const c0 = correa(0), c1 = correa(1), c2 = correa(2);
cierto("una correa trae al menos flexión biaxial y cortante", c0.ratios.length >= 3);
cierto("y los tres capítulos son F2, F6 y G2",
  c0.ratios.map((x) => x.cap).sort().join(",") === "F2,F6,G2");

/* EL TENSOR ES LA PIEZA BARATA QUE EVITA SUBIR DE PERFIL, medido. */
cerca("sin tensores el ratio es 0,492", c0.ratio, 0.492, 0.005);
cerca("con uno baja a 0,228", c1.ratio, 0.228, 0.005);
cerca("o sea un 54 % menos", 1 - c1.ratio / c0.ratio, 0.537, 0.02);
cierto("y con dos baja algo más", c2.ratio < c1.ratio);
/* Y la razón principal NO es el momento del eje débil, que aquí es pequeño:
   es que el tensor arriostra lateralmente y ACORTA Lb, sacando la correa de
   la zona de pandeo elástico. Distinguirlo importa. */
cierto("sin tensores está en pandeo lateral ELÁSTICO", /Lb > Lr/.test(c0.gobierna));
cierto("con un tensor pasa a inelástico", /Lp < Lb/.test(c1.gobierna));
cerca("porque Lb se parte en dos", c1.Lb_cm, c0.Lb_cm / 2, 1e-9);
/* El momento del eje menor también baja, pero aporta menos en este caso. */
cerca("el momento del eje menor se divide por 4", c1.Muy_kgfcm, c0.Muy_kgfcm / 4, 1e-9);
cierto("y el del mayor NO cambia", Math.abs(c1.Mux_kgfcm - c0.Mux_kgfcm) < 1e-6);

/* LA HIPÓTESIS QUE SOSTIENE TODO · F1(b): los apoyos sin girar sobre su eje.
   Es la razón técnica del clip, y viaja con el resultado. */
cierto("el resultado recuerda que la correa va con CLIP", /CLIP/.test(c1.notaHipotesis));

/* ---------- EL FALLO QUE DESTAPÓ LA PRIMERA CORREA DE CANAL --------- */
/* elemento.js mandaba TODO el cortante al G2, y no se notó porque hasta
   entonces solo habían pasado perfiles W — que son justo los que sí van por
   G2. El fallo estaba tapado por la muestra (fila V.articulo). */
comp("una I va por G2", A.articuloCorte("I").articulo, "G2");
comp("un canal también", A.articuloCorte("C").articulo, "G2");
comp("pero un ángulo va por G3", A.articuloCorte("L").articulo, "G3");
comp("un HSS rectangular por G4", A.articuloCorte("HSS_rect").articulo, "G4");
comp("y uno redondo por G5", A.articuloCorte("HSS_red").articulo, "G5");
lanza("una familia sin reparto PARA en vez de suponer G2",
  () => A.articuloCorte("Z"), "necesita su fila");
/* Y elemento.js ahora lo reparte: un ángulo con cortante pide la geometría
   del G3, no la del G2. */
const L4 = P.busca("L4X4X1/2");
lanza("un ángulo con cortante pide la geometría del G3",
  () => EL.verifica({ id: "A1", perfil: L4, fuerzas: { Vu_kgf: 1000 } }),
  "no por el G2");
const ang = EL.verifica({ id: "A1", perfil: L4, fuerzas: { Vu_kgf: 1000 },
  bCorte_cm: 10.16, tCorte_cm: 1.27 });
comp("y entonces se comprueba por G3", ang.capitulo, "G3");

/* ---------- h/tw derivado, y dicho ---------------------------------- */
/* El catálogo AISC no da h/tw para canales: la hoja no tiene esa columna.
   Se deriva de d − 2k, que es la definición del propio G2, Y SE MARCA. */
comp("en un W12X26 el h/tw es tabulado",
  A.hSobreTw(P.busca("W12X26")).origen, "tabulado");
cierto("en un canal se deriva",
  A.hSobreTw(per).origen.indexOf("derivado") >= 0);
cierto("y la correa lo anota como omitido no esencial",
  c1.omitidos.some((o) => /h\/tw/.test(o.que)) && c1.cumple === true);
cierto("con el error medido en la nota", /0,71 %/.test(
  c1.omitidos.find((o) => /h\/tw/.test(o.que)).motivo));
/* T NO sirve para esto: es la dimensión de detallado. */
const w12 = P.busca("W12X26");
cierto("T daría un h/tw bastante distinto del tabulado",
  Math.abs(w12.T_cm / w12.tw_cm - w12.h_tw) / w12.h_tw > 0.05);

fin();
