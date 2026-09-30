/* =====================================================================
   acero.js — diseño AISC 360-22, con la E.090 al lado

   El corazón del complemento.  Cada verificación devuelve TRES cosas y no
   dos: la resistencia de diseño, la razón demanda/capacidad, y CUÁL estado
   límite gobierna.  Un ratio sin nombre de estado límite no sirve para
   decidir qué cambiar de la sección.

   ORGANIZADO POR CAPÍTULO, en el orden del AISC:
       D · tracción
       E · compresión          ← hasta aquí
       F · flexión
       G · corte
       H · fuerzas combinadas

   LA DOBLE REFERENCIA ES EL PUNTO.  Donde las dos normas coinciden se dice,
   porque saberlo ahorra tiempo; donde divergen, el ART muestra las dos y la
   decisión está escrita en el inventario.  En tracción hay DOS divergencias
   reales y las dos se deciden a favor del AISC 360-22:

     · el factor U · la E.090 tiene UNA fórmula con tope 0,90; el AISC tiene
       OCHO casos, sin tope en el general, con valores fijos para ángulos.
       Divergen en los dos sentidos (fila T.U.divergencia).
     · el bloque de cortante · la E.090 elige entre dos ramas y mezcla rotura
       con fluencia; el AISC usa una sola ecuación, rotura acotada por
       fluencia, y añade Ubs, que la E.090 no tiene (fila T.bloque.divergencia).

   UNIDADES · todo en kgf y cm, que es el sistema canónico. Las secciones
   vienen del catálogo ya convertidas; aquí no hay ninguna pulgada.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.ACERO = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("acero.js", [
    "MAT.A36.Fy", "MAT.A36.Fu", "MAT.A572.Fy", "MAT.A572.Fu", "MAT.E",
    "T.fluencia", "T.rotura", "T.menor", "T.Ag", "T.Ae",
    "T.U.c1", "T.U.c2", "T.U.c3", "T.U.c4", "T.U.c7", "T.U.c8",
    "T.U.piso", "T.U.divergencia",
    "T.An.agujero", "T.An.zigzag",
    "T.bloque.aisc", "T.bloque.Ubs", "T.bloque.divergencia",
    "T.rotura.corte", "T.rotura.trac",
    "T.esbeltez", "T.varillas", "T.varillas.Rn", "T.varillas.Ab", "T.varillas.manda",
    "C.Pn", "C.phi", "C.Fn.a", "C.Fn.b", "C.Fe", "C.Lc", "C.esbeltez",
    "C.identicas", "C.nomenclatura", "C.estados", "C.Fn.frontera",
    "C.B4a", "C.B4a.c1", "C.B4a.c2", "C.B4a.c3", "C.B4a.c4", "C.B4a.c5",
    "C.B4a.c6", "C.B4a.c7", "C.B4a.c8", "C.B4a.c9",
    "C.E5", "C.E5.cond", "C.E5.a1", "C.E5.a2", "C.E5.b", "C.E5.divergencia",
    "MAT.G",
    "C.E4.aplica", "C.E4.b", "C.E4.Fe2", "C.E4.Fe3", "C.E4.Fex", "C.E4.ro",
    "C.E4.canal", "C.E4.Cw", "C.E4.divergencia",
    "C.E6.m1", "C.E6.m2", "C.E6.Ki", "C.E6.ri", "C.E6.a", "C.E6.extremo",
    "C.E6.espaciado", "C.E6.divergencia",
    "C.E7", "C.E7.tabla", "C.E7.Fel", "C.E7.be", "C.E7.redondo", "C.E7.divergencia"
  ]);

  /* ---------- materiales ------------------------------------------------ */
  /* num() y no def(): las filas guardan texto de presentación y algunas
     llevan separadores de millar. */
  const ACEROS = {
    A36:  { Fy: INV.num("MAT.A36.Fy"),  Fu: INV.num("MAT.A36.Fu"),
            art: ART["MAT.A36.Fy"] },
    A572: { Fy: INV.num("MAT.A572.Fy"), Fu: INV.num("MAT.A572.Fu"),
            art: ART["MAT.A572.Fy"] }
  };
  const E_ACERO = INV.num("MAT.E");

  function material(nombre) {
    const m = ACEROS[nombre];
    if (!m) {
      throw new Error(
        "acero: el acero es " + Object.keys(ACEROS).join(" ó ") + ", no «" + nombre + "».\n" +
        "  Otros están admitidos por la E.090 (fila MAT.admitidos) pero no tienen\n" +
        "  sus Fy y Fu en el inventario todavía: sin fila, no entran al código.");
    }
    return m;
  }

  /* ---------- factores de resistencia ----------------------------------- */
  /* La rotura lleva φ menor que la fluencia porque es FRÁGIL: no avisa. */
  const PHI = {
    tFluencia: 0.90,   /* D2-1 */
    tRotura: 0.75,     /* D2-2 */
    bloque: 0.75       /* J4-5 */
  };

  /* =====================================================================
     CAPÍTULO D · TRACCIÓN
     ===================================================================== */

  /* ---------- área neta · B4.3b ----------------------------------------- */
  /* El agujero se cuenta 2 mm mayor que el nominal, porque el taladrado daña
     el borde.  La E.090 dice lo mismo (fila T.An.agujero). */
  function areaNeta(d) {
    const Ag = d.Ag_cm2, t = d.t_cm;
    if (!(Ag > 0)) throw new Error("acero: areaNeta() necesita Ag_cm2 > 0");
    const n = d.nAgujeros || 0;
    if (!n) return { An_cm2: Ag, descuento_cm2: 0, art: ART["T.Ag"] };
    if (!(t > 0)) throw new Error("acero: con agujeros hace falta t_cm, el espesor del elemento perforado");
    const dAgujero = d.dAgujero_cm;
    if (!(dAgujero > 0)) throw new Error("acero: areaNeta() necesita dAgujero_cm (diámetro del agujero)");
    const desc = n * (dAgujero + 0.2) * t;   /* +2 mm · fila T.An.agujero */
    if (desc >= Ag) {
      throw new Error(
        "acero: los agujeros se comen toda la sección: descuento " + desc.toFixed(2) +
        " cm² sobre Ag = " + Ag.toFixed(2) + " cm².\n" +
        "  Revisa el número de agujeros, su diámetro o el espesor.");
    }
    return { An_cm2: Ag - desc, descuento_cm2: desc,
      art: ART["T.An.agujero"],
      nota: "el agujero se cuenta 2 mm mayor que el nominal: el taladrado daña el borde" };
  }

  /* ---------- factor U · Tabla D3.1 ------------------------------------- */
  /* Ocho casos; aquí están los que un galpón usa.  El caso 8 es EL DEL
     TIJERAL: toda diagonal de ángulo conectada por un solo lado.  Calcular
     con U = 1 sobrestima la capacidad un 67 %. */
  const CASOS_U = ["1", "2", "3", "4", "7", "8"];

  function factorU(d) {
    const caso = String(d.caso);
    let U, art, nota;

    if (caso === "1") {
      U = 1.0; art = ART["T.U.c1"];
      nota = "la carga entra por TODOS los elementos de la sección: sin retraso de cortante";
    } else if (caso === "2") {
      const x = d.xbar_cm, l = d.l_cm;
      if (!(l > 0)) throw new Error("acero: el caso 2 necesita l_cm, la longitud de la conexión");
      if (!(x >= 0)) throw new Error("acero: el caso 2 necesita xbar_cm, la excentricidad de la conexión");
      U = 1 - x / l; art = ART["T.U.c2"];
      nota = "cuanto más larga la conexión y menor la excentricidad, mayor U";
      if (U <= 0) {
        throw new Error(
          "acero: el caso 2 da U = " + U.toFixed(3) + " ≤ 0 con x̄ = " + x + " y l = " + l + ".\n" +
          "  La conexión es más corta que la excentricidad del centroide: eso no es\n" +
          "  una conexión que pueda transmitir la tracción. Alárgala.");
      }
    } else if (caso === "3") {
      U = 1.0; art = ART["T.U.c3"];
      nota = "solo soldadura transversal: U = 1 pero An se toma como el área de los elementos conectados";
    } else if (caso === "4") {
      U = 1.0; art = ART["T.U.c4"];
    } else if (caso === "7") {
      U = d.Uc7;
      if (!(U > 0)) {
        throw new Error("acero: el caso 7 (W, M, S, HP y tes) necesita Uc7 según bf/d y el patrón");
      }
      art = ART["T.U.c7"];
    } else if (caso === "8") {
      const n = d.pernosPorLinea;
      if (!(n >= 1)) {
        throw new Error(
          "acero: el caso 8 necesita pernosPorLinea.\n" +
          "  4 o más → U = 0,80 · exactamente 3 → U = 0,60 · menos de 3 → caso 2.");
      }
      if (n < 3) {
        throw new Error(
          "acero: con menos de 3 pernos por línea la Tabla D3.1 manda usar el CASO 2,\n" +
          "  no el 8. Pasa caso: \"2\" con su x̄ y su l.");
      }
      U = (n >= 4) ? 0.80 : 0.60;
      art = ART["T.U.c8"];
      nota = "EL CASO DEL TIJERAL: ángulo conectado por un solo lado. Con U = 1 la " +
             "capacidad saldría un 67 % alta";
    } else {
      throw new Error(
        "acero: el caso de la Tabla D3.1 es uno de " + CASOS_U.join(" · ") + ", no «" + caso + "».\n" +
        "  Los que faltan (5 y 6, perfiles HSS) se añadirán con su fila.");
    }

    /* SE PERMITE TOMAR EL MAYOR entre el caso tabulado y el caso 2, cuando el
       caso 2 aplica: la Tabla D3.1 lo dice para ángulos y perfiles W. */
    let mejorado = null;
    if ((caso === "8" || caso === "7") && d.xbar_cm !== undefined && d.l_cm > 0) {
      const u2 = 1 - d.xbar_cm / d.l_cm;
      if (u2 > U) { mejorado = { de: U, a: u2, por: "el caso 2 da más y la tabla lo permite" }; U = u2; }
    }

    /* PISO POR ÁREA CONECTADA · fila T.U.piso.  No puede salir menos que la
       razón entre el área conectada y el área total. */
    if (d.Aconectada_cm2 > 0 && d.Ag_cm2 > 0) {
      const piso = d.Aconectada_cm2 / d.Ag_cm2;
      if (piso > U) { mejorado = { de: U, a: piso, por: "piso por área conectada" }; U = piso; }
    }

    return {
      U: U, caso: caso, art: art, nota: nota, mejorado: mejorado,
      /* LA DIVERGENCIA, mostrada al lado y no escondida · fila T.U.divergencia */
      U_E090: (d.xbar_cm !== undefined && d.l_cm > 0)
        ? Math.min(0.90, 1 - d.xbar_cm / d.l_cm) : null,
      artDivergencia: ART["T.U.divergencia"],
      notaDivergencia: "la E.090 usa una sola fórmula 1 − x̄/L con tope 0,90; el AISC " +
        "tiene ocho casos sin tope en el general y con valores fijos para ángulos. " +
        "Manda el AISC 360-22."
    };
  }

  /* ---------- la verificación de tracción · D2 -------------------------- */
  function traccion(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero)
      : { Fy: d.Fy_kgcm2, Fu: d.Fu_kgcm2, art: "dato" };
    if (!(mat.Fy > 0) || !(mat.Fu > 0)) {
      throw new Error("acero: traccion() necesita un acero conocido, o Fy_kgcm2 y Fu_kgcm2");
    }
    const Ag = d.Ag_cm2;
    if (!(Ag > 0)) throw new Error("acero: traccion() necesita Ag_cm2 > 0");

    /* An por omisión es Ag: una barra soldada sin agujeros. Que haya que
       decirlo explícitamente evita el descuido de olvidar los agujeros. */
    const An = (d.An_cm2 === undefined) ? Ag : d.An_cm2;
    if (!(An > 0) || An > Ag + 1e-9) {
      throw new Error("acero: An_cm2 tiene que estar en (0, Ag]; llegó " + An + " con Ag = " + Ag);
    }
    const U = (d.U === undefined) ? 1.0 : d.U;
    if (!(U > 0) || U > 1 + 1e-12) {
      throw new Error("acero: U tiene que estar en (0, 1]; llegó " + U);
    }
    const Ae = An * U;                                /* D3-1 */

    const Pn_fluencia = mat.Fy * Ag;                  /* D2-1 */
    const Pn_rotura = mat.Fu * Ae;                    /* D2-2 */
    const Pd_fluencia = PHI.tFluencia * Pn_fluencia;
    const Pd_rotura = PHI.tRotura * Pn_rotura;

    const manda = (Pd_fluencia <= Pd_rotura) ? "fluencia en el área total"
                                             : "rotura en el área neta efectiva";
    const Pd = Math.min(Pd_fluencia, Pd_rotura);

    const out = {
      Pd_kgf: Pd, manda: manda,
      fluencia: { Pn_kgf: Pn_fluencia, phi: PHI.tFluencia, Pd_kgf: Pd_fluencia,
        art: ART["T.fluencia"] },
      rotura: { Pn_kgf: Pn_rotura, phi: PHI.tRotura, Pd_kgf: Pd_rotura,
        Ae_cm2: Ae, art: ART["T.rotura"] },
      Ag_cm2: Ag, An_cm2: An, U: U, Ae_cm2: Ae,
      Fy_kgcm2: mat.Fy, Fu_kgcm2: mat.Fu,
      art: ART["T.menor"],
      nota: "las dos normas coinciden palabra por palabra en los dos estados límite"
    };
    if (d.Pu_kgf !== undefined) {
      if (!(d.Pu_kgf >= 0)) throw new Error("acero: Pu_kgf tiene que ser ≥ 0 (tracción requerida)");
      out.Pu_kgf = d.Pu_kgf;
      out.ratio = d.Pu_kgf / Pd;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* ---------- bloque de cortante · J4-5 -------------------------------- */
  /* UNA ecuación: rotura en corte ACOTADA por fluencia en corte, más rotura
     en tracción.  Suele gobernar en cartelas empernadas de tijeral. */
  function bloqueCortante(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero)
      : { Fy: d.Fy_kgcm2, Fu: d.Fu_kgcm2 };
    const Anv = d.Anv_cm2, Agv = d.Agv_cm2, Ant = d.Ant_cm2;
    for (const [k, v] of [["Anv_cm2", Anv], ["Agv_cm2", Agv], ["Ant_cm2", Ant]]) {
      if (!(v >= 0)) throw new Error("acero: bloqueCortante() necesita " + k + " ≥ 0");
    }
    if (Anv > Agv + 1e-9) {
      throw new Error("acero: Anv no puede superar Agv (" + Anv + " > " + Agv + ")");
    }
    const Ubs = (d.Ubs === undefined) ? 1.0 : d.Ubs;
    if (Ubs !== 1.0 && Ubs !== 0.5) {
      throw new Error(
        "acero: Ubs es 1,0 (tracción uniforme) ó 0,5 (no uniforme), no «" + Ubs + "».\n" +
        "  El caso típico de 0,5 es una viga despatinada con dos filas de pernos.");
    }

    const corteRotura = 0.60 * mat.Fu * Anv;
    const corteFluencia = 0.60 * mat.Fy * Agv;
    const tracRotura = Ubs * mat.Fu * Ant;
    const rama = (corteRotura <= corteFluencia) ? "rotura en corte" : "fluencia en corte (acota)";
    const Rn = Math.min(corteRotura, corteFluencia) + tracRotura;

    /* LA DIVERGENCIA, calculada al lado · fila T.bloque.divergencia.
       La E.090 elige entre dos ramas y mezcla rotura en un plano con
       FLUENCIA en el perpendicular; no tiene Ubs. */
    const Agt = (d.Agt_cm2 === undefined) ? Ant : d.Agt_cm2;
    const Rn_E090 = (mat.Fu * Ant >= 0.6 * mat.Fu * Anv)
      ? 0.6 * mat.Fy * Agv + mat.Fu * Ant
      : 0.6 * mat.Fu * Anv + mat.Fy * Agt;

    const out = {
      Rn_kgf: Rn, phi: PHI.bloque, Rd_kgf: PHI.bloque * Rn,
      rama: rama, Ubs: Ubs,
      corteRotura_kgf: corteRotura, corteFluencia_kgf: corteFluencia,
      tracRotura_kgf: tracRotura,
      art: ART["T.bloque.aisc"], artUbs: ART["T.bloque.Ubs"],
      Rn_E090_kgf: Rn_E090, Rd_E090_kgf: PHI.bloque * Rn_E090,
      artDivergencia: ART["T.bloque.divergencia"],
      notaDivergencia: "la E.090 elige entre dos ramas y mezcla rotura con fluencia, " +
        "y no tiene Ubs. Manda el AISC 360-22."
    };
    if (d.Pu_kgf !== undefined) {
      out.Pu_kgf = d.Pu_kgf;
      out.ratio = d.Pu_kgf / out.Rd_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* ---------- esbeltez en tracción · D1 -------------------------------- */
  /* AVISO, no rechazo: el AISC dice en texto obligatorio que NO hay límite;
     el 300 está en una User Note.  Y las dos normas excluyen las varillas. */
  const ESBELTEZ_TRACCION = 300;

  function esbeltezTraccion(d) {
    const L = d.L_cm, r = d.r_cm;
    if (!(L > 0)) throw new Error("acero: esbeltezTraccion() necesita L_cm > 0");
    if (d.esVarilla === true) {
      return { aplica: false, art: ART["T.esbeltez"],
        nota: "las dos normas excluyen las varillas: «This suggestion does not apply to rods»" };
    }
    if (!(r > 0)) throw new Error("acero: esbeltezTraccion() necesita r_cm > 0");
    const lr = L / r;
    return {
      aplica: true, lr: lr, limite: ESBELTEZ_TRACCION,
      pasa: lr <= ESBELTEZ_TRACCION,
      esRechazo: false,
      art: ART["T.esbeltez"],
      nota: "AISC D1, texto obligatorio: «There is no maximum slenderness limit for " +
            "members in tension». El 300 es una User Note y la E.090 dice " +
            "«PREFERENTEMENTE». Se avisa, no se rechaza."
    };
  }

  /* ---------- una varilla roscada · J3.7 y D2 -------------------------- */
  /* DOS estados límite y en A36 empatan al 0,8 %: rotura de la parte roscada
     con Fnt = 0,75·Fu sobre el área GRUESA, y fluencia en el área total.
     Meter el área de la rosca y 0,75·Fu a la vez descuenta la rosca dos
     veces (fila T.varillas.Ab). */
  const FNT_ROSCADA = 0.75;       /* Tabla J3.2 · partes roscadas */
  const PHI_ROSCADA = 0.75;       /* J3.7 */

  function varillaRoscada(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero)
      : { Fy: d.Fy_kgcm2, Fu: d.Fu_kgcm2 };
    const Ab = d.Ab_cm2;
    if (!(Ab > 0)) {
      throw new Error(
        "acero: varillaRoscada() necesita Ab_cm2, el área nominal SIN roscar.\n" +
        "  Es el área GRUESA del vástago, con Fnt = 0,75·Fu ya reducido. Meter el\n" +
        "  área de la rosca y el 0,75 a la vez descuenta la rosca dos veces: 25 %\n" +
        "  de menos.");
    }
    const Pd_rotura = PHI_ROSCADA * FNT_ROSCADA * mat.Fu * Ab;
    const Pd_fluencia = PHI.tFluencia * mat.Fy * Ab;
    const manda = (Pd_fluencia <= Pd_rotura) ? "fluencia en el área total (D2a)"
                                             : "rotura de la parte roscada (J3.7)";
    const out = {
      Pd_kgf: Math.min(Pd_fluencia, Pd_rotura), manda: manda,
      rotura: { Pd_kgf: Pd_rotura, Fnt_kgcm2: FNT_ROSCADA * mat.Fu, phi: PHI_ROSCADA,
        art: ART["T.varillas.Rn"] },
      fluencia: { Pd_kgf: Pd_fluencia, phi: PHI.tFluencia, art: ART["T.fluencia"] },
      Ab_cm2: Ab, art: ART["T.varillas"], artManda: ART["T.varillas.manda"],
      empatan: Math.abs(Pd_fluencia - Pd_rotura) / Math.min(Pd_fluencia, Pd_rotura) < 0.02,
      nota: "en A36 los dos estados límite empatan al 0,8 %: hay que comprobar los dos"
    };
    if (d.Pu_kgf !== undefined) {
      out.Pu_kgf = d.Pu_kgf;
      out.ratio = d.Pu_kgf / out.Pd_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* =====================================================================
     CAPÍTULO E · COMPRESIÓN

     LA DIVERGENCIA MÁS CARA DEL PROYECTO ESTÁ AQUÍ, y es un solo número:
     φc = 0,90 en el AISC contra 0,85 en la E.090.  Un 5,9 % en la
     resistencia de diseño de TODA columna, diagonal y montante en
     compresión.  Es la más fácil de pasar por alto porque no es una fórmula,
     es una constante (fila C.phi).

     Y UN HALLAZGO QUE AHORRA TRABAJO · las CURVAS son idénticas.  La E.090
     escribe λc = (Kl/rπ)·√(Fy/E) y da Fcr = (0,658^λc²)·Fy hasta λc = 1,5 y
     Fcr = (0,877/λc²)·Fy después.  Pero λc² = Fy/Fe exactamente, λc = 1,5
     equivale a Fy/Fe = 2,25, y (0,877/λc²)·Fy = 0,877·Fe.  Es la MISMA curva
     con otra notación (fila C.identicas), y la prueba lo comprueba
     numéricamente en todo el rango en vez de creérselo.
     ===================================================================== */

  const PHI_C = 0.90;            /* E1 · fila C.phi */
  const PHI_C_E090 = 0.85;       /* E.090 §5.2.1 · la divergencia */
  const ESBELTEZ_COMPRESION = 200;   /* E2 User Note · fila C.esbeltez */
  const FY_FE_LIMITE = 2.25;     /* E3 · la frontera entre las dos ramas */

  /* ---------- Tabla B4.1a · λr en COMPRESIÓN ---------------------------- */
  /* NO SON LOS λr DE FLEXIÓN, y confundirlos es el error fácil: el ala de una
     I laminada tiene λr = 0,56·√(E/Fy) aquí y 1,0·√(E/Fy) en flexión, casi el
     doble.  En compresión no existe «compacta»: solo esbelta o no esbelta,
     porque no hay redistribución plástica que aprovechar. */
  const B4A = {
    1: { coef: 0.56, raiz: true,  art: "C.B4a.c1",
         que: "alas de I laminada, canales, tes, y lados salientes de 2L en contacto continuo" },
    2: { coef: 0.64, raiz: true,  art: "C.B4a.c2", conKc: true,
         que: "alas de I armada y planchas o lados de ángulo que salen de ella" },
    3: { coef: 0.45, raiz: true,  art: "C.B4a.c3",
         que: "lados de ángulo simple, de 2L con separadores, y todo lo demás no atiesado" },
    4: { coef: 0.75, raiz: true,  art: "C.B4a.c4", que: "almas de tes" },
    5: { coef: 1.49, raiz: true,  art: "C.B4a.c5",
         que: "almas de I de doble simetría y de canales" },
    6: { coef: 1.40, raiz: true,  art: "C.B4a.c6", que: "paredes de HSS rectangular" },
    7: { coef: 1.40, raiz: true,  art: "C.B4a.c7", que: "planchas de cubrejunta" },
    8: { coef: 1.49, raiz: true,  art: "C.B4a.c8", que: "todos los demás elementos atiesados" },
    9: { coef: 0.11, raiz: false, art: "C.B4a.c9", que: "HSS redondo" }
  };

  function lambdaR(d) {
    const c = B4A[d.caso];
    if (!c) {
      throw new Error(
        "acero: el caso de la Tabla B4.1a es 1 a 9, no «" + d.caso + "».\n" +
        "  OJO: son los casos de COMPRESIÓN. Los λr de flexión (Tabla B4.1b,\n" +
        "  filas F.B4.*) son otros números y más altos: usarlos aquí da una\n" +
        "  sección «no esbelta» que sí lo es.");
    }
    const Fy = d.Fy_kgcm2;
    if (!(Fy > 0)) throw new Error("acero: lambdaR() necesita Fy_kgcm2 > 0");
    let coef = c.coef;
    if (c.conKc) {
      const htw = d.h_tw;
      if (!(htw > 0)) {
        throw new Error("acero: el caso 2 necesita h_tw para calcular kc = 4/√(h/tw)");
      }
      const kc = Math.min(0.76, Math.max(0.35, 4 / Math.sqrt(htw)));
      return { lambdaR: coef * Math.sqrt(kc * E_ACERO / Fy), kc: kc,
        caso: d.caso, que: c.que, art: ART[c.art] };
    }
    const v = c.raiz ? coef * Math.sqrt(E_ACERO / Fy) : coef * (E_ACERO / Fy);
    return { lambdaR: v, caso: d.caso, que: c.que, art: ART[c.art],
      nota: c.raiz ? undefined : "este caso NO lleva raíz: es E/Fy directo" };
  }

  /* ¿Tiene la sección algún elemento esbelto?  Se le pasan los elementos con
     su razón ancho/espesor y su caso de la tabla. */
  function esbeltezLocal(d) {
    const Fy = d.Fy_kgcm2;
    const els = d.elementos || [];
    if (!els.length) {
      throw new Error(
        "acero: esbeltezLocal() necesita los elementos de la sección con su razón\n" +
        "  ancho/espesor y su caso de la Tabla B4.1a:\n" +
        "    elementos: [{ nombre: \"ala\", razon: 8.5, caso: 1 }, ...]\n" +
        "  Sin esto no se puede saber si la sección es esbelta, y una sección\n" +
        "  esbelta calculada por E3 sale del lado INSEGURO: hay que ir al E7.");
    }
    const detalle = els.map((e) => {
      const lr = lambdaR({ caso: e.caso, Fy_kgcm2: Fy, h_tw: e.h_tw });
      return { nombre: e.nombre, razon: e.razon, lambdaR: lr.lambdaR,
        esbelto: e.razon > lr.lambdaR, caso: e.caso, art: lr.art };
    });
    const esbeltos = detalle.filter((x) => x.esbelto);
    return {
      hayEsbeltos: esbeltos.length > 0,
      esbeltos: esbeltos.map((x) => x.nombre),
      detalle: detalle, art: ART["C.B4a"],
      nota: esbeltos.length
        ? "hay elementos esbeltos: la resistencia se determina por el E7 (anchos " +
          "efectivos), no por el E3. Calcularla por E3 sale del lado inseguro."
        : "ningún elemento esbelto: el E3 aplica tal cual"
    };
  }

  /* ---------- E3 · pandeo por flexión ---------------------------------- */
  function Fe(d) {
    const lr = d.lr;
    if (!(lr > 0)) {
      throw new Error("acero: Fe() necesita lr = Lc/r > 0");
    }
    return { Fe_kgcm2: Math.PI * Math.PI * E_ACERO / (lr * lr), lr: lr, art: ART["C.Fe"] };
  }

  function Fn(d) {
    const Fy = d.Fy_kgcm2, fe = d.Fe_kgcm2;
    if (!(Fy > 0)) throw new Error("acero: Fn() necesita Fy_kgcm2 > 0");
    if (!(fe > 0)) throw new Error("acero: Fn() necesita Fe_kgcm2 > 0");
    const razon = Fy / fe;
    if (razon <= FY_FE_LIMITE) {
      return { Fn_kgcm2: Math.pow(0.658, razon) * Fy, razon: razon,
        tramo: "inelástico · Fy/Fe ≤ 2,25", art: ART["C.Fn.a"] };
    }
    /* El 0,877 castiga la imperfección inicial: ni en el rango elástico se
       alcanza el Euler teórico. */
    return { Fn_kgcm2: 0.877 * fe, razon: razon,
      tramo: "elástico · Fy/Fe > 2,25", art: ART["C.Fn.b"],
      nota: "el 0,877 castiga la imperfección inicial" };
  }

  /* La frontera escrita de la otra forma: Lc/r = 4,71·√(E/Fy).  Es la MISMA
     frontera que Fy/Fe = 2,25, y comprobarlo es una identidad que la prueba
     verifica en vez de aceptarla. */
  function lrFrontera(Fy) {
    return 4.71 * Math.sqrt(E_ACERO / Fy);
  }

  /* Fn escrito como lo escribe la E.090, con λc.  NO es otra curva: existe
     solo para demostrar que es la misma (fila C.identicas). */
  function FnE090(d) {
    const Fy = d.Fy_kgcm2, lr = d.lr;
    const lambdaC = (lr / Math.PI) * Math.sqrt(Fy / E_ACERO);
    const Fcr = (lambdaC <= 1.5)
      ? Math.pow(0.658, lambdaC * lambdaC) * Fy
      : (0.877 / (lambdaC * lambdaC)) * Fy;
    return { Fcr_kgcm2: Fcr, lambdaC: lambdaC, art: ART["C.identicas"],
      nota: "λc² = Fy/Fe exactamente, y λc = 1,5 ↔ Fy/Fe = 2,25: es la misma curva" };
  }

  function compresion(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero)
      : { Fy: d.Fy_kgcm2, Fu: d.Fu_kgcm2 };
    const Ag = d.Ag_cm2;
    if (!(Ag > 0)) throw new Error("acero: compresion() necesita Ag_cm2 > 0");
    const Lc = d.Lc_cm, r = d.r_cm;
    if (!(Lc > 0)) throw new Error("acero: compresion() necesita Lc_cm > 0 (la longitud efectiva)");
    if (!(r > 0)) throw new Error("acero: compresion() necesita r_cm > 0 (el radio de giro que gobierna)");

    /* LA SECCIÓN TIENE QUE DECLARARSE NO ESBELTA, o dar sus elementos para
       comprobarlo.  Una sección esbelta calculada por E3 sale del lado
       inseguro, y el descuido no lo delata ningún resultado. */
    let local = null;
    if (d.elementos) {
      local = esbeltezLocal({ Fy_kgcm2: mat.Fy, elementos: d.elementos });
      if (local.hayEsbeltos) {
        throw new Error(
          "acero: la sección tiene elementos esbeltos (" + local.esbeltos.join(", ") + ")\n" +
          "  y su resistencia se determina por el E7, con anchos efectivos, no por el E3.\n" +
          "  Con A36 el límite de un lado de ángulo simple es b/t = 12,8, así que un\n" +
          "  L 2\"x2\"x1/8\" ya es esbelto: pasa a menudo en armaduras ligeras.\n" +
          "  OJO, y no es un detalle: el E7 PUEDE no reducir nada. Su umbral es\n" +
          "  λr·√(Fy/Fn), que depende de Fn, así que en una barra esbelta —donde Fn es\n" +
          "  bajo— un elemento esbelto por B4.1a puede salir con be = b y dar el mismo\n" +
          "  número que el E3. Lo que no se puede es SALTARSE el E7 y suponerlo.");
      }
    } else if (d.noEsbelta !== true) {
      throw new Error(
        "acero: hay que decir si la sección tiene elementos esbeltos.\n" +
        "  O se pasan los elementos para comprobarlo:\n" +
        "    elementos: [{ nombre: \"lado\", razon: 10.7, caso: 3 }]\n" +
        "  o se declara noEsbelta: true bajo la responsabilidad de quien llama.\n" +
        "  No es un trámite: una sección esbelta por E3 sale del lado inseguro y\n" +
        "  el resultado parece perfectamente razonable.");
    }

    const lr = Lc / r;
    const fe = Fe({ lr: lr });
    const fn = Fn({ Fy_kgcm2: mat.Fy, Fe_kgcm2: fe.Fe_kgcm2 });
    const Pn = fn.Fn_kgcm2 * Ag;

    const out = {
      Pn_kgf: Pn, phi: PHI_C, Pd_kgf: PHI_C * Pn,
      Fn_kgcm2: fn.Fn_kgcm2, Fe_kgcm2: fe.Fe_kgcm2, lr: lr,
      tramo: fn.tramo, razonFyFe: fn.razon,
      lrFrontera: lrFrontera(mat.Fy),
      Ag_cm2: Ag, Fy_kgcm2: mat.Fy,
      esbeltezLocal: local,
      art: ART["C.Pn"], artFn: fn.art, artFe: ART["C.Fe"],
      /* LA DIVERGENCIA · fila C.phi.  Un solo número, el más caro. */
      phi_E090: PHI_C_E090, Pd_E090_kgf: PHI_C_E090 * Pn,
      artPhi: ART["C.phi"],
      notaPhi: "φc = 0,90 en el AISC contra 0,85 en la E.090: un 5,9 % en TODA " +
        "columna y diagonal en compresión. Manda el AISC 360-22.",
      /* El símbolo cambió de nombre en el 360-22 · fila C.nomenclatura */
      notaNombre: "el 360-22 llama Fn a lo que el 360-16, la E.090, Zapata y " +
        "McCormac llaman Fcr. Es solo nombre, pero confunde al comparar."
    };
    if (d.Pu_kgf !== undefined) {
      if (!(d.Pu_kgf >= 0)) throw new Error("acero: Pu_kgf tiene que ser ≥ 0");
      out.Pu_kgf = d.Pu_kgf;
      out.ratio = d.Pu_kgf / out.Pd_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
      out.ratio_E090 = d.Pu_kgf / out.Pd_E090_kgf;
    }
    return out;
  }

  /* ---------- esbeltez en compresión · E2 User Note -------------------- */
  /* CORRECCIÓN A LO QUE DIJE UNA VEZ: afirmé que el 360-22 había eliminado el
     límite de 200.  No es cierto, está en la User Note de E2, y la E.090 §2.7
     dice lo mismo.  Las dos son RECOMENDACIONES y coinciden (fila C.esbeltez).
     Donde SÍ es requisito duro es en el E5, para poder usar su esbeltez
     efectiva (fila C.E5.cond). */
  function esbeltezCompresion(d) {
    const Lc = d.Lc_cm, r = d.r_cm;
    if (!(Lc > 0) || !(r > 0)) throw new Error("acero: esbeltezCompresion() necesita Lc_cm y r_cm");
    const lr = Lc / r;
    return {
      lr: lr, limite: ESBELTEZ_COMPRESION, pasa: lr <= ESBELTEZ_COMPRESION,
      esRechazo: false, art: ART["C.esbeltez"],
      nota: "las dos normas lo dicen como recomendación y coinciden en 200. " +
            "En el E5 sí es requisito duro."
    };
  }

  /* ---------- E5 · el ángulo simple ------------------------------------ */
  /* EL ARTÍCULO QUE HACE MANEJABLE EL TIJERAL.  Una diagonal de ángulo se
     conecta por un solo lado, o sea con excentricidad: en rigor es
     flexo-compresión del Cap. H.  El E5 permite tratarla como cargada
     axialmente si se usa su esbeltez EFECTIVA y se cumplen cinco
     condiciones.  La E.090 no legisla el caso: lo delega en el AISC
     (fila C.E5.divergencia), así que usar E5 es justo lo que manda. */
  const E5_CONDICIONES = [
    "carga aplicada por el mismo lado en los dos extremos",
    "soldado, o con dos pernos como mínimo",
    "sin cargas transversales intermedias",
    "Lc/r ≤ 200 (aquí SÍ es requisito duro)",
    "si los lados son desiguales, bl/bs < 1,7"
  ];

  function anguloSimpleE5(d) {
    const L = d.L_cm, ra = d.ra_cm;
    if (!(L > 0)) throw new Error("acero: anguloSimpleE5() necesita L_cm > 0");
    if (!(ra > 0)) {
      throw new Error(
        "acero: anguloSimpleE5() necesita ra_cm, el radio de giro respecto al eje\n" +
        "  GEOMÉTRICO paralelo al lado conectado. No es rz ni rmin: es rx o ry.");
    }
    /* Las cinco condiciones · fila C.E5.cond.  Si no se cumplen hay que ir al
       Cap. H como flexo-compresión, y decirlo es mejor que dar un número. */
    if (d.condiciones !== true) {
      throw new Error(
        "acero: el E5 solo vale si se cumplen sus cinco condiciones:\n" +
        E5_CONDICIONES.map((c, i) => "    (" + (i + 1) + ") " + c).join("\n") + "\n" +
        "  Pásalas como condiciones: true cuando estén comprobadas. Si alguna\n" +
        "  falla, la diagonal es un elemento a FLEXO-COMPRESIÓN del Cap. H y no\n" +
        "  se puede tratar como cargada axialmente.");
    }

    const espacial = d.espacial === true;
    const Lra = L / ra;
    let lr, tramo, art;
    if (!espacial) {
      if (Lra <= 80) { lr = 72 + 0.75 * Lra; tramo = "armadura plana · L/ra ≤ 80"; }
      else { lr = 32 + 1.25 * Lra; tramo = "armadura plana · L/ra > 80"; }
      art = ART["C.E5.a1"];
    } else {
      if (Lra <= 75) { lr = 60 + 0.8 * Lra; tramo = "armadura espacial · L/ra ≤ 75"; }
      else { lr = 45 + Lra; tramo = "armadura espacial · L/ra > 75"; }
      art = ART["C.E5.b"];
    }

    /* Conectado por el LADO CORTO: se suma un término y hay un piso sobre rz. */
    let porLadoCorto = null;
    if (d.porLadoCorto === true) {
      const bl = d.bl_cm, bs = d.bs_cm, rz = d.rz_cm;
      if (!(bl > 0) || !(bs > 0)) {
        throw new Error("acero: conectado por el lado corto hacen falta bl_cm y bs_cm");
      }
      if (!(rz > 0)) throw new Error("acero: conectado por el lado corto hace falta rz_cm");
      const razon = bl / bs;
      if (razon >= 1.7) {
        throw new Error(
          "acero: bl/bs = " + razon.toFixed(2) + " ≥ 1,7 y la condición (5) del E5 lo\n" +
          "  prohíbe. Con lados tan desiguales hay que ir al Cap. H.");
      }
      const suma = espacial ? 6 * (razon * razon - 1) : 4 * (razon * razon - 1);
      const piso = (espacial ? 0.82 : 0.95) * (L / rz);
      const antes = lr;
      lr = Math.max(lr + suma, piso);
      porLadoCorto = { suma: suma, piso: piso, antes: antes,
        art: espacial ? ART["C.E5.b"] : ART["C.E5.a2"],
        enPiso: antes + suma < piso };
    }

    return {
      lr: lr, Lra: Lra, tramo: tramo, espacial: espacial,
      porLadoCorto: porLadoCorto,
      art: art, artCond: ART["C.E5.cond"], artE5: ART["C.E5"],
      artDivergencia: ART["C.E5.divergencia"],
      cumpleEsbeltez: lr <= ESBELTEZ_COMPRESION,
      nota: "esbeltez EFECTIVA: incluye el efecto de la excentricidad, así que la " +
            "diagonal se trata como cargada axialmente. La E.090 no legisla el caso " +
            "y remite al AISC: usar E5 es lo que manda."
    };
  }

  /* =====================================================================
     E4 · PANDEO TORSIONAL Y FLEXO-TORSIONAL

     Aplica a secciones simplemente simétricas y asimétricas, a algunas de
     doble simetría —cruciformes, armadas— y a las de doble simetría cuando la
     longitud no arriostrada a TORSIÓN supera la de flexión.  Y a los ángulos
     simples con b/t > 0,71·√(E/Fy), donde b es el lado MÁS LARGO (fila
     C.E4.b): tomar el corto exime de revisar flexo-torsión cuando sí hay que
     revisarla, y el error va del lado inseguro.
     ===================================================================== */

  const G_ACERO = INV.num("MAT.G");        /* kgf/cm² · fila MAT.G */
  const COEF_EXENCION_FTB = 0.71;         /* E4 · fila C.E4.aplica */

  /* ¿Hay que revisar flexo-torsión en este ángulo simple? */
  function exigeFTB(d) {
    const bl = d.bLargo_cm, t = d.t_cm, Fy = d.Fy_kgcm2;
    if (!(bl > 0) || !(t > 0)) {
      throw new Error(
        "acero: exigeFTB() necesita bLargo_cm y t_cm.\n" +
        "  b es el ancho del lado MÁS LARGO del ángulo, textual del E4. En un\n" +
        "  ángulo de lados desiguales, tomar el corto da una razón menor y exime\n" +
        "  de revisar flexo-torsión cuando sí hay que revisarla.");
    }
    if (!(Fy > 0)) throw new Error("acero: exigeFTB() necesita Fy_kgcm2 > 0");
    const razon = bl / t;
    const limite = COEF_EXENCION_FTB * Math.sqrt(E_ACERO / Fy);
    return { exige: razon > limite, razon: razon, limite: limite,
      art: ART["C.E4.aplica"], artB: ART["C.E4.b"],
      nota: razon > limite
        ? "b/t supera el límite: hay que revisar flexo-torsión por E4"
        : "b/t no llega al límite: basta el pandeo por flexión, E3" };
  }

  /* Fex, Fey, Fez · E4-5, E4-6 y E4-7.  Cada uno con SU longitud efectiva:
     en un galpón Lcx, Lcy y Lcz son distintas, porque las correas arriostran
     el eje menor y no el mayor, y la torsión casi nunca está arriostrada. */
  function FeFlexion(d) {
    const lr = d.Lc_cm / d.r_cm;
    if (!(lr > 0)) throw new Error("acero: FeFlexion() necesita Lc_cm y r_cm positivos");
    return Math.PI * Math.PI * E_ACERO / (lr * lr);
  }

  function roH(d) {
    const xo = d.xo_cm || 0, yo = d.yo_cm || 0;
    const Ix = d.Ix_cm4, Iy = d.Iy_cm4, Ag = d.Ag_cm2;
    if (!(Ix > 0) || !(Iy > 0) || !(Ag > 0)) {
      throw new Error("acero: roH() necesita Ix_cm4, Iy_cm4 y Ag_cm2 positivos");
    }
    const ro2 = xo * xo + yo * yo + (Ix + Iy) / Ag;        /* E4-9 */
    const H = 1 - (xo * xo + yo * yo) / ro2;               /* E4-8 */
    return { ro2: ro2, ro_cm: Math.sqrt(ro2), H: H, xo_cm: xo, yo_cm: yo,
      art: ART["C.E4.ro"] };
  }

  function Fez(d) {
    const Cw = d.Cw_cm6, J = d.J_cm4, Lcz = d.Lcz_cm, Ag = d.Ag_cm2;
    if (!(J > 0)) throw new Error("acero: Fez() necesita J_cm4 > 0");
    if (!(Lcz > 0)) throw new Error("acero: Fez() necesita Lcz_cm > 0");
    const ro2 = d.ro2;
    if (!(ro2 > 0)) throw new Error("acero: Fez() necesita ro2 (de roH())");
    /* La User Note de E4 autoriza omitir el término con Cw en tes y 2L
       (fila C.E4.Cw): ahí el alabeo aporta muy poco. */
    const cw = (Cw === undefined || Cw === null) ? 0 : Cw;
    return { Fez_kgcm2: (Math.PI * Math.PI * E_ACERO * cw / (Lcz * Lcz) + G_ACERO * J)
      / (Ag * ro2), omitioCw: cw === 0, art: ART["C.E4.Fex"] };
  }

  /* E4-2 · doble simetría girando alrededor del centro de corte. */
  function FeDobleSimetria(d) {
    const Cw = d.Cw_cm6, J = d.J_cm4, Lcz = d.Lcz_cm;
    const Ix = d.Ix_cm4, Iy = d.Iy_cm4;
    if (!(Cw > 0)) throw new Error("acero: FeDobleSimetria() necesita Cw_cm6 > 0");
    if (!(J > 0)) throw new Error("acero: FeDobleSimetria() necesita J_cm4 > 0");
    if (!(Lcz > 0)) throw new Error("acero: FeDobleSimetria() necesita Lcz_cm > 0");
    if (!(Ix > 0) || !(Iy > 0)) throw new Error("acero: FeDobleSimetria() necesita Ix_cm4 e Iy_cm4");
    return { Fe_kgcm2: (Math.PI * Math.PI * E_ACERO * Cw / (Lcz * Lcz) + G_ACERO * J)
      / (Ix + Iy), art: ART["C.E4.Fe2"] };
  }

  /* E4-3 · simple simetría.  El eje de simetría es Y por defecto; en un CANAL
     el eje de simetría es X y la User Note manda sustituir Fey por Fex
     (fila C.E4.canal).  Usar Fey en un canal aplica la ecuación al eje
     equivocado. */
  function FeSimpleSimetria(d) {
    const Fe1 = d.Fey_kgcm2, fez = d.Fez_kgcm2, H = d.H;
    if (!(Fe1 > 0)) throw new Error("acero: FeSimpleSimetria() necesita Fey_kgcm2 (o Fex en un canal)");
    if (!(fez > 0)) throw new Error("acero: FeSimpleSimetria() necesita Fez_kgcm2");
    if (!(H > 0) || H > 1 + 1e-12) throw new Error("acero: H tiene que estar en (0, 1]; llegó " + H);
    const suma = Fe1 + fez;
    const dentro = 1 - 4 * Fe1 * fez * H / (suma * suma);
    /* El radicando no puede ser negativo con H ≤ 1, pero si el redondeo lo
       deja en −1e-18 hay que verlo en vez de sacar NaN. */
    if (dentro < -1e-9) {
      throw new Error("acero: el radicando de la E4-3 salió negativo (" + dentro + "): revisa H, Fey y Fez");
    }
    const raiz = Math.sqrt(Math.max(0, dentro));
    return { Fe_kgcm2: (suma / (2 * H)) * (1 - raiz), radicando: dentro,
      art: ART["C.E4.Fe3"],
      nota: "en un canal el eje de simetría es X: hay que pasar Fex como Fey (User Note de E4)" };
  }

  /* =====================================================================
     E6 · ELEMENTOS ARMADOS · la diagonal 2L del tijeral
     ===================================================================== */

  const KI = { angulos: 0.50, canales: 0.75, otros: 0.86 };   /* E6-2b */
  const A_RI_SIN_PENALIZAR = 40;        /* E6-2a */
  const FRACCION_COMPONENTE = 0.75;     /* E6.2(a) · tres cuartos */

  /* (Lc/r)m · E6-1 y E6-2.  `ri` es el radio de giro MÍNIMO del componente,
     textual (fila C.E6.ri): en un ángulo el mínimo es rz, no rx ni ry, y usar
     rx da una esbeltez del componente mucho menor que la real. */
  function esbeltezModificada(d) {
    const lr0 = d.lr0, a = d.a_cm, ri = d.ri_cm;
    if (!(lr0 > 0)) throw new Error("acero: esbeltezModificada() necesita lr0 = (Lc/r)o > 0");
    if (!(a > 0)) throw new Error("acero: esbeltezModificada() necesita a_cm > 0 (separación entre conectores)");
    if (!(ri > 0)) {
      throw new Error(
        "acero: esbeltezModificada() necesita ri_cm, el radio de giro MÍNIMO del\n" +
        "  componente. Textual del E6: «The minimum radius of gyration, ri, shall be\n" +
        "  used». En un ángulo el mínimo es rz, no rx ni ry: usar rx da una esbeltez\n" +
        "  del componente mucho menor que la real.");
    }
    const conexion = d.conexion;
    if (conexion !== "apretado" && conexion !== "requintado") {
      throw new Error(
        "acero: la conexión intermedia es «apretado» (bolted snug-tight) o\n" +
        "  «requintado» (soldada o con pernos pretensados, superficies Clase A o B).\n" +
        "  No es un detalle: con pernos apretados el término entra SIEMPRE y con\n" +
        "  requintado solo si a/ri > 40.");
    }
    const ari = a / ri;
    if (conexion === "apretado") {
      /* E6-1 · sin factor Ki y sin umbral: el término entra siempre. */
      return { lrm: Math.sqrt(lr0 * lr0 + ari * ari), lr0: lr0, ari: ari,
        Ki: 1, conexion: conexion, art: ART["C.E6.m1"],
        nota: "con pernos a ajuste apretado el término entra siempre y sin Ki" };
    }
    if (ari <= A_RI_SIN_PENALIZAR) {
      return { lrm: lr0, lr0: lr0, ari: ari, Ki: null, conexion: conexion,
        art: ART["C.E6.m2"], sinPenalizar: true,
        nota: "a/ri ≤ 40: la esbeltez no se modifica" };
    }
    const tipo = d.tipo || "otros";
    const Ki = KI[tipo];
    if (Ki === undefined) {
      throw new Error("acero: el tipo de armado es " + Object.keys(KI).join(" · ") +
        " (E6-2b), no «" + tipo + "»");
    }
    return { lrm: Math.sqrt(lr0 * lr0 + Math.pow(Ki * ari, 2)), lr0: lr0, ari: ari,
      Ki: Ki, tipo: tipo, conexion: conexion, art: ART["C.E6.m2"], artKi: ART["C.E6.Ki"] };
  }

  /* E6.2(a) · la separación máxima entre conectores.
     NO ES LA MISMA REGLA QUE EN TRACCIÓN: en tracción (D4) el criterio es que
     cada componente no pase de 300; aquí es tres cuartos de la esbeltez
     GOBERNANTE del conjunto, que casi siempre es más exigente. Una diagonal
     que trabaja en los dos sentidos cumple la más estricta (fila C.E6.a). */
  function separacionConectores(d) {
    const ari = d.a_cm / d.ri_cm;
    const lrGob = d.lrGobernante;
    if (!(lrGob > 0)) {
      throw new Error("acero: separacionConectores() necesita lrGobernante, la esbeltez del conjunto");
    }
    const tope = FRACCION_COMPONENTE * lrGob;
    return {
      ari: ari, tope: tope, cumple: ari <= tope,
      aMax_cm: tope * d.ri_cm,
      art: ART["C.E6.a"],
      nota: "en TRACCIÓN el criterio es otro: cada componente ≤ 300 (D4). Una " +
            "diagonal que trabaja en los dos sentidos cumple la más estricta."
    };
  }

  /* =====================================================================
     E7 · ELEMENTOS ESBELTOS · anchos efectivos
     ===================================================================== */

  /* Tabla E7.1.  c2 NO es un dato independiente: sale de c1 por la E7-4, y
     los c2 tabulados son ése redondeado a tres cifras (fila C.E7.tabla).  El
     código calcula c2 exacto y contrasta contra la tabla, que es la forma de
     saber que la transcripción de c1 es correcta. */
  const E7_C1 = { atiesados: 0.18, hss: 0.20, otros: 0.22 };
  const E7_C2_TABLA = { atiesados: 1.31, hss: 1.38, otros: 1.49 };

  function c2DeC1(c1) {
    if (!(c1 > 0) || c1 >= 0.25) {
      throw new Error("acero: c2DeC1() necesita 0 < c1 < 0,25; llegó " + c1);
    }
    return (1 - Math.sqrt(1 - 4 * c1)) / (2 * c1);          /* E7-4 */
  }

  function factoresE7(tipo) {
    const c1 = E7_C1[tipo];
    if (c1 === undefined) {
      throw new Error("acero: el caso de la Tabla E7.1 es " + Object.keys(E7_C1).join(" · ") +
        ", no «" + tipo + "»");
    }
    const c2 = c2DeC1(c1);
    return { c1: c1, c2: c2, c2Tabla: E7_C2_TABLA[tipo], tipo: tipo,
      art: ART["C.E7.tabla"],
      desvioTabla: Math.abs(c2 - E7_C2_TABLA[tipo]) / E7_C2_TABLA[tipo],
      nota: "c2 sale de c1 por la E7-4; el tabulado es ése redondeado a tres cifras" };
  }

  /* be · E7-2 y E7-3.  OJO AL UMBRAL: es λr·√(Fy/Fn), no λr a secas, así que
     depende de Fn y por tanto de la esbeltez GLOBAL.  Un elemento puede ser
     esbelto por B4.1a y no necesitar reducción aquí (fila C.E7.be). */
  function anchoEfectivo(d) {
    const lambda = d.lambda, lr = d.lambdaR, Fy = d.Fy_kgcm2, fn = d.Fn_kgcm2;
    const b = d.b_cm;
    for (const [k, v] of [["lambda", lambda], ["lambdaR", lr], ["Fy_kgcm2", Fy],
                          ["Fn_kgcm2", fn], ["b_cm", b]]) {
      if (!(v > 0)) throw new Error("acero: anchoEfectivo() necesita " + k + " > 0");
    }
    const umbral = lr * Math.sqrt(Fy / fn);
    if (lambda <= umbral) {
      return { be_cm: b, reducido: false, umbral: umbral, art: ART["C.E7.be"],
        nota: "λ ≤ λr·√(Fy/Fn): el elemento no necesita reducción aunque sea esbelto por B4.1a" };
    }
    const f = factoresE7(d.tipo || "otros");
    const Fel = Math.pow(f.c2 * lr / lambda, 2) * Fy;       /* E7-5 */
    const raiz = Math.sqrt(Fel / fn);
    const be = b * (1 - f.c1 * raiz) * raiz;                /* E7-3 */
    return { be_cm: be, reducido: true, umbral: umbral, Fel_kgcm2: Fel,
      c1: f.c1, c2: f.c2, tipo: f.tipo,
      art: ART["C.E7.be"], artFel: ART["C.E7.Fel"], artTabla: f.art };
  }

  /* Ae = Ag − Σ(b − be)·t · User Note de E7 */
  function areaEfectivaE7(d) {
    const Ag = d.Ag_cm2, fn = d.Fn_kgcm2, Fy = d.Fy_kgcm2;
    if (!(Ag > 0)) throw new Error("acero: areaEfectivaE7() necesita Ag_cm2 > 0");
    const els = d.elementos || [];
    if (!els.length) throw new Error("acero: areaEfectivaE7() necesita los elementos esbeltos");
    let descuento = 0;
    const detalle = [];
    for (const e of els) {
      const lr = lambdaR({ caso: e.caso, Fy_kgcm2: Fy, h_tw: e.h_tw });
      const ae = anchoEfectivo({ lambda: e.razon, lambdaR: lr.lambdaR, Fy_kgcm2: Fy,
        Fn_kgcm2: fn, b_cm: e.b_cm, tipo: e.tipo });
      const d_ = (e.b_cm - ae.be_cm) * e.t_cm * (e.n || 1);
      descuento += d_;
      detalle.push({ nombre: e.nombre, be_cm: ae.be_cm, reducido: ae.reducido,
        descuento_cm2: d_, lambdaR: lr.lambdaR });
    }
    if (descuento >= Ag) {
      throw new Error("acero: los anchos efectivos se comen toda la sección: " +
        descuento.toFixed(2) + " cm² sobre Ag = " + Ag.toFixed(2));
    }
    return { Ae_cm2: Ag - descuento, descuento_cm2: descuento, detalle: detalle,
      art: ART["C.E7"] };
  }

  /* HSS redondo · E7-6 y E7-7, con su TOPE DURO en 0,45·E/Fy: por encima el
     perfil queda fuera del alcance del capítulo (fila C.E7.redondo). */
  function areaEfectivaRedondo(d) {
    const Dt = d.D_t, Fy = d.Fy_kgcm2, Ag = d.Ag_cm2;
    if (!(Dt > 0) || !(Fy > 0) || !(Ag > 0)) {
      throw new Error("acero: areaEfectivaRedondo() necesita D_t, Fy_kgcm2 y Ag_cm2");
    }
    const bajo = 0.11 * E_ACERO / Fy, alto = 0.45 * E_ACERO / Fy;
    if (Dt <= bajo) {
      return { Ae_cm2: Ag, reducido: false, limiteBajo: bajo, limiteAlto: alto,
        art: ART["C.E7.redondo"] };
    }
    if (Dt >= alto) {
      throw new Error(
        "acero: D/t = " + Dt.toFixed(1) + " alcanza el tope de 0,45·E/Fy = " +
        alto.toFixed(1) + ".\n" +
        "  Por encima de ese valor el HSS redondo queda FUERA del alcance del\n" +
        "  Capítulo E: no hay ecuación que aplicar, no es que salga poco.");
    }
    return { Ae_cm2: (0.038 * E_ACERO / (Fy * Dt) + 2 / 3) * Ag, reducido: true,
      limiteBajo: bajo, limiteAlto: alto, art: ART["C.E7.redondo"] };
  }

  return {
    ART, ACEROS, E_ACERO, G_ACERO, PHI, CASOS_U, ESBELTEZ_TRACCION,
    FNT_ROSCADA, PHI_ROSCADA,
    PHI_C, PHI_C_E090, ESBELTEZ_COMPRESION, FY_FE_LIMITE, B4A, E5_CONDICIONES,
    COEF_EXENCION_FTB, KI, A_RI_SIN_PENALIZAR, FRACCION_COMPONENTE,
    E7_C1, E7_C2_TABLA,
    material, areaNeta, factorU, traccion, bloqueCortante,
    esbeltezTraccion, varillaRoscada,
    lambdaR, esbeltezLocal, Fe, Fn, FnE090, lrFrontera,
    compresion, esbeltezCompresion, anguloSimpleE5,
    exigeFTB, FeFlexion, roH, Fez, FeDobleSimetria, FeSimpleSimetria,
    esbeltezModificada, separacionConectores,
    c2DeC1, factoresE7, anchoEfectivo, areaEfectivaE7, areaEfectivaRedondo
  };
});
