/* =====================================================================
   analisis.js — el pórtico entero, cargado y resuelto

   Hasta aquí cada pieza se resolvía sola: tijeral.arma() pone el tijeral
   sobre un apoyo fijo y un rodillo, columnas.js verifica una columna con
   las fuerzas que se le den.  Faltaba lo que las junta: el PÓRTICO, con
   sus columnas y su tijeral, cargado caso por caso con lo que dice la
   E.020 y resuelto combinación por combinación con el Método Directo.

   ─────────────────────────────────────────────────────────────────────
   EL SISTEMA NO TIENE VALOR POR OMISIÓN · fila A.sistema.  Base empotrada
   o articulada, tijeral apoyado o unión rígida: lo decide el proyectista,
   como dejó escrito columnas.js.  La combinación articulada + apoyado es
   un mecanismo y se niega ANTES de que el solucionador la descubra como
   una matriz singular, que es un mensaje que no explica nada.

   EL VIENTO ENTRA COMO ESTADOS FÍSICOS · fila A.viento.casos.  Cada uno con
   todas sus superficies a la vez (E.020 Art. 12.1).  Por eso el ± de la
   E.090 1.4-6 se cubre con las dos direcciones y el factor se aplica con su
   magnitud (fila A.viento.signo): −1,3 por un estado físico convertiría la
   succión del techo en presión, un viento que no existe.

   EL SEGUNDO ORDEN, COMO LO DICE EL APÉNDICE 8 · fila A.segundo.orden.  Dos
   análisis de primer orden: nt, con un apoyo ficticio que impide el ladeo,
   y lt, con la reacción de ese apoyo cambiada de signo.  B2 del piso, B1 de
   cada tramo de columna comprimido, y todo con la rigidez 0,80 del Método
   Directo.  Las piezas —B1, B2, Pe,story, RM, nocionales, τb— ya estaban en
   estabilidad.js; aquí solo se ensamblan.

   LO QUE SALE PARA LA CIMENTACIÓN SON CASOS, NO COMBINACIONES · fila
   A.reacciones.casos.  Es la consecuencia de J.costura: el concreto combina
   con otros factores, así que se le pasan D, Lr, S y cada W sin factorizar.

   UNIDADES: kgf, cm, kgf·cm, como el solucionador.  Las coordenadas del
   galpón vienen en m y se convierten donde hace falta.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./modelo.js"),
      require("./solver.js"), require("./estabilidad.js"), require("./viento.js"),
      require("./combinaciones.js"), require("./montaje.js"), require("./acero.js"));
  } else {
    raiz.ANALISIS = definir(raiz.INVENTARIO, raiz.MODELO, raiz.SOLVER, raiz.ESTABILIDAD,
      raiz.VIENTO, raiz.COMBINACIONES, raiz.MONTAJE, raiz.ACERO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, M, SV, ES, VI, CB, MON, AC) {
  "use strict";

  const ART = INV.declara("analisis.js", [
    "A.sistema", "A.portico.tipico", "A.reparto.techo", "A.Lr.area",
    "A.viento.casos", "A.viento.signo", "A.muro", "A.pesopropio",
    "A.segundo.orden", "A.nocional", "E.C2.taub.alt", "A.B1.tramo", "A.Mr.max",
    "A.reacciones.casos", "A.acero.Pns",
    "S.pendulo", "E.C2.Ni", "E.C2.k080", "E.C2.taub", "E.C3.K", "E.A8.B2", "E.A8.B1",
    "E.A8.Pestory", "E.A8.RM", "E.A8.Cm.transv", "SV.viento.H", "J.costura", "MT.hastial"
  ]);

  const BASES = ["empotrada", "articulada"];
  const UNIONES = ["apoyado", "rigida"];
  const LIMITE_B2_NOCIONAL = 1.7;    /* C2.2b(d) · fila A.nocional */
  const COEF_TAUB_ALT = 0.001;       /* C2.3(c) · fila E.C2.taub.alt */
  const UMBRAL_TAUB = 0.5;           /* C2.3(b) · fila E.C2.taub */

  function exige(c, msg) { if (!c) throw new Error("analisis: " + msg); }

  /* =====================================================================
     1 · EL SISTEMA
     ===================================================================== */
  function sistema(s) {
    exige(s && typeof s === "object",
      "falta el SISTEMA ESTRUCTURAL: { base, union }.\n" +
      "  base: " + BASES.join(" ó ") + " · union: " + UNIONES.join(" ó ") + "\n" +
      "  No hay valor por omisión: cambia los momentos de la columna, la deriva, la\n" +
      "  placa base y la zapata, y lo decide el proyectista (fila A.sistema).");
    exige(BASES.indexOf(s.base) >= 0, "la base es " + BASES.join(" ó ") + ", no «" + s.base + "»");
    exige(UNIONES.indexOf(s.union) >= 0,
      "la unión columna–tijeral es " + UNIONES.join(" ó ") + ", no «" + s.union + "»");
    exige(!(s.base === "articulada" && s.union === "apoyado"),
      "base ARTICULADA con el tijeral APOYADO es un MECANISMO: la columna queda\n" +
      "  articulada arriba y abajo y nada da rigidez lateral al pórtico. Un soplo de\n" +
      "  viento lo tumba. O se empotra la base, o la columna sube hasta la brida\n" +
      "  superior para que el par de bridas haga la rodilla (fila A.sistema).");
    const pendulo = s.base === "empotrada" && s.union === "apoyado";
    return {
      base: s.base, union: s.union, pendulo: pendulo,
      nombre: pendulo ? "columnas en voladizo con el tijeral apoyado"
        : (s.base === "articulada" ? "pórtico rígido de base articulada"
          : "pórtico rígido de base empotrada"),
      notaPendulo: pendulo
        ? "geometría candidata a PÉNDULO INVERTIDO: R₀ = 2,5 para el sismo (fila S.pendulo)" : null,
      art: ART["A.sistema"]
    };
  }

  /* =====================================================================
     2 · EL MODELO DEL PÓRTICO
     ===================================================================== */
  function ejeTipico(m3) {
    const n = m3.ejes.porticos;
    exige(n >= 3, "hacen falta al menos 3 pórticos para que haya uno interior; hay " + n);
    return Math.floor(n / 2);
  }

  function anchoTributario(m3, eje) {
    const z = m3.ejes.z_m;
    exige(eje > 0 && eje < z.length - 1,
      "el eje " + eje + " es de fachada: este módulo analiza el pórtico INTERIOR (fila A.portico.tipico)");
    return (z[eje + 1] - z[eje - 1]) / 2;
  }

  /* La geometría del pórtico interior y lo que depende del sistema, sin
     secciones ni cargas: así se puede inspeccionar y probar por separado. */
  function geometria(m3, s, eje) {
    const sis = sistema(s);
    const e = (eje === undefined) ? ejeTipico(m3) : eje;
    const pl = MON.planoTransversal(m3, e);
    const n = 2 * m3.tijeral.paneles;
    const id = (b) => b + "@" + e;
    const I0 = id("I0"), In = id("I" + n), S0 = id("S0"), Sn = id("S" + n);
    const yDe = {};
    for (const nd of pl.nudos) yDe[nd.id] = nd.y_m;
    exige(yDe[I0] !== undefined && yDe[S0] !== undefined, "el tijeral no tiene los nudos de apoyo esperados");

    const columnas = [];
    const truss = [];
    const omitidas = [];
    const par = (b, a, c) => (b.i === a && b.j === c) || (b.i === c && b.j === a);
    for (const b of pl.barras) {
      if (b.clase === "columna") { columnas.push(b); continue; }
      if (sis.union === "rigida" && (par(b, I0, S0) || par(b, In, Sn))) {
        omitidas.push(b.id);          /* la columna ocupa su lugar */
        continue;
      }
      truss.push(b);
    }
    if (sis.union === "rigida") {
      exige(Math.abs(yDe[S0] - yDe[I0]) > 1e-6,
        "la unión RÍGIDA necesita peralte en el apoyo: aquí la brida superior y la\n" +
        "  inferior llegan al mismo nudo y no hay par de bridas que dé momento (fila A.sistema).\n" +
        "  Con este tijeral solo cabe el tijeral apoyado sobre columnas empotradas.");
      const c0 = columnas.filter((c) => c.i === I0 || c.j === I0)[0];
      const c1 = columnas.filter((c) => c.i === In || c.j === In)[0];
      columnas.push({ id: id("C0s"), i: I0, j: S0, clase: "columna", tramo: "superior", de: c0.id });
      columnas.push({ id: id("C1s"), i: In, j: Sn, clase: "columna", tramo: "superior", de: c1.id });
    }
    const ladeo = sis.union === "rigida" ? S0 : I0;
    return {
      sistema: sis, eje: e, trib_m: anchoTributario(m3, e), plano: pl,
      nudos: pl.nudos, columnas: columnas, truss: truss, omitidas: omitidas,
      apoyos: pl.apoyos, ladeo: ladeo, hLadeo_m: yDe[ladeo],
      alero: { izq: S0, der: Sn }, cabeza: { izq: I0, der: In },
      hAlero_m: Math.max(yDe[S0], yDe[Sn]),
      yDe: yDe,
      art: ART["A.portico.tipico"]
    };
  }

  /* El modelo para el solucionador, con secciones.  `seccion(barra)` es la
     del proyecto (libro.perfilDe + perfiles.busca); devuelve null si falta. */
  function modelo(g, seccion, extra) {
    const m = M.nuevo({ nivel: "LRFD", nombre: "pórtico interior, eje " + g.eje,
      combinacion: extra && extra.combinacion });
    for (const n of g.nudos) M.nudo(m, { id: n.id, x_m: n.x_m, y_m: n.y_m });
    for (const a of g.apoyos) {
      M.apoyo(m, { nudo: a.nudo, ux: true, uy: true, rz: g.sistema.base === "empotrada" });
    }
    if (extra && extra.impideLadeo) M.apoyo(m, { nudo: g.ladeo, ux: true });
    for (const c of g.columnas) {
      const s = seccion(c.de ? { id: c.de, clase: "columna" } : c);
      M.barra(m, { id: c.id, i: c.i, j: c.j, A_cm2: s.A_cm2, I_cm4: s.Ix_cm4 });
    }
    for (const b of g.truss) {
      const s = seccion(b);
      M.barraArmadura(m, { id: b.id, i: b.i, j: b.j, A_cm2: s.A_cm2, I_cm4: s.Ix_cm4 || 0 });
    }
    return m;
  }

  /* Qué clases faltan.  Se pregunta ANTES de montar nada, para decirlo todo
     de una vez en vez de reventar en la primera barra sin perfil. */
  function faltanSecciones(g, seccion, m3) {
    const falta = {};
    const mira = (b) => { if (!seccion(b)) falta[b.clase] = true; };
    for (const c of g.columnas) mira(c.de ? { id: c.de, clase: "columna" } : c);
    for (const b of g.truss) mira(b);
    for (const b of m3.barras) {
      if ((b.clase === "correa" || b.clase === "viga de alero") && !seccion(b)) falta[b.clase] = true;
    }
    return Object.keys(falta);
  }

  /* =====================================================================
     3 · LAS CARGAS, CASO POR CASO · sin factorizar
     ===================================================================== */

  /* Los tramos de brida superior, de izquierda a derecha */
  function tramosTecho(g) {
    const sup = g.nudos.filter((n) => n.clase === "superior").slice()
      .sort((a, b) => a.x_m - b.x_m);
    const t = [];
    for (let k = 0; k + 1 < sup.length; k++) {
      const a = sup[k], b = sup[k + 1];
      const dx = b.x_m - a.x_m, dy = b.y_m - a.y_m;
      t.push({ a: a.id, b: b.id, dx_m: dx, dy_m: dy, L_m: Math.hypot(dx, dy),
        s: dy / dx, theta_grad: Math.atan(Math.abs(dy / dx)) * 180 / Math.PI });
    }
    return t;
  }

  /* Una lista de cargas es [{ nudo, Fx_kgf, Fy_kgf }] y [{ barra, w_kgfm }] */
  function nuevaLista() { return { nudos: {}, barras: [] }; }
  function sumaNudo(L, nudo, fx, fy) {
    const c = L.nudos[nudo] || (L.nudos[nudo] = { Fx_kgf: 0, Fy_kgf: 0 });
    c.Fx_kgf += fx; c.Fy_kgf += fy;
  }

  function casoMuerta(g, m3, seccion, D_kgfm2) {
    exige(D_kgfm2 >= 0, "la carga muerta de la cobertura, D_kgfm2, tiene que ser ≥ 0");
    const L = nuevaLista();
    /* la cobertura y lo que cuelgue, sobre la superficie inclinada */
    for (const t of tramosTecho(g)) {
      const P = D_kgfm2 * t.L_m * g.trib_m;
      sumaNudo(L, t.a, 0, -P / 2); sumaNudo(L, t.b, 0, -P / 2);
    }
    /* el peso propio de las barras del pórtico, mitad a cada extremo */
    const pesoBarra = (b, sb) => {
      const ni = g.nudos.filter((n) => n.id === b.i)[0], nj = g.nudos.filter((n) => n.id === b.j)[0];
      const Lm = Math.hypot(nj.x_m - ni.x_m, nj.y_m - ni.y_m);
      const P = (sb.peso_kgfm || 0) * Lm;
      sumaNudo(L, b.i, 0, -P / 2); sumaNudo(L, b.j, 0, -P / 2);
      return P;
    };
    let propio = 0;
    for (const c of g.columnas) propio += pesoBarra(c, seccion(c.de ? { id: c.de, clase: "columna" } : c));
    for (const b of g.truss) propio += pesoBarra(b, seccion(b));
    /* correas y vigas de alero: su peso por un ancho tributario, en su nudo */
    let fuera = 0;
    const visto = {};
    for (const b of m3.barras) {
      if (b.clase !== "correa" && b.clase !== "viga de alero") continue;
      const sb = seccion(b);
      const base = b.i.split("@")[0];
      const key = b.clase + "|" + base;
      if (visto[key]) continue;
      visto[key] = true;
      const nudo = base + "@" + g.eje;
      if (g.yDe[nudo] === undefined) continue;
      const P = (sb.peso_kgfm || 0) * g.trib_m;
      sumaNudo(L, nudo, 0, -P);
      fuera += P;
    }
    return { id: "D", tipo: "D", desc: "muerta: cobertura " + D_kgfm2 + " kgf/m² + peso propio",
      cargas: L, pesoPropio_kgf: propio, pesoCorreas_kgf: fuera,
      art: ART["A.pesopropio"], artReparto: ART["A.reparto.techo"] };
  }

  function casoViva(g, Lr_kgfm2) {
    exige(Lr_kgfm2 > 0, "la carga viva de techo, Lr_kgfm2, tiene que ser > 0");
    const L = nuevaLista();
    for (const t of tramosTecho(g)) {           /* sobre la superficie · fila A.Lr.area */
      const P = Lr_kgfm2 * t.L_m * g.trib_m;
      sumaNudo(L, t.a, 0, -P / 2); sumaNudo(L, t.b, 0, -P / 2);
    }
    return { id: "Lr", tipo: "Lr", desc: "viva de techo " + Lr_kgfm2 + " kgf/m² sobre la superficie",
      cargas: L, art: ART["A.Lr.area"] };
  }

  /* La nieve, sobre la proyección horizontal (E.020 Art. 11.3).  Balanceada
     y, si aplica, desbalanceada en los dos sentidos. */
  function casosNieve(g, S) {
    const out = [];
    const sobre = (q) => {
      const L = nuevaLista();
      for (const t of tramosTecho(g)) {
        const w = q(t);
        const P = w * Math.abs(t.dx_m) * g.trib_m;
        sumaNudo(L, t.a, 0, -P / 2); sumaNudo(L, t.b, 0, -P / 2);
      }
      return L;
    };
    exige(S.Qt_kgfm2 > 0, "la nieve necesita Qt_kgfm2 > 0");
    out.push({ id: "S", tipo: "S", desc: "nieve balanceada " + S.Qt_kgfm2 + " kgf/m² en proyección",
      cargas: sobre(() => S.Qt_kgfm2) });
    if (S.desbalanceada) {
      const A = S.desbalanceada.faldonA_kgfm2, B = S.desbalanceada.faldonB_kgfm2;
      out.push({ id: "S-izq", tipo: "S", desc: "nieve desbalanceada, cargado el faldón izquierdo",
        cargas: sobre((t) => (t.s >= 0 ? A : B)) });
      out.push({ id: "S-der", tipo: "S", desc: "nieve desbalanceada, cargado el faldón derecho",
        cargas: sobre((t) => (t.s >= 0 ? B : A)) });
    }
    return out;
  }

  /* ---------- EL VIENTO · fila A.viento.casos ---------------------------- */
  function aberturasDe(v, dir) {
    if (typeof v.aberturas === "string") return v.aberturas;
    exige(v.aberturas && v.aberturas[dir],
      "faltan las aberturas para el viento «" + dir + "». Se dan por dirección —izqDer,\n" +
      "  derIzq y longitudinal— porque el mismo portón es barlovento en una y sotavento\n" +
      "  en otra; o una sola cadena si valen para todas (viento.js, Tabla 5).");
    return v.aberturas[dir];
  }

  function casosViento(g, v) {
    exige(v && v.V_kmh > 0, "el viento necesita V_kmh, la velocidad del Mapa Eólico");
    const tipo = (v.tipo === undefined) ? 1 : v.tipo;
    const hCumbre = Math.max.apply(null, g.nudos.map((n) => n.y_m));
    const vel = VI.velocidadDiseno({ V_kmh: v.V_kmh, h_m: hCumbre });
    const Ph = (C) => VI.presion({ C: C, Vh_kmh: vel.Vh_kmh, tipo: tipo }).Ph_kgfm2;
    const tramos = tramosTecho(g);
    const muro = VI.ceMuro();
    const out = [];
    let k = 0;
    const fmt = (x) => (x >= 0 ? "+" : "") + x.toFixed(1).replace(".", ",");

    /* el muro: repartido en la columna hasta su cabeza, y la franja de encima a los nudos */
    const cargaMuro = (L, lado, ph) => {
      const fx = (lado === "izq" ? +1 : -1) * ph * g.trib_m;       /* kgf/m, + = hacia +x */
      const cab = g.cabeza[lado], alero = g.alero[lado];
      for (const c of g.columnas) {
        const sube = (lado === "izq") ? (c.i.indexOf("B0") === 0 || c.i === g.cabeza.izq)
          : (c.i.indexOf("B1") === 0 || c.i === g.cabeza.der);
        if (!sube) continue;
        /* columna que va hacia arriba: +y local = −x global, así que w = −fx */
        L.barras.push({ barra: c.id, w_kgfm: -fx });
      }
      const top = g.sistema.union === "rigida" ? g.yDe[alero] : g.yDe[cab];
      const franja = g.yDe[alero] - top;
      if (franja > 1e-9) {
        sumaNudo(L, cab, fx * franja / 2, 0);
        sumaNudo(L, alero, fx * franja / 2, 0);
      }
    };
    /* un tramo de techo: normal a su superficie, mitad a cada nudo */
    const cargaTramo = (L, t, ph) => {
      const A = t.L_m * g.trib_m;
      const nx = -t.dy_m / t.L_m, ny = t.dx_m / t.L_m;    /* normal hacia fuera (arriba) */
      const fx = -ph * A * nx, fy = -ph * A * ny;          /* presión hacia dentro */
      sumaNudo(L, t.a, fx / 2, fy / 2); sumaNudo(L, t.b, fx / 2, fy / 2);
    };

    /* TRANSVERSAL, en las dos direcciones */
    for (const [dir, signo, nombre] of [["izqDer", +1, "izq→der"], ["derIzq", -1, "der→izq"]]) {
      const ci = VI.ci(aberturasDe(v, dir));
      /* cuántas opciones de Ce a barlovento hay: las del tramo que más tenga */
      const nOp = Math.max.apply(null, tramos.map((t) => VI.ceTecho(t.theta_grad).barlovento.length));
      for (const Ci of ci.Ci) {
        for (let op = 0; op < nOp; op++) {
          const L = nuevaLista();
          const izq = signo > 0 ? muro.barlovento[0] : muro.sotavento;
          const der = signo > 0 ? muro.sotavento : muro.barlovento[0];
          cargaMuro(L, "izq", Ph(izq - Ci));
          cargaMuro(L, "der", Ph(der - Ci));
          let ceBar = null;
          for (const t of tramos) {
            const ct = VI.ceTecho(t.theta_grad);
            const barlo = t.s * signo >= 0;        /* sube en la dirección del viento */
            const ce = barlo ? ct.barlovento[Math.min(op, ct.barlovento.length - 1)] : ct.sotavento;
            if (barlo && ceBar === null) ceBar = ce;
            cargaTramo(L, t, Ph(ce - Ci));
          }
          k++;
          out.push({ id: "W" + k, tipo: "W", direccion: dir,
            desc: "viento " + nombre + " · Ci " + fmt(Ci) +
              (ceBar !== null ? " · techo a barlovento Ce " + fmt(ceBar) : ""),
            Ci: Ci, cargas: L });
        }
      }
    }
    /* LONGITUDINAL: todo paralelo al viento, −0,7, y levanta */
    const ciL = VI.ci(aberturasDe(v, "longitudinal"));
    const cePar = VI.T4.paralelas.barlovento[0];
    for (const Ci of ciL.Ci) {
      const L = nuevaLista();
      cargaMuro(L, "izq", Ph(cePar - Ci));
      cargaMuro(L, "der", Ph(cePar - Ci));
      for (const t of tramos) cargaTramo(L, t, Ph(cePar - Ci));
      k++;
      out.push({ id: "W" + k, tipo: "W", direccion: "longitudinal",
        desc: "viento longitudinal · todo a " + fmt(cePar) + " · Ci " + fmt(Ci), Ci: Ci, cargas: L });
    }
    return { casos: out, Vh_kmh: vel.Vh_kmh, hCumbre_m: hCumbre,
      art: ART["A.viento.casos"], artMuro: ART["A.muro"] };
  }

  /* =====================================================================
     4 · RESOLVER
     ===================================================================== */
  function aplica(m, L, f) {
    for (const nudo of Object.keys(L.nudos)) {
      const c = L.nudos[nudo];
      if (c.Fx_kgf || c.Fy_kgf) M.cargaNudo(m, { nudo: nudo, Fx_kgf: f * c.Fx_kgf, Fy_kgf: f * c.Fy_kgf });
    }
    for (const b of L.barras) M.cargaBarra(m, { barra: b.barra, w_kgfm: f * b.w_kgfm });
  }

  function combinaListas(partes) {
    const L = nuevaLista();
    for (const [lista, f] of partes) {
      for (const nudo of Object.keys(lista.nudos)) {
        sumaNudo(L, nudo, f * lista.nudos[nudo].Fx_kgf, f * lista.nudos[nudo].Fy_kgf);
      }
      for (const b of lista.barras) L.barras.push({ barra: b.barra, w_kgfm: f * b.w_kgfm });
    }
    return L;
  }

  function gravedad(L) {
    let s = 0;
    for (const nudo of Object.keys(L.nudos)) s += L.nudos[nudo].Fy_kgf;
    return -s;
  }

  /* El momento interno a lo largo de una barra con carga repartida.
     Convenio del solucionador: M_i es el momento de extremo sobre la barra;
     el interno en x vale −M_i + V_i·x + w·x²/2 (comprobado en la prueba con
     el voladizo, donde tiene que dar w·L²/2 en el empotramiento). */
  function momentoMaximo(f, w_kgfm) {
    const L = f.L_cm, w = (w_kgfm || 0) / 100;
    const Mx = (x) => -f.M_i_kgfcm + f.V_i_kgf * x + w * x * x / 2;
    let m = Math.max(Math.abs(Mx(0)), Math.abs(Mx(L)));
    if (Math.abs(w) > 1e-12) {
      const x0 = -f.V_i_kgf / w;
      if (x0 > 0 && x0 < L) m = Math.max(m, Math.abs(Mx(x0)));
    }
    return { max_kgfcm: m, Mi_kgfcm: Mx(0), Mj_kgfcm: Mx(L) };
  }

  /* Un caso sin factorizar: primer orden, rigidez nominal · fila A.reacciones.casos */
  function resuelveCaso(g, seccion, caso) {
    const m = modelo(g, seccion);
    aplica(m, caso.cargas, 1);
    const r = SV.resuelve(m);
    const reac = {};
    for (const a of g.apoyos) {
      reac[a.nudo.split("@")[0]] = {
        Rx_kgf: r.reaccion(a.nudo, "ux"), Ry_kgf: r.reaccion(a.nudo, "uy"),
        Mz_kgfcm: g.sistema.base === "empotrada" ? r.reaccion(a.nudo, "rz") : 0
      };
    }
    const dx = Math.max(Math.abs(r.desplaza(g.alero.izq, "ux")), Math.abs(r.desplaza(g.alero.der, "ux")));
    return { id: caso.id, tipo: caso.tipo, desc: caso.desc, reacciones: reac,
      derivaAlero_cm: dx, resultado: r };
  }

  /* Una combinación con el Método Directo y el segundo orden del Apéndice 8 */
  function resuelveCombinacion(g, seccion, L, op) {
    const Pstory = gravedad(L);
    const Ladeo = nuevaLista();
    if (op.nocional) sumaNudo(Ladeo, g.ladeo, op.nocional, 0);
    const Lnt = combinaListas([[L, 1], [Ladeo, 1]]);

    const mnt = modelo(g, seccion, { impideLadeo: true });
    aplica(mnt, Lnt, 1);
    const rnt = ES.analiza(mnt);                 /* rigidez 0,80 · fila E.C2.k080 */
    const R = rnt.reaccion(g.ladeo, "ux");

    const mlt = modelo(g, seccion);
    M.cargaNudo(mlt, { nudo: g.ladeo, Fx_kgf: -R });
    const rlt = ES.analiza(mlt);
    const dH = Math.abs(rlt.desplaza(g.ladeo, "ux"));
    const H = Math.abs(R);
    const hcm = g.hLadeo_m * 100;

    let B2 = 1, PeS = null;
    if (H > 1e-6 && dH > 1e-12 && Pstory > 0) {
      const RM = ES.factorRM({ Pmf_kgf: Pstory, Pstory_kgf: Pstory }).RM;
      PeS = ES.PeStory({ H_kgf: H, L_cm: hcm, deltaH_cm: dH, RM: RM }).Pestory_kgf;
      B2 = ES.B2({ Pstory_kgf: Pstory, Pestory_kgf: PeS }).B2;
    }
    return { rnt: rnt, rlt: rlt, B2: B2, Pstory_kgf: Pstory, H_kgf: H, dH_cm: dH,
      PeStory_kgf: PeS, nocional_kgf: op.nocional || 0 };
  }

  /* Las fuerzas de diseño de cada barra en una combinación */
  function fuerzasDeDiseno(g, seccion, L, sol, E_kgcm2) {
    const wDe = {};
    for (const b of L.barras) wDe[b.barra] = (wDe[b.barra] || 0) + b.w_kgfm;
    const out = {};
    const todas = g.columnas.map((c) => ({ b: c, col: true })).concat(g.truss.map((b) => ({ b: b, col: false })));
    for (const { b, col } of todas) {
      const fn = sol.rnt.barra(b.id), fl = sol.rlt.barra(b.id);
      const Pr = fn.N_kgf + sol.B2 * fl.N_kgf;             /* + tracción */
      const r = { Pr_kgf: Pr, L_cm: fn.L_cm, Mr_kgfcm: 0, B1: 1 };
      if (col) {
        const s = seccion(b.de ? { id: b.de, clase: "columna" } : b);
        const mn = momentoMaximo(fn, wDe[b.id]);
        const ml = momentoMaximo(fl, 0);
        let B1 = 1, Cm = null;
        if (Pr < 0) {                                       /* comprimida: P-δ */
          const transv = Math.abs(wDe[b.id] || 0) > 1e-9;
          let cm;
          if (transv) cm = ES.factorCm({ cargaTransversal: true });
          else {
            /* EL CONVENIO DE SIGNOS. factorCm() quiere M1/M2 POSITIVO en curvatura
               doble (el convenio de momentos de extremo del AISC). Aquí los momentos
               son INTERNOS, de viga: en curvatura doble el interno cambia de signo a
               lo largo de la barra, así que sus valores de extremo tienen signos
               OPUESTOS. Pasarlos tal cual invertiría Cm —0,2 donde toca 1,0— y B1
               saldría corto del lado inseguro. Se cambia el signo del menor. */
            const a = mn.Mi_kgfcm, c = mn.Mj_kgfcm;
            const grande = Math.abs(a) >= Math.abs(c) ? a : c, chico = grande === a ? c : a;
            cm = Math.abs(grande) < 1e-9 ? { Cm: 1.0 }
              : ES.factorCm({ M2_kgfcm: Math.abs(grande), M1_kgfcm: -chico * Math.sign(grande) });
          }
          Cm = cm.Cm;
          const pe = ES.Pe1({ E_kgcm2: E_kgcm2, I_cm4: s.Ix_cm4, Lc1_cm: fn.L_cm });
          B1 = ES.B1({ Cm: Cm, Pr_kgf: -Pr, Pe1_kgf: pe.Pe1_kgf }).B1;
        }
        r.B1 = B1; r.Cm = Cm;
        r.Mi_kgfcm = B1 * mn.Mi_kgfcm + sol.B2 * ml.Mi_kgfcm;
        r.Mj_kgfcm = B1 * mn.Mj_kgfcm + sol.B2 * ml.Mj_kgfcm;
        r.Mr_kgfcm = B1 * mn.max_kgfcm + sol.B2 * ml.max_kgfcm;   /* fila A.Mr.max */
        r.Vr_kgf = Math.max(Math.abs(fn.V_i_kgf), Math.abs(fn.V_j_kgf)) +
          sol.B2 * Math.max(Math.abs(fl.V_i_kgf), Math.abs(fl.V_j_kgf));
        r.Pns_kgf = null;
      }
      out[b.id] = r;
    }
    return out;
  }

  /* =====================================================================
     5 · TODO JUNTO
     ===================================================================== */
  function analiza(d) {
    const m3 = d.m3;
    exige(m3 && m3.ejes, "analiza() necesita m3, el galpón montado (montaje.monta)");
    exige(typeof d.seccion === "function", "analiza() necesita seccion(barra) → { A_cm2, Ix_cm4, peso_kgfm }");
    exige(d.acero, "analiza() necesita el acero del proyecto (fila A.acero.Pns): \"A36\" ó \"A572\"");
    const mat = AC.material(d.acero);
    const g = geometria(m3, d.sistema, d.eje);
    const falta = faltanSecciones(g, d.seccion, m3);
    exige(!falta.length,
      "faltan perfiles para: " + falta.join(" · ") + ".\n" +
      "  Sin A ni I no hay análisis. Se asignan en la tabla de perfiles del paso Geometría.");
    const c = d.cargas || {};

    /* ---- los casos ---- */
    const casos = [casoMuerta(g, m3, d.seccion, c.D_kgfm2)];
    const hayS = !!(c.S && c.S.Qt_kgfm2 > 0);
    exige(hayS || c.Lr_kgfm2 > 0,
      "falta la carga de techo: Lr_kgfm2, o la nieve si el sitio la tiene (E.020 Art. 7.1 d)");
    if (c.Lr_kgfm2 > 0 && !hayS) casos.push(casoViva(g, c.Lr_kgfm2));
    if (hayS) for (const s of casosNieve(g, c.S)) casos.push(s);
    const vw = casosViento(g, c.viento);
    for (const w of vw.casos) casos.push(w);

    const porTipo = (t) => casos.filter((x) => x.tipo === t);
    const deId = {};
    for (const x of casos) deId[x.id] = x;

    /* ---- los casos sin factorizar: reacciones y deriva ---- */
    const sinFactorizar = casos.map((x) => resuelveCaso(g, d.seccion, x));
    const derivas = sinFactorizar.filter((x) => x.tipo === "W").map((x) => ({
      caso: x.id, deriva_cm: x.derivaAlero_cm, relacion: x.derivaAlero_cm / (g.hAlero_m * 100)
    }));
    const peorDeriva = derivas.reduce((a, b) => (b.relacion > a.relacion ? b : a), derivas[0]);

    /* ---- las combinaciones, expandidas a los estados físicos ---- */
    const presentes = { D: true, Lr: !hayS, S: hayS, W: true };
    const familia = CB.paraAcero({ casos: presentes });
    const combos = [];
    for (const cb of familia.combinaciones) {
      const listas = [[]];
      let conLateral = false;
      for (const [caso, f] of cb.terminos) {
        const fa = (caso === "W" || caso === "E") ? Math.abs(f) : f;   /* fila A.viento.signo */
        const estados = porTipo(caso);
        if (!estados.length) continue;
        if (caso === "W") conLateral = true;
        const nuevas = [];
        for (const base of listas) for (const e of estados) nuevas.push(base.concat([[e, fa]]));
        listas.splice(0, listas.length, ...nuevas);
      }
      for (const partes of listas) {
        const nombre = partes.filter(([e]) => e.tipo === "W" || e.id.indexOf("S-") === 0)
          .map(([e]) => e.id).join(" ");
        combos.push({ id: cb.id + (nombre ? " · " + nombre : ""), base: cb.id, texto: cb.texto,
          partes: partes, lateral: conLateral });
      }
    }

    const corre = (adicional) => {
      const filas = [];
      for (const cb of combos) {
        const L = combinaListas(cb.partes.map(([e, f]) => [e.cargas, f]));
        const Y = gravedad(L);
        const sentidos = cb.lateral ? [null] : [+1, -1];
        for (const sg of sentidos) {
          let coef = (cb.lateral ? 0 : ES.COEF_NOCIONAL) + (adicional ? COEF_TAUB_ALT : 0);
          let dirLat = sg;
          if (cb.lateral) {
            let fx = 0;
            for (const n of Object.keys(L.nudos)) fx += L.nudos[n].Fx_kgf;
            for (const b of L.barras) fx += -b.w_kgfm;   /* columnas verticales */
            dirLat = fx >= 0 ? +1 : -1;
          }
          let sol = resuelveCombinacion(g, d.seccion, L, { nocional: dirLat * coef * Y });
          let nocionalAgregada = false;
          if (cb.lateral && sol.B2 > LIMITE_B2_NOCIONAL) {   /* C2.2b(d) */
            coef += ES.COEF_NOCIONAL;
            sol = resuelveCombinacion(g, d.seccion, L, { nocional: dirLat * coef * Y });
            nocionalAgregada = true;
          }
          const fz = fuerzasDeDiseno(g, d.seccion, L, sol, M.E_ACERO);
          filas.push({ id: cb.id + (sg === null ? "" : (sg > 0 ? " · N→" : " · N←")),
            base: cb.base, texto: cb.texto, lateral: cb.lateral,
            B2: sol.B2, Pstory_kgf: sol.Pstory_kgf, nocional_kgf: sol.nocional_kgf,
            nocionalPorB2: nocionalAgregada, fuerzas: fz });
        }
      }
      return filas;
    };

    let filas = corre(false);
    /* τb · si alguna columna pasa de α·Pr/Pns = 0,5, C2.3(c) */
    const excede = (fl) => {
      for (const f of fl) {
        for (const col of g.columnas) {
          const r = f.fuerzas[col.id];
          const s = d.seccion(col.de ? { id: col.de, clase: "columna" } : col);
          if (r.Pr_kgf < 0 && -r.Pr_kgf / (mat.Fy * s.A_cm2) > UMBRAL_TAUB) return true;
        }
      }
      return false;
    };
    const tauBalt = excede(filas);
    if (tauBalt) filas = corre(true);

    /* ---- la envolvente por barra ---- */
    const env = {};
    const todas = g.columnas.concat(g.truss);
    for (const b of todas) {
      const base = b.id.split("@")[0];
      const e = { id: base, barra: b.id, clase: b.clase, L_cm: null,
        traccion: { Pr_kgf: 0, combo: null }, compresion: { Pr_kgf: 0, combo: null },
        momento: { Mr_kgfcm: 0, combo: null }, columna: b.clase === "columna" };
      for (const f of filas) {
        const r = f.fuerzas[b.id];
        e.L_cm = r.L_cm;
        if (r.Pr_kgf > e.traccion.Pr_kgf) e.traccion = { Pr_kgf: r.Pr_kgf, combo: f.id };
        if (r.Pr_kgf < e.compresion.Pr_kgf) {
          e.compresion = { Pr_kgf: r.Pr_kgf, combo: f.id, Mr_kgfcm: r.Mr_kgfcm, B1: r.B1 };
        }
        if (r.Mr_kgfcm > e.momento.Mr_kgfcm) {
          e.momento = { Mr_kgfcm: r.Mr_kgfcm, combo: f.id, Pr_kgf: r.Pr_kgf, B1: r.B1 };
        }
      }
      e.invierte = e.traccion.Pr_kgf > 1e-6 && e.compresion.Pr_kgf < -1e-6;
      env[base] = e;
    }

    const maxB2 = filas.reduce((a, f) => Math.max(a, f.B2), 1);
    return {
      sistema: g.sistema, eje: g.eje, trib_m: g.trib_m,
      hAlero_m: g.hAlero_m, nudoLadeo: g.ladeo, omitidas: g.omitidas,
      acero: d.acero,
      casos: sinFactorizar.map((x) => ({ id: x.id, tipo: x.tipo, desc: x.desc,
        reacciones: x.reacciones, derivaAlero_cm: x.derivaAlero_cm })),
      viento: { Vh_kmh: vw.Vh_kmh, hCumbre_m: vw.hCumbre_m, estados: vw.casos.length },
      combinaciones: filas.map((f) => ({ id: f.id, base: f.base, texto: f.texto,
        lateral: f.lateral, B2: f.B2, Pstory_kgf: f.Pstory_kgf, nocional_kgf: f.nocional_kgf,
        nocionalPorB2: f.nocionalPorB2 })),
      corridas: filas,
      barras: env,
      deriva: { peor: peorDeriva, limite: 1 / 100, todas: derivas,
        cumple: peorDeriva.relacion <= 1 / 100 + 1e-12, art: ART["SV.viento.H"] },
      segundoOrden: { maxB2: maxB2, tauBalt: tauBalt,
        nota: tauBalt ? "alguna columna pasa de α·Pr/Pns = 0,5: se repitió con la nocional " +
          "adicional de 0,001·Yi en todas las combinaciones (C2.3(c))" : "τb = 1 en todas las columnas" },
      avisos: [
        "se analiza el pórtico INTERIOR del eje " + g.eje + "; los de fachada, con columnas " +
          "hastiales, son otro modelo y todavía no están (fila A.portico.tipico)",
        "el sismo todavía no entra en este análisis: falta elegir R, y con este sistema " +
          (g.sistema.pendulo ? "el galpón es candidato a péndulo invertido (R₀ = 2,5)" : "es un pórtico") +
          ". Va en el paso siguiente."
      ].concat(g.sistema.notaPendulo ? [g.sistema.notaPendulo] : []),
      art: ART["A.segundo.orden"], artReacciones: ART["A.reacciones.casos"],
      artNocional: ART["A.nocional"]
    };
  }

  return {
    ART, BASES, UNIONES, LIMITE_B2_NOCIONAL, COEF_TAUB_ALT, UMBRAL_TAUB,
    sistema, ejeTipico, anchoTributario, geometria, modelo, faltanSecciones,
    tramosTecho, casoMuerta, casoViva, casosNieve, casosViento,
    resuelveCaso, resuelveCombinacion, fuerzasDeDiseno, momentoMaximo, analiza
  };
});
