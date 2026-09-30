/* =====================================================================
   probar_modelo.js — la estructura antes de resolverla

   Casi todo lo que se prueba aquí es lo que el modelo RECHAZA. Un error de
   datos que llega al solucionador sale como «matriz singular en la ecuación
   47», que no le dice nada a nadie. Cazado aquí sale como «el nudo B no toca
   ninguna barra».
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const M = require("../src/modelo.js");

const O = { A_cm2: 50, I_cm4: 8000 };

function base() {
  const m = M.nuevo({ nivel: "LRFD", nombre: "prueba" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "B", x_m: 6, y_m: 0 });
  return m;
}

/* ---------- el nivel de carga es obligatorio · fila E.C1.nivel --------- */
/* El AISC C1 exige que todo efecto dependiente de la carga se calcule al
   nivel de las combinaciones LRFD. Un modelo con cargas de servicio vale para
   deflexiones y NO vale para estabilidad. */
lanza("un modelo sin declarar el nivel de carga PARA", () => M.nuevo({}), "nivel de carga");
lanza("y un nivel inventado también", () => M.nuevo({ nivel: "ultimo" }), "nivel de carga");
comp("LRFD se acepta", M.nuevo({ nivel: "LRFD" }).nivel, "LRFD");
comp("servicio también, y queda escrito", M.nuevo({ nivel: "servicio" }).nivel, "servicio");

/* ---------- nudos ------------------------------------------------------ */
lanza("un nudo sin id PARA", () => M.nudo(base(), { x_m: 0, y_m: 0 }), "id");
lanza("un nudo repetido PARA",
  () => { const m = base(); M.nudo(m, { id: "A", x_m: 1, y_m: 1 }); }, "ya existe");
lanza("un nudo sin coordenadas PARA",
  () => M.nudo(base(), { id: "Z", x_m: 0 }), "x_m e y_m");
lanza("pedir un nudo que no existe PARA, y lista los que hay",
  () => M.buscaNudo(base(), "Q"), "no existe");

/* ---------- barras ----------------------------------------------------- */
lanza("una barra entre el mismo nudo PARA",
  () => M.barra(base(), Object.assign({ id: "b", i: "A", j: "A" }, O)), "mismo nudo");
lanza("una barra sin área PARA",
  () => M.barra(base(), { id: "b", i: "A", j: "B", I_cm4: 100 }), "A_cm2");
lanza("dos nudos en el mismo punto dan longitud nula",
  () => {
    const m = base(); M.nudo(m, { id: "C", x_m: 0, y_m: 0 });
    M.barra(m, Object.assign({ id: "b", i: "A", j: "C" }, O));
  }, "longitud nula");
/* Una barra sin inercia solo puede ser de armadura: si no libera los giros,
   su rigidez de flexión es cero y el nudo se queda sin ecuación. Es mejor
   decirlo aquí que dejar que salga una singularidad tres módulos después. */
lanza("I = 0 sin liberar los dos giros PARA",
  () => M.barra(base(), { id: "b", i: "A", j: "B", A_cm2: 50, I_cm4: 0 }),
  "no libera los dos giros");
cierto("pero I = 0 con los dos liberados se acepta: es de armadura",
  M.barra(base(), { id: "b", i: "A", j: "B", A_cm2: 50, I_cm4: 0,
    liberaI: true, liberaJ: true }).L_cm === 600);

/* La longitud se calcula al crear, en cm, desde metros. */
const bl = M.barra(base(), Object.assign({ id: "b", i: "A", j: "B" }, O));
comp("la longitud sale en cm desde los metros", bl.L_cm, 600);
comp("y el módulo por omisión es el del acero", bl.E_kgcm2, M.E_ACERO);
cerca("que es la fila MAT.E", M.E_ACERO, 2039000, 1e-12);

/* ---------- apoyos ----------------------------------------------------- */
lanza("apoyo() sin decir qué restringe PARA",
  () => { const m = base(); M.apoyo(m, { nudo: "A" }); }, "sin decir qué se restringe");
lanza("y un valor que no es booleano PARA",
  () => { const m = base(); M.apoyo(m, { nudo: "A", ux: 1 }); }, "true");
const ma = base();
M.apoyo(ma, { nudo: "A", ux: true, uy: true, rz: true });
comp("empotrado restringe los tres",
  M.GDL.filter((g) => M.buscaNudo(ma, "A").apoyo[g]).join(","), "ux,uy,rz");
M.apoyo(ma, { nudo: "B", uy: true });
cierto("el rodillo solo uno", M.buscaNudo(ma, "B").apoyo.uy === true &&
  M.buscaNudo(ma, "B").apoyo.ux === false);

/* ---------- validación antes de resolver ------------------------------- */
lanza("un modelo vacío no se puede resolver",
  () => M.valida(M.nuevo({ nivel: "LRFD" })), "no hay nudos");
lanza("sin nada que sujete en horizontal, la estructura flota",
  () => {
    const m = base();
    M.barra(m, Object.assign({ id: "b", i: "A", j: "B" }, O));
    M.apoyo(m, { nudo: "A", uy: true }); M.apoyo(m, { nudo: "B", uy: true });
    M.valida(m);
  }, "flota en x");
lanza("con menos de tres restricciones tampoco",
  () => {
    const m = base();
    M.barra(m, Object.assign({ id: "b", i: "A", j: "B" }, O));
    M.apoyo(m, { nudo: "A", ux: true, uy: true });
    M.valida(m);
  }, "al menos 3");
lanza("un nudo suelto que no es apoyo se señala",
  () => {
    const m = base();
    M.nudo(m, { id: "Z", x_m: 3, y_m: 3 });
    M.barra(m, Object.assign({ id: "b", i: "A", j: "B" }, O));
    M.apoyo(m, { nudo: "A", ux: true, uy: true, rz: true });
    M.apoyo(m, { nudo: "B", uy: true });
    M.valida(m);
  }, "no toca ninguna barra");

const ok = (function () {
  const m = base();
  M.barra(m, Object.assign({ id: "b", i: "A", j: "B" }, O));
  M.apoyo(m, { nudo: "A", ux: true, uy: true, rz: true });
  M.apoyo(m, { nudo: "B", uy: true });
  return m;
})();
cierto("un modelo bien formado valida", M.valida(ok) === true);

/* ---------- cargas ----------------------------------------------------- */
lanza("una carga en un nudo que no existe PARA",
  () => M.cargaNudo(ok, { nudo: "Q", Fy_kgf: -100 }), "no existe");
lanza("una carga con valor no numérico PARA",
  () => M.cargaNudo(ok, { nudo: "A", Fy_kgf: "mucho" }), "no numéricos");
lanza("una carga en una barra que no existe PARA",
  () => M.cargaBarra(ok, { barra: "zz", w_kgfm: -100 }), "no existe");

/* ---------- el resumen sabe si es armadura · fila E.armadura ----------- */
/* Un pórtico plano tiene 3 grados de libertad por nudo y una armadura 2.
   Liberando los giros, el mismo solucionador produce las dos. Al revés no
   funciona, y por eso se construye el de pórtico primero. */
const arm = (function () {
  const m = M.nuevo({ nivel: "LRFD", nombre: "armadura" });
  M.nudo(m, { id: "A", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "B", x_m: 4, y_m: 0 });
  M.nudo(m, { id: "C", x_m: 2, y_m: 1.5 });
  M.apoyo(m, { nudo: "A", ux: true, uy: true });
  M.apoyo(m, { nudo: "B", ux: true, uy: true });
  M.barraArmadura(m, Object.assign({ id: "d1", i: "A", j: "C" }, O));
  M.barraArmadura(m, Object.assign({ id: "d2", i: "C", j: "B" }, O));
  return m;
})();
cierto("una armadura se reconoce como tal", M.resumen(arm).esArmadura === true);
comp("y sus dos barras están liberadas", M.resumen(arm).barrasLiberadas, 2);
cierto("un pórtico no", M.resumen(ok).esArmadura === false);
/* A empotrado (3 restringidos) y B rodillo (1): de 6 gdl quedan 2 libres. */
comp("el resumen cuenta los grados de libertad libres", M.resumen(ok).gdlLibres, 2);
comp("y conserva el nivel de carga", M.resumen(arm).nivel, "LRFD");
comp("barraArmadura() libera los dos giros",
  [arm.barras[0].liberaI, arm.barras[0].liberaJ].join(","), "true,true");

fin();
