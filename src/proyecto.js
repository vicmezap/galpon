/* =====================================================================
   proyecto.js — guardar y abrir el proyecto

   En Retícula esto quedó como «PENDIENTE FINAL» y sigue pendiente.  Aquí
   entra desde el commit 1, y no por prolijidad: añadirlo tarde obliga a
   tocar todos los módulos, porque cada uno tiene que saber serializarse.
   Hacerlo primero fija la forma del modelo antes de que haya nada que
   romper.

   Un proyecto de Galpón es UN OBJETO JSON.  Todo lo que el complemento
   sabe está ahí dentro: el sitio, los materiales, la geometría, las
   secciones adoptadas y el resultado de la última pasada.  Nada vive solo
   en la pantalla.

   DOS DECISIONES QUE VIENEN DEL INVENTARIO:

   1) El proyecto guarda CASOS DE CARGA sin factorizar, nunca combinaciones.
      Es la regla que salió de la fila Z.costura: la E.090 (acero) y la
      E.060 (concreto) usan factores distintos —0,9D − 1,3W contra
      0,9CM − 1,25CVi— así que cada norma tiene que armar los suyos.
      Guardar una reacción ya combinada es un error que ningún resultado
      delata.

   2) El proyecto guarda la versión del esquema.  Un archivo de hoy tiene
      que poder abrirse dentro de un año, y para eso hay que saber con qué
      versión se escribió.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = definir();
  else raiz.PROYECTO = definir();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Sube cuando cambia la FORMA del proyecto, no cuando cambia un cálculo. */
  const ESQUEMA = 1;

  /* Los casos de carga que el proyecto conoce.  Son los de la E.090 §1.4.1,
     que son también los que la E.060 recombina a su manera. */
  const CASOS = ["D", "L", "Lr", "S", "W", "E", "R"];

  function nuevo(nombre) {
    return {
      esquema: ESQUEMA,
      nombre: nombre || "Galpón sin nombre",
      creado: new Date().toISOString(),
      modificado: new Date().toISOString(),

      /* PASO 1 · Datos */
      sitio: {
        ubicacion: "", uso: "",
        zonaSismica: null, perfilSuelo: null,
        V_kmh: null,                    /* mínimo 75 · E.020 Art. 12.3 */
        aberturas: null                 /* «repartidas» | «barlovento» | «sotavento» */
      },
      materiales: {
        acero: { designacion: "A36", Fy_kgcm2: null, Fu_kgcm2: null },
        concreto: { fc_kgcm2: null },
        suelo: { sigma_kgcm2: null, Df_m: null, gamma_tm3: null, sc_tm2: null, netaDada: false }
      },
      cobertura: { producto: "", espesor_mm: null, peso_kgfm2: null, pendiente_pct: null },

      /* PASO 2 · Modelo */
      geometria: {
        tipologia: null,                /* «tijeral» | «porticoRigido» */
        luz_m: null, largo_m: null, altura_m: null,
        pendiente_pct: null, separacionPorticos_m: null,
        tijeral: { tipo: null, paneles: null, flecha_m: null }
      },
      nudos: [], barras: [], apoyos: [],

      /* PASO 3 · Cargas · SIN FACTORIZAR, por caso */
      cargas: CASOS.reduce((o, c) => { o[c] = []; return o; }, {}),

      /* PASO 5 · lo que se adoptó */
      secciones: {},

      /* El bucle: en qué pasada va y si convergió */
      pasada: { n: 0, convergio: false, cambiaron: [] },

      /* Trazabilidad */
      inventario: { version: null, filas: null }
    };
  }

  /* ---------- serializar ------------------------------------------------ */

  function aTexto(p) {
    const copia = JSON.parse(JSON.stringify(p));
    copia.modificado = new Date().toISOString();
    return JSON.stringify(copia, null, 2);
  }

  /* ---------- abrir ----------------------------------------------------- */
  /* Un archivo que no se puede abrir tiene que decir POR QUÉ. Devolver null
     y que el usuario adivine es la peor opción. */
  function deTexto(txt) {
    let p;
    try { p = JSON.parse(txt); }
    catch (e) { return { ok: false, msg: "El archivo no es JSON válido: " + e.message }; }

    if (typeof p !== "object" || p === null) {
      return { ok: false, msg: "El archivo no contiene un proyecto." };
    }
    if (p.esquema === undefined) {
      return { ok: false, msg: "El archivo no dice con qué versión de Galpón se guardó." };
    }
    if (p.esquema > ESQUEMA) {
      return { ok: false, msg:
        "Este proyecto se guardó con una versión más nueva de Galpón (esquema " +
        p.esquema + ", esta versión lee hasta " + ESQUEMA + ")." };
    }
    if (p.esquema < ESQUEMA) {
      const r = migra(p);
      if (!r.ok) return r;
      p = r.proyecto;
    }
    const faltan = ["sitio", "materiales", "geometria", "cargas"].filter((k) => !p[k]);
    if (faltan.length) {
      return { ok: false, msg: "Al proyecto le faltan secciones: " + faltan.join(", ") };
    }
    return { ok: true, proyecto: p };
  }

  /* Migración entre esquemas.  Hoy no hay ninguna: existe la función para
     que el día que haga falta tenga sitio, y para que deTexto() no tenga
     que cambiar de forma. */
  function migra(p) {
    return { ok: true, proyecto: Object.assign({}, p, { esquema: ESQUEMA }) };
  }

  /* ---------- cargas ----------------------------------------------------- */
  /* Añade una carga a SU CASO.  No se admite un caso inventado: eso sería
     una combinación colándose por la puerta de atrás. */
  function agregaCarga(p, caso, carga) {
    if (CASOS.indexOf(caso) < 0) {
      throw new Error(
        "proyecto: «" + caso + "» no es un caso de carga.\n" +
        "  Los casos son: " + CASOS.join(", ") + "\n" +
        "  El proyecto guarda CASOS sin factorizar, nunca combinaciones:\n" +
        "  la E.090 y la E.060 usan factores distintos y cada una arma los suyos.");
    }
    p.cargas[caso].push(carga);
    return p;
  }

  return { ESQUEMA, CASOS, nuevo, aTexto, deTexto, migra, agregaCarga };
});
