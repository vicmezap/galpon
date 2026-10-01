/* =====================================================================
   combinaciones.js — cierra E2

   Aquí aterriza la fila J.costura, que es el hallazgo más importante de la
   sección de conexiones: EL ACERO Y EL CONCRETO NO USAN LOS MISMOS FACTORES
   DE CARGA.  Este módulo genera las DOS familias desde los MISMOS casos sin
   factorizar, y no hay camino para pasar de una a la otra.

       E.090 §1.4.1   1,2 D + 1,6 L + 0,5(Lr ó S ó R)   ...   0,9 D − 1,3 W
       E.060 §9.2     1,4 CM + 1,7 CV                   ...   0,9 CM ± 1,25 CVi

   Pasar una reacción ya combinada con la E.090 a una zapata diseñada con la
   E.060 es un error que ningún resultado delata: los números salen, las
   unidades cuadran, y la zapata queda mal.  Por eso proyecto.js se niega a
   guardar combinaciones (guarda CASOS) y por eso esto existe.

   TRES DIFERENCIAS QUE NO SON DE FACTOR SINO DE ESTRUCTURA:

   1) LA NIEVE.  En el acero es un caso propio con factores propios —0,5 en
      la 1.4-2, 1,6 en la 1.4-3, 0,2 en la 1.4-5—.  En el concreto NO EXISTE
      como caso: la E.060 §9.2.8 manda considerarla carga viva, así que se
      disuelve dentro de CV y se lleva el 1,7.

   2) EL SISMO.  La E.060 mete CS con factor 1,0 mientras el viento CVi va
      con 1,25.  Copiar el 1,25 sobre el sismo sobredimensiona; copiar el 1,0
      sobre el viento deja corto.

   3) LOS GRUPOS «Ó».  «0,5 (Lr ó S ó R)» no es un máximo: es una elección, y
      cada rama da un ESTADO DE CARGA distinto —la nieve desbalanceada carga
      un faldón y la viva de techo los dos—, así que se expanden en
      combinaciones separadas y el diseño toma la envolvente después.

   Y DOS EXENCIONES QUE SON PERMISIVAS, NO PROHIBITIVAS · las dos normas dicen
   «no será necesario», no «está prohibido»:
       E.020 Art. 11.1 · viento y nieve simultáneos
       E.060 §9.2.4    · sismo y viento simultáneos
   Se aplican por omisión y se pueden desactivar, porque una exención que no
   se puede desactivar es una regla, y no es lo que dice la norma.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./e020.js"));
  } else {
    raiz.COMBINACIONES = definir(raiz.INVENTARIO, raiz.E020);
  }
})(typeof self !== "undefined" ? self : this, function (INV, E020) {
  "use strict";

  const ART = INV.declara("combinaciones.js", [
    "U.1", "U.2", "U.3", "U.4", "U.5", "U.6", "U.L1",
    "U060.1", "U060.viento", "U060.sismo", "U060.CS", "U060.nieve",
    "U060.noSimul", "U060.suelo",
    "N.no.viento", "J.costura"
  ]);

  /* Los casos del proyecto, sin factorizar.  Son los de proyecto.js. */
  const CASOS = ["D", "L", "Lr", "S", "W", "E", "R"];

  /* El grupo «ó» de la E.090: carga viva de techo, nieve o lluvia. */
  const GRUPO_TECHO = ["Lr", "S", "R"];

  /* ---------- E.090 §1.4.1 · acero --------------------------------------
     Cada plantilla es una lista de términos.  `grupo: "techo"` marca el
     término que hay que expandir en una combinación por cada caso presente;
     `alt` marca las alternativas de la 1.4-3. */
  const E090 = [
    { id: "1.4-1", art: "U.1", t: [["D", 1.4]] },
    { id: "1.4-2", art: "U.2", t: [["D", 1.2], ["L", 1.6]], techo: 0.5 },
    { id: "1.4-3", art: "U.3", t: [["D", 1.2]], techo: 1.6, alt: [[["L", 0.5]], [["W", 0.8]]] },
    { id: "1.4-4", art: "U.4", t: [["D", 1.2], ["W", 1.3], ["L", 0.5]], techo: 0.5 },
    /* EL ± DE LA NORMA, que se perdía en el texto. La E.090 escribe
       «1,2D ± 1,0E …» y «0,9D ± (1,3W ó 1,0E)», leído en la página renderizada
       (pdftotext se come el ±). Los factores se guardan como estaban; masmenos marca
       los términos que la norma escribe con ±, y texto() los pinta así. El
       análisis aplica el factor con su magnitud a cada estado físico, que van
       en las dos direcciones (fila A.viento.signo). */
    { id: "1.4-5", art: "U.5", t: [["D", 1.2], ["E", 1.0], ["L", 0.5], ["S", 0.2]], masmenos: ["E"] },
    { id: "1.4-6", art: "U.6", t: [["D", 0.9], ["W", -1.3]], masmenos: ["W"] },
    { id: "1.4-6E", art: "U.6", t: [["D", 0.9], ["E", -1.0]], masmenos: ["E"] }
  ];

  /* El factor de L sube a 1,0 en la 1.4-3, 1.4-4 y 1.4-5 cuando la carga viva
     pasa de 4800 Pa · fila U.L1.  En un galpón no suele pasar, pero si hay
     mezanine de almacenamiento sí. */
  const CON_L1 = ["1.4-3", "1.4-4", "1.4-5"];
  const L1_UMBRAL_PA = 4800;

  /* ---------- E.060 §9.2 · concreto ------------------------------------- */
  const E060 = [
    { id: "9-1", art: "U060.1", t: [["CM", 1.4], ["CV", 1.7]] },
    { id: "9-2", art: "U060.viento", t: [["CM", 1.25], ["CV", 1.25]], pm: ["CVi", 1.25] },
    { id: "9-3", art: "U060.viento", t: [["CM", 0.9]], pm: ["CVi", 1.25] },
    { id: "9-4", art: "U060.sismo", t: [["CM", 1.25], ["CV", 1.25]], pm: ["CS", 1.0] },
    { id: "9-5", art: "U060.sismo", t: [["CM", 0.9]], pm: ["CS", 1.0] },
    { id: "9-6", art: "U060.suelo", t: [["CM", 1.4], ["CV", 1.7], ["CE", 1.7]] },
    { id: "9-7", art: "U060.suelo", t: [["CM", 0.9], ["CE", 1.7]] }
  ];

  /* ---------- utilidades ------------------------------------------------ */
  function presentes(casos) {
    if (!casos || typeof casos !== "object") {
      throw new Error(
        "combinaciones: hay que pasar los casos presentes en el proyecto.\n" +
        "  paraAcero({ casos: { D: true, Lr: true, W: true } })\n" +
        "  Se pasan los CASOS SIN FACTORIZAR, nunca combinaciones: la E.090 y la\n" +
        "  E.060 usan factores distintos y cada una arma los suyos (fila J.costura).");
    }
    for (const k of Object.keys(casos)) {
      if (CASOS.indexOf(k) < 0 && ["CE"].indexOf(k) < 0) {
        throw new Error("combinaciones: «" + k + "» no es un caso de carga. Son " +
          CASOS.join(" · ") + " (y CE para el empuje de suelos en la E.060).");
      }
    }
    if (!casos.D) {
      throw new Error(
        "combinaciones: falta el caso D.\n" +
        "  Las seis combinaciones de la E.090 llevan carga muerta, y una\n" +
        "  estructura sin peso propio no existe. Si la intención es ver solo el\n" +
        "  efecto del viento, ese es un CASO, no una combinación.");
    }
    return casos;
  }

  function limpia(t) {
    /* Quita los términos cuyo caso no existe en el proyecto, y la combinación
       entera si se queda sin nada que no sea D. */
    return t.filter((x) => x[1] !== 0);
  }

  function texto(t, masmenos) {
    return t.map(([c, f], i) => {
      const s = (masmenos && masmenos.indexOf(c) >= 0) ? " ± " : (f < 0 ? " − " : (i === 0 ? "" : " + "));
      return s + Math.abs(f) + " " + c;
    }).join("");
  }

  /* ---------- la familia del acero -------------------------------------- */
  function paraAcero(d) {
    const casos = presentes(d.casos);
    const vivaAlta = d.vivaAlta_Pa !== undefined && d.vivaAlta_Pa > L1_UMBRAL_PA;
    /* Exención del Art. 11.1 de la E.020, leída de e020.js y no re-decidida.
       Es permisiva, así que se puede desactivar. */
    const nieveConViento = (d.nieveConViento === undefined)
      ? E020.NIEVE_CON_VIENTO : d.nieveConViento;

    const out = [];
    const descartadas = [];
    const vistos = new Map();

    /* TEXTUAL, E.090 §1.4.1: «El efecto crítico puede ocurrir cuando una o
       más cargas NO ESTÉN ACTUANDO.» La norma manda evaluar la combinación con
       el término a cero, no descartarla.  Mi primera versión descartaba la
       combinación entera cuando faltaba un caso, y por eso se perdía
       1,2 D + 1,6 Lr —la 1.4-3 sin L ni W—, que es la que gobierna la gravedad
       de un techo: el techo quedaba dimensionado con 0,5 Lr en vez de 1,6 Lr,
       un factor 3,2 de menos sobre la carga viva. */
    for (const p of E090) {
      /* El grupo «Lr ó S ó R»: una rama por caso presente, y si no hay
         ninguno el término vale cero y la combinación sigue existiendo. */
      let ramasTecho = p.techo
        ? GRUPO_TECHO.filter((c) => casos[c]).map((c) => [[c, p.techo]])
        : [[]];
      if (!ramasTecho.length) ramasTecho = [[]];

      /* Las alternativas de la 1.4-3, y SIEMPRE tambien la rama sin ninguna,
         por la misma frase del §1.4.1.  No es redundancia: con nieve y viento
         a la vez, las dos alternativas con W se descartan por la exención del
         Art. 11.1 y sin esta rama se perdería 1,2 D + 1,6 S, que es la que
         gobierna la gravedad de un techo con nieve.  Fue el mismo error dos
         veces: descartar la combinación en vez de poner el término a cero. */
      const ramasAlt = (p.alt ? p.alt.filter((a) => casos[a[0][0]]) : []).concat([[]]);

      for (const rt of ramasTecho) {
        for (const ra of ramasAlt) {
          let t = p.t.concat(rt, ra).filter(([c]) => casos[c]);

          /* factor de L a 1,0 · fila U.L1 */
          if (vivaAlta && CON_L1.indexOf(p.id) >= 0) {
            t = t.map(([c, f]) => (c === "L" ? [c, 1.0] : [c, f]));
          }

          /* Una que se queda solo con D no aporta nada: 1,4 D la envuelve
             —es mayor que 1,2 D y que 0,9 D—. Se quita como DUPLICADO, no
             por interpretar la norma. */
          if (p.id !== "1.4-1" && t.length === 1 && t[0][0] === "D") continue;

          const tieneW = t.some(([c]) => c === "W");
          const tieneS = t.some(([c]) => c === "S");
          if (!nieveConViento && tieneW && tieneS) {
            descartadas.push({
              id: p.id, terminos: t, texto: texto(t, p.masmenos),
              motivo: "viento y nieve no simultáneos · E.020 Art. 11.1",
              art: ART["N.no.viento"]
            });
            continue;
          }

          /* Dos plantillas pueden degenerar en la MISMA combinación cuando
             faltan casos —sin Lr ni W, la 1.4-3 y la 1.4-4 dan las dos
             1,2 D + 0,5 L—. Se emite una vez, citando las dos. */
          const clave = texto(t, p.masmenos);
          if (vistos.has(clave)) {
            const y = vistos.get(clave);
            if (y.tambien.indexOf(p.id) < 0) y.tambien.push(p.id);
            continue;
          }
          const fila = { id: p.id, norma: "E.090", terminos: limpia(t), texto: clave,
            tambien: [], art: ART[p.art] };
          vistos.set(clave, fila);
          out.push(fila);
        }
      }
    }

    return {
      norma: "E.090 §1.4.1", familia: "acero",
      combinaciones: out, descartadas: descartadas,
      vivaAlta: vivaAlta, nieveConViento: nieveConViento,
      art: ART["J.costura"]
    };
  }

  /* ---------- la familia del concreto ----------------------------------- */
  /* AQUÍ SE TRADUCEN LOS CASOS, y la traducción no es un renombre:
         D          -> CM
         L y Lr     -> CV
         S          -> CV     (E.060 §9.2.8: la nieve es carga viva)
         R          -> CV
         W          -> CVi
         E          -> CS
     La nieve DEJA DE SER UN CASO. Es la costura estructural, no de factor. */
  const MAPA_E060 = { D: "CM", L: "CV", Lr: "CV", S: "CV", R: "CV", W: "CVi", E: "CS", CE: "CE" };

  function traduce(casos) {
    const out = {}, aporta = {};
    for (const k of Object.keys(casos)) {
      if (!casos[k]) continue;
      const dst = MAPA_E060[k];
      out[dst] = true;
      (aporta[dst] = aporta[dst] || []).push(k);
    }
    return { casos: out, aporta: aporta };
  }

  function paraConcreto(d) {
    const casos = presentes(d.casos);
    const tr = traduce(casos);
    /* Exención del §9.2.4, permisiva igual que la de la nieve. */
    const sismoConViento = (d.sismoConViento === undefined) ? false : d.sismoConViento;

    const out = [];
    for (const p of E060) {
      const falta = p.t.some(([c]) => c !== "CM" && !tr.casos[c]);
      if (falta) continue;
      if (p.pm && !tr.casos[p.pm[0]]) continue;
      for (const signo of (p.pm ? [+1, -1] : [0])) {
        let t = p.t.slice();
        if (p.pm) t = t.concat([[p.pm[0], signo * p.pm[1]]]);
        out.push({ id: p.id + (signo ? (signo > 0 ? "+" : "−") : ""),
          norma: "E.060", terminos: t, texto: texto(t), art: ART[p.art] });
      }
    }
    return {
      norma: "E.060 §9.2", familia: "concreto",
      combinaciones: out,
      traduccion: tr.aporta,
      nieveEsViva: casos.S === true,
      sismoConViento: sismoConViento,
      art: ART["J.costura"],
      artNieve: ART["U060.nieve"], artCS: ART["U060.CS"]
    };
  }

  /* ---------- la guarda de la costura ----------------------------------- */
  /* Lo que este módulo existe para impedir.  Se llama desde la interfaz de
     cimentación: si alguien intenta pasarle una reacción ya factorizada, para. */
  function exigeSinFactorizar(reaccion) {
    if (reaccion && reaccion.combinacion !== undefined) {
      throw new Error(
        "combinaciones: esta reacción viene de una COMBINACIÓN (" + reaccion.combinacion + ").\n" +
        "  La cimentación se diseña con la E.060, que usa otros factores:\n" +
        "    acero    1,2 D + 1,6 L   ·   0,9 D − 1,3 W\n" +
        "    concreto 1,4 CM + 1,7 CV ·   0,9 CM ± 1,25 CVi\n" +
        "  Y la nieve no es ni el mismo caso: en la E.060 §9.2.8 es carga viva.\n" +
        "  Pasa los CASOS sin factorizar y deja que paraConcreto() arme los suyos.\n" +
        "  Este error no lo delata ningún resultado: los números salen igual.");
    }
    return true;
  }

  return {
    ART, CASOS, GRUPO_TECHO, E090, E060, MAPA_E060, CON_L1, L1_UMBRAL_PA,
    paraAcero, paraConcreto, traduce, exigeSinFactorizar, texto
  };
});
