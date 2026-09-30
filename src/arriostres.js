/* =====================================================================
   arriostres.js — el sistema de arriostramiento, y el Apéndice 6

   Cierra E5.  Cubre la cruz de San Andrés del muro y del techo, el
   arriostre de la brida inferior, y —lo que de verdad justifica el módulo—
   LA COMPROBACIÓN DEL APÉNDICE 6.

   UN ARRIOSTRE TIENE QUE CUMPLIR DOS COSAS, Y LA SEGUNDA CASI NUNCA SE
   COMPRUEBA: resistencia Y RIGIDEZ.  Una varilla de 1/2" tiene resistencia
   de sobra para el 1 % de Pr y puede ser demasiado flexible: si no llega a
   βbr, el punto NO está arriostrado y la longitud no arriostrada que se
   supuso en el Capítulo E no existe.  Todo el cálculo de la columna se
   apoya en un arriostre que no arriostra.

   Y AQUÍ CORRIJO UNA ETAPA QUE ASIGNÉ MAL varias veces: vine diciendo que
   «la deuda del Apéndice 6 es de E7».  No del todo.  El Apéndice 6
   dimensiona EL ARRIOSTRE, y eso es esto, E5.  Lo que va a E7 es su
   CONEXIÓN, y la norma lo dice aparte: la conexión de un arriostre de panel
   se diseña con la resistencia del arriostre PUNTUAL, que es el doble
   (fila A6.conexion).

   DOS TEXTUALES DEL APÉNDICE 6 QUE CONFIRMAN DECISIONES YA TOMADAS:
     · «When lateral bracing does not limit twist, the column is susceptible
       to torsional buckling as addressed in Section E4» — por eso en
       columnas.js la Lcz va con la altura entera aunque haya largueros.
     · «Beams shall be restrained against rotation about their longitudinal
       axis at points of support» — es la hipótesis F1(b) otra vez, o sea el
       clip de la correa.
   Las dos las habíamos deducido y el Apéndice 6 las dice (fila A6.giro).
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./acero.js"),
      require("./riostras.js"));
  } else {
    raiz.ARRIOSTRES = definir(raiz.INVENTARIO, raiz.ACERO, raiz.RIOSTRAS);
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC, RI) {
  "use strict";

  const ART = INV.declara("arriostres.js", [
    "A6.dos", "A6.col.panel", "A6.col.punto", "A6.viga.panel", "A6.viga.punto",
    "A6.Cd", "A6.giro", "A6.conexion", "A6.Lbr.min",
    "E.tension.only", "T.esbeltez", "T.varillas", "T.varillas.Rn",
    "E.C3.arriostre", "U.6"
  ]);

  const PHI_A6 = 0.75;          /* Ap. 6.2 y 6.3 */
  const CD_NORMAL = 1.0;        /* fila A6.Cd */
  const CD_INFLEXION = 2.0;

  /* ---------- 6.2 · arriostre de columna ------------------------------ */
  function columna(d) {
    const Pr = Math.abs(d.Pr_kgf), Lbr = d.Lbr_cm, tipo = d.tipo;
    if (!(Pr > 0)) throw new Error("arriostres: columna() necesita Pr_kgf, el axial requerido");
    if (!(Lbr > 0)) {
      throw new Error(
        "arriostres: columna() necesita Lbr_cm.\n" +
        "  En arriostre de PANEL es la longitud no arriostrada dentro del panel; en\n" +
        "  PUNTUAL, la adyacente al punto, y si las dos adyacentes dan Pr/Lbr distintos\n" +
        "  se toma el mayor (Ap. 6.2.2).");
    }
    if (tipo !== "panel" && tipo !== "punto") {
      throw new Error(
        "arriostres: el tipo es «panel» o «punto», no «" + tipo + "».\n" +
        "  No es lo mismo: el puntual pide el DOBLE de resistencia (0,01·Pr contra\n" +
        "  0,005·Pr) y CUATRO VECES la rigidez (8/Lbr contra 2/Lbr).");
    }
    /* ALIVIO DEL Ap. 6.2.2 · Lbr no hace falta tomarlo menor que la longitud
       efectiva máxima que la columna admitiría con su Pr. Como βbr va con
       1/Lbr, un Lbr mayor BAJA la rigidez exigida (fila A6.Lbr.min). */
    let LbrUsado = Lbr, alivio = null;
    if (tipo === "punto" && d.LcMaxAdmisible_cm > Lbr) {
      alivio = { de: Lbr, a: d.LcMaxAdmisible_cm, art: ART["A6.Lbr.min"],
        nota: "el Ap. 6.2.2 permite no tomar Lbr menor que la Lc máxima admisible " +
              "para el Pr requerido: baja la rigidez exigida" };
      LbrUsado = d.LcMaxAdmisible_cm;
    }
    if (tipo === "panel") {
      return { Vbr_kgf: 0.005 * Pr, beta_kgfcm: (1 / PHI_A6) * (2 * Pr / LbrUsado),
        tipo: "panel", Pr_kgf: Pr, Lbr_cm: LbrUsado, phi: PHI_A6,
        art: ART["A6.col.panel"], artDos: ART["A6.dos"],
        nota: "y su CONEXIÓN se diseña como arriostre puntual, con 0,01·Pr: el doble " +
              "(fila A6.conexion, y eso sí es de E7)" };
    }
    return { Pbr_kgf: 0.01 * Pr, beta_kgfcm: (1 / PHI_A6) * (8 * Pr / LbrUsado),
      tipo: "punto", Pr_kgf: Pr, Lbr_cm: LbrUsado, phi: PHI_A6, alivio: alivio,
      art: ART["A6.col.punto"], artDos: ART["A6.dos"] };
  }

  /* ---------- 6.3 · arriostre lateral de viga ------------------------- */
  function viga(d) {
    const Mr = Math.abs(d.Mr_kgfcm), Lbr = d.Lbr_cm, ho = d.ho_cm, tipo = d.tipo;
    if (!(Mr > 0)) throw new Error("arriostres: viga() necesita Mr_kgfcm");
    if (!(Lbr > 0)) throw new Error("arriostres: viga() necesita Lbr_cm");
    if (!(ho > 0)) {
      throw new Error("arriostres: viga() necesita ho_cm, la distancia entre centroides de alas");
    }
    if (tipo !== "panel" && tipo !== "punto") {
      throw new Error("arriostres: el tipo es «panel» o «punto», no «" + tipo + "»");
    }
    /* Cd = 2,0 solo en el arriostre más cercano al punto de inflexión de una
       viga en curvatura doble · fila A6.Cd. */
    const Cd = (d.cercaInflexion === true) ? CD_INFLEXION : CD_NORMAL;
    const base = Mr * Cd / ho;
    const out = (tipo === "panel")
      ? { Vbr_kgf: 0.01 * base, beta_kgfcm: (1 / PHI_A6) * (4 * base / Lbr),
          art: ART["A6.viga.panel"] }
      : { Pbr_kgf: 0.02 * base, beta_kgfcm: (1 / PHI_A6) * (10 * base / Lbr),
          art: ART["A6.viga.punto"] };
    return Object.assign(out, { tipo: tipo, Cd: Cd, Mr_kgfcm: Mr, ho_cm: ho,
      Lbr_cm: Lbr, phi: PHI_A6, artCd: ART["A6.Cd"], artDos: ART["A6.dos"],
      artGiro: ART["A6.giro"],
      notaColocacion: "el arriostre lateral va EN O CERCA DEL ALA COMPRIMIDA, salvo en " +
        "el extremo libre de un voladizo, donde va en la traccionada",
      notaInflexion: "en curvatura doble el punto de inflexión NO cuenta como punto " +
        "arriostrado a menos que haya arriostre ahí: contarlo es gratis y falso" });
  }

  /* ---------- LA RIGIDEZ QUE APORTA UNA DIAGONAL ---------------------- */
  /* Es la mitad que casi nunca se comprueba.  Una diagonal a θ del eje del
     arriostre aporta β = (A·E/Ld)·cos²θ: el cos² sale de proyectar el
     desplazamiento y la fuerza, y castiga mucho una diagonal tendida. */
  function rigidezDiagonal(d) {
    const A_cm2 = d.A_cm2, Ld = d.Ld_cm, E = d.E_kgcm2 || AC.E_ACERO;
    const th = d.theta_grad;
    if (!(A_cm2 > 0)) throw new Error("arriostres: rigidezDiagonal() necesita A_cm2 > 0");
    if (!(Ld > 0)) throw new Error("arriostres: rigidezDiagonal() necesita Ld_cm, la longitud de la diagonal");
    if (typeof th !== "number" || th < 0 || th >= 90) {
      throw new Error("arriostres: rigidezDiagonal() necesita theta_grad, el ángulo de la " +
        "diagonal con la dirección que arriostra, entre 0 y 90");
    }
    const c = Math.cos(th * Math.PI / 180);
    return { beta_kgfcm: (A_cm2 * E / Ld) * c * c, cos2: c * c, theta_grad: th,
      art: ART["A6.dos"],
      nota: "el cos² sale de proyectar el desplazamiento y la fuerza: una diagonal " +
            "tendida aporta muy poca rigidez aunque tenga área de sobra" };
  }

  /* ---------- verificar un arriostre contra las DOS exigencias -------- */
  function verifica(d) {
    const dem = d.demanda;
    if (!dem || (dem.Pbr_kgf === undefined && dem.Vbr_kgf === undefined)) {
      throw new Error("arriostres: verifica() necesita la demanda de columna() o viga()");
    }
    const Freq = (dem.Pbr_kgf !== undefined) ? dem.Pbr_kgf : dem.Vbr_kgf;

    /* RESISTENCIA · la diagonal trabaja a tracción, así que Cap. D. Si es
       varilla roscada, sus DOS estados límite (fila T.varillas). */
    let res;
    if (d.esVarilla === true) {
      res = AC.varillaRoscada({ acero: d.acero || "A36", Ab_cm2: d.A_cm2,
        Pu_kgf: Freq / (d.cosTheta === undefined ? 1 : d.cosTheta) });
    } else {
      res = AC.traccion({ acero: d.acero || "A36", Ag_cm2: d.A_cm2,
        An_cm2: d.An_cm2, U: d.U,
        Pu_kgf: Freq / (d.cosTheta === undefined ? 1 : d.cosTheta) });
    }

    /* RIGIDEZ · la que casi nunca se comprueba. */
    const rig = rigidezDiagonal({ A_cm2: d.A_cm2, Ld_cm: d.Ld_cm,
      theta_grad: d.theta_grad, E_kgcm2: d.E_kgcm2 });
    const razonRig = dem.beta_kgfcm / rig.beta_kgfcm;

    const cumpleRes = res.ratio <= 1 + 1e-12;
    const cumpleRig = razonRig <= 1 + 1e-12;
    return {
      resistencia: { ratio: res.ratio, cumple: cumpleRes, manda: res.manda,
        Pd_kgf: res.Pd_kgf, art: res.art },
      rigidez: { requerida_kgfcm: dem.beta_kgfcm, aportada_kgfcm: rig.beta_kgfcm,
        ratio: razonRig, cumple: cumpleRig, cos2: rig.cos2, art: rig.art },
      cumple: cumpleRes && cumpleRig,
      gobierna: razonRig > res.ratio ? "RIGIDEZ" : "resistencia",
      art: ART["A6.dos"],
      resumen: "resistencia " + res.ratio.toFixed(3) + " · rigidez " +
        razonRig.toFixed(3) + " → gobierna " +
        (razonRig > res.ratio ? "la RIGIDEZ" : "la resistencia") +
        (cumpleRes && !cumpleRig
          ? " · ATENCIÓN: resiste pero NO arriostra, así que la longitud no " +
            "arriostrada que se supuso en el Cap. E no existe"
          : "")
    };
  }

  /* ---------- la cruz de San Andrés ----------------------------------- */
  /* Usa la iteración solo-tracción de riostras.js: no se reimplementa. */
  function cruz(m, MODELO, d) {
    return RI.cruz(m, MODELO, d);
  }

  function resuelveCruz(m, opciones) {
    return RI.resuelve(m, opciones);
  }

  /* ---------- la esbeltez de un tirante · E.090 §2.7 ------------------ */
  /* Una varilla de 5/8" con l/r de 600 es LEGAL: las dos normas eximen del
     límite de esbeltez a los elementos diseñados para tracción que solo ven
     una compresión reducida en otra condición de carga. */
  function esbeltezTirante(d) {
    const e = AC.esbeltezTraccion({ L_cm: d.L_cm, r_cm: d.r_cm,
      esVarilla: d.esVarilla === true });
    return Object.assign({}, e, { artExencion: ART["E.tension.only"],
      notaExencion: "E.090 §2.7: los elementos diseñados para tracción «que pueden " +
        "estar sometidos a una compresión reducida en otra condición de carga, no " +
        "necesitan cumplir el límite de esbeltez en compresión». Por eso una varilla " +
        "de 5/8\" con l/r de 600 es legal." });
  }

  return { ART, PHI_A6, CD_NORMAL, CD_INFLEXION,
    columna, viga, rigidezDiagonal, verifica, cruz, resuelveCruz, esbeltezTirante };
});
