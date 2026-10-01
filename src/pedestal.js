/* =====================================================================
   pedestal.js — E8: el pedestal de concreto entre la placa base y la zapata

   EN UN GALPÓN EL PEDESTAL ES UNA COLUMNA CORTA A FLEXOCOMPRESIÓN, no un
   dado.  La columna de acero empotrada le deja un momento grande y poca
   carga, el viento lo puede poner en tracción, y el cortante de la base se
   lleva por toda su altura hasta la junta con la zapata.  Se comprueba:
     · la flexocompresión arriba y en la junta, con la curva de interacción
       de §10.2 (fila PD.compatibilidad), el tope de 0,80·φPo (PD.Pnmax) y
       la transición de φ en φPn (Z.phi.compresion)
     · la cuantía, las barras que caben y el recubrimiento
     · el cortante con la carga axial, y los estribos
     · el cortante-fricción en la junta (PD.friccion)
     · el ANCLAJE DE LAS BARRAS EN LA ZAPATA (PD.anclaje.zapata): en un
       galpón empotrado las barras traccionan, manda el gancho, y eso le
       pide peralte a la zapata.  Es el dato que vuelve a zapatas.js.

   UNIDADES: kgf, cm, kgf/cm².  Las ecuaciones de la E.060 están en MPa y
   se convierten exactas con unidades.js.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./unidades.js"), require("./e020.js"));
  } else {
    raiz.PEDESTAL = definir(raiz.INVENTARIO, raiz.UNIDADES, raiz.E020);
  }
})(typeof self !== "undefined" ? self : this, function (INV, UN, E020) {
  "use strict";

  const ART = INV.declara("pedestal.js", [
    "PD.definicion", "PD.esbeltez", "PD.rho", "PD.Pnmax", "PD.compatibilidad", "PD.Vc", "PD.Vs",
    "PD.estribos", "PD.rec", "PD.separacion", "PD.friccion", "PD.friccion.Avf", "PD.ldc", "PD.ldg",
    "PD.anclaje.zapata", "PD.cargas", "PD.cap21", "Z.phi.compresion", "Z.phi.corte", "Z.bloque",
    "Z.As.max", "Z.dowels.min", "Z.dowels.traccion", "Z.lateral", "D.concreto.gamma",
    "J.anclaje.E060.confinamiento"
  ]);

  const MPA = UN.MPA_KGCM2;
  const EPS_CU = 0.003, ES_MPA = 200000;                /* §10.2.3 y §8.7.3 · fila Z.As.max */
  const PHI_C = 0.70, PHI_T = 0.90, PHI_V = 0.85;       /* §9.3.2.2 y §9.3.2.3 */
  const GRADOS = { "60": 420, "40": 280 };              /* MPa */
  const FY_MAX_CORTE = 420;                             /* MPa · §11.5.2 y §11.7.6 */
  const BARRAS = { "1/2": 1.27, "5/8": 1.5875, "3/4": 1.905, "1": 2.54 };   /* cm, nominal */
  const ESTRIBOS = { "8mm": 0.8, "3/8": 0.9525, "1/2": 1.27 };
  const MU = { monolitico: 1.4, rugosa: 1.0, lisa: 0.6 }; /* §11.7.4.3, λ = 1 */
  const K_VOLADIZO = 2;                                 /* fila PD.esbeltez */

  function exige(c, msg) { if (!c) throw new Error("pedestal: " + msg); }
  const raizFc = (fc) => Math.sqrt(fc / MPA) * MPA;     /* √f'c como esfuerzo en kgf/cm² */

  /* =====================================================================
     1 · LA SECCIÓN · b fuera del plano, l en el plano del pórtico (el
     momento la flexiona en l).  Las barras van repartidas por el perímetro:
     nb en cada cara de ancho b (con las esquinas) y ns en cada cara de
     largo l, sin las esquinas.
     ===================================================================== */
  function seccion(d) {
    const db = BARRAS[d.barra], dt = ESTRIBOS[d.estribo];
    exige(db, "la barra es " + Object.keys(BARRAS).join(", ") + ", no «" + d.barra + "»");
    exige(dt, "el estribo es " + Object.keys(ESTRIBOS).join(", ") + ", no «" + d.estribo + "»");
    exige(d.n >= 4 && d.n % 2 === 0, "hacen falta al menos 4 barras y en número par (§10.9.2)");
    const c = d.rec_cm + dt + db / 2;                   /* al eje de las barras */
    const bi = d.b_cm - 2 * c, li = d.l_cm - 2 * c;
    exige(bi > 0 && li > 0, "con ese recubrimiento las barras no caben en el pedestal");
    /* reparto por el perímetro, lo más parejo posible */
    let nb = Math.max(2, Math.round(d.n * bi / (2 * (bi + li))) + 1);
    if (2 * nb > d.n) nb = d.n / 2;
    const ns = (d.n - 2 * nb) / 2;
    const Ab = Math.PI * db * db / 4;
    const barras = [];
    for (let i = 0; i < nb; i++) {
      const x = nb > 1 ? -bi / 2 + bi * i / (nb - 1) : 0;
      barras.push({ x: x, y: li / 2, As: Ab }, { x: x, y: -li / 2, As: Ab });
    }
    for (let j = 1; j <= ns; j++) {
      const y = -li / 2 + li * j / (ns + 1);
      barras.push({ x: -bi / 2, y: y, As: Ab }, { x: bi / 2, y: y, As: Ab });
    }
    /* la distancia libre más chica entre barras vecinas · fila PD.separacion */
    const sb = nb > 1 ? bi / (nb - 1) - db : Infinity;
    const sl = li / (ns + 1) - db;
    return { b_cm: d.b_cm, l_cm: d.l_cm, barra: d.barra, estribo: d.estribo, db_cm: db, dt_cm: dt, aEje_cm: c, nb: nb, ns: ns, n: d.n,
      Ab_cm2: Ab, Ast_cm2: d.n * Ab, Ag_cm2: d.b_cm * d.l_cm, barras: barras,
      libre_cm: Math.min(sb, sl), dEf_cm: d.l_cm - c };
  }

  /* =====================================================================
     2 · LA CURVA DE INTERACCIÓN · fila PD.compatibilidad
     y se mide desde el centro hacia la cara comprimida.
     ===================================================================== */
  function estado(sec, fc, fyMPa, c) {
    const fy = fyMPa * MPA, Es = ES_MPA * MPA, l = sec.l_cm;
    const beta1 = fc / MPA <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.2 * (fc / MPA - 28) / 28);
    const a = Math.min(beta1 * c, l);
    let P = 0.85 * fc * a * sec.b_cm, M = 0.85 * fc * a * sec.b_cm * (l / 2 - a / 2);
    let epsExtremo = Infinity;
    for (const s of sec.barras) {
      const prof = l / 2 - s.y;                          /* desde la cara comprimida */
      const eps = EPS_CU * (c - prof) / c;
      epsExtremo = Math.min(epsExtremo, eps);
      let fs = Math.max(-fy, Math.min(fy, Es * eps));
      if (prof < a) fs -= 0.85 * fc;                     /* el concreto que la barra desplaza */
      P += s.As * fs;
      M += s.As * fs * s.y;
    }
    return { c: c, a: a, Pn: P, Mn: M, epsExtremo: epsExtremo };
  }

  function curva(sec, fc, fyMPa) {
    const fy = fyMPa * MPA, Es = ES_MPA * MPA;
    const Po = 0.85 * fc * (sec.Ag_cm2 - sec.Ast_cm2) + fy * sec.Ast_cm2;
    const phiPnMax = 0.80 * PHI_C * Po;                  /* ec. 10-2 · fila PD.Pnmax */
    const Pnt = fy * sec.Ast_cm2;
    /* el balanceado: la barra extrema en tracción justo en fy */
    const dt = sec.l_cm / 2 + Math.max.apply(null, sec.barras.map((s) => -s.y));
    const cb = EPS_CU * dt / (EPS_CU + fy / Es);
    const Pb = estado(sec, fc, fyMPa, cb).Pn;
    const Plim = Math.min(0.1 * fc * sec.Ag_cm2, PHI_C * Pb);
    /* φ · fila Z.phi.compresion: 0,9 − 0,2·φPn/Plim, despejado */
    const phi = (Pn) => {
      if (Pn <= 0) return PHI_T;
      if (Plim <= 0 || PHI_C * Pn >= Plim) return PHI_C;
      return 0.9 / (1 + 0.2 * Pn / Plim);
    };
    const puntos = [];
    const l = sec.l_cm;
    const punto = (c) => {
      const s = estado(sec, fc, fyMPa, c);
      const f = phi(s.Pn);
      return Object.assign(s, { phi: f, phiPn: Math.min(f * s.Pn, phiPnMax), phiMn: f * s.Mn });
    };
    for (let i = 0; i <= 240; i++) puntos.push(punto(6 * l * Math.pow(0.005 / 6, i / 240)));   /* de 6·l a 0,005·l */
    /* los dos extremos de la curva: compresión pura topada y tracción pura */
    puntos.unshift({ c: Infinity, Pn: Po, Mn: 0, phi: PHI_C, phiPn: phiPnMax, phiMn: 0, epsExtremo: EPS_CU });
    puntos.push({ c: 0, Pn: -Pnt, Mn: 0, phi: PHI_T, phiPn: -PHI_T * Pnt, phiMn: 0, epsExtremo: -Infinity });
    return { puntos: puntos, punto: punto, Po: Po, phiPnMax: phiPnMax, Pnt: Pnt, phiPnt: PHI_T * Pnt, Pb: Pb, Plim: Plim,
      art: ART["PD.compatibilidad"], artPnmax: ART["PD.Pnmax"], artPhi: ART["Z.phi.compresion"] };
  }

  /* El ratio por el rayo: la demanda entre la capacidad en la misma dirección */
  function ratioPM(cv, Pu, Mu) {
    const M = Math.abs(Mu);
    if (Math.abs(Pu) < 1e-9 && M < 1e-9) return { ratio: 0, punto: null };
    let mejor = null;
    const p = cv.puntos;
    for (let i = 0; i < p.length - 1; i++) {
      const x1 = p[i].phiMn, y1 = p[i].phiPn, x2 = p[i + 1].phiMn, y2 = p[i + 1].phiPn;
      /* s·(M, Pu) = (x1, y1) + t·(x2 − x1, y2 − y1) */
      const det = M * (y1 - y2) - Pu * (x1 - x2);
      if (Math.abs(det) < 1e-12) continue;
      const s = (x1 * (y1 - y2) - y1 * (x1 - x2)) / det;
      const t = (M * y1 - Pu * x1) / det;
      if (s > 0 && t >= -1e-9 && t <= 1 + 1e-9 && (!mejor || s < mejor.s)) {
        mejor = { s: s, t: t, i: i };
      }
    }
    exige(mejor, "la demanda no corta la curva de interacción (P = " + Pu + ", M = " + M + ")");
    const a = p[mejor.i], b = p[mejor.i + 1];
    /* LA CUERDA NO ES LA CURVA: entre dos puntos la curva es convexa y la cuerda
       queda por dentro, así que el corte con la cuerda da un ratio algo alto.  Si
       el tramo es de la curva de verdad, se afina el eje neutro por bisección hasta
       que el punto caiga sobre el rayo. */
    if (cv.punto && isFinite(a.c) && b.c > 0) {
      const lado = (q) => q.phiMn * Pu - q.phiPn * M;      /* signo del producto cruz */
      let c1 = a.c, c2 = b.c, s1 = lado(a);
      for (let k = 0; k < 60; k++) {
        const cm = Math.sqrt(c1 * c2), q = cv.punto(cm);
        if ((lado(q) > 0) === (s1 > 0)) { c1 = cm; s1 = lado(q); } else c2 = cm;
      }
      const q = cv.punto(Math.sqrt(c1 * c2));
      const cap = Math.hypot(q.phiMn, q.phiPn), dem = Math.hypot(M, Pu);
      return { ratio: dem / cap, capacidad: { phiPn: q.phiPn, phiMn: q.phiMn }, c_cm: q.c,
        traccionaBarras: q.epsExtremo < 0 };
    }
    const eps = a.epsExtremo === -Infinity || b.epsExtremo === -Infinity ? -1
      : a.epsExtremo + mejor.t * (b.epsExtremo - a.epsExtremo);
    return { ratio: 1 / mejor.s, capacidad: { phiPn: Pu * mejor.s, phiMn: M * mejor.s },
      traccionaBarras: eps < 0 || (a.epsExtremo === -Infinity) || (b.epsExtremo === -Infinity) };
  }

  /* =====================================================================
     3 · EL PEDESTAL ENTERO
     d = { b_cm, l_cm, altura_cm, fc_kgcm2, grado, barra, estribo, rec_cm,
           junta, n?, solicitaciones: [{ id, base, P_kgf, M_kgfcm, H_kgf,
           factorCM }], zapata: { h_cm, rec_cm, barra_cm, B_cm, L_cm } }
     P es + compresión; M y H son los de la base de la columna de acero.
     ===================================================================== */
  function faltan(d) {
    const F = [];
    if (!(d.b_cm > 0) || !(d.l_cm > 0)) F.push({ campo: "ci_pedb", que: "las medidas del pedestal" });
    if (!(d.fc_kgcm2 > 0)) F.push({ campo: "ci_fc", que: "el f'c del concreto" });
    if (!GRADOS[d.grado]) F.push({ campo: "ci_grado", que: "el grado del acero de refuerzo" });
    if (!BARRAS[d.barra]) F.push({ campo: "ci_pbarra", que: "la barra longitudinal del pedestal" });
    if (!ESTRIBOS[d.estribo]) F.push({ campo: "ci_pest", que: "el estribo del pedestal" });
    if (!(d.rec_cm > 0)) F.push({ campo: "ci_prec", que: "el recubrimiento del pedestal" });
    if (!MU[d.junta]) F.push({ campo: "ci_junta", que: "cómo se vacía el pedestal sobre la zapata (la junta)" });
    return F;
  }

  function verifica(d) {
    const fc = d.fc_kgcm2, fyMPa = GRADOS[d.grado], fy = fyMPa * MPA;
    exige(d.altura_cm > 0, "verifica() necesita la altura del pedestal");
    exige(Array.isArray(d.solicitaciones) && d.solicitaciones.length, "verifica() necesita las solicitaciones");
    const sec = seccion(d);
    const cv = curva(sec, fc, fyMPa);
    const gc = E020.GAMMA_CONCRETO / 1e6;
    const Wp = gc * sec.Ag_cm2 * d.altura_cm;
    const fallas = [], avisos = [];

    /* ---- la esbeltez · filas PD.definicion y PD.esbeltez ---- */
    const relacion = d.altura_cm / Math.min(d.b_cm, d.l_cm);
    const esbeltez = { relacion: relacion, esPedestal: relacion <= 3, art: ART["PD.definicion"] };
    if (!esbeltez.esPedestal) {
      esbeltez.kLr_plano = K_VOLADIZO * d.altura_cm / (0.3 * d.l_cm);
      esbeltez.kLr_fuera = K_VOLADIZO * d.altura_cm / (0.3 * d.b_cm);
      esbeltez.cumple = Math.max(esbeltez.kLr_plano, esbeltez.kLr_fuera) < 22;
      esbeltez.artEsbeltez = ART["PD.esbeltez"];
      if (!esbeltez.cumple) fallas.push("esbeltez");
    }

    /* ---- la cuantía, las barras y el recubrimiento ---- */
    const rho = sec.Ast_cm2 / sec.Ag_cm2;
    const cuantia = { rho: rho, min: 0.01, max: 0.06, cumple: rho >= 0.01 - 1e-12 && rho <= 0.06 + 1e-12,
      art: ART["PD.rho"] };
    if (!cuantia.cumple) fallas.push("cuantía");
    const libreMin = Math.max(1.5 * sec.db_cm, 4.0);
    const separacion = { libre_cm: sec.libre_cm, minimo_cm: libreMin, cumple: sec.libre_cm >= libreMin - 1e-9,
      art: ART["PD.separacion"] };
    if (!separacion.cumple) fallas.push("las barras no caben");
    const recBarra = d.barra === "3/4" || d.barra === "1" ? 5.0 : 4.0;
    const recubrimiento = { estribo_cm: d.rec_cm, minEstribo_cm: 4.0, barra_cm: d.rec_cm + sec.dt_cm,
      minBarra_cm: recBarra, art: ART["PD.rec"] };
    recubrimiento.cumple = d.rec_cm >= 4.0 - 1e-9 && d.rec_cm + sec.dt_cm >= recBarra - 1e-9;
    if (!recubrimiento.cumple) fallas.push("recubrimiento");

    /* ---- la flexocompresión, arriba y en la junta ---- */
    let peorPM = null, traccionaEnJunta = false, peorCorte = null, peorFriccion = null;
    const Ac = sec.Ag_cm2;
    const dEf = sec.dEf_cm, bw = d.b_cm;
    for (const s of d.solicitaciones) {
      const fCM = s.factorCM === undefined ? 1 : s.factorCM;
      const Pb = s.P_kgf + fCM * Wp;
      const Mb = s.M_kgfcm - s.H_kgf * d.altura_cm;
      for (const [donde, P, M] of [["arriba", s.P_kgf, s.M_kgfcm], ["junta", Pb, Mb]]) {
        const r = ratioPM(cv, P, M);
        if (donde === "junta" && r.traccionaBarras) traccionaEnJunta = true;
        if (!peorPM || r.ratio > peorPM.ratio) {
          peorPM = { ratio: r.ratio, donde: donde, combo: s.id, base: s.base, Pu_kgf: P, Mu_kgfcm: Math.abs(M),
            capacidad: r.capacidad };
        }
      }
      /* ---- el cortante · filas PD.Vc ---- */
      const NuMPa = Pb / Ac / MPA;
      const Vc = (NuMPa >= 0 ? 0.17 * (1 + NuMPa / 14) : Math.max(0, 0.17 * (1 + 0.29 * NuMPa))) *
        raizFc(fc) * bw * dEf;
      const Vu = Math.abs(s.H_kgf);
      if (!peorCorte || Vu / (PHI_V * Vc || 1e-9) > peorCorte.Vu / (PHI_V * peorCorte.Vc || 1e-9)) {
        peorCorte = { Vu: Vu, Vc: Vc, Nu_kgf: Pb, combo: s.id, base: s.base };
      }
      /* ---- el cortante-fricción en la junta · filas PD.friccion ---- */
      const fyv = Math.min(fyMPa, FY_MAX_CORTE) * MPA;
      const Avf = sec.Ast_cm2 - sec.nb * sec.Ab_cm2;     /* fila PD.friccion.Avf */
      const Nt = Math.max(0, -Pb);
      const AvfEf = Math.max(0, Avf - Nt / (PHI_V * fyv));
      const Vn = Math.min(MU[d.junta] * AvfEf * fyv, 0.2 * fc * Ac, 5.5 * MPA * Ac);
      const rf = Vu / (PHI_V * Vn || 1e-9);
      if (!peorFriccion || rf > peorFriccion.ratio) {
        peorFriccion = { ratio: Vu > 0 ? rf : 0, Vu: Vu, phiVn: PHI_V * Vn, Avf_cm2: Avf, AvfEficaz_cm2: AvfEf,
          Nt_kgf: Nt, mu: MU[d.junta], combo: s.id, base: s.base, art: ART["PD.friccion"],
          artAvf: ART["PD.friccion.Avf"] };
      }
    }
    if (peorPM.ratio > 1 + 1e-9) fallas.push("flexocompresión");
    if (peorFriccion.ratio > 1 + 1e-9) fallas.push("cortante en la junta");

    /* ---- los estribos · filas PD.Vs y PD.estribos ---- */
    const At = Math.PI * sec.dt_cm * sec.dt_cm / 4, Av = 2 * At;
    const fyt = Math.min(fyMPa, FY_MAX_CORTE) * MPA;
    const minEstribo = sec.db_cm <= BARRAS["5/8"] + 1e-9 ? 0.8 : 0.9525;
    const sComp = Math.min(16 * sec.db_cm, 48 * sec.dt_cm, Math.min(d.b_cm, d.l_cm));
    const c = peorCorte;
    const phiVc = PHI_V * c.Vc;
    const Vs = Math.max(0, c.Vu / PHI_V - c.Vc);
    const rf = raizFc(fc);
    let sMax = sComp, porQue = "como elemento en compresión (§7.10.5.2)";
    const necesita = c.Vu > 0.5 * phiVc;
    if (necesita) {
      const mitad = Vs > 0.33 * rf * bw * dEf;
      const sCorte = (mitad ? 0.5 : 1) * Math.min(dEf / 2, 60);
      const avmin = Math.max(0.062 * rf, 0.35 * MPA);
      const sAvmin = Av * fyt / (avmin * bw);
      const sVs = Vs > 0 ? Av * fyt * dEf / Vs : Infinity;
      const s = Math.min(sComp, sCorte, sAvmin, sVs);
      if (s < sComp) porQue = s === sVs ? "por el cortante (ec. 11-15)" : (s === sCorte ? "por d/2 (§11.5.5.1)" : "por Av,min (ec. 11-13)");
      sMax = s;
    }
    const sPuesto = Math.floor(sMax + 1e-9);
    const VsMax = 0.66 * rf * bw * dEf;
    const estribos = { estribo: d.estribo, Av_cm2: Av, s_cm: sPuesto, porQue: porQue,
      minDiametro_cm: minEstribo, diametroCumple: sec.dt_cm >= minEstribo - 1e-9,
      Vu: c.Vu, phiVc: phiVc, Vs: Vs, VsMax: VsMax, combo: c.combo, base: c.base,
      cumple: sPuesto >= 1 && Vs <= VsMax + 1e-9 && sec.dt_cm >= minEstribo - 1e-9,
      arriba: "al menos 2 estribos de 1/2\" o 3 de 3/8\" en los 125 mm superiores, rodeando los pernos y " +
        "4 barras verticales (fila J.anclaje.E060.confinamiento)",
      art: ART["PD.Vs"], artEstribos: ART["PD.estribos"], artVc: ART["PD.Vc"],
      artArriba: ART["J.anclaje.E060.confinamiento"] };
    if (!estribos.cumple) fallas.push("estribos");

    /* ---- el anclaje en la zapata · filas PD.ldc, PD.ldg y PD.anclaje.zapata ---- */
    const sq = Math.sqrt(fc / MPA);
    const ldc = Math.max(Math.max(0.24 * fyMPa / sq, 0.043 * fyMPa) * sec.db_cm, 20);
    const ldg = Math.max(0.24 * fyMPa / sq * sec.db_cm, 8 * sec.db_cm, 15);
    const ell = traccionaEnJunta ? ldg : ldc;
    const anclaje = { ldc_cm: ldc, ldg_cm: ldg, manda: traccionaEnJunta ? "gancho en tracción" : "compresión",
      l_cm: ell, art: ART["PD.anclaje.zapata"], artLdc: ART["PD.ldc"], artLdg: ART["PD.ldg"],
      dowels: { Ast_cm2: sec.Ast_cm2, min_cm2: 0.005 * sec.Ag_cm2,
        cumple: sec.Ast_cm2 >= 0.005 * sec.Ag_cm2 - 1e-9, art: ART["Z.dowels.min"] } };
    if (d.zapata) {
      anclaje.hMin_cm = ell + d.zapata.rec_cm + 2 * d.zapata.barra_cm;
      anclaje.cumple = d.zapata.h_cm >= anclaje.hMin_cm - 1e-9;
      if (!anclaje.cumple) fallas.push("anclaje en la zapata");
    }

    avisos.push("las combinaciones del pedestal son las de la E.060 con los casos de primer orden: el " +
      "segundo orden del pórtico (B2) no entra (fila PD.cargas)");
    avisos.push("el Capítulo 21 (disposiciones sísmicas para el concreto) no se comprueba (fila PD.cap21)");
    return {
      seccion: sec, curva: cv, peso_kgf: Wp, esbeltez: esbeltez, cuantia: cuantia, separacion: separacion,
      recubrimiento: recubrimiento, flexocompresion: Object.assign(peorPM, { art: ART["PD.compatibilidad"] }),
      friccion: peorFriccion, estribos: estribos, anclaje: anclaje,
      fallas: fallas, cumple: !fallas.length, avisos: avisos
    };
  }

  /* Diseñar: desde el 1 % y en número par, hasta que la flexocompresión
     cumpla o se pase del 6 % */
  function disena(d) {
    const F = faltan(d);
    if (F.length) return { ok: false, faltan: F };
    const Ab = Math.PI * Math.pow(BARRAS[d.barra], 2) / 4;
    let n = d.n || Math.max(4, 2 * Math.ceil(0.01 * d.b_cm * d.l_cm / Ab / 2));
    let r = verifica(Object.assign({}, d, { n: n }));
    while (!d.n && r.flexocompresion.ratio > 1 && r.cuantia.rho < 0.06) {
      n += 2;
      r = verifica(Object.assign({}, d, { n: n }));
    }
    r.ok = true;
    r.auto = !d.n;
    return r;
  }

  return { ART, GRADOS, BARRAS, ESTRIBOS, MU, PHI_C, PHI_T, seccion, estado, curva, ratioPM,
    faltan, verifica, disena };
});
