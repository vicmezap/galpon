/* =====================================================================
   probar_placabase.js — la placa de apoyo y sus anclajes

   LA VERIFICACIÓN AQUÍ ES DE LA BUENA: Zapata trae TRES ejemplos resueltos
   —9.4, 9.5 y 9.6— y se reproducen los tres, cifra por cifra.  No es
   comprobar que el código hace lo que el código dice: es comprobar que
   hace lo que hizo a mano alguien que sabía, en 1997, con la misma norma.

   Y sale un extra que no se buscaba: su Ejemplo 9.6 redondea la llave de
   corte a 250 cm² cuando él mismo había calculado 259, y la comprobación
   de aplastamiento se pasa un 3,5 %.  Queda escrito abajo.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const P = require("../src/placabase.js");
const INV = require("../src/inventario.js");

const t = (x) => x / 1000;      /* kgf -> tonf, para comparar con el libro */

/* ================================================================
   1 · EJEMPLO 9.4 DE ZAPATA · placa grande, método del voladizo
   CS200x50, Pu = 88 t, zapata de 1,50 × 1,50, f'c = 210, A36.
   Zapata usa φc = 0,60, que es el del LRFD de su época: se le pasa el
   suyo para reproducirlo. El del proyecto es 0,65 y se compara aparte.
   ================================================================ */
const E94 = {
  B_cm: 30, N_cm: 30, d_cm: 20, bf_cm: 20, tf_cm: 1.25,
  fc_kgcm2: 210, A2_cm2: 150 * 150, Pu_kgf: 88000,
  Fy_kgcm2: 2530, phi_c: 0.60
};
const a94 = P.aplastamiento(E94);
cerca("9.4 · φcPp sin topar son 481,8 t (exacto 481,95: su redondeo)",
  t(a94.phi_c * a94.Pp_kgf), 481.95, 1e-4);
cerca("9.4 · y el tope, 192,6 t", t(a94.phi_c * a94.tope_kgf), 192.6, 2e-3);
cierto("9.4 · manda el tope: el premio por confinamiento se lo come entero",
  a94.topada === true && a94.Pn_kgf === a94.tope_kgf);
cerca("9.4 · √(A2/A1) sale 5 y se usa 2", a94.raizA2A1, 5, 1e-12);
comp("9.4 · la raíz usada es 2", a94.raizUsada, 2);
cierto("9.4 · y con 88 t cumple de sobra", a94.cumple === true);
cerca("9.4 · con ratio 0,456", a94.ratio, 0.456, 5e-3);

const v94 = P.voladizos(E94);
cerca("9.4 · m = (30 − 0,95·20)/2 = 5,5 cm", v94.m_cm, 5.5, 1e-12);
cerca("9.4 · n = (30 − 0,80·20)/2 = 7 cm", v94.n_cm, 7, 1e-12);
comp("9.4 · gobierna n, no el de la dirección que uno mire", v94.gobierna, "n");

const e94 = P.espesor(E94);
comp("9.4 · y el método es el del voladizo", e94.metodo, "voladizo");
cerca("9.4 · EL ESPESOR SALE 2,05 cm, el de Zapata", e94.t_cm, 2.05, 1e-3);
cerca("9.4 · el concreto pedía 822 cm² contra una huella de 400",
  e94.areaPedida_cm2, 822, 2e-3);

/* ================================================================
   2 · EJEMPLO 9.5 · placa pequeña, líneas de fluencia
   El mismo caso con Pu = 30 t. Y aquí está lo que me corrigió: m y n
   salen POSITIVOS (1,5 y 3 cm) y Zapata usa líneas de fluencia igual.
   ================================================================ */
const E95 = {
  B_cm: 22, N_cm: 22, d_cm: 20, bf_cm: 20, tf_cm: 1.25,
  fc_kgcm2: 210, A2_cm2: 150 * 150, Pu_kgf: 30000,
  Fy_kgcm2: 2530, phi_c: 0.60
};
const v95 = P.voladizos(E95);
cerca("9.5 · m = 1,5 cm", v95.m_cm, 1.5, 1e-12);
cerca("9.5 · n = 3 cm", v95.n_cm, 3, 1e-12);
cierto("9.5 · LOS DOS POSITIVOS: «hay voladizo» no puede ser el criterio",
  v95.hayVoladizo === true);

const e95 = P.espesor(E95);
comp("9.5 · y aun así el método es el de líneas de fluencia, como Zapata",
  e95.metodo, "lineas de fluencia");
cerca("9.5 · porque el concreto pide 280 cm² y la huella del perfil es 400",
  e95.areaPedida_cm2, 280, 5e-3);
comp("9.5 · esa es la huella", e95.huellaColumna_cm2, 400);
cierto("9.5 · y la explicación lo dice en esos términos",
  /GEOMETRÍA, no por resistencia/.test(e95.porQueEsteMetodo));

cerca("9.5 · Po = Pu·bf·d/(B·N) = 24,79 t", t(e95.Po_kgf), 24.793, 1e-4);
cierto("9.5 · Zapata escribe 24,73, que es su redondeo: la diferencia es 0,25 %",
  Math.abs(t(e95.Po_kgf) - 24.73) / 24.73 < 0.003);

/* CON SU Ah, SUS DOS CIFRAS EXACTAS.  Así queda demostrado que la
   diferencia de arriba es su redondeo y no un error de aquí. */
const e95z = P.espesorLineas(Object.assign({}, E95, { Ah_cm2: 115 }));
cerca("9.5 · con el Ah de Zapata (115 cm²), c = 1,24 cm", e95z.c_cm, 1.24, 1e-3);
cerca("9.5 · y el espesor, 0,54 cm", e95z.t_cm, 0.54, 1e-3);
/* y con el Ah exacto, lo que de verdad sale */
cerca("9.5 · con el Ah exacto (115,7) c sale 1,251", e95.c_cm, 1.2515, 2e-3);
cerca("9.5 · y el espesor 0,543 cm, que redondea a los mismos 0,54",
  e95.t_cm, 0.5427, 2e-3);

/* ================================================================
   3 · EJEMPLO 9.6 · levantamiento y llave de corte
   Pu = 8,08 t HACIA ARRIBA y Hu = 32,6 t. Es el caso del galpón.
   ================================================================ */
const an96 = P.anclajesTraccion({
  nPernos: 4, db_cm: 1.27, Fy_perno_kgcm2: 2530, Fu_perno_kgcm2: 4080,
  Tu_kgf: 8080
});
cerca("9.6 · 8,08 t entre 4 pernos son 2,02 t cada uno", t(an96.porPerno_kgf), 2.02, 1e-3);
/* CON SU ÁREA, SUS CIFRAS. Zapata toma Ab = 1,25 cm² para un perno de ½" y
   el área exacta es 1,2668: un 1,3 % que arrastra sus dos resistencias. */
const an96z = P.anclajesTraccion({
  nPernos: 4, db_cm: 1.27, Ab_cm2: 1.25, Fy_perno_kgcm2: 2530,
  Fu_perno_kgcm2: 4080, Tu_kgf: 8080
});
cerca("9.6 · con su Ab, fluencia = 2,84 t", t(an96z.fluencia_kgf), 2.846, 3e-3);
cerca("9.6 · y rotura en la rosca = 2,87 t", t(an96z.rotura_kgf), 2.869, 3e-3);
cerca("9.6 · con el Ab exacto salen 2,884 y 2,907, un 1,3 % más",
  an96.fluencia_kgf / an96z.fluencia_kgf, 1.0134, 2e-3);
comp("9.6 · gobierna la fluencia, por poco", an96.gobierna, "fluencia en el área bruta");
/* Y LA DISPONIBLE ES LA MENOR DE LAS DOS, no la última calculada. Sin esta
   línea, quitarle el Math.min al módulo no rompía nada: lo descubrí mutando
   el código y viendo que la suite seguía en verde. */
cerca("9.6 · la resistencia disponible es la MENOR de las dos",
  an96.disponible_kgf, Math.min(an96.fluencia_kgf, an96.rotura_kgf), 1e-12);
cierto("9.6 · y es la de fluencia, que aquí es la menor",
  an96.disponible_kgf === an96.fluencia_kgf);
cierto("9.6 · y cumple", an96.cumple === true);
cierto("LOS DOS ESTADOS LÍMITE, y el primero es el que se olvida",
  an96.fluencia_kgf > 0 && an96.rotura_kgf > 0 &&
  Math.abs(an96.fluencia_kgf / an96.rotura_kgf - 1) < 0.02);

const ll96 = P.llaveDeCorte({
  Hu_kgf: 32600, fc_kgcm2: 210, l_cm: 25, h_cm: 10,
  t_cm: 4.375, Fy_kgcm2: 2530, grout_cm: 2.5
});
cerca("9.6 · la llave necesita 259 cm² de área embebida",
  ll96.aplastamiento.areaNecesaria_cm2, 258.73, 1e-3);
cerca("9.6 · y la plancha de 1¾\" resiste 36,3 t a flexión",
  t(ll96.flexion.resistencia_kgf), 36.3, 2e-3);
cierto("9.6 · 36,3 > 32,6: la flexión de la llave cumple", ll96.flexion.cumple === true);

/* ───── LO QUE SALIÓ SIN BUSCARLO ─────
   Zapata calcula 259 cm² y acto seguido adopta 25 × 10 = 250: un 3,5 %
   menos. No es un error de concepto, es un redondeo que él da por bueno;
   pero el código no lo puede dar por bueno en silencio. */
cierto("9.6 · con 25 × 10 = 250 cm², el APLASTAMIENTO se pasa",
  ll96.aplastamiento.cumple === false);
cerca("9.6 · y se pasa exactamente un 3,5 %", ll96.aplastamiento.ratio, 1.0349, 2e-3);
cierto("9.6 · así que la llave entera NO cumple, aunque la flexión sí",
  ll96.cumple === false);
const ll96b = P.llaveDeCorte({
  Hu_kgf: 32600, fc_kgcm2: 210, l_cm: 25, h_cm: 10.35,
  t_cm: 4.375, Fy_kgcm2: 2530, grout_cm: 2.5
});
cierto("9.6 · subiendo h de 10 a 10,35 cm —lo que él mismo calculó— cumple",
  ll96b.aplastamiento.cumple === true);

/* ================================================================
   4 · POR QUÉ HACE FALTA LA LLAVE · fila J.anclaje.solo.traccion
   ================================================================ */
const Ab = Math.PI * 1.27 * 1.27 / 4;
const cortePernos = 0.75 * 0.450 * 4080 * Ab * 4;   /* Tabla J3.2, partes roscadas */
cerca("4 pernos de ½\" en corte darían 6,98 tonf", t(cortePernos), 6.98, 3e-3);
cerca("o sea el 21 % de las 32,6 tonf del ejemplo", cortePernos / 32600, 0.214, 1e-2);
cierto("y aun ese 21 % solo después de que la columna se mueva a cerrar el agujero",
  /tolerancia de obra/.test(INV.fila("J.anclaje.solo.traccion").nota));

lanza("con cortante y SIN llave, verifica() se niega",
  () => P.verifica({
    B_cm: 40, N_cm: 40, d_cm: 25, bf_cm: 25, tf_cm: 1.2, fc_kgcm2: 210,
    Pu_kgf: 50000, Fy_kgcm2: 2530, Hu_kgf: 8000
  }), "no hay llave de corte");
cierto("y explica que los pernos NO lo toman, con la cita",
  (() => {
    try {
      P.verifica({ B_cm: 40, N_cm: 40, d_cm: 25, bf_cm: 25, tf_cm: 1.2,
        fc_kgcm2: 210, Pu_kgf: 50000, Fy_kgcm2: 2530, Hu_kgf: 8000 });
    } catch (e) {
      return /Zapata 9\.8/.test(e.message) && /agujeros de la placa base/.test(e.message);
    }
  })());

/* ================================================================
   5 · EL GROUT, QUE NADIE MIRA
   Alarga el brazo del momento de la llave y no aporta nada.
   ================================================================ */
const conGrout = (g) => P.llaveDeCorte({
  Hu_kgf: 32600, fc_kgcm2: 210, l_cm: 25, h_cm: 10.35,
  t_cm: 4.375, Fy_kgcm2: 2530, grout_cm: g
}).flexion.resistencia_kgf;
cerca("sin grout, la llave daría 52,6 tonf", t(conGrout(0)), 52.637, 2e-3);
cerca("con 2,5 cm, 35,5", t(conGrout(2.5)), 35.491, 2e-3);
cerca("con 5 cm, 26,8", t(conGrout(5)), 26.771, 2e-3);
cierto("DOBLAR EL GROUT DE 2,5 A 5 cm CUESTA UN 25 % DE LA LLAVE",
  Math.abs((1 - conGrout(5) / conGrout(2.5)) - 0.246) < 0.01);
cierto("y la nota lo dice", /grout/.test(
  P.llaveDeCorte({ Hu_kgf: 1000, fc_kgcm2: 210, l_cm: 25, h_cm: 10,
    t_cm: 4, Fy_kgcm2: 2530 }).flexion.nota));

/* ================================================================
   6 · LOS TRES φ DE LA MISMA SUPERFICIE · filas J.base.phi y Z.tres.phi
   ================================================================ */
comp("los tres φ son los de la fila", [P.PHI_C.E090, P.PHI_C.AISC, P.PHI_C.E060],
  [0.60, 0.65, 0.70]);
cierto("el de por omisión es el del AISC, que es el que manda en el proyecto",
  P.aplastamiento({ B_cm: 30, N_cm: 30, fc_kgcm2: 210, Pu_kgf: 50000 }).phi_c === 0.65);
const areas = {};
for (const k of ["E090", "AISC", "E060"]) {
  areas[k] = P.areaNecesaria({ fc_kgcm2: 210, Pu_kgf: 88000, raiz: 2,
    phi_c: P.PHI_C[k] }).A1_cm2;
}
cerca("con φ = 0,60 la placa pide 410,8 cm²", areas.E090, 410.8, 1e-3);
cerca("con 0,65, 379,2", areas.AISC, 379.2, 1e-3);
cerca("con 0,70, 352,1", areas.E060, 352.1, 1e-3);
cerca("UN 16,7 % DE ÁREA, por elegir una norma u otra",
  areas.E090 / areas.E060 - 1, 0.1667, 1e-2);
cierto("y el resultado trae las tres, en vez de esconder dos",
  Object.keys(a94.conLosTresPhi).sort().join(",") === "AISC,E060,E090");
cerca("con la dispersión calculada", a94.dispersionPhi, 0.1667, 1e-2);
cierto("la fila del inventario dice que manda el AISC",
  /manda el AISC/.test(INV.fila("J.base.phi").nota));
cierto("y la de cimentación recuerda que un φ va con sus factores de carga",
  /factores de carga de su propia norma/.test(INV.fila("Z.tres.phi").nota));

/* ================================================================
   7 · LAS REGLAS GEOMÉTRICAS, Y LO QUE NO SON
   ================================================================ */
const g = P.geometriaAnclajes({
  db_cm: 1.27, separacion_cm: 20, alBorde_cm: 10, Ld_cm: 20, fc_kgcm2: 210
});
cierto("con la disposición del Ejemplo 9.6 se cumplen todas", g.cumpleTodas === true);
/* Por NOMBRE y no por índice: la regla de los 12d solo aparece cuando el
   cortante va por los pernos, así que el índice se mueve. */
const regla = (txt) => g.reglas.filter((r) => r.que.indexOf(txt) >= 0)[0];
cerca("separación exigida: 15d = 19,05 cm", regla("separación").exigido_cm, 19.05, 1e-6);
comp("al borde: el mayor de 5d y 10 cm", regla("no recortar").exigido_cm, 10);
cerca("longitud de anclaje: 12d = 15,24 cm", regla("longitud de anclaje").exigido_cm,
  15.24, 1e-6);
comp("con llave de corte, la regla de los 12d no aparece", g.reglas.length, 3);
const gSin = P.geometriaAnclajes({ db_cm: 1.27, separacion_cm: 20, alBorde_cm: 10,
  Ld_cm: 20, fc_kgcm2: 210, sinLlaveDeCorte: true });
comp("sin llave, sí: son cuatro", gSin.reglas.length, 4);
cierto("y entonces el borde tiene que llegar a 12d = 15,24 cm, que no llega",
  gSin.cumpleTodas === false);

const gMal = P.geometriaAnclajes({
  db_cm: 2.54, separacion_cm: 20, alBorde_cm: 8, Ld_cm: 20, fc_kgcm2: 175
});
cierto("con pernos de 1\" la misma disposición ya no cumple", gMal.cumpleTodas === false);
cierto("y f'c de 175 tampoco llega a los 210 que pide", gMal.fcCumple === false);
cierto("se dice cuáles fallan, no solo que algo falla", gMal.faltan.length >= 2);

/* ───── LO QUE ESTAS REGLAS NO SON ───── */
cierto("CUMPLIRLAS NO VERIFICA EL CONO, y el resultado lo dice",
  g.conoVerificado === false);
cierto("con la razón: son de 1983 y el cono entró en el ACI 318 en 2002",
  /1983/.test(g.nota) && /318-02/.test(g.nota));
cierto("y el lado del concreto sigue marcado como no verificado",
  an96.ladoConcretoVerificado === false);
comp("la fila del cono sigue pendiente", INV.fila("J.anclaje.concreto").estado, "pendiente");
lanza("pedir su valor PARA", () => INV.def("J.anclaje.concreto"), "PENDIENTE");

/* ================================================================
   8 · LA PLACA ENTERA
   ================================================================ */
const todo = P.verifica({
  B_cm: 40, N_cm: 40, d_cm: 25, bf_cm: 25, tf_cm: 1.2,
  fc_kgcm2: 210, A2_cm2: 120 * 120, Pu_kgf: 60000, Fy_kgcm2: 2530,
  Tu_kgf: 12000, nPernos: 4, db_cm: 1.905,
  Fy_perno_kgcm2: 2530, Fu_perno_kgcm2: 4080,
  separacion_cm: 30, alBorde_cm: 12, Ld_cm: 25,
  Hu_kgf: 9000,
  llave: { l_cm: 20, h_cm: 8, t_cm: 2.54 }
});
cierto("verifica() mira la compresión", !!todo.compresion);
cierto("y el espesor", !!todo.espesor);
cierto("y el levantamiento", !!todo.levantamiento);
cierto("y el cortante", !!todo.cortante);
cierto("y dice cuál gobierna de todos", typeof todo.gobierna === "string");
comp("con un ratio por mecanismo", todo.ratios.length, 4);
cierto("el peor es el que manda",
  Math.abs(todo.ratioMaximo - Math.max.apply(null, todo.ratios.map((r) => r.ratio))) < 1e-12);

/* Y SIEMPRE DICE LO QUE NO COMPROBÓ. */
comp("con levantamiento, declara un hueco", todo.sinVerificar.length, 1);
cierto("y es el lado del concreto del anclaje",
  /arrancamiento del cono/.test(todo.sinVerificar[0].que));
cierto("con la ruta para seguir mientras tanto",
  /capacidad/.test(todo.sinVerificar[0].ruta) &&
  /refuerzo lateral/.test(todo.sinVerificar[0].ruta));

const soloCompresion = P.verifica({
  B_cm: 40, N_cm: 40, d_cm: 25, bf_cm: 25, tf_cm: 1.2,
  fc_kgcm2: 210, Pu_kgf: 60000, Fy_kgcm2: 2530
});
comp("sin levantamiento no hay hueco que declarar", soloCompresion.sinVerificar.length, 0);

/* ================================================================
   9 · LO QUE TIENE QUE PARAR
   ================================================================ */
lanza("una placa mayor que el pedestal PARA",
  () => P.aplastamiento({ B_cm: 50, N_cm: 50, fc_kgcm2: 210, A2_cm2: 100 }),
  "no puede ser menor");
lanza("meter el levantamiento como Pu negativo PARA",
  () => P.aplastamiento({ B_cm: 30, N_cm: 30, fc_kgcm2: 210, Pu_kgf: -5000 }),
  "caso de COMPRESIÓN");
cierto("y manda al mecanismo que toca",
  (() => {
    try { P.aplastamiento({ B_cm: 30, N_cm: 30, fc_kgcm2: 210, Pu_kgf: -5000 }); }
    catch (e) { return /anclajes\(\)/.test(e.message); }
  })());

lanza("el método del voladizo con un voladizo negativo PARA",
  () => P.espesorVoladizo({ B_cm: 18, N_cm: 18, d_cm: 25, bf_cm: 25,
    fc_kgcm2: 210, Pu_kgf: 10000, Fy_kgcm2: 2530 }), "NO HAY MÉNSULA");
cierto("y explica que saldría un número que no significa nada",
  (() => {
    try {
      P.espesorVoladizo({ B_cm: 18, N_cm: 18, d_cm: 25, bf_cm: 25,
        fc_kgcm2: 210, Pu_kgf: 10000, Fy_kgcm2: 2530 });
    } catch (e) { return /no significa nada/.test(e.message); }
  })());

lanza("un área H que no cabe alrededor del perfil PARA",
  () => P.espesorLineas({ B_cm: 22, N_cm: 22, d_cm: 20, bf_cm: 20, tf_cm: 1.25,
    fc_kgcm2: 100, Pu_kgf: 200000, Fy_kgcm2: 2530 }), "no cabe");
lanza("un φc fuera de rango PARA",
  () => P.aplastamiento({ B_cm: 30, N_cm: 30, fc_kgcm2: 210, phi_c: 1.4 }),
  "fuera de (0, 1]");
lanza("medio perno PARA",
  () => P.anclajesTraccion({ nPernos: 2.5, db_cm: 1.27, Fy_perno_kgcm2: 2530,
    Fu_perno_kgcm2: 4080, Tu_kgf: 1000 }), "entero");
lanza("una tracción negativa PARA",
  () => P.anclajesTraccion({ nPernos: 4, db_cm: 1.27, Fy_perno_kgcm2: 2530,
    Fu_perno_kgcm2: 4080, Tu_kgf: -1000 }), "no puede ser negativa");
lanza("un grout de espesor negativo PARA",
  () => P.llaveDeCorte({ Hu_kgf: 1000, fc_kgcm2: 210, l_cm: 20, h_cm: 8,
    grout_cm: -1 }), "negativo");

/* ================================================================
   10 · LAS FILAS DEL INVENTARIO
   ================================================================ */
for (const id of ["J.base.cantilever", "J.base.t", "J.base.lineas", "J.base.metodo",
  "J.anclaje.solo.traccion", "J.llave.aplast", "J.llave.flexion",
  "J.anclaje.geometria"]) {
  cierto("la fila " + id + " existe y tiene fuente",
    INV.existe(id) && !!INV.fila(id).fuente);
  cierto("y cita a Zapata, que es de donde sale", /Zapata/.test(INV.art(id)));
}
cierto("J.base.cantilever explica por qué 0,95d y 0,80bf",
  /un poco DENTRO del perfil/.test(INV.fila("J.base.cantilever").nota));
cierto("J.base.t explica por qué el módulo plástico y no el elástico",
  /t²\/4 y no el elástico/.test(INV.fila("J.base.t").nota));
cierto("J.base.metodo avisa de lo que pasa al aplicar el voladizo cuando no toca",
  /no significa nada/.test(INV.fila("J.base.metodo").nota));
cierto("J.anclaje.geometria dice que hace el anclaje plausible, no verificado",
  /PLAUSIBLE, no verificado/.test(INV.fila("J.anclaje.geometria").nota));
cierto("y que el AISC 360-22 no trae el espesor de la placa",
  /NO trae el espesor/.test(INV.fila("J.base.cantilever").nota));

fin();
