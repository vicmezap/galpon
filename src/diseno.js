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
      require("./analisis.js"), require("./conexiones.js"), require("./perfiles.js"),
      require("./combinaciones.js"), require("./estabilidad.js"), require("./correas.js"));
  } else {
    raiz.DISENO = definir(raiz.INVENTARIO, raiz.ACERO, raiz.ELEMENTO, raiz.TIJERAL,
      raiz.COLUMNAS, raiz.ANALISIS, raiz.CONEXIONES, raiz.PERFILES, raiz.COMBINACIONES, raiz.ESTABILIDAD,
      raiz.CORREAS);
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC, EL, TI, CO, AN, CX, PERF, CB, ES, CR) {
  "use strict";

  const ART = INV.declara("diseno.js", [
    "C.E4.2L", "C.E4.Cw", "C.E4.Fe3", "C.E6.m1", "C.E6.a", "C.E5.cond", "C.B4a",
    "E.C3.K", "E.C3.arriostre", "T.U.c2", "T.U.c8", "F.Lp", "F.c", "F.B4.c10", "F.B4.c15",
    "D.DIS.longitudes",
    "D.DIS.E5", "D.DIS.cartela", "D.DIS.unicos",
    "LG.factores", "LG.techo.armadura", "LG.correa.puntal", "LG.cerramiento", "LG.esquina", "LG.cordon",
    "T.varillas", "SV.hastial.L", "MT.mismo.pano", "E.A8.Cm.transv",
    "CR.cargas", "CR.simple", "CR.combinaciones", "CR.segundo.orden", "D.DIS.correas",
    "F.hipotesis", "SV.deflex", "SV.carga.defl", "SV.correa.Ld", "D.cobertura.tabla", "CAT.precor"
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
        Pu_kgf: f.Pr_kgf, Mux_kgfcm: f.Mr_kgfcm, Muy_kgfcm: f.Muy_kgfcm || 0, Vu_kgf: f.Vr_kgf || 0,
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

  /* =====================================================================
     LO QUE TRABAJA A LO LARGO · con las fuerzas de longitudinal.js
     Cada pieza con su capítulo; lo que no se puede comprobar se dice y la
     pieza NO cumple.  Las piezas que solo ven viento o sismo a lo largo se
     diseñan con el mayor de 1,3·W y 1,0·E (fila LG.factores).
     d = { lg, interior, fachada, m3, seccion, acero, diseno, cerramiento_kgfm2 }
     ===================================================================== */
  /* La geometría del F2 y los elementos para la esbeltez local de un perfil I o
     de un canal, igual que en la columna del pórtico */
  function datosF2(p, acero) {
    const mat = AC.material(acero);
    const canal = p.familia === "C";
    const lp = AC.Lp({ ry_cm: p.ry_cm, Fy_kgcm2: mat.Fy });
    const rts = p.rts_cm > 0 ? p.rts_cm : AC.rts({ Iy_cm4: p.Iy_cm4, Cw_cm6: p.Cw_cm6, Sx_cm3: p.Sx_cm3 }).rts_cm;
    const c = AC.coefC(canal ? { tipo: "canal", ho_cm: p.ho_cm, Iy_cm4: p.Iy_cm4, Cw_cm6: p.Cw_cm6 } : { tipo: "I" }).c;
    const lr = AC.Lr({ rts_cm: rts, Fy_kgcm2: mat.Fy, J_cm4: p.J_cm4, c: c, Sx_cm3: p.Sx_cm3, ho_cm: p.ho_cm });
    /* el ala del canal es bf/tf entero; el alma, (d − 2·tf)/tw si el catálogo no trae h/tw: del lado seguro */
    const ala = canal ? p.bf_cm / p.tf_cm : p.bf_2tf;
    const alma = p.h_tw > 0 ? p.h_tw : (p.d_cm - 2 * p.tf_cm) / p.tw_cm;
    return { geometriaF2: { Lp_cm: lp.Lp_cm, Lr_cm: lr.Lr_cm, rts_cm: rts, J_cm4: p.J_cm4, c: c, ho_cm: p.ho_cm },
      elementosEsbeltez: [{ nombre: "ala", razon: ala, caso: 1 }, { nombre: "alma", razon: alma, caso: 5 }] };
  }

  /* EL SEGUNDO ORDEN DE UNA PIEZA ARTICULADA QUE NO SE DESPLAZA: solo B1, con
     Cm = 1,0 porque lleva carga transversal (fila E.A8.Cm.transv) y Pe1 con la
     inercia del eje en que flexiona y su longitud entera */
  function b1Articulada(Pr_kgf, I_cm4, L_cm) {
    if (!(Pr_kgf > 0)) return { B1: 1 };
    const pe = ES.Pe1({ E_kgcm2: AC.E_ACERO, I_cm4: I_cm4, Lc1_cm: L_cm });
    return Object.assign({ Cm: 1.0, art: ART["E.A8.Cm.transv"] },
      ES.B1({ Cm: 1.0, Pr_kgf: Pr_kgf, Pe1_kgf: pe.Pe1_kgf }));
  }

  function piezaOmitida(pieza, clase, perfil, que, motivo) {
    return { pieza: pieza, clase: clase, perfil: perfil, ratio: null, cumple: false, faltanEsenciales: true,
      omitidos: [{ que: que, esencial: true, motivo: motivo }] };
  }
  function cierra(pieza, clase, p, r, demanda, extra) {
    const omit = r.omitidos || [];
    const falta = omit.some((o) => o.esencial) || typeof r.ratio !== "number";
    return Object.assign({ pieza: pieza, clase: clase, perfil: p.id || p.nombre, ratio: typeof r.ratio === "number" ? r.ratio : null,
      estado: r.gobierna || r.manda || null, omitidos: omit, faltanEsenciales: falta,
      cumple: !falta && r.ratio <= 1 + 1e-12, demanda: demanda }, extra || {});
  }

  function verificaLongitudinal(d) {
    const lg = d.lg, dz = d.diseno || {}, seccion = d.seccion, acero = d.acero;
    exige(lg && lg.envolvente, "verificaLongitudinal() necesita el resultado de longitudinal.analiza()");
    const mat = AC.material(acero);
    const env = lg.envolvente;
    const piezas = [];
    /* por CLASE: cada pieza se verifica con la mayor fuerza de su clase y el perfil de la clase */
    const perfilDe = (clase) => seccion({ id: "clase:" + clase, clase: clase });
    const tirante = (pieza, clase, e) => {
      const p = perfilDe(clase);
      if (!p) return piezaOmitida(pieza, clase, null, "el perfil de " + clase, "no tiene perfil asignado en Geometría");
      if (p.familia !== "VAR") {
        return piezaOmitida(pieza, clase, p.id, "el tirante de familia " + p.familia,
          "trabaja solo a tracción y este paso lo verifica como VARILLA (filas T.varillas y CAT.varillas); " +
          "otra sección necesita el área neta y el U de su conexión, que no están conectados aquí");
      }
      const r = AC.varillaRoscada({ acero: acero, Ab_cm2: p.A_cm2, Pu_kgf: e.valor });
      return cierra(pieza, clase, p, Object.assign({}, r, { gobierna: r.manda }), e.valor,
        { estadoCarga: e.estado, nota: "solo a tracción: la otra diagonal toma el otro sentido" });
    };
    piezas.push(tirante("cruz de fachada", "arriostre de fachada", env.cruzFachada));
    if (lg.geometria.lineas.some((L) => L.tipo === "hastial")) {
      piezas.push(tirante("diagonal del arriostre vertical", "arriostre vertical", env.verticalDiagonal));
    }

    /* barras que van a tracción Y a compresión, con la lógica de las del tijeral */
    const axial = (pieza, clase, e, L_cm, conTraccion) => {
      const p = perfilDe(clase);
      if (!p) return piezaOmitida(pieza, clase, null, "el perfil de " + clase, "no tiene perfil asignado en Geometría");
      const b = { id: pieza, clase: clase };
      let lista;
      if (p.familia === "HSS_rect") {
        /* EL TUBO RECTANGULAR: paredes por el caso 6 de la Tabla B4.1a, y pandeo con el r menor */
        const base = { id: pieza, perfil: p, acero: acero, familia: p.familia, fabricacion: p.fabricacion,
          elementosEsbeltez: [{ nombre: "pared", razon: Math.max(p.b_t, p.h_t), caso: 6 }] };
        const una = (N) => {
          try {
            const r = EL.verifica(Object.assign({}, base, { combinacion: e.estado, fuerzas: { Pu_kgf: N },
              An_cm2: p.A_cm2, U: 1, longitudes: { Lc_cm: L_cm, r_cm: Math.min(p.rx_cm, p.ry_cm) } }));
            if (N > 0) {
              r.omitidos = (r.omitidos || []).concat([{ que: "el U de la conexión del tubo", esencial: false,
                motivo: "se tomó U = 1, que es el del tubo soldado en todo su contorno (Tabla D3.1, caso 1); con " +
                  "plancha en ranura, U es el de los casos 5 y 6" }]);
            }
            return r;
          } catch (err) {
            return { ratio: null, combinacion: e.estado, omitidos: [{ que: "el tubo", esencial: true,
              motivo: err.message.split("\n")[0].replace(/^\w+: /, "") }] };
          }
        };
        lista = [una(-e.valor)].concat(conTraccion ? [una(e.valor)] : []);
      } else if (p.familia !== "L" && p.familia !== "2L") {
        return piezaOmitida(pieza, clase, p.id, "la pieza de familia " + p.familia,
          "las piezas a lo largo se verifican de ángulo simple, ángulo doble o tubo rectangular; otra familia " +
          "no está conectada todavía");
      } else {
        const ctx = { dz: dz, acero: acero, L_cm: L_cm,
          longitudes: () => ({ Lcx_cm: L_cm, Lcy_cm: L_cm, Lcz_cm: L_cm }) };
        lista = [verificaTruss(b, p, -e.valor, e.estado, ctx)];
        if (conTraccion) lista.push(verificaTruss(b, p, e.valor, e.estado, ctx));
      }
      const x = envolvente(pieza, b, p, lista);
      return Object.assign({ pieza: pieza, demanda: e.valor, estadoCarga: e.estado, L_cm: L_cm }, x);
    };
    /* el arriostre de techo: la diagonal más larga con la mayor fuerza, del lado seguro */
    const ellTecho = Math.max.apply(null, lg.estados[0].armaduras.map((a) =>
      Math.max.apply(null, a.paneles.map((p) => p.ell_m)))) * 100;
    piezas.push(axial("arriostre de techo", "arriostre de techo", env.armaduraTecho, ellTecho, true));
    if (lg.geometria.lineas.some((L) => L.tipo === "hastial")) {
      piezas.push(axial("puntal del arriostre vertical", "puntal inferior", env.verticalPuntal,
        lg.geometria.sep_m * 100, false));
    }

    /* la viga de alero de puntal: compresión y su propio peso · fila MT.mismo.pano */
    {
      const p = perfilDe("viga de alero");
      if (!p) piezas.push(piezaOmitida("viga de alero de puntal", "viga de alero", null, "su perfil", "sin perfil"));
      else {
        const L = lg.geometria.sep_m * 100;
        let r;
        try {
          const f2 = datosF2(p, acero);
          const b1 = b1Articulada(env.aleroPuntal.valor, p.Ix_cm4, L);
          r = EL.verifica({ id: "VA", perfil: p, acero: acero, familia: p.familia, fabricacion: p.fabricacion,
            combinacion: env.aleroPuntal.estado, geometriaF2: f2.geometriaF2, elementosEsbeltez: f2.elementosEsbeltez,
            origenFuerzas: "segundo-orden",
            fuerzas: { Pu_kgf: -env.aleroPuntal.valor, Mux_kgfcm: b1.B1 * 1.2 * (p.peso_kgfm || 0) / 100 * L * L / 8 },
            longitudes: { Lc_cm: L, r_cm: Math.min(p.rx_cm, p.ry_cm), Lb_cm: L } });
        } catch (e) {
          r = { ratio: null, omitidos: [{ que: "la viga de alero a compresión", esencial: true,
            motivo: e.message.split("\n")[0].replace(/^\w+: /, "") }] };
        }
        piezas.push(cierra("viga de alero de puntal", "viga de alero", p, r, env.aleroPuntal.valor,
          { estadoCarga: env.aleroPuntal.estado, nota: "con 1,2 veces su peso propio; las cargas de muro no" }));
      }
    }

    /* las correas de puntal · fila LG.correa.puntal: la axial va CON la flexión de la correa,
       así que sale del diseño de las correas, en las líneas que hacen de puntal */
    {
      const cr = d.correas;
      const pts = cr && cr.ok && cr.lineas ? cr.lineas.filter((l) => l.puntal) : [];
      if (pts.length) {
        const conR = pts.filter((l) => typeof l.ratio === "number");
        const peorL = pts.filter((l) => !l.cumple)[0] ||
          (conR.length ? conR.reduce((a, l) => (l.ratio > a.ratio ? l : a)) : pts[0]);
        piezas.push(Object.assign({}, peorL, { pieza: "correa de puntal", demanda: env.correaPuntal.valor,
          nota: "la peor línea de correa que hace de puntal (x = " + peorL.x_m.toFixed(2).replace(".", ",") +
            " m), con su flexión y su axial en la misma combinación" }));
      } else {
        const motivo = !cr ? "las correas no se han verificado" :
          (!cr.ok ? "faltan los datos de las correas: " + cr.faltan.map((f) => f.que).join(" · ") :
            (cr.omitida ? cr.omitida.motivo : "ninguna línea de correa hace de puntal"));
        piezas.push(Object.assign(piezaOmitida("correa de puntal", "correa", (perfilDe("correa") || {}).id || null,
          "la correa con su axial de puntal", motivo), { demanda: env.correaPuntal.valor }));
      }
    }

    /* las columnas hastiales · columnas.columnaHastial(), con su peso y el cerramiento · fila LG.cerramiento */
    const hastiales = lg.columnas.filter((c) => c && c.tipo === "hastial");
    if (hastiales.length) {
      const p = perfilDe("columna hastial");
      if (!p) piezas.push(piezaOmitida("columna hastial", "columna hastial", null, "su perfil", "sin perfil"));
      else if (!(dz.separacionLargueros_m > 0)) {
        piezas.push(piezaOmitida("columna hastial", "columna hastial", p.id, "su Lb", "falta la separación de los largueros"));
      } else {
        let peor = null;
        for (const c of hastiales) {
          const H = c.H_m, Hc = H * 100;
          const Pd = (p.peso_kgfm || 0) * H + (d.cerramiento_kgfm2 || 0) * c.ancho_m * H;
          const fW = lg.factor.W;
          const Lcy = Math.min(dz.separacionLargueros_m * 100, Hc);
          const gobY = Lcy / p.ry_cm >= Hc / p.rx_cm;
          const delta = 5 * (c.w_kgfm / 100) * Math.pow(Hc, 4) / (384 * AC.E_ACERO * p.Ix_cm4);
          let r;
          try {
            const f2 = datosF2(p, acero);
            const b1 = b1Articulada(1.2 * Pd, p.Ix_cm4, Hc);
            r = CO.columnaHastial({ perfil: p, altura_m: H, wViento_kgfm: fW * c.w_kgfm, acero: acero,
              geometriaF2: f2.geometriaF2, elementosEsbeltez: f2.elementosEsbeltez, origenFuerzas: "segundo-orden",
              Mu_kgfcm: b1.B1 * fW * c.w_kgfm / 100 * Hc * Hc / 8, Vu_kgf: fW * c.w_kgfm / 100 * Hc / 2,
              separacionLargueros_m: dz.separacionLargueros_m, Pu_kgf: -1.2 * Pd,
              Lc_cm: gobY ? Lcy : Hc, r_cm: gobY ? p.ry_cm : p.rx_cm, desplazamiento_cm: delta,
              combinacion: "1.4-4 · " + c.estado });
          } catch (e) {
            r = { ratio: null, omitidos: [{ que: "la columna hastial", esencial: true,
              motivo: e.message.split("\n")[0].replace(/^\w+: /, "") }] };
          }
          const x = cierra("columna hastial", "columna hastial", p, r, fW * c.M_kgfm,
            { x_m: c.x, H_m: H, servicio: r.servicio || null, estadoCarga: c.estado + " · " + c.papel,
              Pu_kgf: 1.2 * Pd, art: ART["LG.cerramiento"] });
          if (r.servicio && !r.servicio.pasa) { x.cumple = false; x.falla = "flecha mayor que L/120 (fila SV.hastial.L)"; }
          if (!peor || (x.ratio || 0) > (peor.ratio || 0) || !x.cumple) peor = x;
        }
        piezas.push(peor);
      }
    }

    /* las columnas de esquina · fila LG.esquina: el pórtico de fachada + el viento del hastial en eje menor */
    if (d.fachada && d.fachada.corridas) {
      const f = d.fachada, g = AN.geometria(d.m3, f.sistema, f.eje);
      const col = g.columnas.filter((c) => c.id === "C0@" + f.eje)[0];
      const p = seccion(col);
      const esLong = {};
      for (const c of f.casos) if (c.tipo === "W" && c.direccion === "longitudinal") esLong[c.id] = c.Ci;
      const fam = CB.paraAcero({ casos: { D: true, Lr: true, W: true, E: !!f.sismo } }).combinaciones;
      const fW = (base) => {
        const c = fam.filter((x) => x.id === base)[0];
        const t = c ? c.terminos.filter(([k]) => k === "W")[0] : null;
        return t ? Math.abs(t[1]) : 0;
      };
      const Mesq = (Ci) => {
        let m = 0;
        for (const e of lg.estados) {
          if (e.tipo !== "W" || Math.abs(e.Ci - Ci) > 1e-9) continue;
          m = Math.max(m, Math.abs(e.hastialInicio[0].M_kgfm), Math.abs(e.hastialFinal[0].M_kgfm));
        }
        return m * 100;
      };
      const lista = [];
      for (const c of f.corridas) {
        const w = c.id.split(" · ").slice(1).join(" ").split(" ").filter((t) => esLong[t] !== undefined)[0];
        if (!w) continue;
        const fz = Object.assign({}, c.fuerzas[col.id], { Muy_kgfcm: fW(c.base) * Mesq(esLong[w]) });
        lista.push(verificaColumna(col, p, fz, c.id, { dz: dz, acero: acero }));
      }
      if (lista.length) {
        const x = envolvente("columna de esquina", col, p, lista);
        piezas.push(Object.assign({ pieza: "columna de esquina (pórtico de fachada)", art: ART["LG.esquina"],
          nota: "las fuerzas del pórtico de fachada con el viento longitudinal, más el viento del hastial en " +
            "su eje menor, con el mismo Ci y el mismo factor" }, x));
      }
    }

    /* la brida superior del paño arriostrado · fila LG.cordon: la del pórtico + el cordón de la armadura */
    if (d.interior && d.interior.barras) {
      const r = d.interior, g = AN.geometria(d.m3, r.sistema, r.eje);
      const p = seccion({ id: "clase:brida superior", clase: "brida superior" });
      let peorB = null;
      for (const b of g.truss.filter((x) => x.clase === "brida superior")) {
        const e = r.barras[b.id.split("@")[0]];
        if (!peorB || e.compresion.Pr_kgf < peorB.e.compresion.Pr_kgf) peorB = { b: b, e: e };
      }
      if (p && peorB) {
        const a = g.nudos.filter((n) => n.id === peorB.b.i)[0], c = g.nudos.filter((n) => n.id === peorB.b.j)[0];
        const L = Math.hypot(c.x_m - a.x_m, c.y_m - a.y_m) * 100;
        const N = peorB.e.compresion.Pr_kgf - env.cordonTecho.valor;
        const ctx = { dz: dz, acero: acero, L_cm: L, longitudes: () => ({ Lcx_cm: L, Lcy_cm: L, Lcz_cm: L }) };
        const x = envolvente("brida superior del paño arriostrado", peorB.b, p,
          [verificaTruss(peorB.b, p, N, peorB.e.compresion.combo + " + " + env.cordonTecho.estado, ctx)]);
        piezas.push(Object.assign({ pieza: "brida superior del paño arriostrado", demanda: -N, art: ART["LG.cordon"],
          nota: "la mayor compresión del pórtico más el mayor cordón de la armadura de techo: suma de máximos, " +
            "del lado seguro" }, x));
      }
    }

    const cumplen = piezas.filter((x) => x.cumple).length;
    const conRatio = piezas.filter((x) => typeof x.ratio === "number");
    const peor = conRatio.length ? conRatio.reduce((a, x) => (x.ratio > a.ratio ? x : a)) : null;
    return { ok: true, piezas: piezas,
      resumen: { total: piezas.length, cumplen: cumplen,
        conOmitidosEsenciales: piezas.filter((x) => x.faltanEsenciales).length,
        peor: peor ? { pieza: peor.pieza, ratio: peor.ratio } : null },
      art: ART["LG.factores"] };
  }

  /* =====================================================================
     LAS CORREAS · cada línea de correa, con sus combinaciones · filas CR.*
     d = { m3, interior, cargas, seccion, acero, diseno, espesor_mm, lg? }
     `cargas` es el de resultados: { D_kgfm2, Lr_kgfm2, S, viento, sismo }.
     ===================================================================== */
  function faltanCorreas(dz) {
    const F = [];
    if (!(dz.tensores >= 0) || dz.tensores !== Math.round(dz.tensores)) {
      F.push({ campo: "di_ten", que: "cuántos tensores lleva cada correa por paño (0 si ninguno)" });
    }
    if ([1, 2, 3].indexOf(dz.panelTramos) < 0) {
      F.push({ campo: "di_ptram", que: "sobre cuántos tramos de correa apoya cada plancha (1, 2 ó 3)" });
    }
    if (typeof dz.clipCorreas !== "boolean") {
      F.push({ campo: "di_clip", que: "si la correa se fija al tijeral con clip" });
    }
    return F;
  }

  function verificaCorreas(d) {
    const dz = d.diseno || {}, r = d.interior, c = d.cargas, acero = d.acero;
    exige(r && r.sistema, "verificaCorreas() necesita el análisis del pórtico interior");
    exige(c && c.viento, "verificaCorreas() necesita las cargas, con el viento");
    const F = faltanCorreas(dz);
    if (F.length) return { ok: false, faltan: F };
    const p = d.seccion({ id: "clase:correa", clase: "correa" });
    const base = { ok: true, perfil: p ? (p.id || p.nombre) : null };
    const todoFalta = (que, motivo) => Object.assign(base, { lineas: [], cumple: false, omitida: { que: que, motivo: motivo } });
    if (!p) return todoFalta("el perfil de la correa", "no tiene perfil asignado en Geometría");
    if (p.estado === "espera") {
      return todoFalta("una correa conformada en frío", "se verifica con el AISI S100, que es la fase 2 (fila CAT.precor): " +
        "este paso verifica correas laminadas (canal C o perfil I)");
    }
    if (p.familia !== "C" && p.familia !== "I") {
      return todoFalta("una correa de familia " + p.familia, "este paso verifica correas de canal C o perfil I");
    }
    if (dz.clipCorreas !== true) {
      return todoFalta("la correa sin clip", "el Capítulo F supone los apoyos restringidos contra el giro sobre su eje " +
        "(F1(b), fila F.hipotesis): una correa posada no lo cumple y no se puede dar por verificada");
    }

    const g = AN.geometria(d.m3, r.sistema, r.eje);
    const tr = AN.tramosTecho(g);
    const nq = tr.length + 1;
    const L = d.m3.ejes.sepPorticos_m, n = dz.tensores, Lc = L * 100, Lm = Lc / (n + 1);
    const vientos = AN.casosViento(g, c.viento).casos;
    const hayS = !!(c.S && c.S.Qt_kgfm2 > 0);
    const f2 = datosF2(p, acero);
    const mat = AC.material(acero);
    const Ev = r.sismo ? r.sismo.Ev : 0;

    /* la axial de puntal de una línea en un estado de longitudinal.js · fila LG.correa.puntal */
    const axialDe = (e, q) => !e ? 0 : Math.max(e.correas[q] ? e.correas[q].N_kgf : 0,
      Math.max.apply(null, [0].concat(e.armaduras.map((a) => a.correas_kgf[q] || 0))));
    const lgW = (Ci) => d.lg ? d.lg.estados.filter((e) => e.tipo === "W" && Math.abs(e.Ci - Ci) < 1e-9)[0] : null;
    const lgE = d.lg ? d.lg.estados.filter((e) => e.tipo === "E")[0] : null;

    /* las combinaciones, con los estados físicos */
    const fam = CB.paraAcero({ casos: { D: true, Lr: !hayS, S: hayS, W: true, E: !!r.sismo } }).combinaciones;
    const estadosDe = (k) => {
      if (k === "W") return vientos.map((w) => ({ tipo: "W", w: w }));
      if (k === "E") return r.sismo ? [{ tipo: "E", signo: -1 }, { tipo: "E", signo: +1 }] : [];
      return [{ tipo: k }];
    };
    const combos = [];
    for (const cb of fam) {
      let listas = [[]];
      for (const [k, f] of cb.terminos) {
        const ests = estadosDe(k);
        if (!ests.length) { listas = []; break; }
        const nuevas = [];
        for (const l of listas) for (const e of ests) nuevas.push(l.concat([[e, (k === "W" || k === "E") ? Math.abs(f) : f]]));
        listas = nuevas;
      }
      for (const l of listas) {
        const nom = l.map(([e]) => e.tipo === "W" ? e.w.id : (e.tipo === "E" ? (e.signo > 0 ? "E↑" : "E↓") : null))
          .filter(Boolean).join(" ");
        combos.push({ id: cb.id + (nom ? " · " + nom : ""), partes: l });
      }
    }

    const unit = (x, y) => { const m = Math.hypot(x, y); return [x / m, y / m]; };
    const lineas = [];
    const yMax = Math.max.apply(null, tr.map((t) => Math.max(g.yDe[t.a], g.yDe[t.b])));
    for (let q = 0; q < nq; q++) {
      const lados = [];
      if (q > 0) lados.push(q - 1);
      if (q < nq - 1) lados.push(q);
      /* la orientación de la correa: la media de sus dos tramos · fila CR.cargas */
      let tx = 0, ty = 0;
      for (const k of lados) { tx += tr[k].dx_m / tr[k].L_m; ty += tr[k].dy_m / tr[k].L_m; }
      const [ux, uy] = unit(tx, ty);
      const nx = -uy, ny = ux;                  /* normal hacia arriba */
      const theta = Math.abs(Math.atan2(uy, ux)) * 180 / Math.PI;
      /* las cargas por metro de correa de cada estado, como vector (x, y) */
      const vec = { D: [0, -(p.peso_kgfm || 0)], Lr: [0, 0], S: [0, 0] };
      const W = {};
      let ancho = 0;
      for (const k of lados) {
        const t = tr[k], ell = t.L_m / 2;
        ancho += ell;
        vec.D[1] -= c.D_kgfm2 * ell;
        if (c.Lr_kgfm2 > 0) vec.Lr[1] -= c.Lr_kgfm2 * ell;
        if (hayS) vec.S[1] -= c.S.Qt_kgfm2 * ell * Math.abs(t.dx_m) / t.L_m;
        const ntx = -t.dy_m / t.L_m, nty = t.dx_m / t.L_m;
        for (const w of vientos) {
          const ph = w.techo[k];
          W[w.id] = W[w.id] || [0, 0];
          W[w.id][0] += -ph * ell * ntx; W[w.id][1] += -ph * ell * nty;
        }
      }
      const mayor = (v) => -(v[0] * nx + v[1] * ny);   /* + hacia el techo */
      const menor = (v) => v[0] * ux + v[1] * uy;
      const lista = [], fuerzas = [];
      let Nmax = 0;
      for (const cb of combos) {
        let vx = 0, vy = 0, N = 0;
        for (const [e, f] of cb.partes) {
          if (e.tipo === "W") {
            vx += f * W[e.w.id][0]; vy += f * W[e.w.id][1];
            if (e.w.direccion === "longitudinal") N = Math.max(N, f * axialDe(lgW(e.w.Ci), q));
          } else if (e.tipo === "E") {
            vy += f * e.signo * Ev * vec.D[1];     /* la vertical, sobre la muerta · fila S.vertical */
            N = Math.max(N, f * axialDe(lgE, q));
          } else {
            vx += f * vec[e.tipo][0]; vy += f * vec[e.tipo][1];
          }
        }
        const wM = mayor([vx, vy]), wm = menor([vx, vy]);
        let Mux = Math.abs(wM) / 100 * Lc * Lc / 8, Muy = Math.abs(wm) / 100 * Lm * Lm / 8;
        const Vu = Math.abs(wM) / 100 * Lc / 2;
        Nmax = Math.max(Nmax, N);
        const gobY = Lm / p.ry_cm >= Lc / p.rx_cm;
        let res;
        try {
          if (N > 0) {                              /* fila CR.segundo.orden · si pandea, B1 lo dice */
            Mux *= b1Articulada(N, p.Ix_cm4, Lc).B1;
            Muy *= b1Articulada(N, p.Iy_cm4, Lm).B1;
          }
          res = CR.verifica({ id: "CO" + q, perfil: p, acero: acero, theta_grad: theta, L_m: L, tensores: n,
            Mux_kgfcm: Mux, Muy_kgfcm: Muy, Vu_kgf: Vu, Pu_kgf: -N, Lb_cm: Lm,
            Lc_cm: N > 0 ? (gobY ? Lm : Lc) : undefined, r_cm: N > 0 ? (gobY ? p.ry_cm : p.rx_cm) : undefined,
            origenFuerzas: N > 0 ? "segundo-orden" : undefined, combinacion: cb.id,
            geometriaF2: f2.geometriaF2, elementosEsbeltez: f2.elementosEsbeltez });
        } catch (e) {
          res = { ratio: null, combinacion: cb.id, omitidos: [{ que: "la correa", esencial: true,
            motivo: e.message.split("\n")[0].replace(/^\w+: /, "") }] };
        }
        res.combinacion = cb.id;
        lista.push(res);
        fuerzas.push({ combo: cb.id, Mux_kgfcm: Mux, Muy_kgfcm: Muy, Vu_kgf: Vu, Pu_kgf: -N,
          wMayor_kgfm: wM, wMenor_kgfm: wm, ratio: res.ratio });
      }
      const x = envolvente("CO" + q, { id: "CO" + q, clase: "correa" }, p, lista);
      const tipo = (q === 0 || q === nq - 1) ? "alero" : (Math.abs(g.yDe[tr[Math.min(q, nq - 2)].a] - yMax) < 1e-9 &&
        q > 0 && q < nq - 1 ? "cumbrera" : "típica");
      lineas.push(Object.assign(x, { q: q, x_m: g.nudos.filter((nd) => nd.id === (q < nq - 1 ? tr[q].a : tr[q - 1].b))[0].x_m,
        ancho_m: ancho, theta_grad: theta, puntal: Nmax > 0, Nmax_kgf: Nmax, fuerzas: fuerzas,
        tipo: (Math.abs(theta) < 1e-9 && q > 0 && q < nq - 1) ? "cumbrera" : tipo }));
    }

    /* EL SERVICIO de la correa típica · filas SV.deflex, SV.carga.defl y SV.correa.Ld */
    const tip = lineas.reduce((a, l) => (l.ancho_m > a.ancho_m ? l : a));
    const viva = hayS ? c.S.Qt_kgfm2 : c.Lr_kgfm2;
    const wServ = 0.5 * viva * tip.ancho_m * Math.cos(tip.theta_grad * Math.PI / 180);
    const delta = 5 * (wServ / 100) * Math.pow(Lc, 4) / (384 * AC.E_ACERO * p.Ix_cm4);
    const deflexion = { delta_cm: delta, limite_cm: Lc / 240, pasa: delta <= Lc / 240 + 1e-12,
      carga: "0,5·" + (hayS ? "S" : "Lr"), art: ART["SV.deflex"], artCarga: ART["SV.carga.defl"] };
    const Ld = CR.esbeltezLd({ L_cm: Lc, d_cm: p.d_cm, Fy_kgcm2: mat.Fy });
    /* LA PLANCHA ENTRE CORREAS · fila D.cobertura.tabla */
    let panel;
    try {
      panel = CR.verificaPanel({ espesor_mm: d.espesor_mm, separacion_m: Math.max.apply(null, tr.map((t) => t.L_m)),
        tramos: dz.panelTramos, vivaNeta_kgfm2: viva });
    } catch (e) {
      panel = { ratio: null, cumple: false, motivo: e.message.split("\n")[0].replace(/^\w+: /, "") };
    }
    const peor = lineas.filter((l) => typeof l.ratio === "number").reduce((a, l) => (!a || l.ratio > a.ratio ? l : a), null);
    const cumple = lineas.every((l) => l.cumple) && deflexion.pasa && panel.cumple;
    return Object.assign(base, { lineas: lineas, L_m: L, tensores: n, peor: peor, deflexion: deflexion, Ld: Ld,
      panel: panel, cumple: cumple, combinaciones: combos.length,
      art: ART["CR.cargas"], artSimple: ART["CR.simple"], artCombos: ART["CR.combinaciones"] });
  }

  return { ART, CARTELAS, faltan, feFlexotorsional, verificaPortico, envolvente,
    verificaTruss, verificaColumna, verificaLongitudinal, faltanCorreas, verificaCorreas };
});
