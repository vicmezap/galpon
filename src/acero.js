/* =====================================================================
   acero.js — diseño AISC 360-22, con la E.090 al lado

   El corazón del complemento.  Cada verificación devuelve TRES cosas y no
   dos: la resistencia de diseño, la razón demanda/capacidad, y CUÁL estado
   límite gobierna.  Un ratio sin nombre de estado límite no sirve para
   decidir qué cambiar de la sección.

   ORGANIZADO POR CAPÍTULO, en el orden del AISC:
       D · tracción            ← esta entrega
       E · compresión
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
    "T.esbeltez", "T.varillas", "T.varillas.Rn", "T.varillas.Ab", "T.varillas.manda"
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

  return {
    ART, ACEROS, E_ACERO, PHI, CASOS_U, ESBELTEZ_TRACCION,
    FNT_ROSCADA, PHI_ROSCADA,
    material, areaNeta, factorU, traccion, bloqueCortante,
    esbeltezTraccion, varillaRoscada
  };
});
