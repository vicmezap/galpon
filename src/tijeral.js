/* =====================================================================
   tijeral.js — la armadura de cubierta

   Monta la geometría, la carga en los nudos, la resuelve con el solver de
   pórtico —liberando los giros, fila E.armadura— y verifica cada barra por
   la clase que le toca.

   DOS COSAS JUSTIFICAN ESTE MÓDULO, y no son el montaje de la geometría:

   1) LA CARGA FUERA DE NUDO.  Una armadura solo es una armadura si la carga
      entra por los nudos.  Si una correa cae entre dos nudos, la brida
      superior deja de ser una barra axial y pasa a ser una viga-columna del
      Capítulo H: el momento local puede doblar el ratio.  Es el error más
      caro y el más fácil de no ver, porque el modelo resuelve igual de bien
      y da axiales perfectamente razonables.  Aquí se detecta y se dice.

   2) LA INVERSIÓN DE SIGNO.  Bajo gravedad la brida inferior trabaja a
      TRACCIÓN; bajo 0,9D − 1,3W trabaja a COMPRESIÓN, y su longitud no
      arriostrada fuera del plano es la distancia entre arriostres laterales,
      que suele ser grande.  Por eso la combinación de levantamiento
      dimensiona el arriostre de la brida inferior (fila U.6).  Lo mismo le
      pasa a las diagonales con la nieve desbalanceada (fila N.desbal.corto).
      Una barra que solo se comprueba con la envolvente de gravedad puede
      pasar y estar mal.

   EN UN TIJERAL MANDA EL 0,80, NO τb · fila E.C2.k080: las barras trabajan
   axialmente y τb solo toca las rigideces de flexión.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./modelo.js"),
      require("./solver.js"), require("./acero.js"), require("./elemento.js"));
  } else {
    raiz.TIJERAL = definir(raiz.INVENTARIO, raiz.MODELO, raiz.SOLVER,
      raiz.ACERO, raiz.ELEMENTO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, M, S, AC, EL) {
  "use strict";

  const ART = INV.declara("tijeral.js", [
    "E.armadura", "E.C2.k080", "E.C3.arriostre", "G.correa.nudo",
    "C.E5", "C.E5.cond", "C.E6.m2", "C.E6.a", "T.armados.esb",
    "T.U.c8", "U.6", "N.desbal.corto", "F.F10.H2", "Lr.red.k"
  ]);

  /* Las clases de barra de una armadura, que NO se verifican igual. */
  const CLASES = ["brida superior", "brida inferior", "diagonal", "montante"];

  /* ---------- geometría ------------------------------------------------ */
  /* Armadura simétrica a dos aguas, brida inferior horizontal.  `paneles` es
     el número de paños POR MEDIA LUZ, así que la armadura tiene 2·n paños. */
  function geometria(d) {
    const L = d.luz_m, n = d.paneles, h0 = d.peralteApoyo_m, s = d.pendiente;
    if (!(L > 0)) throw new Error("tijeral: geometria() necesita luz_m > 0");
    if (!(n >= 1) || n !== Math.round(n)) {
      throw new Error("tijeral: paneles tiene que ser un entero ≥ 1, por MEDIA luz");
    }
    if (!(h0 > 0)) throw new Error("tijeral: geometria() necesita peralteApoyo_m > 0");
    if (!(s >= 0)) throw new Error("tijeral: geometria() necesita pendiente ≥ 0 (tanto por uno)");

    const paso = L / (2 * n);
    const nudos = [];
    /* brida inferior: horizontal en y = 0 */
    for (let i = 0; i <= 2 * n; i++) {
      nudos.push({ id: "I" + i, x_m: i * paso, y_m: 0, clase: "inferior", panel: i });
    }
    /* brida superior: sube hasta la cumbre y baja */
    for (let i = 0; i <= 2 * n; i++) {
      const x = i * paso;
      const dx = (x <= L / 2) ? x : (L - x);
      nudos.push({ id: "S" + i, x_m: x, y_m: h0 + dx * s, clase: "superior", panel: i });
    }

    const barras = [];
    for (let i = 0; i < 2 * n; i++) {
      barras.push({ id: "BS" + i, i: "S" + i, j: "S" + (i + 1), clase: "brida superior", panel: i });
      barras.push({ id: "BI" + i, i: "I" + i, j: "I" + (i + 1), clase: "brida inferior", panel: i });
    }
    /* montantes en cada nudo, incluidos los extremos */
    for (let i = 0; i <= 2 * n; i++) {
      barras.push({ id: "V" + i, i: "I" + i, j: "S" + i, clase: "montante", panel: i });
    }
    /* diagonales hacia la cumbre: del nudo inferior i al superior i+1 en la
       mitad izquierda, y en espejo en la derecha */
    for (let i = 0; i < 2 * n; i++) {
      const haciaCumbre = i < n;
      barras.push({
        id: "D" + i,
        i: haciaCumbre ? "I" + i : "I" + (i + 1),
        j: haciaCumbre ? "S" + (i + 1) : "S" + i,
        clase: "diagonal", panel: i
      });
    }
    return { luz_m: L, paneles: n, paso_m: paso, peralteApoyo_m: h0, pendiente: s,
      peralteCumbre_m: h0 + (L / 2) * s,
      nudos: nudos, barras: barras,
      xNudosSuperiores: nudos.filter((x) => x.clase === "superior").map((x) => x.x_m),
      art: ART["E.armadura"] };
  }

  /* ---------- el modelo, con los giros liberados · fila E.armadura ---- */
  function arma(g, d) {
    /* UNA BRIDA SUPERIOR SUBDIVIDIDA NO ES UNA ARMADURA · fila G.correa.nudo.
       generador.subdivideBridaSuperior() parte los paños para colgar correas
       intermedias, y entonces los tramos tienen que ir CONTINUOS y pasar por el
       Capítulo H.  Si llegan aquí, arma() les liberaría los giros y el momento
       local que se quería capturar desaparecería sin dejar rastro: el modelo
       resolvería igual de bien y daría axiales razonables, que es exactamente la
       forma de fallar que este módulo existe para impedir. */
    if (g.requiereCapituloH) {
      throw new Error(
        "tijeral: esta geometría tiene la brida superior SUBDIVIDIDA y arma() la\n" +
        "  trataría como armadura, liberando los giros. Eso borra el momento local\n" +
        "  que la subdivisión existe para capturar.\n" +
        "  " + (g.nota || "") + "\n" +
        "  Todavía no está escrito el montaje con la brida continua: hasta que lo\n" +
        "  esté, o se usa una geometría con la correa EN EL NUDO\n" +
        "  —generador.panelesParaCorreas()—, o se modela la brida superior aparte.");
    }
    const m = M.nuevo({ nivel: d.nivel || "LRFD", nombre: d.nombre || "tijeral",
      combinacion: d.combinacion });
    for (const n of g.nudos) M.nudo(m, { id: n.id, x_m: n.x_m, y_m: n.y_m });
    /* Apoyos en los extremos de la brida INFERIOR: articulado y rodillo, que
       es lo que apoya sobre las columnas. */
    M.apoyo(m, { nudo: "I0", ux: true, uy: true });
    M.apoyo(m, { nudo: "I" + (2 * g.paneles), uy: true });

    const sec = d.secciones || {};
    for (const b of g.barras) {
      const p = sec[b.clase];
      if (!p) {
        throw new Error(
          "tijeral: falta la sección de «" + b.clase + "».\n" +
          "  Hay que dar una por clase: " + CLASES.join(" · ") + ".\n" +
          "  Aunque sea una tentativa: el bucle de E5 la irá cambiando.");
      }
      M.barraArmadura(m, { id: b.id, i: b.i, j: b.j,
        A_cm2: p.A_cm2, I_cm4: p.I_cm4 !== undefined ? p.I_cm4 : (p.Ix_cm4 || 0),
        E_kgcm2: p.E_kgcm2, perfil: p });
    }
    return m;
  }

  /* ---------- LA CARGA TIENE QUE ENTRAR POR LOS NUDOS ------------------ */
  /* Si una correa cae entre dos nudos, la brida superior deja de ser una
     barra axial: es una viga-columna del Capítulo H.  El modelo resuelve
     igual de bien y da axiales razonables, así que el error no se ve.  Por
     eso esto NO reparte la carga a los nudos vecinos en silencio: para. */
  const TOL_NUDO_M = 0.01;      /* 1 cm · tolerancia de coincidencia */

  function cargaEnNudos(m, g, d) {
    const xs = d.xCorreas_m;
    if (!Array.isArray(xs) || !xs.length) {
      throw new Error("tijeral: cargaEnNudos() necesita xCorreas_m, la posición de cada correa");
    }
    const P = d.PporCorrea_kgf;
    if (!(typeof P === "number")) {
      throw new Error("tijeral: cargaEnNudos() necesita PporCorrea_kgf (negativo si baja)");
    }
    const nudosSup = g.nudos.filter((x) => x.clase === "superior");
    const fuera = [];
    for (const x of xs) {
      let mejor = null, dmin = Infinity;
      for (const nd of nudosSup) {
        const dd = Math.abs(nd.x_m - x);
        if (dd < dmin) { dmin = dd; mejor = nd; }
      }
      if (dmin > TOL_NUDO_M) {
        fuera.push({ x_m: x, nudoMasCercano: mejor.id, separacion_m: dmin });
      } else {
        M.cargaNudo(m, { nudo: mejor.id, Fy_kgf: P });
      }
    }
    if (fuera.length) {
      throw new Error(
        "tijeral: " + fuera.length + " correa(s) NO caen en un nudo de la brida superior.\n" +
        fuera.map((f) => "    x = " + f.x_m.toFixed(3) + " m · a " +
          (f.separacion_m * 100).toFixed(1) + " cm del nudo " + f.nudoMasCercano).join("\n") + "\n" +
        "  Una armadura solo es una armadura si la carga entra por los nudos. Con la\n" +
        "  correa entre nudos la brida superior deja de ser una barra axial y pasa a\n" +
        "  ser una VIGA-COLUMNA del Capítulo H: el momento local puede doblar el ratio.\n" +
        "  Y el modelo resolvería igual de bien, dando axiales razonables, así que el\n" +
        "  error no se vería.\n" +
        "  DOS SALIDAS, LAS DOS LEGÍTIMAS · " + ART["G.correa.nudo"] + ":\n" +
        "   1) casar el número de paños con el de correas —paso del paño = " +
             g.paso_m.toFixed(3) + " m—;\n" +
        "      generador.panelesParaCorreas() lo resuelve al revés: elige los paños\n" +
        "      DESPUÉS de saber cada cuánto va la correa, que es el orden correcto.\n" +
        "   2) dejar las correas intermedias y verificar la brida superior por FLEXIÓN\n" +
        "      Y CARGA AXIAL, Capítulo H: generador.subdivideBridaSuperior(). McCormac\n" +
        "      10.6 p. 327 llama a ESTA la económica en luces grandes, así que no es\n" +
        "      un apaño: con 40 m de luz y correa cada 0,70 m son 17 nudos de paño en\n" +
        "      vez de 59.\n" +
        "  Lo que no hay es una tercera: repartir la carga a los nudos vecinos y callarse.");
    }
    return { correas: xs.length, PporCorrea_kgf: P, total_kgf: P * xs.length,
      art: ART["F.F10.H2"] };
  }

  /* Reparte el peso propio estimado de la armadura en los nudos superiores. */
  function pesoPropio(m, g, d) {
    const w = d.peso_kgfm2, at = d.anchoTributario_m;
    if (!(w >= 0) || !(at > 0)) {
      throw new Error("tijeral: pesoPropio() necesita peso_kgfm2 y anchoTributario_m");
    }
    const total = w * g.luz_m * at;
    const nudos = g.nudos.filter((x) => x.clase === "superior");
    /* Los nudos de extremo toman la mitad del área tributaria. */
    const n = nudos.length - 1;
    for (let k = 0; k < nudos.length; k++) {
      const f = (k === 0 || k === nudos.length - 1) ? 0.5 : 1.0;
      M.cargaNudo(m, { nudo: nudos[k].id, Fy_kgf: -total / n * f });
    }
    return { total_kgf: total, porNudo_kgf: total / n };
  }

  /* ---------- LA INVERSIÓN DE SIGNO · lo que justifica el módulo ------ */
  /* Bajo gravedad la brida inferior tracciona; bajo 0,9D − 1,3W comprime, y
     su longitud no arriostrada fuera del plano es grande.  Una barra que
     solo se mira con la envolvente de gravedad puede pasar y estar mal. */
  function inversiones(corridas) {
    if (!Array.isArray(corridas) || corridas.length < 2) {
      throw new Error(
        "tijeral: inversiones() necesita al menos DOS corridas, cada una con su\n" +
        "  combinación y su resultado del solver. Con una sola no hay nada que\n" +
        "  comparar, y es justo con una sola como se pasa por alto el levantamiento.");
    }
    const ids = Object.keys(corridas[0].resultado.fuerzas);
    const out = [];
    for (const id of ids) {
      const Ns = corridas.map((c) => ({ comb: c.combinacion, N: c.resultado.fuerzas[id].N_kgf }));
      const max = Math.max.apply(null, Ns.map((x) => x.N));
      const min = Math.min.apply(null, Ns.map((x) => x.N));
      if (max > 0 && min < 0) {
        out.push({
          barra: id, invierte: true,
          traccionMax_kgf: max, compresionMax_kgf: min,
          combTraccion: Ns.find((x) => x.N === max).comb,
          combCompresion: Ns.find((x) => x.N === min).comb,
          porCombinacion: Ns
        });
      }
    }
    return {
      hay: out.length > 0, cuantas: out.length, barras: out,
      art: ART["U.6"], artNieve: ART["N.desbal.corto"],
      nota: out.length
        ? "estas barras cambian de signo entre combinaciones: hay que comprobarlas " +
          "EN LOS DOS SENTIDOS, y la compresión exige su longitud no arriostrada " +
          "fuera del plano, que en la brida inferior suele ser grande"
        : "ninguna barra cambia de signo entre las combinaciones dadas"
    };
  }

  /* ---------- las longitudes no arriostradas, con sus hipótesis ------- */
  /* ES LA SUBTILEZA DEL TIJERAL: cada clase de barra tiene una longitud en
     el plano y otra FUERA del plano, y no son la misma.  Y el arriostre que
     define la de fuera tiene que ganárselo (fila E.C3.arriostre). */
  function longitudes(g, d) {
    const paso = g.paso_m * 100;
    const sepCorreas = d.separacionCorreas_m;
    const sepArriostres = d.separacionArriostresInferior_m;
    if (!(sepCorreas > 0)) {
      throw new Error(
        "tijeral: longitudes() necesita separacionCorreas_m.\n" +
        "  Es la que arriostra la brida SUPERIOR fuera del plano — si la correa se\n" +
        "  gana el Apéndice 6 (fila E.C3.arriostre). Sin ese dato la longitud fuera\n" +
        "  del plano de la brida superior sería la luz entera.");
    }
    if (!(sepArriostres > 0)) {
      throw new Error(
        "tijeral: longitudes() necesita separacionArriostresInferior_m.\n" +
        "  ES EL DATO QUE DECIDE EL LEVANTAMIENTO: bajo 0,9D − 1,3W la brida inferior\n" +
        "  se comprime, y su longitud fuera del plano es la distancia entre arriostres\n" +
        "  laterales. Sin arriostres, es la luz entera del tijeral y no pasa nada.");
    }
    return {
      "brida superior": { enPlano_cm: paso, fueraPlano_cm: sepCorreas * 100,
        hipotesis: "fuera del plano la arriostran las correas, si cumplen el Apéndice 6" },
      "brida inferior": { enPlano_cm: paso, fueraPlano_cm: sepArriostres * 100,
        hipotesis: "fuera del plano la arriostran los arriostres laterales; bajo " +
          "levantamiento ESTA es la que manda" },
      "diagonal": { enPlano_cm: null, fueraPlano_cm: null,
        hipotesis: "la longitud de cada diagonal es su propia longitud: se toma de la barra" },
      "montante": { enPlano_cm: null, fueraPlano_cm: null,
        hipotesis: "igual que la diagonal" },
      art: ART["E.C3.arriostre"],
      deuda: "el Apéndice 6 de la correa y del arriostre se comprueba con "
             + "arriostres.js: resistencia Y RIGIDEZ. Lo que sí es de E7 es su CONEXIÓN, "
             + "que la norma dimensiona aparte, como arriostre puntual (fila A6.conexion)."
    };
  }

  /* ---------- verificar una barra, por su clase ----------------------- */
  /* Una diagonal de ángulo NO se verifica como una brida: va por el E5, que
     mete la excentricidad dentro de una esbeltez efectiva (fila C.E5). */
  function verificaBarra(d) {
    const b = d.barra, p = d.perfil, N = d.N_kgf;
    if (!b || !p) throw new Error("tijeral: verificaBarra() necesita barra y perfil");
    if (typeof N !== "number") throw new Error("tijeral: verificaBarra() necesita N_kgf");

    const esAngulo = p.familia === "L";
    const L_cm = d.L_cm;
    if (!(L_cm > 0)) throw new Error("tijeral: verificaBarra() necesita L_cm");

    let Lc_cm = d.Lc_cm, r_cm = d.r_cm, notaE5 = null;
    if (N < 0 && esAngulo && d.usarE5 !== false) {
      /* E5 · esbeltez EFECTIVA, que ya incluye la excentricidad de conectar
         el ángulo por un solo lado. Sus cinco condiciones son obligatorias. */
      const e5 = AC.anguloSimpleE5({ L_cm: L_cm, ra_cm: d.ra_cm,
        condiciones: d.condicionesE5, espacial: d.espacial,
        porLadoCorto: d.porLadoCorto, bl_cm: d.bl_cm, bs_cm: d.bs_cm, rz_cm: d.rz_cm });
      Lc_cm = e5.lr * d.ra_cm;     /* se devuelve como Lc/r, se rehace en cm */
      r_cm = d.ra_cm;
      notaE5 = e5;
    }

    const r = EL.verifica({
      id: b, perfil: p, acero: d.acero || "A36", combinacion: d.combinacion,
      familia: p.familia, fabricacion: d.fabricacion || p.fabricacion,
      origenFuerzas: d.origenFuerzas,
      An_cm2: d.An_cm2, U: d.U, empernado: d.empernado,
      noEsbelta: d.noEsbelta, elementosEsbeltez: d.elementosEsbeltez,
      arriostreComprobado: d.arriostreComprobado,
      fuerzas: { Pu_kgf: N },
      longitudes: { Lc_cm: Lc_cm, r_cm: r_cm }
    });
    return Object.assign({}, r, { clase: d.clase, E5: notaE5,
      artE5: ART["C.E5"], artK080: ART["E.C2.k080"],
      notaRigidez: "en un tijeral las barras trabajan axialmente, así que el factor " +
        "que manda en el análisis es el 0,80, no τb" });
  }

  return { ART, CLASES, TOL_NUDO_M,
    geometria, arma, cargaEnNudos, pesoPropio, inversiones, longitudes, verificaBarra };
});
