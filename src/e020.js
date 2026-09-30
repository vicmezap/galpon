/* =====================================================================
   e020.js — cargas de gravedad: muerta, viva de techo y nieve

   Primera pieza de E2.  Funciones puras: entra un número, sale un número,
   y cada una lleva pegado el artículo de la E.020 que la autoriza.

   NO HAY COMBINACIONES AQUÍ.  Esto devuelve CASOS sin factorizar —D, Lr,
   S— porque la E.090 y la E.060 los recombinan con factores distintos
   (fila J.costura).  Quien factoriza es combinaciones.js, y para el
   concreto será otro.

   DOS RAMAS QUE LA NORMA ABRE Y QUE AQUÍ SE FUERZAN A SER EXPLÍCITAS:

   1) La cobertura liviana lleva 30 kgf/m² a cualquier pendiente (Art. 7.1 d)
      SALVO si puede acumularse nieve, y entonces manda el Art. 11.  No es
      un matiz: son 30 contra 40 como mínimo, y la nieve además trae el caso
      desbalanceado, que puede invertir el signo de las diagonales de una
      armadura.  Así que vivaTecho() EXIGE que se diga si hay nieve; no
      supone que no la hay.

   2) La nieve NO es simultánea con el viento (Art. 11.1, textual).  Las
      combinaciones de la E.090 sí emparejan W con S, así que el generador
      tiene que desactivar esa pareja.  Se expone como NIEVE_CON_VIENTO
      para que combinaciones.js lo lea de aquí y no lo vuelva a decidir.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.E020 = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("e020.js", [
    "D.acero.gamma", "D.concreto.gamma", "D.cobertura.peso", "D.equipos",
    "Lr.plano", "Lr.inclinado", "Lr.curvo", "Lr.liviana",
    "Lr.red.formula", "Lr.red.Ai", "Lr.red.k", "Lr.red.min40", "Lr.red.piso",
    "N.Qs.min", "N.Qt.a", "N.Qt.b", "N.Qt.c",
    "N.desbal.corto", "N.desbal.largo", "N.es.viva", "N.no.viento"
  ]);

  /* ---------- pesos específicos · E.020 Anexo 1 ------------------------- */
  const GAMMA_ACERO = 7850;      /* kgf/m³ · fila D.acero.gamma */
  const GAMMA_CONCRETO = 2400;   /* kgf/m³ · el Anexo no tabula el armado:
                                    manda sumar 100 al simple (2300) */

  /* ---------- la cobertura · PRECOR TR-4 -------------------------------- */
  /* Por RANGO de espesor, y los cuatro rangos NO son contiguos: entre 0,40
     y 0,45 hay un hueco, y entre 0,60 y 0,75 otro mayor.  Un 0,42 mm cae en
     el hueco y esto PARA, que es lo correcto: el hueco no es un descuido de
     la ficha, es que esa plancha no se fabrica.  Interpolar ahí daría el
     peso de un producto inexistente, y el número saldría igual de convincente
     que los cuatro buenos. */
  const COBERTURA = [
    { min: 0.35, max: 0.40, peso: 3.35 },
    { min: 0.45, max: 0.50, peso: 4.30 },
    { min: 0.55, max: 0.60, peso: 5.26 },
    { min: 0.75, max: 0.80, peso: 7.17 }
  ];

  function pesoCobertura(espesor_mm) {
    for (const r of COBERTURA) {
      if (espesor_mm >= r.min - 1e-9 && espesor_mm <= r.max + 1e-9) {
        return { peso_kgfm2: r.peso, rango: r.min + "-" + r.max + " mm", art: ART["D.cobertura.peso"] };
      }
    }
    throw new Error(
      "e020: no hay peso tabulado para una cobertura de " + espesor_mm + " mm.\n" +
      "  La ficha del TR-4 tabula cuatro rangos: " +
      COBERTURA.map((r) => r.min + "-" + r.max).join(" · ") + " mm.\n" +
      "  Un espesor fuera de esos rangos no es una plancha que se fabrique;\n" +
      "  si es otra cobertura, su peso entra como dato, no interpolado.");
  }

  /* ---------- carga viva de techo · E.020 Art. 7.1 ---------------------- */
  /* Devuelve Lo, la carga viva de techo SIN reducir.  La reducción del
     Art. 10 es un paso aparte y depende del área de influencia, que este
     nivel no conoce. */
  const TIPOS = ["liviana", "plano", "inclinado", "curvo"];

  function vivaTecho(d) {
    const tipo = d.tipo;
    if (TIPOS.indexOf(tipo) < 0) {
      throw new Error(
        "e020: «" + tipo + "» no es un tipo de techo del Art. 7.1.\n" +
        "  Los cuatro incisos son: " + TIPOS.join(" · ") + ".");
    }

    /* LA RAMA QUE NO SE PUEDE SUPONER · Art. 7.1 d) exceptúa la cobertura
       liviana «si puede acumularse nieve», y manda al Art. 11.  Suponer que
       no hay nieve es decidir por el proyectista en la sierra del Perú,
       donde sí la hay, y el error va del lado inseguro: 30 contra 40 como
       mínimo, más el caso desbalanceado. */
    if (typeof d.hayNieve !== "boolean") {
      throw new Error(
        "e020: falta decir si en el sitio puede acumularse nieve.\n" +
        "  vivaTecho({ ..., hayNieve: true | false })\n" +
        "  El Art. 7.1 d) exceptúa expresamente la cobertura liviana cuando\n" +
        "  puede acumularse nieve, y entonces manda el Art. 11. No es un\n" +
        "  matiz: son 30 kgf/m² contra 40 como mínimo, y la nieve trae además\n" +
        "  el caso desbalanceado, que en una armadura puede invertir el signo\n" +
        "  de las diagonales. Decirlo es del proyecto, no de la función.");
    }
    if (d.hayNieve) {
      return {
        Lo_kgfm2: null,
        manda: "nieve",
        art: ART["Lr.liviana"],
        nota: "hay nieve: el Art. 7.1 d) remite al Art. 11 · usa nieve()"
      };
    }

    if (tipo === "liviana") {
      /* ESTE ES EL CASO DEL GALPÓN · planchas onduladas o plegadas,
         calaminas, fibrocemento, plástico.  A CUALQUIER pendiente: theta
         no entra, y por eso no se pide. */
      return { Lo_kgfm2: 30, manda: "Lr", art: ART["Lr.liviana"], caso: "Art. 7.1 d)" };
    }
    if (tipo === "curvo") {
      return { Lo_kgfm2: 50, manda: "Lr", art: ART["Lr.curvo"], caso: "Art. 7.1 c)" };
    }

    const th = d.theta_grad;
    if (typeof th !== "number" || !(th >= 0) || th >= 90) {
      throw new Error(
        "e020: un techo «" + tipo + "» necesita su inclinación en grados.\n" +
        "  vivaTecho({ tipo: \"" + tipo + "\", theta_grad: <0 a 90>, hayNieve: ... })");
    }
    if (th <= 3) {
      return { Lo_kgfm2: 100, manda: "Lr", art: ART["Lr.plano"], caso: "Art. 7.1 a)" };
    }
    /* 100 − 5·(θ − 3), con piso en 50 · fila Lr.inclinado */
    const bruto = 100 - 5 * (th - 3);
    return {
      Lo_kgfm2: Math.max(50, bruto),
      manda: "Lr",
      art: ART["Lr.inclinado"],
      caso: "Art. 7.1 b)",
      enPiso: bruto < 50
    };
  }

  /* ---------- reducción de carga viva · E.020 Art. 10 ------------------- */
  /* Lr = Lo·(0,25 + 4,6/√Ai), con Ai = k·At, solo si Ai > 40, y con piso
     en 0,50·Lo para carga viva de techo.

     La Tabla 3 tiene una FILA EXCLUSIVA para nuestro caso —«tijerales
     principales que soportan techos livianos», k = 1—, así que el galpón no
     entra por analogía: entra por la puerta. */
  const K_TIJERAL_LIVIANO = 1;

  function reduceViva(d) {
    const Lo = d.Lo_kgfm2, At = d.At_m2;
    const k = (typeof d.k === "number") ? d.k : K_TIJERAL_LIVIANO;
    if (!(Lo > 0)) throw new Error("e020: reduceViva() necesita Lo_kgfm2 > 0");
    if (!(At > 0)) throw new Error("e020: reduceViva() necesita At_m2 > 0 (área tributaria)");

    const Ai = k * At;
    if (Ai <= 40) {
      return { Lr_kgfm2: Lo, Ai_m2: Ai, k: k, reducido: false,
        motivo: "Ai = " + Ai.toFixed(1) + " m² no pasa de 40: el Art. 10 a) no permite reducir",
        art: ART["Lr.red.min40"] };
    }
    const bruto = Lo * (0.25 + 4.6 / Math.sqrt(Ai));
    const piso = 0.50 * Lo;                    /* fila Lr.red.piso */
    const Lr = Math.max(piso, Math.min(Lo, bruto));
    return {
      Lr_kgfm2: Lr, Ai_m2: Ai, k: k, reducido: Lr < Lo,
      bruto_kgfm2: bruto, enPiso: bruto < piso,
      art: ART["Lr.red.formula"],
      nota: "Ai = k·At = " + k + "·" + At + " = " + Ai.toFixed(1) + " m²"
    };
  }

  /* ---------- nieve · E.020 Art. 11 ------------------------------------- */
  const QS_MIN = 40;              /* kgf/m² · fila N.Qs.min, retorno 50 años */
  const NIEVE_ES_VIVA = true;     /* Art. 11.1 · fila N.es.viva */
  const NIEVE_CON_VIENTO = false; /* Art. 11.1, textual · fila N.no.viento */

  /* Qs es un dato del sitio con un mínimo normativo, no una fórmula. */
  function nieveQs(Qs_kgfm2) {
    if (typeof Qs_kgfm2 !== "number" || !(Qs_kgfm2 >= 0)) {
      throw new Error("e020: nieveQs() necesita la carga básica de nieve del sitio, en kgf/m²");
    }
    return {
      Qs_kgfm2: Math.max(QS_MIN, Qs_kgfm2),
      enMinimo: Qs_kgfm2 < QS_MIN,
      art: ART["N.Qs.min"]
    };
  }

  /* Qt · nieve sobre el techo, SOBRE LA PROYECCIÓN HORIZONTAL (Art. 11.3 a).
     Que sea sobre la proyección y no sobre el faldón importa: con θ = 30°
     el faldón mide un 15 % más que su proyección. */
  function nieveQt(d) {
    const Qs = nieveQs(d.Qs_kgfm2).Qs_kgfm2;
    const th = d.theta_grad;
    if (typeof th !== "number" || !(th >= 0) || th >= 90) {
      throw new Error("e020: nieveQt() necesita theta_grad entre 0 y 90");
    }
    if (th <= 15) {
      return { Qt_kgfm2: Qs, Cs: 1, caso: "Art. 11.3 a)", art: ART["N.Qt.a"],
        sobre: "proyección horizontal" };
    }
    if (th <= 30) {
      return { Qt_kgfm2: 0.80 * Qs, Cs: 1, caso: "Art. 11.3 b)", art: ART["N.Qt.b"],
        sobre: "proyección horizontal" };
    }
    /* Cs = 1 − 0,025·(θ − 30).  LA PROPIA FÓRMULA SE ANULA EN θ = 70°, y
       pasado ese punto daría nieve negativa, que no existe.  El cero no lo
       ponemos nosotros: es la raíz de la expresión de la norma. */
    const Cs = Math.max(0, 1 - 0.025 * (th - 30));
    return {
      Qt_kgfm2: Cs * (0.80 * Qs), Cs: Cs, caso: "Art. 11.3 c)", art: ART["N.Qt.c"],
      sobre: "proyección horizontal",
      seAnula: Cs === 0,
      nota: Cs === 0 ? "θ ≥ 70°: Cs = 0, la fórmula del Art. 11.3 c) se anula sola" : undefined
    };
  }

  /* Nieve desbalanceada · Art. 11.3 d), OBLIGATORIA para θ > 15°.
     Dos figuras según la semiluz.  En una armadura puede invertir el signo
     de las diagonales, así que no es un caso decorativo. */
  function nieveDesbalanceada(d) {
    const Qt = d.Qt_kgfm2, semi = d.semiluz_m, th = d.theta_grad;
    if (!(Qt >= 0)) throw new Error("e020: nieveDesbalanceada() necesita Qt_kgfm2");
    if (!(semi > 0)) throw new Error("e020: nieveDesbalanceada() necesita semiluz_m > 0 (ℓ/2)");
    if (typeof th !== "number") throw new Error("e020: nieveDesbalanceada() necesita theta_grad");

    if (th <= 15) {
      return { aplica: false,
        motivo: "el Art. 11.3 d) la exige para θ > 15°; aquí θ = " + th + "°" };
    }
    if (semi <= 6) {
      return { aplica: true, faldonA_kgfm2: 1.3 * Qt, faldonB_kgfm2: 0,
        caso: "ℓ/2 ≤ 6 m", art: ART["N.desbal.corto"] };
    }
    return { aplica: true, faldonA_kgfm2: 1.5 * Qt, faldonB_kgfm2: 0.3 * Qt,
      caso: "ℓ/2 > 6 m", art: ART["N.desbal.largo"] };
  }

  return {
    ART,
    GAMMA_ACERO, GAMMA_CONCRETO, QS_MIN, K_TIJERAL_LIVIANO,
    NIEVE_ES_VIVA, NIEVE_CON_VIENTO, COBERTURA, TIPOS,
    pesoCobertura, vivaTecho, reduceViva, nieveQs, nieveQt, nieveDesbalanceada
  };
});
