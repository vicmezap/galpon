/* =====================================================================
   viento.js — E.020 Cap. 3 · el viento

   Segunda pieza de E2.  Tres pasos y ninguno se salta:

       Vh = V · (h/10)^0,22          velocidad de diseño a la altura h
       C  = Ce − Ci                  forma exterior menos forma interior
       Ph = 0,005 · C · Vh²          presión (+) o succión (−), kgf/m²

   EL SIGNO ES EL RESULTADO, no un detalle.  En un galpón el viento casi
   nunca aprieta: levanta.  La combinación que gobierna el anclaje es
   0,9D − 1,3W, y ahí un Ci mal elegido no se nota en ninguna parte salvo
   en la zapata.

   POR QUÉ Ci ES OBLIGATORIO Y EXPLÍCITO · me equivoqué aquí una vez: tomé
   Ci = ±0,3 de una hoja de clase como si fuera el único caso.  La Tabla 5
   tiene TRES, y la diferencia no es cosmética.  Con el techo a −0,7
   exterior:

       aberturas repartidas    Ci = ±0,3  ->  C = −1,0
       portón a barlovento     Ci = +0,8  ->  C = −1,5      50 % más succión

   Así que la posición del portón es un DATO del proyecto y esta función la
   pide.  No hay valor por omisión.

   LA VELOCIDAD DEL MAPA NO SE HORNEA.  El Anexo 2 es un escaneo con
   isotacas trazadas a mano: no es una tabla, y digitalizarla sería
   inventarse precisión que el original no tiene.  V entra como dato y el
   complemento muestra la imagen.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.VIENTO = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("viento.js", [
    "W.tipo", "W.V.min", "W.V.mapa", "W.Vh", "W.Ph", "W.C",
    "W.T4", "W.T4.inc15", "W.T4.inc1560", "W.T4.inc60",
    "W.T4.paralelas", "W.T4.arcos", "W.T4.otros",
    "W.T5.repartidas", "W.T5.barlovento", "W.T5.sotavento",
    "W.simultaneo", "W.zapata.metodo"
  ]);

  const V_MIN = 75;          /* km/h · fila W.V.min */
  const EXP_ALTURA = 0.22;   /* fila W.Vh */
  const K_PRESION = 0.005;   /* fila W.Ph · da kgf/m² con Vh en km/h */
  const V_MAPA = { min: 30, max: 130 };   /* fila W.V.mapa · rango del Anexo 2 */

  /* Clasificación del Art. 12.2 · fila W.tipo */
  const TIPO_FACTOR = { 1: 1.0, 2: 1.2 };

  /* ---------- velocidad de diseño · Art. 12.3 --------------------------- */
  function velocidadDiseno(d) {
    const V = d.V_kmh, h = d.h_m;
    if (typeof V !== "number" || !(V > 0)) {
      throw new Error(
        "viento: falta la velocidad básica del sitio, V_kmh.\n" +
        "  Sale del Mapa Eólico del Perú (E.020 Anexo 2), que va de " +
        V_MAPA.min + " a " + V_MAPA.max + " km/h para retorno de 50 años.\n" +
        "  No se hornea: es un escaneo con isotacas a mano. El Anexo permite\n" +
        "  además usar la velocidad de un estudio local confiable.");
    }
    if (!(h > 0)) throw new Error("viento: velocidadDiseno() necesita h_m > 0");

    const bruto = V * Math.pow(h / 10, EXP_ALTURA);
    /* EL PISO DE 75 km/h · la fila W.V.min lo da «hasta 10 m».  Se aplica a
       cualquier altura, y no por conservador: Vh crece con h, así que si a
       los 10 m el mínimo es 75, a los 15 m no puede ser menos.  Solo muerde
       cuando V del mapa baja de 75 —el mapa llega a 30—, y ahí muerde bien. */
    const Vh = Math.max(V_MIN, bruto);
    return {
      Vh_kmh: Vh, bruto_kmh: bruto, enMinimo: bruto < V_MIN,
      art: ART["W.Vh"], artMinimo: ART["W.V.min"]
    };
  }

  /* ---------- Ce · Tabla 4, factores de forma exteriores ----------------
     Los incisos que traen DOS valores a barlovento los traen de verdad: hay
     que probar los dos, porque uno comprime y el otro levanta y no se sabe
     cuál gobierna hasta resolver el pórtico.  Devolverlos en una lista es lo
     que impide quedarse con el cómodo. */
  const T4 = {
    vertical:  { barlovento: [+0.8],       sotavento: -0.6, art: "W.T4",
                 que: "superficies verticales de edificios" },
    inc15:     { barlovento: [+0.3, -0.7], sotavento: -0.6, art: "W.T4.inc15",
                 que: "superficies inclinadas a 15° o menos" },
    inc1560:   { barlovento: [+0.7, -0.3], sotavento: -0.6, art: "W.T4.inc1560",
                 que: "superficies inclinadas entre 15° y 60°" },
    inc60:     { barlovento: [+0.8],       sotavento: -0.6, art: "W.T4.inc60",
                 que: "superficies inclinadas entre 60° y la vertical" },
    paralelas: { barlovento: [-0.7],       sotavento: -0.7, art: "W.T4.paralelas",
                 que: "superficies paralelas a la dirección del viento" },
    arcos:     { barlovento: [+0.8],       sotavento: -0.5, art: "W.T4.arcos",
                 que: "arcos y cubiertas cilíndricas ≤ 45°" }
  };

  /* Fuera del alcance del galpón, pero la tabla se hornea completa: es la
     misma Tabla 4 y partirla invita a que alguien la complete a mano. */
  const T4_OTROS = { anuncios: +1.5, tanqueCircular: +0.7, tanqueRectangular: +2.0 };

  /* El faldón del techo, elegido por su inclinación. */
  function ceTecho(theta_grad) {
    if (typeof theta_grad !== "number" || !(theta_grad >= 0) || theta_grad > 90) {
      throw new Error("viento: ceTecho() necesita theta_grad entre 0 y 90");
    }
    const k = theta_grad <= 15 ? "inc15" : (theta_grad <= 60 ? "inc1560" : "inc60");
    const t = T4[k];
    return { caso: k, que: t.que, barlovento: t.barlovento.slice(),
             sotavento: t.sotavento, art: ART[t.art] };
  }

  function ceMuro() {
    const t = T4.vertical;
    return { caso: "vertical", que: t.que, barlovento: t.barlovento.slice(),
             sotavento: t.sotavento, art: ART[t.art] };
  }

  /* ---------- Ci · Tabla 5, factores de forma interiores ----------------
     Los tres casos del Art. 12.5, y hay que ELEGIR.  El que se elige
     depende de dónde está el portón respecto del viento, así que cambia con
     la dirección de análisis: el mismo galpón es «barlovento» en una
     dirección y «sotavento» en la otra. */
  const T5 = {
    repartidas: { Ci: [+0.3, -0.3], art: "W.T5.repartidas",
                  que: "aberturas uniformemente repartidas en barlovento y sotavento" },
    barlovento: { Ci: [+0.8],       art: "W.T5.barlovento",
                  que: "aberturas principales en el lado a barlovento" },
    sotavento:  { Ci: [-0.6],       art: "W.T5.sotavento",
                  que: "aberturas principales a sotavento o en los costados" }
  };
  const ABERTURAS = Object.keys(T5);

  function ci(aberturas) {
    const t = T5[aberturas];
    if (!t) {
      throw new Error(
        "viento: hay que decir dónde están las aberturas: " + ABERTURAS.join(" · ") + ".\n" +
        "  La Tabla 5 tiene TRES casos y no hay uno por omisión. Con el techo a\n" +
        "  −0,7 exterior, «repartidas» da C = −1,0 y «barlovento» da C = −1,5:\n" +
        "  un 50 % más de succión sobre la misma cubierta. La posición del portón\n" +
        "  es un dato del proyecto, y cambia con la dirección de análisis —el\n" +
        "  mismo galpón es barlovento en una dirección y sotavento en la otra—.");
    }
    return { Ci: t.Ci.slice(), que: t.que, art: ART[t.art] };
  }

  /* ---------- C = Ce − Ci · Art. 12.4 y 12.5 ---------------------------- */
  /* Devuelve TODAS las combinaciones de Ce con Ci, no la peor: cuál es la
     peor depende del elemento —para el anclaje es la succión máxima, para la
     correa a compresión puede ser la otra— y eso no se decide aquí. */
  function factorForma(d) {
    const Ce = d.Ce_lista || (typeof d.Ce === "number" ? [d.Ce] : null);
    if (!Ce || !Ce.length) {
      throw new Error("viento: factorForma() necesita Ce o Ce_lista (Tabla 4)");
    }
    const int = ci(d.aberturas);
    const out = [];
    for (const ce of Ce) {
      for (const cint of int.Ci) out.push({ Ce: ce, Ci: cint, C: ce - cint });
    }
    return { casos: out, aberturas: int.que, art: ART["W.C"],
             Cmin: Math.min.apply(null, out.map((x) => x.C)),
             Cmax: Math.max.apply(null, out.map((x) => x.C)) };
  }

  /* ---------- Ph = 0,005·C·Vh² · Art. 12.4 ------------------------------ */
  function presion(d) {
    const C = d.C, Vh = d.Vh_kmh;
    if (typeof C !== "number") throw new Error("viento: presion() necesita C");
    if (!(Vh > 0)) throw new Error("viento: presion() necesita Vh_kmh > 0");
    const tipo = (d.tipo === undefined) ? 1 : d.tipo;
    if (tipo === 3) {
      throw new Error(
        "viento: la edificación Tipo 3 pide análisis especial (E.020 Art. 12.2).\n" +
        "  Son las sensibles a los efectos dinámicos del viento; este módulo\n" +
        "  resuelve el método estático de los Tipos 1 y 2.");
    }
    const f = TIPO_FACTOR[tipo];
    if (f === undefined) {
      throw new Error("viento: el tipo de edificación es 1, 2 o 3 (E.020 Art. 12.2), no «" + tipo + "»");
    }
    return {
      Ph_kgfm2: K_PRESION * C * Vh * Vh * f,
      tipo: tipo, factorTipo: f,
      sentido: C > 0 ? "presión" : (C < 0 ? "succión" : "nula"),
      art: ART["W.Ph"], artTipo: ART["W.tipo"]
    };
  }

  /* ---------- el galpón completo, en una dirección ----------------------
     Enumera las superficies con su C y su Ph.  Aquí vive la regla del
     Art. 12.1: las presiones y succiones exteriores se consideran
     SIMULTÁNEAS, así que esto devuelve un estado de carga entero y no una
     superficie suelta.  El viento se supone además en dos direcciones
     horizontales perpendiculares, y esa segunda pasada es otra llamada con
     las aberturas que corresponda. */
  function casos(d) {
    const vel = velocidadDiseno({ V_kmh: d.V_kmh, h_m: d.h_m });
    const tipo = d.tipo;
    const techo = ceTecho(d.theta_grad);
    const muro = ceMuro();

    const sup = [
      { nombre: "muro barlovento", Ce_lista: [muro.barlovento[0]] },
      { nombre: "muro sotavento", Ce_lista: [muro.sotavento] },
      { nombre: "faldón barlovento", Ce_lista: techo.barlovento },
      { nombre: "faldón sotavento", Ce_lista: [techo.sotavento] },
      /* Los muros LATERALES, paralelos al viento, a −0,7 en las dos caras.
         No cargan el pórtico transversal —están en su plano— pero sí el
         arriostre longitudinal, y el Art. 12.1 los tiene actuando al mismo
         tiempo que los otros cuatro.  Omitirlos aquí obligaría a acordarse
         de ellos en E5, que es cuando ya no se acuerda nadie. */
      { nombre: "muros laterales", Ce_lista: [T4.paralelas.barlovento[0]] }
    ];

    const out = sup.map((s) => {
      const ff = factorForma({ Ce_lista: s.Ce_lista, aberturas: d.aberturas });
      return {
        superficie: s.nombre,
        casos: ff.casos.map((c) => {
          const p = presion({ C: c.C, Vh_kmh: vel.Vh_kmh, tipo: tipo });
          return { Ce: c.Ce, Ci: c.Ci, C: c.C, Ph_kgfm2: p.Ph_kgfm2, sentido: p.sentido };
        })
      };
    });

    return {
      Vh_kmh: vel.Vh_kmh, enMinimo: vel.enMinimo,
      casoTecho: techo.caso, aberturas: d.aberturas,
      superficies: out,
      simultaneas: true, art: ART["W.simultaneo"]
    };
  }

  return {
    ART, V_MIN, EXP_ALTURA, K_PRESION, V_MAPA, TIPO_FACTOR,
    T4, T4_OTROS, T5, ABERTURAS,
    velocidadDiseno, ceTecho, ceMuro, ci, factorForma, presion, casos
  };
});
