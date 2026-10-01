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
    "Z.rec", "Z.punzon.momento", "Z.desarrollo", "D.concreto.gamma", "N.no.viento", "J.anclaje.concreto"
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
    return { P: r.Ry_kgf, H: -r.Rx_kgf, M: -r.Mz_kgfcm };
  }
  function suma(partes, base) {
    const s = { P: 0, H: 0, M: 0 };
    for (const [c, f] of partes) {
      const x = deBase(c, base);
      s.P += f * x.P; s.H += f * x.H; s.M += f * x.M;
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
        const e = -Mb / N;
        const pr = presion(N, e, B, L);
        const adm = sigmaN * (c.temporal ? INC_TEMPORAL : 1);
        const ratio = pr.levanta || pr.vuelca ? Infinity : pr.qmax / adm;
        const fila = { combo: c.id, base: b, N: N, H: s.H, e: e, eL: e / L, forma: pr.forma || null,
          qmax: pr.qmax || null, admisible: adm, ratio: ratio, levanta: !!pr.levanta, vuelca: !!pr.vuelca,
          deslizamiento: (su.mu > 0 && Math.abs(s.H) > 1e-6) ? su.mu * (N + Wr) / Math.abs(s.H) : null };
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
    const est2 = { flexL: null, flexB: null, cortL: null, cortB: null, punz: null, negL: null };
    const peor = (k, x) => {
      const flex = k.indexOf("flex") === 0 || k === "negL";
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
        const pr = presion(N, -Mb / N, B, L);
        if (pr.levanta) { sinApoyo.push(c.id + " · " + b); continue; }
        /* con la carga amplificada la resultante cae fuera: no hay presión que la
           equilibre, y eso es una falla, no una combinación que se salta (fila Z.vuelco) */
        if (pr.vuelca) { vuelcoU.push({ combo: c.id, base: b, eL: pr.e / L }); continue; }
        const net = (x) => pr.q(x) - w;                         /* el suelo menos el peso de encima */
        /* flexión en la cara del pedestal, dirección L · el signo dice qué cara tracciona */
        const mDer = integra((x) => net(x) * (x - c1 / 2) * B, c1 / 2, L / 2);
        const mIzq = integra((x) => net(x) * (-c1 / 2 - x) * B, -L / 2, -c1 / 2);
        peor("flexL", { Mu: Math.max(0, mDer, mIzq), ratio: 0, combo: c.id, base: b });
        /* donde la base no apoya, el peso del volado lo dobla al revés: la cara de
           ARRIBA queda en tracción y hace falta parrilla superior */
        peor("negL", { Mu: Math.max(0, -mDer, -mIzq), ratio: 0, combo: c.id, base: b });
        /* dirección B: el suelo reparte N a lo largo de B por igual */
        const cB = (B - c2) / 2;
        const netoB = N - w * B * L;
        peor("flexB", { Mu: Math.max(0, netoB * cB * cB / (2 * B)), ratio: 0, combo: c.id, base: b });
        /* cortante como viga, a d de la cara · fila Z.Vc.viga */
        const VuL = Math.max(Math.abs(integra((x) => net(x) * B, c1 / 2 + dL, L / 2)),
          Math.abs(integra((x) => net(x) * B, -L / 2, -c1 / 2 - dL)));
        const phiVcL = PHI_V * 0.17 * raizFc(fc) * B * dL;
        peor("cortL", { Vu: VuL, phiVc: phiVcL, ratio: VuL / phiVcL, combo: c.id, base: b });
        const VuB = Math.abs(netoB) * Math.max(0, cB - dB) / B;
        const phiVcB = PHI_V * 0.17 * raizFc(fc) * L * dB;
        peor("cortB", { Vu: VuB, phiVc: phiVcB, ratio: VuB / phiVcB, combo: c.id, base: b });
        /* punzonamiento con transferencia de momento · filas Z.punzon.* · fuera de la
           sección crítica: lo que empuja el suelo menos lo que pesa encima */
        const d = (dL + dB) / 2;
        const dentro = integra((x) => pr.q(x) * (c2 + d), -(c1 + d) / 2, (c1 + d) / 2);
        const Vu = Math.max(0, N - dentro - w * (B * L - (c1 + d) * (c2 + d)));
        const bo = 2 * (c1 + c2 + 2 * d);
        const beta = Math.max(c1, c2) / Math.min(c1, c2);
        const vc = Math.min(0.17 * (1 + 2 / beta), 0.083 * (ALFA_S * d / bo + 2), 0.33) * raizFc(fc);
        const gf = 1 / (1 + (2 / 3) * Math.sqrt((c1 + d) / (c2 + d)));
        const Ac = 2 * d * (c1 + c2 + 2 * d);
        const Jc = d * Math.pow(c1 + d, 3) / 6 + (c1 + d) * Math.pow(d, 3) / 6 + d * (c2 + d) * Math.pow(c1 + d, 2) / 2;
        const vu = Vu / Ac + (1 - gf) * Math.abs(Mtop) * ((c1 + d) / 2) / Jc;
        peor("punz", { Vu: Vu, vu: vu, phivn: PHI_V * vc, ratio: vu / (PHI_V * vc), combo: c.id, base: b,
          gv: 1 - gf, Mt: Math.abs(Mtop), bo: bo, d: d });
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
    if (h < hMin - 1e-9) fallas.push("peralte mínimo");
    if (co.rec_cm < REC_MIN - 1e-9) fallas.push("recubrimiento");
    return {
      zapata: { B_cm: B, L_cm: L, h_cm: h }, pesos: { pedestal: Wp, zapata: Wf, relleno: Wr },
      sigmaN: sigmaN, altPedestal_cm: altPed,
      servicio: { peor: peorS, filas: servicio,
        deslizamiento: su.mu > 0 ? servicio.filter((x) => x.deslizamiento !== null)
          .reduce((a, x) => (!a || x.deslizamiento < a.deslizamiento ? x : a), null) : null },
      levantamiento: peorL, vuelcoAmplificado: vuelcoU,
      concreto: Object.assign({}, est2, { aceroL: aL, aceroB: aB, aceroSup: aSup, franja: franja, hMin: hMin,
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
    const hMin = arriba(SOBRE_ACERO_MIN + d.concreto.rec_cm + BARRAS[d.concreto.barra]);
    let r;
    if (d.zapata && d.zapata.B_cm > 0 && d.zapata.L_cm > 0 && d.zapata.h_cm > 0) {
      r = verifica(d, d.zapata);
      r.auto = false;
    } else {
      /* el lado, para el suelo y el levantamiento; luego el peralte, para el concreto; y
         otra vuelta, porque el peralte cambia el peso y el brazo del momento */
      let lado = arriba(Math.max(d.pedestal.b_cm, d.pedestal.l_cm) + 40), h = hMin, vueltas = 0;
      const sueloOk = (x) => x.servicio.peor.ratio <= 1 && x.levantamiento.ratio <= 1 && !x.vuelcoAmplificado.length;
      const concretoOk = (x) => ["cortL", "cortB", "punz"].every((k) => !x.concreto[k] || x.concreto[k].ratio <= 1) &&
        (!x.concreto.aceroL || (!x.concreto.aceroL.insuficiente && x.concreto.aceroL.cumple)) &&
        (!x.concreto.aceroB || (!x.concreto.aceroB.insuficiente && x.concreto.aceroB.cumple)) &&
        (!x.concreto.aceroSup || (!x.concreto.aceroSup.insuficiente && x.concreto.aceroSup.cumple));
      do {
        r = verifica(d, { B_cm: lado, L_cm: lado, h_cm: h });
        while (!sueloOk(r) && lado < 1500) { lado += PASO; r = verifica(d, { B_cm: lado, L_cm: lado, h_cm: h }); }
        while (!concretoOk(r) && h < 300) { h += PASO; r = verifica(d, { B_cm: lado, L_cm: lado, h_cm: h }); }
        vueltas++;
      } while (!sueloOk(r) && vueltas < 5);
      r.auto = true;
    }
    r.ok = true;
    r.avisos = r.avisos.concat([
      "solo llega el momento del plano del pórtico: los de la dirección longitudinal —arriostre de fachada, " +
        "viento en los hastiales— no están en el modelo (fila Z.plano)",
      "el anclaje de las barras de la parrilla (Cap. 12) no se comprueba aquí: con gancho en el extremo suele " +
        "bastar (fila Z.desarrollo)",
      "el lado del concreto del perno de anclaje sigue pendiente de norma (fila J.anclaje.concreto): el " +
        "peralte tiene que alojarlo"
    ]);
    if (!(d.suelo.mu > 0)) r.avisos.push("sin μ del estudio de suelos no se comprobó el deslizamiento (fila Z.deslizamiento)");
    return r;
  }

  return { ART, PHI_V, PHI_F, INC_TEMPORAL, SISMO_SUELO, REC_MIN, GRADOS, BARRAS,
    presion, integra, combosServicio, combosE060, estados, verifica, faltan, disena };
});
