/* =====================================================================
   conexiones.js — Capítulo J: soldaduras, pernos y elementos de conexión

   Cierra E7 junto con placabase.js.  Aquí se verifica lo que une las
   barras del galpón: la cartela del tijeral, el empalme de la brida, el
   ángulo de la riostra.  Conexiones de APLASTAMIENTO, con agujeros
   estándar: las de deslizamiento crítico se niegan con su motivo (fila
   J.deslizamiento), en vez de calcularse con una fórmula que no es suya.

   ─────────────────────────────────────────────────────────────────────
   OCHO DIVERGENCIAS CON LA E.090, Y TODAS SE DICEN.

   La E.090-2020 reproduce el LRFD de 1999 y el AISC 360-22 ha cambiado
   desde entonces.  En TODAS manda el AISC, como en el resto del proyecto,
   salvo UNA, y por una razón que ya estaba escrita:

     el CORTE DE LOS PERNOS sale de la columna Fnv de la Tabla J3.2, la
     MISMA de la que sale el corte de los pernos de anclaje, y para esos
     ya se adoptó la E.090 (fila J.pernos.Fn.divergencia).  Tratar con dos
     normas el perno de la cartela y el de la placa base, que salen de la
     misma columna de la misma tabla, no se podría justificar.  Fila
     J.pernos.Fnv.divergencia.  Cuesta: McCormac 12-2 pasa de 8 a 9 pernos.
     Va como parámetro —norma: "AISC"— y el módulo da los dos números.

   Las otras siete se calculan AL LADO y se avisan cuando morderían:
     · tamaño mínimo del filete: la parte delgada (AISC) o la gruesa (E.090)
     · longitud efectiva máxima del filete: β (AISC) o 70·w (E.090)
     · juntas largas: 950 mm y 0,833 (AISC) o 1300 mm y 0,80 (E.090)
     · borde cizallado: la E.090 pide más
     · rotura de planchas: la E.090 topa An en 0,85·Ag; el 360-22 ya no
     · fluencia en corte de elementos: φ = 1,00 (AISC) o 0,90 (E.090)
     · tracción y corte combinados: forma del AISC con el Fnv adoptado,
       que es más severa que la recta de la E.090 en todo el rango

   ─────────────────────────────────────────────────────────────────────
   LO QUE SE REPRODUCE, número por número:
     McCormac 12-1  plancha empernada: 194,4 · 217,5 · 182,7 · 122,4 klb
     McCormac 12-2  ocho pernos A325 de 3/4 (nueve con la E.090)
     McCormac 14-1  filete de 1/4: 5,56 klb/plg, 111,2 y, con β, 160,1
     McCormac 14-2  plancha soldada: 194,9 klb, gobierna la soldadura
     McCormac 14-4  la dirección de la carga: 133,8 y 173,6 klb
     McCormac 14-5  filetes longitudinales y transversal: 199 klb
     Zapata 4.4     seis pernos A325 de 3/4 a tracción
     Zapata 5.1     4,77 klb/plg con E60XX
     Zapata 5.3     junta traslapada: 46 cm de cordón

   UNIDADES: kgf, cm, kgf/cm².  Los tamaños de filete y los espesores de
   las tablas de tamaño van en mm, porque así están escritas las tablas.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./acero.js"),
      require("./unidades.js"));
  } else {
    raiz.CONEXIONES = definir(raiz.INVENTARIO, raiz.ACERO, raiz.UNIDADES);
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC, UN) {
  "use strict";

  const ART = INV.declara("conexiones.js", [
    "J.electrodo", "J.filete.Fnw", "J.filete.Rn", "J.filete.kds", "J.filete.grupo",
    "J.filete.garganta", "J.filete.min", "J.filete.max", "J.filete.minlong",
    "J.filete.beta", "J.filete.largo.divergencia", "J.filete.min.divergencia", "J.filete.pulgadas",
    "J.pernos.Rn", "J.pernos.Fn", "J.pernos.Fn.divergencia", "J.pernos.Fnv.divergencia",
    "J.pernos.combinado", "J.pernos.largo", "J.pernos.agujero", "J.pernos.agujero.pulg",
    "J.pernos.esp", "J.pernos.borde", "J.pernos.borde.pulg", "J.pernos.borde.min",
    "J.pernos.borde.divergencia", "J.pernos.maxesp", "J.agujero.tipo", "J.deslizamiento",
    "J.aplast", "J.desgarro", "J.aplast.ambos",
    "J.elem.traccion", "J.elem.085", "J.elem.corte", "J.elem.compresion",
    "T.varillas.Ab", "T.varillas.tracCorte", "T.An.agujero", "T.U.c4"
  ,
    "J.union.angulo", "J.excentricidad.angulo", "J.whitmore", "J.bloque.soldado", "J.cartela.pandeo",
    "J.pernos.detalle"]);

  const MPA = UN.MPA_KGCM2, KSI = UN.KSI_KGCM2, PLG = UN.PULGADA_CM;

  /* ---------- los φ ----------------------------------------------------- */
  const PHI = {
    perno: 0.75,            /* J3-1, J3-2 · E.090 §10.3.6 */
    filete: 0.75,           /* Tabla J2.5 */
    aplast: 0.75,           /* J3.11 */
    tFluencia: 0.90,        /* J4-1 */
    tRotura: 0.75,          /* J4-2 */
    vFluencia: 1.00,        /* J4-3 · AISC */
    vFluenciaE090: 0.90,    /* E.090 10.5-3 · fila J.elem.corte */
    vRotura: 0.75,          /* J4-4 */
    compresion: 0.90        /* J4-6 */
  };

  function exige(c, msg) { if (!c) throw new Error("conexiones: " + msg); }

  /* =====================================================================
     SOLDADURAS DE FILETE
     ===================================================================== */

  /* El número está EN EL NOMBRE del electrodo · fila J.electrodo */
  const ELECTRODOS_KSI = { E60: 60, E70: 70 };
  function fexx(electrodo) {
    const e = String(electrodo || "E70").toUpperCase().replace(/XX$/, "");
    exige(ELECTRODOS_KSI[e] !== undefined,
      "el electrodo es " + Object.keys(ELECTRODOS_KSI).join(" ó ") + ", no «" + electrodo + "».\n" +
      "  La resistencia está en el nombre —E70 = 70 ksi— pero solo entran los que\n" +
      "  tienen fila (J.electrodo).");
    return { nombre: e + "XX", FEXX_kgcm2: ELECTRODOS_KSI[e] * KSI, art: ART["J.electrodo"] };
  }

  const FNW = 0.60;                 /* Fnw = 0,60·FEXX · Tabla J2.5 */
  const GARGANTA = Math.SQRT1_2;    /* sen 45° = 0,7071 · fila J.filete.garganta */

  /* Tabla J2.4 · los mismos escalones en las dos normas; lo que cambia es la
     columna de entrada (fila J.filete.min.divergencia) */
  function minimoTabla(t_mm, sistema) {
    if (sistema === "pulgadas") {                  /* la columna en pulgadas · fila J.filete.pulgadas */
      if (t_mm <= 0.25 * PULG + 1e-9) return 0.125 * PULG;
      if (t_mm <= 0.5 * PULG + 1e-9) return 0.1875 * PULG;
      if (t_mm <= 0.75 * PULG + 1e-9) return 0.25 * PULG;
      return 0.3125 * PULG;
    }
    if (t_mm <= 6) return 3;
    if (t_mm <= 13) return 5;
    if (t_mm <= 19) return 6;
    return 8;
  }
  const PULG = 25.4;                               /* mm */
  function sistemaDe(perfil) { return perfil && perfil.origen === "imperial" ? "pulgadas" : "mm"; }

  /* ---------- tamaño mínimo y máximo ------------------------------------ */
  function tamanosFilete(d) {
    const t1 = d.t1_mm, t2 = d.t2_mm;
    exige(t1 > 0 && t2 > 0, "tamanosFilete() necesita t1_mm y t2_mm, los espesores de las dos partes");
    const delgada = Math.min(t1, t2), gruesa = Math.max(t1, t2);
    const tBorde = (d.tBorde_mm === undefined) ? delgada : d.tBorde_mm;
    exige(tBorde > 0, "tBorde_mm tiene que ser > 0");
    const pulg = d.sistema === "pulgadas";
    exige(!d.sistema || pulg || d.sistema === "mm", "el sistema de la tabla J2.4 es «mm» o «pulgadas»");
    const wMin = minimoTabla(delgada, d.sistema);   /* AISC: la delgada */
    const wMinE090 = minimoTabla(gruesa, d.sistema); /* E.090: la gruesa */
    const tope = pulg ? 0.25 * PULG - 1e-9 : 6, holgura = pulg ? PULG / 16 : 2;
    const wMax = d.rellenoCompleto ? tBorde : (tBorde < tope ? tBorde : tBorde - holgura);
    const out = {
      wMin_mm: wMin, wMax_mm: wMax, wMinE090_mm: wMinE090, sistema: pulg ? "pulgadas" : "mm",
      artSistema: pulg ? ART["J.filete.pulgadas"] : null,
      cabe: wMin <= wMax,
      art: ART["J.filete.min"], artMax: ART["J.filete.max"],
      artDivergencia: ART["J.filete.min.divergencia"]
    };
    if (wMinE090 > wMin) {
      out.avisoE090 = "la E.090 mide el mínimo en la parte MÁS GRUESA (" + gruesa + " mm) y " +
        "pediría " + wMinE090 + " mm; el AISC, en la delgada, pide " + wMin + " mm. Manda el AISC." +
        (wMinE090 > wMax ? " CON LA E.090 NO CABRÍA NINGÚN FILETE: su mínimo supera el máximo " +
          "de " + wMax + " mm que admite el borde." : "");
      out.cabeE090 = wMinE090 <= wMax;
    }
    if (d.w_mm !== undefined) {
      out.w_mm = d.w_mm;
      out.cumpleMin = d.w_mm >= wMin;
      out.cumpleMax = d.w_mm <= wMax + 1e-9;
      out.cumpleMinE090 = d.w_mm >= wMinE090;
    }
    return out;
  }

  /* ---------- la resistencia de un filete ------------------------------
     Rn = Fnw·Awe·kds, φ = 0,75.  La longitud efectiva sale del β de J2-1
     cuando el filete está cargado en el extremo; la E.090 la topa en 70·w,
     y eso se calcula al lado. */
  function filete(d) {
    const w_mm = d.w_mm, L = d.L_cm;
    exige(w_mm > 0, "filete() necesita w_mm, el tamaño del filete");
    exige(L > 0, "filete() necesita L_cm, la longitud del cordón");
    const el = fexx(d.electrodo);
    const w = w_mm / 10;
    const theta = d.theta_grados || 0;
    exige(theta >= 0 && theta <= 90, "theta_grados va de 0 (carga paralela) a 90 (transversal)");
    const extremo = (d.extremo === undefined) ? (theta === 0) : !!d.extremo;
    const avisos = [];

    /* LONGITUD MÍNIMA · J2.2b(c): no prohíbe, castiga */
    let wCalc = w;
    if (L < 4 * w - 1e-9) {
      wCalc = L / 4;
      avisos.push({ nivel: "aviso", art: ART["J.filete.minlong"],
        que: "el cordón mide menos de 4 veces su tamaño: se calcula con un filete de " +
          (wCalc * 10).toFixed(1) + " mm en vez de " + w_mm + " mm" });
    }

    /* LONGITUD EFECTIVA · J2-1 */
    let Lef = L, beta = 1;
    const lw = L / wCalc;
    if (extremo && lw > 100) {
      if (lw <= 300) { beta = Math.min(1, 1.2 - 0.002 * lw); Lef = beta * L; }
      else { Lef = 180 * wCalc; beta = Lef / L; }
    }

    const kds = 1.0 + 0.50 * Math.pow(Math.sin(theta * Math.PI / 180), 1.5);
    const te = GARGANTA * wCalc;
    const Fnw = FNW * el.FEXX_kgcm2;
    const Rn = Fnw * te * Lef * kds;

    /* LA E.090, AL LADO · fila J.filete.largo.divergencia: solo cambia la
       longitud efectiva, topada en 70·w para fuerzas paralelas */
    const LefE090 = extremo ? Math.min(L, 70 * wCalc) : L;
    const RnE090 = Fnw * te * LefE090 * kds;
    if (extremo && L > 70 * wCalc) {
      avisos.push({ nivel: "aviso", art: ART["J.filete.largo.divergencia"],
        que: "L/w = " + lw.toFixed(0) + " > 70: la E.090 toparía la longitud efectiva en " +
          (70 * wCalc).toFixed(1) + " cm y daría un " +
          ((1 - RnE090 / Rn) * 100).toFixed(0) + " % menos. Manda el AISC." });
    }

    const out = {
      w_mm: w_mm, wCalc_mm: wCalc * 10, L_cm: L, te_cm: te,
      electrodo: el.nombre, FEXX_kgcm2: el.FEXX_kgcm2, Fnw_kgcm2: Fnw,
      theta_grados: theta, kds: kds, extremo: extremo,
      Lw: lw, beta: beta, Lef_cm: Lef,
      Rn_kgf: Rn, phi: PHI.filete, phiRn_kgf: PHI.filete * Rn,
      phiRnPorCm_kgf: PHI.filete * Fnw * te * kds,
      RnE090_kgf: RnE090, phiRnE090_kgf: PHI.filete * RnE090,
      avisos: avisos,
      art: ART["J.filete.Rn"], artFnw: ART["J.filete.Fnw"], artKds: ART["J.filete.kds"],
      artBeta: ART["J.filete.beta"], artGarganta: ART["J.filete.garganta"],
      notaMetalBase: "el metal base no se verifica aquí: la User Note de J2.4 dice que en " +
        "filetes normalmente no hace falta (fila J.filete.Fnw). Si gobierna, va por " +
        "elementoCorte()."
    };
    if (d.Pu_kgf !== undefined) {
      out.Pu_kgf = d.Pu_kgf;
      out.ratio = d.Pu_kgf / out.phiRn_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* ---------- grupo de filetes longitudinales y transversales · J2-6 ---
     Se permite J2-6, y la User Note permite también J2.4(a) SIN el aumento
     por dirección.  Se toma el mayor de los dos, que es lo que hace
     McCormac en el 14-5. */
  function grupoFiletes(d) {
    const w_mm = d.w_mm;
    exige(w_mm > 0, "grupoFiletes() necesita w_mm");
    const Ll = d.Llong_cm || 0, Lt = d.Ltrans_cm || 0;
    exige(Ll > 0 && Lt > 0,
      "grupoFiletes() es para la mezcla: necesita Llong_cm y Ltrans_cm > 0.\n" +
      "  Con un solo tipo de filete va por filete(), con su theta.");
    const el = fexx(d.electrodo);
    const te = GARGANTA * w_mm / 10;
    const Fnw = FNW * el.FEXX_kgcm2;
    const Rnwl = Fnw * te * Ll;
    const Rnwt = Fnw * te * Lt;      /* SIN kds: J2-6 lo define así */
    const suma = Rnwl + Rnwt;
    const j26 = 0.85 * Rnwl + 1.5 * Rnwt;
    const Rn = Math.max(suma, j26);
    const out = {
      te_cm: te, Rnwl_kgf: Rnwl, Rnwt_kgf: Rnwt,
      suma_kgf: suma, J26_kgf: j26, gobierna: j26 >= suma ? "J2-6" : "J2.4(a) sin aumento",
      Rn_kgf: Rn, phi: PHI.filete, phiRn_kgf: PHI.filete * Rn,
      electrodo: el.nombre, art: ART["J.filete.grupo"]
    };
    if (d.Pu_kgf !== undefined) {
      out.Pu_kgf = d.Pu_kgf; out.ratio = d.Pu_kgf / out.phiRn_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* =====================================================================
     PERNOS
     ===================================================================== */

  /* Tabla J3.2 en MPa, con la columna de corte de la E.090 al lado.
     TRACCIÓN: igual en las dos.  CORTE: la E.090 queda ~11 % abajo y es la
     que se adopta (fila J.pernos.Fnv.divergencia). */
  const PERNOS = {
    A307: { Fnt: 310, AISC: { N: 190, X: 190 }, E090: { N: 165, X: 165 } },
    A325: { Fnt: 620, AISC: { N: 370, X: 470 }, E090: { N: 330, X: 415 } },
    A490: { Fnt: 780, AISC: { N: 470, X: 580 }, E090: { N: 415, X: 520 } }
  };
  const NORMAS = ["E090", "AISC"];

  /* Tablas J3.3M y J3.4M, mm · E.090 Tabla 10.3.4 para bordes cizallados */
  const METRICOS = {
    12: { agujero: 14, borde: 18, cizallado: null },
    16: { agujero: 18, borde: 22, cizallado: 28 },
    20: { agujero: 22, borde: 26, cizallado: 34 },
    22: { agujero: 24, borde: 28, cizallado: 38 },
    24: { agujero: 27, borde: 30, cizallado: 42 },
    27: { agujero: 30, borde: 34, cizallado: 48 },
    30: { agujero: 33, borde: 38, cizallado: 52 },
    36: { agujero: 39, borde: 46, cizallado: 64 }
  };
  /* Tablas J3.3 y J3.4, pulgadas, en dieciseisavos para que sean exactas */
  const PULGADAS = {
    "1/2":   { d16: 8,  agujero16: 9,  borde16: 12 },
    "5/8":   { d16: 10, agujero16: 11, borde16: 14 },
    "3/4":   { d16: 12, agujero16: 13, borde16: 16 },
    "7/8":   { d16: 14, agujero16: 15, borde16: 18 },
    "1":     { d16: 16, agujero16: 18, borde16: 20 },
    "1-1/8": { d16: 18, agujero16: 20, borde16: 24 },
    "1-1/4": { d16: 20, agujero16: 22, borde16: 26 }
  };

  /* El diámetro se da como se compra: "M20" ó '3/4"'. */
  function diametro(nombre) {
    const s = String(nombre).trim().replace(/\s+/g, "");
    let m = /^M(\d+)$/i.exec(s);
    if (m) {
      const dm = +m[1];
      let fila = METRICOS[dm];
      if (!fila && dm > 36) {
        fila = { agujero: dm + 3, borde: 1.25 * dm, cizallado: 1.75 * dm };
      }
      exige(fila, "no hay fila para M" + dm + ". Los métricos de la Tabla J3.3M son " +
        Object.keys(METRICOS).map((k) => "M" + k).join(" · ") + " y los mayores de M36.");
      return { nombre: "M" + dm, sistema: "mm", d_cm: dm / 10,
        agujero_cm: fila.agujero / 10, borde_cm: fila.borde / 10,
        bordeCizallado_cm: fila.cizallado === null ? null : fila.cizallado / 10,
        art: ART["J.pernos.agujero"], artBorde: ART["J.pernos.borde"] };
    }
    m = /^([\d\-\/]+)(?:"|plg|in)?$/i.exec(s);
    const clave = m ? m[1] : null;
    const fila = clave ? PULGADAS[clave] : null;
    exige(fila, "el diámetro «" + nombre + "» no se reconoce. Métricos: M12 a M36 y mayores; " +
      "en pulgadas: " + Object.keys(PULGADAS).map((k) => k + '"').join(" · ") + ".");
    const p16 = PLG / 16;
    return { nombre: clave + '"', sistema: "plg", d_cm: fila.d16 * p16,
      agujero_cm: fila.agujero16 * p16, borde_cm: fila.borde16 * p16,
      bordeCizallado_cm: null,
      art: ART["J.pernos.agujero.pulg"], artBorde: ART["J.pernos.borde.pulg"] };
  }

  function grado(nombre) {
    const g = String(nombre || "").toUpperCase();
    exige(PERNOS[g], "el perno es " + Object.keys(PERNOS).join(" · ") + ", no «" + nombre + "».");
    return g;
  }

  function noDeslizamiento(d) {
    exige(!d.deslizamientoCritico,
      "las conexiones de DESLIZAMIENTO CRÍTICO no están en este módulo (fila J.deslizamiento).\n" +
      "  Hacen falta la Tabla J3.1M de pretensiones y los coeficientes de superficie, que\n" +
      "  todavía no tienen fila. Darte un número de aplastamiento para una junta que tiene\n" +
      "  que trabajar por fricción sería darte el número de otra cosa.");
    exige(!d.agujero || d.agujero === "estandar",
      "agujero «" + d.agujero + "»: en conexiones de aplastamiento solo van agujeros\n" +
      "  estándar —los agrandados están prohibidos (AISC J3.3(d), E.090 §10.3.2)— y los\n" +
      "  ranurados tienen sus propias distancias, que no están aquí (fila J.agujero.tipo).");
  }

  /* ---------- un perno: tracción y corte · J3-1 --------------------------- */
  function perno(d) {
    noDeslizamiento(d);
    const g = grado(d.grado);
    const di = diametro(d.diametro);
    const roscas = d.roscas || "N";
    exige(roscas === "N" || roscas === "X",
      "roscas es «N» (no excluidas del plano de corte) ó «X» (excluidas), no «" + roscas + "».\n" +
      "  Si no se sabe, «N»: es la conservadora, y un perno corto puede venir roscado entero.");
    const planos = (d.planos === undefined) ? 1 : d.planos;
    exige(planos === 1 || planos === 2, "planos de corte: 1 (simple) ó 2 (doble)");
    const norma = d.norma || "E090";
    exige(NORMAS.indexOf(norma) >= 0, "norma es «E090» (por omisión) ó «AISC»");

    /* Ab = área nominal SIN ROSCAR · fila T.varillas.Ab */
    const Ab = Math.PI * di.d_cm * di.d_cm / 4;
    const Fnt = PERNOS[g].Fnt * MPA;

    /* JUNTAS LARGAS · fila J.pernos.largo */
    const Lj = d.longitudJunta_cm || 0;
    const fLargo = Lj > 95 ? 0.833 : 1;
    const fLargoE090 = Lj > 130 ? 0.80 : 1;

    const corte = (n) => PERNOS[g][n][roscas] * MPA;
    const phiRnv = (n, f) => PHI.perno * corte(n) * Ab * planos * f;
    const out = {
      grado: g, diametro: di.nombre, d_cm: di.d_cm, Ab_cm2: Ab,
      roscas: roscas, planos: planos, norma: norma,
      Fnt_kgcm2: Fnt, Fnv_kgcm2: corte(norma),
      factorLargo: fLargo,
      phi: PHI.perno,
      phiRnt_kgf: PHI.perno * Fnt * Ab,
      phiRnv_kgf: phiRnv(norma, fLargo),
      conLasDos: {
        E090: { Fnv_kgcm2: corte("E090"), phiRnv_kgf: phiRnv("E090", fLargo) },
        AISC: { Fnv_kgcm2: corte("AISC"), phiRnv_kgf: phiRnv("AISC", fLargo) }
      },
      art: ART["J.pernos.Rn"], artFn: ART["J.pernos.Fn"],
      artDivergencia: ART["J.pernos.Fnv.divergencia"],
      avisos: []
    };
    out.diferenciaCorte = 1 - out.conLasDos.E090.phiRnv_kgf / out.conLasDos.AISC.phiRnv_kgf;
    if (fLargo < 1 || fLargoE090 < 1) {
      out.avisos.push({ nivel: "aviso", art: ART["J.pernos.largo"],
        que: "junta de " + Lj + " cm: el AISC reduce el corte al 83,3 % por encima de 95 cm" +
          (fLargoE090 < 1 ? "; la E.090 lo reduciría al 80 % si fuera un empalme a tracción" : "") });
    }
    return out;
  }

  /* ---------- tracción y corte a la vez · J3-2 y J3-3a ------------------
     La forma del AISC con el Fnv adoptado: con la E.090 en la columna de
     corte la pendiente es más severa que la recta de la E.090 en todo el
     rango (filas J.pernos.combinado y T.varillas.tracCorte). */
  function traccionCorte(d) {
    const p = perno(d);
    const Tu = d.Tu_kgf, Vu = d.Vu_kgf;
    exige(Tu >= 0 && Vu >= 0, "traccionCorte() necesita Tu_kgf y Vu_kgf ≥ 0, POR PERNO");
    const frv = Vu / (p.Ab_cm2 * p.planos);
    const phiFnv = PHI.perno * p.Fnv_kgcm2 * p.factorLargo;
    exige(frv <= phiFnv + 1e-9,
      "el corte solo ya agota el perno: frv = " + frv.toFixed(0) + " kgf/cm² > φ·Fnv = " +
      phiFnv.toFixed(0) + ". No hay tracción que comprobar: hacen falta más pernos o más gruesos.");
    const Fnt = p.Fnt_kgcm2;
    const Fntp = Math.max(0, Math.min(Fnt, 1.3 * Fnt - Fnt / phiFnv * frv));
    const phiRnt = PHI.perno * Fntp * p.Ab_cm2;
    const ft = Tu / p.Ab_cm2;
    /* la User Note: si uno de los dos no pasa del 30 %, la interacción no hace falta */
    const exento = (ft <= 0.30 * PHI.perno * Fnt) || (frv <= 0.30 * phiFnv);
    return {
      frv_kgcm2: frv, ft_kgcm2: ft,
      Fntp_kgcm2: Fntp, phiRnt_kgf: phiRnt,
      pendiente: Fnt / phiFnv,
      ratio: Tu / phiRnt, cumple: Tu <= phiRnt + 1e-9,
      ratioCorte: frv / phiFnv,
      exentoPor30: exento,
      notaExento: exento ? "uno de los dos esfuerzos no pasa del 30 % del disponible: la " +
        "User Note del J3.8 permite no comprobar la interacción. Se calcula igual." : null,
      perno: p,
      art: ART["J.pernos.combinado"], artDecision: ART["T.varillas.tracCorte"]
    };
  }

  /* ---------- aplastamiento y desgarramiento en el agujero · J3.11 ------ */
  function aplastamiento(d) {
    const mat = materialDe(d);
    const db = d.d_cm, t = d.t_cm, lc = d.lc_cm;
    exige(db > 0 && t > 0, "aplastamiento() necesita d_cm (perno) y t_cm (la parte que aplasta)");
    exige(lc > 0, "aplastamiento() necesita lc_cm, la distancia LIBRE en la dirección de la " +
      "fuerza hasta el borde del agujero vecino o de la pieza.\n" +
      "  Si sale ≤ 0 el agujero toca el borde: la geometría no sirve.");
    const deform = (d.deformacion === undefined) ? true : !!d.deformacion;
    const kA = deform ? 2.4 : 3.0, kD = deform ? 1.2 : 1.5;
    const aplast = kA * db * t * mat.Fu;
    const desgarro = kD * lc * t * mat.Fu;
    const Rn = Math.min(aplast, desgarro);
    return {
      aplastamiento_kgf: aplast, desgarramiento_kgf: desgarro,
      gobierna: desgarro < aplast ? "desgarramiento" : "aplastamiento",
      Rn_kgf: Rn, phi: PHI.aplast, phiRn_kgf: PHI.aplast * Rn,
      deformacion: deform,
      art: ART["J.aplast"], artDesgarro: ART["J.desgarro"], artAmbos: ART["J.aplast.ambos"],
      nota: deform ? "la deformación del agujero en servicio importa (2,4 y 1,2)"
        : "la deformación no importa (3,0 y 1,5)"
    };
  }

  function materialDe(d) {
    if (typeof d.acero === "string") return AC.material(d.acero);
    exige(d.Fu_kgcm2 > 0, "falta el material: acero: \"A36\" ó Fy_kgcm2 y Fu_kgcm2");
    return { Fy: d.Fy_kgcm2, Fu: d.Fu_kgcm2 };
  }

  /* ---------- separaciones y bordes · J3.4, J3.5, J3.6 ------------------ */
  function distancias(d) {
    const di = diametro(d.diametro);
    const db = di.d_cm, h = di.agujero_cm;
    const L = [];
    const pon = (nivel, que, art) => L.push({ nivel: nivel, que: que, art: art });
    const cm = (x) => x.toFixed(2) + " cm";

    if (d.s_cm !== undefined) {
      const sMin = 8 / 3 * db;
      if (d.s_cm < sMin - 1e-9) {
        pon("error", "separación " + cm(d.s_cm) + " < 2⅔·d = " + cm(sMin), ART["J.pernos.esp"]);
      } else if (d.s_cm - h < db - 1e-9) {
        pon("error", "luz libre entre agujeros " + cm(d.s_cm - h) + " < d = " + cm(db),
          ART["J.pernos.esp"]);
      } else if (d.s_cm < 3 * db - 1e-9) {
        pon("nota", "separación " + cm(d.s_cm) + " cumple, pero la recomendada es 3·d = " +
          cm(3 * db), ART["J.pernos.esp"]);
      }
    }
    for (const [k, nombre] of [["le_cm", "al borde"], ["lt_cm", "al borde lateral"]]) {
      const e = d[k];
      if (e === undefined) continue;
      if (e < db - 1e-9) {
        pon("error", "distancia " + nombre + " " + cm(e) + " < d = " + cm(db) +
          ": por debajo de un diámetro no se permite sin aprobación del ingeniero responsable",
          ART["J.pernos.borde.min"]);
      } else if (e < di.borde_cm - 1e-9) {
        pon("aviso", "distancia " + nombre + " " + cm(e) + " < " + cm(di.borde_cm) +
          " de la tabla: se permite porque el aplastamiento, el desgarramiento y el bloque " +
          "de cortante se verifican con ella (nota [a])", ART["J.pernos.borde.min"]);
      }
      if (d.bordeCizallado && di.bordeCizallado_cm !== null && e < di.bordeCizallado_cm - 1e-9) {
        pon("aviso", "borde cizallado: la E.090 pediría " + cm(di.bordeCizallado_cm) + " " + nombre +
          ". Manda el AISC.", ART["J.pernos.borde.divergencia"]);
      }
      if (d.t_cm > 0) {
        const eMax = Math.min(12 * d.t_cm, 15);
        if (e > eMax + 1e-9) {
          pon("error", "distancia " + nombre + " " + cm(e) + " > " + cm(eMax) +
            " (12·t y 150 mm)", ART["J.pernos.maxesp"]);
        }
      }
    }
    if (d.s_cm !== undefined && d.contactoContinuo && d.t_cm > 0) {
      const sMax = Math.min(24 * d.t_cm, 30);
      if (d.s_cm > sMax + 1e-9) {
        pon("error", "separación " + cm(d.s_cm) + " > " + cm(sMax) +
          " (24·t y 300 mm, elementos en contacto continuo pintados o sin corrosión)",
          ART["J.pernos.maxesp"]);
      }
    }
    return {
      lista: L, diametro: di.nombre, agujero_cm: h, bordeTabla_cm: di.borde_cm,
      errores: L.filter((x) => x.nivel === "error").length,
      ok: !L.some((x) => x.nivel === "error")
    };
  }

  /* ---------- un grupo de pernos con carga concéntrica ------------------
     La User Note de J3.7: cada perno vale lo MENOR entre su corte y su
     aplastamiento o desgarramiento, y el grupo es la suma.  Los de la fila
     del borde desgarran con le − h/2; los demás, con s − h. */
  function grupoPernos(d) {
    const p = perno(d);
    const di = diametro(d.diametro);
    const nf = d.porLinea, nl = d.lineas || 1;
    exige(nf >= 1 && nl >= 1, "grupoPernos() necesita porLinea (pernos en la dirección de la carga) y lineas");
    exige(d.le_cm > 0, "grupoPernos() necesita le_cm, la distancia al borde en la dirección de la carga");
    exige(nf === 1 || d.s_cm > 0, "con más de un perno por línea hace falta s_cm");
    const capas = d.aplastamientoEn;
    exige(Array.isArray(capas) && capas.length,
      "grupoPernos() necesita aplastamientoEn: [{ t_cm, acero }] — las partes que aplastan\n" +
      "  contra el perno en una misma dirección. En corte simple, cada plancha; en doble,\n" +
      "  la del centro por un lado y la suma de las dos exteriores por otro.");
    const h = di.agujero_cm;
    const lcBorde = d.le_cm - h / 2;
    const lcInterior = nf > 1 ? d.s_cm - h : Infinity;

    let total = 0, peor = null;
    const porCapa = capas.map((c) => {
      const ab = aplastamiento(Object.assign({}, c, { d_cm: di.d_cm, lc_cm: lcBorde,
        deformacion: d.deformacion }));
      const ai = nf > 1 ? aplastamiento(Object.assign({}, c, { d_cm: di.d_cm, lc_cm: lcInterior,
        deformacion: d.deformacion })) : null;
      const grupo = nl * (ab.phiRn_kgf + (nf - 1) * (ai ? ai.phiRn_kgf : 0));
      return { t_cm: c.t_cm, borde: ab, interior: ai, phiRn_kgf: grupo };
    });
    const capaGob = porCapa.reduce((a, b) => (b.phiRn_kgf < a.phiRn_kgf ? b : a));
    const vPerno = p.phiRnv_kgf;
    const efBorde = Math.min(vPerno, capaGob.borde.phiRn_kgf);
    const efInt = capaGob.interior ? Math.min(vPerno, capaGob.interior.phiRn_kgf) : 0;
    total = nl * (efBorde + (nf - 1) * efInt);
    const corteTotal = nl * nf * vPerno;
    peor = corteTotal <= capaGob.phiRn_kgf ? "corte de los pernos" : "aplastamiento o desgarramiento";

    const out = {
      n: nf * nl, porLinea: nf, lineas: nl,
      lcBorde_cm: lcBorde, lcInterior_cm: lcInterior === Infinity ? null : lcInterior,
      corte_kgf: corteTotal, aplastamiento_kgf: capaGob.phiRn_kgf,
      phiRn_kgf: total, gobierna: peor,
      porCapa: porCapa, perno: p,
      distancias: distancias({ diametro: d.diametro, s_cm: nf > 1 ? d.s_cm : undefined,
        le_cm: d.le_cm, lt_cm: d.lt_cm, bordeCizallado: d.bordeCizallado,
        t_cm: Math.min.apply(null, capas.map((c) => c.t_cm)) }),
      art: ART["J.pernos.Rn"], artAplast: ART["J.aplast.ambos"]
    };
    /* el grupo con la otra norma en la columna de corte, recalculado entero */
    const otra = (n) => {
      const v = p.conLasDos[n].phiRnv_kgf;
      return nl * (Math.min(v, capaGob.borde.phiRn_kgf) +
        (nf - 1) * (capaGob.interior ? Math.min(v, capaGob.interior.phiRn_kgf) : 0));
    };
    out.conLasDos = { E090: otra("E090"), AISC: otra("AISC") };
    if (d.Pu_kgf !== undefined) {
      out.Pu_kgf = d.Pu_kgf; out.ratio = d.Pu_kgf / total; out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* ¿Cuántos pernos?  Con todos iguales al peor: el desgarramiento con la
     menor de las dos lc, como hace McCormac en el 12-2. */
  function pernosNecesarios(d) {
    exige(d.Pu_kgf > 0, "pernosNecesarios() necesita Pu_kgf > 0");
    const p = perno(d);
    const di = diametro(d.diametro);
    const h = di.agujero_cm;
    const lc = Math.min(d.le_cm - h / 2, d.s_cm > 0 ? d.s_cm - h : Infinity);
    const capas = d.aplastamientoEn;
    exige(Array.isArray(capas) && capas.length, "pernosNecesarios() necesita aplastamientoEn");
    const ap = Math.min.apply(null, capas.map((c) =>
      aplastamiento(Object.assign({}, c, { d_cm: di.d_cm, lc_cm: lc, deformacion: d.deformacion })).phiRn_kgf));
    const porPerno = (n) => Math.min(p.conLasDos[n].phiRnv_kgf, ap);
    const cuenta = (n) => ({ porPerno_kgf: porPerno(n), exacto: d.Pu_kgf / porPerno(n),
      n: Math.ceil(d.Pu_kgf / porPerno(n) - 1e-9) });
    const out = {
      lc_cm: lc, aplastamientoPorPerno_kgf: ap, corteporPerno_kgf: p.phiRnv_kgf,
      gobierna: p.phiRnv_kgf <= ap ? "corte" : "aplastamiento o desgarramiento",
      conLasDos: { E090: cuenta("E090"), AISC: cuenta("AISC") },
      norma: p.norma, art: ART["J.pernos.Fnv.divergencia"]
    };
    Object.assign(out, cuenta(p.norma));
    out.cuestaLaE090 = out.conLasDos.E090.n - out.conLasDos.AISC.n;
    return out;
  }

  /* =====================================================================
     ELEMENTOS DE CONEXIÓN · J4
     ===================================================================== */
  function elementoTraccion(d) {
    const mat = materialDe(d);
    const Ag = d.Ag_cm2, An = d.An_cm2;
    exige(Ag > 0 && An > 0, "elementoTraccion() necesita Ag_cm2 y An_cm2");
    exige(An <= Ag + 1e-9, "An no puede superar Ag");
    const U = (d.U === undefined) ? 1 : d.U;
    exige(U > 0 && U <= 1, "U va en (0, 1]");
    const Ae = U * An;
    const fl = PHI.tFluencia * mat.Fy * Ag;
    const ro = PHI.tRotura * mat.Fu * Ae;
    /* la E.090 topa An en 0,85·Ag · fila J.elem.085 */
    const AnE090 = Math.min(An, 0.85 * Ag);
    const roE090 = PHI.tRotura * mat.Fu * U * AnE090;
    const out = {
      Ag_cm2: Ag, An_cm2: An, U: U, Ae_cm2: Ae,
      fluencia_kgf: fl, rotura_kgf: ro,
      phiRn_kgf: Math.min(fl, ro), gobierna: ro < fl ? "rotura" : "fluencia",
      roturaE090_kgf: roE090, phiRnE090_kgf: Math.min(fl, roE090),
      topeE090: An > 0.85 * Ag,
      art: ART["J.elem.traccion"], artTope: ART["J.elem.085"]
    };
    if (out.topeE090 && roE090 < Math.min(fl, ro)) {
      out.avisoE090 = "An/Ag = " + (An / Ag).toFixed(3) + " > 0,85: la E.090 topa el área " +
        "neta y daría " + (out.phiRnE090_kgf / 1000).toFixed(2) + " t en vez de " +
        (out.phiRn_kgf / 1000).toFixed(2) + " t. Manda el AISC 360-22, que quitó el tope.";
    }
    if (d.Pu_kgf !== undefined) {
      out.Pu_kgf = d.Pu_kgf; out.ratio = d.Pu_kgf / out.phiRn_kgf; out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  function elementoCorte(d) {
    const mat = materialDe(d);
    const Agv = d.Agv_cm2, Anv = d.Anv_cm2;
    exige(Agv > 0 && Anv > 0, "elementoCorte() necesita Agv_cm2 y Anv_cm2");
    exige(Anv <= Agv + 1e-9, "Anv no puede superar Agv");
    const fl = PHI.vFluencia * 0.60 * mat.Fy * Agv;
    const flE = PHI.vFluenciaE090 * 0.60 * mat.Fy * Agv;
    const ro = PHI.vRotura * 0.60 * mat.Fu * Anv;
    const out = {
      fluencia_kgf: fl, rotura_kgf: ro,
      phiRn_kgf: Math.min(fl, ro), gobierna: ro < fl ? "rotura" : "fluencia",
      fluenciaE090_kgf: flE, phiRnE090_kgf: Math.min(flE, ro),
      art: ART["J.elem.corte"]
    };
    if (out.phiRnE090_kgf < out.phiRn_kgf - 1e-9) {
      out.avisoE090 = "la E.090 usa φ = 0,90 en la fluencia por corte y daría un " +
        ((1 - out.phiRnE090_kgf / out.phiRn_kgf) * 100).toFixed(1) + " % menos. Manda el AISC.";
    }
    if (d.Vu_kgf !== undefined) {
      out.Vu_kgf = d.Vu_kgf; out.ratio = d.Vu_kgf / out.phiRn_kgf; out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  function elementoCompresion(d) {
    const mat = materialDe(d);
    exige(d.Ag_cm2 > 0 && d.Lc_cm > 0 && d.r_cm > 0,
      "elementoCompresion() necesita Ag_cm2, Lc_cm = K·L y r_cm");
    const esb = d.Lc_cm / d.r_cm;
    exige(esb <= 25,
      "Lc/r = " + esb.toFixed(1) + " > 25: la cartela es esbelta y J4.4 manda al Capítulo E.\n" +
      "  Va por acero.compresion(), que es donde está el pandeo. Aquí no se calcula para no\n" +
      "  tener dos copias del Capítulo E.");
    const out = { Lc_r: esb, phiRn_kgf: PHI.compresion * mat.Fy * d.Ag_cm2,
      art: ART["J.elem.compresion"] };
    if (d.Pu_kgf !== undefined) {
      out.Pu_kgf = d.Pu_kgf; out.ratio = d.Pu_kgf / out.phiRn_kgf; out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* el bloque de cortante ya está en acero.js, con su divergencia: no se copia */
  function bloqueCortante(d) { return AC.bloqueCortante(d); }

  /* =====================================================================
     LOS EXTREMOS · lo que de verdad se diseña en un galpón
     ===================================================================== */

  /* ---------- extremo empernado de plancha ------------------------------
     Planchas unidas con pernos en líneas paralelas a la carga: el empalme
     de la brida, la plancha a la cartela.  Todos los estados límite de la
     conexión, con su ratio, y cuál gobierna. */
  function extremoEmpernado(d) {
    exige(d.Pu_kgf > 0, "extremoEmpernado() necesita Pu_kgf");
    const placas = d.placas;
    exige(Array.isArray(placas) && placas.length,
      "extremoEmpernado() necesita placas: [{ nombre, t_cm, ancho_cm, acero }]");
    const di = diametro(d.diametro);
    const nl = d.lineas || 1, nf = d.porLinea;
    const estados = [];
    const pon = (estado, phiRn, art, extra) => estados.push(Object.assign(
      { estado: estado, phiRn_kgf: phiRn, ratio: d.Pu_kgf / phiRn, art: art }, extra || {}));

    /* los pernos, con el aplastamiento en cada plancha */
    const grupo = grupoPernos(Object.assign({}, d, {
      aplastamientoEn: d.aplastamientoEn || placas.map((p) => ({ t_cm: p.t_cm, acero: p.acero,
        Fy_kgcm2: p.Fy_kgcm2, Fu_kgcm2: p.Fu_kgcm2 }))
    }));
    pon("pernos: corte" + (grupo.gobierna === "corte de los pernos" ? "" : " y aplastamiento"),
      grupo.phiRn_kgf, grupo.art, { conLasDos: grupo.conLasDos });

    for (const p of placas) {
      const nom = p.nombre || ("plancha de " + p.t_cm + " cm");
      const Ag = p.ancho_cm * p.t_cm;
      const an = AC.areaNeta({ Ag_cm2: Ag, t_cm: p.t_cm, nAgujeros: nl, dAgujero_cm: di.agujero_cm });
      const et = elementoTraccion({ acero: p.acero, Fy_kgcm2: p.Fy_kgcm2, Fu_kgcm2: p.Fu_kgcm2,
        Ag_cm2: Ag, An_cm2: an.An_cm2, U: 1 });
      pon(nom + ": fluencia", et.fluencia_kgf, et.art);
      pon(nom + ": rotura", et.rotura_kgf, et.art, { An_cm2: an.An_cm2,
        roturaE090_kgf: et.roturaE090_kgf, avisoE090: et.avisoE090 });

      /* BLOQUE DE CORTANTE, por los dos caminos: el bloque entre líneas y los
         bloques hacia los bordes laterales; manda el menor */
      if (d.s_cm !== undefined || nf === 1) {
        const hNeto = di.agujero_cm + 0.2;     /* fila T.An.agujero */
        const lv = d.le_cm + (nf - 1) * (d.s_cm || 0);
        /* con UNA línea el bloque se arranca por un solo plano de corte y
           tracciona hacia un borde; con dos o más, por las dos líneas de fuera */
        const planosV = nl > 1 ? 2 : 1;
        const Agv = planosV * lv * p.t_cm;
        const Anv = planosV * (lv - (nf - 0.5) * hNeto) * p.t_cm;
        const caminos = [];
        if (nl > 1 && d.g_cm > 0) {
          const Agt = (nl - 1) * d.g_cm * p.t_cm;
          caminos.push({ camino: "entre líneas", Agt: Agt,
            Ant: ((nl - 1) * d.g_cm - (nl - 1) * hNeto) * p.t_cm });
        }
        if (d.lt_cm > 0) {
          caminos.push({ camino: planosV === 2 ? "hacia los bordes" : "hacia el borde",
            Agt: planosV * d.lt_cm * p.t_cm, Ant: planosV * (d.lt_cm - hNeto / 2) * p.t_cm });
        }
        let mejor = null;
        for (const c of caminos) {
          if (c.Ant <= 0 || Anv <= 0) continue;
          const b = AC.bloqueCortante({ acero: p.acero, Fy_kgcm2: p.Fy_kgcm2, Fu_kgcm2: p.Fu_kgcm2,
            Agv_cm2: Agv, Anv_cm2: Anv, Ant_cm2: c.Ant, Agt_cm2: c.Agt, Ubs: 1.0 });
          if (!mejor || b.Rd_kgf < mejor.b.Rd_kgf) mejor = { c: c, b: b };
        }
        if (mejor) {
          pon(nom + ": bloque de cortante (" + mejor.c.camino + ")", mejor.b.Rd_kgf, mejor.b.art,
            { Rd_E090_kgf: mejor.b.Rd_E090_kgf });
        }
      }
    }
    return cierra(estados, d, { grupo: grupo });
  }

  /* ---------- extremo soldado de plancha --------------------------------
     Plancha soldada con filetes longitudinales a los dos lados, y opcional
     un transversal: el ángulo de la riostra, la plancha a la cartela. */
  function extremoSoldado(d) {
    exige(d.Pu_kgf > 0, "extremoSoldado() necesita Pu_kgf");
    const p = d.placa;
    exige(p && p.t_cm > 0 && p.ancho_cm > 0, "extremoSoldado() necesita placa: { t_cm, ancho_cm, acero }");
    exige(d.Llado_cm > 0, "extremoSoldado() necesita Llado_cm, la longitud de CADA filete longitudinal");
    const estados = [];
    const pon = (estado, phiRn, art, extra) => estados.push(Object.assign(
      { estado: estado, phiRn_kgf: phiRn, ratio: d.Pu_kgf / phiRn, art: art }, extra || {}));

    const tam = tamanosFilete({ t1_mm: p.t_cm * 10, t2_mm: d.tOtra_mm || p.t_cm * 10, w_mm: d.w_mm });
    let sold;
    if (d.Ltrans_cm > 0) {
      sold = grupoFiletes({ w_mm: d.w_mm, electrodo: d.electrodo,
        Llong_cm: 2 * d.Llado_cm, Ltrans_cm: d.Ltrans_cm });
      pon("soldadura (longitudinal + transversal)", sold.phiRn_kgf, sold.art);
    } else {
      sold = filete({ w_mm: d.w_mm, electrodo: d.electrodo, L_cm: d.Llado_cm });
      pon("soldadura", 2 * sold.phiRn_kgf, sold.art,
        { phiRnE090_kgf: 2 * sold.phiRnE090_kgf, avisos: sold.avisos });
    }

    const Ag = p.ancho_cm * p.t_cm;
    let U = 1, uInfo = null;
    if (!(d.Ltrans_cm > 0)) {
      uInfo = AC.factorU({ caso: "4", l_cm: d.Llado_cm, w_cm: p.ancho_cm, filete_cm: d.w_mm / 10 });
      U = uInfo.U;
    }
    const et = elementoTraccion({ acero: p.acero, Fy_kgcm2: p.Fy_kgcm2, Fu_kgcm2: p.Fu_kgcm2,
      Ag_cm2: Ag, An_cm2: Ag, U: U });
    pon("plancha: fluencia", et.fluencia_kgf, et.art);
    pon("plancha: rotura", et.rotura_kgf, et.art, { U: U, U_E090: uInfo ? uInfo.U_E090 : 1,
      artU: uInfo ? uInfo.art : null });

    return cierra(estados, d, { tamanos: tam, soldadura: sold, U: U });
  }

  function cierra(estados, d, extra) {
    estados.sort((a, b) => b.ratio - a.ratio);
    const g = estados[0];
    return Object.assign({
      Pu_kgf: d.Pu_kgf, estados: estados,
      gobierna: g.estado, phiRn_kgf: g.phiRn_kgf, ratio: g.ratio,
      cumple: g.ratio <= 1 + 1e-12
    }, extra);
  }

  /* =====================================================================
     LA BARRA DEL TIJERAL A SU CARTELA · filas J.union.angulo y siguientes
     d = { perfil (L ó 2L), acero, tCartela_cm, Nt_kgf (tracción), Nc_kgf (compresión, > 0),
           union: "soldadas" | "empernadas",
           soldadas: Lw_cm (cada filete), w_mm, electrodo
           empernadas: porLinea, diametro, grado, s_cm, le_cm, g_cm }
     ===================================================================== */
  const TAN30 = Math.tan(Math.PI / 6);
  function unionAngulo(d) {
    const p = d.perfil, tg = d.tCartela_cm;
    exige(p && (p.familia === "L" || p.familia === "2L"), "unionAngulo() es para barras de ángulo simple o doble");
    exige(tg > 0, "unionAngulo() necesita el espesor de la cartela");
    const nAng = p.familia === "2L" ? 2 : 1;
    const t = p.t_cm, b = Math.max(p.b_cm || 0, p.d_cm || 0);    /* el ala que se une */
    const N = Math.max(d.Nt_kgf || 0, d.Nc_kgf || 0);
    exige(N > 0, "unionAngulo() necesita alguna fuerza");
    const mat = materialDe(d);
    const estados = [], omitidos = [];
    const pon = (estado, phiRn, F, art, extra) => estados.push(Object.assign(
      { estado: estado, phiRn_kgf: phiRn, Pu_kgf: F, ratio: F / phiRn, art: art }, extra || {}));
    let L, W, Wn;
    if (d.union === "soldadas") {
      exige(d.Lw_cm > 0 && d.w_mm > 0, "la unión soldada necesita la longitud de cada filete y su tamaño");
      /* los filetes: a lo largo del talón y de la punta, en cada ángulo · J1.7 los exime de balancearse */
      const f = filete({ w_mm: d.w_mm, electrodo: d.electrodo, L_cm: d.Lw_cm });
      pon("soldadura: " + 2 * nAng + " filetes de " + d.w_mm + " mm × " + d.Lw_cm + " cm", 2 * nAng * f.phiRn_kgf, N,
        f.art, { avisos: f.avisos });
      const tam = tamanosFilete({ t1_mm: t * 10, t2_mm: tg * 10, tBorde_mm: t * 10, w_mm: d.w_mm,
        sistema: sistemaDe(p) });
      if (!tam.cumpleMin || !tam.cumpleMax) {
        omitidos.push({ que: "el tamaño del filete", esencial: true, art: tam.art,
          motivo: d.w_mm + " mm está fuera de " + tam.wMin_mm.toFixed(1) + " a " + tam.wMax_mm.toFixed(1) +
            " mm (Tabla J2.4 y J2.2b" + (tam.sistema === "pulgadas" ? ", en pulgadas" : "") + ")" });
      }
      /* el bloque de cortante del ángulo y de la cartela, sin agujeros · fila J.bloque.soldado */
      if (d.Nt_kgf > 0) {
        const ba = AC.bloqueCortante({ acero: d.acero, Fy_kgcm2: d.Fy_kgcm2, Fu_kgcm2: d.Fu_kgcm2,
          Agv_cm2: 2 * d.Lw_cm * t, Anv_cm2: 2 * d.Lw_cm * t, Agt_cm2: b * t, Ant_cm2: b * t, Ubs: 1.0 });
        pon("ángulo: bloque de cortante", nAng * ba.Rd_kgf, d.Nt_kgf, ART["J.bloque.soldado"]);
        const bg = AC.bloqueCortante({ acero: d.acero, Fy_kgcm2: d.Fy_kgcm2, Fu_kgcm2: d.Fu_kgcm2,
          Agv_cm2: 2 * d.Lw_cm * tg, Anv_cm2: 2 * d.Lw_cm * tg, Agt_cm2: b * tg, Ant_cm2: b * tg, Ubs: 1.0 });
        pon("cartela: bloque de cortante", bg.Rd_kgf, d.Nt_kgf, ART["J.bloque.soldado"]);
      }
      L = d.Lw_cm; W = b + 2 * L * TAN30; Wn = W;
    } else if (d.union === "empernadas") {
      exige(d.porLinea >= 1 && d.diametro && d.grado, "la unión empernada necesita los pernos por línea, su diámetro y su grado");
      exige(d.le_cm > 0 && d.g_cm > 0 && (d.porLinea === 1 || d.s_cm > 0),
        "la unión empernada necesita la separación s, la distancia al borde le y el gramil g (fila J.pernos.detalle)");
      const di = diametro(d.diametro);
      /* corte doble con el ángulo doble: la cartela aplasta contra la suma de las dos alas */
      const capas = nAng === 2 ? [{ t_cm: tg, acero: d.acero, Fy_kgcm2: d.Fy_kgcm2, Fu_kgcm2: d.Fu_kgcm2 },
        { t_cm: 2 * t, acero: d.acero, Fy_kgcm2: d.Fy_kgcm2, Fu_kgcm2: d.Fu_kgcm2 }]
        : [{ t_cm: t, acero: d.acero, Fy_kgcm2: d.Fy_kgcm2, Fu_kgcm2: d.Fu_kgcm2 },
          { t_cm: tg, acero: d.acero, Fy_kgcm2: d.Fy_kgcm2, Fu_kgcm2: d.Fu_kgcm2 }];
      const gp = grupoPernos({ grado: d.grado, diametro: d.diametro, porLinea: d.porLinea, lineas: 1,
        s_cm: d.s_cm, le_cm: d.le_cm, lt_cm: b - d.g_cm, planos: nAng, aplastamientoEn: capas, norma: d.norma });
      pon("pernos: " + gp.gobierna, gp.phiRn_kgf, N, gp.art, { distancias: gp.distancias });
      if (gp.distancias && !gp.distancias.ok) {
        omitidos.push({ que: "las distancias de los pernos", esencial: true, art: ART["J.pernos.detalle"],
          motivo: "no cumplen los mínimos de J3.3 o J3.4" });
      }
      if (d.Nt_kgf > 0) {
        const hNeto = di.agujero_cm + 0.2;
        const lv = d.le_cm + (d.porLinea - 1) * (d.s_cm || 0);
        const Agv = lv * t, Anv = (lv - (d.porLinea - 0.5) * hNeto) * t;
        const Agt = (b - d.g_cm) * t, Ant = (b - d.g_cm - hNeto / 2) * t;
        if (Anv > 0 && Ant > 0) {
          const ba = AC.bloqueCortante({ acero: d.acero, Fy_kgcm2: d.Fy_kgcm2, Fu_kgcm2: d.Fu_kgcm2,
            Agv_cm2: Agv, Anv_cm2: Anv, Agt_cm2: Agt, Ant_cm2: Ant, Ubs: 1.0 });
          pon("ángulo: bloque de cortante", nAng * ba.Rd_kgf, d.Nt_kgf, ba.art);
        }
      }
      L = (d.porLinea - 1) * (d.s_cm || 0); W = Math.max(di.agujero_cm, 2 * L * TAN30); Wn = W - (di.agujero_cm + 0.2);
    } else {
      exige(false, "la unión es «soldadas» ó «empernadas»");
    }
    /* la cartela en tracción por la sección de Whitmore · fila J.whitmore */
    if (d.Nt_kgf > 0) {
      pon("cartela: fluencia en la sección de Whitmore", PHI.tFluencia * mat.Fy * W * tg, d.Nt_kgf, ART["J.whitmore"],
        { W_cm: W });
      if (Wn > 0) pon("cartela: rotura en la sección de Whitmore", PHI.tRotura * mat.Fu * Wn * tg, d.Nt_kgf, ART["J.whitmore"]);
    }
    if (d.Nc_kgf > 0) {
      omitidos.push({ que: "la cartela a compresión", esencial: false, art: ART["J.cartela.pandeo"],
        motivo: "hace falta su longitud libre, que no está en el modelo (fila J.cartela.pandeo)" });
    }
    const r = cierra(estados, { Pu_kgf: N });
    r.omitidos = omitidos;
    r.faltanEsenciales = omitidos.some((o) => o.esencial);
    r.cumple = r.cumple && !r.faltanEsenciales;
    r.nAngulos = nAng; r.W_cm = W;
    r.art = ART["J.union.angulo"]; r.artExcentricidad = ART["J.excentricidad.angulo"];
    return r;
  }

  /* las conexiones de deslizamiento crítico se piden y se niegan */
  function deslizamiento() { noDeslizamiento({ deslizamientoCritico: true }); }

  return {
    ART, PHI, PERNOS, METRICOS, PULGADAS, ELECTRODOS_KSI, FNW, GARGANTA, NORMAS,
    fexx, minimoTabla, sistemaDe, tamanosFilete, filete, grupoFiletes,
    diametro, perno, traccionCorte, aplastamiento, distancias,
    grupoPernos, pernosNecesarios,
    elementoTraccion, elementoCorte, elementoCompresion, bloqueCortante,
    extremoEmpernado, extremoSoldado, deslizamiento, unionAngulo
  };
});
