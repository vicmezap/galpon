/* =====================================================================
   zapatas.js — E8: la zapata aislada de la columna del galpón · E.060

   DOS CÁLCULOS CON DOS JUEGOS DE CARGA SOBRE LA MISMA PIEZA (fila
   Z.dos.niveles): el área con las cargas de SERVICIO contra la presión
   admisible del suelo, y el concreto con las cargas AMPLIFICADAS de la
   E.060.  Mezclarlos es el error clásico de la cimentación.

   Y LO QUE LE LLEGA SON CASOS, NO COMBINACIONES (filas J.costura y
   A.reacciones.casos): el análisis entrega la reacción de cada caso sin
   factorizar en cada base, y aquí se arman las combinaciones de servicio
   (fila Z.servicio) y las de la E.060 (fila Z.combos.E060).

   ─────────────────────────────────────────────────────────────────────
   LO QUE UN GALPÓN TIENE Y UN EDIFICIO NO:
     · momento grande en la base si la columna está empotrada: presión
       trapezoidal o triangular, nunca uniforme
     · levantamiento con el viento: la zapata se puede dimensionar por PESO,
       no por área (fila Z.levantamiento)
     · cortante en la base, que el suelo resiste por rozamiento
     · el momento que el pedestal transfiere por punzonamiento (fila
       Z.punzon.momento): omitirlo deja el punzonamiento del lado inseguro

   UNIDADES: kgf, cm, kgf/cm².  Las ecuaciones de la E.060 están en MPa y
   se convierten exactas con unidades.js.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./unidades.js"),
      require("./e020.js"), require("./combinaciones.js"));
  } else {
    raiz.ZAPATAS = definir(raiz.INVENTARIO, raiz.UNIDADES, raiz.E020, raiz.COMBINACIONES);
  }
})(typeof self !== "undefined" ? self : this, function (INV, UN, E020, CB) {
  "use strict";

  const ART = INV.declara("zapatas.js", [
    "Z.dos.niveles", "Z.sin.traccion", "Z.inc30", "Z.sismo80", "Z.sigma.neta", "Z.peralte.min",
    "Z.punzon.Vc", "Z.punzon.alfa", "Z.punzon.bo", "Z.phi.corte", "Z.phi.flexion", "Z.franja",
    "Z.combos.E060", "Z.levantamiento", "Z.servicio", "Z.signo", "Z.peso", "Z.vuelco",
    "Z.deslizamiento", "Z.plano", "Z.As.min", "Z.s.max", "Z.Vc.viga", "Z.bloque", "Z.As.max",
    "Z.rec", "Z.punzon.momento", "Z.desarrollo", "D.concreto.gamma", "N.no.viento", "J.anclaje.concreto",
    "PD.anclaje.zapata", "Z.biaxial", "Z.longitudinal.articulada", "Z.punzon.biaxial", "ZT.tipos"
  ]);

  const MPA = UN.MPA_KGCM2;
  const PHI_V = 0.85, PHI_F = 0.90;           /* filas Z.phi.corte y Z.phi.flexion */
  const INC_TEMPORAL = 1.30;                   /* fila Z.inc30 */
  const SISMO_SUELO = 0.80;                    /* fila Z.sismo80 */
  const REC_MIN = 7.0;                         /* cm · fila Z.rec */
  const SOBRE_ACERO_MIN = 30;                  /* cm · fila Z.peralte.min */
  const S_MAX_CM = 40;                         /* fila Z.s.max */
  const ALFA_S = 40;                           /* columna interior · fila Z.punzon.alfa */
  const GRADOS = { "60": 420, "40": 280 };     /* MPa · fila Z.As.min */
  const EPS_CU = 0.003, ES_MPA = 200000;       /* fila Z.As.max */
  const BARRAS = { "3/8": 0.9525, "1/2": 1.27, "5/8": 1.5875, "3/4": 1.905, "1": 2.54 };   /* cm, nominal */

  function exige(c, msg) { if (!c) throw new Error("zapatas: " + msg); }

  /* √f'c como esfuerzo en kgf/cm², para usar las ecuaciones en MPa tal cual */
  const raizFc = (fc) => Math.sqrt(fc / MPA) * MPA;

  /* =====================================================================
     1 · LA PRESIÓN · sin tracción (fila Z.sin.traccion)
     e es la posición de la resultante del suelo respecto del centro.
     ===================================================================== */
  function presion(N, e, B, L) {
    if (!(N > 0)) return { levanta: true, N: N };
    const ae = Math.abs(e);
    if (ae >= L / 2) return { vuelca: true, N: N, e: e };
    if (ae <= L / 6) {
      const q0 = N / (B * L);
      const qa = q0 * (1 - 6 * e / L), qb = q0 * (1 + 6 * e / L);   /* en −L/2 y +L/2 */
      return { N: N, e: e, forma: "trapecio", qmax: Math.max(qa, qb), qmin: Math.min(qa, qb),
        contacto: L, q: (x) => qa + (qb - qa) * (x + L / 2) / L };
    }
    const a = 3 * (L / 2 - ae);
    const qmax = 2 * N / (B * a);
    const lado = e > 0 ? +1 : -1;
    return { N: N, e: e, forma: "triángulo", qmax: qmax, qmin: 0, contacto: a,
      q: (x) => {
        const dist = lado > 0 ? (x - (L / 2 - a)) : ((-L / 2 + a) - x);
        return dist <= 0 ? 0 : qmax * dist / a;
      } };
  }

  /* LA PRESIÓN CON MOMENTO EN LAS DOS DIRECCIONES · fila Z.biaxial
     x a lo largo de L (el plano del pórtico), y a lo largo de B.  ex y ey son
     la posición de la resultante.  Sin tracción (§15.2.3):
       · con un solo momento, la solución de siempre (presion)
       · dentro del núcleo, |ex|/L + |ey|/B ≤ 1/6: el plano entero, cerrado
       · fuera, el plano TRUNCADO q = máx(0, a + b·x + c·y) cuyo volumen y
         momentos son N, N·ex y N·ey: se resuelve por Newton sobre una malla */
  function presion2(N, ex, ey, B, L) {
    if (!(N > 0)) return { levanta: true, N: N };
    if (Math.abs(ey) < 1e-9 * B) {
      const p = presion(N, ex, B, L);
      return Object.assign({}, p, { ey: 0, q2: p.q ? (x) => p.q(x) : null, ny: 2, nx: 400 });
    }
    if (Math.abs(ex) < 1e-9 * L) {
      const p = presion(N, ey, L, B);                 /* el mismo problema, girado */
      return Object.assign({}, p, { e: 0, ey: ey, q2: p.q ? (x, y) => p.q(y) : null, nx: 2, ny: 400,
        forma: p.forma ? p.forma + " (en B)" : p.forma });
    }
    if (Math.abs(ex) >= L / 2 || Math.abs(ey) >= B / 2) return { vuelca: true, N: N, e: ex, ey: ey };
    const A = B * L, q0 = N / A;
    let a = q0, b = 12 * N * ex / (B * L * L * L), c = 12 * N * ey / (L * B * B * B);
    const qmaxDe = (a1, b1, c1) => a1 + Math.abs(b1) * L / 2 + Math.abs(c1) * B / 2;
    if (Math.abs(ex) / L + Math.abs(ey) / B <= 1 / 6 + 1e-12) {
      return { N: N, e: ex, ey: ey, forma: "plano entero", qmax: qmaxDe(a, b, c),
        qmin: a - Math.abs(b) * L / 2 - Math.abs(c) * B / 2, contacto: 1,
        q2: (x, y) => a + b * x + c * y, nx: 2, ny: 2 };    /* plano · Simpson es exacto hasta cúbicas */
    }
    /* Newton sobre una malla de n × n celdas */
    const n = 80, hx = L / n, hy = B / n, dA = hx * hy;
    const xs = [], ys = [];
    for (let i = 0; i < n; i++) { xs.push(-L / 2 + (i + 0.5) * hx); ys.push(-B / 2 + (i + 0.5) * hy); }
    const resid = (a1, b1, c1) => {
      let F0 = 0, F1 = 0, F2 = 0, J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], act = 0;
      for (const x of xs) for (const y of ys) {
        const q = a1 + b1 * x + c1 * y;
        if (q <= 0) continue;
        act++;
        F0 += q * dA; F1 += q * x * dA; F2 += q * y * dA;
        const v = [1, x, y];
        for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) J[r][k] += v[r] * v[k] * dA;
      }
      return { F: [F0 - N, F1 - N * ex, F2 - N * ey], J: J, act: act };
    };
    const norma = (F) => Math.abs(F[0]) / N + (Math.abs(F[1]) + Math.abs(F[2])) / (N * Math.max(B, L));
    const resuelve3 = (J, F) => {
      /* Cramer: es un 3×3 simétrico definido positivo mientras haya contacto */
      const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      const D = det(J);
      const col = (k) => J.map((fila, r) => fila.map((v, j) => (j === k ? -F[r] : v)));
      return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
    };
    let R = resid(a, b, c), it = 0;
    while (norma(R.F) > 1e-10 && it < 100) {
      const dx = resuelve3(R.J, R.F);
      let t = 1, Rn;
      for (let k = 0; k < 30; k++) {
        Rn = resid(a + t * dx[0], b + t * dx[1], c + t * dx[2]);
        if (Rn.act > 0 && norma(Rn.F) < norma(R.F)) break;
        t /= 2;
      }
      a += t * dx[0]; b += t * dx[1]; c += t * dx[2];
      R = Rn; it++;
    }
    const conv = norma(R.F) <= 1e-6;
    return { N: N, e: ex, ey: ey, forma: "plano truncado", qmax: qmaxDe(a, b, c), qmin: 0,
      contacto: R.act / (n * n), iteraciones: it, convergio: conv,
      q2: (x, y) => Math.max(0, a + b * x + c * y), nx: 40, ny: 40, malla: n };
  }

  /* ∫∫ f dx dy sobre un rectángulo, Simpson en las dos direcciones */
  function integra2(f, x0, x1, y0, y1, nx, ny) {
    if (!(x1 > x0) || !(y1 > y0)) return 0;
    return integraN((y) => integraN((x) => f(x, y), x0, x1, nx), y0, y1, ny);
  }
  function integraN(f, a, b, n) {
    const m = n % 2 ? n + 1 : n, h0 = (b - a) / m;
    let s0 = f(a) + f(b);
    for (let i = 1; i < m; i++) s0 += f(a + i * h0) * (i % 2 ? 4 : 2);
    return s0 * h0 / 3;
  }

  /* ∫ q(x)·f(x) dx entre a y b, por Simpson */
  function integra(f, a, b) {
    if (!(b > a)) return 0;
    const n = 400, h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  }

  /* =====================================================================
     2 · LAS CARGAS
     ===================================================================== */
  function estados(casos) {
    const por = (t) => casos.filter((c) => c.tipo === t);
    return { D: por("D")[0], techo: por("Lr").concat(por("S")), W: por("W"), E: por("E") };
  }

  /* Lo que le llega a la zapata desde una base: P hacia abajo, H, M · las
     reacciones son SOBRE la estructura, así que se cambian de signo */
  function deBase(caso, base) {
    const r = caso.reacciones[base];
    /* Hz: el cortante a lo largo.  En esa dirección la base de la columna es
       articulada, así que no llega momento: solo Hz (fila Z.longitudinal.articulada) */
    return { P: r.Ry_kgf, H: -r.Rx_kgf, M: -r.Mz_kgfcm, Hz: -(r.Rz_kgf || 0) };
  }
  function suma(partes, base) {
    const s = { P: 0, H: 0, M: 0, Hz: 0 };
    for (const [c, f] of partes) {
      const x = deBase(c, base);
      s.P += f * x.P; s.H += f * x.H; s.M += f * x.M; s.Hz += f * x.Hz;
    }
    return s;
  }

  /* Las combinaciones de servicio · fila Z.servicio */
  function combosServicio(est) {
    const L = [{ id: "D", partes: [[est.D, 1]], temporal: false }];
    for (const t of est.techo) L.push({ id: "D + " + t.id, partes: [[est.D, 1], [t, 1]], temporal: false });
    for (const w of est.W) {
      L.push({ id: "D + " + w.id, partes: [[est.D, 1], [w, 1]], temporal: true });
      for (const t of est.techo) {
        if (t.tipo === "S") continue;              /* nieve y viento no van juntos · N.no.viento */
        L.push({ id: "D + " + t.id + " + " + w.id, partes: [[est.D, 1], [t, 1], [w, 1]], temporal: true });
      }
    }
    for (const e of est.E) {
      L.push({ id: "D + 0,8·" + e.id, partes: [[est.D, 1], [e, SISMO_SUELO]], temporal: true });
      for (const t of est.techo) {
        if (t.tipo !== "S") continue;
        L.push({ id: "D + " + t.id + " + 0,8·" + e.id, partes: [[est.D, 1], [t, 1], [e, SISMO_SUELO]], temporal: true });
      }
    }
    return L;
  }

  /* Las de la E.060, con los estados físicos y solo la variante + (fila Z.signo) */
  function combosE060(est) {
    const casos = { D: true, Lr: est.techo.some((t) => t.tipo === "Lr"), S: est.techo.some((t) => t.tipo === "S"),
      W: est.W.length > 0, E: est.E.length > 0 };
    const fam = CB.paraConcreto({ casos: casos }).combinaciones.filter((c) => !/−$/.test(c.id));
    const mapa = { CM: [est.D], CV: est.techo, CVi: est.W, CS: est.E };
    const out = [];
    for (const c of fam) {
      let listas = [[]];
      let cm = 0;
      for (const [k, f] of c.terminos) {
        if (k === "CM") cm = f;
        const sts = mapa[k] || [];
        const nuevas = [];
        for (const l of listas) for (const s of sts) nuevas.push(l.concat([[s, Math.abs(f)]]));
        listas = nuevas;
      }
      for (const l of listas) {
        if (l.some(([s]) => s.tipo === "S") && l.some(([s]) => s.tipo === "W")) continue;
        out.push({ id: c.id.replace(/\+$/, "") + " · " + l.filter(([s]) => s.tipo !== "D").map(([s]) => s.id).join(" "),
          base: c.id.replace(/\+$/, ""), partes: l, factorCM: cm,
          lateral: l.some(([s]) => s.tipo === "W" || s.tipo === "E") });
      }
    }
    return out;
  }

  /* =====================================================================
     3 · UNA ZAPATA, VERIFICADA
     ===================================================================== */
  function verifica(d, dims) {
    const su = d.suelo, co = d.concreto, pe = d.pedestal;
    const B = dims.B_cm, L = dims.L_cm, h = dims.h_cm;
    const gc = E020.GAMMA_CONCRETO / 1e6;                     /* kgf/cm³ */
    const gr = su.gammaRelleno_kgfm3 / 1e6;
    const relleno = Math.max(0, su.Df_cm - h);                 /* lo que hay encima de la zapata */
    const altPed = relleno + (pe.sobreTerreno_cm || 0);
    const Wp = gc * pe.b_cm * pe.l_cm * altPed;
    const Wf = gc * B * L * h;
    const Wr = gr * (B * L - pe.b_cm * pe.l_cm) * relleno;
    const brazo = altPed + h;                                  /* del extremo del pedestal al fondo */
    const sigmaN = su.esNeta ? su.sigmaAdm_kgfcm2
      : su.sigmaAdm_kgfcm2 - gr * relleno - (su.sc_kgfm2 || 0) / 1e4;
    const est = estados(d.casos);
    const bases = Object.keys(d.casos[0].reacciones);

    /* ---- el suelo, en servicio ---- */
    let peorS = null;
    const servicio = [];
    for (const c of combosServicio(est)) {
      for (const b of bases) {
        const s = suma(c.partes, b);
        const N = s.P + Wp + Wf;
        const Mb = s.M - s.H * brazo;
        const e = -Mb / N, ey = s.Hz * brazo / N;
        const pr = presion2(N, e, ey, B, L);
        const adm = sigmaN * (c.temporal ? INC_TEMPORAL : 1);
        const ratio = pr.levanta || pr.vuelca ? Infinity : pr.qmax / adm;
        const Ht = Math.hypot(s.H, s.Hz);
        const fila = { combo: c.id, base: b, N: N, H: s.H, Hz: s.Hz, e: e, eL: e / L, ey: ey, eB: ey / B,
          forma: pr.forma || null,
          qmax: pr.qmax || null, admisible: adm, ratio: ratio, levanta: !!pr.levanta, vuelca: !!pr.vuelca,
          deslizamiento: (su.mu > 0 && Ht > 1e-6) ? su.mu * (N + Wr) / Ht : null };
        servicio.push(fila);
        if (!peorS || ratio > peorS.ratio) peorS = fila;
      }
    }

    /* ---- el levantamiento · 0,9·CM contra el viento y el sismo · fila Z.levantamiento ---- */
    let peorL = { ratio: 0, combo: null };
    const muertas = (b) => deBase(est.D, b).P + Wp + Wf + Wr;
    for (const b of bases) {
      for (const [lista, f, nom] of [[est.W, 1.25, "9-3"], [est.E, 1.0, "9-5"]]) {
        for (const x of lista) {
          const tira = -f * deBase(x, b).P;
          if (tira <= 0) continue;
          const ratio = tira / (0.9 * muertas(b));
          if (ratio > peorL.ratio) peorL = { ratio: ratio, combo: nom + " · " + x.id, base: b, tira: tira,
            sujeta: 0.9 * muertas(b) };
        }
      }
    }

    /* ---- el concreto, con cargas amplificadas ---- */
    const fc = co.fc_kgcm2, fyMPa = GRADOS[co.grado], fy = fyMPa * MPA;
    const db = BARRAS[co.barra];
    const dL = h - co.rec_cm - db / 2, dB = h - co.rec_cm - 1.5 * db;
    const c1 = pe.l_cm, c2 = pe.b_cm;                         /* c1 en la dirección del momento */
    const est2 = { flexL: null, flexB: null, cortL: null, cortB: null, punz: null, negL: null, negB: null };
    const peor = (k, x) => {
      const flex = k.indexOf("flex") === 0 || k === "negL" || k === "negB";
      if (!est2[k] || (flex ? x.Mu > est2[k].Mu : x.ratio > est2[k].ratio)) est2[k] = x;
    };
    const sinApoyo = [], vuelcoU = [];
    for (const c of combosE060(est)) {
      for (const b of bases) {
        const s = suma(c.partes, b);
        /* LA PRESIÓN, CON TODO EL PESO (fila Z.peso): pedestal, zapata y relleno con el
           factor de la muerta.  Sin ellos la resultante se iba hacia el borde y las
           combinaciones excéntricas —las que mandan en un galpón— parecían volcar. */
        const w = c.factorCM * (gc * h + gr * relleno);       /* lo que pesa sobre cada cm² del volado */
        const N = s.P + c.factorCM * (Wp + Wf + Wr);
        const Mb = s.M - s.H * brazo;
        const Mtop = s.M - s.H * altPed;                       /* lo que el pedestal le da a la zapata */
        const MtopZ = s.Hz * altPed;                           /* a lo largo: la base es articulada */
        const pr = presion2(N, -Mb / N, s.Hz * brazo / N, B, L);
        if (pr.levanta) { sinApoyo.push(c.id + " · " + b); continue; }
        /* con la carga amplificada la resultante cae fuera: no hay presión que la
           equilibre, y eso es una falla, no una combinación que se salta (fila Z.vuelco) */
        if (pr.vuelca) { vuelcoU.push({ combo: c.id, base: b, eL: pr.e / L, eB: (pr.ey || 0) / B }); continue; }
        const net = (x, y) => pr.q2(x, y) - w;                  /* el suelo menos el peso de encima */
        const I2 = (f, x0, x1, y0, y1) => integra2(f, x0, x1, y0, y1, pr.nx, pr.ny);
        /* flexión en la cara del pedestal, dirección L · el signo dice qué cara tracciona */
        const mDer = I2((x, y) => net(x, y) * (x - c1 / 2), c1 / 2, L / 2, -B / 2, B / 2);
        const mIzq = I2((x, y) => net(x, y) * (-c1 / 2 - x), -L / 2, -c1 / 2, -B / 2, B / 2);
        peor("flexL", { Mu: Math.max(0, mDer, mIzq), ratio: 0, combo: c.id, base: b });
        /* donde la base no apoya, el peso del volado lo dobla al revés: la cara de
           ARRIBA queda en tracción y hace falta parrilla superior */
        peor("negL", { Mu: Math.max(0, -mDer, -mIzq), ratio: 0, combo: c.id, base: b });
        /* dirección B, igual: con un solo momento el suelo reparte por igual en B, y sale lo de siempre */
        const mArr = I2((x, y) => net(x, y) * (y - c2 / 2), -L / 2, L / 2, c2 / 2, B / 2);
        const mAba = I2((x, y) => net(x, y) * (-c2 / 2 - y), -L / 2, L / 2, -B / 2, -c2 / 2);
        peor("flexB", { Mu: Math.max(0, mArr, mAba), ratio: 0, combo: c.id, base: b });
        peor("negB", { Mu: Math.max(0, -mArr, -mAba), ratio: 0, combo: c.id, base: b });
        /* cortante como viga, a d de la cara · fila Z.Vc.viga */
        const VuL = Math.max(Math.abs(I2(net, c1 / 2 + dL, L / 2, -B / 2, B / 2)),
          Math.abs(I2(net, -L / 2, -c1 / 2 - dL, -B / 2, B / 2)));
        const phiVcL = PHI_V * 0.17 * raizFc(fc) * B * dL;
        peor("cortL", { Vu: VuL, phiVc: phiVcL, ratio: VuL / phiVcL, combo: c.id, base: b });
        const VuB = Math.max(Math.abs(I2(net, -L / 2, L / 2, c2 / 2 + dB, B / 2)),
          Math.abs(I2(net, -L / 2, L / 2, -B / 2, -c2 / 2 - dB)));
        const phiVcB = PHI_V * 0.17 * raizFc(fc) * L * dB;
        peor("cortB", { Vu: VuB, phiVc: phiVcB, ratio: VuB / phiVcB, combo: c.id, base: b });
        /* punzonamiento con transferencia de momento · filas Z.punzon.* · fuera de la
           sección crítica: lo que empuja el suelo menos lo que pesa encima */
        const d = (dL + dB) / 2;
        const dentro = I2(pr.q2, -(c1 + d) / 2, (c1 + d) / 2, -(c2 + d) / 2, (c2 + d) / 2);
        const Vu = Math.max(0, N - dentro - w * (B * L - (c1 + d) * (c2 + d)));
        const bo = 2 * (c1 + c2 + 2 * d);
        const beta = Math.max(c1, c2) / Math.min(c1, c2);
        const vc = Math.min(0.17 * (1 + 2 / beta), 0.083 * (ALFA_S * d / bo + 2), 0.33) * raizFc(fc);
        const Ac = 2 * d * (c1 + c2 + 2 * d);
        /* el momento en cada dirección, con su γv y su Jc · fila Z.punzon.biaxial */
        const gvDe = (b1, b2) => 1 - 1 / (1 + (2 / 3) * Math.sqrt(b1 / b2));
        const JcDe = (b1, b2) => d * Math.pow(b1, 3) / 6 + b1 * Math.pow(d, 3) / 6 + d * b2 * b1 * b1 / 2;
        const gv = gvDe(c1 + d, c2 + d), gvZ = gvDe(c2 + d, c1 + d);
        const Jc = JcDe(c1 + d, c2 + d), JcZ = JcDe(c2 + d, c1 + d);
        const vu = Vu / Ac + gv * Math.abs(Mtop) * ((c1 + d) / 2) / Jc + gvZ * Math.abs(MtopZ) * ((c2 + d) / 2) / JcZ;
        peor("punz", { Vu: Vu, vu: vu, phivn: PHI_V * vc, ratio: vu / (PHI_V * vc), combo: c.id, base: b,
          gv: gv, Mt: Math.abs(Mtop), gvZ: gvZ, MtZ: Math.abs(MtopZ), bo: bo, d: d });
      }
    }

    /* ---- el acero de cada dirección ---- */
    const beta1 = fc / MPA <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.2 * (fc / MPA - 28) / 28);
    const rhoMin = fyMPa >= 420 ? 0.0018 : 0.0020;
    const rhob = 0.85 * beta1 * (fc / MPA) / fyMPa * (EPS_CU * ES_MPA / (EPS_CU * ES_MPA + fyMPa));
    const sMax = Math.min(3 * h, S_MAX_CM);
    const Ab = Math.PI * db * db / 4;
    const acero = (Mu, b, dd, sinMinimo) => {
      const k = 0.85 * fc * b;
      const disc = dd * dd - 2 * Mu / (PHI_F * k);
      if (disc < 0) return { insuficiente: true, Mu: Mu };
      const req = (k / fy) * (dd - Math.sqrt(disc));
      /* el mínimo es de la sección entera (§9.7.2): ya lo pone la parrilla de abajo */
      const min = sinMinimo ? 0 : rhoMin * b * h;
      const max = 0.75 * rhob * b * dd;
      const As = Math.max(req, min);
      const nAs = Math.max(2, Math.ceil(As / Ab));
      let n = nAs;
      let s = (b - 2 * co.rec_cm - db) / (n - 1);
      while (s > sMax + 1e-9) { n++; s = (b - 2 * co.rec_cm - db) / (n - 1); }
      /* lo que manda es lo que fija el número de barras: si la separación pide más, es ella */
      const manda = n > nAs ? "separación" : (req >= min ? "flexión" : "mínimo");
      return { Mu: Mu, d: dd, b: b, As_req: req, As_min: min, As_max: max, manda: manda,
        n: n, s: s, As: n * Ab, barra: co.barra, ratio: req / max, cumple: req <= max };
    };
    const aL = est2.flexL ? acero(est2.flexL.Mu, B, dL) : null;
    const aB = est2.flexB ? acero(est2.flexB.Mu, L, dB) : null;
    /* la parrilla de arriba, solo si hay momento negativo · con el mismo recubrimiento,
       que no baja de 70 mm: del lado seguro */
    const aSup = est2.negL && est2.negL.Mu > 0 ? acero(est2.negL.Mu, B, dL, true) : null;
    const aSupB = est2.negB && est2.negB.Mu > 0 ? acero(est2.negB.Mu, L, dB, true) : null;
    const betaZ = Math.max(B, L) / Math.min(B, L);
    const franja = betaZ > 1 + 1e-9 ? { gs: 2 / (betaZ + 1), ancho: Math.min(B, L),
      nota: "en la dirección corta, γs·As en una franja central del ancho del lado corto (fila Z.franja)" } : null;

    const hMin = SOBRE_ACERO_MIN + co.rec_cm + db;
    const avisos = [];
    if (sinApoyo.length) {
      avisos.push("en " + sinApoyo.length + " combinación(es) de la E.060 la zapata no apoya (se levanta o " +
        "vuelca): no se diseña el concreto con ellas, y el levantamiento ya lo dice");
    }
    const fallas = [];
    if (peorS.ratio > 1 + 1e-9) fallas.push("presión en el suelo");
    if (vuelcoU.length) fallas.push("vuelco con cargas amplificadas");
    if (peorL.ratio > 1 + 1e-9) fallas.push("levantamiento");
    for (const k of ["cortL", "cortB", "punz"]) if (est2[k] && est2[k].ratio > 1 + 1e-9) fallas.push(k);
    if (aL && (aL.insuficiente || !aL.cumple)) fallas.push("flexión L");
    if (aB && (aB.insuficiente || !aB.cumple)) fallas.push("flexión B");
    if (aSup && (aSup.insuficiente || !aSup.cumple)) fallas.push("flexión negativa");
    if (aSupB && (aSupB.insuficiente || !aSupB.cumple)) fallas.push("flexión negativa en B");
    if (h < hMin - 1e-9) fallas.push("peralte mínimo");
    if (co.rec_cm < REC_MIN - 1e-9) fallas.push("recubrimiento");
    /* el peralte que piden las barras del pedestal para anclarse · fila PD.anclaje.zapata */
    if (d.hMinPedestal_cm > 0 && h < d.hMinPedestal_cm - 1e-9) fallas.push("anclaje del pedestal");
    return {
      zapata: { B_cm: B, L_cm: L, h_cm: h }, pesos: { pedestal: Wp, zapata: Wf, relleno: Wr },
      sigmaN: sigmaN, altPedestal_cm: altPed,
      servicio: { peor: peorS, filas: servicio,
        deslizamiento: su.mu > 0 ? servicio.filter((x) => x.deslizamiento !== null)
          .reduce((a, x) => (!a || x.deslizamiento < a.deslizamiento ? x : a), null) : null },
      levantamiento: peorL, vuelcoAmplificado: vuelcoU,
      concreto: Object.assign({}, est2, { aceroL: aL, aceroB: aB, aceroSup: aSup, aceroSupB: aSupB, franja: franja, hMin: hMin,
        dL: dL, dB: dB, beta1: beta1, rhoMin: rhoMin, sMax: sMax }),
      fallas: fallas, cumple: !fallas.length, avisos: avisos
    };
  }

  /* =====================================================================
     4 · DISEÑAR · si no se dan medidas, se buscan
     ===================================================================== */
  function faltan(d) {
    const F = [];
    const su = d.suelo || {}, co = d.concreto || {}, pe = d.pedestal || {};
    if (!(su.sigmaAdm_kgfcm2 > 0)) F.push({ campo: "ci_sigma", que: "la presión admisible del estudio de suelos" });
    if (typeof su.esNeta !== "boolean") F.push({ campo: "ci_neta", que: "si esa presión es neta o bruta" });
    if (!(su.Df_cm > 0)) F.push({ campo: "ci_df", que: "la profundidad de desplante" });
    if (!(su.gammaRelleno_kgfm3 > 0)) F.push({ campo: "ci_gr", que: "el peso específico del relleno" });
    if (!(su.sc_kgfm2 >= 0)) F.push({ campo: "ci_sc", que: "la sobrecarga sobre el piso" });
    if (!(co.fc_kgcm2 > 0)) F.push({ campo: "ci_fc", que: "el f'c del concreto" });
    if (!GRADOS[co.grado]) F.push({ campo: "ci_grado", que: "el grado del acero de refuerzo" });
    if (!(co.rec_cm > 0)) F.push({ campo: "ci_rec", que: "el recubrimiento" });
    if (!BARRAS[co.barra]) F.push({ campo: "ci_barra", que: "la barra de la parrilla" });
    if (!(pe.b_cm > 0) || !(pe.l_cm > 0)) F.push({ campo: "ci_ped", que: "las medidas del pedestal" });
    if (!(pe.sobreTerreno_cm >= 0)) F.push({ campo: "ci_sobre", que: "cuánto sobresale el pedestal del terreno" });
    return F;
  }

  const PASO = 5;            /* cm, el paso con que se buscan las medidas */
  function arriba(x) { return Math.ceil(x / PASO - 1e-9) * PASO; }

  function disena(d) {
    exige(Array.isArray(d.casos) && d.casos.length, "disena() necesita los casos del análisis, con sus reacciones");
    const F = faltan(d);
    if (F.length) return { ok: false, faltan: F };
    const hMin = arriba(Math.max(SOBRE_ACERO_MIN + d.concreto.rec_cm + BARRAS[d.concreto.barra],
      d.hMinPedestal_cm || 0));
    let r;
    if (d.zapata && d.zapata.B_cm > 0 && d.zapata.L_cm > 0 && d.zapata.h_cm > 0) {
      r = verifica(d, d.zapata);
      r.auto = false;
    } else {
      /* el lado, para el suelo y el levantamiento; luego el peralte, para el concreto; y
         otra vuelta, porque el peralte cambia el peso y el brazo del momento */
      const ladoMin = arriba(Math.max(d.pedestal.b_cm, d.pedestal.l_cm) + 40);   /* el pedestal y 20 cm a cada lado */
      let lado = ladoMin, h = hMin, vueltas = 0;
      const sueloOk = (x) => x.servicio.peor.ratio <= 1 && x.levantamiento.ratio <= 1 && !x.vuelcoAmplificado.length;
      const concretoOk = (x) => ["cortL", "cortB", "punz"].every((k) => !x.concreto[k] || x.concreto[k].ratio <= 1) &&
        (!x.concreto.aceroL || (!x.concreto.aceroL.insuficiente && x.concreto.aceroL.cumple)) &&
        (!x.concreto.aceroB || (!x.concreto.aceroB.insuficiente && x.concreto.aceroB.cumple)) &&
        (!x.concreto.aceroSup || (!x.concreto.aceroSup.insuficiente && x.concreto.aceroSup.cumple)) &&
        (!x.concreto.aceroSupB || (!x.concreto.aceroSupB.insuficiente && x.concreto.aceroSupB.cumple)) &&
        x.fallas.indexOf("anclaje del pedestal") < 0;
      do {
        r = verifica(d, { B_cm: lado, L_cm: lado, h_cm: h });
        /* de 4 en 4 pasos hasta que cumpla, y luego de uno en uno hacia abajo hasta el mínimo: el
           mismo lado que subiendo de 5 en 5, con la cuarta parte de las vueltas */
        while (!sueloOk(r) && lado < 1500) { lado += 4 * PASO; r = verifica(d, { B_cm: lado, L_cm: lado, h_cm: h }); }
        while (lado - PASO >= ladoMin) {
          const r2 = verifica(d, { B_cm: lado - PASO, L_cm: lado - PASO, h_cm: h });
          if (!sueloOk(r2)) break;
          lado -= PASO; r = r2;
        }
        while (!concretoOk(r) && h < 300) { h += PASO; r = verifica(d, { B_cm: lado, L_cm: lado, h_cm: h }); }
        vueltas++;
      } while (!sueloOk(r) && vueltas < 5);
      r.auto = true;
    }
    r.ok = true;
    const aLoLargo = d.casos.some((c) => Object.keys(c.reacciones).some((b) => (c.reacciones[b].Rz_kgf || 0) !== 0));
    r.avisos = r.avisos.concat(aLoLargo ? [] : [
      "a esta zapata no le llega nada a lo largo: es la de un pórtico interior típico. Lo que baja por la " +
        "cruz de fachada y el viento de los hastiales van a las zapatas del paño arriostrado, de fachada y " +
        "de la columna hastial (filas Z.plano y ZT.tipos)"]).concat([
      "el anclaje de las barras de la parrilla (Cap. 12) no se comprueba aquí: con gancho en el extremo suele " +
        "bastar (fila Z.desarrollo)",
      "el lado del concreto del perno de anclaje sigue pendiente de norma (fila J.anclaje.concreto): el " +
        "peralte tiene que alojarlo"
    ]);
    if (!(d.suelo.mu > 0)) r.avisos.push("sin μ del estudio de suelos no se comprobó el deslizamiento (fila Z.deslizamiento)");
    return r;
  }

  return { ART, PHI_V, PHI_F, INC_TEMPORAL, SISMO_SUELO, REC_MIN, GRADOS, BARRAS,
    presion, presion2, integra, integra2, combosServicio, combosE060, estados, deBase, suma, verifica, faltan, disena };
});
