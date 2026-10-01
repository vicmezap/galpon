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
      require("./analisis.js"), require("./libro.js"), require("./e030.js"),
      require("./diseno.js"), require("./zapatas.js"));
  } else {
    raiz.RESULTADOS = definir(raiz.INVENTARIO, raiz.VISTAS, raiz.E020, raiz.VIENTO,
      raiz.COMBINACIONES, raiz.ANALISIS, raiz.LIBRO, raiz.E030, raiz.DISENO, raiz.ZAPATAS);
  }
})(typeof self !== "undefined" ? self : this, function (INV, V, E020, VI, CB, AN, LIBRO, E030, DI, ZA) {
  "use strict";

  const ART = INV.declara("resultados.js", [
    "D.cobertura.peso", "Lr.liviana", "Lr.red.formula", "N.Qs.min", "N.Qt.a", "N.Qt.b",
    "N.Qt.c", "N.desbal.corto", "N.desbal.largo", "W.V.mapa", "W.Vh", "W.Ph", "W.C", "W.tipo",
    "A.sistema", "A.acero.Pns", "A.reacciones.casos", "SV.viento.H", "A.segundo.orden",
    "S.Z", "S.U", "S.perfil", "S.R0", "S.pendulo", "S.T.rayleigh", "S.C.estatico", "S.V", "S.CR",
    "S.vertical", "S.despl", "S.deriva", "S.deriva.industrial", "A.sismo.sistema", "A.sismo.periodo",
    "D.DIS.longitudes", "D.DIS.cartela", "D.DIS.E5", "E.C3.arriostre", "C.E6.a", "C.E5.cond",
    "T.U.c2", "T.U.c8", "C.E4.2L",
    "Z.sigma.neta", "Z.inc30", "Z.levantamiento", "Z.deslizamiento", "Z.punzon.momento", "Z.Vc.viga",
    "Z.As.min", "Z.s.max", "Z.rec", "Z.peralte.min", "Z.vuelco", "Z.servicio",
    "Z.bloque", "Z.franja", "Z.peso"
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

    /* ---- sismo · lo que se puede decir sin el modelo; T y V salen en el Análisis ---- */
    const L3 = [];
    let sismo = null;
    for (const [k, campo, que] of [["zona", "ca_zona", "la zona sísmica"],
      ["suelo", "ca_suelo", "el perfil de suelo"],
      ["categoria", "ca_categoria", "la categoría de la edificación"],
      ["sistemaSismico", "ca_sissis", "el sistema sísmico de la dirección transversal"]]) {
      if (!s[k]) faltan.push({ campo: campo, que: que });
    }
    if (typeof s.industrial !== "boolean") {
      faltan.push({ campo: "ca_indus", que: "si el uso es industrial (cambia el límite de deriva)" });
    }
    if (s.zona && s.suelo && s.categoria && s.sistemaSismico) {
      try {
        const st = E030.sitio({ zona: s.zona, suelo: s.suelo, vs30_ms: s.vs30_ms });
        const u = E030.factorU(s.categoria);
        const pend = s.sistemaSismico === "pendulo";
        const rr = E030.coefR({ pendulo: pend, sistema: pend ? undefined : s.sistemaSismico });
        L3.push(ln("Factor de zona Z", n2(st.Z, 2), "norma", { fuente: "S.Z" }));
        L3.push(ln("Factor de uso U", n2(u.U, 2), "norma", { fuente: "S.U" }));
        L3.push(ln("Factor de suelo S", n2(st.S, 3), "norma", { fuente: "S.perfil",
          nota: st.sinVs30 ? "sin Vs30 medido: el mayor valor del intervalo" : null }));
        L3.push(ln("Períodos TP / TL", n2(st.TP, 2) + " / " + n2(st.TL, 2) + " s", "norma",
          { fuente: "S.perfil" }));
        L3.push(ln("Coeficiente R", n2(rr.R, 2), "norma", { fuente: pend ? "S.pendulo" : "S.R0",
          nota: rr.sistema + (rr.exigeAISC341 ? " · exige el detallado del AISC 341" : "") }));
        L3.push(ln("Vertical", "2/3·Z·U·S = " + n2(2 / 3 * st.Z * u.U * st.S, 3) + " del peso", "norma",
          { fuente: "S.vertical", nota: "sin dividir por R, a la vez que la horizontal" }));
        L3.push(ln("Período y cortante", "en el Análisis", "medido",
          { nota: "T sale de Rayleigh con el propio pórtico (Art. 36.2), que aquí no está resuelto" }));
        if (typeof s.industrial === "boolean") {
          sismo = { zona: s.zona, suelo: s.suelo, vs30_ms: s.vs30_ms, categoria: s.categoria,
            sistema: s.sistemaSismico, industrial: s.industrial };
        }
      } catch (e) {
        faltan.push({ campo: "ca_suelo", que: e.message.split("\n")[0].replace(/^e030: /, "") });
      }
    }
    fichas.push(ficha("Sismo", "E.030-2026 · Art. 28, 31, 34, 36 y 38", L3));

    /* ---- combinaciones ---- */
    if (typeof s.hayNieve === "boolean") {
      const casos = { D: true, Lr: !s.hayNieve, S: s.hayNieve, W: true, E: true };
      out.combinaciones = {
        acero: CB.paraAcero({ casos: casos }).combinaciones.map((c) => ({ id: c.id, texto: c.texto })),
        concreto: CB.paraConcreto({ casos: casos }).combinaciones
          .map((c) => ({ id: c.id, texto: c.texto }))
      };
    }

    if (D !== null && (Lr !== null || S !== null) && viento && sismo) {
      out.cargas = { D_kgfm2: D, Lr_kgfm2: Lr, S: S, viento: viento, sismo: sismo };
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
    if (r.sismo) {
      const s = r.sismo, dd = s.deriva;
      F.push(ficha("Sismo", "E.030-2026", [
        ln("Peso sísmico P", t2(s.P_kgf), "medido",
          { nota: "carga muerta del pórtico + 25 % de la viva de techo" }),
        ln("Período de Rayleigh", n2(s.T_rayleigh_s, 3) + " s", "norma", { fuente: "S.T.rayleigh" }),
        ln("Período usado, × 0,85", n2(s.T_s, 3) + " s", "norma",
          { fuente: "A.sismo.periodo", nota: "hn/35 daría " + n2(s.T_hnCT_s, 3) + " s" }),
        ln("C estático", n2(s.C, 2), "norma", { fuente: "S.C.estatico" }),
        ln("C/R", n2(s.CR_usado, 3), "norma",
          { fuente: "S.CR", nota: s.enMinimoCR ? "manda el mínimo 0,11" : null }),
        ln("Cortante en la base V", t2(s.V_kgf), "norma", { fuente: "S.V" }),
        ln("Vertical ± Ev", t2(s.Ev_kgf), "norma", { fuente: "S.vertical" }),
        ln("Deriva sísmica", "Δ × " + n2(dd.multiplicador, 2) + " = " + n2(dd.deriva_cm, 2) + " cm",
          "norma", { fuente: "S.despl" }),
        ln("Relación", n2(dd.relacion, 4) + " contra " + n2(dd.limite, 3), "norma",
          { fuente: s.industrial ? "S.deriva.industrial" : "S.deriva", estado: dd.cumple ? "ok" : "no",
            nota: dd.cumple ? null : "NO CUMPLE: hace falta más rigidez lateral (columnas o sistema)" })
      ], dd.cumple ? "bien" : null));
    }
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
        tipo: "numero", fuente: "N.Qs.min", soloSi: "nieve=si" }] },
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
    { grupo: "Sismo", campos: [
      { id: "zona", clave: "zona", etiqueta: "Zona sísmica", tipo: "opcion", fuente: "S.Z",
        opciones: [ELEGIR, ["Z1", "Z1 · 0,10"], ["Z2", "Z2 · 0,25"], ["Z3", "Z3 · 0,35"], ["Z4", "Z4 · 0,45"]] },
      { id: "suelo", clave: "suelo", etiqueta: "Perfil de suelo", tipo: "opcion", fuente: "S.perfil",
        opciones: [ELEGIR, ["S0", "S0 · roca dura"], ["S1", "S1 · roca o suelo muy rígido"],
          ["S2", "S2 · suelo intermedio"], ["S3", "S3 · suelo blando"], ["S4", "S4 · excepcional"]] },
      { id: "vs30", clave: "vs30_ms", etiqueta: "Vs30 medido (opcional)", unidad: "m/s", tipo: "numero",
        fuente: "S.perfil" },
      { id: "categoria", clave: "categoria", etiqueta: "Categoría de la edificación", tipo: "opcion",
        fuente: "S.U", opciones: [ELEGIR, ["A", "A · esencial (1,5)"], ["B", "B · importante (1,3)"],
          ["C", "C · común (1,0)"]] },
      { id: "sissis", clave: "sistemaSismico", etiqueta: "Sistema sísmico transversal", tipo: "opcion",
        fuente: "S.R0", opciones: [ELEGIR, ["pendulo", "péndulo invertido · R₀ 2,5"],
          ["OMF", "ordinario OMF · R₀ 4"], ["IMF", "intermedio IMF · R₀ 5"],
          ["SMF", "especial SMF · R₀ 8"]] },
      { id: "indus", clave: "industrial", etiqueta: "Uso industrial (deriva hasta 2× la tabla)",
        tipo: "opcion", fuente: "S.deriva.industrial", opciones: [ELEGIR, ["no", "no"], ["si", "sí"]] }] },
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
    if (val.zona) s.zona = val.zona;
    if (val.suelo) s.suelo = val.suelo;
    if (num(val.vs30) !== undefined) s.vs30_ms = num(val.vs30);
    if (val.categoria) s.categoria = val.categoria;
    if (val.sissis) s.sistemaSismico = val.sissis;
    if (val.indus === "si" || val.indus === "no") s.industrial = val.indus === "si";
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
    if (s.zona) v.zona = s.zona;
    if (s.suelo) v.suelo = s.suelo;
    if (s.vs30_ms !== undefined) v.vs30 = String(s.vs30_ms);
    if (s.categoria) v.categoria = s.categoria;
    if (s.sistemaSismico) v.sissis = s.sistemaSismico;
    if (typeof s.industrial === "boolean") v.indus = s.industrial ? "si" : "no";
    return v;
  }
  function leeSistema(val) {
    return (val.base && val.union) ? { base: val.base, union: val.union } : null;
  }

  /* =====================================================================
     EL PASO DISEÑO
     ===================================================================== */
  const SINO = [ELEGIR, ["si", "sí"], ["no", "no"]];
  const CAMPOS_DISENO = [
    { grupo: "Arriostramiento", campos: [
      { id: "arrinf", clave: "arriostreInferior_m", etiqueta: "Arriostre lateral de la brida inferior cada",
        unidad: "m", tipo: "numero", fuente: "D.DIS.longitudes" },
      { id: "larg", clave: "separacionLargueros_m", etiqueta: "Separación de los largueros", unidad: "m",
        tipo: "numero", fuente: "D.DIS.longitudes" },
      { id: "lb", clave: "LbColumna_m", etiqueta: "Lb de la columna (pandeo lateral-torsional)", unidad: "m",
        tipo: "numero", fuente: "D.DIS.longitudes" },
      { id: "ap6", clave: "arriostreComprobado", etiqueta: "Correas, largueros y arriostres cumplen el Apéndice 6",
        tipo: "opcion", fuente: "E.C3.arriostre", opciones: SINO }] },
    { grupo: "Tijeral", campos: [
      { id: "cart", clave: "cartela", etiqueta: "Ángulos dobles: separación", tipo: "opcion",
        fuente: "D.DIS.cartela", opciones: [ELEGIR, ["0", "en contacto"], ["3/8", "cartela de 3/8\""],
          ["3/4", "cartela de 3/4\""]] },
      { id: "sep", clave: "separadores_cm", etiqueta: "Separadores de los ángulos dobles cada", unidad: "cm",
        tipo: "numero", fuente: "C.E6.a" },
      { id: "consep", clave: "conexionSeparadores", etiqueta: "Los separadores van", tipo: "opcion",
        fuente: "C.E6.a", opciones: [ELEGIR, ["requintado", "soldados"], ["apretado", "con pernos ajustados"]] },
      { id: "e5", clave: "condicionesE5", etiqueta: "Las barras de ángulo simple cumplen las 5 condiciones del E5",
        tipo: "opcion", fuente: "C.E5.cond", opciones: SINO },
      { id: "un", clave: "uniones", etiqueta: "Uniones de las barras", tipo: "opcion", fuente: "T.U.c2",
        opciones: [ELEGIR, ["soldadas", "soldadas"], ["empernadas", "empernadas"]] },
      { id: "sold", clave: "soldadura_cm", etiqueta: "Longitud de soldadura en la cartela", unidad: "cm",
        tipo: "numero", fuente: "T.U.c2", soloSi: "un=soldadas" },
      { id: "pern", clave: "pernosPorLinea", etiqueta: "Pernos por línea", tipo: "numero", fuente: "T.U.c8",
        soloSi: "un=empernadas" },
      { id: "dperno", clave: "diametroPerno", etiqueta: "Diámetro de los pernos", tipo: "opcion",
        fuente: "T.U.c8", soloSi: "un=empernadas",
        opciones: [ELEGIR, ["1/2", "1/2\""], ["5/8", "5/8\""], ["3/4", "3/4\""], ["7/8", "7/8\""],
          ["M16", "M16"], ["M20", "M20"], ["M22", "M22"]] }] }
  ];

  function leeDiseno(val) {
    const d = {};
    const num = (x) => (x === "" || x === undefined || x === null || isNaN(+x)) ? undefined : +x;
    const pon = (k, v) => { if (v !== undefined) d[k] = v; };
    pon("arriostreInferior_m", num(val.arrinf));
    pon("separacionLargueros_m", num(val.larg));
    pon("LbColumna_m", num(val.lb));
    if (val.ap6 === "si" || val.ap6 === "no") d.arriostreComprobado = val.ap6 === "si";
    if (DI.CARTELAS[val.cart] !== undefined && val.cart !== "") d.cartela = val.cart;
    pon("separadores_cm", num(val.sep));
    if (val.consep === "requintado" || val.consep === "apretado") d.conexionSeparadores = val.consep;
    if (val.e5 === "si" || val.e5 === "no") d.condicionesE5 = val.e5 === "si";
    if (val.un === "soldadas" || val.un === "empernadas") d.uniones = val.un;
    if (d.uniones === "soldadas") pon("soldadura_cm", num(val.sold));
    if (d.uniones === "empernadas") {
      pon("pernosPorLinea", num(val.pern));
      if (val.dperno) d.diametroPerno = val.dperno;
    }
    return d;
  }
  function valoresDeDiseno(dz) {
    const d = dz || {}, v = {};
    const s = (k, x) => { if (x !== undefined) v[k] = String(x); };
    s("arrinf", d.arriostreInferior_m); s("larg", d.separacionLargueros_m); s("lb", d.LbColumna_m);
    if (typeof d.arriostreComprobado === "boolean") v.ap6 = d.arriostreComprobado ? "si" : "no";
    s("cart", d.cartela); s("sep", d.separadores_cm); s("consep", d.conexionSeparadores);
    if (typeof d.condicionesE5 === "boolean") v.e5 = d.condicionesE5 ? "si" : "no";
    s("un", d.uniones); s("sold", d.soldadura_cm); s("pern", d.pernosPorLinea); s("dperno", d.diametroPerno);
    return v;
  }

  /* El diseño entero: corre el análisis si hace falta y verifica.  Lo que
     falte se dice con el paso al que hay que ir, como en el análisis. */
  function diseno(m3, modelo, perfiles, an) {
    const a = an || analisis(m3, modelo, perfiles);
    if (!a.ok) {
      return { ok: false, faltas: [{ paso: "analisis",
        que: "el diseño necesita el análisis, y el análisis todavía no corre" }].concat(a.faltas) };
    }
    const seccion = seccionDesde(modelo, perfiles);
    const v = DI.verificaPortico({ analisis: a.r, m3: m3, seccion: seccion, acero: modelo.sitio.acero,
      diseno: modelo.diseno || {} });
    if (!v.ok) {
      return { ok: false, faltas: v.faltan.map((f) => ({ paso: "diseno", que: f.que, campo: f.campo })) };
    }
    return { ok: true, v: v, r: a.r, fichas: fichasDiseno(v) };
  }

  function fichasDiseno(v) {
    const R = v.resumen;
    const L = [
      ln("Barras verificadas", String(R.total), "conteo"),
      ln("Cumplen", R.cumplen + " de " + R.total, "conteo", { estado: R.cumplen === R.total ? "ok" : "no" }),
      ln("Con un control esencial sin hacer", String(R.conOmitidosEsenciales), "conteo",
        { estado: R.conOmitidosEsenciales ? "no" : "ok",
          nota: R.conOmitidosEsenciales ? "no cumplen aunque su ratio sea bajo: falta comprobar algo que manda" : null }),
      ln("La peor", R.peor.id + " · " + (R.peor.ratio === null ? "—" : n2(R.peor.ratio, 2)), "medido",
        { estado: R.peor.ratio > 1 ? "no" : null, nota: R.peor.estado ? R.peor.estado + " · " + R.peor.combo : null })
    ];
    return [ficha("Resumen", "ratio = demanda / capacidad, AISC 360-22", L,
      R.cumplen === R.total ? "bien" : null)];
  }

  function nivelRatio(x) {
    if (x.faltanEsenciales || x.ratio === null) return "falta";
    return x.ratio > 1 + 1e-12 ? "no" : "ok";
  }

  /* El pórtico pintado por ratio: verde cumple, rojo no, naranja discontinuo
     si falta un control esencial.  El grosor crece con el ratio. */
  function dibujoDiseno(dv, m3) {
    const g = AN.geometria(m3, dv.r.sistema, dv.r.eje);
    const barras = [];
    for (const b of g.columnas.concat(g.truss)) {
      const x = dv.v.barras[b.id.split("@")[0]];
      const nivel = nivelRatio(x);
      barras.push({ id: b.id, base: x.id, i: b.i, j: b.j, clase: b.clase, valor: x.ratio || 0,
        nivel: nivel, cls: nivel === "ok" ? "ok" : (nivel === "no" ? "no" : "falta"),
        peso: Math.min(1, (x.ratio || 0) / 1.5),
        etiqueta: x.ratio === null ? "?" : n2(x.ratio, 2) });
    }
    return { modo: "ratio", nudos: g.nudos, barras: barras,
      leyenda: "ratio = demanda / capacidad · el grosor crece con el ratio" };
  }

  function tablaDiseno(v) {
    return Object.keys(v.porClase).map((k) => v.porClase[k]);
  }

  function lineasDiseno(v, idBarra) {
    const x = v && v.barras[String(idBarra).split("@")[0]];
    if (!x) return null;
    const L = [
      ln("Perfil", x.perfil, "entrada"),
      ln("Ratio", x.ratio === null ? "no se pudo calcular" : n2(x.ratio, 3), "medido",
        { estado: nivelRatio(x) === "ok" ? "ok" : "no", nota: x.estado ? x.estado + " · " + x.combo : null })
    ];
    for (const q of (x.ratios || [])) {
      if (q.estado === x.estado) continue;
      L.push(ln(q.estado.split(" · ")[0], n2(q.valor, 3), "medido", { nota: q.estado }));
    }
    for (const o of x.omitidos) {
      /* lo que falta va en la etiqueta y la palabra corta en el valor: el valor no
         parte línea y un texto largo ahí se montaba sobre la etiqueta */
      L.push(ln(o.que, o.esencial ? "FALTA" : "supuesto", "medido",
        { estado: o.esencial ? "no" : null, nota: o.motivo }));
    }
    return { lineas: L, cumple: x.cumple,
      nota: x.cumple ? "cumple" : (x.faltanEsenciales ? "no cumple: falta un control esencial" : "no cumple: ratio mayor que 1") };
  }

  /* Lo que el análisis y el diseño tienen que contarle a Comprobación.  Solo
     lo que ya está calculado: Comprobación no corre nada por su cuenta. */
  function avisosResultados(a, d, cz) {
    const L = [];
    if (a && a.ok) {
      const r = a.r;
      if (!r.deriva.cumple) {
        L.push({ nivel: "error", que: "La deriva con viento de servicio no cumple: H/" +
          Math.round(1 / r.deriva.peor.relacion), porque: "el límite es H/100 (fila SV.viento.H). " +
          "Hace falta más rigidez lateral.", fuente: "SV.viento.H", paso: "analisis" });
      }
      if (r.sismo && !r.sismo.deriva.cumple) {
        L.push({ nivel: "error", que: "La deriva sísmica no cumple: " +
          r.sismo.deriva.relacion.toFixed(4).replace(".", ",") + " contra " +
          r.sismo.deriva.limite.toFixed(3).replace(".", ","),
          porque: "desplazamiento × 0,75·R contra la Tabla N° 14. Más rigidez lateral, o declarar uso " +
            "industrial si lo es.", fuente: "S.despl", paso: "analisis" });
      }
      for (const x of r.avisos) {
        if (/sale al \d+,\d %/.test(x)) L.push({ nivel: "aviso", que: "El sistema sísmico no es el de la geometría",
          porque: x, fuente: "A.sismo.sistema", paso: "cargas" });
      }
    }
    if (d && d.ok) {
      const filas = Object.keys(d.v.barras).map((k) => d.v.barras[k]);
      const no = filas.filter((x) => !x.faltanEsenciales && x.ratio > 1 + 1e-12);
      const falta = filas.filter((x) => x.faltanEsenciales);
      if (no.length) {
        L.push({ nivel: "error", que: no.length + " barra(s) con ratio mayor que 1",
          porque: "la peor, " + d.v.resumen.peor.id + " con " + d.v.resumen.peor.ratio.toFixed(2)
            .replace(".", ",") + ". Se cambia el perfil en la tabla de Geometría.",
          cuales: no.map((x) => x.id), paso: "diseno" });
      }
      if (falta.length) {
        L.push({ nivel: "error", que: falta.length + " barra(s) con un control esencial sin hacer",
          porque: "no cumplen aunque su ratio sea bajo: " + falta[0].omitidos.filter((o) => o.esencial)[0].que,
          cuales: falta.map((x) => x.id), paso: "diseno" });
      }
    }
    if (cz && cz.ok && !cz.z.cumple) {
      L.push({ nivel: "error", que: "La zapata no cumple: " + cz.z.fallas.join(", "),
        porque: cz.z.auto ? "ni con las medidas buscadas: revisa el suelo, el desplante o el pedestal"
          : "con las medidas dadas. Borra B, L y h para que se busquen.", paso: "cimen" });
    }
    return L;
  }

  /* =====================================================================
     EL PASO CIMENTACIÓN · E8
     ===================================================================== */
  const CAMPOS_CIMENTACION = [
    { grupo: "Suelo", campos: [
      { id: "sigma", clave: "sigmaAdm_kgfcm2", etiqueta: "Presión admisible del estudio de suelos",
        unidad: "kgf/cm²", tipo: "numero", fuente: "Z.sigma.neta" },
      { id: "neta", clave: "esNeta", etiqueta: "Esa presión es", tipo: "opcion", fuente: "Z.sigma.neta",
        opciones: [ELEGIR, ["bruta", "bruta: se descuenta el relleno y la sobrecarga"], ["neta", "neta: ya descontada"]] },
      { id: "df", clave: "Df_cm", etiqueta: "Profundidad de desplante", unidad: "cm", tipo: "numero",
        fuente: "Z.sigma.neta" },
      { id: "gr", clave: "gammaRelleno_kgfm3", etiqueta: "Peso específico del relleno", unidad: "kgf/m³",
        tipo: "numero", fuente: "Z.peso" },
      { id: "sc", clave: "sc_kgfm2", etiqueta: "Sobrecarga sobre el piso", unidad: "kgf/m²", tipo: "numero",
        fuente: "Z.sigma.neta" },
      { id: "mu", clave: "mu", etiqueta: "Coeficiente de rozamiento μ (opcional)", tipo: "numero",
        fuente: "Z.deslizamiento" }] },
    { grupo: "Concreto y acero", campos: [
      { id: "fc", clave: "fc_kgcm2", etiqueta: "f'c del concreto", tipo: "opcion", fuente: "Z.bloque",
        opciones: [ELEGIR, ["210", "210 kgf/cm²"], ["280", "280 kgf/cm²"], ["350", "350 kgf/cm²"]] },
      { id: "grado", clave: "grado", etiqueta: "Acero de refuerzo", tipo: "opcion", fuente: "Z.As.min",
        opciones: [ELEGIR, ["60", "Grado 60 · fy 420 MPa"], ["40", "Grado 40 · fy 280 MPa"]] },
      { id: "rec", clave: "rec_cm", etiqueta: "Recubrimiento (mín. 7 cm)", unidad: "cm", tipo: "numero",
        fuente: "Z.rec" },
      { id: "barra", clave: "barra", etiqueta: "Barra de la parrilla", tipo: "opcion", fuente: "Z.s.max",
        opciones: [ELEGIR, ["1/2", "1/2\""], ["5/8", "5/8\""], ["3/4", "3/4\""], ["1", "1\""]] }] },
    { grupo: "Pedestal", campos: [
      { id: "pedb", clave: "pedB_cm", etiqueta: "Ancho del pedestal (fuera del plano)", unidad: "cm", tipo: "numero" },
      { id: "pedl", clave: "pedL_cm", etiqueta: "Largo del pedestal (en el plano del pórtico)", unidad: "cm",
        tipo: "numero" },
      { id: "sobre", clave: "sobreTerreno_cm", etiqueta: "Cuánto sobresale del terreno", unidad: "cm",
        tipo: "numero" }] },
    { grupo: "Zapata (vacío: se buscan las medidas)", campos: [
      { id: "zb", clave: "B_cm", etiqueta: "B", unidad: "cm", tipo: "numero" },
      { id: "zl", clave: "L_cm", etiqueta: "L (en el plano del pórtico)", unidad: "cm", tipo: "numero" },
      { id: "zh", clave: "h_cm", etiqueta: "Peralte h", unidad: "cm", tipo: "numero", fuente: "Z.peralte.min" }] }
  ];

  function leeCimentacion(val) {
    const c = {};
    const num = (x) => (x === "" || x === undefined || x === null || isNaN(+x)) ? undefined : +x;
    const pon = (k, v) => { if (v !== undefined) c[k] = v; };
    pon("sigmaAdm_kgfcm2", num(val.sigma));
    if (val.neta === "neta" || val.neta === "bruta") c.esNeta = val.neta === "neta";
    pon("Df_cm", num(val.df)); pon("gammaRelleno_kgfm3", num(val.gr)); pon("sc_kgfm2", num(val.sc));
    pon("mu", num(val.mu)); pon("fc_kgcm2", num(val.fc));
    if (val.grado === "60" || val.grado === "40") c.grado = val.grado;
    pon("rec_cm", num(val.rec));
    if (val.barra) c.barra = val.barra;
    pon("pedB_cm", num(val.pedb)); pon("pedL_cm", num(val.pedl)); pon("sobreTerreno_cm", num(val.sobre));
    pon("B_cm", num(val.zb)); pon("L_cm", num(val.zl)); pon("h_cm", num(val.zh));
    return c;
  }
  function valoresDeCimentacion(cz) {
    const c = cz || {}, v = {};
    const s = (k, x) => { if (x !== undefined) v[k] = String(x); };
    s("sigma", c.sigmaAdm_kgfcm2);
    if (typeof c.esNeta === "boolean") v.neta = c.esNeta ? "neta" : "bruta";
    s("df", c.Df_cm); s("gr", c.gammaRelleno_kgfm3); s("sc", c.sc_kgfm2); s("mu", c.mu); s("fc", c.fc_kgcm2);
    s("grado", c.grado); s("rec", c.rec_cm); s("barra", c.barra);
    s("pedb", c.pedB_cm); s("pedl", c.pedL_cm); s("sobre", c.sobreTerreno_cm);
    s("zb", c.B_cm); s("zl", c.L_cm); s("zh", c.h_cm);
    return v;
  }

  /* La zapata: necesita el análisis, porque lo que le llega son sus casos */
  function cimentacion(m3, modelo, perfiles, an) {
    const a = an || analisis(m3, modelo, perfiles);
    if (!a.ok) {
      return { ok: false, faltas: [{ paso: "analisis",
        que: "la cimentación necesita las reacciones del análisis, y el análisis todavía no corre" }].concat(a.faltas) };
    }
    const c = modelo.cimentacion || {};
    const d = { casos: a.r.casos,
      suelo: { sigmaAdm_kgfcm2: c.sigmaAdm_kgfcm2, esNeta: c.esNeta, Df_cm: c.Df_cm,
        gammaRelleno_kgfm3: c.gammaRelleno_kgfm3, sc_kgfm2: c.sc_kgfm2, mu: c.mu },
      concreto: { fc_kgcm2: c.fc_kgcm2, grado: c.grado, rec_cm: c.rec_cm, barra: c.barra },
      pedestal: { b_cm: c.pedB_cm, l_cm: c.pedL_cm, sobreTerreno_cm: c.sobreTerreno_cm },
      zapata: (c.B_cm > 0 && c.L_cm > 0 && c.h_cm > 0) ? { B_cm: c.B_cm, L_cm: c.L_cm, h_cm: c.h_cm } : null };
    const z = ZA.disena(d);
    if (!z.ok) {
      /* el pedestal tiene dos campos: se manda al primero */
      return { ok: false, faltas: z.faltan.map((f) => ({ paso: "cimen", que: f.que,
        campo: f.campo === "ci_ped" ? "ci_pedb" : f.campo })) };
    }
    return { ok: true, z: z, r: a.r, datos: c, fichas: fichasCimentacion(z) };
  }

  /* El dibujo de la zapata en cm: la sección en el plano del pórtico con la
     presión de la combinación de servicio que manda, y la planta con las barras.
     La plantilla solo lo escala. */
  function dibujoCimentacion(cz) {
    const z = cz.z, p = z.servicio.peor, c = z.concreto;
    const d = cz.datos;
    const pr = ZA.presion(p.N, p.e, z.zapata.B_cm, z.zapata.L_cm);
    const L = z.zapata.L_cm, puntos = [];
    if (pr.q) for (let i = 0; i <= 40; i++) { const x = -L / 2 + L * i / 40; puntos.push([x, pr.q(x)]); }
    return {
      B: z.zapata.B_cm, L: L, h: z.zapata.h_cm, Df: d.Df_cm, sobre: d.sobreTerreno_cm,
      pedB: d.pedB_cm, pedL: d.pedL_cm,
      presion: { puntos: puntos, qmax: p.qmax, admisible: p.admisible, combo: p.combo, base: p.base,
        forma: p.forma || (p.vuelca ? "vuelca: la resultante cae fuera" : "se levanta"), cumple: p.ratio <= 1 },
      barrasL: c.aceroL && !c.aceroL.insuficiente ? c.aceroL.n : 0,
      barrasB: c.aceroB && !c.aceroB.insuficiente ? c.aceroB.n : 0,
      barrasSup: c.aceroSup && !c.aceroSup.insuficiente ? c.aceroSup.n : 0,
      rec: d.rec_cm, cumple: z.cumple
    };
  }

  const cm2 = (x) => n2(x, 2) + " cm²";
  function fichasCimentacion(z) {
    const s = z.servicio.peor, l = z.levantamiento, c = z.concreto;
    const F = [];
    F.push(ficha("La zapata", z.auto ? "medidas buscadas: las mínimas que cumplen" : "medidas dadas", [
      ln("B × L × h", n2(z.zapata.B_cm, 0) + " × " + n2(z.zapata.L_cm, 0) + " × " + n2(z.zapata.h_cm, 0) + " cm",
        z.auto ? "medido" : "entrada"),
      ln("Peso de zapata + pedestal", t2(z.pesos.zapata + z.pesos.pedestal), "medido"),
      ln("Peso del relleno encima", t2(z.pesos.relleno), "medido",
        { nota: "contra el levantamiento, y cargando los volados" })
    /* lo largo va en la etiqueta y la palabra corta en el valor: el valor no parte línea */
    ].concat(z.cumple ? [] : [ln(z.fallas.join(" · "), "NO CUMPLE", "medido", { estado: "no" })]),
    z.cumple ? "bien" : null));
    F.push(ficha("El suelo, en servicio", "sin tracción · +30 % con viento o sismo", [
      ln("Presión admisible neta", n2(z.sigmaN, 3) + " kgf/cm²", "norma", { fuente: "Z.sigma.neta" }),
      ln("Presión máxima", s.qmax ? n2(s.qmax, 3) + " kgf/cm²" : "—", "medido",
        { nota: s.combo + " · base " + s.base + " · " + (s.forma || (s.vuelca ? "VUELCA" : "se levanta")) }),
      ln("Contra la admisible", n2(s.admisible, 3) + " kgf/cm²", "norma",
        { fuente: "Z.inc30", estado: s.ratio <= 1 ? "ok" : "no" }),
      ln("Excentricidad e/L", n2(Math.abs(s.eL), 3), "medido",
        { nota: s.vuelca ? "más de L/2: la resultante cae fuera de la base, la zapata vuelca"
          : (Math.abs(s.eL) > 1 / 6 ? "más de L/6: presión triangular, parte de la base no apoya"
            : "dentro del tercio central") }),
      ln("Deslizamiento μ·N/H", z.servicio.deslizamiento ? n2(z.servicio.deslizamiento.deslizamiento, 2) : "sin μ",
        "medido", { nota: "la E.060 no fija factor: lo decide el estudio de suelos (fila Z.deslizamiento)" })
    ]));
    F.push(ficha("Levantamiento", "0,9·(D + zapata + pedestal + relleno) contra el viento y el sismo", [
      ln("Lo que tira hacia arriba / lo que sujeta", l.combo ? n2(l.ratio, 3) : "nada tira", "norma",
        { fuente: "Z.levantamiento", estado: l.ratio <= 1 ? "ok" : "no", nota: l.combo || null }),
      ln("Resultante amplificada dentro de la base", z.vuelcoAmplificado.length ? "cae fuera en " +
        z.vuelcoAmplificado.length : "en todas", "norma", { fuente: "Z.vuelco",
        estado: z.vuelcoAmplificado.length ? "no" : "ok",
        nota: z.vuelcoAmplificado.length ? z.vuelcoAmplificado[0].combo + " · base " + z.vuelcoAmplificado[0].base : null })
    ]));
    const ac = (a, nom) => a.insuficiente ? ln("Acero " + nom, "peralte insuficiente", "medido", { estado: "no" })
      : ln("Acero " + nom, a.n + " Ø" + a.barra + "\" @ " + n2(a.s, 0) + " cm", "norma",
        { fuente: { "mínimo": "Z.As.min", "separación": "Z.s.max", "flexión": "Z.bloque" }[a.manda],
          nota: "As " + cm2(a.As) + " · manda " + { "mínimo": "el mínimo", "separación": "la separación máxima",
            "flexión": "la flexión" }[a.manda] + " (hacen falta " + cm2(Math.max(a.As_req, a.As_min)) + ") · Mu " + tm(a.Mu) });
    F.push(ficha("El concreto, con cargas amplificadas", "E.060 · secciones críticas en la cara del pedestal", [
      ln("Cortante como viga, L", n2(c.cortL.ratio, 3), "norma", { fuente: "Z.Vc.viga", estado: c.cortL.ratio <= 1 ? "ok" : "no" }),
      ln("Cortante como viga, B", n2(c.cortB.ratio, 3), "norma", { fuente: "Z.Vc.viga", estado: c.cortB.ratio <= 1 ? "ok" : "no" }),
      ln("Punzonamiento con momento", n2(c.punz.ratio, 3), "norma", { fuente: "Z.punzon.momento",
        estado: c.punz.ratio <= 1 ? "ok" : "no", nota: "γv = " + n2(c.punz.gv, 3) + " · momento transferido " + tm(c.punz.Mt) }),
      ac(c.aceroL, "en L"), ac(c.aceroB, "en B")].concat(c.aceroSup ? [ac(c.aceroSup, "arriba, en L")] : []).concat([
      ln("Peralte mínimo", n2(c.hMin, 1) + " cm", "norma", { fuente: "Z.peralte.min",
        estado: z.zapata.h_cm >= c.hMin - 1e-9 ? "ok" : "no" })
    ]).concat(c.franja ? [ln("Franja central (lado corto)", n2(c.franja.gs, 3) + " del acero", "norma",
      { fuente: "Z.franja", nota: c.franja.nota })] : [])));
    return F;
  }

  return {
    ART, DIRECCIONES, ACEROS, MODOS, CAMPOS_CARGAS, CAMPOS_ANALISIS, CAMPOS_DISENO, avisosResultados,
    CAMPOS_CIMENTACION, leeCimentacion, valoresDeCimentacion, cimentacion, fichasCimentacion, dibujoCimentacion,
    leeSitio, valoresDeSitio, leeSistema, leeDiseno, valoresDeDiseno,
    diseno, fichasDiseno, dibujoDiseno, tablaDiseno, lineasDiseno, nivelRatio,
    forma, cargas, seccionDesde, analisis, fichasAnalisis, tablaReacciones, dibujo, lineasFuerzas
  };
});
