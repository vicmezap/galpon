/* =====================================================================
   probar_escritor.js — la hoja, copiada al libro · E9

   Excel.run no existe en Node, así que se le da a escritor.js un Excel de
   juguete que APUNTA EN ORDEN cada cosa que se le pide.  Lo que se mira es
   lo que en Excel sale mal sin avisar:
     · un nombre definido DESPUÉS de la fórmula que lo usa
     · un texto como «1.4-3» escrito antes de poner la celda en formato texto
     · la hoja vieja que se queda y se mezcla con la nueva
   ===================================================================== */
"use strict";

const { comp, cierto, lanza, fin } = require("./_comun.js");
const ESC = require("../src/escritor.js");
const H = require("../src/hojas.js");
const R = require("../src/resultados.js");
const MON = require("../src/montaje.js");

function falsoExcel(conVieja) {
  const log = [];
  const rango = (dir) => new Proxy({ dir: dir, format: {
    font: new Proxy({}, { set: (t, k, v) => { t[k] = v; log.push(["fuente", dir, k, v]); return true; } }),
    fill: new Proxy({}, { set: (t, k, v) => { t[k] = v; log.push(["relleno", dir, k, v]); return true; } }),
    set columnWidth(v) { log.push(["ancho", dir, v]); } } },
  { set: (t, k, v) => { t[k] = v; log.push([k, dir, v]); return true; } });
  const hoja = (nombre) => ({
    names: { add: (n, r) => log.push(["nombre", n, r.dir]) },
    getRange: (dir) => rango(dir),
    delete: () => log.push(["borra", nombre]),
    activate: () => log.push(["activa", nombre]),
    load: () => {}
  });
  const vieja = Object.assign(hoja("CARGAS"), { isNullObject: !conVieja });
  const ctx = {
    workbook: { worksheets: {
      getItemOrNullObject: (n) => vieja,
      add: (n) => { log.push(["añade", n]); return hoja(n); } } },
    sync: () => { log.push(["sync"]); return Promise.resolve(); }
  };
  return { ctx: ctx, log: log };
}

const SITIO = { espesorCobertura_mm: 0.4, Dotras_kgfm2: 5, hayNieve: false, V_kmh: 75,
  tipoEdificacion: 1, aberturas: { izqDer: "repartidas", derIzq: "repartidas", longitudinal: "repartidas" },
  acero: "A36", zona: "Z4", suelo: "S2", categoria: "C", sistemaSismico: "OMF", industrial: false };
const m3 = MON.monta({ luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
  peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5] });
const h = H.hojaCargas({ cargas: R.cargas(m3, SITIO), sitio: SITIO, interior: null, fachada: null });

/* ---- lo que viaja ---- */
const sp = ESC.paraEnviar(h);
cierto("viaja sin `debe`: la guarda se queda en la ventana", Object.keys(sp.celdas).every((k) => sp.celdas[k].debe === undefined));
comp("con todas las celdas, los nombres y los anchos",
  [Object.keys(sp.celdas).length, Object.keys(sp.nombres).length, sp.anchos.A], [Object.keys(h.celdas).length,
    Object.keys(h.nombres).length, h.anchos.A]);
cierto("y cabe en mensajes: JSON de ida y vuelta, idéntico", JSON.stringify(JSON.parse(JSON.stringify(sp))) === JSON.stringify(sp));
const rota = Object.assign({}, h, { comprobacion: { ok: false, malas: [{}, {}] } });
lanza("una hoja cuyas fórmulas no dan el número del motor NO SE MANDA", () => ESC.paraEnviar(rota),
  ["2 fórmula(s) no dan el número del motor"]);

(async () => {
  /* ---- la escritura, en orden ---- */
  const X = falsoExcel(true);
  const r = await ESC.escribe(X.ctx, sp);
  const L = X.log, idx = (pred) => L.findIndex(pred);
  comp("devuelve la hoja y cuántas celdas", r, { nombre: "CARGAS", celdas: Object.keys(sp.celdas).length });
  cierto("LA HOJA VIEJA SE BORRA ANTES de crear la nueva, con un sync entre medias",
    idx((x) => x[0] === "borra") >= 0 && idx((x) => x[0] === "borra") < idx((x) => x[0] === "añade") &&
    L.slice(idx((x) => x[0] === "borra"), idx((x) => x[0] === "añade")).some((x) => x[0] === "sync"));
  const ultimoNombre = L.map((x) => x[0]).lastIndexOf("nombre");
  const primeraFormula = idx((x) => x[0] === "formulas");
  cierto("TODOS LOS NOMBRES ANTES de la primera fórmula", ultimoNombre >= 0 && ultimoNombre < primeraFormula);
  comp("uno por cada nombre de la hoja, en su celda", L.filter((x) => x[0] === "nombre").map((x) => x[1] + "=" + x[2]).sort(),
    Object.keys(sp.nombres).map((n) => n + "=" + sp.nombres[n]).sort());
  /* en cada celda, el formato antes que el valor */
  const malOrden = Object.keys(sp.celdas).filter((dir) => {
    const f = idx((x) => x[0] === "numberFormat" && x[1] === dir);
    const v = idx((x) => (x[0] === "values" || x[0] === "formulas") && x[1] === dir);
    return !(f >= 0 && v > f);
  });
  comp("EN CADA CELDA, EL FORMATO ANTES QUE EL VALOR («1.4-3» no se vuelve fecha)", malOrden, []);
  const escrito = {};
  for (const x of L) if (x[0] === "formulas" || x[0] === "values") escrito[x[1]] = x[2][0][0];
  comp("cada fórmula, tal cual", Object.keys(sp.celdas).filter((k) => sp.celdas[k].f !== undefined && escrito[k] !== sp.celdas[k].f), []);
  comp("cada valor, tal cual", Object.keys(sp.celdas).filter((k) => sp.celdas[k].f === undefined && escrito[k] !== sp.celdas[k].v), []);
  cierto("los datos en azul y el análisis, si lo hubiera, en verde: el color dice qué es cada celda",
    L.some((x) => x[0] === "fuente" && x[2] === "color" && x[3] === ESC.ESTILOS.dato.color && x[1] === sp.nombres.esp) &&
    ESC.ESTILOS.analisis.color !== ESC.ESTILOS.formula.color);
  cierto("los anchos de columna", L.some((x) => x[0] === "ancho" && x[1] === "A:A" && x[2] === sp.anchos.A * ESC.PT_POR_CARACTER));
  comp("y al final se activa y se sincroniza", L.slice(-2).map((x) => x[0]), ["activa", "sync"]);

  /* sin hoja vieja no se borra nada */
  const Y = falsoExcel(false);
  await ESC.escribe(Y.ctx, sp);
  comp("sin hoja vieja, no se borra nada", Y.log.filter((x) => x[0] === "borra"), []);
  fin();
})();
