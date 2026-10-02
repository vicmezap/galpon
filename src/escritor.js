/* =====================================================================
   escritor.js — copia una hoja de hojas.js al libro de Excel · E9

   Lo usa el PANEL, que es quien tiene Excel.run: la ventana del modelador
   arma la hoja y la manda por mensajes; aquí se escribe.  Recibe el
   `context` de Excel.run en vez de llamarlo, para que se pueda probar en
   Node con un Excel de juguete que apunta cada cosa que se le pide.

   EL FORMATO ES EL «PIZARRA» DE RETÍCULA (el usuario: «está mucho mejor
   ordenado»): tablero de B a K con título, secciones en gris oscuro,
   cabeceras grises, etiquetas en gris claro, rejilla fina en las tablas,
   marco azul, fuera del tablero gris y sin cuadrícula.

   El orden importa y está escrito:
     1. la hoja vieja se borra entera, y con ella sus nombres
     2. LOS NOMBRES ANTES que las fórmulas que los usan
     3. el formato de número de TODO el tablero, en una escritura, ANTES
        que los valores: con «1.4-3» en una celda General, Excel pone una
        fecha; y una fórmula en una celda de texto NO SE CALCULA
     4. los valores y fórmulas de todo el tablero, en una escritura
     5. combinar, DESPUÉS de escribir (Retícula lo pagó)
     6. estilos, rejilla, alturas, marco, fuera, impresión
   Y todo en UN Excel.run con un solo sync al final: un Excel.run dentro de
   otro falla a ratos en Excel (memoria de Retícula).
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.ESCRITOR = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("escritor.js", ["H.formulas", "H.analisis"]);

  function exige(c, msg) { if (!c) throw new Error("escritor: " + msg); }

  /* LOS ESTILOS · qué es cada celda.  En el valor: azul el dato, morado la norma,
     negro la fórmula, verde lo que sale del análisis (filas H.formulas y H.analisis). */
  const ESTILOS = {
    titulo: { bold: true, size: 18, color: "#FFFFFF", fill: "#156082", name: "Times New Roman", h: "Center", v: "Center" },
    proyecto: { size: 10, color: "#000000", fill: "#FFFFFF", h: "Left", v: "Center" },
    leyenda: { italic: true, size: 9, color: "#595959", h: "Left", v: "Center" },
    seccion: { bold: true, size: 12, color: "#FFFFFF", fill: "#747474", h: "Left", v: "Center" },
    subseccion: { bold: true, size: 11, color: "#000000", h: "Left", v: "Center" },
    cabecera: { bold: true, size: 10, color: "#000000", fill: "#AEAEAE", h: "Center", v: "Center", wrap: true },
    etiqueta: { size: 10, color: "#000000", fill: "#E8E8E8", h: "Left", v: "Center", wrap: true },
    simbolo: { italic: true, size: 10, color: "#404040", h: "Center", v: "Center" },
    dato: { size: 10, color: "#0070C0", fill: "#FFF2CC", h: "Center", v: "Center" },
    modelo: { size: 10, color: "#0070C0", h: "Center", v: "Center" },
    norma: { size: 10, color: "#7030A0", h: "Center", v: "Center" },
    tabla: { size: 10, color: "#7030A0", h: "Center", v: "Center" },
    formula: { bold: true, size: 10, color: "#000000", h: "Center", v: "Center" },
    analisis: { size: 10, color: "#00803C", fill: "#E2EFDA", h: "Center", v: "Center" },
    unidad: { size: 10, color: "#404040", h: "Center", v: "Center" },
    como: { italic: true, size: 9, color: "#404040", h: "Left", v: "Center", wrap: true },
    fuente: { size: 9, color: "#404040", h: "Left", v: "Center", wrap: true },
    nota: { italic: true, size: 9, color: "#595959", h: "Left", v: "Center", wrap: true }
  };
  const FUENTE = "Aptos Narrow";
  const PT_POR_CARACTER = 6.5;      /* el ancho de columna, de caracteres a puntos */
  const AZUL_MARCO = "#0070C0", GRIS_FUERA = "#D9D9D9";
  const FUERA_COLS = 30, FUERA_FILAS = 40;

  const colNum = (l) => l.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colLetras = (n) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
  const parte = (d) => { const m = /^([A-Z]+)(\d+)$/.exec(d); return { c: colNum(m[1]), f: +m[2] }; };

  /* Lo que viaja por mensajes: sin `debe` ni `que`, que son de la guarda y no del libro */
  function paraEnviar(h) {
    exige(h && h.nombre && h.celdas, "paraEnviar() necesita una hoja de hojas.js");
    exige(!h.comprobacion || h.comprobacion.ok, "la hoja " + h.nombre + " no se manda: " +
      (h.comprobacion ? h.comprobacion.malas.length : 0) + " fórmula(s) no dan el número del motor (fila H.coincide)");
    const celdas = {};
    for (const dir of Object.keys(h.celdas)) {
      const c = h.celdas[dir], x = { estilo: c.estilo, fmt: c.fmt };
      if (c.f !== undefined) x.f = c.f; else x.v = c.v;
      if (c.rango) x.rango = c.rango;
      celdas[dir] = x;
    }
    return { nombre: h.nombre, celdas: celdas, nombres: h.nombres, anchos: h.anchos, combinar: h.combinar || [],
      bordes: h.bordes || [], alturas: h.alturas || {}, marco: h.marco, ultima: h.ultima };
  }

  /* LA MATRIZ DEL TABLERO · B1:K(última): el formato y el valor de cada celda, en dos escrituras */
  function matrices(sp) {
    const [a, b] = sp.marco.split(":");
    const p = parte(a), q = parte(b);
    const fmts = [], vals = [];
    for (let f = 1; f <= q.f; f++) {
      const fF = [], fV = [];
      for (let c = p.c; c <= q.c; c++) {
        const x = sp.celdas[colLetras(c) + f];
        fF.push(x && x.fmt ? x.fmt : "General");
        fV.push(!x ? "" : (x.f !== undefined ? x.f : (x.v === undefined || x.v === null ? "" : x.v)));
      }
      fmts.push(fF); vals.push(fV);
    }
    return { rango: colLetras(p.c) + "1:" + colLetras(q.c) + q.f, fmts: fmts, vals: vals };
  }

  function aplicaEstilo(rg, e) {
    const fo = rg.format;
    fo.font.name = e.name || FUENTE;
    if (e.size) fo.font.size = e.size;
    fo.font.bold = !!e.bold;
    fo.font.italic = !!e.italic;
    if (e.color) fo.font.color = e.color;
    if (e.fill) fo.fill.color = e.fill;
    if (e.h) fo.horizontalAlignment = e.h;
    if (e.v) fo.verticalAlignment = e.v;
    if (e.wrap) fo.wrapText = true;
  }
  function rejilla(rg, peso, color) {
    for (const lado of ["EdgeTop", "EdgeBottom", "EdgeLeft", "EdgeRight", "InsideVertical", "InsideHorizontal"]) {
      const b = rg.format.borders.getItem(lado);
      b.style = "Continuous"; b.weight = peso; b.color = color;
    }
  }
  function borde(rg, peso, color) {
    for (const lado of ["EdgeTop", "EdgeBottom", "EdgeLeft", "EdgeRight"]) {
      const b = rg.format.borders.getItem(lado);
      b.style = "Continuous"; b.weight = peso; b.color = color;
    }
  }

  /* escribe(context, hoja, opciones) → promesa · context es el de Excel.run.
     opciones.impresion: si el Excel tiene ExcelApi 1.9 (área de impresión y ajuste a una página) */
  function escribe(context, sp, opciones) {
    exige(sp && sp.nombre && sp.celdas && sp.marco, "escribe() necesita una hoja con su tablero");
    const o = opciones || {};
    const wb = context.workbook;
    const vieja = wb.worksheets.getItemOrNullObject(sp.nombre);
    vieja.load("isNullObject");
    return context.sync().then(function () {
      if (!vieja.isNullObject) vieja.delete();
      return context.sync();
    }).then(function () {
      const ws = wb.worksheets.add(sp.nombre);
      ws.showGridlines = false;
      /* 1 · fuera del tablero, gris; dentro, blanco */
      const q = parte(sp.marco.split(":")[1]);
      ws.getRange("A1:" + colLetras(q.c + FUERA_COLS) + (q.f + FUERA_FILAS)).format.fill.color = GRIS_FUERA;
      ws.getRange(sp.marco).format.fill.color = "#FFFFFF";
      ws.getRange("A1:" + colLetras(q.c + FUERA_COLS) + (q.f + FUERA_FILAS)).format.font.name = FUENTE;
      /* 2 · los nombres, antes que las fórmulas */
      for (const n of Object.keys(sp.nombres || {})) ws.names.add(n, ws.getRange(sp.nombres[n]));
      /* 3 y 4 · el formato de número y después los valores, cada uno en UNA escritura */
      const m = matrices(sp);
      const bloque = ws.getRange(m.rango);
      bloque.numberFormat = m.fmts;
      bloque.formulas = m.vals;
      /* 5 · combinar, después de escribir */
      for (const r of sp.combinar || []) ws.getRange(r).merge(false);
      /* 6 · anchos, alturas, estilos, rejilla, marco */
      for (const col of Object.keys(sp.anchos || {})) {
        ws.getRange(col + ":" + col).format.columnWidth = sp.anchos[col] * PT_POR_CARACTER;
      }
      for (const f of Object.keys(sp.alturas || {})) ws.getRange(f + ":" + f).format.rowHeight = sp.alturas[f];
      let n = 0;
      for (const dir of Object.keys(sp.celdas)) {
        const c = sp.celdas[dir], e = ESTILOS[c.estilo];
        if (e) aplicaEstilo(ws.getRange(c.rango || dir), e);
        n++;
      }
      for (const r of sp.bordes || []) rejilla(ws.getRange(r), "Thin", "#000000");
      borde(ws.getRange(sp.marco), "Thick", AZUL_MARCO);
      /* 7 · la impresión: el tablero, una página de ancho */
      if (o.impresion) {
        ws.pageLayout.setPrintArea(sp.marco);
        ws.pageLayout.orientation = "Portrait";
        ws.pageLayout.zoom = { horizontalFitToPages: 1, verticalFitToPages: 0 };
      }
      ws.activate();
      return context.sync().then(function () { return { nombre: sp.nombre, celdas: n }; });
    });
  }

  return { ART, ESTILOS, FUENTE, PT_POR_CARACTER, AZUL_MARCO, GRIS_FUERA, paraEnviar, matrices, escribe };
});
