/* =====================================================================
   probar_propiedades.js

   Se comprueba contra tres cosas distintas, en orden de dureza:

     1) fórmulas cerradas exactas · un rectángulo tiene I = bh³/12 y
        Z = bh²/4, sin discusión ni tolerancia
     2) invariantes · el eje neutro plástico de una sección simétrica cae
        en el centroide; emparejar dos ángulos no cambia rx
     3) el catálogo real · un W12X26 del AISCProp13, que es el contraste
        que de verdad vale porque la sección la midió otro
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const PR = require("../src/propiedades.js");
const U = require("../src/unidades.js");

/* ---------- 1 · fórmulas cerradas ------------------------------------- */
/* Un rectángulo de 10 × 20 cm: A = 200, Ix = 10·20³/12 = 6666,67,
   Iy = 20·10³/12 = 1666,67, Sx = 2·Ix/20 = 666,67, Zx = 10·20²/4 = 1000 */
const r = PR.compuesta([PR.rect(10, 20, 0, 0)]);
cerca("rectángulo · A", r.A_cm2, 200, 1e-12);
cerca("rectángulo · Ix = bh³/12", r.Ix_cm4, 10 * Math.pow(20, 3) / 12, 1e-12);
cerca("rectángulo · Iy = hb³/12", r.Iy_cm4, 20 * Math.pow(10, 3) / 12, 1e-12);
cerca("rectángulo · Sx", r.Sx_cm3, 666.6667, 1e-5);
cerca("rectángulo · Zx = bh²/4", r.Zx_cm3, 10 * 400 / 4, 1e-8);
cerca("rectángulo · Zy = hb²/4", r.Zy_cm3, 20 * 100 / 4, 1e-8);
cerca("rectángulo · rx = h/√12", r.rx_cm, 20 / Math.sqrt(12), 1e-12);
cerca("factor de forma del rectángulo = 1,5", r.Zx_cm3 / r.Sx_cm3, 1.5, 1e-8);

/* ---------- 2 · invariantes ------------------------------------------- */
/* El centroide de una sección simétrica está en el centro, se pongan las
   piezas donde se pongan: se desplaza todo 37 cm y no cambia nada. */
const d0 = PR.compuesta([PR.rect(10, 20, 0, 0)]);
const d1 = PR.compuesta([PR.rect(10, 20, 37, -13)]);
cerca("trasladar la sección no cambia Ix", d1.Ix_cm4, d0.Ix_cm4, 1e-12);
cerca("ni Zx", d1.Zx_cm3, d0.Zx_cm3, 1e-8);
cerca("y el centroide la sigue", d1.yg_cm, -13, 1e-12);

/* Una te: el eje neutro plástico NO cae en el centroide. Es la comprobación
   de que el plástico se calcula de verdad y no se copia del elástico. */
const te = PR.compuesta([
  PR.rect(20, 2, 0, 9),     /* ala arriba */
  PR.rect(1, 18, 0, -1)     /* alma */
]);
cierto("en una te el centroide no está en el medio", Math.abs(te.yg_cm) > 1);
cierto("y Zx/Sx supera 1,2, como toca en una te", te.Zx_cm3 / te.Sx_cm3 > 1.2);

/* ---------- 3 · el catálogo real: W12X26 ------------------------------ */
/* Del AISCProp13, convertido con unidades.js. El perfil es laminado, así
   que la I armada equivalente no da exactamente lo mismo —los filetes de
   unión alma-ala añaden área— pero tiene que quedarse cerca. */
const W = U.importaAISC({
  Shape: "W12X26", "A": 7.65, "d": 12.2, "tw": 0.230, "bf": 6.49, "tf": 0.380,
  "Ix": 204, "Sx": 33.4, "Zx": 37.2, "rx": 5.17,
  "Iy": 17.3, "Sy": 5.34, "Zy": 8.17, "ry": 1.51,
  "J": 0.300, "Cw": 607, "wt./ft.": 26.0
});

const calc = PR.Iarmada({
  h_cm: W.d_cm - 2 * W.tf_cm, tw_cm: W.tw_cm, bf_cm: W.bf_cm, tf_cm: W.tf_cm
});

/* El área calculada es MENOR que la tabulada porque el perfil laminado
   tiene filetes en las esquinas que la I de planchas no tiene. Un 2-4 %
   es lo esperable; más sería un error de fórmula. */
const difA = (W.A_cm2 - calc.A_cm2) / W.A_cm2;
cierto("el área calculada queda por debajo de la tabulada (los filetes)", difA > 0);
cierto("y la diferencia es del orden del 2-5 %", difA > 0.01 && difA < 0.06);

cerca("Ix calculado vs tabulado · W12X26", calc.Ix_cm4, W.Ix_cm4, 0.05);
cerca("Sx calculado vs tabulado", calc.Sx_cm3, W.Sx_cm3, 0.05);
cerca("Zx calculado vs tabulado", calc.Zx_cm3, W.Zx_cm3, 0.06);
cerca("Iy calculado vs tabulado", calc.Iy_cm4, W.Iy_cm4, 0.06);
cerca("Cw calculado vs tabulado", calc.Cw_cm6, W.Cw_cm6, 0.08);

/* ---------- las siete relaciones sobre el perfil TABULADO ------------- */
/* Esto es lo que se va a correr sobre las 1250 filas del catálogo. */
const paraVerificar = Object.assign({}, W, {
  bf_cm: W.bf_cm, tf_cm: W.tf_cm, d_cm: W.d_cm, simetriaDoble: true
});
comp("el W12X26 tabulado pasa las siete relaciones", PR.verifica(paraVerificar), []);

/* Y una fila con una columna mal leída tiene que FALLAR: si no, la prueba
   de oro no sirve de nada. */
const roto = Object.assign({}, paraVerificar, { Ix_cm4: W.Ix_cm4 * 1.25 });
cierto("una Ix un 25 % mal se detecta", PR.verifica(roto).length > 0);

const rotoSutil = Object.assign({}, paraVerificar, { ry_cm: W.ry_cm * 1.04 });
cierto("y un ry un 4 % mal también", PR.verifica(rotoSutil).length > 0);

/* ---------- doble ángulo ---------------------------------------------- */
/* L 3"x3"x1/4 aproximado: A = 9,29 cm², Ix = Iy = 50,4 cm⁴, xbar = 2,13 cm */
const L = { A_cm2: 9.29, Ix_cm4: 50.4, Iy_cm4: 50.4, xbar_cm: 2.13, J_cm4: 0.50 };
const par = PR.dobleAngulo({ angulo: L, sep_cm: 0.95 });   /* cartela de 3/8" */

cerca("2L · el área es el doble", par.A_cm2, 2 * L.A_cm2, 1e-12);
cerca("2L · Ix es el doble", par.Ix_cm4, 2 * L.Ix_cm4, 1e-12);
cerca("2L · rx NO cambia al emparejar", par.rx_cm, Math.sqrt(L.Ix_cm4 / L.A_cm2), 1e-12);
cierto("2L · Iy crece mucho", par.Iy_cm4 > 3 * L.Iy_cm4);
cierto("2L · y por tanto ry > rx", par.ry_cm > par.rx_cm);

/* La separación importa: más cartela, más inercia débil. Es exactamente lo
   que no da la tabla del AISC si tu cartela no es la estándar. */
const parAncho = PR.dobleAngulo({ angulo: L, sep_cm: 1.6 });
cierto("más separación da más Iy", parAncho.Iy_cm4 > par.Iy_cm4);
cerca("y rx sigue sin moverse", parAncho.rx_cm, par.rx_cm, 1e-12);

/* ---------- lo que tiene que parar ------------------------------------ */
lanza("una I armada con espesor cero para",
  () => PR.Iarmada({ h_cm: 40, tw_cm: 0, bf_cm: 20, tf_cm: 1.2 }), "tw_cm");
lanza("un doble ángulo sin xbar para",
  () => PR.dobleAngulo({ angulo: { A_cm2: 9, Ix_cm4: 50, Iy_cm4: 50 }, sep_cm: 1 }), "xbar_cm");
lanza("una sección sin piezas para",
  () => PR.compuesta([]), "sin piezas");

fin();
