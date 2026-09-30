/* =====================================================================
   e030.js — E.030-2026 · sismo

   Tercera pieza de E2.

       V = Z · U · C · S · P / R          cortante en la base (Art. 34.1)
       Fi = αi · V                        reparto en altura (Art. 35.1)
       δ  = δanálisis · 0,75R ó 0,85R      desplazamientos (Art. 50)

   CUATRO TRAMPAS QUE ESTA NORMA LE PONE A UN GALPÓN, Y LAS CUATRO ESTÁN
   AQUÍ COMO GUARDA, NO COMO COMENTARIO:

   1) EL C DEL ANÁLISIS ESTÁTICO NO ES EL DEL ESPECTRO.  La rampa del primer
      tramo es nueva en 2026: C sube de 1,0 a 2,5 entre T = 0 y T = 0,2·TP.
      Un galpón es corto y rígido, así que cae justo en esa rampa y el
      espectro le daría C < 2,5.  Pero el Art. 18.3 y el 34.1 dicen dos veces
      que para la CORTANTE BASAL ESTÁTICA se usa C = 2,5 en todo 0 ≤ T ≤ TP.
      Usar el C del espectro en un cálculo estático subestima la fuerza, y el
      resultado sale convincente.  Son dos funciones distintas a propósito:
      factorC() y factorCestatico().

   2) LOS DESPLAZAMIENTOS HAY QUE AMPLIFICARLOS.  El análisis se hace con
      fuerzas reducidas por R, así que sus desplazamientos también lo están.
      Omitir el 0,75R divide la deriva por 3 con R = 4 y por 6 con R = 8: la
      deriva saldría «cumple» siempre.  Es el paso que más se olvida.

   3) PERO A LOS DESPLAZAMIENTOS NO SE LES APLICAN LOS MÍNIMOS.  Ni el
      C/R ≥ 0,11 del Art. 34.2 ni la cortante mínima del Art. 44.  Son
      mínimos de resistencia, no de rigidez (Art. 50.3).

   4) S, TP Y TL SE INTERPOLAN, Y EL SENTIDO NO ES ADIVINABLE porque TP crece
      mientras TL decrece a lo largo del mismo intervalo.  La dirección está
      demostrada por la continuidad de las tablas de la norma (fila S.interp)
      y la prueba la vuelve a demostrar cada vez que corre.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.E030 = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("e030.js", [
    "S.V", "S.Z", "S.U", "S.perfil", "S.S", "S.TP.TL", "S.sinVs30", "S.interp",
    "S.C", "S.C.estatico", "S.CR", "S.R0", "S.pendulo", "S.R", "S.aisc341",
    "S.P", "S.T", "S.CT", "S.T.rayleigh", "S.Fi", "S.k",
    "S.despl", "S.despl.min", "S.deriva", "S.deriva.industrial"
  ]);

  /* ---------- Tabla N° 1 · factor de zona ------------------------------- */
  const Z = { Z4: 0.45, Z3: 0.35, Z2: 0.25, Z1: 0.10 };

  /* ---------- Tabla N° 7 · factor de uso -------------------------------- */
  /* Para un galpón la categoría NO es obvia y cambia la fuerza un 50 %: un
     almacén corriente es C, un centro de reuniones cae en B, y un depósito de
     materiales inflamables o tóxicos está listado en A2. */
  const U = { A: 1.5, B: 1.3, C: 1.0 };

  /* ---------- Tabla N° 3 · intervalos de V̄s30 (m/s) -------------------- */
  const VS30 = {
    S0: { min: 800, max: Infinity },
    S1: { min: 550, max: 800 },
    S2: { min: 350, max: 550 },
    S3: { min: 200, max: 350 },
    S4: { min: 0,   max: 200 }
  };

  /* ---------- Tabla N° 4 · factor de suelo S ---------------------------- */
  /* Un par [a, b] es un INTERVALO que se interpola.  `null` en Z4-S4 no es un
     hueco de la transcripción: la norma dice ahí «Requiere un análisis de
     respuesta de sitio», y el código para. */
  const TABLA_S = {
    Z4: { S0: 0.80, S1: 1.00, S2: [1.00, 1.10], S3: [1.10, 1.20], S4: null },
    Z3: { S0: 0.80, S1: 1.00, S2: [1.00, 1.15], S3: [1.15, 1.20], S4: 1.30 },
    Z2: { S0: 0.80, S1: 1.00, S2: [1.00, 1.30], S3: [1.30, 1.40], S4: 1.70 },
    Z1: { S0: 0.80, S1: 1.00, S2: [1.00, 1.30], S3: [1.30, 1.60], S4: 2.40 }
  };

  /* ---------- Tabla N° 5 · TP y TL -------------------------------------- */
  /* SOLO DEPENDEN DEL SUELO, no de la zona.  Y TP crece mientras TL decrece
     a lo largo del intervalo: ése es el sentido que hay que respetar. */
  const TABLA_TP = { S0: 0.3, S1: 0.4, S2: [0.4, 0.6], S3: [0.6, 0.9], S4: 1.2 };
  const TABLA_TL = { S0: 3.0, S1: 2.5, S2: [2.5, 2.0], S3: [2.0, 1.6], S4: 1.6 };

  /* Salida de la nota (*) cuando no hay ensayo de ondas de corte, que es el
     caso normal en un galpón · fila S.sinVs30 */
  const SIN_VS30 = { S2: { TP: 0.6, TL: 2.0 }, S3: { TP: 0.9, TL: 1.6 } };

  const SUELOS = ["S0", "S1", "S2", "S3", "S4"];
  const ZONAS = ["Z1", "Z2", "Z3", "Z4"];

  /* EL SENTIDO DE LA INTERPOLACIÓN · fila S.interp.  El PRIMER valor del
     intervalo va con el V̄s30 MAYOR, es decir con el suelo más rígido.  No
     es una elección: es lo único que hace continuas las tablas de la norma en
     los bordes entre tipos de suelo. */
  function interpola(par, suelo, vs30) {
    if (!Array.isArray(par)) return { valor: par, interpolado: false };
    const r = VS30[suelo];
    const t = (r.max - vs30) / (r.max - r.min);     /* 0 en el rígido, 1 en el blando */
    const u = Math.min(1, Math.max(0, t));
    return { valor: par[0] + u * (par[1] - par[0]), interpolado: true, fraccion: u };
  }

  /* ---------- parámetros de sitio · Art. 17 ----------------------------- */
  function sitio(d) {
    const zona = d.zona, suelo = d.suelo;
    if (Z[zona] === undefined) {
      throw new Error("e030: la zona es " + ZONAS.join(" · ") + ", no «" + zona + "»");
    }
    if (SUELOS.indexOf(suelo) < 0) {
      throw new Error("e030: el perfil de suelo es " + SUELOS.join(" · ") +
        " (Tabla N° 3), no «" + suelo + "»");
    }

    const sTab = TABLA_S[zona][suelo];
    if (sTab === null) {
      throw new Error(
        "e030: la Tabla N° 4 no da factor de suelo para " + zona + " con suelo " + suelo + ".\n" +
        "  Dice literalmente «Requiere un análisis de respuesta de sitio».\n" +
        "  Un suelo muy blando en la zona de mayor peligro no se resuelve con\n" +
        "  un coeficiente: no hay número que inventar aquí.");
    }

    const hayVs30 = typeof d.vs30_ms === "number";
    const esIntervalo = Array.isArray(sTab);

    /* Sin medición de V̄s30 no se interpola: la norma da la salida
       conservadora explícita, y es el caso normal en un galpón. */
    if (esIntervalo && !hayVs30) {
      const sc = SIN_VS30[suelo];
      return {
        zona: zona, suelo: suelo, Z: Z[zona],
        S: sTab[1], TP: sc.TP, TL: sc.TL,
        interpolado: false, sinVs30: true,
        art: ART["S.sinVs30"],
        nota: "sin V̄s30 medido: se toma el MAYOR valor del intervalo de S, y " +
              "TP = " + sc.TP + " s, TL = " + sc.TL + " s (nota (*) de la Tabla N° 5)"
      };
    }

    const iS = interpola(sTab, suelo, d.vs30_ms);
    const iTP = interpola(TABLA_TP[suelo], suelo, d.vs30_ms);
    const iTL = interpola(TABLA_TL[suelo], suelo, d.vs30_ms);
    return {
      zona: zona, suelo: suelo, Z: Z[zona],
      S: iS.valor, TP: iTP.valor, TL: iTL.valor,
      interpolado: iS.interpolado, sinVs30: false,
      vs30_ms: d.vs30_ms,
      art: ART["S.interp"]
    };
  }

  function factorU(categoria) {
    const u = U[categoria];
    if (u === undefined) {
      throw new Error(
        "e030: la categoría es A, B o C (Tabla N° 7), no «" + categoria + "».\n" +
        "  Para un galpón NO es obvia y cambia la fuerza sísmica un 50 %: un\n" +
        "  almacén corriente es C (1,0); un centro de reuniones o un ambiente\n" +
        "  deportivo cae en B (1,3) por concentrar gente; y un depósito de\n" +
        "  materiales inflamables o tóxicos está listado en A2 (1,5).");
    }
    return { U: u, categoria: categoria, art: ART["S.U"] };
  }

  /* ---------- C · Tabla N° 6 y Art. 18.3 -------------------------------- */
  /* El del ESPECTRO, con la rampa nueva de 2026 en el primer tramo. */
  function factorC(d) {
    const T = d.T_s, TP = d.TP, TL = d.TL;
    if (!(T >= 0)) throw new Error("e030: factorC() necesita T_s ≥ 0");
    if (!(TP > 0) || !(TL > 0)) throw new Error("e030: factorC() necesita TP y TL");
    if (T < 0.2 * TP) return { C: 1 + 7.5 * (T / TP), tramo: "T < 0,2·TP · rampa", art: ART["S.C"] };
    if (T <= TP)      return { C: 2.5, tramo: "0,2·TP ≤ T ≤ TP", art: ART["S.C"] };
    if (T < TL)       return { C: 2.5 * (TP / T), tramo: "TP < T < TL", art: ART["S.C"] };
    return { C: 2.5 * (TP * TL / (T * T)), tramo: "T > TL", art: ART["S.C"] };
  }

  /* El de la CORTANTE BASAL ESTÁTICA · Art. 18.3 y 34.1, que lo dicen dos
     veces: C = 2,5 en todo 0 ≤ T ≤ TP, sin rampa.  Por encima de TP los dos
     coinciden, así que la diferencia vive exactamente donde está el galpón. */
  function factorCestatico(d) {
    const T = d.T_s, TP = d.TP;
    if (!(T >= 0)) throw new Error("e030: factorCestatico() necesita T_s ≥ 0");
    if (T <= TP) {
      return { C: 2.5, tramo: "0 ≤ T ≤ TP · sin rampa, Art. 18.3", art: ART["S.C.estatico"] };
    }
    return factorC(d);
  }

  /* ---------- R · Tabla N° 10 y Art. 22 --------------------------------- */
  const R0 = { SMF: 8, IMF: 5, OMF: 4, SCBF: 7, OCBF: 4, EBF: 8 };
  const R0_PENDULO = 2.5;      /* Art. 22.3 · fila S.pendulo */
  const SISTEMAS = Object.keys(R0);

  function coefR(d) {
    const Ia = (d.Ia === undefined) ? 1.0 : d.Ia;
    const Ip = (d.Ip === undefined) ? 1.0 : d.Ip;

    /* EL CASO QUE HAY QUE VIGILAR · un tijeral sobre columnas en voladizo
       concentra la masa arriba y resiste con columnas empotradas abajo: es
       péndulo invertido en la dirección transversal.  Como V ∝ 1/R, pedir
       OMF (4) donde toca 2,5 da el 62 % de la fuerza correcta. */
    if (d.pendulo === true) {
      return { R: R0_PENDULO * Ia * Ip, R0: R0_PENDULO, Ia: Ia, Ip: Ip,
        sistema: "péndulo invertido", art: ART["S.pendulo"] };
    }
    if (typeof d.pendulo !== "boolean") {
      throw new Error(
        "e030: hay que decir si la estructura es un péndulo invertido.\n" +
        "  coefR({ sistema: ..., pendulo: true | false })\n" +
        "  Un tijeral apoyado sobre columnas en voladizo lo es: masa arriba,\n" +
        "  columnas empotradas abajo. Le toca R₀ = 2,5 (Art. 22.3), y como\n" +
        "  V es inversamente proporcional a R, llamarlo OMF (R₀ = 4) da solo\n" +
        "  el 62 % de la fuerza. Es el candidato directo en la transversal.");
    }

    const base = R0[d.sistema];
    if (base === undefined) {
      throw new Error(
        "e030: el sistema es uno de " + SISTEMAS.join(" · ") + " (Tabla N° 10), no «" +
        d.sistema + "».\n" +
        "  Se elige POR DIRECCIÓN DE ANÁLISIS: en un galpón la transversal y la\n" +
        "  longitudinal casi nunca son el mismo sistema. Y si en una dirección\n" +
        "  conviven dos, el Art. 22.2 obliga a tomar el MENOR R₀.");
    }
    return { R: base * Ia * Ip, R0: base, Ia: Ia, Ip: Ip,
      sistema: d.sistema, art: ART["S.R0"],
      /* HUECO NORMATIVO · la Tabla 10 usa las siglas del AISC 341 pero la
         E.030 no invoca el documento ni exige su detallado.  No se reclama
         R₀ = 8 de un pórtico «especial» sin lo que lo hace especial. */
      exigeAISC341: base >= 7, artAISC341: ART["S.aisc341"] };
  }

  /* ---------- período · Art. 36 ----------------------------------------- */
  const CT = { momento: 35, arriostrado: 45, muros: 60 };

  function periodo(d) {
    const ct = CT[d.tipo];
    if (ct === undefined) {
      throw new Error(
        "e030: CT es " + Object.keys(CT).join(" · ") + " (Art. 36.1), no «" + d.tipo + "».\n" +
        "  35 · pórticos dúctiles de acero con uniones resistentes a momento\n" +
        "  45 · pórticos de acero arriostrados\n" +
        "  60 · albañilería, duales, muros\n" +
        "  OJO: un tijeral sobre columnas en voladizo NO tiene unión resistente\n" +
        "  a momento en la cumbre, así que no encaja limpio en ninguna. El\n" +
        "  Art. 36.2 permite Rayleigh con los desplazamientos del modelo.");
    }
    if (!(d.hn_m > 0)) throw new Error("e030: periodo() necesita hn_m > 0");
    return { T_s: d.hn_m / ct, CT: ct, tipo: d.tipo, art: ART["S.T"], artCT: ART["S.CT"] };
  }

  /* Rayleigh · Art. 36.2 · la salida limpia cuando la geometría no encaja. */
  const G = 981;    /* cm/s² · el sistema canónico del proyecto es el cm */
  function periodoRayleigh(d) {
    const P = d.P_kgf, di = d.d_cm, fi = d.f_kgf;
    if (!Array.isArray(P) || !Array.isArray(di) || !Array.isArray(fi) ||
        P.length !== di.length || P.length !== fi.length || !P.length) {
      throw new Error("e030: periodoRayleigh() necesita P_kgf, d_cm y f_kgf, del mismo largo");
    }
    let num = 0, den = 0;
    for (let i = 0; i < P.length; i++) { num += P[i] * di[i] * di[i]; den += fi[i] * di[i]; }
    if (!(den > 0)) throw new Error("e030: periodoRayleigh() · Σ(fi·di) tiene que ser > 0");
    return { T_s: 2 * Math.PI * Math.sqrt(num / (G * den)), art: ART["S.T.rayleigh"] };
  }

  /* ---------- peso sísmico · Art. 31 ------------------------------------ */
  /* Para el pórtico del galpón manda el inciso d): 25 % de la carga viva de
     TECHO.  El 80 % del inciso c) es del CONTENIDO del depósito, que descansa
     en el piso y no carga el tijeral: no se mezclan. */
  const PCT_VIVA = { A: 0.50, B: 0.50, C: 0.25, deposito: 0.80, techo: 0.25, tanque: 1.00 };

  function pesoSismico(d) {
    const pct = PCT_VIVA[d.caso];
    if (pct === undefined) {
      throw new Error("e030: el caso del Art. 31 es " + Object.keys(PCT_VIVA).join(" · ") +
        ", no «" + d.caso + "»");
    }
    if (!(d.D_kgf >= 0)) throw new Error("e030: pesoSismico() necesita D_kgf");
    const L = d.L_kgf || 0;
    return { P_kgf: d.D_kgf + pct * L, pct: pct, caso: d.caso, art: ART["S.P"] };
  }

  /* ---------- cortante en la base · Art. 34 ----------------------------- */
  const CR_MIN = 0.11;       /* Art. 34.2 · fila S.CR */

  function cortanteBasal(d) {
    const s = sitio(d);
    const u = factorU(d.categoria);
    const r = coefR(d);
    const c = factorCestatico({ T_s: d.T_s, TP: s.TP, TL: s.TL });

    const cr = c.C / r.R;
    const crUsado = Math.max(CR_MIN, cr);
    const V = s.Z * u.U * crUsado * s.S * d.P_kgf;
    return {
      V_kgf: V,
      Z: s.Z, U: u.U, C: c.C, S: s.S, R: r.R, P_kgf: d.P_kgf,
      TP: s.TP, TL: s.TL, tramoC: c.tramo,
      CR: cr, CR_usado: crUsado, enMinimoCR: cr < CR_MIN,
      sitio: s, sistema: r,
      art: ART["S.V"], artCR: ART["S.CR"]
    };
  }

  /* ---------- reparto en altura · Art. 35 ------------------------------- */
  function exponenteK(T_s) {
    if (!(T_s >= 0)) throw new Error("e030: exponenteK() necesita T_s ≥ 0");
    if (T_s <= 0.5) return { k: 1.0, art: ART["S.k"] };
    return { k: Math.min(2.0, 0.75 + 0.5 * T_s), art: ART["S.k"] };
  }

  function fuerzasPorNivel(d) {
    const P = d.P_kgf, h = d.h_m;
    if (!Array.isArray(P) || !Array.isArray(h) || P.length !== h.length || !P.length) {
      throw new Error("e030: fuerzasPorNivel() necesita P_kgf y h_m del mismo largo");
    }
    const k = exponenteK(d.T_s).k;
    const num = P.map((p, i) => p * Math.pow(h[i], k));
    const den = num.reduce((a, b) => a + b, 0);
    if (!(den > 0)) throw new Error("e030: fuerzasPorNivel() · Σ(Pj·hj^k) tiene que ser > 0");
    const alfa = num.map((x) => x / den);
    return { k: k, alfa: alfa, F_kgf: alfa.map((a) => a * d.V_kgf), art: ART["S.Fi"] };
  }

  /* ---------- desplazamientos y deriva · Art. 50 y 51 ------------------- */
  /* EL PASO QUE MÁS SE OLVIDA.  Y los mínimos del Art. 34 y 44 NO se aplican
     aquí (Art. 50.3): son mínimos de resistencia, no de rigidez. */
  const FACTOR_DESPL = { regular: 0.75, irregular: 0.85 };

  function desplazamientos(d) {
    const f = FACTOR_DESPL[d.regularidad];
    if (f === undefined) {
      throw new Error(
        "e030: la regularidad es «regular» o «irregular» (Art. 50.1 y 50.2), no «" +
        d.regularidad + "».\n" +
        "  Decide el multiplicador: 0,75R o 0,85R. Omitirlo divide la deriva\n" +
        "  por 3 con R = 4 y por 6 con R = 8, y entonces cumple siempre.");
    }
    if (!(d.R > 0)) throw new Error("e030: desplazamientos() necesita R > 0");
    if (!Array.isArray(d.delta_cm)) throw new Error("e030: desplazamientos() necesita delta_cm");
    const mult = f * d.R;
    return {
      multiplicador: mult, factor: f, R: d.R,
      delta_cm: d.delta_cm.map((x) => x * mult),
      art: ART["S.despl"], artMinimos: ART["S.despl.min"],
      nota: "los mínimos del Art. 34 y 44 NO se aplican aquí (Art. 50.3): " +
            "son de resistencia, no de rigidez"
    };
  }

  /* Tabla N° 14 · y la nota que aplica a un galpón. */
  const DERIVA = { acero: 0.010, concreto: 0.007, albanileria: 0.005, madera: 0.010, MDL: 0.004 };
  const FACTOR_INDUSTRIAL = 2;      /* fila S.deriva.industrial */

  function limiteDeriva(d) {
    const base = DERIVA[d.material];
    if (base === undefined) {
      throw new Error("e030: el material es " + Object.keys(DERIVA).join(" · ") +
        " (Tabla N° 14), no «" + d.material + "»");
    }
    if (!d.industrial) {
      return { limite: base, material: d.material, art: ART["S.deriva"] };
    }
    /* Licencia explícita de la nota de la Tabla 14: en uso industrial lo fija
       el proyectista, pero NUNCA excede el doble.  Como toda licencia, se
       adopta y se declara: si el proyectista propone más del doble, para. */
    const tope = FACTOR_INDUSTRIAL * base;
    const prop = (d.propuesto === undefined) ? tope : d.propuesto;
    if (prop > tope + 1e-12) {
      throw new Error(
        "e030: la deriva industrial propuesta (" + prop + ") pasa del doble de la\n" +
        "  Tabla N° 14 (" + tope + "). La nota dice «en ningún caso exceden el\n" +
        "  doble de los valores de esta Tabla»: es un tope, no una sugerencia.");
    }
    return { limite: prop, tope: tope, base: base, material: d.material,
      industrial: true, art: ART["S.deriva.industrial"] };
  }

  return {
    ART, Z, U, VS30, TABLA_S, TABLA_TP, TABLA_TL, SIN_VS30, SUELOS, ZONAS,
    R0, R0_PENDULO, SISTEMAS, CT, PCT_VIVA, CR_MIN, FACTOR_DESPL, DERIVA,
    FACTOR_INDUSTRIAL, G,
    interpola, sitio, factorU, factorC, factorCestatico, coefR,
    periodo, periodoRayleigh, pesoSismico, cortanteBasal,
    exponenteK, fuerzasPorNivel, desplazamientos, limiteDeriva
  };
});
