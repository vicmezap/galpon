/* =====================================================================
   longitudinal.js — el galpón a lo largo: del hastial al suelo

   A lo largo el galpón no tiene pórtico.  El viento sobre los hastiales y
   el sismo longitudinal bajan por una cadena de piezas que solo trabajan
   en esta dirección, y montaje.js ya comprueba que la cadena cierra.  Aquí
   se le ponen números a cada eslabón:

     hastial  →  columnas hastiales y de esquina, vigas verticales
              →  arriostre vertical (cruz + puntal) hasta la brida superior
              →  correas y vigas de alero, de puntal, hasta el paño arriostrado
              →  armadura horizontal del techo
              →  viga de alero, hasta el paño arriostrado de fachada
              →  cruz de fachada  →  bases

   TODO ES ESTÁTICA DE UN SISTEMA ISOSTÁTICO y se escribe así, sin el
   solucionador, para que cada fuerza se pueda rehacer a mano (filas LG.*).
   Las fuerzas son por estado y SIN factorizar; LG.factores dice con qué
   factor se diseñan.

   UNIDADES: kgf, m para la geometría y kgf/m², igual que viento.js.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./viento.js"), require("./e030.js"),
      require("./combinaciones.js"));
  } else {
    raiz.LONGITUDINAL = definir(raiz.INVENTARIO, raiz.VIENTO, raiz.E030, raiz.COMBINACIONES);
  }
})(typeof self !== "undefined" ? self : this, function (INV, VI, E030, CB) {
  "use strict";

  const ART = INV.declara("longitudinal.js", [
    "LG.viento.hastial", "LG.hastial.reparto", "LG.vertical", "LG.correa.puntal", "LG.techo.armadura",
    "LG.alero.nivel", "LG.fachada.cruz", "LG.sismo.sistema", "LG.sismo.peso", "LG.factores",
    "W.T4", "MT.hastial", "MT.mismo.pano", "E.tension.only", "A.hastial.deslizante"
  ]);

  const SISTEMA_SISMICO = "OCBF";          /* fila LG.sismo.sistema */

  function exige(c, msg) { if (!c) throw new Error("longitudinal: " + msg); }

  /* =====================================================================
     1 · LA GEOMETRÍA QUE HACE FALTA, SACADA DEL MONTAJE
     ===================================================================== */
  function geometria(m3, sistema) {
    exige(m3 && m3.ejes && m3.tijeral, "hace falta el galpón montado (montaje.monta)");
    exige(sistema && (sistema.union === "rigida" || sistema.union === "apoyado"),
      "hace falta el sistema del pórtico: { base, union }");
    const h = m3.alturaColumna_m, tij = m3.tijeral, luz = m3.luz_m;
    const sup = tij.nudos.filter((n) => n.clase === "superior").slice().sort((a, b) => a.x_m - b.x_m)
      .map((n) => ({ id: n.id, x: n.x_m, y: h + n.y_m }));
    const inf = tij.nudos.filter((n) => n.clase === "inferior").slice().sort((a, b) => a.x_m - b.x_m)
      .map((n) => ({ id: n.id, x: n.x_m, y: h + n.y_m }));
    const interp = (P) => (x) => {
      if (x <= P[0].x) return P[0].y;
      for (let i = 0; i + 1 < P.length; i++) {
        if (x <= P[i + 1].x + 1e-12) return P[i].y + (P[i + 1].y - P[i].y) * (x - P[i].x) / (P[i + 1].x - P[i].x);
      }
      return P[P.length - 1].y;
    };
    const ySup = interp(sup), yInf = interp(inf);
    /* las líneas de columna del hastial: las dos esquinas y las hastiales */
    const cabezaEsquina = sistema.union === "rigida" ? sup[0].y : inf[0].y;
    const lineas = [{ x: 0, tipo: "esquina", H: cabezaEsquina }]
      .concat((m3.columnasHastiales || []).slice().sort((a, b) => a - b)
        .map((x) => ({ x: x, tipo: "hastial", H: yInf(x), peralte: ySup(x) - yInf(x) })))
      .concat([{ x: luz, tipo: "esquina", H: cabezaEsquina }]);
    for (let i = 0; i < lineas.length; i++) {
      lineas[i].a = i === 0 ? 0 : (lineas[i - 1].x + lineas[i].x) / 2;
      lineas[i].b = i === lineas.length - 1 ? luz : (lineas[i].x + lineas[i + 1].x) / 2;
    }
    /* las líneas de correa, con su ancho de techo en planta · fila LG.sismo.peso */
    const correas = sup.map((n, q) => ({ q: q, id: n.id, x: n.x,
      ancho: ((q + 1 < sup.length ? sup[q + 1].x : n.x) - (q > 0 ? sup[q - 1].x : n.x)) / 2 }));
    return { h: h, luz: luz, sup: sup, inf: inf, ySup: ySup, yInf: yInf, lineas: lineas, correas: correas,
      sep: m3.ejes.sepPorticos_m, porticos: m3.ejes.porticos, panos: m3.ejes.panos,
      largo: m3.ejes.largo_m, cabeza: inf[0].y, hAlero: sup[0].y,
      techo: m3.panosArriostradosTecho, fachada: m3.panosArriostradosFachada };
  }

  /* ∫ f entre a y b por Simpson: los perfiles son lineales a trozos */
  function integra(f, a, b) {
    if (!(b > a)) return 0;
    const n = 600, s0 = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * s0) * (i % 2 ? 4 : 2);
    return s * s0 / 3;
  }

  /* =====================================================================
     2 · UN MURO HASTIAL CON PRESIÓN NETA p (+ hacia dentro) · LG.hastial.reparto
     ===================================================================== */
  function muroHastial(G, p) {
    return G.lineas.map((L) => {
      const Acol = integra((x) => Math.min(G.ySup(x), L.H), L.a, L.b);
      const Aenc = integra((x) => Math.max(0, G.ySup(x) - L.H), L.a, L.b);
      const w = p * Acol / L.H;                       /* kgf/m, repartida en la altura */
      return { x: L.x, tipo: L.tipo, H_m: L.H, ancho_m: L.b - L.a, w_kgfm: w,
        M_kgfm: w * L.H * L.H / 8, Rbase_kgf: w * L.H / 2, Rcabeza_kgf: w * L.H / 2 + p * Aenc,
        Aencima_m2: Aenc, peralte_m: L.peralte };
    });
  }

  /* =====================================================================
     3 · LOS ESTADOS · viento longitudinal por cada Ci, y el sismo
     ===================================================================== */
  function aberturasDe(v) {
    if (typeof v.aberturas === "string") return v.aberturas;
    exige(v.aberturas && v.aberturas.longitudinal, "faltan las aberturas para el viento longitudinal");
    return v.aberturas.longitudinal;
  }

  function estadosViento(G, v) {
    exige(v && v.V_kmh > 0, "el viento necesita V_kmh");
    const vel = VI.velocidadDiseno({ V_kmh: v.V_kmh, h_m: Math.max.apply(null, G.sup.map((n) => n.y)) });
    const Ph = (C) => VI.presion({ C: C, Vh_kmh: vel.Vh_kmh, tipo: v.tipo === undefined ? 1 : v.tipo }).Ph_kgfm2;
    const muro = VI.ceMuro();
    const out = [];
    for (const Ci of VI.ci(aberturasDe(v)).Ci) {
      /* viento hacia +z: el hastial z = 0 es barlovento, el z = L sotavento · LG.viento.hastial */
      const pBar = Ph(muro.barlovento[0] - Ci);        /* + = presión, empuja hacia +z */
      const pSot = -Ph(muro.sotavento - Ci);           /* la succión del de z = L tira hacia +z */
      out.push({ id: "WL·Ci " + (Ci >= 0 ? "+" : "") + String(Ci).replace(".", ","), tipo: "W", Ci: Ci,
        pInicio_kgfm2: pBar, pFinal_kgfm2: pSot, Vh_kmh: vel.Vh_kmh });
    }
    return out;
  }

  function estadoSismo(G, s, Pi, Pf) {
    exige(Pi > 0 && Pf > 0, "el sismo longitudinal necesita el peso sísmico de los pórticos interior y de fachada");
    const P = 2 * Pf + (G.porticos - 2) * Pi;       /* fila LG.sismo.peso */
    const T = E030.periodo({ tipo: "arriostrado", hn_m: G.hAlero }).T_s;
    const V = E030.cortanteBasal({ zona: s.zona, suelo: s.suelo, vs30_ms: s.vs30_ms, categoria: s.categoria,
      sistema: SISTEMA_SISMICO, pendulo: false, T_s: T, P_kgf: P });   /* a lo largo resiste la cruz, no un voladizo */
    const porEje = [];
    for (let e = 0; e < G.porticos; e++) {
      const Pe = (e === 0 || e === G.porticos - 1) ? Pf : Pi;
      porEje.push(V.V_kgf * Pe / P);
    }
    return { id: "EL", tipo: "E", P_kgf: P, T_s: T, V_kgf: V.V_kgf, C: V.C, R: V.R, Z: V.Z, U: V.U, S: V.S,
      CR_usado: V.CR_usado, porEje_kgf: porEje, art: ART["LG.sismo.sistema"], artPeso: ART["LG.sismo.peso"] };
  }

  /* =====================================================================
     4 · EL CAMINO, PARA UN ESTADO · todo hacia +z (el otro sentido es simétrico)
     ===================================================================== */
  const masCercano = (lista, k) => {
    let mejor = null;
    for (const q of lista) if (mejor === null || Math.abs(q - k) < Math.abs(mejor - k)) mejor = q;
    return mejor;
  };
  /* los paños a los que va lo de un eje: el más cercano, o la mitad a cada uno si empatan */
  function destinos(lista, eje) {
    /* el eje e toca los paños e−1 y e: la distancia a un paño k es 0 si lo toca */
    const dist = (k) => (k === eje || k === eje - 1) ? 0 : Math.min(Math.abs(k - eje), Math.abs(k + 1 - eje));
    const dmin = Math.min.apply(null, lista.map(dist));
    const cerca = lista.filter((k) => dist(k) === dmin);
    return cerca.map((k) => ({ pano: k, f: 1 / cerca.length }));
  }

  function camino(G, cargas) {
    /* cargas: { inicio: [por línea de hastial, Rcabeza], final: [...], ejes: [por eje, fuerza] } en +z */
    const nq = G.correas.length;
    const nl = G.lineas.length;
    /* lo que entra a cada paño arriostrado de techo, por línea de correa (0 y nq−1 son los aleros) */
    const enPano = {};
    for (const k of G.techo) enPano[k] = new Array(nq).fill(0);
    const correaRun = new Array(nq).fill(0);           /* la mayor axial de cada línea fuera de los paños */
    const vertical = [];
    const qDeX = (x) => G.correas.reduce((a, c) => (Math.abs(c.x - x) < Math.abs(a.x - x) ? c : a)).q;
    const entra = (pano, q, F) => { enPano[pano][q] += F; };

    /* los hastiales: su línea de cabeza entra por la correa de su x (las esquinas por el alero) */
    for (const [extremo, lista] of [["inicio", cargas.inicio], ["final", cargas.final]]) {
      if (!lista) continue;
      const pano = masCercano(G.techo, extremo === "inicio" ? 0 : G.panos - 1);
      for (let j = 0; j < nl; j++) {
        const L = G.lineas[j], R = lista[j];
        const q = L.tipo === "esquina" ? (L.x === 0 ? 0 : nq - 1) : qDeX(L.x);
        if (L.tipo === "hastial") {
          /* la cruz vertical en el paño extremo · fila LG.vertical */
          const ell = Math.sqrt(G.sep * G.sep + L.peralte * L.peralte);
          vertical.push({ extremo: extremo, x: L.x, R_kgf: R, diagonal_kgf: Math.abs(R) * ell / G.sep,
            puntal_kgf: Math.abs(R), ell_m: ell, peralte_m: L.peralte });
        }
        entra(pano, q, R);
        /* cuánto recorre: del eje extremo hasta el paño */
        const recorre = extremo === "inicio" ? pano : (G.porticos - 1) - (pano + 1);
        if (recorre > 0) correaRun[q] = Math.max(correaRun[q], Math.abs(R));
      }
    }
    /* el sismo: cada eje entrega su fuerza por las líneas de correa, según su ancho */
    const anchoTotal = G.correas.reduce((a, c) => a + c.ancho, 0);
    if (cargas.ejes) {
      /* lo acumulado por línea a lo largo de cada tramo, para la axial de las correas */
      for (let e = 0; e < G.porticos; e++) {
        for (const { pano, f } of destinos(G.techo, e)) {
          for (const c of G.correas) entra(pano, c.q, f * cargas.ejes[e] * c.ancho / anchoTotal);
        }
      }
      /* la axial de puntal por el sismo: lo que se junta desde el extremo hasta el paño */
      for (const c of G.correas) {
        const parte = (e) => cargas.ejes[e] * c.ancho / anchoTotal;
        for (const k of G.techo) {
          let izq = 0, der = 0;
          for (let e = 0; e < k; e++) if (destinos(G.techo, e).some((x) => x.pano === k)) izq += parte(e);
          for (let e = k + 2; e < G.porticos; e++) if (destinos(G.techo, e).some((x) => x.pano === k)) der += parte(e);
          correaRun[c.q] = Math.max(correaRun[c.q], Math.abs(izq), Math.abs(der));
        }
      }
    }

    /* la armadura horizontal de cada paño · fila LG.techo.armadura */
    const armaduras = [];
    const aleros = { izq: {}, der: {} };
    for (const k of G.techo) {
      const F = enPano[k];
      const x = G.correas.map((c) => c.x), L = G.luz;
      let Rizq = 0, Rder = 0;
      for (let q = 0; q < nq; q++) { Rizq += F[q] * (L - x[q]) / L; Rder += F[q] * x[q] / L; }
      const paneles = [];
      let V = Rizq - F[0], M = 0;
      for (let q = 0; q + 1 < nq; q++) {
        const dx = x[q + 1] - x[q], dy = G.sup[q + 1].y - G.sup[q].y;
        const diag = Math.sqrt(dx * dx + dy * dy + G.sep * G.sep);
        const seg = Math.sqrt(dx * dx + dy * dy);
        const Mq1 = M + V * dx;                       /* el momento en la línea q+1 */
        paneles.push({ q: q, V_kgf: V, diagonal_kgf: V * diag / G.sep, ell_m: diag,
          cordon_kgf: Math.max(Math.abs(M), Math.abs(Mq1)) / G.sep * seg / dx });
        M = Mq1;
        V -= F[q + 1];
      }
      /* LA CORREA DENTRO DEL PAÑO.  En la Warren las dos diagonales de una línea llegan al
         mismo pórtico, así que en el nudo del otro la correa es la única barra en z y lleva
         lo que entra ahí.  Cota: todo lo que entra a la línea.  (Primero tomé el cortante del
         panel, que es lo que lleva la DIAGONAL, y salía cuatro veces de más.) */
      const correasPano = F.map((f) => Math.abs(f));
      armaduras.push({ pano: k, cargas_kgf: F.slice(), Rizq_kgf: Rizq, Rder_kgf: Rder, paneles: paneles,
        cierre_kgf: V + Rder, correas_kgf: correasPano, art: ART["LG.techo.armadura"] });
      aleros.izq[k] = Rizq; aleros.der[k] = Rder;
    }

    /* del alero del paño de techo al de fachada, y la cruz · filas LG.alero.nivel y LG.fachada.cruz */
    const cruces = [];
    const vigaAlero = [];
    for (const lado of ["izq", "der"]) {
      const enF = {};
      for (const k of G.techo) {
        const kf = masCercano(G.fachada, k);
        enF[kf] = (enF[kf] || 0) + aleros[lado][k];
        if (kf !== k) vigaAlero.push({ lado: lado, desde: k, hasta: kf, N_kgf: aleros[lado][k],
          recorrido_m: Math.abs(kf - k) * G.sep, art: ART["MT.mismo.pano"] });
      }
      for (const k of Object.keys(enF).map(Number)) {
        const H = enF[k], h = G.cabeza;
        const ell = Math.sqrt(G.sep * G.sep + h * h);
        const col = lado === "izq" ? "B0" : "B1";
        cruces.push({ lado: lado, pano: k, H_kgf: H, diagonal_kgf: Math.abs(H) * ell / G.sep, ell_m: ell,
          vertical_kgf: Math.abs(H) * h / G.sep, bases: [col + "@" + k, col + "@" + (k + 1)],
          art: ART["LG.fachada.cruz"] });
      }
    }
    /* el recorrido de los aleros: la esquina y el sismo del alero, hasta el paño de techo */
    const aleroRun = Math.max(correaRun[0], correaRun[nq - 1]);
    return { vertical: vertical, correas: correaRun.map((N, q) => ({ q: q, x: G.correas[q].x, N_kgf: N,
      esAlero: q === 0 || q === nq - 1 })), aleroPuntal_kgf: aleroRun, armaduras: armaduras,
      vigaAlero: vigaAlero, cruces: cruces };
  }

  /* =====================================================================
     5 · TODO JUNTO
     d = { m3, sistema, viento: { V_kmh, tipo, aberturas }, sismo?: { zona, suelo, categoria, vs30_ms },
           P_interior_kgf?, P_fachada_kgf? }
     ===================================================================== */
  function analiza(d) {
    const G = geometria(d.m3, d.sistema);
    const estados = [];
    for (const w of estadosViento(G, d.viento)) {
      const ini = muroHastial(G, w.pInicio_kgfm2), fin = muroHastial(G, w.pFinal_kgfm2);
      const c = camino(G, { inicio: ini.map((x) => x.Rcabeza_kgf), final: fin.map((x) => x.Rcabeza_kgf) });
      estados.push(Object.assign({}, w, { hastialInicio: ini, hastialFinal: fin, total_kgf:
        ini.concat(fin).reduce((a, x) => a + x.Rcabeza_kgf + x.Rbase_kgf, 0) }, c));
    }
    let sismo = null;
    if (d.sismo) {
      sismo = estadoSismo(G, d.sismo, d.P_interior_kgf, d.P_fachada_kgf);
      estados.push(Object.assign({}, sismo, camino(G, { ejes: sismo.porEje_kgf })));
    }
    /* el factor de cada tipo, de la E.090 · fila LG.factores */
    const fam = CB.paraAcero({ casos: { D: true, Lr: true, W: true, E: !!sismo } }).combinaciones;
    const factor = { W: 0, E: 0 };
    for (const c of fam) for (const [k, f] of c.terminos) if (factor[k] !== undefined) factor[k] = Math.max(factor[k], Math.abs(f));

    /* la envolvente factorizada de cada pieza */
    const env = (fn) => estados.reduce((a, e) => {
      const v = Math.abs(fn(e)) * factor[e.tipo];
      return v > a.valor ? { valor: v, estado: e.id } : a;
    }, { valor: 0, estado: null });
    const envolvente = {
      cruzFachada: env((e) => Math.max.apply(null, e.cruces.map((c) => c.diagonal_kgf))),
      armaduraTecho: env((e) => Math.max.apply(null, e.armaduras.map((a) =>
        Math.max.apply(null, a.paneles.map((p) => Math.abs(p.diagonal_kgf)))))),
      cordonTecho: env((e) => Math.max.apply(null, e.armaduras.map((a) =>
        Math.max.apply(null, a.paneles.map((p) => p.cordon_kgf))))),
      correaPuntal: env((e) => Math.max.apply(null, e.correas.filter((c) => !c.esAlero).map((c) => c.N_kgf)
        .concat(e.armaduras.map((a) => Math.max.apply(null, a.correas_kgf.slice(1, -1)))))),
      aleroPuntal: env((e) => Math.max(e.aleroPuntal_kgf, e.vigaAlero.reduce((a, v) => Math.max(a, Math.abs(v.N_kgf)), 0))),
      verticalDiagonal: env((e) => e.vertical.reduce((a, v) => Math.max(a, v.diagonal_kgf), 0)),
      verticalPuntal: env((e) => e.vertical.reduce((a, v) => Math.max(a, v.puntal_kgf), 0)),
      baseCortante: env((e) => Math.max.apply(null, e.cruces.map((c) => c.H_kgf))),
      baseVertical: env((e) => Math.max.apply(null, e.cruces.map((c) => c.vertical_kgf)))
    };
    /* las columnas del hastial: la peor de los dos papeles y de los Ci */
    const columnas = G.lineas.map((L, j) => {
      let peor = null;
      for (const e of estados.filter((x) => x.tipo === "W")) {
        for (const [papel, lst] of [["barlovento", e.hastialInicio], ["sotavento", e.hastialFinal]]) {
          const c = lst[j];
          if (!peor || Math.abs(c.M_kgfm) > Math.abs(peor.M_kgfm)) peor = Object.assign({ estado: e.id, papel: papel }, c);
        }
      }
      return peor;
    });
    const avisos = [];
    if (G.cabeza < G.hAlero - 1e-9) {
      avisos.push("el arriostre de techo apoya en la brida superior y el de fachada llega a la cabeza de " +
        "columna, " + (G.hAlero - G.cabeza).toFixed(2).replace(".", ",") + " m más abajo: ese tramo lo baja la " +
        "columna o el montante de apoyo, fuera de su plano (fila LG.alero.nivel)");
    }
    if (!(d.m3.columnasHastiales || []).length) {
      avisos.push("no hay columnas hastiales: el viento del hastial lo llevan solo las columnas de esquina, " +
        "a flexión débil, con toda la luz de largueros");
    }
    if (!sismo) avisos.push("el sismo longitudinal no entra: faltan sus datos");
    avisos.push("el otro sentido del viento y del sismo es simétrico: cada pieza se diseña con el mayor valor " +
      "absoluto, y la cruz de fachada trabaja con la otra diagonal");
    return { geometria: { luz_m: G.luz, sep_m: G.sep, cabeza_m: G.cabeza, alero_m: G.hAlero,
      lineas: G.lineas.map((L) => ({ x: L.x, tipo: L.tipo, H_m: L.H, a: L.a, b: L.b })),
      panosTecho: G.techo, panosFachada: G.fachada }, estados: estados, sismo: sismo, factor: factor,
    envolvente: envolvente, columnas: columnas, avisos: avisos,
    art: ART["LG.techo.armadura"], artFactores: ART["LG.factores"] };
  }

  return { ART, SISTEMA_SISMICO, geometria, integra, muroHastial, estadosViento, estadoSismo, destinos,
    camino, analiza };
});
