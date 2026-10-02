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
      require("./viento.js"), require("./e030.js"), require("./combinaciones.js"), require("./analisis.js"));
  } else {
    raiz.HOJAS = definir(raiz.INVENTARIO, raiz.EXCEL, raiz.E020, raiz.VIENTO, raiz.E030, raiz.COMBINACIONES,
      raiz.ANALISIS);
  }
})(typeof self !== "undefined" ? self : this, function (INV, EX, E020, VI, E030, CB, AN) {
  "use strict";

  const ART = INV.declara("hojas.js", [
    "H.formulas", "H.coincide", "H.analisis",
    "D.cobertura.peso", "Lr.liviana", "Lr.red.formula", "Lr.red.min40", "Lr.red.piso", "Lr.red.k",
    "N.Qs.min", "N.Qt.a", "N.Qt.b", "N.Qt.c", "N.desbal.corto", "N.desbal.largo",
    "W.Vh", "W.V.min", "W.Ph", "W.tipo", "W.T4", "W.T4.paralelas", "W.T5.repartidas", "W.C", "W.simultaneo",
    "S.Z", "S.U", "S.perfil", "S.sinVs30", "S.interp", "S.R0", "S.pendulo", "S.C.estatico", "S.CR", "S.V",
    "S.vertical", "A.sismo.periodo", "S.T.rayleigh", "S.P", "A.sismo.regular", "J.costura", "A.portico.tipico"
  ]);

  function exige(c, msg) { if (!c) throw new Error("hojas: " + msg); }
  const fte = (id) => id + " · " + ART[id];

  /* ---------- el armador ----------------------------------------------
     Columnas de las secciones de cálculo:
       A concepto · B símbolo (el nombre de la celda) · C valor · D unidad
       E cómo se calcula · F fuente
     Las tablas de la norma van a la derecha, de la H en adelante. */
  const COL = { concepto: "A", simbolo: "B", valor: "C", unidad: "D", como: "E", fuente: "F" };
  function armador(nombre) {
    const h = { nombre: nombre, celdas: {}, nombres: {}, fila: 1, filaTabla: 1,
      anchos: { A: 46, B: 10, C: 13, D: 9, E: 42, F: 40, G: 3, H: 12, I: 9, J: 9, K: 9, L: 9, M: 36 } };
    /* todo texto lleva formato de texto: «1.4-3» o «1–2» no se pueden volver una fecha al escribirse */
    h.pon = function (dir, c) {
      exige(!h.celdas[dir], "la celda " + dir + " se escribe dos veces");
      if (typeof c.v === "string") c.fmt = "@";
      h.celdas[dir] = c;
    };
    h.nombra = function (n, dir) {
      exige(/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !/^[A-Za-z]{1,3}\d+$/.test(n) && !/^[RrCc]$/.test(n) &&
        !/^[Rr]\d/.test(n), "«" + n + "» no puede ser un nombre de Excel");
      exige(!h.nombres[n], "el nombre " + n + " se usa dos veces");
      h.nombres[n] = dir;
    };
    h.titulo = function (t, sub) {
      h.pon("A" + h.fila, { v: t, estilo: "titulo" }); h.fila++;
      for (const s of [].concat(sub || [])) { h.pon("A" + h.fila, { v: s, estilo: "nota" }); h.fila++; }
      h.fila++;
    };
    h.seccion = function (t, fuente) {
      h.fila++;
      h.pon("A" + h.fila, { v: t, estilo: "seccion" });
      if (fuente) h.pon("F" + h.fila, { v: fuente, estilo: "seccion" });
      h.fila++;
    };
    h.cabecera = function (cols) {
      Object.keys(cols).forEach((c) => h.pon(c + h.fila, { v: cols[c], estilo: "cabecera" }));
      h.fila++;
    };
    h.nota = function (t) { h.pon("A" + h.fila, { v: t, estilo: "nota" }); h.fila++; };
    /* una magnitud: d = { n (nombre), que, v | f, debe, u, como, fuente, estilo, fmt } */
    h.linea = function (d) {
      const r = h.fila;
      h.pon("A" + r, { v: d.que, estilo: "concepto" });
      if (d.n) { h.pon("B" + r, { v: d.n, estilo: "simbolo" }); h.nombra(d.n, "C" + r); }
      const c = { estilo: d.estilo || (d.f ? "formula" : "dato"), fmt: d.fmt || (typeof d.v === "string" ? "@" : "0.00"),
        que: d.que };
      if (d.f !== undefined) { c.f = d.f; if (d.debe !== undefined) c.debe = d.debe; } else c.v = d.v;
      if (d.f !== undefined && typeof d.debe === "string") c.fmt = "@";
      h.pon("C" + r, c);
      if (d.u) h.pon("D" + r, { v: d.u, estilo: "unidad" });
      if (d.como) h.pon("E" + r, { v: d.como, estilo: "como" });
      if (d.fuente) h.pon("F" + r, { v: d.fuente, estilo: "fuente" });
      h.fila++;
      return "C" + r;
    };
    /* una tabla de la norma a la derecha: claves en H, columnas en I, J, K, L;
       cada columna con su nombre (pref + "_" + col) para buscar con INDEX/MATCH */
    h.tabla = function (d) {
      const t0 = h.filaTabla;
      h.pon("H" + t0, { v: d.titulo, estilo: "seccion" });
      h.pon("M" + t0, { v: d.fuente, estilo: "fuente" });
      const cols = ["I", "J", "K", "L"].slice(0, d.columnas.length);
      h.pon("H" + (t0 + 1), { v: d.clave, estilo: "cabecera" });
      d.columnas.forEach((c, i) => h.pon(cols[i] + (t0 + 1), { v: c.titulo, estilo: "cabecera" }));
      const f1 = t0 + 2, f2 = t0 + 1 + d.filas.length;
      d.filas.forEach((fila, k) => {
        h.pon("H" + (f1 + k), { v: fila.clave, estilo: "tabla", fmt: typeof fila.clave === "number" ? "0" : "@" });
        d.columnas.forEach((c, i) => {
          const v = fila.valores[i];
          if (v === null || v === undefined) return;
          if (v === "NA") h.pon(cols[i] + (f1 + k), { f: "=NA()", estilo: "tabla" });
          else h.pon(cols[i] + (f1 + k), { v: v, estilo: "tabla", fmt: typeof v === "string" ? "@" : (c.fmt || "0.00") });
        });
        if (fila.nota) h.pon("M" + (f1 + k), { v: fila.nota, estilo: "nota" });
      });
      h.nombra(d.pref + "_k", "H" + f1 + ":H" + f2);
      d.columnas.forEach((c, i) => h.nombra(d.pref + "_" + c.n, cols[i] + f1 + ":" + cols[i] + f2));
      h.filaTabla = f2 + 2;
    };
    return h;
  }

  const mm = (x) => String(x).replace(".", ",");

  /* =====================================================================
     LA HOJA CARGAS · d = { cargas (resultados.cargas), sitio, interior, fachada
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
    h.titulo("GALPÓN · CARGAS Y COMBINACIONES", [
      "Proyecto: " + (pr.nombre || "sin nombre") + (pr.ubicacion ? " · " + pr.ubicacion : "") +
        (pr.propietario ? " · propietario: " + pr.propietario : "") + (pr.proyectista ? " · proyectista: " + pr.proyectista : ""),
      (d.fecha ? "Escrita el " + d.fecha + " con " : "Escrita con ") + "Galpón " + (d.version || "") +
        ". Azul: dato del proyecto · morado: valor de la norma · negro: fórmula viva · verde: sale del análisis.",
      "Las fórmulas se comprobaron contra el motor antes de escribirse (" + fte("H.coincide") + ")."
    ]);
    const CAB = { A: "Concepto", B: "Símbolo", C: "Valor", D: "Unidad", E: "Cómo se calcula", F: "Fuente" };

    /* ---- TABLAS DE LA NORMA, a la derecha ---- */
    h.tabla({ titulo: "Peso de la cobertura TR-4", fuente: fte("D.cobertura.peso"), pref: "tCob", clave: "desde (mm)",
      columnas: [{ n: "min", titulo: "desde", fmt: "0.00" }, { n: "max", titulo: "hasta", fmt: "0.00" },
        { n: "peso", titulo: "kgf/m²", fmt: "0.00" }],
      filas: E020.COBERTURA.map((r) => ({ clave: mm(r.min) + "–" + mm(r.max), valores: [r.min, r.max, r.peso] })) });
    h.tabla({ titulo: "Tipo de edificación para el viento", fuente: fte("W.tipo"), pref: "tTipo", clave: "tipo",
      columnas: [{ n: "f", titulo: "factor" }],
      filas: Object.keys(VI.TIPO_FACTOR).map((k) => ({ clave: +k, valores: [VI.TIPO_FACTOR[k]] })) });
    h.tabla({ titulo: "Tabla 4 · factor de forma exterior Ce", fuente: fte("W.T4"), pref: "tT4", clave: "superficie",
      columnas: [{ n: "bar1", titulo: "barlov. 1" }, { n: "bar2", titulo: "barlov. 2" }, { n: "sot", titulo: "sotav." }],
      filas: ["vertical", "inc15", "inc1560", "inc60", "paralelas"].map((k) => ({ clave: k,
        valores: [VI.T4[k].barlovento[0], VI.T4[k].barlovento[1], VI.T4[k].sotavento], nota: VI.T4[k].que })) });
    h.tabla({ titulo: "Tabla 5 · factor de forma interior Ci", fuente: fte("W.T5.repartidas"), pref: "tT5",
      clave: "aberturas", columnas: [{ n: "ci1", titulo: "Ci 1" }, { n: "ci2", titulo: "Ci 2" }],
      filas: VI.ABERTURAS.map((k) => ({ clave: k, valores: [VI.T5[k].Ci[0], VI.T5[k].Ci[1]], nota: VI.T5[k].que })) });
    h.tabla({ titulo: "Factor de zona Z", fuente: fte("S.Z"), pref: "tZ", clave: "zona",
      columnas: [{ n: "v", titulo: "Z" }], filas: E030.ZONAS.map((k) => ({ clave: k, valores: [E030.Z[k]] })) });
    h.tabla({ titulo: "Factor de uso U", fuente: fte("S.U"), pref: "tU", clave: "categoría",
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
    h.tabla({ titulo: "Factor de suelo S (zona y suelo)", fuente: fte("S.perfil"), pref: "tS", clave: "zona·suelo",
      columnas: [{ n: "rig", titulo: "rígido", fmt: "0.000" }, { n: "bla", titulo: "blando", fmt: "0.000" }], filas: filasS });
    const par = (x) => (Array.isArray(x) ? x : [x, x]);
    h.tabla({ titulo: "Períodos TP y TL, y V̄s30 del suelo", fuente: fte("S.perfil") + " · " + fte("S.interp"), pref: "tP",
      clave: "suelo", columnas: [{ n: "TPr", titulo: "TP rígido" }, { n: "TPb", titulo: "TP blando" },
        { n: "TLr", titulo: "TL rígido" }, { n: "TLb", titulo: "TL blando" }],
      filas: E030.SUELOS.map((k) => ({ clave: k, valores: par(E030.TABLA_TP[k]).concat(par(E030.TABLA_TL[k])) })) });
    h.tabla({ titulo: "V̄s30 de cada suelo (m/s)", fuente: fte("S.interp"), pref: "tVs", clave: "suelo",
      columnas: [{ n: "min", titulo: "desde", fmt: "0" }, { n: "max", titulo: "hasta", fmt: "0" }],
      filas: E030.SUELOS.map((k) => ({ clave: k, valores: [E030.VS30[k].min, isFinite(E030.VS30[k].max) ? E030.VS30[k].max : "∞"] })) });
    h.tabla({ titulo: "Coeficiente básico de reducción R₀", fuente: fte("S.R0") + " · " + fte("S.pendulo"), pref: "tR",
      clave: "sistema", columnas: [{ n: "v", titulo: "R₀", fmt: "0.0" }],
      filas: E030.SISTEMAS.map((k) => ({ clave: k, valores: [E030.R0[k]] }))
        .concat([{ clave: "pendulo", valores: [E030.R0_PENDULO], nota: "péndulo invertido, Art. 22.3" }]) });

    /* ---- GEOMETRÍA ---- */
    h.seccion("1 · LA GEOMETRÍA QUE CARGA", "del modelo montado");
    h.cabecera(CAB);
    h.linea({ n: "luz", que: "Luz del pórtico", v: f.luz_m, u: "m", estilo: "modelo", fuente: "Geometría" });
    h.linea({ n: "sep", que: "Separación de pórticos", v: f.sep_m, u: "m", estilo: "modelo", fuente: "Geometría" });
    h.linea({ n: "theta", que: "Pendiente del techo", v: f.theta_grad, u: "°", estilo: "modelo", fmt: "0.000",
      fuente: "Geometría", como: "la mayor pendiente de la brida superior" });
    h.linea({ n: "hc", que: "Altura a la cumbre", v: f.hCumbre_m, u: "m", estilo: "modelo", fmt: "0.000",
      fuente: "Geometría" });

    /* ---- GRAVEDAD ---- */
    h.seccion("2 · CARGA MUERTA Y VIVA DE TECHO", "E.020 Art. 4, 7, 10 y 11");
    h.cabecera(CAB);
    const esp = s.espesorCobertura_mm;
    h.linea({ n: "esp", que: "Espesor de la cobertura", v: esp, u: "mm", fuente: "dato del proyecto" });
    h.linea({ n: "Dcob", que: "Peso de la cobertura", u: "kgf/m²", debe: E020.pesoCobertura(esp).peso_kgfm2,
      f: "=IF(esp<=INDEX(tCob_max,MATCH(esp,tCob_min,1)),INDEX(tCob_peso,MATCH(esp,tCob_min,1)),NA())",
      como: "de la tabla; #N/A si el espesor cae en un hueco: esa plancha no se fabrica", fuente: fte("D.cobertura.peso") });
    h.linea({ n: "Dotras", que: "Otras cargas muertas", v: s.Dotras_kgfm2 || 0, u: "kgf/m²", fuente: "dato del proyecto" });
    h.linea({ n: "Dsup", que: "Carga muerta sobre la cobertura", u: "kgf/m²", debe: c.D_kgfm2, f: "=Dcob+Dotras",
      como: "Dcob + Dotras · el peso propio de los perfiles se suma en el análisis" });
    if (!s.hayNieve) {
      const vt = E020.vivaTecho({ tipo: "liviana", hayNieve: false });
      const rd = E020.reduceViva({ Lo_kgfm2: vt.Lo_kgfm2, At_m2: f.luz_m * f.sep_m });
      h.linea({ n: "Lo", que: "Carga viva de techo, sin reducir", v: vt.Lo_kgfm2, u: "kgf/m²", estilo: "norma",
        fmt: "0", fuente: fte("Lr.liviana") });
      h.linea({ n: "At", que: "Área tributaria de un pórtico", u: "m²", f: "=luz*sep", debe: f.luz_m * f.sep_m,
        como: "luz × separación", fmt: "0.0" });
      h.linea({ n: "kLL", que: "Factor de carga de la Tabla 3 (tijeral de techo liviano)", v: E020.K_TIJERAL_LIVIANO,
        estilo: "norma", fmt: "0", fuente: fte("Lr.red.k") });
      h.linea({ n: "Ai", que: "Área de influencia", u: "m²", f: "=kLL*At", debe: rd.Ai_m2, como: "k·At", fmt: "0.0" });
      h.linea({ n: "Lrb", que: "Viva reducida, sin topes", u: "kgf/m²", f: "=Lo*(0.25+4.6/SQRT(Ai))",
        debe: rd.bruto_kgfm2, como: "Lo·(0,25 + 4,6/√Ai)", fuente: fte("Lr.red.formula") });
      h.linea({ n: "Lr", que: "Carga viva de techo Lr", u: "kgf/m²", debe: c.Lr_kgfm2,
        f: "=IF(Ai<=40,Lo,MAX(0.5*Lo,MIN(Lo,Lrb)))",
        como: "sin reducir si Ai ≤ 40 m²; si no, entre 0,5·Lo y Lo", fuente: fte("Lr.red.min40") + " · " + fte("Lr.red.piso") });
    } else {
      const qs = E020.nieveQs(s.Qs_kgfm2);
      const qt = E020.nieveQt({ Qs_kgfm2: s.Qs_kgfm2, theta_grad: f.theta_grad });
      const db = E020.nieveDesbalanceada({ Qt_kgfm2: qt.Qt_kgfm2, semiluz_m: f.luz_m / 2, theta_grad: f.theta_grad });
      h.linea({ n: "Qsd", que: "Carga básica de nieve del sitio", v: s.Qs_kgfm2, u: "kgf/m²", fuente: "dato del proyecto" });
      h.linea({ n: "Qsmin", que: "Mínimo de la norma", v: E020.QS_MIN, u: "kgf/m²", estilo: "norma", fmt: "0",
        fuente: fte("N.Qs.min") });
      h.linea({ n: "Qs", que: "Nieve básica Qs", u: "kgf/m²", f: "=MAX(Qsmin,Qsd)", debe: qs.Qs_kgfm2 });
      h.linea({ n: "Qt", que: "Nieve sobre el techo Qt (proyección horizontal)", u: "kgf/m²", debe: qt.Qt_kgfm2,
        f: "=IF(theta<=15,Qs,IF(theta<=30,0.8*Qs,MAX(0,1-0.025*(theta-30))*0.8*Qs))",
        como: "θ ≤ 15°: Qs · θ ≤ 30°: 0,8·Qs · más: Cs·0,8·Qs, Cs = 1 − 0,025·(θ − 30)",
        fuente: fte("N.Qt.a") + " · " + fte("N.Qt.c") });
      h.linea({ n: "QdA", que: "Nieve desbalanceada, faldón cargado", u: "kgf/m²",
        debe: db.aplica ? db.faldonA_kgfm2 : "no aplica", f: "=IF(theta<=15,\"no aplica\",IF(luz/2<=6,1.3*Qt,1.5*Qt))",
        como: "θ > 15°: 1,3·Qt si ℓ/2 ≤ 6 m, 1,5·Qt si no", fuente: fte("N.desbal.corto") + " · " + fte("N.desbal.largo") });
      h.linea({ n: "QdB", que: "Nieve desbalanceada, el otro faldón", u: "kgf/m²",
        debe: db.aplica ? db.faldonB_kgfm2 : "no aplica", f: "=IF(theta<=15,\"no aplica\",IF(luz/2<=6,0,0.3*Qt))",
        como: "0 si ℓ/2 ≤ 6 m, 0,3·Qt si no" });
    }

    /* ---- VIENTO ---- */
    h.seccion("3 · VIENTO", "E.020 Cap. 3 · Art. 12 · Tablas 4 y 5");
    h.cabecera(CAB);
    const vel = VI.velocidadDiseno({ V_kmh: s.V_kmh, h_m: f.hCumbre_m });
    h.linea({ n: "Vmapa", que: "Velocidad del Mapa Eólico", v: s.V_kmh, u: "km/h", fmt: "0", fuente: "dato del proyecto" });
    h.linea({ n: "tipoW", que: "Tipo de edificación", v: s.tipoEdificacion, fmt: "0", fuente: fte("W.tipo") });
    h.linea({ n: "Vmin", que: "Velocidad mínima", v: VI.V_MIN, u: "km/h", estilo: "norma", fmt: "0", fuente: fte("W.V.min") });
    h.linea({ n: "expV", que: "Exponente de la altura", v: VI.EXP_ALTURA, estilo: "norma", fuente: fte("W.Vh") });
    h.linea({ n: "Vbr", que: "Velocidad a la altura de la cumbre", u: "km/h", f: "=Vmapa*(hc/10)^expV",
      debe: vel.bruto_kmh, como: "V·(h/10)^0,22" });
    h.linea({ n: "Vh", que: "Velocidad de diseño Vh", u: "km/h", f: "=MAX(Vmin,Vbr)", debe: vel.Vh_kmh,
      como: "con el piso de 75 km/h", fuente: fte("W.Vh") });
    h.linea({ n: "Kp", que: "Constante de la presión", v: VI.K_PRESION, estilo: "norma", fmt: "0.000", fuente: fte("W.Ph") });
    h.linea({ n: "fTipo", que: "Factor del tipo de edificación", f: "=INDEX(tTipo_f,MATCH(tipoW,tTipo_k,0))",
      debe: VI.TIPO_FACTOR[s.tipoEdificacion], fuente: fte("W.tipo") });
    h.linea({ n: "q", que: "Presión de referencia (C = 1)", u: "kgf/m²", f: "=Kp*Vh^2", debe: VI.K_PRESION * vel.Vh_kmh * vel.Vh_kmh,
      como: "0,005·Vh²" });
    const ct = VI.ceTecho(f.theta_grad);
    h.linea({ n: "casoTecho", que: "Inciso de la Tabla 4 para el techo", f: "=IF(theta<=15,\"inc15\",IF(theta<=60,\"inc1560\",\"inc60\"))",
      debe: ct.caso, como: "por la pendiente: ≤ 15°, ≤ 60°, más", fuente: fte("W.T4") });
    const ab = s.aberturas || {};
    const DIRS = [["izqDer", "abID", "izquierda → derecha"], ["derIzq", "abDI", "derecha → izquierda"],
      ["longitudinal", "abL", "longitudinal"]];
    for (const [k, n, nom] of DIRS) {
      h.linea({ n: n, que: "Aberturas, viento " + nom, v: ab[k], fuente: fte("W.T5.repartidas") });
    }
    h.fila++;
    h.nota("Cada superficie con cada Ci, a la vez en cada dirección (" + fte("W.simultaneo") + "). C = Ce − Ci; Ph = 0,005·C·Vh²·factor del tipo.");
    h.cabecera({ A: "Dirección · superficie", B: "Ce", C: "Ci", D: "C", E: "Ph (kgf/m²)", F: "Fuente" });
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
            h.pon("A" + r, { v: nom + " · " + su.nombre, estilo: "concepto" });
            h.pon("B" + r, { f: ceF(ce[0], ce[1]), debe: eng.Ce, estilo: "formula", fmt: "0.00", que: su.nombre + " Ce" });
            h.pon("C" + r, { f: ciF(n, j), debe: eng.Ci, estilo: "formula", fmt: "0.00", que: su.nombre + " Ci" });
            h.pon("D" + r, { f: "=B" + r + "-C" + r, debe: eng.C, estilo: "formula", fmt: "0.00", que: su.nombre + " C" });
            h.pon("E" + r, { f: "=Kp*D" + r + "*Vh^2*fTipo", debe: eng.Ph_kgfm2, estilo: "formula", fmt: "0.00",
              que: su.nombre + " Ph" });
            h.pon("F" + r, { v: fte(k === "longitudinal" ? "W.T4.paralelas" : "W.C"), estilo: "fuente" });
            h.fila++; filasW++;
          });
        });
      }
    }

    /* ---- SISMO ---- */
    h.seccion("4 · SISMO", "E.030-2026 · Art. 28, 31, 34, 36 y 38");
    h.cabecera(CAB);
    const pend = s.sistemaSismico === "pendulo";
    const st = E030.sitio({ zona: s.zona, suelo: s.suelo, vs30_ms: s.vs30_ms });
    const rr = E030.coefR({ pendulo: pend, sistema: pend ? undefined : s.sistemaSismico });
    h.linea({ n: "zona", que: "Zona sísmica", v: s.zona, fuente: "dato del proyecto" });
    h.linea({ n: "suelo", que: "Perfil de suelo", v: s.suelo, fuente: "dato del proyecto" });
    h.linea({ n: "vsMed", que: "V̄s30 medido (vacío si no hay)", v: typeof s.vs30_ms === "number" ? s.vs30_ms : "",
      u: "m/s", fmt: "0", fuente: fte("S.sinVs30") });
    h.linea({ n: "categoria", que: "Categoría de la edificación", v: s.categoria, fuente: "dato del proyecto" });
    h.linea({ n: "sistema", que: "Sistema en la dirección transversal", v: s.sistemaSismico, fuente: "dato del proyecto" });
    h.linea({ n: "Z", que: "Factor de zona Z", f: "=INDEX(tZ_v,MATCH(zona,tZ_k,0))", debe: st.Z, fuente: fte("S.Z") });
    h.linea({ n: "U", que: "Factor de uso U", f: "=INDEX(tU_v,MATCH(categoria,tU_k,0))", debe: E030.factorU(s.categoria).U,
      fuente: fte("S.U") });
    const look = (col) => "INDEX(tS_" + col + ",MATCH(zona&suelo,tS_k,0))";
    h.linea({ n: "uVs", que: "Posición en el intervalo del suelo (1 = el más blando)", fmt: "0.000",
      f: "=IF(OR(vsMed=\"\"," + look("rig") + "=" + look("bla") + "),1,MAX(0,MIN(1,(INDEX(tVs_max,MATCH(suelo,tVs_k,0))-vsMed)/" +
        "(INDEX(tVs_max,MATCH(suelo,tVs_k,0))-INDEX(tVs_min,MATCH(suelo,tVs_k,0))))))",
      como: "sin V̄s30: el extremo blando, del lado seguro; con él, interpolado", fuente: fte("S.sinVs30") + " · " + fte("S.interp") });
    h.linea({ n: "S", que: "Factor de suelo S", fmt: "0.000", debe: st.S,
      f: "=" + look("rig") + "+uVs*(" + look("bla") + "-" + look("rig") + ")", fuente: fte("S.perfil") });
    const lp = (col) => "INDEX(tP_" + col + ",MATCH(suelo,tP_k,0))";
    h.linea({ n: "TP", que: "Período TP", u: "s", debe: st.TP, f: "=" + lp("TPr") + "+uVs*(" + lp("TPb") + "-" + lp("TPr") + ")",
      fuente: fte("S.perfil") });
    h.linea({ n: "TL", que: "Período TL", u: "s", debe: st.TL, f: "=" + lp("TLr") + "+uVs*(" + lp("TLb") + "-" + lp("TLr") + ")",
      fuente: fte("S.perfil") });
    h.linea({ n: "Rbase", que: "Coeficiente básico R₀", fmt: "0.0", f: "=INDEX(tR_v,MATCH(sistema,tR_k,0))", debe: rr.R0,
      fuente: fte(pend ? "S.pendulo" : "S.R0") });
    h.linea({ n: "Ia", que: "Irregularidad en altura Ia", v: 1, estilo: "norma", fuente: fte("A.sismo.regular") });
    h.linea({ n: "Ip", que: "Irregularidad en planta Ip", v: 1, estilo: "norma", fuente: fte("A.sismo.regular") });
    h.linea({ n: "Rs", que: "Coeficiente de reducción R", fmt: "0.0", f: "=Rbase*Ia*Ip", debe: rr.R, como: "R₀·Ia·Ip" });
    h.linea({ n: "CRmin", que: "Mínimo de C/R", v: E030.CR_MIN, estilo: "norma", fuente: fte("S.CR") });
    h.linea({ n: "fV", que: "Fracción de la vertical", v: AN.FRACCION_VERTICAL, estilo: "norma", fmt: "0.000",
      fuente: fte("S.vertical") });
    h.linea({ n: "Evf", que: "Sismo vertical, fracción del peso", fmt: "0.000", f: "=fV*Z*U*S",
      debe: AN.FRACCION_VERTICAL * st.Z * E030.factorU(s.categoria).U * st.S, como: "2/3·Z·U·S, sin dividir por R",
      fuente: fte("S.vertical") });
    h.linea({ n: "fT", que: "Factor del período por los elementos no estructurales", v: AN.FACTOR_T_NO_ESTRUCTURAL,
      estilo: "norma", fuente: fte("A.sismo.periodo") });

    for (const [nom, suf, r] of [["pórtico interior", "i", d.interior], ["pórtico de fachada", "f", d.fachada]]) {
      h.fila++;
      if (!r || !r.sismo) {
        h.nota("El cortante del " + nom + " sale del análisis, que todavía no corre: su período y su peso no se pueden escribir.");
        continue;
      }
      const z = r.sismo;
      h.cabecera({ A: "El cortante basal · " + nom, B: "Símbolo", C: "Valor", D: "Unidad", E: "Cómo se calcula", F: "Fuente" });
      h.linea({ n: "Tray_" + suf, que: "Período por Rayleigh, con el pórtico resuelto", v: z.T_rayleigh_s, u: "s",
        estilo: "analisis", fmt: "0.0000", fuente: fte("S.T.rayleigh") + " · " + fte("H.analisis") });
      h.linea({ n: "T_" + suf, que: "Período T", u: "s", fmt: "0.0000", f: "=fT*Tray_" + suf, debe: z.T_s, como: "0,85·T Rayleigh" });
      h.linea({ n: "P_" + suf, que: "Peso sísmico del pórtico: D + 25 % de la viva de techo", v: z.P_kgf, u: "kgf",
        estilo: "analisis", fmt: "0", fuente: fte("S.P") + " · " + fte("H.analisis") });
      h.linea({ n: "Cs_" + suf, que: "Factor de amplificación C", fmt: "0.000", debe: z.C,
        f: "=IF(T_" + suf + "<=TP,2.5,IF(T_" + suf + "<TL,2.5*TP/T_" + suf + ",2.5*TP*TL/T_" + suf + "^2))",
        como: "estático: 2,5 hasta TP, sin rampa", fuente: fte("S.C.estatico") });
      h.linea({ n: "CR_" + suf, que: "C/R", fmt: "0.0000", f: "=Cs_" + suf + "/Rs", debe: z.CR });
      h.linea({ n: "CRu_" + suf, que: "C/R que se usa", fmt: "0.0000", f: "=MAX(CRmin,CR_" + suf + ")", debe: z.CR_usado,
        fuente: fte("S.CR") });
      h.linea({ n: "V_" + suf, que: "Cortante basal V", u: "kgf", fmt: "0", f: "=Z*U*CRu_" + suf + "*S*P_" + suf, debe: z.V_kgf,
        como: "Z·U·(C/R)·S·P", fuente: fte("S.V") });
      h.linea({ n: "Ev_" + suf, que: "Sismo vertical", u: "kgf", fmt: "0", f: "=Evf*P_" + suf, debe: z.Ev_kgf,
        fuente: fte("S.vertical") });
    }

    /* ---- COMBINACIONES ---- */
    h.fila = Math.max(h.fila, h.filaTabla);          /* las combinaciones usan hasta la H: debajo de las tablas */
    h.seccion("5 · COMBINACIONES", fte("J.costura"));
    h.nota("Se guardan los casos, nunca las combinaciones: el acero (E.090) y el concreto (E.060) arman las suyas.");
    const casos = { D: true, Lr: !s.hayNieve, S: !!s.hayNieve, W: true, E: true };
    for (const [titulo, fam] of [["Acero · E.090 §1.4.1", CB.paraAcero({ casos: casos }).combinaciones],
      ["Concreto · E.060 §9.2", CB.paraConcreto({ casos: casos }).combinaciones]]) {
      h.fila++;
      const nombres = [];
      for (const cb of fam) for (const [k] of cb.terminos) if (nombres.indexOf(k) < 0) nombres.push(k);
      const cols = ["C", "D", "E", "F", "G", "H"].slice(0, nombres.length);
      const cab = { A: titulo, B: "id" };
      nombres.forEach((k, i) => { cab[cols[i]] = k; });
      h.cabecera(cab);
      for (const cb of fam) {
        const r = h.fila;
        h.pon("A" + r, { v: cb.texto, estilo: "concepto" });
        h.pon("B" + r, { v: cb.id, estilo: "simbolo", fmt: "@" });
        for (const [k, fac] of cb.terminos) h.pon(cols[nombres.indexOf(k)] + r, { v: fac, estilo: "norma", fmt: "0.00" });
        h.fila++;
      }
    }

    const chk = EX.comprueba(h);
    return { nombre: h.nombre, celdas: h.celdas, nombres: h.nombres, anchos: h.anchos, filas: Math.max(h.fila, h.filaTabla),
      comprobacion: chk, filasViento: filasW, art: ART["H.formulas"] };
  }

  /* ---------- las hojas que hay, y las que faltan ---------------------- */
  const HOJAS = [
    { id: "cargas", nombre: "CARGAS", titulo: "Cargas y combinaciones", listo: true,
      que: "E.020 (muerta, viva, nieve, viento), E.030 y las combinaciones de E.090 y E.060" },
    { id: "diseno", nombre: "DISENO", titulo: "Diseño de barras", listo: false, que: "cada clase de barra por su capítulo del AISC" },
    { id: "cimentacion", nombre: "CIMENTACION", titulo: "Cimentación", listo: false, que: "zapata, pedestal y placa base" },
    { id: "metrado", nombre: "METRADO", titulo: "Metrado", listo: false, que: "acero por clase de barra, concreto y armadura" }
  ];

  return { ART, HOJAS, armador, hojaCargas };
});
