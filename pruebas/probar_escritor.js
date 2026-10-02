/* =====================================================================
   probar_escritor.js — la hoja, copiada al libro · E9

   Excel.run no existe en Node, así que se le da a escritor.js un Excel de
   juguete que APUNTA EN ORDEN cada cosa que se le pide —cualquier
   propiedad, cualquier llamada—.  Lo que se mira es lo que en Excel sale
   mal sin avisar:
     · un nombre definido DESPUÉS de la fórmula que lo usa
     · un texto como «1.4-3» escrito antes de poner la celda en formato texto
     · una FÓRMULA en una celda de texto: Excel no la calcula (pasó)
     · combinar antes de escribir
     · la hoja vieja que se queda y se mezcla con la nueva
   ===================================================================== */
"use strict";

const { comp, cierto, lanza, fin } = require("./_comun.js");
const ESC = require("../src/escritor.js");
const H = require("../src/hojas.js");
const R = require("../src/resultados.js");
const MON = require("../src/montaje.js");

/* EL EXCEL DE JUGUETE: cada objeto es una «ruta» que apunta lo que se le hace */
function falsoExcel(conVieja) {
  const log = [];
  function objeto(ruta) {
    const datos = {};
    return new Proxy(function () {}, {
      get(t, k) {
        if (k === "isNullObject") return !conVieja;
        if (k in datos) return datos[k];
        if (k === "then") return undefined;
        return objeto(ruta + "." + String(k));
      },
      set(t, k, v) { datos[k] = v; log.push(["pon", ruta + "." + String(k), v]); return true; },
      apply(t, self, args) {
        log.push(["llama", ruta, args]);
        return objeto(ruta + "(" + args.map((a) => (typeof a === "string" ? a : "…")).join(",") + ")");
      }
    });
  }
  const ctx = {
    workbook: objeto("wb"),
    sync: () => { log.push(["sync"]); return Promise.resolve(); }
  };
  return { ctx: ctx, log: log };
}

const SITIO = { espesorCobertura_mm: 0.4, Dotras_kgfm2: 5, hayNieve: false, V_kmh: 75,
  tipoEdificacion: 1, aberturas: { izqDer: "repartidas", derIzq: "repartidas", longitudinal: "repartidas" },
  acero: "A36", distrito: "LIMA › LIMA · MIRAFLORES", suelo: "S2", uso: "deposito", riesgoAdicional: false, usoSecCat: "no",
  sistemaSismico: "OMF", industrial: false };
const m3 = MON.monta({ luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
  peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5] });
const h = H.hojaCargas({ cargas: R.cargas(m3, SITIO), sitio: SITIO, interior: null, fachada: null });

/* ---- lo que viaja ---- */
const sp = ESC.paraEnviar(h);
cierto("viaja sin `debe`: la guarda se queda en la ventana", Object.keys(sp.celdas).every((k) => sp.celdas[k].debe === undefined));
comp("con todas las celdas, los nombres, las combinadas, la rejilla y el marco",
  [Object.keys(sp.celdas).length, Object.keys(sp.nombres).length, sp.combinar.length, sp.bordes.length, sp.marco],
  [Object.keys(h.celdas).length, Object.keys(h.nombres).length, h.combinar.length, h.bordes.length, h.marco]);
cierto("y cabe en mensajes: JSON de ida y vuelta, idéntico", JSON.stringify(JSON.parse(JSON.stringify(sp))) === JSON.stringify(sp));
lanza("una hoja cuyas fórmulas no dan el número del motor NO SE MANDA",
  () => ESC.paraEnviar(Object.assign({}, h, { comprobacion: { ok: false, malas: [{}, {}] } })),
  ["2 fórmula(s) no dan el número del motor"]);

/* ---- la matriz del tablero ---- */
const m = ESC.matrices(sp);
comp("el tablero entero en una matriz, de B1 a K(última)", [m.rango, m.vals.length, m.vals[0].length],
  ["B1:K" + sp.ultima, sp.ultima, 10]);
const en = (dir) => { const f = +dir.replace(/[A-Z]+/, ""), c = dir.replace(/\d+/, "").charCodeAt(0) - 66; return [m.fmts[f - 1][c], m.vals[f - 1][c]]; };
comp("cada fórmula en su sitio, con formato de número", en(sp.nombres.Lr), ["0.00", "=IF(Ai<=40,Lo,MAX(0.5*Lo,MIN(Lo,Lrb)))"]);
cierto("LA FÓRMULA DE RESULTADO TEXTO NO VA EN FORMATO DE TEXTO (el inciso de la Tabla 4 salía como texto)",
  en(sp.nombres.casoTecho)[0] !== "@" && /^=IF\(theta/.test(en(sp.nombres.casoTecho)[1]));
comp("ninguna fórmula del tablero en formato de texto", m.vals.reduce((a, fila, i) => a.concat(fila.map((v, j) =>
  (typeof v === "string" && v[0] === "=" && m.fmts[i][j] === "@") ? i + "," + j : null)), []).filter(Boolean), []);
cierto("y los textos, en formato de texto: «1.4-3» no se vuelve una fecha", m.vals.every((fila, i) => fila.every((v, j) =>
  typeof v !== "string" || v === "" || v[0] === "=" || m.fmts[i][j] === "@")));

(async () => {
  /* ---- la escritura, en orden ---- */
  const X = falsoExcel(true);
  const r = await ESC.escribe(X.ctx, sp, { impresion: true });
  const L = X.log, idx = (pred) => L.findIndex(pred);
  const ultimo = (pred) => { for (let i = L.length - 1; i >= 0; i--) if (pred(L[i])) return i; return -1; };
  const llama = (re) => (x) => x[0] === "llama" && re.test(x[1]);
  const pon = (re) => (x) => x[0] === "pon" && re.test(x[1]);
  comp("devuelve la hoja y cuántas celdas", r, { nombre: "CARGAS", celdas: Object.keys(sp.celdas).length });
  const borra = idx(llama(/\.delete$/)), anade = idx(llama(/worksheets\.add$/));
  cierto("LA HOJA VIEJA SE BORRA ANTES de crear la nueva, con un sync entre medias",
    borra >= 0 && borra < anade && L.slice(borra, anade).some((x) => x[0] === "sync"));
  comp("un nombre por cada nombre de la hoja, en su celda", L.filter(llama(/names\.add$/)).map((x) => x[2][0]).sort(),
    Object.keys(sp.nombres).sort());
  const fFormato = idx(pon(/\.numberFormat$/)), fFormulas = idx(pon(/\.formulas$/));
  cierto("TODOS LOS NOMBRES ANTES de escribir las fórmulas", ultimo(llama(/names\.add$/)) < fFormulas);
  cierto("EL FORMATO DE NÚMERO ANTES QUE LOS VALORES, en una sola escritura cada uno",
    fFormato >= 0 && fFormato < fFormulas && L.filter(pon(/\.formulas$/)).length === 1 &&
    L.filter(pon(/\.numberFormat$/)).length === 1 && L[fFormulas][1].indexOf(m.rango) >= 0);
  cierto("COMBINAR DESPUÉS de escribir", idx(llama(/\.merge$/)) > fFormulas);
  comp("una combinación por cada rango combinado", L.filter(llama(/\.merge$/)).length, sp.combinar.length);
  cierto("sin cuadrícula, y fuera del tablero gris", L.some((x) => x[0] === "pon" && /showGridlines$/.test(x[1]) && x[2] === false) &&
    L.some((x) => x[0] === "pon" && /fill\.color$/.test(x[1]) && x[2] === ESC.GRIS_FUERA));
  cierto("el marco azul grueso alrededor del tablero", L.some((x) => x[0] === "pon" && x[1].indexOf("(" + sp.marco + ")") >= 0 &&
    /EdgeTop\)\.weight$/.test(x[1]) && x[2] === "Thick"));
  cierto("la rejilla fina en cada tabla", sp.bordes.every((b) => L.some((x) => x[0] === "pon" && x[1].indexOf("(" + b + ")") >= 0 &&
    /InsideHorizontal\)\.style$/.test(x[1]))));
  cierto("los datos en azul y el análisis en verde: el color dice qué es cada celda",
    L.some((x) => x[0] === "pon" && x[1].indexOf("(" + sp.nombres.esp + ")") >= 0 && /font\.color$/.test(x[1]) &&
      x[2] === ESC.ESTILOS.dato.color) && ESC.ESTILOS.analisis.color !== ESC.ESTILOS.formula.color);
  cierto("el estilo de una combinada se aplica a todo su rango, no solo a la primera celda",
    L.some((x) => x[0] === "pon" && x[1].indexOf("(B2:K3)") >= 0 && /fill\.color$/.test(x[1]) && x[2] === ESC.ESTILOS.titulo.fill));
  cierto("con ExcelApi 1.9, el área de impresión es el tablero, a una página de ancho",
    L.some((x) => x[0] === "llama" && /setPrintArea$/.test(x[1]) && x[2][0] === sp.marco));
  comp("y al final se activa y se sincroniza", [/activate$/.test(L[L.length - 2][1]), L[L.length - 1][0]], [true, "sync"]);

  /* sin hoja vieja no se borra nada, y sin ExcelApi 1.9 no se toca la impresión */
  const Y = falsoExcel(false);
  await ESC.escribe(Y.ctx, sp, {});
  comp("sin hoja vieja, no se borra nada", Y.log.filter(llama(/\.delete$/)).length, 0);
  comp("sin ExcelApi 1.9, nada de pageLayout (fallaría la escritura entera)",
    Y.log.filter((x) => /pageLayout/.test(x[1] || "")).length, 0);
  fin();
})();
