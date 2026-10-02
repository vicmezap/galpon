/* =====================================================================
   hojas.js — las hojas de cálculo que Galpón escribe en el libro · E9

   El cálculo se queda en las hojas (README): esto las arma.  Cada hoja
   sale como DATOS —celda por celda: valor o fórmula, estilo, formato— y la
   plantilla del panel solo las copia al libro con Excel.run.  Así se
   pueden comprobar enteras en Node, que es donde se puede comprobar.

   LAS FÓRMULAS SON VIVAS (fila H.formulas).  Una celda de resultado lleva
   la fórmula de Excel, no el número: =Lo*(0.25+4.6/SQRT(Ai)).  Cada
   magnitud tiene un NOMBRE de la hoja, que es su símbolo, para que la
   barra de fórmulas se lea como la norma y no como un crucigrama de
   celdas.  Los datos y las tablas de la norma también son celdas, y si
   alguien cambia la zona sísmica en la hoja, la hoja se recalcula.

   LO QUE NO CABE EN FÓRMULAS entra como valor y lo dice (fila H.analisis):
   el período y el peso sísmico de cada pórtico salen de resolver el
   pórtico, y un análisis matricial no se escribe en celdas.

   Y LA GUARDA (fila H.coincide): cada celda de resultado lleva `debe`, el
   número que da el motor por su lado.  excel.js evalúa la fórmula y, si no
   coincide, la hoja no se escribe.  Son dos escrituras de la misma cuenta,
   y así no pueden separarse sin que salte.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./excel.js"), require("./e020.js"),
      require("./viento.js"), require("./e030.js"), require("./combinaciones.js"), require("./analisis.js"),
      require("./acero.js"), require("./perfiles.js"), require("./ubicacion.js"), require("./zapatas.js"), require("./unidades.js"));
  } else {
    raiz.HOJAS = definir(raiz.INVENTARIO, raiz.EXCEL, raiz.E020, raiz.VIENTO, raiz.E030, raiz.COMBINACIONES,
      raiz.ANALISIS, raiz.ACERO, raiz.PERFILES, raiz.UBICACION, raiz.ZAPATAS, raiz.UNIDADES);
  }
})(typeof self !== "undefined" ? self : this, function (INV, EX, E020, VI, E030, CB, AN, AC, PF, UB, ZA, UN) {
  "use strict";

  const ART = INV.declara("hojas.js", [
    "H.formulas", "H.coincide", "H.analisis",
    "D.cobertura.peso", "Lr.liviana", "Lr.red.formula", "Lr.red.min40", "Lr.red.piso", "Lr.red.k",
    "N.Qs.min", "N.Qt.a", "N.Qt.b", "N.Qt.c", "N.desbal.corto", "N.desbal.largo",
    "W.Vh", "W.V.min", "W.Ph", "W.tipo", "W.T4", "W.T4.paralelas", "W.T5.repartidas", "W.C", "W.simultaneo",
    "S.Z", "S.U", "S.categoria.uso", "S.zona.distrito", "S.perfil", "S.sinVs30", "S.interp", "S.R0", "S.pendulo", "S.C.estatico", "S.CR", "S.V",
    "S.vertical", "A.sismo.periodo", "S.T.rayleigh", "S.P", "A.sismo.regular", "J.costura", "A.portico.tipico",
    "S.categoria.riesgo", "S.usos.combinados", "S.deriva.industrial", "A.sistema", "MAT.E", "C.Ec", "Z.As.min",
    "Z.sigma.neta", "MT.ejes", "D.cobertura.pendmin", "G.correa.inclinada", "G.correa.sep", "SV.correa.Ld", "SV.deflex",
    "D.cobertura.tabla", "D.cobertura.neta", "SV.viento.H", "S.despl", "S.deriva", "MT.no.diafragma", "MT.dos.direcciones",
    "MT.mismo.pano", "MT.continuidad", "MT.termica", "MT.deltaT", "MT.hastial", "G.peralte", "MT.alfa"
  ]);

  function exige(c, msg) { if (!c) throw new Error("hojas: " + msg); }
  const fte = (id) => id + " · " + ART[id];

  /* ---------- EL TABLERO · el formato «pizarra» de Retícula ----------------
     Lo que hacía desordenada la primera hoja, visto en Excel: las tablas de
     la norma corrían a la derecha desde la fila 1 mezcladas con el cálculo,
     la columna de fuentes se cortaba, y la tabla del viento usaba las mismas
     columnas con otro sentido.  Ahora es UN tablero de B a K, que se lee de
     arriba abajo: título, secciones numeradas, tablas con rejilla, y las
     tablas de la norma al final, como anexo.  Fuera del tablero, gris.

       C concepto · D símbolo · E valor · F unidad · G:I cómo se calcula · J norma

     El formato lo aplica escritor.js; aquí solo se dice QUÉ es cada celda. */
  const ANCHOS = { A: 2, B: 2, C: 38, D: 10, E: 13, F: 9, G: 12, H: 12, I: 12, J: 42, K: 2 };
  const PRIMERA = "B", ULTIMA = "K";
  const anchoDe = (r) => {           /* ancho en caracteres de un rango «G12:I12» o «C12» */
    const [a, b] = r.split(":");
    const ca = EX.parte(a).c, cb = EX.parte(b || a).c;
    let w = 0;
    for (let c = ca; c <= cb; c++) w += ANCHOS[EX.colLetras(c)] || 9;
    return w;
  };

  /* UN NOMBRE DE EXCEL no puede parecer una celda, ni en A1 (VS30 es una celda) ni en la notación F1C1 de
     NINGÚN idioma: «fc» lo rechazó el Excel en español, donde F es fila y C columna, y «Z» o «S» los rechazaría
     el alemán (Z1S1). Las letras de fila y columna: inglés e italiano R/C, español F/C, alemán Z/S, francés y
     portugués L/C, holandés y sueco R/K, polaco W/K. */
  const R1C1 = [["R", "C"], ["F", "C"], ["Z", "S"], ["L", "C"], ["R", "K"], ["W", "K"]];
  function nombreValido(n) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) return false;
    if (/^[A-Za-z]{1,3}\d+$/.test(n)) return false;
    const N = n.toUpperCase();
    return !R1C1.some(([f, c]) => new RegExp("^(" + f + "\\d*)?(" + c + "\\d*)?$").test(N));
  }
  function armador(nombre) {
    const h = { nombre: nombre, celdas: {}, nombres: {}, fila: 2, anchos: Object.assign({}, ANCHOS),
      combinar: [], bordes: [], alturas: {}, anexo: [], tablaDesde: null };
    /* todo texto lleva formato de texto: «1.4-3» o «1–2» no se pueden volver una fecha al escribirse.
       Y UNA FÓRMULA NUNCA: en una celda con formato de texto, Excel la guarda como texto y no la calcula
       (pasó con el inciso de la Tabla 4, y con él los Ce de los faldones salían #N/A) */
    h.pon = function (dir, c, rango) {
      exige(!h.celdas[dir], "la celda " + dir + " se escribe dos veces");
      if (typeof c.v === "string") c.fmt = "@";
      exige(!(c.f !== undefined && c.fmt === "@"), "la fórmula de " + dir + " iría en una celda de texto: Excel no la calcularía");
      if (rango && rango !== dir) { c.rango = rango; h.combinar.push(rango); }
      h.celdas[dir] = c;
      if (typeof c.v === "string" && ["como", "nota", "etiqueta", "fuente"].indexOf(c.estilo) >= 0) {
        /* Excel no ajusta el alto de las combinadas: se estima. La letra de 9 pt cabe un 35 % más por ancho */
        const porAncho = c.estilo === "etiqueta" ? 1.05 : 1.35;
        const lineas = Math.ceil((c.v.length + 1) / Math.max(anchoDe(rango || dir) * porAncho, 1));
        const fila = EX.parte(dir).f;
        h.alturas[fila] = Math.max(h.alturas[fila] || 16, 15 * lineas + 2);
      }
    };
    h.nombra = function (n, dir) {
      exige(nombreValido(n), "«" + n + "» no puede ser un nombre de Excel");
      exige(!h.nombres[n], "el nombre " + n + " se usa dos veces");
      h.nombres[n] = dir;
    };
    h.titulo = function (t, proyecto, leyenda) {
      h.pon("B2", { v: t, estilo: "titulo" }, "B2:K3");
      h.alturas[2] = 20; h.alturas[3] = 20;
      h.pon("B4", { v: proyecto, estilo: "proyecto" }, "B4:K4");
      h.pon("B5", { v: leyenda, estilo: "leyenda" }, "B5:K5");
      h.fila = 7;
    };
    h.cierraTabla = function () {
      if (h.tablaDesde !== null && h.fila > h.tablaDesde) h.bordes.push("C" + h.tablaDesde + ":J" + (h.fila - 1));
      h.tablaDesde = null;
    };
    h.seccion = function (t) {
      h.cierraTabla();
      if (h.fila > 7 && !h.celdas["C" + (h.fila - 1)] && !h.celdas["B" + (h.fila - 1)]) { /* ya hay una en blanco */ }
      else if (h.fila > 7) h.fila++;
      h.pon("B" + h.fila, { v: t, estilo: "seccion" }, "B" + h.fila + ":K" + h.fila);
      h.alturas[h.fila] = 22;
      h.fila += 2;
    };
    h.subseccion = function (t) {
      h.cierraTabla();
      h.pon("C" + h.fila, { v: t, estilo: "subseccion" }, "C" + h.fila + ":J" + h.fila);
      h.fila++;
    };
    h.nota = function (t) {
      h.cierraTabla();
      h.pon("C" + h.fila, { v: t, estilo: "nota" }, "C" + h.fila + ":J" + h.fila);
      h.fila += 1;
    };
    h.blanco = function () { h.cierraTabla(); h.fila++; };
    /* la cabecera de una tabla: [[rango de columnas «G:I», texto], ...] */
    h.cabecera = function (cols) {
      h.cierraTabla();
      h.tablaDesde = h.fila;
      for (const [cs, texto] of cols) {
        const [a, b] = cs.split(":");
        h.pon(a + h.fila, { v: texto, estilo: "cabecera" }, b ? a + h.fila + ":" + b + h.fila : null);
      }
      h.alturas[h.fila] = 30;
      h.fila++;
    };
    const CAB = [["C", "Concepto"], ["D", "Símbolo"], ["E", "Valor"], ["F", "Unidad"], ["G:I", "Cómo se calcula"], ["J", "Norma"]];
    h.cabeceraMagnitudes = () => h.cabecera(CAB);
    /* una magnitud: d = { n (nombre), que, v | f, debe, u, como, norma, estilo, fmt } */
    h.linea = function (d) {
      const r = h.fila;
      h.pon("C" + r, { v: d.que, estilo: "etiqueta" });
      if (d.n) { h.pon("D" + r, { v: d.n, estilo: "simbolo" }); h.nombra(d.n, "E" + r); }
      const c = { estilo: d.estilo || (d.f !== undefined ? "formula" : "dato"),
        fmt: d.fmt || (typeof d.v === "string" ? "@" : "0.00"), que: d.que };
      if (d.f !== undefined) {
        c.f = d.f;
        if (d.debe !== undefined) c.debe = d.debe;
        if (typeof d.debe === "string") c.fmt = "General";
      } else c.v = d.v;
      /* un texto largo sin unidad ni explicación (el distrito, el uso) ocupa de E a I */
      if (typeof d.v === "string" && d.v.length > 12 && !d.u && !d.como) {
        h.pon("E" + r, c, "E" + r + ":I" + r);
      } else {
        h.pon("E" + r, c);
        if (d.u) h.pon("F" + r, { v: d.u, estilo: "unidad" });
        if (d.como) h.pon("G" + r, { v: d.como, estilo: "como" }, "G" + r + ":I" + r);
        else h.combinar.push("G" + r + ":I" + r);
      }
      if (d.norma) h.pon("J" + r, { v: d.norma, estilo: "fuente" });
      h.fila++;
      return "E" + r;
    };
    /* una tabla de la norma, para el anexo: se escribe al final y sus columnas tienen nombre
       (pref + "_" + col) para buscar con INDEX/MATCH */
    h.tabla = function (d) { h.anexo.push(d); };
    h.escribeAnexo = function (numero) {
      h.seccion(numero + ". TABLAS DE LA NORMA QUE USAN LAS FÓRMULAS");
      h.nota("Las fórmulas de arriba buscan aquí con INDEX/MATCH. Cambiar un valor de estas tablas cambia el cálculo: " +
        "son las de la norma, y no se tocan.");
      h.blanco();
      const cols = ["D", "E", "F", "G"];
      h.anexo.forEach((d, i) => {
        h.subseccion(numero + "." + (i + 1) + "  " + d.titulo + "  ·  " + d.norma);
        h.cabecera([["C", d.clave]].concat(d.columnas.map((c, j) => [cols[j], c.titulo])).concat([["H:J", "Nota"]]));
        const f1 = h.fila;
        d.filas.forEach((fila) => {
          const r = h.fila;
          h.pon("C" + r, { v: fila.clave, estilo: "etiqueta", fmt: typeof fila.clave === "number" ? "0" : "@" });
          d.columnas.forEach((c, j) => {
            const v = fila.valores[j];
            if (v === null || v === undefined) return;
            if (v === "NA") h.pon(cols[j] + r, { f: "=NA()", estilo: "tabla", fmt: "General" });
            else h.pon(cols[j] + r, { v: v, estilo: "tabla", fmt: typeof v === "string" ? "@" : (c.fmt || "0.00") });
          });
          if (fila.nota) h.pon("H" + r, { v: fila.nota, estilo: "nota" }, "H" + r + ":J" + r);
          else h.combinar.push("H" + r + ":J" + r);
          h.fila++;
        });
        const f2 = h.fila - 1;
        h.nombra(d.pref + "_k", "C" + f1 + ":C" + f2);
        d.columnas.forEach((c, j) => h.nombra(d.pref + "_" + c.n, cols[j] + f1 + ":" + cols[j] + f2));
        h.blanco();
      });
    };
    /* el cierre: el marco y lo de fuera */
    h.cierra = function () {
      h.cierraTabla();
      h.ultima = h.fila;
      h.marco = PRIMERA + "2:" + ULTIMA + h.ultima;
    };
    return h;
  }

  const mm = (x) => String(x).replace(".", ",");

  /* =====================================================================
     LA HOJA CARGAS · d = { cargas (resultados.cargas), sitio, proyecto, interior, fachada
       (los .r del análisis de cada pórtico, o null), version, fecha }
     ===================================================================== */
  function hojaCargas(d) {
    const cg = d.cargas, s = d.sitio || {};
    exige(cg && cg.forma, "hojaCargas() necesita lo que sale de resultados.cargas()");
    exige(cg.completo, "las cargas no están completas: faltan " +
      (cg.faltan || []).map((x) => x.que).join(", "));
    const f = cg.forma, c = cg.cargas;
    const h = armador("CARGAS");
    const pr = d.proyecto || {};
    const art = (id) => ART[id];
    h.titulo("CARGAS Y COMBINACIONES",
      "Proyecto: " + (pr.nombre || "sin nombre") + (pr.ubicacion ? " · " + pr.ubicacion : "") +
        (pr.propietario ? " · propietario: " + pr.propietario : "") + (pr.proyectista ? " · proyectista: " + pr.proyectista : "") +
        "  ·  " + (d.fecha ? "escrita el " + d.fecha + " con " : "escrita con ") + "Galpón " + (d.version || ""),
      "Azul: dato del proyecto  ·  morado: valor de la norma  ·  negro: fórmula viva  ·  verde: sale del análisis.  " +
        "Cada fórmula se comprobó contra el motor antes de escribirse.");

    /* ---- LAS TABLAS DE LA NORMA, que van al anexo ---- */
    h.tabla({ titulo: "Peso de la cobertura TR-4", norma: art("D.cobertura.peso"), pref: "tCob", clave: "espesor (mm)",
      columnas: [{ n: "min", titulo: "desde (mm)", fmt: "0.00" }, { n: "max", titulo: "hasta (mm)", fmt: "0.00" },
        { n: "peso", titulo: "kgf/m²", fmt: "0.00" }],
      filas: E020.COBERTURA.map((r) => ({ clave: mm(r.min) + " – " + mm(r.max), valores: [r.min, r.max, r.peso] })) });
    h.tabla({ titulo: "Tipo de edificación para el viento", norma: art("W.tipo"), pref: "tTipo", clave: "tipo",
      columnas: [{ n: "f", titulo: "factor" }],
      filas: Object.keys(VI.TIPO_FACTOR).map((k) => ({ clave: +k, valores: [VI.TIPO_FACTOR[k]] })) });
    h.tabla({ titulo: "Tabla 4 · factor de forma exterior Ce", norma: art("W.T4"), pref: "tT4", clave: "superficie",
      columnas: [{ n: "bar1", titulo: "barlovento 1" }, { n: "bar2", titulo: "barlovento 2" }, { n: "sot", titulo: "sotavento" }],
      filas: ["vertical", "inc15", "inc1560", "inc60", "paralelas"].map((k) => ({ clave: k,
        valores: [VI.T4[k].barlovento[0], VI.T4[k].barlovento[1], VI.T4[k].sotavento], nota: VI.T4[k].que })) });
    h.tabla({ titulo: "Tabla 5 · factor de forma interior Ci", norma: art("W.T5.repartidas"), pref: "tT5",
      clave: "aberturas", columnas: [{ n: "ci1", titulo: "Ci 1" }, { n: "ci2", titulo: "Ci 2" }],
      filas: VI.ABERTURAS.map((k) => ({ clave: k, valores: [VI.T5[k].Ci[0], VI.T5[k].Ci[1]], nota: VI.T5[k].que })) });
    h.tabla({ titulo: "Factor de zona Z", norma: art("S.Z"), pref: "tZ", clave: "zona",
      columnas: [{ n: "v", titulo: "Z" }], filas: E030.ZONAS.map((k) => ({ clave: k, valores: [E030.Z[k]] })) });
    h.tabla({ titulo: "Factor de uso U", norma: art("S.U"), pref: "tU", clave: "categoría",
      columnas: [{ n: "v", titulo: "U" }], filas: Object.keys(E030.U).map((k) => ({ clave: k, valores: [E030.U[k]] })) });
    /* S, con el intervalo de la Tabla N° 4: el extremo del suelo más rígido y el del más blando */
    const filasS = [];
    for (const z of E030.ZONAS) {
      for (const su of E030.SUELOS) {
        const v = E030.TABLA_S[z][su];
        filasS.push({ clave: z + su, valores: v === null ? ["NA", "NA"] : (Array.isArray(v) ? v : [v, v]),
          nota: v === null ? "«Requiere un análisis de respuesta de sitio»" : null });
      }
    }
    h.tabla({ titulo: "Factor de suelo S, por zona y suelo", norma: art("S.perfil"), pref: "tS", clave: "zona · suelo",
      columnas: [{ n: "rig", titulo: "suelo más rígido", fmt: "0.000" }, { n: "bla", titulo: "suelo más blando", fmt: "0.000" }],
      filas: filasS });
    const par = (x) => (Array.isArray(x) ? x : [x, x]);
    h.tabla({ titulo: "Períodos TP y TL", norma: art("S.perfil"), pref: "tP",
      clave: "suelo", columnas: [{ n: "TPr", titulo: "TP rígido" }, { n: "TPb", titulo: "TP blando" },
        { n: "TLr", titulo: "TL rígido" }, { n: "TLb", titulo: "TL blando" }],
      filas: E030.SUELOS.map((k) => ({ clave: k, valores: par(E030.TABLA_TP[k]).concat(par(E030.TABLA_TL[k])) })) });
    h.tabla({ titulo: "V̄s30 de cada suelo (m/s)", norma: art("S.interp"), pref: "tVs", clave: "suelo",
      columnas: [{ n: "min", titulo: "desde", fmt: "0" }, { n: "max", titulo: "hasta", fmt: "0" }],
      filas: E030.SUELOS.map((k) => ({ clave: k, valores: [E030.VS30[k].min, isFinite(E030.VS30[k].max) ? E030.VS30[k].max : "∞"] })) });
    h.tabla({ titulo: "Coeficiente básico de reducción R₀", norma: art("S.R0"), pref: "tR",
      clave: "sistema", columnas: [{ n: "v", titulo: "R₀", fmt: "0.0" }],
      filas: E030.SISTEMAS.map((k) => ({ clave: k, valores: [E030.R0[k]] }))
        .concat([{ clave: "pendulo", valores: [E030.R0_PENDULO], nota: "péndulo invertido, " + art("S.pendulo") }]) });

    /* ---- 1 · GEOMETRÍA ---- */
    h.seccion("1. LA GEOMETRÍA QUE CARGA");
    h.cabeceraMagnitudes();
    h.linea({ n: "luz", que: "Luz del pórtico", v: f.luz_m, u: "m", estilo: "modelo", norma: "del modelo" });
    h.linea({ n: "sep", que: "Separación de pórticos", v: f.sep_m, u: "m", estilo: "modelo", norma: "del modelo" });
    h.linea({ n: "theta", que: "Pendiente del techo", v: f.theta_grad, u: "°", estilo: "modelo", fmt: "0.000",
      norma: "del modelo", como: "la mayor pendiente de la brida superior" });
    h.linea({ n: "hc", que: "Altura a la cumbre", v: f.hCumbre_m, u: "m", estilo: "modelo", fmt: "0.000", norma: "del modelo" });

    /* ---- 2 · GRAVEDAD ---- */
    h.seccion("2. CARGA MUERTA Y VIVA DE TECHO  ·  E.020 Art. 4, 7, 10 y 11");
    h.subseccion("2.1  Carga muerta");
    h.cabeceraMagnitudes();
    const esp = s.espesorCobertura_mm;
    h.linea({ n: "esp", que: "Espesor de la cobertura", v: esp, u: "mm", norma: "dato del proyecto" });
    h.linea({ n: "Dcob", que: "Peso de la cobertura", u: "kgf/m²", debe: E020.pesoCobertura(esp).peso_kgfm2,
      f: "=IF(esp<=INDEX(tCob_max,MATCH(esp,tCob_min,1)),INDEX(tCob_peso,MATCH(esp,tCob_min,1)),NA())",
      como: "de la tabla 6.1; #N/A si el espesor cae en un hueco: esa plancha no se fabrica", norma: art("D.cobertura.peso") });
    h.linea({ n: "Dotras", que: "Otras cargas muertas", v: s.Dotras_kgfm2 || 0, u: "kgf/m²", norma: "dato del proyecto" });
    h.linea({ n: "Dsup", que: "Carga muerta sobre la cobertura", u: "kgf/m²", debe: c.D_kgfm2, f: "=Dcob+Dotras",
      como: "Dcob + Dotras · el peso propio de los perfiles se suma en el análisis" });
    h.blanco();
    if (!s.hayNieve) {
      const vt = E020.vivaTecho({ tipo: "liviana", hayNieve: false });
      const rd = E020.reduceViva({ Lo_kgfm2: vt.Lo_kgfm2, At_m2: f.luz_m * f.sep_m });
      h.subseccion("2.2  Carga viva de techo, reducida por el área");
      h.cabeceraMagnitudes();
      h.linea({ n: "Lo", que: "Carga viva de techo, sin reducir", v: vt.Lo_kgfm2, u: "kgf/m²", estilo: "norma",
        fmt: "0", norma: art("Lr.liviana") });
      h.linea({ n: "At", que: "Área tributaria de un pórtico", u: "m²", f: "=luz*sep", debe: f.luz_m * f.sep_m,
        como: "luz × separación", fmt: "0.0" });
      h.linea({ n: "kLL", que: "Factor de la Tabla 3 (tijeral de techo liviano)", v: E020.K_TIJERAL_LIVIANO,
        estilo: "norma", fmt: "0", norma: art("Lr.red.k") });
      h.linea({ n: "Ai", que: "Área de influencia", u: "m²", f: "=kLL*At", debe: rd.Ai_m2, como: "k·At", fmt: "0.0" });
      h.linea({ n: "Lrb", que: "Viva reducida, sin topes", u: "kgf/m²", f: "=Lo*(0.25+4.6/SQRT(Ai))",
        debe: rd.bruto_kgfm2, como: "Lo·(0,25 + 4,6/√Ai)", norma: art("Lr.red.formula") });
      h.linea({ n: "Lr", que: "Carga viva de techo Lr", u: "kgf/m²", debe: c.Lr_kgfm2,
        f: "=IF(Ai<=40,Lo,MAX(0.5*Lo,MIN(Lo,Lrb)))",
        como: "sin reducir si Ai ≤ 40 m²; si no, entre 0,5·Lo y Lo", norma: art("Lr.red.min40") });
    } else {
      const qs = E020.nieveQs(s.Qs_kgfm2);
      const qt = E020.nieveQt({ Qs_kgfm2: s.Qs_kgfm2, theta_grad: f.theta_grad });
      const db = E020.nieveDesbalanceada({ Qt_kgfm2: qt.Qt_kgfm2, semiluz_m: f.luz_m / 2, theta_grad: f.theta_grad });
      h.subseccion("2.2  Nieve sobre el techo");
      h.cabeceraMagnitudes();
      h.linea({ n: "Qsd", que: "Carga básica de nieve del sitio", v: s.Qs_kgfm2, u: "kgf/m²", norma: "dato del proyecto" });
      h.linea({ n: "Qsmin", que: "Mínimo de la norma", v: E020.QS_MIN, u: "kgf/m²", estilo: "norma", fmt: "0",
        norma: art("N.Qs.min") });
      h.linea({ n: "Qs", que: "Nieve básica Qs", u: "kgf/m²", f: "=MAX(Qsmin,Qsd)", debe: qs.Qs_kgfm2, como: "con el mínimo" });
      h.linea({ n: "Qt", que: "Nieve sobre el techo Qt (proyección horizontal)", u: "kgf/m²", debe: qt.Qt_kgfm2,
        f: "=IF(theta<=15,Qs,IF(theta<=30,0.8*Qs,MAX(0,1-0.025*(theta-30))*0.8*Qs))",
        como: "θ ≤ 15°: Qs · θ ≤ 30°: 0,8·Qs · más: Cs·0,8·Qs, Cs = 1 − 0,025·(θ − 30)", norma: art("N.Qt.a") });
      h.linea({ n: "QdA", que: "Nieve desbalanceada, faldón cargado", u: "kgf/m²",
        debe: db.aplica ? db.faldonA_kgfm2 : "no aplica", f: "=IF(theta<=15,\"no aplica\",IF(luz/2<=6,1.3*Qt,1.5*Qt))",
        como: "θ > 15°: 1,3·Qt si ℓ/2 ≤ 6 m, 1,5·Qt si no", norma: art("N.desbal.corto") });
      h.linea({ n: "QdB", que: "Nieve desbalanceada, el otro faldón", u: "kgf/m²",
        debe: db.aplica ? db.faldonB_kgfm2 : "no aplica", f: "=IF(theta<=15,\"no aplica\",IF(luz/2<=6,0,0.3*Qt))",
        como: "0 si ℓ/2 ≤ 6 m, 0,3·Qt si no", norma: art("N.desbal.largo") });
    }

    /* ---- 3 · VIENTO ---- */
    h.seccion("3. VIENTO  ·  E.020 Cap. 3, Art. 12, Tablas 4 y 5");
    h.subseccion("3.1  Velocidad y presión de diseño");
    h.cabeceraMagnitudes();
    const vel = VI.velocidadDiseno({ V_kmh: s.V_kmh, h_m: f.hCumbre_m });
    h.linea({ n: "Vmapa", que: "Velocidad del Mapa Eólico", v: s.V_kmh, u: "km/h", fmt: "0", norma: "dato del proyecto · E.020 Anexo 2" });
    h.linea({ n: "tipoW", que: "Tipo de edificación", v: s.tipoEdificacion, fmt: "0", norma: art("W.tipo") });
    h.linea({ n: "Vmin", que: "Velocidad mínima", v: VI.V_MIN, u: "km/h", estilo: "norma", fmt: "0", norma: art("W.V.min") });
    h.linea({ n: "expV", que: "Exponente de la altura", v: VI.EXP_ALTURA, estilo: "norma", norma: art("W.Vh") });
    h.linea({ n: "Vbr", que: "Velocidad a la altura de la cumbre", u: "km/h", f: "=Vmapa*(hc/10)^expV",
      debe: vel.bruto_kmh, como: "V·(h/10)^0,22" });
    h.linea({ n: "Vh", que: "Velocidad de diseño Vh", u: "km/h", f: "=MAX(Vmin,Vbr)", debe: vel.Vh_kmh,
      como: "con el piso de 75 km/h", norma: art("W.Vh") });
    h.linea({ n: "Kp", que: "Constante de la presión", v: VI.K_PRESION, estilo: "norma", fmt: "0.000", norma: art("W.Ph") });
    h.linea({ n: "fTipo", que: "Factor del tipo de edificación", f: "=INDEX(tTipo_f,MATCH(tipoW,tTipo_k,0))",
      debe: VI.TIPO_FACTOR[s.tipoEdificacion], como: "de la tabla 6.2", norma: art("W.tipo") });
    h.linea({ n: "q", que: "Presión de referencia (C = 1)", u: "kgf/m²", f: "=Kp*Vh^2", debe: VI.K_PRESION * vel.Vh_kmh * vel.Vh_kmh,
      como: "0,005·Vh²", norma: art("W.Ph") });
    const ct = VI.ceTecho(f.theta_grad);
    h.linea({ n: "casoTecho", que: "Inciso de la Tabla 4 para el techo",
      f: "=IF(theta<=15,\"inc15\",IF(theta<=60,\"inc1560\",\"inc60\"))",
      debe: ct.caso, como: "por la pendiente: ≤ 15°, ≤ 60°, más", norma: art("W.T4") });
    const ab = s.aberturas || {};
    const DIRS = [["izqDer", "abID", "izquierda → derecha"], ["derIzq", "abDI", "derecha → izquierda"],
      ["longitudinal", "abL", "longitudinal"]];
    for (const [k, n, nom] of DIRS) {
      h.linea({ n: n, que: "Aberturas, viento " + nom, v: ab[k], norma: art("W.T5.repartidas") });
    }
    h.blanco();
    h.subseccion("3.2  Presión en cada superficie  ·  C = Ce − Ci ;  Ph = 0,005·C·Vh²·factor del tipo");
    h.nota("Cada superficie con cada Ci, todas a la vez en cada dirección (" + art("W.simultaneo") + "). " +
      "Ce de la tabla 6.3 y Ci de la tabla 6.4. Positivo: presión; negativo: succión.");
    h.cabecera([["C", "Dirección · superficie"], ["D", "Ce"], ["E", "Ci"], ["F", "C"], ["G", "Ph (kgf/m²)"], ["H:I", "Sentido"],
      ["J", "Norma"]]);
    const ceF = (clave, col) => "=INDEX(tT4_" + col + ",MATCH(" + clave + ",tT4_k,0))";
    const ciF = (n, i) => "=INDEX(tT5_ci" + (i + 1) + ",MATCH(" + n + ",tT5_k,0))";
    let filasW = 0;
    for (const [k, n, nom] of DIRS) {
      let sup;
      if (k === "longitudinal") {
        sup = [{ nombre: "techo y muros largos", ce: [["\"paralelas\"", "bar1", VI.T4.paralelas.barlovento[0]]] }];
      } else {
        const g = VI.casos({ V_kmh: s.V_kmh, h_m: f.hCumbre_m, theta_grad: f.theta_grad, aberturas: ab[k],
          tipo: s.tipoEdificacion });
        const de = {};
        for (const x of g.superficies) de[x.superficie] = x.casos;
        sup = [
          { nombre: "muro barlovento", ce: [["\"vertical\"", "bar1"]], casos: de["muro barlovento"] },
          { nombre: "muro sotavento", ce: [["\"vertical\"", "sot"]], casos: de["muro sotavento"] },
          { nombre: "faldón barlovento", ce: ct.barlovento.map((x, i) => ["casoTecho", "bar" + (i + 1)]),
            casos: de["faldón barlovento"] },
          { nombre: "faldón sotavento", ce: [["casoTecho", "sot"]], casos: de["faldón sotavento"] }];
      }
      const cis = VI.ci(ab[k]).Ci;
      for (const su of sup) {
        let m = 0;
        su.ce.forEach((ce) => {
          cis.forEach((ci, j) => {
            const r = h.fila;
            const eng = su.casos ? su.casos[m] : (() => {
              const C = ce[2] - ci;
              return { Ce: ce[2], Ci: ci, C: C, Ph_kgfm2: VI.presion({ C: C, Vh_kmh: vel.Vh_kmh, tipo: s.tipoEdificacion }).Ph_kgfm2 };
            })();
            m++;
            h.pon("C" + r, { v: nom + " · " + su.nombre, estilo: "etiqueta" });
            h.pon("D" + r, { f: ceF(ce[0], ce[1]), debe: eng.Ce, estilo: "formula", fmt: "0.00", que: su.nombre + " Ce" });
            h.pon("E" + r, { f: ciF(n, j), debe: eng.Ci, estilo: "formula", fmt: "0.00", que: su.nombre + " Ci" });
            h.pon("F" + r, { f: "=D" + r + "-E" + r, debe: eng.C, estilo: "formula", fmt: "0.00", que: su.nombre + " C" });
            h.pon("G" + r, { f: "=Kp*F" + r + "*Vh^2*fTipo", debe: eng.Ph_kgfm2, estilo: "formula", fmt: "0.00",
              que: su.nombre + " Ph" });
            h.pon("H" + r, { f: "=IF(F" + r + ">0,\"presión\",IF(F" + r + "<0,\"succión\",\"nula\"))",
              debe: eng.C > 0 ? "presión" : (eng.C < 0 ? "succión" : "nula"), estilo: "formula", fmt: "General",
              que: su.nombre + " sentido" }, "H" + r + ":I" + r);
            h.pon("J" + r, { v: art(k === "longitudinal" ? "W.T4.paralelas" : "W.C"), estilo: "fuente" });
            h.fila++; filasW++;
          });
        });
      }
    }

    /* ---- 4 · SISMO ---- */
    h.seccion("4. SISMO  ·  E.030-2026");
    h.subseccion("4.1  El sitio y la edificación");
    h.cabeceraMagnitudes();
    const pend = s.sistemaSismico === "pendulo";
    const st = E030.sitio({ zona: c.sismo.zona, suelo: s.suelo, vs30_ms: s.vs30_ms });
    const rr = E030.coefR({ pendulo: pend, sistema: pend ? undefined : s.sistemaSismico });
    h.linea({ que: "Distrito", v: c.sismo.distrito, norma: "dato del proyecto" });
    h.linea({ n: "zona", que: "Zona sísmica, por el distrito", v: c.sismo.zona, estilo: "norma", norma: art("S.zona.distrito") });
    h.linea({ n: "suelo", que: "Perfil de suelo", v: s.suelo, norma: "dato del proyecto (estudio de suelos)" });
    h.linea({ n: "vsMed", que: "V̄s30 medido (vacío si no hay)", v: typeof s.vs30_ms === "number" ? s.vs30_ms : "",
      u: "m/s", fmt: "0", norma: art("S.sinVs30") });
    const cat = c.sismo.categoria;
    h.linea({ que: "Uso de la edificación", v: E030.USOS[c.sismo.uso].nombre, norma: art("S.categoria.uso") });
    h.linea({ n: "categoria", que: "Categoría de la edificación (" + c.sismo.sub + "), por el uso", v: cat, estilo: "norma",
      norma: art("S.categoria.uso") });
    h.linea({ n: "sistema", que: "Sistema en la dirección transversal", v: s.sistemaSismico, norma: "dato del proyecto" });
    h.blanco();
    h.subseccion("4.2  Los factores de la fuerza sísmica");
    h.cabeceraMagnitudes();
    h.linea({ n: "Zf", que: "Factor de zona Z", f: "=INDEX(tZ_v,MATCH(zona,tZ_k,0))", debe: st.Z, como: "de la tabla 6.5",
      norma: art("S.Z") });
    h.linea({ n: "U", que: "Factor de uso U", f: "=INDEX(tU_v,MATCH(categoria,tU_k,0))", debe: E030.factorU(cat).U,
      como: "de la tabla 6.6", norma: art("S.U") });
    const look = (col) => "INDEX(tS_" + col + ",MATCH(zona&suelo,tS_k,0))";
    h.linea({ n: "uVs", que: "Posición en el intervalo del suelo (1 = el más blando)", fmt: "0.000",
      f: "=IF(OR(vsMed=\"\"," + look("rig") + "=" + look("bla") + "),1,MAX(0,MIN(1,(INDEX(tVs_max,MATCH(suelo,tVs_k,0))-vsMed)/" +
        "(INDEX(tVs_max,MATCH(suelo,tVs_k,0))-INDEX(tVs_min,MATCH(suelo,tVs_k,0))))))",
      como: "sin V̄s30: el extremo blando, del lado seguro; con él, interpolado", norma: art("S.sinVs30") });
    h.linea({ n: "Sf", que: "Factor de suelo S", fmt: "0.000", debe: st.S,
      f: "=" + look("rig") + "+uVs*(" + look("bla") + "-" + look("rig") + ")", como: "de la tabla 6.7", norma: art("S.perfil") });
    const lp = (col) => "INDEX(tP_" + col + ",MATCH(suelo,tP_k,0))";
    h.linea({ n: "TP", que: "Período TP", u: "s", debe: st.TP, f: "=" + lp("TPr") + "+uVs*(" + lp("TPb") + "-" + lp("TPr") + ")",
      como: "de la tabla 6.8", norma: art("S.perfil") });
    h.linea({ n: "TL", que: "Período TL", u: "s", debe: st.TL, f: "=" + lp("TLr") + "+uVs*(" + lp("TLb") + "-" + lp("TLr") + ")",
      como: "de la tabla 6.8", norma: art("S.perfil") });
    h.linea({ n: "Rbase", que: "Coeficiente básico R₀", fmt: "0.0", f: "=INDEX(tR_v,MATCH(sistema,tR_k,0))", debe: rr.R0,
      como: "de la tabla 6.10", norma: art(pend ? "S.pendulo" : "S.R0") });
    h.linea({ n: "Ia", que: "Irregularidad en altura Ia", v: 1, estilo: "norma", norma: art("A.sismo.regular") });
    h.linea({ n: "Ip", que: "Irregularidad en planta Ip", v: 1, estilo: "norma", norma: art("A.sismo.regular") });
    h.linea({ n: "Rs", que: "Coeficiente de reducción R", fmt: "0.0", f: "=Rbase*Ia*Ip", debe: rr.R, como: "R₀·Ia·Ip" });
    h.linea({ n: "CRmin", que: "Mínimo de C/R", v: E030.CR_MIN, estilo: "norma", norma: art("S.CR") });
    h.linea({ n: "fV", que: "Fracción de la vertical", v: AN.FRACCION_VERTICAL, estilo: "norma", fmt: "0.000",
      norma: art("S.vertical") });
    h.linea({ n: "Evf", que: "Sismo vertical, fracción del peso", fmt: "0.000", f: "=fV*Zf*U*Sf",
      debe: AN.FRACCION_VERTICAL * st.Z * E030.factorU(cat).U * st.S, como: "2/3·Z·U·S, sin dividir por R",
      norma: art("S.vertical") });
    h.linea({ n: "fT", que: "Factor del período por los elementos no estructurales", v: AN.FACTOR_T_NO_ESTRUCTURAL,
      estilo: "norma", norma: art("A.sismo.periodo") });

    let sub = 3;
    for (const [nom, suf, r] of [["pórtico interior", "i", d.interior], ["pórtico de fachada", "f", d.fachada]]) {
      h.blanco();
      h.subseccion("4." + (sub++) + "  El cortante basal del " + nom);
      if (!r || !r.sismo) {
        h.nota("Sale del análisis, que todavía no corre: el período y el peso de este pórtico no se pueden escribir.");
        continue;
      }
      const z = r.sismo;
      h.cabeceraMagnitudes();
      h.linea({ n: "Tray_" + suf, que: "Período por Rayleigh, con el pórtico resuelto", v: z.T_rayleigh_s, u: "s",
        estilo: "analisis", fmt: "0.0000", como: "del análisis: no cabe en fórmulas", norma: art("S.T.rayleigh") });
      h.linea({ n: "T_" + suf, que: "Período T", u: "s", fmt: "0.0000", f: "=fT*Tray_" + suf, debe: z.T_s, como: "0,85·T Rayleigh",
        norma: art("A.sismo.periodo") });
      h.linea({ n: "P_" + suf, que: "Peso sísmico: D + 25 % de la viva de techo", v: z.P_kgf, u: "kgf",
        estilo: "analisis", fmt: "0", como: "del análisis: la suma de sus nudos", norma: art("S.P") });
      h.linea({ n: "Cs_" + suf, que: "Factor de amplificación C", fmt: "0.000", debe: z.C,
        f: "=IF(T_" + suf + "<=TP,2.5,IF(T_" + suf + "<TL,2.5*TP/T_" + suf + ",2.5*TP*TL/T_" + suf + "^2))",
        como: "estático: 2,5 hasta TP, sin rampa", norma: art("S.C.estatico") });
      h.linea({ n: "CR_" + suf, que: "C/R", fmt: "0.0000", f: "=Cs_" + suf + "/Rs", debe: z.CR });
      h.linea({ n: "CRu_" + suf, que: "C/R que se usa", fmt: "0.0000", f: "=MAX(CRmin,CR_" + suf + ")", debe: z.CR_usado,
        como: "no menos de 0,11", norma: art("S.CR") });
      h.linea({ n: "V_" + suf, que: "Cortante basal V", u: "kgf", fmt: "0", f: "=Zf*U*CRu_" + suf + "*Sf*P_" + suf, debe: z.V_kgf,
        como: "Z·U·(C/R)·S·P", norma: art("S.V") });
      h.linea({ n: "Ev_" + suf, que: "Sismo vertical", u: "kgf", fmt: "0", f: "=Evf*P_" + suf, debe: z.Ev_kgf,
        como: "fracción × P", norma: art("S.vertical") });
    }

    /* ---- 5 · COMBINACIONES ---- */
    h.seccion("5. COMBINACIONES DE CARGA");
    h.nota("Se guardan los casos, nunca las combinaciones: el acero (E.090) y el concreto (E.060) arman las suyas con " +
      "factores distintos (" + art("J.costura") + ").");
    const casos = { D: true, Lr: !s.hayNieve, S: !!s.hayNieve, W: true, E: true };
    let k5 = 1;
    for (const [titulo, fam] of [["Para el acero · E.090 §1.4.1", CB.paraAcero({ casos: casos }).combinaciones],
      ["Para el concreto · E.060 §9.2", CB.paraConcreto({ casos: casos }).combinaciones]]) {
      h.blanco();
      h.subseccion("5." + (k5++) + "  " + titulo);
      const nombres = [];
      for (const cb of fam) for (const [k] of cb.terminos) if (nombres.indexOf(k) < 0) nombres.push(k);
      exige(nombres.length <= 4, "más de cuatro casos en una combinación: no caben en el tablero");
      const cols = ["E", "F", "G", "H"].slice(0, nombres.length);
      h.cabecera([["C", "Combinación"], ["D", "id"]].concat(nombres.map((k, i) => [cols[i], k])).concat([["J", "Norma"]]));
      for (const cb of fam) {
        const r = h.fila;
        h.pon("C" + r, { v: cb.texto, estilo: "etiqueta" });
        h.pon("D" + r, { v: cb.id, estilo: "simbolo" });
        for (const [k, fac] of cb.terminos) h.pon(cols[nombres.indexOf(k)] + r, { v: fac, estilo: "norma", fmt: "0.00" });
        h.pon("J" + r, { v: cb.art, estilo: "fuente" });
        h.fila++;
      }
    }

    /* ---- 6 · EL ANEXO ---- */
    h.blanco();
    h.escribeAnexo(6);
    h.cierra();

    const chk = EX.comprueba(h);
    return { nombre: h.nombre, celdas: h.celdas, nombres: h.nombres, anchos: h.anchos, combinar: h.combinar,
      bordes: h.bordes, alturas: h.alturas, marco: h.marco, ultima: h.ultima, filas: h.ultima,
      comprobacion: chk, filasViento: filasW, art: ART["H.formulas"] };
  }

  /* una verificación: la fórmula da «cumple» o «no cumple», y el motor dice cuál debe dar */
  const veredicto = (ok) => (ok ? "cumple" : "no cumple");
  const SI = (cond) => "=IF(" + cond + ",\"cumple\",\"no cumple\")";
  function cabeceraProyecto(h, titulo, d) {
    const pr = d.proyecto || {};
    h.titulo(titulo,
      "Proyecto: " + (pr.nombre || "sin nombre") + (pr.ubicacion ? " · " + pr.ubicacion : "") +
        (pr.propietario ? " · propietario: " + pr.propietario : "") + (pr.proyectista ? " · proyectista: " + pr.proyectista : "") +
        "  ·  " + (d.fecha ? "escrita el " + d.fecha + " con " : "escrita con ") + "Galpón " + (d.version || ""),
      "Azul: dato del proyecto  ·  morado: valor de la norma  ·  negro: fórmula viva  ·  verde: sale del análisis.  " +
        "Cada fórmula se comprobó contra el motor antes de escribirse.");
  }
  const cerrar = (h, extra) => {
    h.cierra();
    const chk = EX.comprueba(h);
    return Object.assign({ nombre: h.nombre, celdas: h.celdas, nombres: h.nombres, anchos: h.anchos, combinar: h.combinar,
      bordes: h.bordes, alturas: h.alturas, marco: h.marco, ultima: h.ultima, filas: h.ultima, comprobacion: chk,
      art: ART["H.formulas"] }, extra || {});
  };

  /* =====================================================================
     LA HOJA DATOS · las especificaciones del proyecto: todo lo que se eligió,
     y lo que sale solo de ello (como en Datos del modelador).
     d = { modelo, version, fecha }
     ===================================================================== */
  function hojaDatos(d) {
    const m = d.modelo || {}, s = m.sitio || {}, c = m.cimentacion || {}, dz = m.diseno || {}, sis = m.sistema || {};
    const h = armador("DATOS");
    cabeceraProyecto(h, "DATOS DEL PROYECTO", Object.assign({}, d, { proyecto: m.proyecto }));
    const art = (id) => ART[id];
    const tx = (x) => (x === undefined || x === null || x === "" ? "—" : String(x));
    const pr = m.proyecto || {};

    h.seccion("1. EL PROYECTO");
    h.cabeceraMagnitudes();
    h.linea({ que: "Nombre", v: tx(pr.nombre), norma: "dato del proyecto" });
    h.linea({ que: "Ubicación", v: tx(pr.ubicacion), norma: "dato del proyecto" });
    h.linea({ que: "Propietario", v: tx(pr.propietario), norma: "dato del proyecto" });
    h.linea({ que: "Proyectista", v: tx(pr.proyectista), norma: "dato del proyecto" });

    h.seccion("2. EL SITIO Y LA EDIFICACIÓN  ·  E.030-2026");
    h.subseccion("2.1  El sitio");
    h.cabeceraMagnitudes();
    const p = s.distrito ? UB.partes(s.distrito) : null;
    h.linea({ que: "Distrito", v: p ? p.distrito + " · " + p.provincia + " · " + p.departamento : "—", norma: "dato del proyecto" });
    h.linea({ que: "Zona sísmica, por el distrito", v: p ? p.zona : "—", estilo: "norma", norma: art("S.zona.distrito") });
    h.linea({ que: "Perfil de suelo", v: tx(s.suelo), norma: "dato del proyecto (estudio de suelos)" });
    h.linea({ que: "V̄s30 medido", v: typeof s.vs30_ms === "number" ? s.vs30_ms : "no se midió", u: typeof s.vs30_ms === "number" ? "m/s" : null,
      fmt: "0", norma: art("S.sinVs30") });
    h.linea({ que: "Velocidad del viento del Mapa Eólico", v: s.V_kmh, u: "km/h", fmt: "0", norma: "dato del proyecto · E.020 Anexo 2" });
    h.blanco();
    h.subseccion("2.2  La edificación");
    h.cabeceraMagnitudes();
    h.linea({ que: "Uso", v: s.uso && E030.USOS[s.uso] ? E030.USOS[s.uso].nombre : "—", norma: art("S.categoria.uso") });
    if (s.uso && E030.USOS[s.uso] && E030.USOS[s.uso].conRiesgo) {
      h.linea({ que: "¿Su falla acarrea incendio o fuga de contaminantes?", v: s.riesgoAdicional ? "sí" : "no", norma: art("S.categoria.riesgo") });
    }
    h.linea({ que: "Otra parte con otro uso", v: s.usoSecCat && s.usoSecCat !== "no" ? s.usoSecCat + " en el " + s.usoSecPct + " % del área" : "no",
      norma: art("S.usos.combinados") });
    h.linea({ que: "Uso industrial (límite de la deriva)", v: s.industrial ? "sí" : "no", norma: art("S.deriva.industrial") });
    h.linea({ que: "Tipo de edificación para el viento", v: s.tipoEdificacion, fmt: "0", norma: art("W.tipo") });
    for (const [k, nom] of [["izqDer", "izquierda → derecha"], ["derIzq", "derecha → izquierda"], ["longitudinal", "longitudinal"]]) {
      h.linea({ que: "Aberturas, viento " + nom, v: tx((s.aberturas || {})[k]), norma: art("W.T5.repartidas") });
    }
    h.linea({ que: "Sistema sísmico transversal", v: tx(s.sistemaSismico), norma: art("S.R0") });

    h.seccion("3. LOS MATERIALES");
    h.subseccion("3.1  Acero de los perfiles");
    h.cabeceraMagnitudes();
    h.linea({ n: "acero", que: "Acero", v: tx(s.acero), norma: "dato del proyecto" });
    if (AC.ACEROS[s.acero]) {
      const mt = AC.material(s.acero);
      h.linea({ n: "Fy", que: "Fluencia Fy", v: mt.Fy, u: "kgf/cm²", estilo: "norma", fmt: "0", norma: mt.art });
      h.linea({ n: "Fu", que: "Rotura Fu", v: mt.Fu, u: "kgf/cm²", estilo: "norma", fmt: "0", norma: mt.art });
    }
    h.linea({ n: "Eacero", que: "Módulo de elasticidad E", v: INV.num("MAT.E"), u: "kgf/cm²", estilo: "norma", fmt: "#,##0",
      norma: art("MAT.E") });
    h.blanco();
    h.subseccion("3.2  Concreto y armadura");
    h.cabeceraMagnitudes();
    h.linea({ n: "fpc", que: "f'c del concreto", v: c.fc_kgcm2, u: "kgf/cm²", fmt: "0", norma: "dato del proyecto" });
    if (c.fc_kgcm2 > 0) {
      h.linea({ n: "Ec", que: "Módulo de elasticidad Ec", f: "=15000*SQRT(fpc)", debe: 15000 * Math.sqrt(c.fc_kgcm2), u: "kgf/cm²",
        fmt: "#,##0", como: "15 000·√f'c", norma: art("C.Ec") });
    }
    h.linea({ que: "Acero de refuerzo", v: c.grado ? "grado " + c.grado : "—", norma: "dato del proyecto" });
    if (ZA.GRADOS[c.grado]) {
      h.linea({ n: "fyr", que: "Fluencia fy", v: UN.mpa_a_kgcm2(ZA.GRADOS[c.grado]), u: "kgf/cm²", estilo: "norma", fmt: "0",
        como: ZA.GRADOS[c.grado] + " MPa", norma: art("Z.As.min") });
    }
    h.linea({ que: "Electrodo de las uniones del tijeral", v: tx(dz.electrodo), norma: "dato del proyecto" });
    h.linea({ que: "Pernos de anclaje", v: c.pernoMat ? c.pernoMat + " · Ø" + c.pernoD + "\"" : "—", norma: "dato del proyecto" });
    h.blanco();
    h.subseccion("3.3  El suelo");
    h.cabeceraMagnitudes();
    h.linea({ n: "sigmaT", que: "Presión admisible del estudio de suelos", v: c.sigmaAdm_kgfcm2, u: "kgf/cm²", norma: "dato del proyecto" });
    h.linea({ que: "Esa presión es", v: c.esNeta === true ? "neta" : (c.esNeta === false ? "bruta" : "—"), norma: art("Z.sigma.neta") });
    h.linea({ n: "Df", que: "Profundidad de desplante", v: c.Df_cm, u: "cm", fmt: "0", norma: "dato del proyecto" });
    h.linea({ n: "gamaR", que: "Peso específico del relleno", v: c.gammaRelleno_kgfm3, u: "kgf/m³", fmt: "0", norma: "dato del proyecto" });
    h.linea({ n: "scPiso", que: "Sobrecarga sobre el piso", v: c.sc_kgfm2, u: "kgf/m²", fmt: "0", norma: "dato del proyecto" });
    if (c.sigmaAdm_kgfcm2 > 0 && c.esNeta === false && c.Df_cm > 0 && c.gammaRelleno_kgfm3 > 0 && c.sc_kgfm2 >= 0) {
      h.linea({ n: "snMin", que: "Presión neta con h = 0 (la más baja)", f: "=sigmaT-gamaR/1000000*Df-scPiso/10000",
        debe: c.sigmaAdm_kgfcm2 - c.gammaRelleno_kgfm3 / 1e6 * c.Df_cm - c.sc_kgfm2 / 1e4, u: "kgf/cm²",
        como: "σt − γ·Df − s/c; el peralte de la zapata la sube", norma: art("Z.sigma.neta") });
    }
    h.linea({ que: "Coeficiente de rozamiento μ", v: c.mu === undefined ? "—" : c.mu, norma: "dato del proyecto" });

    h.seccion("4. EL SISTEMA Y EL DISEÑO");
    h.cabeceraMagnitudes();
    h.linea({ que: "Base de las columnas", v: tx(sis.base), norma: art("A.sistema") });
    h.linea({ que: "Unión columna–tijeral", v: tx(sis.union), norma: art("A.sistema") });
    h.linea({ que: "Arriostre lateral de la brida inferior cada", v: dz.arriostreInferior_m, u: "m", norma: "dato del proyecto" });
    h.linea({ que: "Separación de los largueros", v: dz.separacionLargueros_m, u: "m", norma: "dato del proyecto" });
    h.linea({ que: "Lb de la columna", v: dz.LbColumna_m, u: "m", norma: "dato del proyecto" });
    h.linea({ que: "Ángulos dobles: separación", v: dz.cartela ? "cartela de " + dz.cartela + "\"" : "—", norma: "dato del proyecto" });
    h.linea({ que: "Uniones de las barras del tijeral", v: dz.uniones === "soldadas" ? "soldadas · filetes de " + dz.filete_mm +
      " mm × " + dz.soldadura_cm + " cm" : tx(dz.uniones), norma: "dato del proyecto" });
    h.linea({ que: "Tensores por correa en cada paño", v: dz.tensores, fmt: "0", norma: "dato del proyecto" });

    h.seccion("5. LOS PERFILES");
    h.cabecera([["C", "Clase de barra"], ["D", "Perfil"], ["E", "Peso"], ["F", "Unidad"], ["G:I", "Familia"], ["J", "Catálogo"]]);
    const porClase = (m.secciones && m.secciones.porClase) || {};
    for (const clase of Object.keys(porClase)) {
      const r = h.fila;
      let p2 = null;
      try { p2 = PF.busca(porClase[clase]); } catch (e) { p2 = null; }
      h.pon("C" + r, { v: clase, estilo: "etiqueta" });
      h.pon("D" + r, { v: porClase[clase], estilo: "dato" });
      if (p2) {
        h.pon("E" + r, { v: p2.peso_kgfm, estilo: "norma", fmt: "0.00" });
        h.pon("F" + r, { v: "kg/m", estilo: "unidad" });
        h.pon("G" + r, { v: p2.familia + " · " + p2.fabricacion, estilo: "como" }, "G" + r + ":I" + r);
        h.pon("J" + r, { v: p2.catalogo, estilo: "fuente" });
      } else h.combinar.push("G" + r + ":I" + r);
      h.fila++;
    }
    return cerrar(h);
  }

  /* =====================================================================
     LA HOJA GEOMETRÍA · por qué esta altura, esta separación, este peralte.
     Cada medida la decide el proyectista; aquí se dice QUÉ LA VERIFICA, con su
     fórmula, y donde la norma no da criterio se dice (fila G.peralte).
     d = { modelo, m3, forma, interior, fachada (los .r), correas, largo (lo), version, fecha }
     ===================================================================== */
  function hojaGeometria(d) {
    const m = d.modelo || {}, m3 = d.m3, f = d.forma, s = m.sitio || {};
    exige(m3 && f, "hojaGeometria() necesita el galpón montado");
    const P0 = m.parametros || {};
    const h = armador("GEOMETRIA");
    cabeceraProyecto(h, "GEOMETRÍA · POR QUÉ ESTAS MEDIDAS", Object.assign({}, d, { proyecto: m.proyecto }));
    const art = (id) => ART[id];
    h.nota("La luz, el largo y la altura los fija el uso del galpón, y son del proyectista. Lo que esta hoja dice es qué " +
      "verifica cada medida: la separación de pórticos, la correa y el panel de la cobertura; la pendiente, la cobertura; " +
      "la altura, la deriva; el peralte, el diseño del tijeral.");
    h.blanco();

    /* 1 · la nave */
    h.seccion("1. LA NAVE");
    h.cabeceraMagnitudes();
    h.linea({ n: "luz", que: "Luz del pórtico", v: f.luz_m, u: "m", estilo: "modelo", norma: "dato del proyecto" });
    h.linea({ n: "largo", que: "Largo de la nave", v: m3.ejes.largo_m, u: "m", estilo: "modelo", norma: "dato del proyecto" });
    h.linea({ n: "sepPed", que: "Separación de pórticos pedida", v: m3.ejes.sepPedida_m, u: "m", estilo: "modelo", norma: "dato del proyecto" });
    h.linea({ n: "nPan", que: "Número de paños", f: "=ROUND(largo/sepPed,0)", debe: m3.ejes.panos, fmt: "0",
      como: "largo / separación, redondeado", norma: art("MT.ejes") });
    h.linea({ n: "sep", que: "Separación real de pórticos", f: "=largo/nPan", debe: m3.ejes.sepPorticos_m, u: "m", fmt: "0.000",
      como: m3.ejes.ajustada ? "ajustada para que quepa entera" : "cabe entera", norma: art("MT.ejes") });
    h.linea({ n: "nPort", que: "Número de pórticos", f: "=nPan+1", debe: m3.ejes.porticos, fmt: "0", como: "paños + 1" });
    h.linea({ n: "area", que: "Área en planta", f: "=luz*largo", debe: f.luz_m * m3.ejes.largo_m, u: "m²", fmt: "0.0" });
    h.linea({ n: "hcol", que: "Altura de columna", v: P0.alturaColumna_m, u: "m", estilo: "modelo", norma: "dato del proyecto" });
    h.linea({ n: "hApoyo", que: "Peralte del tijeral en el apoyo", v: P0.peralteApoyo_m, u: "m", estilo: "modelo", norma: "dato del proyecto" });
    h.linea({ n: "pendPct", que: "Pendiente del techo", v: 100 * P0.pendiente, u: "%", estilo: "modelo", fmt: "0.0",
      norma: "dato del proyecto" });
    if (m3.tijeral.cuerdas === "dos_aguas") {
      h.linea({ n: "hc", que: "Altura a la cumbre", f: "=hcol+hApoyo+pendPct/100*luz/2", debe: f.hCumbre_m, u: "m", fmt: "0.000",
        como: "columna + peralte en el apoyo + pendiente × media luz" });
    } else {
      h.linea({ n: "hc", que: "Altura a la cumbre", v: f.hCumbre_m, u: "m", estilo: "modelo", fmt: "0.000", norma: "del modelo" });
    }

    /* 2 · el tijeral */
    h.seccion("2. EL TIJERAL: PENDIENTE, PANELES Y PERALTE");
    h.subseccion("2.1  La pendiente, contra la cobertura");
    h.cabeceraMagnitudes();
    h.linea({ n: "theta", que: "Ángulo del techo", f: "=DEGREES(ATAN(pendPct/100))", debe: f.theta_grad, u: "°", fmt: "0.00",
      como: "atan(pendiente)" });
    for (const [n, que, min] of [["pCosta", "costa", 5], ["pSierra", "sierra", 20], ["pSelva", "selva", 25]]) {
      h.linea({ n: n, que: "Pendiente recomendable de la TR-4 en la " + que, v: min, u: "%", estilo: "norma", fmt: "0",
        norma: art("D.cobertura.pendmin") });
      h.linea({ que: "  ¿la pendiente basta en la " + que + "?", f: SI("pendPct>=" + n), debe: veredicto(100 * P0.pendiente >= min - 1e-9),
        como: "pendiente ≥ la recomendable", norma: art("D.cobertura.pendmin") });
    }
    h.blanco();
    h.subseccion("2.2  Los paneles: cada nudo de la brida superior lleva una correa");
    h.cabeceraMagnitudes();
    h.linea({ n: "pan", que: "Paneles por media luz", v: P0.paneles, estilo: "modelo", fmt: "0", norma: "dato del proyecto" });
    h.linea({ n: "paso", que: "Paso de panel, en planta", f: "=luz/2/pan", debe: m3.tijeral.paso_m, u: "m", fmt: "0.000",
      como: "media luz / paneles" });
    h.linea({ n: "pasoI", que: "Separación de correas, sobre la pendiente", f: "=paso*SQRT(1+(pendPct/100)^2)",
      debe: m3.tijeral.paso_m * Math.sqrt(1 + P0.pendiente * P0.pendiente), u: "m", fmt: "0.000",
      como: "paso·√(1 + s²): la luz del panel se mide sobre el techo", norma: art("G.correa.inclinada") });
    h.linea({ n: "sepMin", que: "Separación habitual de correas, desde", v: 0.61, u: "m", estilo: "norma", norma: art("G.correa.sep") });
    h.linea({ n: "sepMax", que: "Separación habitual de correas, hasta", v: 1.83, u: "m", estilo: "norma", norma: art("G.correa.sep") });
    const pasoI = m3.tijeral.paso_m * Math.sqrt(1 + P0.pendiente * P0.pendiente);
    h.linea({ que: "  ¿en el rango habitual?", f: "=IF(AND(pasoI>=sepMin,pasoI<=sepMax),\"dentro\",\"fuera\")",
      debe: pasoI >= 0.61 - 1e-9 && pasoI <= 1.83 + 1e-9 ? "dentro" : "fuera", como: "es costumbre, no norma: lo que manda es el panel (3.2)",
      norma: art("G.correa.sep") });
    h.blanco();
    h.subseccion("2.3  El peralte");
    h.cabeceraMagnitudes();
    h.linea({ n: "hCum", que: "Peralte del tijeral en la cumbre", v: m3.tijeral.peralteCumbre_m, u: "m", estilo: "modelo", fmt: "0.000",
      norma: "del modelo" });
    h.linea({ n: "LhApoyo", que: "Luz / peralte en el apoyo", f: "=luz/hApoyo", debe: f.luz_m / P0.peralteApoyo_m, fmt: "0.0" });
    h.linea({ n: "LhCumbre", que: "Luz / peralte en la cumbre", f: "=luz/hCum", debe: f.luz_m / m3.tijeral.peralteCumbre_m, fmt: "0.0" });
    h.nota("No hay una relación luz/peralte con fuente leída (fila G.peralte, pendiente: no está en McCormac, Zapata, Neufert ni " +
      "la E.090). El peralte se justifica por lo que verifica: la resistencia de cada barra del tijeral en la hoja DISEÑO, " +
      "y la rigidez del pórtico en la deriva (sección 4).");

    /* 3 · correas y cobertura */
    const cr = d.correas;
    h.seccion("3. LA SEPARACIÓN DE PÓRTICOS: LA CORREA Y EL PANEL");
    if (cr && cr.ok && !cr.omitida) {
      const pc = PF.busca(cr.perfil);
      h.subseccion("3.1  La correa salva la separación de pórticos");
      h.cabeceraMagnitudes();
      h.linea({ que: "Perfil de la correa", v: cr.perfil, norma: "dato del proyecto" });
      h.linea({ n: "dCor", que: "Peralte de la correa", v: pc.d_cm, u: "cm", estilo: "norma", norma: pc.catalogo });
      h.linea({ n: "LdCor", que: "Esbeltez L/d", f: "=sep*100/dCor", debe: cr.Ld.Ld, fmt: "0.0", como: "separación / peralte" });
      h.linea({ n: "FyCor", que: "Fy del acero", v: AC.material(s.acero).Fy, u: "kgf/cm²", estilo: "norma", fmt: "0" });
      h.linea({ n: "LdMax", que: "L/d máximo", f: "=70450/FyCor", debe: cr.Ld.limite, fmt: "0.0", como: "70 450 / Fy", norma: art("SV.correa.Ld") });
      h.linea({ que: "  ¿esbeltez aceptable?", f: SI("LdCor<=LdMax"), debe: veredicto(cr.Ld.pasa), como: "criterio adoptado, no norma",
        norma: art("SV.correa.Ld") });
      h.linea({ n: "flCor", que: "Flecha de la correa con 0,5·Lr", v: cr.deflexion.delta_cm, u: "cm", estilo: "analisis", fmt: "0.000",
        como: "del cálculo de la correa", norma: art("SV.deflex") });
      h.linea({ n: "flMax", que: "Flecha admisible L/240", f: "=sep*100/240", debe: cr.deflexion.limite_cm, u: "cm", fmt: "0.000",
        norma: art("SV.deflex") });
      h.linea({ que: "  ¿flecha aceptable?", f: SI("flCor<=flMax"), debe: veredicto(cr.deflexion.pasa), norma: art("SV.deflex") });
      h.linea({ n: "ratioCor", que: "Ratio de resistencia de la correa", v: cr.peor ? cr.peor.ratio : cr.lineas.reduce((a, l) => Math.max(a, l.ratio || 0), 0),
        estilo: "analisis", fmt: "0.000", como: "la peor línea, flexión biaxial AISC Cap. F y H" });
      h.linea({ que: "  ¿resiste?", f: SI("ratioCor<=1"), debe: veredicto(cr.cumple), norma: "AISC 360-22 Cap. F y H" });
      if (cr.panel) {
        h.blanco();
        h.subseccion("3.2  El panel TR-4 salva la separación de correas");
        h.cabeceraMagnitudes();
        h.linea({ n: "capPan", que: "Carga admisible del panel a esa luz (" + cr.panel.tramos + " tramos o más)", v: cr.panel.P_kgfm2,
          u: "kgf/m²", estilo: "norma", fmt: "0.0", como: "tabla interpolada entre " + cr.panel.entre.join(" y ") + " m",
          norma: art("D.cobertura.tabla") });
        h.linea({ n: "demPan", que: "Carga viva que llega al panel", v: cr.panel.demanda_kgfm2, u: "kgf/m²", estilo: "analisis", fmt: "0.0",
          como: "neta: la tabla ya incluye su peso", norma: art("D.cobertura.neta") });
        h.linea({ que: "  ¿el panel resiste?", f: SI("demPan<=capPan"), debe: veredicto(cr.panel.cumple), norma: art("D.cobertura.tabla") });
      }
    } else {
      h.nota("Las correas todavía no se pueden verificar (faltan sus datos de diseño): esta sección sale cuando se puedan.");
    }

    /* 4 · la altura */
    h.seccion("4. LA ALTURA: LA RIGIDEZ LATERAL DEL PÓRTICO");
    let k4 = 1;
    for (const [nom, r] of [["pórtico interior", d.interior], ["pórtico de fachada", d.fachada]]) {
      if (!r) continue;
      h.subseccion("4." + (k4++) + "  " + nom.charAt(0).toUpperCase() + nom.slice(1));
      h.cabeceraMagnitudes();
      const suf = r === d.interior ? "i" : "f";
      h.linea({ n: "hAl_" + suf, que: "Altura del alero", v: r.hAlero_m, u: "m", estilo: "modelo", norma: "del modelo" });
      h.linea({ n: "dW_" + suf, que: "Desplazamiento del alero con viento (" + r.deriva.peor.caso + ")", v: r.deriva.peor.deriva_cm, u: "cm",
        estilo: "analisis", fmt: "0.000", como: "del análisis, sin factorizar" });
      h.linea({ n: "rW_" + suf, que: "Deriva por viento", f: "=dW_" + suf + "/(hAl_" + suf + "*100)", debe: r.deriva.peor.relacion, fmt: "0.00000" });
      h.linea({ n: "lW_" + suf, que: "Límite H/100", v: r.deriva.limite, estilo: "norma", fmt: "0.000", norma: art("SV.viento.H") });
      h.linea({ que: "  ¿cumple con viento?", f: SI("rW_" + suf + "<=lW_" + suf), debe: veredicto(r.deriva.peor.relacion <= r.deriva.limite + 1e-12),
        norma: art("SV.viento.H") });
      if (r.sismo && r.sismo.deriva) {
        const ds = r.sismo.deriva;
        h.linea({ n: "dE_" + suf, que: "Desplazamiento inelástico con sismo", v: ds.deriva_cm, u: "cm", estilo: "analisis", fmt: "0.000",
          como: "elástico × " + String(ds.multiplicador).replace(".", ","), norma: art("S.despl") });
        h.linea({ n: "rE_" + suf, que: "Deriva por sismo", f: "=dE_" + suf + "/(hAl_" + suf + "*100)", debe: ds.relacion, fmt: "0.00000" });
        h.linea({ n: "lE_" + suf, que: "Límite de la Tabla N° 14", v: ds.limite, estilo: "norma", fmt: "0.000",
          norma: art(s.industrial ? "S.deriva.industrial" : "S.deriva") });
        h.linea({ que: "  ¿cumple con sismo?", f: SI("rE_" + suf + "<=lE_" + suf), debe: veredicto(ds.cumple), norma: art("S.deriva") });
      }
      h.blanco();
    }

    /* 5 · arriostre y dilatación */
    h.seccion("5. LOS PAÑOS ARRIOSTRADOS Y LA DILATACIÓN");
    h.cabeceraMagnitudes();
    const panos = (a) => a.map((k) => (k + 1) + "–" + (k + 2)).join(", ");
    h.linea({ que: "Paños arriostrados en el techo (entre ejes)", v: panos(m3.panosArriostradosTecho), norma: art("MT.no.diafragma") });
    h.linea({ que: "Paños arriostrados en las fachadas laterales", v: panos(m3.panosArriostradosFachada), norma: art("MT.dos.direcciones") });
    h.linea({ que: "¿Techo y fachada en los mismos paños?", v: m3.camino.alineados ? "sí: la viga de alero solo amarra" :
      "no: la viga de alero trabaja a axial", norma: art("MT.mismo.pano") });
    h.linea({ que: "Camino de la carga lateral hasta el suelo", v: m3.camino.cierra ? "cierra: hastial → techo → fachada → suelo" : "NO cierra",
      norma: art("MT.continuidad") });
    const dl = m3.dilatacion;
    h.linea({ que: "Longitud entre los paños arriostrados más alejados", v: dl.longitudPresa_m, u: "m", estilo: "modelo", fmt: "0.00",
      como: "no puede dilatar libremente", norma: art("MT.termica") });
    h.linea({ que: "Variación de temperatura a considerar", v: dl.deltaT_C, u: "°C", estilo: "norma", fmt: "0", norma: art("MT.deltaT") });
    h.nota("El alargamiento en mm no se calcula: el coeficiente de dilatación del acero a temperatura ambiente no tiene fuente " +
      "leída (fila MT.alfa, pendiente). Se dice en vez de inventarlo.");

    /* 6 · hastiales */
    h.seccion("6. LAS COLUMNAS HASTIALES");
    h.cabeceraMagnitudes();
    const ch = m3.columnasHastiales || [];
    h.linea({ que: "Columnas hastiales en x", v: ch.length ? ch.map((x) => String(x).replace(".", ",")).join(" · ") + " m" : "ninguna",
      norma: art("MT.hastial") });
    if (ch.length) {
      const xs = [0].concat(ch, [f.luz_m]);
      const tramos = xs.slice(1).map((x, i) => x - xs[i]);
      h.linea({ n: "tHast", que: "Mayor tramo de muro entre columnas", v: Math.max.apply(null, tramos), u: "m", estilo: "modelo", fmt: "0.00",
        como: "lo que salva el larguero de fachada", norma: "del modelo" });
      const pz = d.largo && d.largo.diseno ? d.largo.diseno.piezas.filter((x) => (x.pieza || x.nombre) === "columna hastial")[0] : null;
      if (pz) {
        h.linea({ n: "rHast", que: "Ratio de la columna hastial (" + pz.perfil + ")", v: pz.ratio, estilo: "analisis", fmt: "0.000",
          como: "viento normal al muro, AISC Cap. H" });
        h.linea({ que: "  ¿resiste?", f: SI("rHast<=1"), debe: veredicto(pz.cumple), norma: "AISC 360-22 Cap. H" });
      }
    }
    return cerrar(h);
  }

  /* ---------- las hojas que hay, y las que faltan ---------------------- */
  const HOJAS = [
    { id: "datos", nombre: "DATOS", titulo: "Datos del proyecto", listo: true,
      que: "el sitio, la edificación, los materiales, el suelo, el sistema y los perfiles" },
    { id: "geometria", nombre: "GEOMETRIA", titulo: "Geometría: por qué estas medidas", listo: true,
      que: "la separación, la pendiente, los paneles, el peralte y la altura, con lo que verifica cada una" },
    { id: "cargas", nombre: "CARGAS", titulo: "Cargas y combinaciones", listo: true,
      que: "E.020 (muerta, viva, nieve, viento), E.030 y las combinaciones de E.090 y E.060" },
    { id: "diseno", nombre: "DISENO", titulo: "Diseño de barras", listo: false, que: "cada clase de barra por su capítulo del AISC" },
    { id: "cimentacion", nombre: "CIMENTACION", titulo: "Cimentación", listo: false, que: "zapata, pedestal y placa base" },
    { id: "metrado", nombre: "METRADO", titulo: "Metrado", listo: false, que: "acero por clase de barra, concreto y armadura" }
  ];

  return { ART, HOJAS, ANCHOS, nombreValido, armador, hojaCargas, hojaDatos, hojaGeometria };
});
