/* =====================================================================
   correas.js — la correa de techo

   La pieza más numerosa del galpón y la que más se despacha a ojo.  Tiene
   tres cosas que no tiene ninguna otra:

   1) FLEXIÓN BIAXIAL POR GEOMETRÍA, no por excentricidad.  La correa está
      inclinada con el faldón, así que una carga VERTICAL se descompone en
      una componente perpendicular al techo —que flexiona el eje mayor— y
      otra paralela al faldón —que flexiona el eje MENOR—.  El viento, en
      cambio, actúa perpendicular al techo y solo carga el eje mayor.  Esa
      diferencia es la razón de que la combinación de gravedad y la de viento
      pidan cosas distintas de la misma correa.

   2) LOS TENSORES ACORTAN LA LUZ, pero SOLO en el eje menor.  Un tensor a
      media luz parte en dos el tramo de la componente paralela y no toca la
      perpendicular.  Como el momento va con L², dos tensores dividen el
      momento del eje débil por nueve.  Es la pieza barata que evita subir
      de perfil, y es el motivo de que existan (filas F.F6.sinLTB y
      SV.larguero.L).

   3) LA COBERTURA DECIDE LA SEPARACIÓN, no el cálculo de la correa.  La
      tabla del TR-4 da la carga viva NETA que aguanta el panel según su luz
      —que es la separación entre correas— y su continuidad.  Si el panel no
      llega, no hay correa que lo arregle: hay que juntarlas (fila
      D.cobertura.tabla).

   Y LA HIPÓTESIS QUE SOSTIENE TODO EL CAPÍTULO F · F1(b) supone los apoyos
   restringidos contra la rotación alrededor del eje longitudinal.  Una
   correa POSADA sobre el tijeral no lo cumple: por eso se fija con clip
   (fila F.hipotesis).
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./acero.js"),
      require("./elemento.js"), cargaTR4());
  } else {
    raiz.CORREAS = definir(raiz.INVENTARIO, raiz.ACERO, raiz.ELEMENTO, raiz.TR4_DATOS);
  }

  function cargaTR4() {
    const fs = require("fs"), path = require("path");
    const f = path.join(__dirname, "..", "catalogos", "coberturas", "tr4.json");
    if (!fs.existsSync(f)) {
      throw new Error(
        "correas: falta catalogos/coberturas/tr4.json.\n" +
        "  Es la tabla de cargas del panel, y sin ella no se puede decidir la\n" +
        "  separación entre correas. Va versionada en el repositorio porque se\n" +
        "  transcribió de una IMAGEN del PDF del fabricante: no hay script que la\n" +
        "  regenere.");
    }
    return JSON.parse(fs.readFileSync(f, "utf8"));
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC, EL, TR4) {
  "use strict";

  const ART = INV.declara("correas.js", [
    "D.cobertura.tabla", "D.cobertura.neta", "D.cobertura.peso",
    "D.cobertura.pendmin", "D.cobertura.fijacion",
    "SV.cobertura.defl", "SV.correa.Ld", "SV.deflex", "SV.carga.defl",
    "F.F6.sinLTB", "F.hipotesis", "N.no.viento"
  ]);

  const ESBELTEZ_LD = 70450;      /* L/d ≤ 70450/Fy · fila SV.correa.Ld */

  /* ---------- la cobertura decide la separación ------------------------ */
  /* Devuelve la carga viva NETA que aguanta el panel con esa separación.
     `separacion_m` es la LUZ DEL PANEL, o sea la distancia entre correas. */
  function capacidadPanel(d) {
    const e = d.espesor_mm, sep = d.separacion_m, tramos = d.tramos;
    if (!(e > 0)) throw new Error("correas: capacidadPanel() necesita espesor_mm");
    if (!(sep > 0)) {
      throw new Error("correas: capacidadPanel() necesita separacion_m, que es la LUZ " +
        "DEL PANEL, o sea la distancia entre correas");
    }
    if ([1, 2, 3].indexOf(tramos) < 0) {
      throw new Error(
        "correas: hay que decir sobre cuántos tramos apoya el panel: 1, 2 ó 3.\n" +
        "  La ficha da tres tablas y la continuidad sube la capacidad: con 0,45-0,50\n" +
        "  a 1,50 m son 150 kgf/m² con un tramo y 188 con tres, un 25 % más.");
    }

    let iChapa = -1;
    for (let i = 0; i < TR4.chapas.length; i++) {
      const c = TR4.chapas[i];
      if (e >= c.min_mm - 1e-9 && e <= c.max_mm + 1e-9) { iChapa = i; break; }
    }
    if (iChapa < 0) {
      throw new Error(
        "correas: no hay tabla para una chapa de " + e + " mm.\n" +
        "  La ficha tabula cuatro rangos: " +
        TR4.chapas.map((c) => c.espesor).join(" · ") + " mm.\n" +
        "  Los huecos entre rangos no son descuido: esa plancha no se fabrica.");
    }

    const L = TR4.luces_m;
    const fila = TR4.tramos[String(tramos)][iChapa];
    if (sep < L[0] - 1e-9 || sep > L[L.length - 1] + 1e-9) {
      throw new Error(
        "correas: la separación de " + sep + " m está fuera de la tabla (" +
        L[0] + " a " + L[L.length - 1] + " m).\n" +
        "  Y la tabla NO se extrapola: 1 y 2 tramos dan lo mismo hasta 2,50 m y solo\n" +
        "  difieren después, así que no es una familia mecánica suave.");
    }

    /* Se interpola linealmente EN LA LUZ, que es la única dirección donde la
       tabla se comporta como una curva.  Entre número de tramos no se
       interpola: son tablas distintas. */
    let j = 0;
    while (j < L.length - 1 && L[j + 1] < sep - 1e-9) j++;
    if (Math.abs(L[j] - sep) < 1e-9) {
      const v = fila[j];
      if (v === null) return sinValor(sep, tramos, TR4.chapas[iChapa]);
      return { P_kgfm2: v, interpolado: false, chapa: TR4.chapas[iChapa].espesor,
        tramos: tramos, art: ART["D.cobertura.tabla"], neta: true,
        notaNeta: TR4.nota_neta, deflexion: TR4.deflexion };
    }
    const a = fila[j], b = fila[j + 1];
    if (a === null || b === null) return sinValor(sep, tramos, TR4.chapas[iChapa]);
    const t = (sep - L[j]) / (L[j + 1] - L[j]);
    return { P_kgfm2: a + t * (b - a), interpolado: true,
      entre: [L[j], L[j + 1]], chapa: TR4.chapas[iChapa].espesor, tramos: tramos,
      art: ART["D.cobertura.tabla"], neta: true,
      notaNeta: TR4.nota_neta, deflexion: TR4.deflexion };
  }

  function sinValor(sep, tramos, chapa) {
    throw new Error(
      "correas: la ficha NO da capacidad para la chapa " + chapa.espesor + " mm a " +
      sep + " m con " + tramos + " tramo(s).\n" +
      "  Las celdas vacías de la tabla son «no se recomienda», no «cero»: el\n" +
      "  fabricante no respalda esa combinación. Junta las correas o sube de chapa.");
  }

  /* ¿Aguanta el panel la carga viva que le toca? */
  function verificaPanel(d) {
    const cap = capacidadPanel(d);
    const q = d.vivaNeta_kgfm2;
    if (!(q >= 0)) {
      throw new Error(
        "correas: verificaPanel() necesita vivaNeta_kgfm2.\n" +
        "  Y es NETA: el peso del panel ya está dentro de la tabla, así que NO se\n" +
        "  suma. Sumarlo es contarlo dos veces.");
    }
    return Object.assign(cap, { demanda_kgfm2: q, ratio: q / cap.P_kgfm2,
      cumple: q <= cap.P_kgfm2 + 1e-9 });
  }

  /* ---------- descomposición de la carga en el plano del faldón ------- */
  /* UNA CARGA VERTICAL se reparte entre los dos ejes de la correa; una
     PERPENDICULAR al techo, como el viento, va entera al eje mayor. */
  function descompone(d) {
    const th = d.theta_grad;
    if (typeof th !== "number" || th < 0 || th >= 90) {
      throw new Error("correas: descompone() necesita theta_grad entre 0 y 90");
    }
    const c = Math.cos(th * Math.PI / 180), s = Math.sin(th * Math.PI / 180);
    const wv = d.vertical_kgfm || 0;         /* gravedad */
    const wp = d.perpendicular_kgfm || 0;    /* viento */
    return {
      /* la vertical se proyecta; la perpendicular ya lo está */
      wMayor_kgfm: wv * c + wp,
      wMenor_kgfm: wv * s,
      cos: c, sen: s, theta_grad: th,
      nota: "la carga vertical se descompone porque la correa está inclinada con el " +
            "faldón; el viento actúa perpendicular al techo y solo carga el eje mayor"
    };
  }

  /* ---------- los tensores acortan la luz · SOLO en el eje menor ------ */
  function luces(d) {
    const L = d.L_m, n = d.tensores;
    if (!(L > 0)) throw new Error("correas: luces() necesita L_m > 0, la separación de pórticos");
    if (!(n >= 0) || n !== Math.round(n)) {
      throw new Error("correas: tensores tiene que ser un entero ≥ 0");
    }
    return {
      LMayor_m: L,               /* los tensores NO tocan el eje mayor */
      LMenor_m: L / (n + 1),
      tensores: n,
      /* El momento va con L², así que dos tensores dividen por nueve el del
         eje débil. Es la pieza barata que evita subir de perfil. */
      factorMomentoMenor: 1 / Math.pow(n + 1, 2),
      art: ART["F.F6.sinLTB"],
      nota: "los tensores parten el tramo del eje MENOR y no tocan el mayor. Como " +
            "M va con L², " + n + " tensor(es) dividen el momento débil por " +
            Math.pow(n + 1, 2)
    };
  }

  /* ---------- la esbeltez de la correa · fila SV.correa.Ld ------------ */
  /* ADOPTADO, no norma: Zapata 7.4 citando el comentario AISC-ASD L3.1. El
     LRFD no fija límites de deflexión, así que esto es criterio con su
     procedencia escrita. */
  function esbeltezLd(d) {
    const L = d.L_cm, h = d.d_cm, Fy = d.Fy_kgcm2;
    if (!(L > 0) || !(h > 0)) throw new Error("correas: esbeltezLd() necesita L_cm y d_cm");
    if (!(Fy > 0)) throw new Error("correas: esbeltezLd() necesita Fy_kgcm2");
    const lim = ESBELTEZ_LD / Fy;
    return { Ld: L / h, limite: lim, pasa: L / h <= lim, esRechazo: false,
      art: ART["SV.correa.Ld"],
      nota: "criterio ADOPTADO, no norma: el LRFD no fija límites de deflexión. " +
            "Viene de Zapata 7.4 citando el comentario AISC-ASD L3.1." };
  }

  /* ---------- la correa entera ---------------------------------------- */
  function verifica(d) {
    const p = d.perfil;
    if (!p) throw new Error("correas: verifica() necesita un perfil");
    const th = d.theta_grad;
    const desc = descompone({ theta_grad: th, vertical_kgfm: d.wVertical_kgfm,
      perpendicular_kgfm: d.wPerpendicular_kgfm });
    const lu = luces({ L_m: d.L_m, tensores: d.tensores === undefined ? 0 : d.tensores });

    /* Momentos de una viga simplemente apoyada en cada eje, con SU luz.
       Quien quiera continuidad pasa los momentos directamente. */
    const Lmay = lu.LMayor_m * 100, Lmen = lu.LMenor_m * 100;
    const Mux = (d.Mux_kgfcm !== undefined) ? d.Mux_kgfcm
      : desc.wMayor_kgfm / 100 * Lmay * Lmay / 8;
    const Muy = (d.Muy_kgfcm !== undefined) ? d.Muy_kgfcm
      : desc.wMenor_kgfm / 100 * Lmen * Lmen / 8;
    const Vu = (d.Vu_kgf !== undefined) ? d.Vu_kgf
      : Math.abs(desc.wMayor_kgfm / 100 * Lmay / 2);

    /* LA LONGITUD NO ARRIOSTRADA DEL EJE MAYOR NO ES LA LUZ SI HAY TENSORES,
       pero tampoco es la luz partida: un tensor sujeta la correa contra el
       desplazamiento LATERAL, o sea contra el pandeo lateral-torsional. Así
       que Lb sí se acorta. Lo que NO se acorta es la luz de flexión del eje
       mayor. Distinguirlo es el detalle que se cuela. */
    const Lb_cm = (d.Lb_cm !== undefined) ? d.Lb_cm : Lmen;

    const r = EL.verifica({
      id: d.id || "CORREA", perfil: p, acero: d.acero || "A36",
      combinacion: d.combinacion, fabricacion: d.fabricacion || p.fabricacion,
      origenFuerzas: d.origenFuerzas,
      fuerzas: { Mux_kgfcm: Mux, Muy_kgfcm: Muy, Vu_kgf: Vu, Pu_kgf: d.Pu_kgf || 0 },
      longitudes: { Lb_cm: Lb_cm, Lc_cm: d.Lc_cm, r_cm: d.r_cm },
      geometriaF2: d.geometriaF2, Cb: d.Cb, bF6_cm: d.bF6_cm, noEsbelta: d.noEsbelta,
      elementosEsbeltez: d.elementosEsbeltez
    });

    return Object.assign({}, r, {
      descomposicion: desc, luces: lu,
      Mux_kgfcm: Mux, Muy_kgfcm: Muy, Vu_kgf: Vu, Lb_cm: Lb_cm,
      artHipotesis: ART["F.hipotesis"],
      notaHipotesis: "F1(b) supone los apoyos sin girar sobre su eje longitudinal: " +
        "la correa se fija con CLIP, no se posa. Si se posa, el Capítulo F no aplica " +
        "tal cual y todo esto deja de valer."
    });
  }

  return { ART, TR4, ESBELTEZ_LD,
    capacidadPanel, verificaPanel, descompone, luces, esbeltezLd, verifica };
});
