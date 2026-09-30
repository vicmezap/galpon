/* =====================================================================
   estabilidad.js — AISC Cap. C y Apéndice 8

   El Método Directo, que es el que el complemento usa por defecto porque es
   el único permitido para TODAS las estructuras sin restricciones (fila
   E.C1.alcance).  Los otros dos —Longitud Efectiva y primer orden— están
   sujetos a las limitaciones del Apéndice 7.

   EL PREMIO DEL MÉTODO DIRECTO ES K = 1, textual del C3: «The effective
   length for flexural buckling of all members shall be taken as the unbraced
   length».  Se acabó el ábaco de alineamiento, que es justo lo que no
   funciona en un pórtico a dos aguas de barras inclinadas: el ábaco supone
   columnas verticales y vigas horizontales.

   LO QUE SE PAGA A CAMBIO, y son tres cosas que hay que hacer todas:

     1) reducir TODAS las rigideces por 0,80 (C2.3a), EA incluida;
     2) reducir además las de flexión por τb cuando la columna va muy
        cargada (C2-2), lo cual es ITERATIVO porque τb depende de Pr;
     3) meter cargas nocionales Ni = 0,002·α·Yi como carga lateral (C2-1).

   TRES CONFLICTOS CON LA E.090, LOS TRES DECIDIDOS A FAVOR DEL AISC y los
   tres con efecto numérico real:

     · Cm con carga transversal · el AISC quitó los 0,85/1,00 tabulados y deja
       «por análisis o 1,0». Con extremos restringidos el AISC pide 1,0 y la
       E.090 permitía 0,85: el AISC es MÁS conservador (fila E.A8.Cm.transv).
     · Pe1 · el AISC lo calcula con la rigidez REDUCIDA bajo Método Directo,
       así que Pe1 baja y B1 sube. La E.090 usa siempre la rigidez completa
       (fila E.A8.Pe1).
     · RM · la E.090 no lo tiene. En un pórtico a momento puro vale 0,85, o
       sea que Pe,story baja un 15 % y B2 sube (fila E.A8.RM).
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./solver.js"));
  } else {
    raiz.ESTABILIDAD = definir(raiz.INVENTARIO, raiz.SOLVER);
  }
})(typeof self !== "undefined" ? self : this, function (INV, SOLVER) {
  "use strict";

  const ART = INV.declara("estabilidad.js", [
    "E.C1.efectos", "E.C1.nivel", "E.C1.alcance",
    "E.C2.2orden", "E.C2.Pdelta", "E.C2.Ni", "E.C2.desplome", "E.C2.direccion",
    "E.C2.solo_gravedad", "E.C2.ficticio", "E.C2.k080", "E.C2.taub", "E.C3.K",
    "E.C3.arriostre",
    "E.A8.Mr", "E.A8.Pr", "E.A8.B1", "E.A8.Cm", "E.A8.Cm.transv",
    "E.A8.Pe1", "E.A8.B2", "E.A8.Pestory", "E.A8.RM"
  ]);

  const K_RIGIDEZ = 0.80;       /* C2.3(a) · fila E.C2.k080 */
  const DESPLOME = 1 / 500;     /* C2.2b(c) · fila E.C2.desplome */
  const COEF_NOCIONAL = 0.002;  /* C2-1 · es 0,002 PORQUE el desplome es 1/500 */
  const ALFA = { LRFD: 1.0, ASD: 1.6 };
  const RAZON_2ORDEN = 1.7;     /* C2.1(b) y C2.2b(d) · el umbral Δ₂ᵒ/Δ₁ᵉʳ */

  /* ---------- el nivel de carga · fila E.C1.nivel ----------------------- */
  /* «All load-dependent effects shall be calculated at a level of loading
     corresponding to LRFD load combinations.»  Un modelo con cargas de
     servicio da un segundo orden subestimado y nada lo delata. */
  function exigeLRFD(m) {
    if (!m || m.nivel !== "LRFD") {
      throw new Error(
        "estabilidad: el análisis de estabilidad va con cargas FACTORIZADAS.\n" +
        "  Este modelo está declarado como «" + (m ? m.nivel : "sin nivel") + "».\n" +
        "  AISC C1: «All load-dependent effects shall be calculated at a level of\n" +
        "  loading corresponding to LRFD load combinations.» Con cargas de\n" +
        "  servicio el segundo orden sale subestimado y el resultado parece bueno.");
    }
    return true;
  }

  /* ---------- cargas nocionales · C2-1 ---------------------------------- */
  /* Ni = 0,002·α·Yi, con Yi la carga de GRAVEDAD del nivel según la
     combinación que se esté corriendo.  El 0,002 sale del desplome inicial
     de 1/500 del Code of Standard Practice, así que si se justifica otra
     tolerancia el coeficiente se ajusta en proporción: por eso es un dato. */
  function cargaNocional(d) {
    const Y = d.Yi_kgf;
    if (!(Y > 0)) {
      throw new Error("estabilidad: cargaNocional() necesita Yi_kgf > 0, la gravedad del nivel");
    }
    const metodo = d.metodo || "LRFD";
    const alfa = ALFA[metodo];
    if (alfa === undefined) throw new Error("estabilidad: el método es LRFD o ASD, no «" + metodo + "»");
    const desplome = (d.desplome === undefined) ? DESPLOME : d.desplome;
    if (!(desplome > 0)) throw new Error("estabilidad: el desplome tiene que ser > 0");
    const coef = COEF_NOCIONAL * (desplome / DESPLOME);
    return {
      Ni_kgf: coef * alfa * Y,
      coef: coef, alfa: alfa, desplome: desplome,
      art: ART["E.C2.Ni"], artDesplome: ART["E.C2.desplome"],
      nota: "se aplica como carga lateral ADITIVA a las demás, en el sentido " +
            "que más desestabilice (C2.2b(b)); en un galpón hay que probar los dos"
    };
  }

  /* EL CORTANTE FICTICIO · C2.2b(a), User Note.  Las nocionales meten en la
     base un cortante que no existe.  Para las reacciones de cimentación se
     aplica una fuerza igual y contraria, repartida entre los verticales en
     proporción a la gravedad que soportan.  OJO: el VOLTEO que generan sí es
     real y no se corrige. */
  function cortanteFicticio(d) {
    const suma = (d.Ni_kgf || []).reduce((a, b) => a + b, 0);
    const P = d.gravedadPorApoyo_kgf || [];
    const tot = P.reduce((a, b) => a + b, 0);
    if (!(tot > 0)) {
      throw new Error("estabilidad: cortanteFicticio() necesita la gravedad de cada apoyo");
    }
    return {
      total_kgf: -suma,
      porApoyo_kgf: P.map((p) => -suma * p / tot),
      art: ART["E.C2.ficticio"],
      nota: "corrige el cortante en la base; el VOLTEO de las nocionales NO se corrige, es real"
    };
  }

  /* ---------- τb · C2-2 ------------------------------------------------- */
  /* Solo sobre las rigideces de FLEXIÓN.  En un tijeral, donde las barras
     trabajan axialmente, el que manda es el 0,80, no τb (fila E.C2.k080). */
  function tauB(d) {
    const Pr = d.Pr_kgf, Pns = d.Pns_kgf;
    if (!(Pns > 0)) throw new Error("estabilidad: tauB() necesita Pns_kgf > 0");
    if (!(Pr >= 0)) throw new Error("estabilidad: tauB() necesita Pr_kgf ≥ 0 (la compresión requerida)");
    const alfa = ALFA[d.metodo || "LRFD"];
    const r = alfa * Pr / Pns;
    if (r <= 0.5) return { tauB: 1.0, razon: r, tramo: "α·Pr/Pns ≤ 0,5", art: ART["E.C2.taub"] };
    return { tauB: 4 * r * (1 - r), razon: r, tramo: "α·Pr/Pns > 0,5", art: ART["E.C2.taub"],
      nota: "es ITERATIVO: τb depende de Pr, que depende del análisis, que depende de τb" };
  }

  /* La rigidez que entra en el análisis bajo Método Directo. */
  function rigidezReducida(d) {
    const tb = (d.tauB === undefined) ? 1.0 : d.tauB;
    return {
      factorAxial: K_RIGIDEZ,              /* EA* = 0,80·EA */
      factorFlexion: K_RIGIDEZ * tb,       /* EI* = 0,80·τb·EI */
      tauB: tb, art: ART["E.C2.k080"],
      nota: "el 0,80 se aplica a TODAS las rigideces que contribuyen a la " +
            "estabilidad, EA incluida; aplicarlo solo a algunas barras " +
            "distorsiona el modelo y redistribuye fuerzas sin sentido físico"
    };
  }

  /* ---------- K = 1 · C3 ------------------------------------------------ */
  function longitudEfectiva(d) {
    return {
      K: 1, Lc_cm: d.L_cm, art: ART["E.C3.K"],
      nota: "Método Directo: Lc = L. «The effective length for flexural buckling " +
            "of all members shall be taken as the unbraced length unless a smaller " +
            "value is justified by rational analysis.»",
      aviso: "el arriostre que define esa longitud tiene que cumplir el Apéndice 6 " +
             "(C3): si se toma la correa como punto de arriostre de la brida " +
             "superior, la correa y su conexión tienen que ganárselo"
    };
  }

  /* ---------- B1 · A-8-3 ------------------------------------------------ */
  /* Cm sin carga transversal: 0,6 − 0,4·(M1/M2), con M1 el MENOR y M2 el
     MAYOR momento de extremo, del análisis de PRIMER orden.  M1/M2 es
     POSITIVO en curvatura doble y NEGATIVO en curvatura simple. */
  function factorCm(d) {
    if (d.cargaTransversal === true) {
      /* CONFLICTO E.A8.Cm.transv, decidido a favor del AISC.  El 360-22
         eliminó los 0,85 y 1,00 tabulados y dejó «determinado por análisis o
         tomado conservadoramente como 1,0».  Con extremos restringidos el
         AISC pide 1,0 donde la E.090 permitía 0,85: el AISC es más severo, y
         es justo el caso de la columna de un pórtico rígido con viento
         repartido en su altura. */
      if (typeof d.CmAnalisis === "number") {
        return { Cm: d.CmAnalisis, origen: "análisis", art: ART["E.A8.Cm.transv"] };
      }
      return { Cm: 1.0, origen: "valor conservador del AISC A-8-4(b)",
        art: ART["E.A8.Cm.transv"],
        nota: "la E.090 permitía 0,85 con extremos restringidos; manda el AISC, " +
              "que es el más conservador de los dos" };
    }
    const M1 = d.M1_kgfcm, M2 = d.M2_kgfcm;
    if (typeof M1 !== "number" || typeof M2 !== "number") {
      throw new Error(
        "estabilidad: factorCm() necesita M1_kgfcm y M2_kgfcm, del análisis de\n" +
        "  PRIMER orden, o bien cargaTransversal: true.\n" +
        "  M1 es el menor en valor absoluto y M2 el mayor. El cociente M1/M2 es\n" +
        "  POSITIVO en curvatura doble y NEGATIVO en curvatura simple, y esa es\n" +
        "  toda la diferencia: 0,2 contra 1,0.");
    }
    if (Math.abs(M1) > Math.abs(M2)) {
      throw new Error("estabilidad: |M1| tiene que ser ≤ |M2|; llegaron " + M1 + " y " + M2);
    }
    if (M2 === 0) return { Cm: 1.0, razon: 0, origen: "M2 = 0", art: ART["E.A8.Cm"] };
    const r = M1 / M2;
    return { Cm: 0.6 - 0.4 * r, razon: r,
      curvatura: r > 0 ? "doble (inversa)" : "simple",
      origen: "A-8-4", art: ART["E.A8.Cm"] };
  }

  /* Pe1 = π²·EI(reducida) dividido por Lc1², con la rigidez REDUCIDA bajo
     Método Directo · fila E.A8.Pe1.  (Escrito así y no con la notación EI*
     del AISC porque ese asterisco seguido de barra cierra el comentario.) */
  function Pe1(d) {
    const E = d.E_kgcm2, I = d.I_cm4, Lc = d.Lc1_cm;
    if (!(E > 0) || !(I > 0) || !(Lc > 0)) {
      throw new Error("estabilidad: Pe1() necesita E_kgcm2, I_cm4 y Lc1_cm positivos");
    }
    const directo = d.metodoDirecto !== false;
    const tb = (d.tauB === undefined) ? 1.0 : d.tauB;
    const f = directo ? K_RIGIDEZ * tb : 1.0;
    return {
      Pe1_kgf: Math.PI * Math.PI * (f * E * I) / (Lc * Lc),
      factorRigidez: f, metodoDirecto: directo, art: ART["E.A8.Pe1"],
      nota: directo
        ? "con rigidez reducida 0,80·τb: Pe1 baja y B1 sube. La E.090 usa " +
          "siempre la rigidez completa, y ahí está la divergencia."
        : "rigidez completa (Longitud Efectiva o primer orden)"
    };
  }

  function B1(d) {
    const Cm = d.Cm, Pr = d.Pr_kgf, Pe = d.Pe1_kgf;
    if (!(Cm > 0)) throw new Error("estabilidad: B1() necesita Cm > 0");
    if (!(Pe > 0)) throw new Error("estabilidad: B1() necesita Pe1_kgf > 0");
    if (!(Pr >= 0)) throw new Error("estabilidad: B1() necesita Pr_kgf ≥ 0");
    const alfa = ALFA[d.metodo || "LRFD"];
    const den = 1 - alfa * Pr / Pe;
    if (den <= 0) {
      throw new Error(
        "estabilidad: α·Pr/Pe1 = " + (alfa * Pr / Pe).toFixed(3) + " ≥ 1: la barra pandea.\n" +
        "  B1 se dispara a infinito porque la carga axial requerida alcanza la\n" +
        "  carga crítica de la propia barra. No es un fallo del cálculo: la\n" +
        "  sección es insuficiente y hay que cambiarla.");
    }
    return { B1: Math.max(1, Cm / den), sinTope: Cm / den, razon: alfa * Pr / Pe,
      art: ART["E.A8.B1"] };
  }

  /* ---------- B2 · A-8-6 ------------------------------------------------ */
  /* RM = 1 − 0,15·(Pmf/Pstory) · fila E.A8.RM.  Pmf es la carga vertical en
     las columnas que forman parte de pórticos a momento; vale 0 en sistemas
     arriostrados y da RM = 1.  En un pórtico a momento puro RM = 0,85. */
  function factorRM(d) {
    const Pmf = d.Pmf_kgf, Ps = d.Pstory_kgf;
    if (!(Ps > 0)) throw new Error("estabilidad: factorRM() necesita Pstory_kgf > 0");
    if (!(Pmf >= 0)) throw new Error("estabilidad: factorRM() necesita Pmf_kgf ≥ 0");
    if (Pmf > Ps + 1e-9) {
      throw new Error("estabilidad: Pmf no puede superar Pstory (" + Pmf + " > " + Ps + ")");
    }
    return { RM: 1 - 0.15 * (Pmf / Ps), razon: Pmf / Ps, art: ART["E.A8.RM"],
      nota: "la E.090 no tiene este factor; manda el AISC" };
  }

  /* Pe,story = RM·H·L/ΔH · A-8-7.  ΔH es la deriva de PRIMER orden calculada
     con la rigidez que exige el análisis: REDUCIDA si es Método Directo. */
  function PeStory(d) {
    const H = d.H_kgf, L = d.L_cm, dH = d.deltaH_cm;
    if (!(L > 0)) throw new Error("estabilidad: PeStory() necesita L_cm > 0 (altura de piso)");
    if (!(dH > 0)) throw new Error("estabilidad: PeStory() necesita deltaH_cm > 0");
    if (!(H > 0)) throw new Error("estabilidad: PeStory() necesita H_kgf > 0 (el cortante que produce ΔH)");
    const RM = (d.RM === undefined) ? 1.0 : d.RM;
    return { Pestory_kgf: RM * H * L / dH, RM: RM, art: ART["E.A8.Pestory"],
      nota: "ΔH es de PRIMER orden y con la rigidez del análisis: reducida en Método Directo" };
  }

  function B2(d) {
    const Ps = d.Pstory_kgf, Pe = d.Pestory_kgf;
    if (!(Ps >= 0)) throw new Error("estabilidad: B2() necesita Pstory_kgf ≥ 0");
    if (!(Pe > 0)) throw new Error("estabilidad: B2() necesita Pestory_kgf > 0");
    const alfa = ALFA[d.metodo || "LRFD"];
    const den = 1 - alfa * Ps / Pe;
    if (den <= 0) {
      throw new Error(
        "estabilidad: α·Pstory/Pe,story = " + (alfa * Ps / Pe).toFixed(3) + " ≥ 1.\n" +
        "  El piso es inestable por sí mismo: la gravedad que soporta alcanza su\n" +
        "  carga crítica de ladeo. No hay amplificación que valga; hay que dar\n" +
        "  rigidez lateral al piso.");
    }
    const v = Math.max(1, 1 / den);
    return { B2: v, razon: alfa * Ps / Pe, art: ART["E.A8.B2"],
      /* B2 ES la razón Δ₂ᵒ/Δ₁ᵉʳ del piso, así que sirve para decidir las
         simplificaciones de C2.1(b) y C2.2b(d), las dos con umbral 1,7. */
      razonSegundoOrden: v,
      permiteOmitirPdeltaGlobal: v <= RAZON_2ORDEN,
      permiteNocionalesSoloEnGravedad: v <= RAZON_2ORDEN,
      artPdelta: ART["E.C2.Pdelta"], artSoloGravedad: ART["E.C2.solo_gravedad"] };
  }

  /* ---------- el resultado de segundo orden · A-8-1 y A-8-2 ------------- */
  /* EL AXIAL TAMBIÉN SE AMPLIFICA, y es fácil de olvidar porque la fórmula
     famosa es la del momento.  B2 aplica a momentos Y a fuerzas axiales de
     los componentes del sistema resistente a fuerzas laterales, arriostres
     incluidos (fila E.A8.Pr). */
  function segundoOrden(d) {
    const b1 = d.B1, b2 = d.B2;
    if (!(b1 >= 1)) throw new Error("estabilidad: segundoOrden() necesita B1 ≥ 1");
    if (!(b2 >= 1)) throw new Error("estabilidad: segundoOrden() necesita B2 ≥ 1");
    const Mnt = d.Mnt_kgfcm || 0, Mlt = d.Mlt_kgfcm || 0;
    const Pnt = d.Pnt_kgf || 0, Plt = d.Plt_kgf || 0;
    return {
      Mr_kgfcm: b1 * Mnt + b2 * Mlt,
      Pr_kgf: Pnt + b2 * Plt,
      B1: b1, B2: b2,
      artM: ART["E.A8.Mr"], artP: ART["E.A8.Pr"],
      nota: "nt = sin traslación lateral · lt = debido SOLO a la traslación lateral"
    };
  }

  /* ---------- correr el análisis con rigidez reducida ------------------- */
  /* Atajo que ata el solucionador al Método Directo: exige LRFD y aplica el
     0,80.  τb se pasa aparte porque solo afecta a flexión y su valor depende
     de la iteración. */
  function analiza(m, opciones) {
    exigeLRFD(m);
    const op = opciones || {};
    const tb = (op.tauB === undefined) ? 1.0 : op.tauB;
    const r = SOLVER.resuelve(m, { factorRigidez: K_RIGIDEZ * tb });
    r.metodo = "Directo";
    r.tauB = tb;
    r.artRigidez = ART["E.C2.k080"];
    return r;
  }

  return {
    ART, K_RIGIDEZ, DESPLOME, COEF_NOCIONAL, ALFA, RAZON_2ORDEN,
    exigeLRFD, cargaNocional, cortanteFicticio, tauB, rigidezReducida,
    longitudEfectiva, factorCm, Pe1, B1, factorRM, PeStory, B2,
    segundoOrden, analiza
  };
});
