/* =====================================================================
   escritor.js — copia una hoja de hojas.js al libro de Excel · E9

   Lo usa el PANEL, que es quien tiene Excel.run: la ventana del modelador
   arma la hoja y la manda por mensajes; aquí se escribe.  Recibe el
   `context` de Excel.run en vez de llamarlo, para que se pueda probar en
   Node con un Excel de juguete que apunta cada cosa que se le pide.

   El orden importa y está escrito:
     1. la hoja vieja se borra entera, y con ella sus nombres
     2. la nueva se crea y LOS NOMBRES VAN ANTES que las fórmulas que los usan
     3. en cada celda, el formato ANTES que el valor: con el texto «1.4-3»
        escrito en una celda General, Excel lo vuelve una fecha
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

  /* Los colores dicen QUÉ ES cada celda (fila H.formulas y H.analisis):
     azul el dato, morado la norma, negro la fórmula, verde el análisis. */
  const ESTILOS = {
    titulo: { bold: true, size: 14, color: "#1F3864" },
    seccion: { bold: true, color: "#FFFFFF", fill: "#1F3864" },
    cabecera: { bold: true, color: "#1F3864", fill: "#D9E1F2" },
    concepto: {},
    simbolo: { italic: true, color: "#404040" },
    dato: { color: "#0000FF", fill: "#FFF2CC" },
    modelo: { color: "#0000FF" },
    norma: { color: "#7030A0" },
    tabla: { color: "#7030A0" },
    formula: { bold: true, color: "#000000" },
    analisis: { color: "#00803C", fill: "#E2EFDA" },
    unidad: { color: "#404040" },
    como: { italic: true, color: "#404040" },
    fuente: { size: 9, color: "#595959" },
    nota: { italic: true, color: "#595959" }
  };
  const PT_POR_CARACTER = 6.5;      /* el ancho de columna, de caracteres a puntos */

  /* Lo que viaja por mensajes: sin `debe` ni `que`, que son de la guarda y no del libro */
  function paraEnviar(h) {
    exige(h && h.nombre && h.celdas, "paraEnviar() necesita una hoja de hojas.js");
    exige(!h.comprobacion || h.comprobacion.ok, "la hoja " + h.nombre + " no se manda: " +
      (h.comprobacion ? h.comprobacion.malas.length : 0) + " fórmula(s) no dan el número del motor (fila H.coincide)");
    const celdas = {};
    for (const dir of Object.keys(h.celdas)) {
      const c = h.celdas[dir], x = { estilo: c.estilo, fmt: c.fmt };
      if (c.f !== undefined) x.f = c.f; else x.v = c.v;
      celdas[dir] = x;
    }
    return { nombre: h.nombre, celdas: celdas, nombres: h.nombres, anchos: h.anchos };
  }

  /* escribe(context, hoja) → promesa · context es el de Excel.run */
  function escribe(context, sp) {
    exige(sp && sp.nombre && sp.celdas, "escribe() necesita una hoja");
    const wb = context.workbook;
    const vieja = wb.worksheets.getItemOrNullObject(sp.nombre);
    vieja.load("isNullObject");
    return context.sync().then(function () {
      if (!vieja.isNullObject) vieja.delete();
      return context.sync();
    }).then(function () {
      const ws = wb.worksheets.add(sp.nombre);
      for (const n of Object.keys(sp.nombres || {})) ws.names.add(n, ws.getRange(sp.nombres[n]));
      let n = 0;
      for (const dir of Object.keys(sp.celdas)) {
        const c = sp.celdas[dir], rg = ws.getRange(dir);
        rg.numberFormat = [[c.fmt || "General"]];
        if (c.f !== undefined) rg.formulas = [[c.f]];
        else rg.values = [[c.v === undefined || c.v === null ? "" : c.v]];
        const e = ESTILOS[c.estilo];
        if (e) {
          if (e.bold) rg.format.font.bold = true;
          if (e.italic) rg.format.font.italic = true;
          if (e.size) rg.format.font.size = e.size;
          if (e.color) rg.format.font.color = e.color;
          if (e.fill) rg.format.fill.color = e.fill;
        }
        n++;
      }
      for (const col of Object.keys(sp.anchos || {})) {
        ws.getRange(col + ":" + col).format.columnWidth = sp.anchos[col] * PT_POR_CARACTER;
      }
      ws.activate();
      return context.sync().then(function () { return { nombre: sp.nombre, celdas: n }; });
    });
  }

  return { ART, ESTILOS, PT_POR_CARACTER, paraEnviar, escribe };
});
