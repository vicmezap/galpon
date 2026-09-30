/* =====================================================================
   riostras.js — el arriostre que no empuja

   Una riostra en cruz de varilla roscada no toma compresión: se afloja.
   Modelarla como una barra normal reparte la fuerza entre las dos diagonales
   y da la mitad de tracción en la que trabaja — la que hay que diseñar.

   LA TÉCNICA · fila E.tension.only.  No es un artículo de norma, es modelado:
   se corre, se quitan las que salieron comprimidas, se vuelve a correr, y se
   para cuando dos corridas consecutivas dan el mismo conjunto activo.

   LA CONSECUENCIA SÍ ES NORMA · E.090 §2.7: los elementos diseñados para
   tracción «que pueden estar sometidos a una compresión reducida en otra
   condición de carga, no necesitan cumplir el límite de esbeltez en
   compresión».  Por eso una varilla de 5/8" con Kl/r de 600 es legal.

   EL CONJUNTO SOLO SE ENCOGE, y es a propósito.  Quitar y volver a poner en
   la misma iteración es lo que hace que estos procesos oscilen para siempre;
   quitando solamente, el proceso termina en como mucho tantas pasadas como
   riostras haya, y eso se puede demostrar en vez de esperarlo.  La prueba lo
   comprueba contando.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./solver.js"));
  } else {
    raiz.RIOSTRAS = definir(raiz.INVENTARIO, raiz.SOLVER);
  }
})(typeof self !== "undefined" ? self : this, function (INV, SOLVER) {
  "use strict";

  const ART = INV.declara("riostras.js", ["E.tension.only", "T.esbeltez", "E.C3.arriostre"]);

  /* Una compresión por debajo de esto es ruido numérico de la propia
     eliminación, no una barra que empuja.  Relativa a la mayor axial del
     modelo: en valores absolutos no significaría nada. */
  const TOL_COMPRESION = 1e-9;

  /* Copia superficial del modelo sin las barras desactivadas.  No se toca el
     modelo original: quien llamó tiene que poder volver a correrlo. */
  function sin(m, fuera) {
    return {
      nombre: m.nombre, nivel: m.nivel, combinacion: m.combinacion,
      nudos: m.nudos,
      barras: m.barras.filter((b) => fuera.indexOf(b.id) < 0),
      cargasNudo: m.cargasNudo,
      cargasBarra: m.cargasBarra.filter((c) => fuera.indexOf(c.barra) < 0)
    };
  }

  /* ---------- la iteración ---------------------------------------------- */
  /* `soloTraccion` es la lista de ids de barras que no toman compresión. */
  function resuelve(m, opciones) {
    const op = opciones || {};
    const candidatas = op.soloTraccion || [];
    for (const id of candidatas) {
      if (!m.barras.some((b) => b.id === id)) {
        throw new Error("riostras: «" + id + "» no es una barra de este modelo");
      }
    }
    if (!candidatas.length) {
      const r = SOLVER.resuelve(m, op);
      r.riostras = { iteraciones: 1, desactivadas: [], activas: [], historial: [],
        convergio: true, art: ART["E.tension.only"] };
      return r;
    }

    const maxIter = candidatas.length + 2;   /* cota demostrable, más margen */
    const fuera = [];
    const historial = [];

    for (let it = 1; it <= maxIter; it++) {
      let r;
      try {
        r = SOLVER.resuelve(sin(m, fuera), op);
      } catch (e) {
        if (/SINGULAR/.test(e.message) && fuera.length) {
          throw new Error(
            "riostras: al quitar las riostras comprimidas la estructura se quedó\n" +
            "  sin arriostrar y salió un mecanismo.\n" +
            "  Quitadas hasta ahora: " + fuera.join(", ") + "\n" +
            "  Pasa cuando las dos diagonales de una cruz salen comprimidas a la\n" +
            "  vez, y eso casi siempre significa que el sentido de la carga lateral\n" +
            "  está invertido, o que falta el arriostre del otro sentido. Un galpón\n" +
            "  necesita las dos cruces: el viento sopla de los dos lados.\n" +
            "  (" + e.message.split("\n")[0] + ")");
        }
        throw e;
      }

      /* escala: la mayor axial en valor absoluto de toda la corrida */
      let escala = 0;
      for (const b of Object.keys(r.fuerzas)) {
        escala = Math.max(escala, Math.abs(r.fuerzas[b].N_kgf));
      }
      const ref = Math.max(escala, 1);

      const comprimidas = [];
      for (const id of candidatas) {
        if (fuera.indexOf(id) >= 0) continue;
        const N = r.fuerzas[id].N_kgf;
        if (N < -TOL_COMPRESION * ref) comprimidas.push(id);
      }
      historial.push({
        iteracion: it,
        activas: candidatas.filter((id) => fuera.indexOf(id) < 0),
        comprimidas: comprimidas.slice()
      });

      if (!comprimidas.length) {
        r.riostras = {
          iteraciones: it,
          desactivadas: fuera.slice(),
          activas: candidatas.filter((id) => fuera.indexOf(id) < 0),
          historial: historial,
          convergio: true,
          art: ART["E.tension.only"],
          artEsbeltez: ART["T.esbeltez"],
          nota: "las activas quedan en tracción; las desactivadas no toman carga. " +
                "E.090 §2.7 las exime del límite de esbeltez en compresión"
        };
        return r;
      }
      for (const id of comprimidas) fuera.push(id);
    }

    /* Con retirada monótona esto es inalcanzable, y por eso está: si algún
       día alguien hace que una barra pueda volver a entrar, este mensaje es
       la diferencia entre enterarse y quedarse colgado. */
    throw new Error(
      "riostras: la iteración no convergió en " + maxIter + " pasadas.\n" +
      "  Con retirada monótona esto no debería poder pasar: el conjunto activo\n" +
      "  solo se encoge, así que termina en como mucho " + candidatas.length + " pasadas.\n" +
      "  Historial: " + historial.map((h) => "#" + h.iteracion + " quita [" +
        h.comprimidas.join(",") + "]").join(" · "));
  }

  /* ---------- la cruz de San Andrés ------------------------------------- */
  /* Atajo para el caso normal: dos diagonales entre las mismas dos parejas de
     nudos.  Devuelve los ids para pasarlos como soloTraccion. */
  function cruz(m, MODELO, d) {
    const a = MODELO.barra(m, {
      id: d.id + "-a", i: d.inferiorIzq, j: d.superiorDer,
      A_cm2: d.A_cm2, I_cm4: 0, E_kgcm2: d.E_kgcm2,
      liberaI: true, liberaJ: true, perfil: d.perfil || null
    });
    const b = MODELO.barra(m, {
      id: d.id + "-b", i: d.inferiorDer, j: d.superiorIzq,
      A_cm2: d.A_cm2, I_cm4: 0, E_kgcm2: d.E_kgcm2,
      liberaI: true, liberaJ: true, perfil: d.perfil || null
    });
    return { ids: [a.id, b.id], barras: [a, b], art: ART["E.tension.only"] };
  }

  /* ---------- lo que el arriostre tiene que ganarse · fila E.C3.arriostre */
  /* «Bracing intended to define the unbraced lengths of members shall have
     sufficient stiffness and strength to control member movement at the
     braced points.»  Aquí solo se deja anotada la obligación con su cita: la
     comprobación del Apéndice 6 es de E4, no de aquí, y decir que un punto
     está arriostrado sin haberla hecho es la forma habitual de conseguir una
     longitud no arriostrada que no existe. */
  function exigeApendice6(d) {
    return {
      punto: d.punto || null,
      elemento: d.elemento || null,
      comprobado: false,
      art: ART["E.C3.arriostre"],
      pendiente: "rigidez y resistencia del arriostre según el Apéndice 6 (E4)",
      nota: "si la correa se toma como punto de arriostre de la brida superior, " +
            "la correa Y SU CONEXIÓN tienen que cumplirlo. No basta con que pase por ahí."
    };
  }

  return { ART, TOL_COMPRESION, resuelve, cruz, exigeApendice6, sin };
});
