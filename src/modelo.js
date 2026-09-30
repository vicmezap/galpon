/* =====================================================================
   modelo.js — la estructura, antes de resolverla

   Un pórtico plano: nudos, barras, apoyos y cargas.  Nada de matrices aquí;
   esto solo describe y VALIDA.  Separarlo del solucionador es lo que permite
   que las pruebas del solucionador usen modelos construidos a mano y que los
   errores de datos salgan con un mensaje útil en vez de una matriz singular.

   TRES GRADOS DE LIBERTAD POR NUDO: ux, uy, rz.  Una armadura tiene dos, y
   por eso NO se escribe un solucionador de armadura: se liberan los giros en
   los extremos de cada barra y el de pórtico la produce (fila E.armadura).
   Al revés no funciona, y de ahí el orden de construcción.

   UNIDADES · el sistema canónico del proyecto mezcla metros para la geometría
   y centímetros para las secciones, porque así vienen las dos fuentes: los
   planos en metros y los catálogos en cm².  Este módulo guarda lo que le dan,
   con el nombre de la unidad en cada campo, y el solucionador convierte TODO
   a centímetros en un solo sitio.  Mezclar m y cm dentro de una matriz de
   rigidez da resultados que parecen razonables y están mil veces mal.

   EL NIVEL DE CARGA ES OBLIGATORIO · fila E.C1.nivel.  El AISC C1 dice que
   todos los efectos dependientes de la carga se calculan al nivel de las
   combinaciones LRFD.  Un modelo cargado con cargas de servicio sirve para
   deflexiones y NO sirve para estabilidad, así que el modelo lleva escrito
   cuál es y estabilidad.js se niega a trabajar con «servicio».
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.MODELO = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("modelo.js", ["E.armadura", "E.C1.nivel", "MAT.E"]);

  /* num() y no def(): la fila guarda «2 039 000» con separadores de millar,
     y Number() sobre ese texto da NaN. El NaN no avisa: se propaga por toda
     la matriz de rigidez y sale al final como una celda vacía. */
  const E_ACERO = INV.num("MAT.E");        /* kgf/cm² · fila MAT.E */
  const NIVELES = ["LRFD", "servicio"];
  const GDL = ["ux", "uy", "rz"];

  function nuevo(d) {
    d = d || {};
    if (NIVELES.indexOf(d.nivel) < 0) {
      throw new Error(
        "modelo: hay que declarar el nivel de carga: " + NIVELES.join(" ó ") + ".\n" +
        "  modelo.nuevo({ nivel: \"LRFD\" })\n" +
        "  El AISC C1 exige que todo efecto dependiente de la carga se calcule al\n" +
        "  nivel de las combinaciones LRFD. Un modelo con cargas de servicio vale\n" +
        "  para deflexiones y NO vale para estabilidad: el segundo orden saldría\n" +
        "  subestimado y nada lo delataría.");
    }
    return {
      nombre: d.nombre || "pórtico sin nombre",
      nivel: d.nivel,
      combinacion: d.combinacion || null,
      nudos: [],
      barras: [],
      cargasNudo: [],
      cargasBarra: []
    };
  }

  /* ---------- nudos ------------------------------------------------------ */
  function nudo(m, d) {
    if (d.id === undefined || d.id === null || d.id === "") {
      throw new Error("modelo: cada nudo necesita un id");
    }
    if (buscaNudo(m, d.id, true)) {
      throw new Error("modelo: el nudo «" + d.id + "» ya existe");
    }
    if (!isFinite(d.x_m) || !isFinite(d.y_m)) {
      throw new Error("modelo: el nudo «" + d.id + "» necesita x_m e y_m numéricos");
    }
    const nd = {
      id: d.id, x_m: d.x_m, y_m: d.y_m,
      /* true = RESTRINGIDO.  Por omisión el nudo es libre en los tres. */
      apoyo: { ux: false, uy: false, rz: false }
    };
    m.nudos.push(nd);
    return nd;
  }

  function buscaNudo(m, id, silencioso) {
    for (const n of m.nudos) if (n.id === id) return n;
    if (silencioso) return null;
    throw new Error("modelo: el nudo «" + id + "» no existe.\n" +
      "  Hay " + m.nudos.length + " nudos: " + m.nudos.map((x) => x.id).join(" "));
  }

  function apoyo(m, d) {
    const nd = buscaNudo(m, d.nudo);
    let alguno = false;
    for (const g of GDL) {
      if (d[g] !== undefined) {
        if (typeof d[g] !== "boolean") {
          throw new Error("modelo: apoyo." + g + " es true (restringido) o false (libre)");
        }
        nd.apoyo[g] = d[g];
        if (d[g]) alguno = true;
      }
    }
    if (!alguno && d.ux === undefined && d.uy === undefined && d.rz === undefined) {
      throw new Error(
        "modelo: apoyo() sin decir qué se restringe.\n" +
        "  apoyo(m, { nudo: \"" + d.nudo + "\", ux: true, uy: true, rz: false })\n" +
        "  Empotrado son los tres; articulado, ux y uy; el rodillo, solo uno.");
    }
    return nd;
  }

  /* ---------- barras ----------------------------------------------------- */
  /* liberaI / liberaJ liberan el GIRO en ese extremo.  Las dos a la vez dan
     una barra de armadura, y es así como el solucionador de pórtico produce
     una armadura (fila E.armadura). */
  function barra(m, d) {
    if (d.id === undefined || d.id === null || d.id === "") {
      throw new Error("modelo: cada barra necesita un id");
    }
    for (const b of m.barras) {
      if (b.id === d.id) throw new Error("modelo: la barra «" + d.id + "» ya existe");
    }
    const ni = buscaNudo(m, d.i), nj = buscaNudo(m, d.j);
    if (ni === nj) throw new Error("modelo: la barra «" + d.id + "» empieza y acaba en el mismo nudo");

    const L_cm = Math.hypot((nj.x_m - ni.x_m) * 100, (nj.y_m - ni.y_m) * 100);
    if (!(L_cm > 1e-9)) {
      throw new Error("modelo: la barra «" + d.id + "» tiene longitud nula: " +
        "los nudos «" + d.i + "» y «" + d.j + "» están en el mismo punto");
    }
    if (!(d.A_cm2 > 0)) {
      throw new Error("modelo: la barra «" + d.id + "» necesita A_cm2 > 0");
    }
    const I = (d.I_cm4 === undefined) ? 0 : d.I_cm4;
    if (!(I >= 0)) throw new Error("modelo: la barra «" + d.id + "» necesita I_cm4 ≥ 0");

    const bar = {
      id: d.id, i: d.i, j: d.j,
      A_cm2: d.A_cm2, I_cm4: I,
      E_kgcm2: (d.E_kgcm2 === undefined) ? E_ACERO : d.E_kgcm2,
      liberaI: d.liberaI === true, liberaJ: d.liberaJ === true,
      L_cm: L_cm,
      perfil: d.perfil || null
    };
    /* Una barra sin inercia solo puede ser de armadura: si no se liberan los
       giros, su rigidez a flexión es cero y el nudo queda sin ecuación. Es
       mejor decirlo aquí que dejar que el solucionador saque una singularidad. */
    if (bar.I_cm4 === 0 && !(bar.liberaI && bar.liberaJ)) {
      throw new Error(
        "modelo: la barra «" + d.id + "» tiene I_cm4 = 0 pero no libera los dos giros.\n" +
        "  Una barra sin inercia no puede transmitir flexión. Si es de armadura,\n" +
        "  declara liberaI: true y liberaJ: true; si no, dale su I_cm4.");
    }
    m.barras.push(bar);
    return bar;
  }

  function buscaBarra(m, id) {
    for (const b of m.barras) if (b.id === id) return b;
    throw new Error("modelo: la barra «" + id + "» no existe.\n" +
      "  Hay " + m.barras.length + " barras: " + m.barras.map((x) => x.id).join(" "));
  }

  /* Atajo: una armadura entera con los giros liberados, para no repetirlo. */
  function barraArmadura(m, d) {
    return barra(m, Object.assign({}, d, { liberaI: true, liberaJ: true }));
  }

  /* ---------- cargas ----------------------------------------------------- */
  function cargaNudo(m, d) {
    buscaNudo(m, d.nudo);
    const c = {
      nudo: d.nudo,
      Fx_kgf: d.Fx_kgf || 0, Fy_kgf: d.Fy_kgf || 0, Mz_kgfcm: d.Mz_kgfcm || 0,
      caso: d.caso || null
    };
    if (!isFinite(c.Fx_kgf) || !isFinite(c.Fy_kgf) || !isFinite(c.Mz_kgfcm)) {
      throw new Error("modelo: la carga en el nudo «" + d.nudo + "» tiene valores no numéricos");
    }
    m.cargasNudo.push(c);
    return c;
  }

  /* Carga uniforme PERPENDICULAR al eje de la barra, en kgf/m.  Positiva en
     el sentido +y local, que con el eje local x de i hacia j apunta a la
     izquierda del avance. */
  function cargaBarra(m, d) {
    buscaBarra(m, d.barra);
    if (!isFinite(d.w_kgfm)) {
      throw new Error("modelo: la carga de la barra «" + d.barra + "» necesita w_kgfm numérico");
    }
    const c = { barra: d.barra, w_kgfm: d.w_kgfm, caso: d.caso || null };
    m.cargasBarra.push(c);
    return c;
  }

  /* ---------- validación antes de resolver ------------------------------- */
  function valida(m) {
    const fallos = [];
    if (!m.nudos.length) fallos.push("no hay nudos");
    if (!m.barras.length) fallos.push("no hay barras");

    /* Un nudo suelto no hace singular la matriz si no tiene carga, pero casi
       siempre es un error de construcción del modelo. */
    const usados = new Set();
    for (const b of m.barras) { usados.add(b.i); usados.add(b.j); }
    for (const n of m.nudos) {
      if (!usados.has(n.id) && !(n.apoyo.ux || n.apoyo.uy || n.apoyo.rz)) {
        fallos.push("el nudo «" + n.id + "» no toca ninguna barra y no es apoyo");
      }
    }

    /* Restricciones mínimas para que no haya movimiento de sólido rígido: dos
       en x o y no alineadas, y algo que impida la rotación global. Se cuenta
       en bruto; la singularidad fina la detecta el solucionador. */
    let nx = 0, ny = 0, nr = 0;
    for (const n of m.nudos) {
      if (n.apoyo.ux) nx++;
      if (n.apoyo.uy) ny++;
      if (n.apoyo.rz) nr++;
    }
    if (nx === 0) fallos.push("nada restringe el desplazamiento horizontal: la estructura flota en x");
    if (ny === 0) fallos.push("nada restringe el desplazamiento vertical: la estructura flota en y");
    if (nx + ny + nr < 3) {
      fallos.push("solo hay " + (nx + ny + nr) + " restricciones; un cuerpo plano necesita al menos 3");
    }

    if (fallos.length) {
      throw new Error(
        "modelo: «" + m.nombre + "» no se puede resolver todavía.\n" +
        fallos.map((f) => "  · " + f).join("\n"));
    }
    return true;
  }

  function resumen(m) {
    let libres = 0;
    for (const n of m.nudos) for (const g of GDL) if (!n.apoyo[g]) libres++;
    const armadura = m.barras.length > 0 && m.barras.every((b) => b.liberaI && b.liberaJ);
    return {
      nombre: m.nombre, nivel: m.nivel,
      nudos: m.nudos.length, barras: m.barras.length,
      gdlLibres: libres,
      cargasNudo: m.cargasNudo.length, cargasBarra: m.cargasBarra.length,
      esArmadura: armadura,
      barrasLiberadas: m.barras.filter((b) => b.liberaI || b.liberaJ).length
    };
  }

  return {
    ART, GDL, NIVELES, E_ACERO,
    nuevo, nudo, apoyo, barra, barraArmadura,
    buscaNudo, buscaBarra, cargaNudo, cargaBarra, valida, resumen
  };
});
