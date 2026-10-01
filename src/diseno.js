/* =====================================================================
   diseno.js — el ratio de cada barra del pórtico

   El análisis da las fuerzas de segundo orden de cada barra en cada
   combinación; aquí se comparan con su capacidad, por el capítulo que le
   toca a cada una:

     columna (perfil I)   viga-columna · columnas.verifica() · D, E, F2, G, H
     brida 2L             E3 en el plano · E4 fuera, con la esbeltez
                          modificada del E6 (fila C.E4.2L) · D en tracción
     diagonal o montante  ángulo simple · E5 si se cumplen sus cinco
     de ángulo simple     condiciones (fila C.E5.cond) · D en tracción
     otra cosa            se dice que no está, y la barra NO cumple

   ─────────────────────────────────────────────────────────────────────
   LO QUE NO SE PUEDE COMPROBAR NO CUENTA COMO COMPROBADO.  Es la regla de
   elemento.js llevada al pórtico: un control que falta se apunta como
   omitido, y si es esencial la barra no cumple aunque su ratio sea 0,4.
   Un ratio bajo con un pandeo sin mirar es la forma más cara de equivocarse.

   LOS DATOS DE DISEÑO NO TIENEN VALOR POR OMISIÓN.  Cada cuánto se
   arriostra la brida inferior decide el levantamiento; la separación de los
   largueros, la columna fuera del plano; las cinco condiciones del E5, si la
   diagonal es una barra axial o una viga-columna.  Son del proyectista.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./acero.js"),
      require("./elemento.js"), require("./tijeral.js"), require("./columnas.js"),
      require("./analisis.js"), require("./conexiones.js"), require("./perfiles.js"));
  } else {
    raiz.DISENO = definir(raiz.INVENTARIO, raiz.ACERO, raiz.ELEMENTO, raiz.TIJERAL,
      raiz.COLUMNAS, raiz.ANALISIS, raiz.CONEXIONES, raiz.PERFILES);
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC, EL, TI, CO, AN, CX, PERF) {
  "use strict";

  const ART = INV.declara("diseno.js", [
    "C.E4.2L", "C.E4.Cw", "C.E4.Fe3", "C.E6.m1", "C.E6.a", "C.E5.cond", "C.B4a",
    "E.C3.K", "E.C3.arriostre", "T.U.c2", "T.U.c8", "F.Lp", "F.c", "F.B4.c10", "F.B4.c15",
    "D.DIS.longitudes",
    "D.DIS.E5", "D.DIS.cartela", "D.DIS.unicos"
  ]);

  function exige(c, msg) { if (!c) throw new Error("diseno: " + msg); }

  /* La separación de la cartela elige ry, ro y H del 2L en el catálogo */
  const CARTELAS = { "0": "sep0", "3/8": "sep38", "3/4": "sep34" };

  /* ---------- lo que hace falta saber, según lo que haya en el pórtico ---- */
  function faltan(g, seccion, dz) {
    const d = dz || {};
    const F = [];
    const fams = {};
    for (const b of g.truss) { const s = seccion(b); if (s) fams[s.familia + "|" + b.clase] = true; }
    const hay = (f) => Object.keys(fams).some((k) => k.split("|")[0] === f);
    if (!(d.arriostreInferior_m > 0)) {
      F.push({ campo: "di_arrinf", que: "cada cuánto se arriostra lateralmente la brida inferior" });
    }
    if (!(d.separacionLargueros_m > 0)) {
      F.push({ campo: "di_larg", que: "la separación de los largueros de la columna" });
    }
    if (!(d.LbColumna_m > 0)) {
      F.push({ campo: "di_lb", que: "la longitud no arriostrada de la columna para el pandeo lateral-torsional" });
    }
    if (hay("2L")) {
      if (CARTELAS[d.cartela] === undefined) F.push({ campo: "di_cart", que: "el espesor de las cartelas del tijeral" });
      if (!(d.separadores_cm > 0)) F.push({ campo: "di_sep", que: "la separación de los separadores de los ángulos dobles" });
      if (d.conexionSeparadores !== "requintado" && d.conexionSeparadores !== "apretado") {
        F.push({ campo: "di_consep", que: "cómo se unen los separadores (soldados o con pernos)" });
      }
    }
    if (hay("L") && typeof d.condicionesE5 !== "boolean") {
      F.push({ campo: "di_e5", que: "si las barras de ángulo simple cumplen las cinco condiciones del E5" });
    }
    if (d.uniones !== "soldadas" && d.uniones !== "empernadas") {
      F.push({ campo: "di_un", que: "si las uniones del tijeral son soldadas o empernadas" });
    } else if (d.uniones === "soldadas" && !(d.soldadura_cm > 0)) {
      F.push({ campo: "di_sold", que: "la longitud de soldadura de las barras en la cartela" });
    } else if (d.uniones === "empernadas" && (!(d.pernosPorLinea >= 1) || !d.diametroPerno)) {
      F.push({ campo: "di_pern", que: "los pernos de las barras: cuántos por línea y su diámetro" });
    }
    if (typeof d.arriostreComprobado !== "boolean") {
      F.push({ campo: "di_ap6", que: "si correas, largueros y arriostres están comprobados por el Apéndice 6" });
    }
    return F;
  }

  /* ---------- el E4 de un 2L · fila C.E4.2L ------------------------------ */
  function feFlexotorsional(d) {
    const Fey = d.Fey_kgcm2;
    exige(Fey > 0, "feFlexotorsional() necesita Fey_kgcm2");
    const ez = AC.Fez({ Cw_cm6: d.Cw_cm6, J_cm4: d.J_cm4, Lcz_cm: d.Lcz_cm, Ag_cm2: d.Ag_cm2, ro2: d.ro2 });
    const fe = AC.FeSimpleSimetria({ Fey_kgcm2: Fey, Fez_kgcm2: ez.Fez_kgcm2, H: d.H });
    return { Fe_kgcm2: fe.Fe_kgcm2, Fez_kgcm2: ez.Fez_kgcm2, Fey_kgcm2: Fey, omitioCw: ez.omitioCw,
      art: ART["C.E4.2L"] };
  }

  function angulo(nombre2L) {
    const id = String(nombre2L).replace(/^2L/, "L");
    let p = null;
    try { p = PERF.busca(id); } catch (e) { p = null; }
    return p;
  }

  /* ---------- la tracción: An y U según la unión ------------------------ */
  function traccion(p, dz, nAngulos) {
    if (dz.uniones === "soldadas") {
      const L1 = nAngulos === 2 ? angulo(p.id || p.nombre) : p;
      const xbar = L1 ? (L1.xbar_cm || L1.ybar_cm) : null;
      if (!(xbar > 0)) return { An_cm2: undefined, U: undefined, nota: "sin x̄ en el catálogo" };
      const u = AC.factorU({ caso: "2", xbar_cm: xbar, l_cm: dz.soldadura_cm });
      return { An_cm2: p.A_cm2, U: u.U, empernado: false, artU: ART["T.U.c2"] };
    }
    const di = CX.diametro(dz.diametroPerno);
    const t = p.t_cm;
    const an = AC.areaNeta({ Ag_cm2: p.A_cm2, t_cm: t, nAgujeros: nAngulos, dAgujero_cm: di.agujero_cm });
    if (dz.pernosPorLinea < 3) {
      return { An_cm2: an.An_cm2, U: undefined, empernado: true,
        nota: "con menos de 3 pernos por línea el U va por el caso 2 y hace falta la longitud de la conexión" };
    }
    const u = AC.factorU({ caso: "8", pernosPorLinea: dz.pernosPorLinea });
    return { An_cm2: an.An_cm2, U: u.U, empernado: true, artU: ART["T.U.c8"] };
  }

  /* ---------- una barra del tijeral, una fuerza axial ------------------- */
  function verificaTruss(b, p, N, combo, ctx) {
    const { dz, acero, L_cm } = ctx;
    const fam = p.familia;
    const base = { id: b.id.split("@")[0], perfil: p, acero: acero, combinacion: combo, familia: fam,
      fabricacion: p.fabricacion, origenFuerzas: "segundo-orden",
      arriostreComprobado: dz.arriostreComprobado === true };
    if (fam !== "2L" && fam !== "L") {
      return { ratio: null, omitidos: [{ que: "la familia " + fam + " en el tijeral", esencial: true,
        motivo: "este paso verifica las barras del tijeral de ángulo simple y de ángulo doble; " +
          "otra familia no está conectada todavía" }], combinacion: combo };
    }
    const nAng = fam === "2L" ? 2 : 1;
    const bt = Math.max(p.b_cm || 0, p.d_cm || 0) / p.t_cm;
    const caso = (fam === "2L" && dz.cartela === "0") ? 1 : 3;
    const elementos = [{ nombre: "lado del ángulo", razon: bt, caso: caso }];

    if (N > 0) {
      const tr = traccion(p, dz, nAng);
      return EL.verifica(Object.assign({}, base, { An_cm2: tr.An_cm2, U: tr.U, empernado: tr.empernado,
        fuerzas: { Pu_kgf: N }, longitudes: {} }));
    }
    /* COMPRESIÓN */
    const lon = ctx.longitudes(b);
    if (fam === "L") {
      if (dz.condicionesE5 !== true) {
        return { ratio: null, combinacion: combo, omitidos: [{
          que: "la diagonal de ángulo simple comprimida", esencial: true,
          motivo: "no se confirmaron las cinco condiciones del E5, así que no se puede tratar como " +
            "barra axial: es flexo-compresión del Cap. H con la excentricidad de la conexión, que no " +
            "está conectado aquí (fila D.DIS.E5)", art: ART["D.DIS.E5"] }] };
      }
      try {
        return TI.verificaBarra({ barra: base.id, clase: b.clase, perfil: p, acero: acero, N_kgf: N,
          L_cm: L_cm, ra_cm: Math.min(p.rx_cm, p.ry_cm), condicionesE5: true,
          elementosEsbeltez: elementos, arriostreComprobado: base.arriostreComprobado,
          combinacion: combo, origenFuerzas: "segundo-orden" });
      } catch (e) {
        return { ratio: null, combinacion: combo, omitidos: [{ que: "la compresión de la barra", esencial: true,
          motivo: e.message.split("\n")[0].replace(/^\w+: /, "") }] };
      }
    }
    /* 2L · E3 en el plano, E4 + E6 fuera · fila C.E4.2L */
    const sep = CARTELAS[dz.cartela];
    const ry = p["ry_" + sep + "_cm"], ro = p["ro_" + sep + "_cm"], H = p["H_" + sep];
    const L1 = angulo(p.id || p.nombre);
    const omit = [];
    let FeFT = null, e6 = null;
    if (ry > 0 && ro > 0 && H > 0 && L1 && L1.J_cm4 > 0 && L1.rz_cm > 0) {
      const lr0 = lon.Lcy_cm / ry;
      e6 = AC.esbeltezModificada({ lr0: lr0, a_cm: dz.separadores_cm, ri_cm: L1.rz_cm,
        conexion: dz.conexionSeparadores });
      const Fey = Math.PI * Math.PI * AC.E_ACERO / (e6.lrm * e6.lrm);
      FeFT = feFlexotorsional({ Fey_kgcm2: Fey, J_cm4: 2 * L1.J_cm4, Lcz_cm: lon.Lcz_cm,
        Ag_cm2: p.A_cm2, ro2: ro * ro, H: H });
      const sc = AC.separacionConectores({ a_cm: dz.separadores_cm, ri_cm: L1.rz_cm,
        lrGobernante: Math.max(lon.Lcx_cm / p.rx_cm, e6.lrm) });
      if (!sc.cumple) {
        omit.push({ que: "la separación de los separadores", esencial: true, art: ART["C.E6.a"],
          motivo: "a/ri = " + sc.ari.toFixed(1) + " pasa de 3/4 de la esbeltez del conjunto (" +
            sc.tope.toFixed(1) + "): separadores cada " + sc.aMax_cm.toFixed(0) + " cm como máximo" });
      }
    } else {
      omit.push({ que: "el pandeo flexotorsional E4", esencial: true,
        motivo: "el catálogo no trae ry, ro, H o el J del ángulo para esta cartela" });
    }
    let r;
    try {
      r = EL.verifica(Object.assign({}, base, { elementosEsbeltez: elementos, fuerzas: { Pu_kgf: N },
        longitudes: { Lc_cm: lon.Lcx_cm, r_cm: p.rx_cm,
          Fe_kgcm2: FeFT ? FeFT.Fe_kgcm2 : undefined,
          feOrigen: "flexotorsional (E4) con la esbeltez modificada del E6" } }));
    } catch (e) {
      return { ratio: null, combinacion: combo, omitidos: omit.concat([{ que: "la compresión de la brida",
        esencial: true, motivo: e.message.split("\n")[0].replace(/^\w+: /, "") }]) };
    }
    r.omitidos = (r.omitidos || []).concat(omit);
    r.E4 = FeFT; r.E6 = e6;
    if (omit.some((x) => x.esencial)) { r.cumple = false; r.faltanEsenciales = true; }
    return r;
  }

  /* ---------- una columna, viga-columna --------------------------------- */
  function verificaColumna(b, p, f, combo, ctx) {
    const { dz, acero } = ctx;
    if (p.familia !== "I") {
      return { ratio: null, combinacion: combo, omitidos: [{ que: "la columna de familia " + p.familia,
        esencial: true, motivo: "la columna se verifica como perfil I; otra familia no está conectada" }] };
    }
    const L = f.L_cm;
    const mat = AC.material(acero);
    const lp = AC.Lp({ ry_cm: p.ry_cm, Fy_kgcm2: mat.Fy });
    const rts = p.rts_cm > 0 ? p.rts_cm : AC.rts({ Iy_cm4: p.Iy_cm4, Cw_cm6: p.Cw_cm6, Sx_cm3: p.Sx_cm3 }).rts_cm;
    const lr = AC.Lr({ rts_cm: rts, Fy_kgcm2: mat.Fy, J_cm4: p.J_cm4, c: AC.coefC({ tipo: "I" }).c,
      Sx_cm3: p.Sx_cm3, ho_cm: p.ho_cm });
    /* F2 SOLO VALE CON ALA Y ALMA COMPACTAS. Si no lo son, tocan F3, F4 o F5,
       que no están conectados: se dice en vez de calcular por F2. */
    const ala = AC.clasificaFlexion({ caso: 10, Fy_kgcm2: mat.Fy, razon: p.bf_2tf });
    const alma = AC.clasificaFlexion({ caso: 15, Fy_kgcm2: mat.Fy, razon: p.h_tw });
    if (f.Mr_kgfcm > 0 && (ala.clase !== "compacta" || alma.clase !== "compacta")) {
      return { ratio: null, combinacion: combo, omitidos: [{ que: "la flexión de una sección no compacta",
        esencial: true, art: ala.art,
        motivo: "ala " + ala.clase + " (bf/2tf = " + p.bf_2tf + ") y alma " + alma.clase +
          ": el F2 es para secciones compactas, y F3 a F5 no están conectados aquí" }] };
    }
    const lon = { Lcx_cm: L, Lcy_cm: Math.min(dz.separacionLargueros_m * 100, L), Lcz_cm: L };
    try {
      return CO.verifica({ id: b.id.split("@")[0], perfil: p, acero: acero, combinacion: combo,
        longitudes: lon, Lb_cm: Math.min(dz.LbColumna_m * 100, L),
        Pu_kgf: f.Pr_kgf, Mux_kgfcm: f.Mr_kgfcm, Vu_kgf: f.Vr_kgf || 0,
        geometriaF2: { Lp_cm: lp.Lp_cm, Lr_cm: lr.Lr_cm, rts_cm: rts, J_cm4: p.J_cm4, c: 1,
          ho_cm: p.ho_cm },
        elementosEsbeltez: [{ nombre: "ala", razon: p.bf_2tf, caso: 1 },
          { nombre: "alma", razon: p.h_tw, caso: 5 }],
        origenFuerzas: "segundo-orden", arriostreComprobado: dz.arriostreComprobado === true,
        fabricacion: p.fabricacion });
    } catch (e) {
      return { ratio: null, combinacion: combo, omitidos: [{ que: "la verificación de la columna",
        esencial: true, motivo: e.message.split("\n")[0].replace(/^\w+: /, "") }] };
    }
  }

  /* =====================================================================
     TODO EL PÓRTICO
     ===================================================================== */
  function verificaPortico(d) {
    const r = d.analisis, m3 = d.m3, seccion = d.seccion, dz = d.diseno || {};
    exige(r && r.corridas, "verificaPortico() necesita el resultado de analisis.analiza()");
    exige(AC.ACEROS[d.acero], "verificaPortico() necesita el acero del proyecto");
    const g = AN.geometria(m3, r.sistema, r.eje);
    const F = faltan(g, seccion, dz);
    if (F.length) return { ok: false, faltan: F };

    const yDe = g.yDe;
    const largo = (b) => {
      const a = g.nudos.filter((n) => n.id === b.i)[0], c = g.nudos.filter((n) => n.id === b.j)[0];
      return Math.hypot(c.x_m - a.x_m, c.y_m - a.y_m) * 100;
    };
    /* LAS LONGITUDES · fila D.DIS.longitudes */
    const longitudes = (b) => {
      const L = largo(b);
      if (b.clase === "brida superior") return { Lcx_cm: L, Lcy_cm: L, Lcz_cm: L };
      if (b.clase === "brida inferior") {
        const Ly = Math.max(L, dz.arriostreInferior_m * 100);
        return { Lcx_cm: L, Lcy_cm: Ly, Lcz_cm: Ly };
      }
      return { Lcx_cm: L, Lcy_cm: L, Lcz_cm: L };
    };
    const ctx = { dz: dz, acero: d.acero, longitudes: longitudes };

    const out = {};
    for (const b of g.columnas.concat(g.truss)) {
      const p = seccion(b.de ? { id: b.de, clase: "columna" } : b);
      const base = b.id.split("@")[0];
      const lista = [];
      if (b.clase === "columna") {
        for (const c of r.corridas) {
          lista.push(verificaColumna(b, p, c.fuerzas[b.id], c.id, ctx));
        }
      } else {
        /* una barra axial: basta la mayor tracción y la mayor compresión */
        let tmax = null, cmax = null;
        for (const c of r.corridas) {
          const N = c.fuerzas[b.id].Pr_kgf;
          if (N > 0 && (!tmax || N > tmax.N)) tmax = { N: N, combo: c.id };
          if (N < 0 && (!cmax || N < cmax.N)) cmax = { N: N, combo: c.id };
        }
        ctx.L_cm = largo(b);
        for (const x of [tmax, cmax]) if (x) lista.push(verificaTruss(b, p, x.N, x.combo, ctx));
      }
      out[base] = envolvente(base, b, p, lista);
    }

    const filas = Object.keys(out).map((k) => out[k]);
    const porClase = {};
    for (const x of filas) {
      const k = x.clase;
      if (!porClase[k] || (x.ratio || 0) > (porClase[k].ratio || 0) ||
          (x.faltanEsenciales && !porClase[k].faltanEsenciales)) {
        porClase[k] = { clase: k, barra: x.id, perfil: x.perfil, ratio: x.ratio, combo: x.combo,
          estado: x.estado, cumple: x.cumple, faltanEsenciales: x.faltanEsenciales };
      }
      porClase[k].cuantas = (porClase[k].cuantas || 0) + 1;
      if (!x.cumple) porClase[k].noCumplen = (porClase[k].noCumplen || 0) + 1;
    }
    const peor = filas.reduce((a, x) => ((x.ratio || 0) > (a.ratio || 0) ? x : a), filas[0]);
    return {
      ok: true, barras: out, porClase: porClase,
      resumen: { total: filas.length, cumplen: filas.filter((x) => x.cumple).length,
        conOmitidosEsenciales: filas.filter((x) => x.faltanEsenciales).length,
        peor: { id: peor.id, ratio: peor.ratio, estado: peor.estado, combo: peor.combo } },
      art: ART["D.DIS.unicos"]
    };
  }

  /* La peor de una barra, con lo que no se pudo comprobar reunido */
  function envolvente(base, b, p, lista) {
    const conRatio = lista.filter((x) => typeof x.ratio === "number");
    const peor = conRatio.length ? conRatio.reduce((a, x) => (x.ratio > a.ratio ? x : a)) : null;
    const omit = [];
    const visto = {};
    for (const x of lista) {
      for (const o of (x.omitidos || [])) {
        if (visto[o.que]) continue;
        visto[o.que] = true;
        omit.push(o);
      }
    }
    const faltanEsenciales = omit.some((o) => o.esencial);
    return {
      id: base, barra: b.id, clase: b.clase, perfil: p.id || p.nombre,
      ratio: peor ? peor.ratio : null, combo: peor ? peor.combinacion : null,
      estado: peor ? peor.gobierna : null, capitulo: peor ? peor.capitulo : null,
      ratios: peor ? peor.ratios : [], E4: peor ? peor.E4 : null, E6: peor ? peor.E6 : null,
      omitidos: omit, faltanEsenciales: faltanEsenciales,
      cumpleResistencia: !!peor && peor.ratio <= 1 + 1e-12,
      cumple: !!peor && peor.ratio <= 1 + 1e-12 && !faltanEsenciales,
      verificadas: lista.length
    };
  }

  return { ART, CARTELAS, faltan, feFlexotorsional, verificaPortico, envolvente };
});
