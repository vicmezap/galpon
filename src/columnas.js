/* =====================================================================
   columnas.js — la columna del pórtico y la columna hastial

   La columna de un galpón es una VIGA-COLUMNA: le llega axial del techo y
   momento del viento sobre el cerramiento, que los largueros le traspasan.
   Lo que la distingue de cualquier otra pieza del proyecto es esto:

   SUS TRES LONGITUDES EFECTIVAS SON DISTINTAS, y confundirlas es el error
   habitual:
       Lcx · en el plano del pórtico   → la altura entera (K = 1, Método Directo)
       Lcy · fuera del plano           → la separación de LARGUEROS
       Lcz · torsión                   → normalmente también la altura entera,
                                          salvo que el larguero impida el giro
   Un larguero cada 1,5 m deja Lcy = 150 cm y Lcx = 700: un factor casi 5.
   Meter la altura entera en los tres es tirar media columna a la basura;
   meter la separación de largueros en los tres es quedarse corto en el
   plano, que es lo peligroso.

   Y ES EL CASO PARA EL QUE EXISTE H1.3 · perfil laminado compacto de doble
   simetría con flexión principalmente de eje mayor.  Permite separar la
   inestabilidad EN el plano de la de FUERA, y sale menos conservador que la
   interacción única.  La E.090 NO lo tiene (fila H.1_3.div), así que se
   ofrece como opción y el módulo calcula las DOS para que la diferencia se
   vea.

   EL PÉNDULO INVERTIDO · fila S.pendulo.  Un tijeral apoyado sobre columnas
   en voladizo concentra la masa arriba y resiste con columnas empotradas
   abajo: R₀ = 2,5 y no los 4 de un OMF.  Como V va con 1/R, equivocarse da
   el 62,5 % de la fuerza.  Aquí se detecta por la geometría y se pregunta.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./acero.js"),
      require("./elemento.js"));
  } else {
    raiz.COLUMNAS = definir(raiz.INVENTARIO, raiz.ACERO, raiz.ELEMENTO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC, EL) {
  "use strict";

  const ART = INV.declara("columnas.js", [
    "E.C3.K", "E.C3.arriostre", "C.E4.Fex", "C.E4.aplica",
    "H.1_3", "H.1_3.eq", "H.1_3.div", "H.1a", "H.Pr",
    "S.pendulo", "SV.viento.H", "SV.larguero.L", "SV.hastial.L", "F.hipotesis"
  ]);

  const DERIVA_VIENTO = 100;       /* H/100 · fila SV.viento.H, adoptado */
  const DEFLEX_LARGUERO = 120;     /* L/120 · fila SV.larguero.L, adoptado */
  const DEFLEX_HASTIAL = 120;      /* L/120 · fila SV.hastial.L, adoptado */

  /* ---------- las tres longitudes efectivas --------------------------- */
  /* K = 1 en las tres bajo Método Directo · fila E.C3.K.  Lo que cambia es
     la longitud NO ARRIOSTRADA, y ésa la fija cómo está sujeta la columna. */
  function longitudes(d) {
    const H = d.altura_m;
    if (!(H > 0)) throw new Error("columnas: longitudes() necesita altura_m > 0");
    const sep = d.separacionLargueros_m;
    if (!(sep > 0)) {
      throw new Error(
        "columnas: falta separacionLargueros_m.\n" +
        "  Es la que arriostra la columna FUERA del plano del pórtico. Sin ella la\n" +
        "  longitud fuera del plano sería la altura entera, y eso tira media columna\n" +
        "  a la basura: con largueros cada 1,5 m y 7 m de altura, el factor es casi 5.\n" +
        "  Si de verdad no hay largueros, pásalo igual a la altura.");
    }
    if (sep > H + 1e-9) {
      throw new Error("columnas: la separación de largueros (" + sep + " m) no puede " +
        "superar la altura (" + H + " m)");
    }
    /* La torsión: el larguero sujeta lateralmente, pero impedir el GIRO de la
       sección pide algo más —un arriostre en cruz o una conexión que tuerza—.
       Por omisión se toma la altura entera, que es lo conservador, y hay que
       declararlo si se quiere menos. */
    const torsionArriostrada = d.torsionArriostrada === true;
    return {
      Lcx_cm: H * 100,                        /* en el plano del pórtico */
      Lcy_cm: sep * 100,                      /* fuera del plano */
      Lcz_cm: torsionArriostrada ? sep * 100 : H * 100,
      K: 1, art: ART["E.C3.K"], artArriostre: ART["E.C3.arriostre"],
      torsionArriostrada: torsionArriostrada,
      razonLcxLcy: (H * 100) / (sep * 100),
      nota: "K = 1 en las tres por Método Directo; lo que cambia es la longitud NO " +
            "ARRIOSTRADA. La torsión se toma con la altura entera salvo que se " +
            "declare arriostrada: el larguero sujeta lateralmente, pero impedir el " +
            "GIRO de la sección pide algo más.",
      deuda: "el Apéndice 6 del larguero se comprueba con arriostres.js —resistencia Y " +
             "RIGIDEZ—. Decir que un punto está arriostrado sin comprobarlo da una " +
             "longitud que no existe. Lo que sí es de E7 es su CONEXIÓN, que la norma " +
             "dimensiona aparte, como arriostre puntual (fila A6.conexion)."
    };
  }

  /* ---------- ¿es un péndulo invertido? · fila S.pendulo -------------- */
  /* No se decide solo: se detecta la geometría candidata y se pregunta,
     porque la consecuencia es un factor 1,6 en la fuerza sísmica. */
  function esPenduloInvertido(d) {
    const razones = [];
    if (d.baseEmpotrada === true) razones.push("las columnas están empotradas en la base");
    if (d.cumbreArticulada === true) {
      razones.push("el tijeral no da continuidad de momento en la cumbre");
    }
    if (d.masaConcentradaArriba === true) razones.push("la masa está concentrada arriba");
    const candidato = razones.length >= 2;
    return {
      candidato: candidato, razones: razones,
      R0siLoEs: 2.5, art: ART["S.pendulo"],
      nota: candidato
        ? "GEOMETRÍA CANDIDATA a péndulo invertido: R₀ = 2,5 y no los 4 de un OMF. " +
          "Como V va con 1/R, tratarlo como OMF da el 62,5 % de la fuerza. " +
          "No lo decide este módulo: lo decide el proyectista, y queda escrito."
        : "no parece un péndulo invertido con los datos dados",
      pregunta: candidato
        ? "¿Se clasifica como péndulo invertido (R₀ = 2,5)? Hay que responderlo antes " +
          "de correr el sismo."
        : null
    };
  }

  /* ---------- la columna como viga-columna ---------------------------- */
  /* Calcula la interacción por H1.1 SIEMPRE, y además por H1.3 cuando se
     cumplen sus tres condiciones.  Las dos, para que la diferencia se vea:
     H1.3 sale menos conservador y la E.090 no lo tiene. */
  function verifica(d) {
    const p = d.perfil;
    if (!p) throw new Error("columnas: verifica() necesita un perfil");
    const L = d.longitudes;
    if (!L || !(L.Lcx_cm > 0)) {
      throw new Error("columnas: verifica() necesita las longitudes de longitudes()");
    }

    /* EN EL PLANO gobierna rx con Lcx; FUERA del plano, ry con Lcy.  El
       Capítulo E toma el MENOR de los dos, que es lo que vale para H1.1. */
    const lrx = L.Lcx_cm / p.rx_cm, lry = L.Lcy_cm / p.ry_cm;
    const gobiernaFuera = lry > lrx;

    const base = {
      id: d.id || "COLUMNA", perfil: p, acero: d.acero || "A36",
      combinacion: d.combinacion, familia: p.familia,
      fabricacion: d.fabricacion || p.fabricacion,
      origenFuerzas: d.origenFuerzas,
      noEsbelta: d.noEsbelta, elementosEsbeltez: d.elementosEsbeltez,
      arriostreComprobado: d.arriostreComprobado,
      fuerzas: { Pu_kgf: d.Pu_kgf, Mux_kgfcm: d.Mux_kgfcm, Muy_kgfcm: d.Muy_kgfcm,
        Vu_kgf: d.Vu_kgf },
      longitudes: { Lc_cm: gobiernaFuera ? L.Lcy_cm : L.Lcx_cm,
        r_cm: gobiernaFuera ? p.ry_cm : p.rx_cm,
        Lb_cm: d.Lb_cm !== undefined ? d.Lb_cm : L.Lcy_cm },
      geometriaF2: d.geometriaF2, Cb: d.Cb, bF6_cm: d.bF6_cm
    };
    const porH1 = EL.verifica(base);

    const salida = Object.assign({}, porH1, {
      lrx: lrx, lry: lry, gobiernaFueraDelPlano: gobiernaFuera,
      longitudes: L,
      notaLongitudes: "Lc/r en el plano " + lrx.toFixed(1) + " y fuera " + lry.toFixed(1) +
        ": gobierna " + (gobiernaFuera ? "FUERA del plano" : "EN el plano"),
      artHipotesis: ART["F.hipotesis"]
    });

    /* ---- H1.3 · separar en el plano y fuera, si se puede ---- */
    if (d.H13) {
      const puede = AC.puedeSepararH13({
        Lcz_cm: L.Lcz_cm, Lcy_cm: L.Lcy_cm,
        Mry_kgfcm: d.Muy_kgfcm, Mcy_kgfcm: d.H13.Mcy_kgfcm,
        laminadoCompactoDobleSimetria: d.H13.laminadoCompactoDobleSimetria
      });
      salida.H13 = { puede: puede.puede, razones: puede.razones, art: puede.art,
        artDivergencia: puede.artDivergencia, nota: puede.nota };
      if (puede.puede) {
        const fp = AC.fueraDelPlanoH13({
          origen: d.origenFuerzas, Pr_kgf: d.Pu_kgf, Pcy_kgf: d.H13.Pcy_kgf,
          Mrx_kgfcm: d.Mux_kgfcm, McxCb1_kgfcm: d.H13.McxCb1_kgfcm, Cb: d.H13.Cb
        });
        salida.H13.fueraDelPlano = fp;
        salida.H13.ratioH11 = porH1.ratio;
        salida.H13.ratioH13 = fp.valor;
        salida.H13.ahorro = 1 - fp.valor / porH1.ratio;
        salida.H13.comentario = "H1.3 da " + (fp.valor < porH1.ratio ? "MENOS" : "más") +
          " que la interacción única. La E.090 no lo trae, así que es opción y no " +
          "defecto: usarlo hay que justificarlo.";
      }
    }
    return salida;
  }

  /* ---------- servicio · la deriva y las deflexiones ------------------ */
  /* LOS TRES SON CRITERIOS ADOPTADOS, no norma, y se dice: el LRFD no fija
     límites de deflexión.  Vienen del AISC Design Guide 3, que el propio J9
     recomienda por nombre. */
  function deriva(d) {
    const H = d.altura_cm, delta = Math.abs(d.desplazamiento_cm);
    if (!(H > 0)) throw new Error("columnas: deriva() necesita altura_cm > 0");
    if (!(delta >= 0)) throw new Error("columnas: deriva() necesita desplazamiento_cm");
    const lim = H / DERIVA_VIENTO;
    return { delta_cm: delta, limite_cm: lim, razon: delta / lim,
      pasa: delta <= lim, esRechazo: false, art: ART["SV.viento.H"],
      nota: "H/100 ADOPTADO del AISC Design Guide 3 para cerramiento metálico sobre " +
            "pórtico desnudo. El DG3 lo da con viento de 10 años y aquí se usa con el " +
            "de diseño de la E.020, de 50: queda del lado seguro." };
  }

  function deflexionLarguero(d) {
    const L = d.L_cm, delta = Math.abs(d.desplazamiento_cm);
    if (!(L > 0)) throw new Error("columnas: deflexionLarguero() necesita L_cm > 0");
    const lim = L / DEFLEX_LARGUERO;
    return { delta_cm: delta, limite_cm: lim, razon: delta / lim, pasa: delta <= lim,
      esRechazo: false, art: ART["SV.larguero.L"],
      nota: "L/120 adoptado del DG3 · METAL PANELS / GIRTS" };
  }

  /* ---------- la columna hastial -------------------------------------- */
  /* Otra pieza: no lleva la carga del techo del pórtico, lleva VIENTO sobre
     el hastial y se comporta como una viga vertical.  Su criterio de
     servicio es L/120 (fila SV.hastial.L) y tenía la nota «no teníamos
     criterio para este elemento» hasta que se leyó el DG3. */
  function columnaHastial(d) {
    const p = d.perfil;
    if (!p) throw new Error("columnas: columnaHastial() necesita un perfil");
    const H = d.altura_m;
    if (!(H > 0)) throw new Error("columnas: columnaHastial() necesita altura_m > 0");
    const w = d.wViento_kgfm;
    if (typeof w !== "number") {
      throw new Error("columnas: columnaHastial() necesita wViento_kgfm, la carga de " +
        "viento repartida en su altura");
    }
    const Hc = H * 100;
    /* Simplemente apoyada entre la base y el tijeral, salvo que se den los
       momentos. */
    const Mu = (d.Mu_kgfcm !== undefined) ? d.Mu_kgfcm : Math.abs(w / 100) * Hc * Hc / 8;
    const Vu = (d.Vu_kgf !== undefined) ? d.Vu_kgf : Math.abs(w / 100) * Hc / 2;
    const sep = d.separacionLargueros_m;
    if (!(sep > 0)) {
      throw new Error(
        "columnas: la columna hastial también necesita separacionLargueros_m.\n" +
        "  Es lo que fija su Lb: sin largueros, la longitud no arriostrada es la\n" +
        "  altura entera y el pandeo lateral-torsional la gobierna con holgura.");
    }
    const r = EL.verifica({
      id: d.id || "HASTIAL", perfil: p, acero: d.acero || "A36",
      combinacion: d.combinacion, familia: p.familia,
      fabricacion: d.fabricacion || p.fabricacion, origenFuerzas: d.origenFuerzas,
      fuerzas: { Mux_kgfcm: Mu, Vu_kgf: Vu, Pu_kgf: d.Pu_kgf || 0 },
      longitudes: { Lb_cm: sep * 100, Lc_cm: d.Lc_cm, r_cm: d.r_cm },
      geometriaF2: d.geometriaF2, Cb: d.Cb, bF6_cm: d.bF6_cm,
      noEsbelta: d.noEsbelta, elementosEsbeltez: d.elementosEsbeltez
    });
    return Object.assign({}, r, {
      Mu_kgfcm: Mu, Vu_kgf: Vu, Lb_cm: sep * 100,
      servicio: d.desplazamiento_cm !== undefined
        ? (function () {
            const lim = Hc / DEFLEX_HASTIAL;
            return { delta_cm: Math.abs(d.desplazamiento_cm), limite_cm: lim,
              pasa: Math.abs(d.desplazamiento_cm) <= lim, esRechazo: false,
              art: ART["SV.hastial.L"] };
          })()
        : null,
      nota: "la columna hastial NO lleva la carga del techo del pórtico: lleva viento " +
            "sobre el hastial y trabaja como viga vertical"
    });
  }

  return { ART, DERIVA_VIENTO, DEFLEX_LARGUERO, DEFLEX_HASTIAL,
    longitudes, esPenduloInvertido, verifica, deriva, deflexionLarguero, columnaHastial };
});
