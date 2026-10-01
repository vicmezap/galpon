/* =====================================================================
   resultados.js — lo que enseñan los pasos Cargas y Análisis, como datos

   Igual que vistas.js para Geometría: la plantilla solo pinta, y aquí se
   decide qué número sale y de dónde viene.  Cada línea lleva su
   procedencia por la guarda de vistas.ln(), así que un número de norma sin
   fila no llega a la pantalla.

   NADA TIENE VALOR POR OMISIÓN que sea una decisión del proyecto: ni la
   velocidad del viento, ni las aberturas, ni si hay nieve, ni el tipo de
   edificación, ni el acero, ni el sistema estructural.  Lo que falte se
   DICE, con el paso al que hay que ir, en vez de rellenarse con un valor
   razonable que nadie eligió.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./vistas.js"),
      require("./e020.js"), require("./viento.js"), require("./combinaciones.js"),
      require("./analisis.js"), require("./libro.js"));
  } else {
    raiz.RESULTADOS = definir(raiz.INVENTARIO, raiz.VISTAS, raiz.E020, raiz.VIENTO,
      raiz.COMBINACIONES, raiz.ANALISIS, raiz.LIBRO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, V, E020, VI, CB, AN, LIBRO) {
  "use strict";

  const ART = INV.declara("resultados.js", [
    "D.cobertura.peso", "Lr.liviana", "Lr.red.formula", "N.Qs.min", "N.Qt.a", "N.Qt.b",
    "N.Qt.c", "N.desbal.corto", "N.desbal.largo", "W.V.mapa", "W.Vh", "W.Ph", "W.C", "W.tipo",
    "A.sistema", "A.acero.Pns", "A.reacciones.casos", "SV.viento.H", "A.segundo.orden"
  ]);
  const ln = V.ln, ficha = V.ficha;
  const n2 = (x, d) => (Math.round(x * Math.pow(10, d)) / Math.pow(10, d))
    .toFixed(d).replace(".", ",");
  const t2 = (kgf) => n2(kgf / 1000, 2) + " t";
  const tm = (kgfcm) => n2(kgfcm / 1e5, 2) + " t·m";

  const DIRECCIONES = [["izqDer", "izquierda → derecha"], ["derIzq", "derecha → izquierda"],
    ["longitudinal", "longitudinal (paralelo a la cumbrera)"]];
  const ACEROS = ["A36", "A572"];

  /* la pendiente y la altura de cumbre, de la geometría montada */
  function forma(m3) {
    const sup = m3.tijeral.nudos.filter((n) => n.clase === "superior").slice()
      .sort((a, b) => a.x_m - b.x_m);
    let s = 0;
    for (let k = 0; k + 1 < sup.length; k++) {
      s = Math.max(s, Math.abs((sup[k + 1].y_m - sup[k].y_m) / (sup[k + 1].x_m - sup[k].x_m)));
    }
    return {
      theta_grad: Math.atan(s) * 180 / Math.PI,
      hCumbre_m: Math.max.apply(null, m3.nudos.map((n) => n.y_m)),
      luz_m: m3.luz_m, sep_m: m3.ejes.sepPorticos_m
    };
  }

  /* =====================================================================
     EL PASO CARGAS
     ===================================================================== */
  function cargas(m3, sitio) {
    const s = sitio || {};
    const faltan = [];
    const f = forma(m3);
    const fichas = [];
    const out = { faltan: faltan, fichas: fichas, cargas: null, forma: f };

    /* ---- gravedad ---- */
    const L1 = [
      ln("Pendiente del techo", n2(f.theta_grad, 2) + "°", "geometria"),
      ln("Altura a la cumbre", n2(f.hCumbre_m, 2) + " m", "geometria")
    ];
    let D = null;
    if (!(s.espesorCobertura_mm > 0)) {
      faltan.push({ campo: "ca_esp", que: "el espesor de la cobertura" });
    } else {
      try {
        const cob = E020.pesoCobertura(s.espesorCobertura_mm);
        const otras = s.Dotras_kgfm2 || 0;
        D = cob.peso_kgfm2 + otras;
        L1.push(ln("Peso de la cobertura", n2(cob.peso_kgfm2, 2) + " kgf/m²", "norma",
          { fuente: "D.cobertura.peso", nota: "rango " + cob.rango }));
        L1.push(ln("Otras cargas muertas", n2(otras, 2) + " kgf/m²", "entrada",
          { nota: otras ? null : "no se declaró ninguna: instalaciones, luminarias, falso techo" }));
        L1.push(ln("Carga muerta sobre la cobertura", n2(D, 2) + " kgf/m²", "medido",
          { nota: "sobre la superficie inclinada; el peso propio de los perfiles se suma en el análisis" }));
      } catch (e) {
        faltan.push({ campo: "ca_esp", que: e.message.split("\n")[0].replace(/^e020: /, "") });
      }
    }

    let Lr = null, S = null;
    if (typeof s.hayNieve !== "boolean") {
      faltan.push({ campo: "ca_nieve", que: "si en el sitio puede acumularse nieve (E.020 Art. 7.1 d)" });
    } else if (!s.hayNieve) {
      const vt = E020.vivaTecho({ tipo: "liviana", hayNieve: false });
      const At = f.luz_m * f.sep_m;
      const rd = E020.reduceViva({ Lo_kgfm2: vt.Lo_kgfm2, At_m2: At });
      Lr = rd.reducido ? rd.Lr_kgfm2 : vt.Lo_kgfm2;
      L1.push(ln("Carga viva de techo Lo", n2(vt.Lo_kgfm2, 0) + " kgf/m²", "norma",
        { fuente: "Lr.liviana" }));
      L1.push(ln("Área tributaria de un pórtico", n2(At, 1) + " m²", "geometria",
        { nota: "luz × separación" }));
      L1.push(ln("Carga viva reducida Lr", n2(Lr, 2) + " kgf/m²", "norma",
        { fuente: "Lr.red.formula", nota: rd.reducido ? null : rd.motivo }));
    } else {
      if (!(s.Qs_kgfm2 >= 0)) {
        faltan.push({ campo: "ca_qs", que: "la carga básica de nieve del sitio, Qs" });
      } else {
        const qs = E020.nieveQs(s.Qs_kgfm2);
        const qt = E020.nieveQt({ Qs_kgfm2: qs.Qs_kgfm2, theta_grad: f.theta_grad });
        const db = E020.nieveDesbalanceada({ Qt_kgfm2: qt.Qt_kgfm2, semiluz_m: f.luz_m / 2,
          theta_grad: f.theta_grad });
        S = { Qt_kgfm2: qt.Qt_kgfm2,
          desbalanceada: db.aplica ? { faldonA_kgfm2: db.faldonA_kgfm2, faldonB_kgfm2: db.faldonB_kgfm2 } : null };
        L1.push(ln("Nieve básica Qs", n2(qs.Qs_kgfm2, 0) + " kgf/m²", "norma",
          { fuente: "N.Qs.min", nota: qs.enMinimo ? "se subió al mínimo de la norma" : null }));
        const filaQt = { "Art. 11.3 a)": "N.Qt.a", "Art. 11.3 b)": "N.Qt.b", "Art. 11.3 c)": "N.Qt.c" }[qt.caso];
        L1.push(ln("Nieve sobre el techo Qt", n2(qt.Qt_kgfm2, 2) + " kgf/m²",
          filaQt ? "norma" : "medido", filaQt ? { fuente: filaQt, nota: "sobre la proyección horizontal" } : {}));
        L1.push(ln("Nieve desbalanceada", db.aplica
          ? n2(db.faldonA_kgfm2, 1) + " / " + n2(db.faldonB_kgfm2, 1) + " kgf/m²" : "no aplica", "medido",
          { nota: db.aplica ? "puede invertir el signo de las diagonales" : db.motivo }));
      }
    }
    fichas.push(ficha("Gravedad", "E.020 Art. 4, 7, 10 y 11", L1));

    /* ---- viento ---- */
    const L2 = [];
    let viento = null;
    if (!(s.V_kmh > 0)) faltan.push({ campo: "ca_v", que: "la velocidad del viento del Mapa Eólico" });
    if (s.tipoEdificacion !== 1 && s.tipoEdificacion !== 2) {
      faltan.push({ campo: "ca_tipo", que: "el tipo de edificación para el viento (Tipo 1 ó 2)" });
    }
    const ab = s.aberturas || {};
    for (const [k, nom] of DIRECCIONES) {
      if (!ab[k]) faltan.push({ campo: "ca_ab_" + k, que: "las aberturas para el viento " + nom });
    }
    const tablaViento = [];
    if (s.V_kmh > 0 && (s.tipoEdificacion === 1 || s.tipoEdificacion === 2)) {
      const vel = VI.velocidadDiseno({ V_kmh: s.V_kmh, h_m: f.hCumbre_m });
      L2.push(ln("Velocidad del mapa V", n2(s.V_kmh, 0) + " km/h", "entrada"));
      L2.push(ln("Velocidad de diseño Vh", n2(vel.Vh_kmh, 2) + " km/h", "norma",
        { fuente: "W.Vh", nota: vel.enMinimo ? "manda el piso de 75 km/h" : null }));
      L2.push(ln("Presión de referencia 0,005·Vh²", n2(0.005 * vel.Vh_kmh * vel.Vh_kmh, 2) +
        " kgf/m²", "norma", { fuente: "W.Ph" }));
      for (const [k, nom] of DIRECCIONES) {
        if (!ab[k]) continue;
        if (k === "longitudinal") {
          for (const Ci of VI.ci(ab[k]).Ci) {
            const C = VI.T4.paralelas.barlovento[0] - Ci;
            tablaViento.push({ direccion: nom, superficie: "techo y muros largos", Ce: VI.T4.paralelas.barlovento[0],
              Ci: Ci, C: C, Ph_kgfm2: VI.presion({ C: C, Vh_kmh: vel.Vh_kmh, tipo: s.tipoEdificacion }).Ph_kgfm2 });
          }
          continue;
        }
        const g = VI.casos({ V_kmh: s.V_kmh, h_m: f.hCumbre_m, theta_grad: f.theta_grad,
          aberturas: ab[k], tipo: s.tipoEdificacion });
        for (const sup of g.superficies) {
          if (sup.superficie === "muros laterales") continue;
          for (const c of sup.casos) {
            tablaViento.push({ direccion: nom, superficie: sup.superficie, Ce: c.Ce, Ci: c.Ci,
              C: c.C, Ph_kgfm2: c.Ph_kgfm2 });
          }
        }
      }
      if (ab.izqDer && ab.derIzq && ab.longitudinal) {
        viento = { V_kmh: s.V_kmh, tipo: s.tipoEdificacion,
          aberturas: { izqDer: ab.izqDer, derIzq: ab.derIzq, longitudinal: ab.longitudinal } };
      }
    }
    fichas.push(ficha("Viento", "E.020 Cap. 3 · Art. 12 · Tablas 4 y 5", L2));
    out.tablaViento = tablaViento;

    /* ---- combinaciones ---- */
    if (typeof s.hayNieve === "boolean") {
      const casos = { D: true, Lr: !s.hayNieve, S: s.hayNieve, W: true };
      out.combinaciones = {
        acero: CB.paraAcero({ casos: casos }).combinaciones.map((c) => ({ id: c.id, texto: c.texto })),
        concreto: CB.paraConcreto({ casos: casos }).combinaciones
          .map((c) => ({ id: c.id, texto: c.texto }))
      };
    }

    if (D !== null && (Lr !== null || S !== null) && viento) {
      out.cargas = { D_kgfm2: D, Lr_kgfm2: Lr, S: S, viento: viento };
    }
    out.completo = !faltan.length && !!out.cargas;
    return out;
  }

  /* =====================================================================
     EL PASO ANÁLISIS
     ===================================================================== */
  function seccionDesde(modelo, perfiles) {
    const cache = {};
    return function (b) {
      const p = LIBRO.perfilDe(modelo, b).perfil;
      if (!p) return null;
      if (cache[p] === undefined) {
        let x = null;
        try { x = perfiles.busca(p); } catch (e) { x = null; }
        cache[p] = x;
      }
      return cache[p];
    };
  }

  function analisis(m3, modelo, perfiles) {
    const faltas = [];
    const sitio = modelo.sitio || {};
    const c = cargas(m3, sitio);
    if (!modelo.sistema) {
      faltas.push({ paso: "analisis", que: "elige el sistema estructural: la base y la unión columna–tijeral",
        fuente: "A.sistema" });
    }
    if (!c.completo) {
      faltas.push({ paso: "cargas", que: "faltan datos de carga: " + c.faltan.map((x) => x.que).join(" · ") });
    }
    if (ACEROS.indexOf(sitio.acero) < 0) {
      faltas.push({ paso: "cargas", que: "falta el acero del proyecto (A36 ó A572)", fuente: "A.acero.Pns" });
    }
    let g = null;
    const seccion = seccionDesde(modelo, perfiles);
    if (modelo.sistema) {
      try {
        g = AN.geometria(m3, modelo.sistema);
        const sin = AN.faltanSecciones(g, seccion, m3);
        if (sin.length) {
          faltas.push({ paso: "geom", que: "faltan perfiles para: " + sin.join(" · ") +
            ". Sin A ni I no hay análisis." });
        }
      } catch (e) {
        faltas.push({ paso: "analisis", que: e.message.split("\n").join(" ").replace(/^analisis: /, "") });
      }
    }
    if (faltas.length) return { ok: false, faltas: faltas, cargas: c };

    let r;
    try {
      r = AN.analiza({ m3: m3, sistema: modelo.sistema, seccion: seccion, acero: sitio.acero,
        cargas: c.cargas });
    } catch (e) {
      return { ok: false, cargas: c,
        faltas: [{ paso: "analisis", que: e.message.split("\n").join(" ").replace(/^\w+: /, "") }] };
    }
    return { ok: true, r: r, cargas: c, fichas: fichasAnalisis(r) };
  }

  function fichasAnalisis(r) {
    const F = [];
    F.push(ficha("El modelo", r.sistema.nombre, [
      ln("Pórtico analizado", "interior, eje " + r.eje, "geometria"),
      ln("Ancho tributario", n2(r.trib_m, 2) + " m", "geometria"),
      ln("Estados de carga", r.casos.length + " (" + r.viento.estados + " de viento)", "conteo"),
      ln("Corridas", String(r.combinaciones.length), "conteo",
        { nota: "cada combinación con cada estado de viento, y las de gravedad en los dos sentidos de nocional" }),
      ln("Acero", r.acero, "entrada")
    ]));
    const d = r.deriva;
    F.push(ficha("Deriva con viento de servicio", "H/100, fila SV.viento.H", [
      ln("Peor deriva del alero", n2(d.peor.deriva_cm, 2) + " cm", "medido", { nota: d.peor.caso }),
      ln("Relación", "H/" + n2(1 / d.peor.relacion, 0), "medido",
        { estado: d.cumple ? "ok" : "no" }),
      ln("Límite", "H/100", "norma", { fuente: "SV.viento.H" })
    ], d.cumple ? "bien" : null));
    F.push(ficha("Segundo orden", "Método Directo · Apéndice 8", [
      ln("B2 máximo", n2(r.segundoOrden.maxB2, 3), "medido",
        { nota: r.segundoOrden.maxB2 <= 1.1 ? "el ladeo amplifica poco" : null }),
      ln("τb", r.segundoOrden.tauBalt ? "nocional adicional 0,001·Yi" : "1,0", "medido",
        { nota: r.segundoOrden.nota })
    ]));
    return F;
  }

  /* Las reacciones por caso, para la tabla y para la cimentación */
  function tablaReacciones(r) {
    return r.casos.map((c) => ({
      caso: c.id, desc: c.desc,
      B0: { Rx: c.reacciones.B0.Rx_kgf, Ry: c.reacciones.B0.Ry_kgf, Mz: c.reacciones.B0.Mz_kgfcm },
      B1: { Rx: c.reacciones.B1.Rx_kgf, Ry: c.reacciones.B1.Ry_kgf, Mz: c.reacciones.B1.Mz_kgfcm }
    }));
  }

  /* ---------- EL DIBUJO DE LAS FUERZAS ----------------------------------
     El pórtico analizado, con cada barra pintada por lo que pide el modo:
       traccion · compresion · momento (solo columnas)
     El ancho y la etiqueta salen del valor; el color, del signo. */
  const MODOS = [["compresion", "Compresión máx."], ["traccion", "Tracción máx."],
    ["momento", "Momento en columnas"]];

  function dibujo(r, m3, modo) {
    const md = modo || "compresion";
    const g = AN.geometria(m3, r.sistema, r.eje);
    const barras = [];
    let max = 0;
    for (const b of g.columnas.concat(g.truss)) {
      const e = r.barras[b.id.split("@")[0]];
      let v = 0, combo = null;
      if (md === "traccion") { v = e.traccion.Pr_kgf; combo = e.traccion.combo; }
      else if (md === "compresion") { v = e.compresion.Pr_kgf; combo = e.compresion.combo; }
      else if (e.columna) { v = e.momento.Mr_kgfcm; combo = e.momento.combo; }
      max = Math.max(max, Math.abs(v));
      barras.push({ id: b.id, base: e.id, i: b.i, j: b.j, clase: b.clase, valor: v, combo: combo,
        invierte: e.invierte });
    }
    for (const b of barras) {
      b.peso = max > 0 ? Math.abs(b.valor) / max : 0;
      b.etiqueta = Math.abs(b.valor) < 1e-6 ? "" :
        (md === "momento" ? n2(b.valor / 1e5, 2) : n2(Math.abs(b.valor) / 1000, 2));
    }
    return {
      modo: md, modos: MODOS, nudos: g.nudos, barras: barras, max: max,
      unidad: md === "momento" ? "t·m" : "t",
      leyenda: md === "momento" ? "momento de segundo orden Mr = B1·Mnt + B2·Mlt, en t·m"
        : (md === "traccion" ? "tracción máxima de la envolvente, en t"
          : "compresión máxima de la envolvente, en t"),
      art: ART["A.segundo.orden"]
    };
  }

  /* Lo que la ficha de selección dice de una barra cuando hay análisis */
  function lineasFuerzas(r, idBarra) {
    const base = String(idBarra).split("@")[0];
    const e = r && r.barras[base];
    if (!e) return null;
    const L = [
      ln("Tracción máxima", e.traccion.Pr_kgf > 0 ? t2(e.traccion.Pr_kgf) : "—", "medido",
        { nota: e.traccion.combo }),
      ln("Compresión máxima", e.compresion.Pr_kgf < 0 ? t2(-e.compresion.Pr_kgf) : "—", "medido",
        { nota: e.compresion.combo })
    ];
    if (e.columna) {
      L.push(ln("Momento máximo Mr", tm(e.momento.Mr_kgfcm), "medido",
        { nota: e.momento.combo + (e.momento.B1 > 1 ? " · B1 = " + n2(e.momento.B1, 3) : "") }));
    }
    if (e.invierte) {
      L.push(ln("Cambia de signo", "sí", "medido",
        { estado: "no", nota: "tracciona en unas combinaciones y comprime en otras: hay que verificarla a las dos" }));
    }
    L.push(ln("Ratio", "falta el diseño", "medido",
      { nota: "las fuerzas ya están; el ratio es demanda entre capacidad, y la capacidad es el paso 4, Diseño" }));
    return { lineas: L, nota: "del pórtico interior típico (eje " + r.eje + "), " + r.sistema.nombre };
  }

  /* =====================================================================
     LOS FORMULARIOS, como datos · cada campo dice a qué clave del modelo va
     ===================================================================== */
  const ELEGIR = ["", "— elegir —"];
  const ABERTURAS = [ELEGIR, ["repartidas", "repartidas · Ci ±0,3"],
    ["barlovento", "principales a barlovento · Ci +0,8"],
    ["sotavento", "a sotavento o en los costados · Ci −0,6"]];
  const CAMPOS_CARGAS = [
    { grupo: "Cobertura", campos: [
      { id: "esp", clave: "espesorCobertura_mm", etiqueta: "Espesor de la plancha", unidad: "mm",
        tipo: "opcion", fuente: "D.cobertura.peso",
        opciones: [ELEGIR, ["0.40", "0,35 a 0,40"], ["0.50", "0,45 a 0,50"],
          ["0.60", "0,55 a 0,60"], ["0.80", "0,75 a 0,80"]] },
      { id: "dotras", clave: "Dotras_kgfm2", etiqueta: "Otras cargas muertas", unidad: "kgf/m²",
        tipo: "numero" }] },
    { grupo: "Techo", campos: [
      { id: "nieve", clave: "hayNieve", etiqueta: "¿Puede acumularse nieve?", tipo: "opcion",
        fuente: "Lr.liviana", opciones: [ELEGIR, ["no", "no"], ["si", "sí"]] },
      { id: "qs", clave: "Qs_kgfm2", etiqueta: "Nieve básica del sitio Qs", unidad: "kgf/m²",
        tipo: "numero", fuente: "N.Qs.min", soloSi: "nieve" }] },
    { grupo: "Viento", campos: [
      { id: "v", clave: "V_kmh", etiqueta: "Velocidad del Mapa Eólico", unidad: "km/h",
        tipo: "numero", fuente: "W.V.mapa" },
      { id: "tipo", clave: "tipoEdificacion", etiqueta: "Tipo de edificación", tipo: "opcion",
        fuente: "W.tipo", opciones: [ELEGIR, ["1", "Tipo 1"], ["2", "Tipo 2 · × 1,2"]] },
      { id: "ab_izqDer", clave: "aberturas.izqDer", etiqueta: "Aberturas · viento izq → der",
        tipo: "opcion", fuente: "W.C", opciones: ABERTURAS },
      { id: "ab_derIzq", clave: "aberturas.derIzq", etiqueta: "Aberturas · viento der → izq",
        tipo: "opcion", fuente: "W.C", opciones: ABERTURAS },
      { id: "ab_longitudinal", clave: "aberturas.longitudinal", etiqueta: "Aberturas · viento longitudinal",
        tipo: "opcion", fuente: "W.C", opciones: ABERTURAS }] },
    { grupo: "Material", campos: [
      { id: "acero", clave: "acero", etiqueta: "Acero de los perfiles", tipo: "opcion",
        fuente: "A.acero.Pns", opciones: [ELEGIR, ["A36", "A36"], ["A572", "A572 Gr. 50"]] }] }
  ];
  const CAMPOS_ANALISIS = [
    { grupo: "Sistema estructural", campos: [
      { id: "base", clave: "base", etiqueta: "Base de las columnas", tipo: "opcion", fuente: "A.sistema",
        opciones: [ELEGIR, ["empotrada", "empotrada"], ["articulada", "articulada"]] },
      { id: "union", clave: "union", etiqueta: "Unión columna–tijeral", tipo: "opcion", fuente: "A.sistema",
        opciones: [ELEGIR, ["apoyado", "apoyado · tijeral sobre la columna"],
          ["rigida", "rígida · columna a la brida sup."]] }] }
  ];

  /* De lo que hay en los campos al sitio del modelo, y de vuelta.  Un campo
     vacío NO se guarda como cero: se queda sin poner, y cargas() lo pide. */
  function leeSitio(val) {
    const s = {};
    const num = (x) => (x === "" || x === undefined || x === null || isNaN(+x)) ? undefined : +x;
    if (num(val.esp) !== undefined) s.espesorCobertura_mm = num(val.esp);
    if (num(val.dotras) !== undefined) s.Dotras_kgfm2 = num(val.dotras);
    if (val.nieve === "si" || val.nieve === "no") s.hayNieve = val.nieve === "si";
    if (s.hayNieve && num(val.qs) !== undefined) s.Qs_kgfm2 = num(val.qs);
    if (num(val.v) !== undefined) s.V_kmh = num(val.v);
    if (val.tipo === "1" || val.tipo === "2") s.tipoEdificacion = +val.tipo;
    const ab = {};
    for (const [k] of DIRECCIONES) if (val["ab_" + k]) ab[k] = val["ab_" + k];
    if (Object.keys(ab).length) s.aberturas = ab;
    if (ACEROS.indexOf(val.acero) >= 0) s.acero = val.acero;
    return s;
  }
  function valoresDeSitio(sitio) {
    const s = sitio || {};
    const v = {};
    if (s.espesorCobertura_mm !== undefined) v.esp = s.espesorCobertura_mm.toFixed(2);
    if (s.Dotras_kgfm2 !== undefined) v.dotras = String(s.Dotras_kgfm2);
    if (typeof s.hayNieve === "boolean") v.nieve = s.hayNieve ? "si" : "no";
    if (s.Qs_kgfm2 !== undefined) v.qs = String(s.Qs_kgfm2);
    if (s.V_kmh !== undefined) v.v = String(s.V_kmh);
    if (s.tipoEdificacion !== undefined) v.tipo = String(s.tipoEdificacion);
    for (const [k] of DIRECCIONES) if (s.aberturas && s.aberturas[k]) v["ab_" + k] = s.aberturas[k];
    if (s.acero) v.acero = s.acero;
    return v;
  }
  function leeSistema(val) {
    return (val.base && val.union) ? { base: val.base, union: val.union } : null;
  }

  return {
    ART, DIRECCIONES, ACEROS, MODOS, CAMPOS_CARGAS, CAMPOS_ANALISIS,
    leeSitio, valoresDeSitio, leeSistema,
    forma, cargas, seccionDesde, analisis, fichasAnalisis, tablaReacciones, dibujo, lineasFuerzas
  };
});
