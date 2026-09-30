/* =====================================================================
   acero.js — diseño AISC 360-22, con la E.090 al lado

   El corazón del complemento.  Cada verificación devuelve TRES cosas y no
   dos: la resistencia de diseño, la razón demanda/capacidad, y CUÁL estado
   límite gobierna.  Un ratio sin nombre de estado límite no sirve para
   decidir qué cambiar de la sección.

   ORGANIZADO POR CAPÍTULO, en el orden del AISC:
       D · tracción
       E · compresión
       F · flexión
       G · corte
       H · fuerzas combinadas ← completo
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
    "C.E7", "C.E7.tabla", "C.E7.Fel", "C.E7.be", "C.E7.redondo", "C.E7.divergencia",
    "F.phi", "F.seleccion", "F.Cb", "F.Cb.tipicos", "F.Cb.voladizo", "F.hipotesis",
    "F.F2.fluencia", "F.Mp.tope", "F.F2.zonas", "F.F2.inelastico", "F.F2.elastico",
    "F.Lp", "F.Lr", "F.Mr", "F.rts", "F.c", "F.F3.kc",
    "F.F6.fluencia", "F.F6.sinLTB", "F.F6.b", "F.F6.Fcr",
    "F.F10.ejes", "F.F10.H2", "F.F10.estados", "F.F10.divergencia",
    "F.B4.c10", "F.B4.c11", "F.B4.c12", "F.B4.c13", "F.B4.c14", "F.B4.c15",
    "F.B4.hss", "F.FL", "F.Lr.coef", "F.F2.manual",
    "V.phi", "V.phi1", "V.Vn", "V.Aw", "V.Cv1", "V.Cv2", "V.kv", "V.h",
    "V.lim260", "V.Cv2.coef", "V.G2.rig", "V.G2.lista", "V.G3", "V.G4", "V.G5",
    "V.G6", "V.G6.lista", "V.h.canales", "V.articulo",
    "H.1a", "H.1b", "H.phi", "H.Pr", "H.traccion", "H.Cb.bono",
    "H.1_3", "H.1_3.eq", "H.1_3.div", "H.2", "H.2.opcion"
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

  /* =====================================================================
     CAPÍTULO F · FLEXIÓN

     φb = 0,90 Y AQUÍ SÍ COINCIDEN LAS DOS NORMAS.  Contrasta con compresión,
     donde el AISC da 0,90 y la E.090 da 0,85.  Que coincidan en flexión y no
     en compresión es justo lo que no se recuerda (fila F.phi).

     LA HIPÓTESIS DE FONDO DEL CAPÍTULO, y no es un detalle: F1(b) supone que
     los apoyos están restringidos contra la rotación alrededor del eje
     longitudinal.  Si la correa se posa sobre el tijeral sin nada que le
     impida girar sobre su eje, TODO el capítulo deja de aplicar tal cual.  Es
     la razón técnica de que la correa se fije con clip y no solo se pose
     (fila F.hipotesis).

     DOS DIVERGENCIAS, las dos decididas a favor del AISC:

       · EL TOPE DE Mp · la E.090 topa Mp en 1,5·My para toda sección; el AISC
         NO topa en F2 y solo pone 1,6·Fy·Sy en eje MENOR (F6-1).  En eje mayor
         el factor de forma Zx/Sx anda por 1,1-1,2 y el tope rara vez actúa;
         en eje menor Zy/Sy llega a 1,5-1,6 y ahí sí decide (fila F.Mp.tope).

       · FL · el AISC lo define como 0,7·Fy; la E.090 como Fyf − Fr con
         Fr = 70 MPa laminado y 115 MPa soldado.  MISMO SÍMBOLO, DEFINICIÓN
         DISTINTA.  Con A36 el laminado queda al 2,6 % —despreciable— pero el
         SOLDADO queda un 23,4 % por debajo, o sea que el AISC es un 30,5 %
         mayor.  Y como Mr = FL·Sx, ésa es directamente la diferencia en Mr, y
         Lr crece al bajar FL.  Justo la serie VS/CVS que usa Zapata
         (filas F.Lr, F.Mr y F.FL).
     ===================================================================== */

  const PHI_B = 0.90;                 /* F1(a) · fila F.phi */
  const TOPE_MP_E090 = 1.5;           /* E.090 6.1-1 · la divergencia */
  const TOPE_F6 = 1.6;                /* F6-1 · fila F.F6.fluencia */
  const MPA_KGCM2 = 1 / 0.0980665;    /* para el Fr de la E.090, que va en MPa */
  const FR_E090 = { laminado: 70 * MPA_KGCM2, soldado: 115 * MPA_KGCM2 };

  /* ---------- Tabla B4.1b · compacidad en FLEXIÓN ----------------------- */
  /* OTRA TABLA, OTROS NÚMEROS.  En flexión hay TRES clases —compacta, no
     compacta, esbelta— porque sí hay redistribución plástica que aprovechar;
     en compresión solo dos.  Y los λr son más altos: el ala de una I laminada
     tiene 1,0·√(E/Fy) aquí y 0,56·√(E/Fy) en compresión (fila C.B4a). */
  const B4B = {
    10: { p: 0.38, r: 1.00, art: "F.B4.c10", que: "alas de I laminada, canales y tes" },
    11: { p: 0.38, r: null, art: "F.B4.c11", conKcFL: true,
          que: "alas de I armada (soldada)" },
    12: { p: 0.54, r: 0.91, art: "F.B4.c12", que: "lados de ángulos simples" },
    13: { p: 0.38, r: 1.00, art: "F.B4.c13", que: "alas de I y canales en flexión de eje menor" },
    14: { p: 0.84, r: 1.52, art: "F.B4.c14", que: "almas de tes" },
    15: { p: 3.76, r: 5.70, art: "F.B4.c15", que: "almas de I de doble simetría y canales" }
  };

  /* FL del AISC · Tabla B4.1b nota [b].  NO es Fy − Fr: eso es la E.090. */
  function FL(d) {
    const Fy = d.Fy_kgcm2;
    if (!(Fy > 0)) throw new Error("acero: FL() necesita Fy_kgcm2 > 0");
    const Sxt = d.Sxt_cm3, Sxc = d.Sxc_cm3;
    /* Por omisión, sección simétrica: Sxt/Sxc = 1 ≥ 0,7 → FL = 0,7·Fy */
    if (Sxt === undefined || Sxc === undefined) {
      return { FL_kgcm2: 0.7 * Fy, rama: "0,7·Fy (sección simétrica)", art: ART["F.FL"] };
    }
    if (!(Sxt > 0) || !(Sxc > 0)) throw new Error("acero: FL() necesita Sxt_cm3 y Sxc_cm3 > 0");
    const razon = Sxt / Sxc;
    if (razon >= 0.7) {
      return { FL_kgcm2: 0.7 * Fy, razon: razon, rama: "Sxt/Sxc ≥ 0,7", art: ART["F.FL"] };
    }
    return { FL_kgcm2: Math.max(0.5 * Fy, Fy * razon), razon: razon,
      rama: "Sxt/Sxc < 0,7, con piso en 0,5·Fy", art: ART["F.FL"] };
  }

  /* El FL de la E.090, para poder MEDIR la divergencia en vez de describirla. */
  function FL_E090(d) {
    const Fy = d.Fy_kgcm2, fab = d.fabricacion;
    const Fr = FR_E090[fab];
    if (Fr === undefined) {
      throw new Error(
        "acero: la fabricación es «laminado» o «soldado» (E.090 usa Fr = 70 ó 115 MPa),\n" +
        "  no «" + fab + "». En el AISC no hace falta porque FL = 0,7·Fy sin más, pero\n" +
        "  aquí hace falta para poder medir la divergencia.");
    }
    return { FL_kgcm2: Fy - Fr, Fr_kgcm2: Fr, fabricacion: fab, art: ART["F.FL"],
      nota: "MISMO SÍMBOLO, DEFINICIÓN DISTINTA: el AISC usa 0,7·Fy y la E.090 Fyf − Fr" };
  }

  function clasificaFlexion(d) {
    const c = B4B[d.caso];
    if (!c) {
      throw new Error(
        "acero: el caso de la Tabla B4.1b es " + Object.keys(B4B).join(" · ") +
        ", no «" + d.caso + "».\n" +
        "  OJO: son los casos de FLEXIÓN. Los de compresión (Tabla B4.1a, filas\n" +
        "  C.B4a.*) son otros números y más bajos, y en compresión no existe\n" +
        "  «compacta»: solo esbelta o no esbelta.");
    }
    const Fy = d.Fy_kgcm2, razon = d.razon;
    if (!(Fy > 0)) throw new Error("acero: clasificaFlexion() necesita Fy_kgcm2 > 0");
    if (!(razon > 0)) throw new Error("acero: clasificaFlexion() necesita razon > 0");
    const raiz = Math.sqrt(E_ACERO / Fy);
    const lp = c.p * raiz;
    let lr;
    if (c.conKcFL) {
      /* Caso 11 · ala de I ARMADA: λr = 0,95·√(kc·E/FL) */
      const htw = d.h_tw;
      if (!(htw > 0)) throw new Error("acero: el caso 11 necesita h_tw para el kc");
      const kc = Math.min(0.76, Math.max(0.35, 4 / Math.sqrt(htw)));
      const fl = FL({ Fy_kgcm2: Fy, Sxt_cm3: d.Sxt_cm3, Sxc_cm3: d.Sxc_cm3 }).FL_kgcm2;
      lr = 0.95 * Math.sqrt(kc * E_ACERO / fl);
      return clase(razon, lp, lr, c, { kc: kc, FL_kgcm2: fl });
    }
    lr = c.r * raiz;
    return clase(razon, lp, lr, c, {});
  }

  function clase(razon, lp, lr, c, extra) {
    let cl;
    if (razon <= lp) cl = "compacta";
    else if (razon <= lr) cl = "no compacta";
    else cl = "esbelta";
    return Object.assign({ clase: cl, razon: razon, lambdaP: lp, lambdaR: lr,
      que: c.que, art: ART[c.art] }, extra);
  }

  /* ---------- Cb · F1-1 ------------------------------------------------- */
  /* IDÉNTICA en las dos normas.  MA, MB y MC son los momentos ABSOLUTOS a
     1/4, 1/2 y 3/4 del tramo no arriostrado. */
  function Cb(d) {
    if (d.voladizo === true) {
      /* F1(c) · y la E.090 dice lo mismo (fila F.Cb.voladizo) */
      return { Cb: 1.0, origen: "voladizo con el extremo libre sin arriostrar",
        art: ART["F.Cb.voladizo"] };
    }
    const M = [d.Mmax_kgfcm, d.MA_kgfcm, d.MB_kgfcm, d.MC_kgfcm];
    if (M.some((x) => typeof x !== "number")) {
      throw new Error(
        "acero: Cb() necesita Mmax y los momentos a 1/4, 1/2 y 3/4 del tramo NO\n" +
        "  ARRIOSTRADO, en valor absoluto: Mmax_kgfcm, MA_kgfcm, MB_kgfcm, MC_kgfcm.\n" +
        "  O bien voladizo: true. Tomar Cb = 1,0 siempre es conservador y está\n" +
        "  permitido: pasa Mmax = MA = MB = MC.");
    }
    const a = M.map(Math.abs);
    const den = 2.5 * a[0] + 3 * a[1] + 4 * a[2] + 3 * a[3];
    if (!(den > 0)) {
      return { Cb: 1.0, origen: "tramo sin momento", art: ART["F.Cb"] };
    }
    /* El AISC no topa Cb en F1-1; el tope efectivo lo pone el propio Mn ≤ Mp. */
    return { Cb: 12.5 * a[0] / den, art: ART["F.Cb"], artTipicos: ART["F.Cb.tipicos"] };
  }

  /* ---------- F2 · I compacta, eje mayor -------------------------------- */
  function Lp(d) {
    const ry = d.ry_cm, Fy = d.Fy_kgcm2;
    if (!(ry > 0)) throw new Error("acero: Lp() necesita ry_cm > 0");
    if (!(Fy > 0)) throw new Error("acero: Lp() necesita Fy_kgcm2 > 0");
    /* COINCIDE con la E.090, que lo escribe como 788·ry/√Fyf con Fy en MPa:
       es la misma expresión con E ya sustituido. */
    return { Lp_cm: 1.76 * ry * Math.sqrt(E_ACERO / Fy), art: ART["F.Lp"],
      nota: "coincide con la E.090: 1,76·√(E/Fy) es 787,1/√Fy con Fy en MPa" };
  }

  /* rts² = √(Iy·Cw)/Sx · F2-7 */
  function rts(d) {
    const Iy = d.Iy_cm4, Cw = d.Cw_cm6, Sx = d.Sx_cm3;
    if (!(Iy > 0) || !(Cw > 0) || !(Sx > 0)) {
      throw new Error("acero: rts() necesita Iy_cm4, Cw_cm6 y Sx_cm3 positivos");
    }
    return { rts_cm: Math.sqrt(Math.sqrt(Iy * Cw) / Sx), art: ART["F.rts"] };
  }

  /* c · F2-8a y F2-8b.  El 360-22 metió los CANALES dentro de F2; en
     ediciones viejas iban aparte, y muchas correas son canal (fila F.c). */
  function coefC(d) {
    if (d.tipo === "I") return { c: 1, art: ART["F.c"] };
    if (d.tipo === "canal") {
      const ho = d.ho_cm, Iy = d.Iy_cm4, Cw = d.Cw_cm6;
      if (!(ho > 0) || !(Iy > 0) || !(Cw > 0)) {
        throw new Error("acero: coefC() de un canal necesita ho_cm, Iy_cm4 y Cw_cm6");
      }
      return { c: (ho / 2) * Math.sqrt(Iy / Cw), art: ART["F.c"],
        nota: "el 360-22 metió los canales dentro de F2; antes iban aparte" };
    }
    throw new Error("acero: coefC() acepta tipo «I» o «canal», no «" + d.tipo + "»");
  }

  /* Lr · F2-6.  El FL que entra aquí es el del AISC, 0,7·Fy. */
  function Lr(d) {
    const rt = d.rts_cm, Fy = d.Fy_kgcm2, J = d.J_cm4, c = d.c, Sx = d.Sx_cm3, ho = d.ho_cm;
    for (const [k, v] of [["rts_cm", rt], ["Fy_kgcm2", Fy], ["J_cm4", J],
                          ["Sx_cm3", Sx], ["ho_cm", ho]]) {
      if (!(v > 0)) throw new Error("acero: Lr() necesita " + k + " > 0");
    }
    if (!(c > 0)) throw new Error("acero: Lr() necesita c > 0 (de coefC())");
    /* Se permite un FL distinto del 0,7·Fy para poder medir la divergencia. */
    const fl = (d.FL_kgcm2 === undefined) ? 0.7 * Fy : d.FL_kgcm2;
    const t = J * c / (Sx * ho);
    const dentro = t + Math.sqrt(t * t + 6.76 * Math.pow(fl / E_ACERO, 2));
    return { Lr_cm: 1.95 * rt * (E_ACERO / fl) * Math.sqrt(dentro),
      FL_kgcm2: fl, termino: t, art: ART["F.Lr"],
      nota: "Lr CRECE al bajar FL: con el FL de la E.090 para soldados sale " +
            "bastante mayor que con el 0,7·Fy del AISC" };
  }

  /* La verificación completa de F2, con las tres zonas y cuál gobierna. */
  function flexionF2(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero)
      : { Fy: d.Fy_kgcm2 };
    const Fy = mat.Fy;
    const Zx = d.Zx_cm3, Sx = d.Sx_cm3;
    if (!(Zx > 0)) throw new Error("acero: flexionF2() necesita Zx_cm3 > 0");
    if (!(Sx > 0)) throw new Error("acero: flexionF2() necesita Sx_cm3 > 0");

    const Mp = Fy * Zx;                           /* F2-1 */
    const My = Fy * Sx;
    const Lb = d.Lb_cm;
    if (!(Lb >= 0)) throw new Error("acero: flexionF2() necesita Lb_cm ≥ 0 (longitud no arriostrada)");
    const lp = d.Lp_cm, lr = d.Lr_cm;
    if (!(lp > 0) || !(lr > 0)) {
      throw new Error("acero: flexionF2() necesita Lp_cm y Lr_cm (de Lp() y Lr())");
    }
    const cb = (d.Cb === undefined) ? 1.0 : d.Cb;
    if (!(cb > 0)) throw new Error("acero: Cb tiene que ser > 0");

    let Mn, zona, art;
    if (Lb <= lp) {
      Mn = Mp; zona = "Lb ≤ Lp · fluencia, sin pandeo lateral"; art = ART["F.F2.fluencia"];
    } else if (Lb <= lr) {
      /* Recta entre Mp en Lp y 0,7·Fy·Sx en Lr, amplificada por Cb y acotada
         por Mp · F2-2 */
      const Mr = 0.7 * Fy * Sx;
      Mn = Math.min(Mp, cb * (Mp - (Mp - Mr) * ((Lb - lp) / (lr - lp))));
      zona = "Lp < Lb ≤ Lr · pandeo lateral-torsional inelástico";
      art = ART["F.F2.inelastico"];
    } else {
      /* F2-3 y F2-4 */
      const rt = d.rts_cm, J = d.J_cm4, c = d.c, ho = d.ho_cm;
      if (!(rt > 0) || !(J > 0) || !(c > 0) || !(ho > 0)) {
        throw new Error(
          "acero: en la zona elástica (Lb > Lr) hacen falta rts_cm, J_cm4, c y ho_cm\n" +
          "  para el Fcr de la F2-4. Se puede tomar el término de la raíz igual a 1,0\n" +
          "  conservadoramente (User Note): pasa raizUno: true.");
      }
      const lb_rts = Lb / rt;
      const termino = d.raizUno === true
        ? 1
        : Math.sqrt(1 + 0.078 * (J * c / (Sx * ho)) * lb_rts * lb_rts);
      const Fcr = cb * Math.PI * Math.PI * E_ACERO / (lb_rts * lb_rts) * termino;
      Mn = Math.min(Mp, Fcr * Sx);
      zona = "Lb > Lr · pandeo lateral-torsional elástico";
      art = ART["F.F2.elastico"];
    }

    const out = {
      Mn_kgfcm: Mn, phi: PHI_B, Md_kgfcm: PHI_B * Mn,
      Mp_kgfcm: Mp, My_kgfcm: My, Cb: cb, Lb_cm: Lb, Lp_cm: lp, Lr_cm: lr,
      zona: zona, art: art, artZonas: ART["F.F2.zonas"], artPhi: ART["F.phi"],
      factorForma: Zx / Sx,
      /* LA DIVERGENCIA DEL TOPE · fila F.Mp.tope.  La E.090 topa Mp en 1,5·My
         y el AISC no topa en F2. En eje mayor Zx/Sx anda por 1,1-1,2, así que
         rara vez actúa; se calcula para que se vea cuándo actuaría. */
      Mp_tope_E090_kgfcm: TOPE_MP_E090 * My,
      topeE090Actua: Mp > TOPE_MP_E090 * My,
      artTope: ART["F.Mp.tope"],
      notaTope: "la E.090 topa Mp en 1,5·My; el AISC no topa en F2 y solo pone " +
        "1,6·Fy·Sy en eje menor. Manda el AISC.",
      /* Y la hipótesis que sostiene todo el capítulo. */
      artHipotesis: ART["F.hipotesis"],
      notaHipotesis: "F1(b) supone los apoyos restringidos contra la rotación " +
        "alrededor del eje longitudinal: la correa se fija con clip, no se posa"
    };
    if (d.Mu_kgfcm !== undefined) {
      out.Mu_kgfcm = d.Mu_kgfcm;
      out.ratio = Math.abs(d.Mu_kgfcm) / out.Md_kgfcm;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* ---------- F6 · eje menor · EL EJE DÉBIL DE LA CORREA --------------- */
  /* NO HAY PANDEO LATERAL-TORSIONAL AQUÍ, y la razón es física: no puede
     pandear lateralmente hacia el eje que ya es el débil.  Solo fluencia y
     pandeo local del ala (fila F.F6.sinLTB).  Por eso la componente paralela
     al faldón no necesita arriostre lateral — pero sí acorta su luz con los
     tensores.

     Y AQUÍ EL TOPE SÍ ACTÚA: 1,6·Fy·Sy, el único tope al momento plástico de
     todo el 360-22, porque en perfiles I el factor Zy/Sy llega a 1,5-1,6. */
  function flexionF6(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero) : { Fy: d.Fy_kgcm2 };
    const Fy = mat.Fy;
    const Zy = d.Zy_cm3, Sy = d.Sy_cm3;
    if (!(Zy > 0)) throw new Error("acero: flexionF6() necesita Zy_cm3 > 0");
    if (!(Sy > 0)) throw new Error("acero: flexionF6() necesita Sy_cm3 > 0");

    const Mp = Fy * Zy;
    const tope = TOPE_F6 * Fy * Sy;                      /* F6-1 */
    let Mn = Math.min(Mp, tope);
    let estado = (Mp <= tope) ? "fluencia · Mp = Fy·Zy" : "fluencia topada en 1,6·Fy·Sy";
    let art = ART["F.F6.fluencia"];

    /* Pandeo local del ala, si se dan los datos.  OJO A QUÉ ES b: en una I es
       la MITAD del ala y en un canal el ala COMPLETA (fila F.F6.b).
       Confundirlos cambia λ por un factor de 2. */
    let local = null;
    if (d.b_cm !== undefined && d.tf_cm !== undefined) {
      const lambda = d.b_cm / d.tf_cm;
      const cl = clasificaFlexion({ caso: 13, razon: lambda, Fy_kgcm2: Fy });
      local = { lambda: lambda, clase: cl.clase, lambdaP: cl.lambdaP, lambdaR: cl.lambdaR,
        artB: ART["F.F6.b"] };
      if (cl.clase === "no compacta") {
        const Mr = 0.7 * Fy * Sy;
        const MnLocal = Mn - (Mn - Mr) * ((lambda - cl.lambdaP) / (cl.lambdaR - cl.lambdaP));
        if (MnLocal < Mn) { Mn = MnLocal; estado = "pandeo local del ala · no compacta"; }
      } else if (cl.clase === "esbelta") {
        const Fcr = 0.70 * E_ACERO / (lambda * lambda);   /* F6-4 */
        const MnLocal = Fcr * Sy;
        local.Fcr_kgcm2 = Fcr;
        art = ART["F.F6.Fcr"];
        if (MnLocal < Mn) { Mn = MnLocal; estado = "pandeo local del ala · esbelta"; }
      }
    }

    const out = {
      Mn_kgfcm: Mn, phi: PHI_B, Md_kgfcm: PHI_B * Mn,
      Mp_kgfcm: Mp, tope_kgfcm: tope, topeActua: Mp > tope,
      factorForma: Zy / Sy, estado: estado, local: local,
      art: art, artSinLTB: ART["F.F6.sinLTB"],
      notaSinLTB: "en el eje menor no hay pandeo lateral-torsional: no puede pandear " +
        "hacia el eje que ya es el débil. Solo fluencia y pandeo local del ala."
    };
    if (d.Mu_kgfcm !== undefined) {
      out.Mu_kgfcm = d.Mu_kgfcm;
      out.ratio = Math.abs(d.Mu_kgfcm) / out.Md_kgfcm;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* ---------- F10 · el ángulo simple ----------------------------------- */
  /* QUÉ EJES SE USAN, y es lo primero: un ángulo suelto flexiona respecto a
     sus ejes PRINCIPALES, que están inclinados respecto a los lados.  Solo si
     algo lo sujeta CONTINUAMENTE se puede trabajar con los ejes geométricos
     (fila F.F10.ejes).  Y si el momento tiene componentes en los dos ejes
     principales, o hay un eje principal más carga axial, hay que ir a H2
     (fila F.F10.H2): es el caso de una brida de tijeral de ángulo con carga
     fuera de nudo. */
  function ejesAnguloF10(d) {
    if (typeof d.restriccionLateralContinua !== "boolean") {
      throw new Error(
        "acero: hay que decir si el ángulo tiene restricción lateral CONTINUA.\n" +
        "  ejesAnguloF10({ restriccionLateralContinua: true | false })\n" +
        "  Sin ella, un ángulo flexiona respecto a sus ejes PRINCIPALES, que están\n" +
        "  inclinados respecto a los lados; con ella se permiten los geométricos.\n" +
        "  Usar los geométricos sin tener la restricción es el error clásico.");
    }
    return {
      ejes: d.restriccionLateralContinua ? "geométricos (x, y)" : "principales",
      art: ART["F.F10.ejes"], artEstados: ART["F.F10.estados"],
      artDivergencia: ART["F.F10.divergencia"],
      notaDivergencia: "la E.090 tampoco legisla el ángulo simple: remite a la " +
        "Specification for LRFD of Single Angle Members del AISC. Usar F10 es lo que manda."
    };
  }

  /* ¿Hay que ir a H2? */
  function requiereH2(d) {
    const dosEjes = d.momentoEnDosEjesPrincipales === true;
    const conAxial = d.conCargaAxial === true;
    return {
      requiere: dosEjes || conAxial,
      art: ART["F.F10.H2"],
      motivo: dosEjes ? "momento con componentes en los dos ejes principales"
        : (conAxial ? "un eje principal más carga axial" : "ninguno de los dos casos"),
      nota: "textual: «the combined stress ratio shall be determined using the " +
            "provisions of Section H2»"
    };
  }

  /* =====================================================================
     CAPÍTULO G · CORTE

     EL ÚNICO φ = 1,00 DE TODA LA ESPECIFICACIÓN vive aquí: G1(a) fija
     φv = 0,90 «para todo este capítulo EXCEPTO G2.1(a)», y G2.1(a) da 1,00
     para almas de perfil I LAMINADO con h/tw ≤ 2,24·√(E/Fy).  El AISC
     considera que la fluencia por corte del alma es tan dúctil y predecible
     que no necesita castigo.  La E.090 mantiene 0,90 siempre, así que son
     11 % de capacidad en toda viga laminada (fila V.phi1).

     DOS COEFICIENTES QUE SE PARECEN Y NO SON EL MISMO · Cv1 tiene DOS tramos
     y Cv2 tiene TRES, y el tercero es cuadrático en h/tw porque modela el
     pandeo elástico de la placa.  Cv1 es solo para el alma de una I o canal;
     Cv2 lo usan G3 (ángulos y tes), G4 (HSS y cajones) y G6 (eje menor), o
     sea casi todo lo demás (fila V.Cv2).

     Y DOS UMBRALES QUE SE PARECEN Y TAMPOCO · el 2,24 de G2.1(a) es el de
     φv = 1,00 (63,59 con A36) y el 2,54 de G2.4(a) es el de «no hacen falta
     rigidizadores» (72,11).  El segundo no es arbitrario: 1,10·√5,34 =
     2,54187, o sea el punto donde Cv1 = 1,0 sin rigidizadores.  Dicho en
     claro, no hacen falta rigidizadores si el alma no pandea de todas formas
     (fila V.G2.rig).
     ===================================================================== */

  const PHI_V = 0.90;              /* G1(a) */
  const PHI_V_ALMA = 1.00;         /* G2.1(a) · el único 1,00 de la norma */
  const PHI_V_E090 = 0.90;         /* la E.090 no tiene la excepción */
  const COEF_PHI_V1 = 2.24;        /* G2.1(a) */
  const COEF_SIN_RIGID = 2.54;     /* G2.4(a) · es 1,10·√5,34 redondeado */
  const KV_SIN_RIGID = 5.34;       /* G2.1(b)(2)(i) */
  const KV_E090 = 5.0;             /* E.090 6.2-1 · la divergencia */
  const LIM_H_TW_E090 = 260;       /* E.090 §6.2.2.1 · fila V.lim260 */

  /* kv · G2-5.  Sin rigidizadores 5,34; con ellos 5 + 5/(a/h)², y 5,34 en
     cuanto a/h pasa de 3,0 — que es justo donde 5 + 5/9 = 5,56... no: la
     norma lo fija en 5,34 por encima de 3,0, no por continuidad. */
  function kv(d) {
    if (d.conRigidizadores !== true) {
      return { kv: KV_SIN_RIGID, art: ART["V.kv"], conRigidizadores: false,
        kv_E090: KV_E090,
        notaDivergencia: "la E.090 usa kv = 5,0 donde el AISC usa 5,34: el umbral de " +
          "Cv1 = 1 pasa de 69,8 a 72,2 con A36, un 3,6 %. Manda el AISC." };
    }
    const ah = d.a_h;
    if (!(ah > 0)) {
      throw new Error("acero: con rigidizadores hace falta a_h, la razón entre la " +
        "separación de rigidizadores y h");
    }
    if (ah > 3.0) {
      return { kv: KV_SIN_RIGID, art: ART["V.kv"], conRigidizadores: true, a_h: ah,
        nota: "con a/h > 3,0 la norma vuelve a 5,34: rigidizadores tan separados no cuentan" };
    }
    return { kv: 5 + 5 / (ah * ah), art: ART["V.kv"], conRigidizadores: true, a_h: ah };
  }

  /* Cv1 · G2-3 y G2-4.  DOS tramos. */
  function Cv1(d) {
    const htw = d.h_tw, Fy = d.Fy_kgcm2, k = d.kv;
    if (!(htw > 0)) throw new Error("acero: Cv1() necesita h_tw > 0");
    if (!(Fy > 0)) throw new Error("acero: Cv1() necesita Fy_kgcm2 > 0");
    if (!(k > 0)) throw new Error("acero: Cv1() necesita kv (de kv())");
    const umbral = 1.10 * Math.sqrt(k * E_ACERO / Fy);
    if (htw <= umbral) {
      return { Cv1: 1.0, umbral: umbral, tramo: "no pandea · Cv1 = 1", art: ART["V.Cv1"] };
    }
    return { Cv1: umbral / htw, umbral: umbral, tramo: "pandeo inelástico · lineal",
      art: ART["V.Cv1"] };
  }

  /* Cv2 · G2-9, G2-10 y G2-11.  TRES tramos, y el tercero es cuadrático. */
  function Cv2(d) {
    const htw = d.h_tw, Fy = d.Fy_kgcm2, k = d.kv;
    if (!(htw > 0)) throw new Error("acero: Cv2() necesita h_tw > 0");
    if (!(Fy > 0)) throw new Error("acero: Cv2() necesita Fy_kgcm2 > 0");
    if (!(k > 0)) throw new Error("acero: Cv2() necesita kv");
    const u1 = 1.10 * Math.sqrt(k * E_ACERO / Fy);
    const u2 = 1.37 * Math.sqrt(k * E_ACERO / Fy);
    if (htw <= u1) {
      return { Cv2: 1.0, tramo: "no pandea", u1: u1, u2: u2, art: ART["V.Cv2"] };
    }
    if (htw <= u2) {
      return { Cv2: u1 / htw, tramo: "inelástico · lineal", u1: u1, u2: u2, art: ART["V.Cv2"] };
    }
    return { Cv2: 1.51 * k * E_ACERO / (htw * htw * Fy), tramo: "elástico · cuadrático",
      u1: u1, u2: u2, art: ART["V.Cv2"],
      nota: "aquí es donde Cv2 se separa de Cv1: cuadrático en h/tw, no lineal" };
  }

  /* ---------- G2.1 · el alma de una I o canal --------------------------- */
  /* Aw = d·tw, el peralte TOTAL por el espesor del alma, no la altura libre.
     Usar h en vez de d subestima el área, y las dos normas coinciden en esto
     (fila V.Aw). */
  function corteAlma(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero) : { Fy: d.Fy_kgcm2 };
    const Fy = mat.Fy;
    const dd = d.d_cm, tw = d.tw_cm, htw = d.h_tw;
    if (!(dd > 0)) throw new Error("acero: corteAlma() necesita d_cm > 0 (el peralte TOTAL)");
    if (!(tw > 0)) throw new Error("acero: corteAlma() necesita tw_cm > 0");
    if (!(htw > 0)) {
      throw new Error(
        "acero: corteAlma() necesita h_tw.\n" +
        "  Y h depende de CÓMO SE FABRICÓ la sección (fila V.h): en una laminada es la\n" +
        "  luz libre entre alas MENOS los filetes; en una armada soldada, la luz libre;\n" +
        "  en una armada empernada, la distancia entre líneas de conectores.");
    }
    const fab = d.fabricacion;
    if (fab !== "laminado" && fab !== "soldado") {
      throw new Error(
        "acero: corteAlma() necesita fabricacion «laminado» o «soldado».\n" +
        "  No es cosmética: el φv = 1,00 de G2.1(a) SOLO vale para perfil I LAMINADO,\n" +
        "  y es un 11 % de capacidad. Un perfil soldado se queda en 0,90.");
    }

    /* ¿Cae en G2.1(a)? Solo I laminado y con h/tw por debajo del umbral. */
    const umbral224 = COEF_PHI_V1 * Math.sqrt(E_ACERO / Fy);
    const enG21a = (fab === "laminado") && (d.esI !== false) && (htw <= umbral224);

    let k, cv, phi, art;
    if (enG21a) {
      k = null; cv = { Cv1: 1.0, tramo: "G2.1(a) · Cv1 = 1 por definición" };
      phi = PHI_V_ALMA; art = ART["V.phi1"];
    } else {
      const kk = kv({ conRigidizadores: d.conRigidizadores, a_h: d.a_h });
      k = kk.kv;
      cv = Cv1({ h_tw: htw, Fy_kgcm2: Fy, kv: k });
      phi = PHI_V; art = ART["V.phi"];
    }

    const Aw = dd * tw;
    const Vn = 0.6 * Fy * Aw * cv.Cv1;
    const out = {
      Vn_kgf: Vn, phi: phi, Vd_kgf: phi * Vn,
      Aw_cm2: Aw, Cv1: cv.Cv1, kv: k, h_tw: htw,
      enG21a: enG21a, umbral224: umbral224, tramo: cv.tramo,
      fabricacion: fab,
      art: ART["V.Vn"], artPhi: art, artAw: ART["V.Aw"], artH: ART["V.h"],
      /* LA DIVERGENCIA DEL φv · fila V.phi1 */
      phi_E090: PHI_V_E090, Vd_E090_kgf: PHI_V_E090 * Vn,
      notaPhi: enG21a
        ? "φv = 1,00 por G2.1(a), el ÚNICO de toda la especificación. La E.090 se " +
          "queda en 0,90: un 11 % de diferencia. Manda el AISC."
        : "φv = 0,90, igual que la E.090",
      /* El límite de aplicabilidad peruano · fila V.lim260 */
      pasaLim260: htw <= LIM_H_TW_E090,
      artLim260: ART["V.lim260"]
    };
    if (!out.pasaLim260) {
      out.avisoLim260 = "h/tw = " + htw.toFixed(1) + " pasa de 260: la E.090 manda al " +
        "Apéndice 6.2.2 o al Cap. 7, vigas de plancha con campo de tensiones";
    }
    if (d.Vu_kgf !== undefined) {
      out.Vu_kgf = d.Vu_kgf;
      out.ratio = Math.abs(d.Vu_kgf) / out.Vd_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
      out.ratio_E090 = Math.abs(d.Vu_kgf) / out.Vd_E090_kgf;
    }
    return out;
  }

  /* ¿Hacen falta rigidizadores transversales? · G2.4(a) */
  function requiereRigidizadores(d) {
    const Fy = d.Fy_kgcm2, htw = d.h_tw;
    if (!(Fy > 0) || !(htw > 0)) {
      throw new Error("acero: requiereRigidizadores() necesita Fy_kgcm2 y h_tw");
    }
    const umbral = COEF_SIN_RIGID * Math.sqrt(E_ACERO / Fy);
    /* Es 1,10·√5,34 = 2,54187 redondeado: el punto donde Cv1 = 1 sin
       rigidizadores. No hacen falta si el alma no pandea de todas formas. */
    const equivalente = 1.10 * Math.sqrt(KV_SIN_RIGID * E_ACERO / Fy);
    return {
      requiere: htw > umbral, umbral: umbral, umbralEquivalente: equivalente,
      art: ART["V.G2.rig"],
      nota: "el 2,54 es 1,10·√5,34 = 2,54187 redondeado, o sea el punto donde " +
            "Cv1 = 1 sin rigidizadores. Y ojo: el 2,24 de G2.1(a) es OTRO umbral, " +
            "el de φv = 1,00."
    };
  }

  /* h/tw CON PROCEDENCIA.  El catálogo AISC solo lo tabula para W, M, S y HP:
     la hoja de canales no tiene esa columna ni k(des), solo k (fila
     V.h.canales).  Donde está tabulado se usa el tabulado; donde no, se
     deriva de la definición del propio G2 —h = d − 2k— Y SE DICE, porque
     derivarlo en silencio esconde un 0,7 % de error medio y hasta un 17,5 %
     en perfiles muy pesados.  T NO sirve: es la dimensión de detallado. */
  function hSobreTw(p) {
    if (p.h_tw > 0) {
      return { h_tw: p.h_tw, origen: "tabulado", art: ART["V.h"] };
    }
    const k = (p.kdes_cm > 0) ? p.kdes_cm : p.k_cm;
    if (!(p.d_cm > 0) || !(p.tw_cm > 0) || !(k > 0)) {
      throw new Error(
        "acero: no se puede obtener h/tw de «" + (p.nombre || "el perfil") + "».\n" +
        "  El catálogo no lo tabula y faltan d, tw o k para derivarlo como d − 2k.\n" +
        "  Sin h/tw no hay Capítulo G para un alma: no es un dato opcional.");
    }
    return { h_tw: (p.d_cm - 2 * k) / p.tw_cm, origen: "derivado de d − 2k",
      art: ART["V.h.canales"],
      nota: "el catálogo no tabula h/tw para esta familia; derivado de la definición " +
            "del G2. Error medio medido 0,71 %, máximo 17,5 %" };
  }

  /* QUÉ ARTÍCULO DE CORTE APLICA A CADA FORMA · fila V.articulo.  No es
     decorativo: cada uno usa otra geometría y otro kv, y aplicar el G2 a un
     ángulo no da un resultado algo distinto, da uno sin sentido. */
  const ARTICULO_CORTE = {
    I: "G2", C: "G2", CS: "G2", CVS: "G2", VS: "G2",
    L: "G3", T: "G3", "2L": "G3",
    HSS_rect: "G4", HSS_red: "G5"
  };

  function articuloCorte(familia) {
    const a = ARTICULO_CORTE[familia];
    if (!a) {
      throw new Error(
        "acero: no sé qué artículo de corte aplica a la familia «" + familia + "».\n" +
        "  El Capítulo G reparte por forma: I y canales al G2, ángulos y tes al G3,\n" +
        "  HSS rectangular al G4, HSS redondo al G5. Una familia que no esté en ese\n" +
        "  reparto necesita su fila antes de calcularse.");
    }
    return { articulo: a, familia: familia, art: ART["V.articulo"] };
  }

  /* ---------- G3 · ángulos simples y almas de tes ---------------------- */
  const KV_G3 = 1.2, KV_G4 = 5, KV_G6 = 1.2;

  function corteAngulo(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero) : { Fy: d.Fy_kgcm2 };
    const b = d.b_cm, t = d.t_cm;
    if (!(b > 0)) {
      throw new Error("acero: corteAngulo() necesita b_cm, el ancho del lado que resiste " +
        "el corte, o el peralte del alma de la te");
    }
    if (!(t > 0)) throw new Error("acero: corteAngulo() necesita t_cm > 0");
    const cv = Cv2({ h_tw: b / t, Fy_kgcm2: mat.Fy, kv: KV_G3 });
    const Vn = 0.6 * mat.Fy * b * t * cv.Cv2;
    return ratioCorte({ Vn_kgf: Vn, phi: PHI_V, Cv2: cv.Cv2, tramo: cv.tramo,
      razon: b / t, kv: KV_G3, art: ART["V.G3"] }, d);
  }

  /* ---------- G4 · HSS rectangular y cajones --------------------------- */
  /* EL FACTOR 2 ES PORQUE EL TUBO TIENE DOS ALMAS.  Y h es la luz libre entre
     alas menos el radio interior de esquina a cada lado; si el radio no se
     conoce, la dimensión exterior menos TRES veces el espesor. */
  function corteHSS(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero) : { Fy: d.Fy_kgcm2 };
    const t = d.t_cm;
    if (!(t > 0)) throw new Error("acero: corteHSS() necesita t_cm > 0 (espesor de DISEÑO, §B4.2)");
    let h = d.h_cm;
    let comoH = "dato";
    if (h === undefined) {
      const ext = d.dimExterior_cm;
      if (!(ext > 0)) {
        throw new Error(
          "acero: corteHSS() necesita h_cm, o dimExterior_cm para deducirlo.\n" +
          "  h es la luz libre entre alas MENOS el radio interior de esquina a cada\n" +
          "  lado; si el radio no se conoce, la norma permite la dimensión exterior\n" +
          "  menos TRES veces el espesor.");
      }
      h = ext - 3 * t;
      comoH = "dimensión exterior menos 3·t (radio de esquina desconocido)";
      if (!(h > 0)) throw new Error("acero: dimExterior_cm − 3·t salió ≤ 0");
    }
    const cv = Cv2({ h_tw: h / t, Fy_kgcm2: mat.Fy, kv: KV_G4 });
    const Aw = 2 * h * t;          /* DOS almas */
    const Vn = 0.6 * mat.Fy * Aw * cv.Cv2;
    return ratioCorte({ Vn_kgf: Vn, phi: PHI_V, Cv2: cv.Cv2, tramo: cv.tramo,
      Aw_cm2: Aw, h_cm: h, comoH: comoH, razon: h / t, kv: KV_G4,
      art: ART["V.G4"],
      nota: "Aw = 2·h·t: el factor 2 es porque el tubo tiene DOS almas" }, d);
  }

  /* ---------- G5 · HSS redondo ----------------------------------------- */
  function corteRedondo(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero) : { Fy: d.Fy_kgcm2 };
    const Dt = d.D_t, Lv = d.Lv_cm, D = d.D_cm, Ag = d.Ag_cm2;
    for (const [k, v] of [["D_t", Dt], ["Lv_cm", Lv], ["D_cm", D], ["Ag_cm2", Ag]]) {
      if (!(v > 0)) throw new Error("acero: corteRedondo() necesita " + k + " > 0");
    }
    const a = 1.60 * E_ACERO / (Math.sqrt(Lv / D) * Math.pow(Dt, 1.25));   /* G5-2a */
    const b = 0.78 * E_ACERO / Math.pow(Dt, 1.5);                          /* G5-2b */
    const tope = 0.6 * mat.Fy;
    const Fcr = Math.min(tope, Math.max(a, b));
    const Vn = Fcr * Ag / 2;                                               /* G5-1 */
    return ratioCorte({ Vn_kgf: Vn, phi: PHI_V, Fcr_kgcm2: Fcr,
      Fcr_a: a, Fcr_b: b, tope_kgcm2: tope, mandaFluencia: Fcr >= tope - 1e-9,
      art: ART["V.G5"],
      nota: "el Ag/2 es porque solo la mitad de la sección resiste el corte de forma " +
            "efectiva. El pandeo solo gobierna con D/t sobre 100, aceros altos o luces largas" }, d);
  }

  /* ---------- G6 · corte en el eje menor ------------------------------- */
  /* EL CORTE DE LA CORREA EN SU EJE DÉBIL, el de la componente paralela al
     faldón.  Se calcula POR CADA elemento que resiste corte, o sea por ala.
     Y la razón de esbeltez es bf/(2·tf) en I y tes pero bf/tf en CANALES: la
     misma asimetría que en F6 (fila V.G6). */
  function corteEjeMenor(d) {
    const mat = (typeof d.acero === "string") ? material(d.acero) : { Fy: d.Fy_kgcm2 };
    const bf = d.bf_cm, tf = d.tf_cm, tipo = d.tipo;
    if (!(bf > 0) || !(tf > 0)) throw new Error("acero: corteEjeMenor() necesita bf_cm y tf_cm");
    if (tipo !== "I" && tipo !== "te" && tipo !== "canal") {
      throw new Error(
        "acero: corteEjeMenor() necesita tipo «I», «te» o «canal».\n" +
        "  No es un detalle: la razón de esbeltez es bf/(2·tf) en I y tes pero bf/tf\n" +
        "  en CANALES, o sea un factor de 2. Es la misma asimetría que en F6.");
    }
    const razon = (tipo === "canal") ? bf / tf : bf / (2 * tf);
    const cv = Cv2({ h_tw: razon, Fy_kgcm2: mat.Fy, kv: KV_G6 });
    const nEl = (d.elementos === undefined) ? 2 : d.elementos;
    if (!(nEl >= 1)) throw new Error("acero: elementos tiene que ser ≥ 1");
    const VnPorElemento = 0.6 * mat.Fy * bf * tf * cv.Cv2;
    return ratioCorte({ Vn_kgf: VnPorElemento * nEl, VnPorElemento_kgf: VnPorElemento,
      phi: PHI_V, Cv2: cv.Cv2, tramo: cv.tramo, razon: razon, kv: KV_G6,
      elementos: nEl, tipo: tipo, art: ART["V.G6"], artLista: ART["V.G6.lista"],
      nota: "se calcula POR ELEMENTO que resiste corte, o sea por ala. En un perfil " +
            "laminado Cv2 = 1 siempre con Fy ≤ 70 ksi (User Note de G6)" }, d);
  }

  function ratioCorte(out, d) {
    out.Vd_kgf = out.phi * out.Vn_kgf;
    if (d.Vu_kgf !== undefined) {
      out.Vu_kgf = d.Vu_kgf;
      out.ratio = Math.abs(d.Vu_kgf) / out.Vd_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    return out;
  }

  /* =====================================================================
     CAPÍTULO H · FUERZAS COMBINADAS

     AQUÍ SE JUNTA TODO, y aquí está el error silencioso más fácil de cometer
     en el diseño de un pórtico: Pr y Mr NO SON LAS FUERZAS DEL ANÁLISIS DE
     PRIMER ORDEN.  La definición del propio H1.1 dice «determined in
     accordance with Chapter C», o sea CON el segundo orden ya dentro — B1 y
     B2, o un análisis riguroso.  Meter fuerzas de primer orden en la H1-1a da
     un ratio menor, el elemento pasa, y nada lo delata (fila H.Pr).  Por eso
     este módulo EXIGE que se declare de dónde vienen.

     LAS ECUACIONES SON IDÉNTICAS EN LAS DOS NORMAS, término por término.  Lo
     que divergo es lo de dentro: la E.090 §8.1.1.2 dice textualmente
     «φ = φc = factor de resistencia a la compresión = 0,85», así que la
     divergencia de un solo número del Capítulo 5 se propaga a TODA columna en
     flexo-compresión — que en un galpón son todas (fila H.phi).

     Y UN DETALLE DE ESTILO DE LA NORMA QUE CONVIENE VER: el 8/9 de la H1-1a
     es una fracción EXACTA, no un decimal redondeado, y por eso la envolvente
     empalma perfecta en Pr/Pc = 0,2 —las dos ecuaciones dan la misma M = 0,9
     sobre la línea de unidad—.  Contrasta con el 4,71, el 1,95 y el 1,51 de
     los capítulos E, F y G, que sí están redondeados y por eso dejan saltos
     (fila V.Cv2.coef).  Cuando la continuidad importa, el AISC conserva la
     fracción.
     ===================================================================== */

  const H1_UMBRAL = 0.2;          /* H1-1a vs H1-1b */
  const H1_COEF = 8 / 9;          /* H1-1a · fracción exacta, no 0,889 */
  const H1_3_MRY_MAX = 0.05;      /* H1.3 · Mry/Mcy < 0,05 para poder separar */

  /* De dónde vienen Pr y Mr · fila H.Pr.  No es burocracia: es la diferencia
     entre un diseño correcto y uno que pasa por no haber amplificado. */
  function exigeSegundoOrden(d) {
    const o = d.origen;
    if (o !== "segundo-orden" && o !== "primer-orden") {
      throw new Error(
        "acero: hay que declarar de dónde vienen Pr y Mr:\n" +
        "    origen: \"segundo-orden\"   (del Cap. C · B1/B2 o análisis riguroso)\n" +
        "    origen: \"primer-orden\"    (y entonces esto PARA)\n" +
        "  El H1.1 define Pr y Mr «in accordance with Chapter C», o sea CON los\n" +
        "  efectos de segundo orden dentro. Meter fuerzas de primer orden da un\n" +
        "  ratio menor, el elemento pasa, y no lo delata ningún resultado. Es el\n" +
        "  error silencioso más fácil de cometer en todo el diseño de un pórtico.");
    }
    if (o === "primer-orden") {
      throw new Error(
        "acero: estas fuerzas son de PRIMER ORDEN y el Capítulo H pide las del\n" +
        "  Capítulo C.\n" +
        "  Amplifícalas antes: estabilidad.segundoOrden() con B1 y B2, o un\n" +
        "  análisis de segundo orden. Con un pórtico de galpón la diferencia no es\n" +
        "  pequeña: B2 suele andar entre 1,1 y 1,5.");
    }
    return true;
  }

  /* ---------- H1.1 · la interacción · H1-1a y H1-1b -------------------- */
  /* TODOS LOS TÉRMINOS SE TOMAN POSITIVOS (User Note).  Es lo contrario que
     en H2, donde el signo importa y los términos se suman o se restan. */
  function interaccionH1(d) {
    exigeSegundoOrden(d);
    const Pr = Math.abs(d.Pr_kgf), Pc = d.Pc_kgf;
    if (!(Pc > 0)) throw new Error("acero: interaccionH1() necesita Pc_kgf > 0");
    if (!(Pr >= 0)) throw new Error("acero: interaccionH1() necesita Pr_kgf");
    const Mrx = Math.abs(d.Mrx_kgfcm || 0), Mry = Math.abs(d.Mry_kgfcm || 0);
    const Mcx = d.Mcx_kgfcm, Mcy = d.Mcy_kgfcm;
    if (Mrx > 0 && !(Mcx > 0)) throw new Error("acero: con Mrx hace falta Mcx_kgfcm > 0");
    if (Mry > 0 && !(Mcy > 0)) throw new Error("acero: con Mry hace falta Mcy_kgfcm > 0");

    const pp = Pr / Pc;
    const mm = (Mrx > 0 ? Mrx / Mcx : 0) + (Mry > 0 ? Mry / Mcy : 0);
    let valor, ecuacion, art;
    if (pp >= H1_UMBRAL) {
      valor = pp + H1_COEF * mm;
      ecuacion = "H1-1a · axial dominante (Pr/Pc ≥ 0,2)";
      art = ART["H.1a"];
    } else {
      valor = pp / 2 + mm;
      ecuacion = "H1-1b · flexión dominante (Pr/Pc < 0,2)";
      art = ART["H.1b"];
    }
    return {
      valor: valor, cumple: valor <= 1 + 1e-12,
      ecuacion: ecuacion, razonAxial: pp, sumaMomentos: mm,
      terminoAxial: pp >= H1_UMBRAL ? pp : pp / 2,
      terminoFlexion: pp >= H1_UMBRAL ? H1_COEF * mm : mm,
      art: art, artPr: ART["H.Pr"],
      /* LA DIVERGENCIA · fila H.phi.  Las ecuaciones son idénticas; lo que
         cambia es el φc que hay DENTRO de Pc, y la E.090 lo dice textual. */
      artPhi: ART["H.phi"],
      notaPhi: "las ecuaciones son idénticas en las dos normas; lo que divergimos " +
        "es el φc de dentro de Pc: 0,90 en el AISC contra 0,85 en la E.090 §8.1.1.2, " +
        "que lo dice textualmente. Manda el AISC.",
      /* Con el Pc de la E.090, que es 0,85/0,90 del nuestro. */
      valor_E090: (function () {
        const pcE = Pc * (PHI_C_E090 / PHI_C);
        const ppE = Pr / pcE;
        return ppE >= H1_UMBRAL ? ppE + H1_COEF * mm : ppE / 2 + mm;
      })(),
      nota: "todos los términos se toman POSITIVOS (User Note de H1.1). En H2 es al " +
            "contrario: ahí el signo importa."
    };
  }

  /* ---------- H1.2 · flexión con TRACCIÓN axial ------------------------ */
  /* Mismas ecuaciones, con Pc del Capítulo D.  Y el premio que casi nadie
     usa: la tracción estabiliza contra el pandeo lateral, así que Cb se
     puede multiplicar por √(1 + α·Pr/Pey) (fila H.Cb.bono).  Es el caso de la
     brida inferior del tijeral bajo gravedad: traccionada y flexionada a la
     vez.  SOLO para secciones de doble simetría. */
  function bonoCbTraccion(d) {
    if (d.dobleSimetria !== true) {
      throw new Error(
        "acero: el bono de Cb por tracción axial (H1-2) es SOLO para secciones de\n" +
        "  doble simetría. Pásalo como dobleSimetria: true cuando lo sea.");
    }
    const Pr = d.Pr_kgf, Iy = d.Iy_cm4, Lb = d.Lb_cm;
    if (!(Pr > 0)) {
      throw new Error("acero: bonoCbTraccion() necesita Pr_kgf > 0, la TRACCIÓN requerida");
    }
    if (!(Iy > 0)) throw new Error("acero: bonoCbTraccion() necesita Iy_cm4 > 0");
    if (!(Lb > 0)) throw new Error("acero: bonoCbTraccion() necesita Lb_cm > 0");
    const alfa = (d.metodo === "ASD") ? 1.6 : 1.0;
    const Pey = Math.PI * Math.PI * E_ACERO * Iy / (Lb * Lb);          /* H1-2 */
    const factor = Math.sqrt(1 + alfa * Pr / Pey);
    return { factor: factor, Pey_kgf: Pey, alfa: alfa, art: ART["H.Cb.bono"],
      nota: "la tracción axial estabiliza contra el pandeo lateral-torsional y la " +
            "norma lo reconoce. Es la brida inferior del tijeral bajo gravedad: " +
            "traccionada y flexionada a la vez." };
  }

  /* ---------- H1.3 · separar en el plano y fuera del plano ------------- */
  /* Permitido solo para perfiles laminados compactos de doble simetría, con
     Lcz ≤ Lcy y Mry/Mcy < 0,05.  Suele dar menos conservador que la
     interacción única, y la E.090 NO lo trae (fila H.1_3.div): se ofrece como
     opción y no como defecto. */
  function puedeSepararH13(d) {
    const razones = [];
    if (!(d.Lcz_cm <= d.Lcy_cm)) razones.push("Lcz tiene que ser ≤ Lcy");
    const mry = Math.abs(d.Mry_kgfcm || 0);
    const r = (mry > 0 && d.Mcy_kgfcm > 0) ? mry / d.Mcy_kgfcm : 0;
    if (!(r < H1_3_MRY_MAX)) razones.push("Mry/Mcy = " + r.toFixed(3) + " tiene que ser < 0,05");
    if (d.laminadoCompactoDobleSimetria !== true) {
      razones.push("solo vale para perfil laminado compacto de doble simetría");
    }
    return { puede: razones.length === 0, razones: razones, razonMry: r,
      art: ART["H.1_3"], artDivergencia: ART["H.1_3.div"],
      nota: "la E.090 no trae H1.3: solo tiene la interacción única. Usarlo es menos " +
            "conservador, así que es una opción y no el defecto." };
  }

  /* H1-3 · fuera del plano.  Mcx se calcula con Cb = 1,0 y DESPUÉS se
     multiplica por Cb dentro de la ecuación; la User Note avisa de que
     Cb·Mcx puede superar φb·Mpx y que eso es correcto, porque la fluencia ya
     la captura H1-1a/b. */
  function fueraDelPlanoH13(d) {
    exigeSegundoOrden(d);
    const Pr = Math.abs(d.Pr_kgf), Pcy = d.Pcy_kgf;
    const Mrx = Math.abs(d.Mrx_kgfcm), McxCb1 = d.McxCb1_kgfcm, cb = d.Cb;
    if (!(Pcy > 0)) throw new Error("acero: fueraDelPlanoH13() necesita Pcy_kgf > 0");
    if (!(McxCb1 > 0)) {
      throw new Error(
        "acero: fueraDelPlanoH13() necesita McxCb1_kgfcm, la resistencia a flexión\n" +
        "  calculada CON Cb = 1,0. El Cb entra aparte, multiplicando dentro de la\n" +
        "  ecuación: no se puede pasar un Mcx que ya lleve Cb dentro o se aplica dos veces.");
    }
    if (!(cb > 0)) throw new Error("acero: fueraDelPlanoH13() necesita Cb > 0");
    const p = Pr / Pcy;
    const m = Mrx / (cb * McxCb1);
    const valor = p * (1.5 - 0.5 * p) + m * m;
    return { valor: valor, cumple: valor <= 1 + 1e-12,
      terminoAxial: p * (1.5 - 0.5 * p), terminoFlexion: m * m,
      razonAxial: p, CbMcx_kgfcm: cb * McxCb1,
      art: ART["H.1_3.eq"],
      nota: "Cb·Mcx PUEDE superar φb·Mpx y es correcto: la fluencia la captura " +
            "H1-1a/b, no esta ecuación. Todos los términos, positivos." };
  }

  /* ---------- H2 · secciones asimétricas, por ESFUERZOS --------------- */
  /* Trabaja con ESFUERZOS, no con fuerzas, y sobre los ejes PRINCIPALES w
     (mayor) y z (menor).  Hay que usar el módulo de sección S DEL PUNTO
     concreto que se analiza y RESPETAR EL SIGNO: los términos de flexión se
     suman o se restan al axial según corresponda.  Es al contrario que H1,
     donde todo va en positivo.

     Y SE PUEDE USAR SIEMPRE, en lugar de H1, para cualquier forma (fila
     H.2.opcion): sirve de comprobación cruzada del propio complemento, dos
     caminos independientes para el mismo elemento. */
  function interaccionH2(d) {
    exigeSegundoOrden(d);
    const fra = d.fra_kgcm2, Fca = d.Fca_kgcm2;
    if (typeof fra !== "number") throw new Error("acero: interaccionH2() necesita fra_kgcm2");
    if (!(Fca > 0)) throw new Error("acero: interaccionH2() necesita Fca_kgcm2 > 0");
    const frbw = d.frbw_kgcm2 || 0, frbz = d.frbz_kgcm2 || 0;
    const Fcbw = d.Fcbw_kgcm2, Fcbz = d.Fcbz_kgcm2;
    if (frbw !== 0 && !(Fcbw > 0)) throw new Error("acero: con frbw hace falta Fcbw_kgcm2 > 0");
    if (frbz !== 0 && !(Fcbz > 0)) throw new Error("acero: con frbz hace falta Fcbz_kgcm2 > 0");
    if (d.signosRevisados !== true) {
      throw new Error(
        "acero: la H2-1 se evalúa RESPETANDO EL SIGNO de los esfuerzos en el punto\n" +
        "  crítico: los términos de flexión se SUMAN O SE RESTAN al axial según\n" +
        "  corresponda, y hay que usar el módulo S de ese punto concreto.\n" +
        "  No es como H1, donde todo va en positivo. Cuando los signos estén\n" +
        "  revisados en el punto que se analiza, pasa signosRevisados: true.");
    }
    const ta = fra / Fca;
    const tw = frbw !== 0 ? frbw / Fcbw : 0;
    const tz = frbz !== 0 ? frbz / Fcbz : 0;
    const valor = ta + tw + tz;
    return { valor: valor, cumple: valor <= 1 + 1e-12,
      terminoAxial: ta, terminoW: tw, terminoZ: tz,
      art: ART["H.2"], artOpcion: ART["H.2.opcion"],
      nota: "ejes PRINCIPALES w (mayor) y z (menor), con el S del punto analizado y " +
            "su signo. Se puede usar para cualquier forma en lugar de H1, y eso la " +
            "hace útil como comprobación cruzada." };
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
    c2DeC1, factoresE7, anchoEfectivo, areaEfectivaE7, areaEfectivaRedondo,
    PHI_B, TOPE_MP_E090, TOPE_F6, FR_E090, B4B,
    FL, FL_E090, clasificaFlexion, Cb, Lp, rts, coefC, Lr,
    flexionF2, flexionF6, ejesAnguloF10, requiereH2,
    PHI_V, PHI_V_ALMA, PHI_V_E090, COEF_PHI_V1, COEF_SIN_RIGID,
    KV_SIN_RIGID, KV_E090, LIM_H_TW_E090, KV_G3, KV_G4, KV_G6,
    kv, Cv1, Cv2, corteAlma, requiereRigidizadores,
    hSobreTw, articuloCorte, ARTICULO_CORTE,
    corteAngulo, corteHSS, corteRedondo, corteEjeMenor,
    H1_UMBRAL, H1_COEF, H1_3_MRY_MAX,
    exigeSegundoOrden, interaccionH1, bonoCbTraccion,
    puedeSepararH13, fueraDelPlanoH13, interaccionH2
  };
});
