/* =====================================================================
   probar_riostras.js — el arriostre que no empuja

   Lo que de verdad se comprueba aquí es CUÁNTO cambia el resultado. Modelar
   las dos diagonales de una cruz como barras normales reparte la fuerza
   entre las dos y da la mitad de tracción en la que trabaja. La que hay que
   diseñar es la otra.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const M = require("../src/modelo.js");
const S = require("../src/solver.js");
const R = require("../src/riostras.js");

const E = 2039000, Acol = 100, Icol = 20000, Avar = 2.0;

function panel(H) {
  const m = M.nuevo({ nivel: "LRFD", nombre: "panel arriostrado" });
  M.nudo(m, { id: "1", x_m: 0, y_m: 0 });
  M.nudo(m, { id: "2", x_m: 6, y_m: 0 });
  M.nudo(m, { id: "3", x_m: 0, y_m: 5 });
  M.nudo(m, { id: "4", x_m: 6, y_m: 5 });
  M.apoyo(m, { nudo: "1", ux: true, uy: true });
  M.apoyo(m, { nudo: "2", ux: true, uy: true });
  const o = { A_cm2: Acol, I_cm4: Icol, E_kgcm2: E };
  M.barra(m, Object.assign({ id: "c1", i: "1", j: "3" }, o));
  M.barra(m, Object.assign({ id: "c2", i: "2", j: "4" }, o));
  M.barra(m, Object.assign({ id: "v", i: "3", j: "4" }, o));
  const cr = R.cruz(m, M, { id: "x", inferiorIzq: "1", superiorDer: "4",
    inferiorDer: "2", superiorIzq: "3", A_cm2: Avar, E_kgcm2: E });
  M.cargaNudo(m, { nudo: "3", Fx_kgf: H });
  return { m: m, ids: cr.ids };
}

/* ---------- CUÁNTO CAMBIA · el número que justifica el módulo ---------- */
const p = panel(5000);
const conTratamiento = R.resuelve(p.m, { soloTraccion: p.ids });
const sinTratamiento = S.resuelve(panel(5000).m);

const activa = conTratamiento.riostras.activas[0];
const Ntratada = conTratamiento.barra(activa).N_kgf;
const Nsuelta = Math.max.apply(null, p.ids.map((id) => sinTratamiento.barra(id).N_kgf));
cierto("sin tratamiento una diagonal sale COMPRIMIDA, que es físicamente imposible",
  Math.min.apply(null, p.ids.map((id) => sinTratamiento.barra(id).N_kgf)) < 0);
cierto("con tratamiento la diagonal activa toma bastante más",
  Ntratada > Nsuelta * 1.5);
cerca("un 72 % más, medido", Ntratada / Nsuelta, 1.721, 0.01);

/* ---------- la iteración ----------------------------------------------- */
comp("converge en dos pasadas", conTratamiento.riostras.iteraciones, 2);
comp("y deja una sola diagonal activa", conTratamiento.riostras.activas.length, 1);
comp("la otra queda desactivada", conTratamiento.riostras.desactivadas.length, 1);
cierto("la activa está en tracción", Ntratada > 0);
cierto("convergió", conTratamiento.riostras.convergio === true);
cierto("y el historial dice qué quitó en cada pasada",
  conTratamiento.riostras.historial.length === 2 &&
  conTratamiento.riostras.historial[0].comprimidas.length === 1 &&
  conTratamiento.riostras.historial[1].comprimidas.length === 0);

/* Invertir la carga tiene que activar LA OTRA diagonal, no la misma. */
const q = panel(-5000);
const inv = R.resuelve(q.m, { soloTraccion: q.ids });
cierto("con la carga invertida se activa la otra diagonal",
  inv.riostras.activas[0] !== conTratamiento.riostras.activas[0]);
cerca("y con una tracción parecida, por simetría del panel",
  Math.abs(inv.barra(inv.riostras.activas[0]).N_kgf), Ntratada, 0.01);
/* POR ESO UN GALPÓN NECESITA LAS DOS: el viento sopla de los dos lados y
   cada sentido activa una. Quitar la que «no trabaja» deja medio edificio. */
cierto("cada sentido de carga usa una diagonal distinta",
  conTratamiento.riostras.desactivadas[0] === inv.riostras.activas[0]);

/* ---------- el conjunto SOLO SE ENCOGE, y por eso termina -------------- */
/* No es una esperanza: con retirada monótona el proceso acaba en como mucho
   tantas pasadas como riostras haya. La cota se comprueba contando. */
cierto("nunca hace más pasadas que riostras más dos",
  conTratamiento.riostras.iteraciones <= p.ids.length + 2);
let previa = conTratamiento.riostras.historial[0].activas.length;
for (const h of conTratamiento.riostras.historial.slice(1)) {
  cierto("el conjunto activo nunca crece", h.activas.length <= previa);
  previa = h.activas.length;
}

/* ---------- sin riostras solo-tracción, pasa de largo ------------------ */
const llano = R.resuelve(panel(5000).m, {});
comp("sin lista de solo-tracción, una sola corrida", llano.riostras.iteraciones, 1);
comp("y no desactiva nada", llano.riostras.desactivadas.length, 0);

/* ---------- lo que tiene que PARAR ------------------------------------- */
lanza("una riostra que no es barra del modelo PARA",
  () => R.resuelve(panel(5000).m, { soloTraccion: ["inventada"] }), "no es una barra");

/* Si al quitar las comprimidas la estructura se queda sin arriostrar, el
   mensaje tiene que decir ESO y no «matriz singular en la ecuación 7». */
lanza("quedarse sin arriostre da un mensaje del dominio, no del álgebra",
  () => {
    const m = M.nuevo({ nivel: "LRFD", nombre: "panel con una sola diagonal" });
    M.nudo(m, { id: "1", x_m: 0, y_m: 0 });
    M.nudo(m, { id: "2", x_m: 6, y_m: 0 });
    M.nudo(m, { id: "3", x_m: 0, y_m: 5 });
    M.nudo(m, { id: "4", x_m: 6, y_m: 5 });
    M.apoyo(m, { nudo: "1", ux: true, uy: true });
    M.apoyo(m, { nudo: "2", ux: true, uy: true });
    const o = { A_cm2: Acol, I_cm4: 0, E_kgcm2: E, liberaI: true, liberaJ: true };
    M.barra(m, Object.assign({ id: "c1", i: "1", j: "3" }, o));
    M.barra(m, Object.assign({ id: "c2", i: "2", j: "4" }, o));
    M.barra(m, Object.assign({ id: "v", i: "3", j: "4" }, o));
    M.barra(m, Object.assign({ id: "d", i: "1", j: "4" }, o, { A_cm2: Avar }));
    /* empuja en el sentido que COMPRIME la única diagonal */
    M.cargaNudo(m, { nudo: "4", Fx_kgf: -5000 });
    return R.resuelve(m, { soloTraccion: ["d"] });
  }, "sin arriostrar");

/* ---------- la obligación del Apéndice 6 queda anotada ----------------- */
/* «Bracing intended to define the unbraced lengths of members shall have
   sufficient stiffness and strength» (C3). Decir que un punto está
   arriostrado sin comprobarlo es la forma habitual de conseguir una longitud
   no arriostrada que no existe. Aquí solo se deja la deuda con su cita: la
   comprobación es de E4. */
const deuda = R.exigeApendice6({ punto: "brida superior", elemento: "correa" });
cierto("la deuda del Apéndice 6 se registra sin comprobar", deuda.comprobado === false);
cierto("y cita el artículo que la impone", deuda.art.indexOf("C3") >= 0);

fin();
