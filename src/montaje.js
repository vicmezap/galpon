/* =====================================================================
   montaje.js — el galpón entero, en tres planos

   Todo lo escrito hasta E5 vive en un plano: el pórtico transversal.  Un
   galpón no cabe ahí.  Aquí aparece la tercera coordenada y con ella la
   dirección que nadie mira · fila MT.ejes:

       x  transversal, la luz        y  vertical        z  longitudinal, el largo

   EL MODELO ES 3D, EL ANÁLISIS SIGUE SIENDO PLANO · fila MT.plano.solver.
   solver.js es de pórtico plano y se queda así.  El montaje existe para la
   geometría, el metrado, el dibujo y —sobre todo— para sacar de él los
   submodelos planos que sí se resuelven.  Es como se diseña un galpón a
   mano.  Lo que no vale es montar el 3D y dar por hecho que alguien lo
   analizó.

   ─────────────────────────────────────────────────────────────────────
   LO QUE JUSTIFICA EL MÓDULO: LA DIRECCIÓN LONGITUDINAL NO TIENE PÓRTICO.

   Transversalmente el galpón es un pórtico y se ve enseguida.  A lo largo
   no hay nada: correas y cobertura.  La E.030 Art. 6 d) pide resistencia
   «EN AMBAS DIRECCIONES PRINCIPALES» (fila MT.dos.direcciones), y la
   tentación es contestar que ya está el techo.  No está:

     E.020 Art. 18.1  «se supondrá que las cargas horizontales son
                       distribuidas (…) por los sistemas de piso y techo que
                       actúan como diafragmas horizontales»
     E.020 Art. 18.2  «CUANDO (…) la excesiva relación largo/ancho (…) o la
                       flexibilidad del sistema de techo NO PERMITAN su
                       comportamiento como diafragma rígido (…)»

   Una cobertura TR-4 sobre correas no es un diafragma rígido, y un galpón
   tiene además la relación largo/ancho que el propio 18.2 nombra.  Así que
   el 18.1 no se puede invocar y el reparto lo hace un arriostre de techo
   —una armadura horizontal de verdad— o no lo hace nadie (fila
   MT.no.diafragma).

   LA GUARDA, ENTONCES, ES EL CAMINO DE CARGA y se niega, no avisa:
   hastial → plano del techo → alero → fachada → suelo.  Si la cadena se
   corta en cualquier eslabón, monta() no devuelve un modelo.

   ─────────────────────────────────────────────────────────────────────
   Y HAY UN PRECIO QUE SE PAGA EN EL OTRO SENTIDO · fila MT.termica.  La
   E.020 Art. 15 manda considerar 30 °C en construcciones de metal y el
   AISC §L6 dice que «the effects of thermal expansion and contraction of a
   building shall be considered».  Arriostrar los dos paños extremos deja
   el camino de carga cortísimo y el galpón entero preso entre dos puntos
   fijos; arriostrar uno solo lo deja dilatar hacia los dos lados y alarga
   el recorrido de la fuerza por el alero.  Las dos decisiones son la misma
   decisión, y este módulo devuelve las dos cifras para que se vea.

   El alargamiento en milímetros NO se calcula: α a temperatura ambiente no
   está en ninguna fuente del proyecto (fila MT.alfa, pendiente).  La
   longitud que no puede dilatar sí, y se mide en metros.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./generador.js"));
  } else {
    raiz.MONTAJE = definir(raiz.INVENTARIO, raiz.GENERADOR);
  }
})(typeof self !== "undefined" ? self : this, function (INV, GEN) {
  "use strict";

  const ART = INV.declara("montaje.js", [
    "MT.ejes", "MT.dos.direcciones", "MT.continuidad", "MT.no.diafragma",
    "MT.plano.solver", "MT.hastial", "MT.mismo.pano", "MT.termica", "MT.deltaT",
    "MT.alfa"
  ]);

  /* Los tres planos en los que un galpón resiste, y el cuarto que no
     resiste nada pero amarra. */
  const PLANOS = {
    transversal: "plano (x,y) · el pórtico · resiste la transversal",
    techo: "plano (x,z) · la armadura horizontal · reparte la longitudinal",
    fachada: "plano (y,z) · el arriostre de fachada · la baja al suelo",
    longitudinal: "barras a lo largo · correas y vigas de alero · amarran y puntalean"
  };

  const TOL_M = 1e-9;

  /* ---------- el reparto de paños --------------------------------------
     El largo casi nunca es múltiplo exacto de la separación de pórticos, y
     el resto NO se reparte en silencio: o se declara que sobra, o se ajusta
     la separación a la que cabe entera. */
  function ejes(d) {
    const largo = d.largo_m, sep = d.sepPorticos_m;
    if (!(largo > 0)) throw new Error("montaje: largo_m tiene que ser > 0");
    if (!(sep > 0)) throw new Error("montaje: sepPorticos_m tiene que ser > 0");
    if (sep > largo + TOL_M) {
      throw new Error("montaje: la separación de pórticos (" + sep +
        " m) es mayor que el largo (" + largo + " m): no hay ni un paño");
    }
    const exacto = largo / sep;
    const nPanos = Math.round(exacto);
    const resto = Math.abs(largo - nPanos * sep);

    if (resto > 1e-6) {
      if (!d.ajustaSeparacion) {
        const abajo = Math.floor(exacto), arriba = Math.ceil(exacto);
        throw new Error(
          "montaje: " + largo + " m de largo no son un número entero de paños de " +
            sep + " m.\n" +
          "  Sobran " + (largo - Math.floor(exacto) * sep).toFixed(3) + " m, y repartirlos " +
            "en silencio cambia el área tributaria\n" +
          "  del pórtico extremo sin que nadie lo vea.\n" +
          "  O pasa ajustaSeparacion: true —y se usa la separación que cabe entera—,\n" +
          "  o eliges un largo que case. Con " + abajo + " paños la separación sale " +
            (largo / abajo).toFixed(3) + " m y con " + arriba + " paños " +
            (largo / arriba).toFixed(3) + " m.");
      }
    }
    const n = (resto > 1e-6) ? Math.round(exacto) : nPanos;
    const sepReal = largo / n;
    const zs = [];
    for (let k = 0; k <= n; k++) zs.push(k * sepReal);
    return {
      largo_m: largo, panos: n, porticos: n + 1,
      sepPorticos_m: sepReal,
      sepPedida_m: sep,
      ajustada: Math.abs(sepReal - sep) > 1e-9,
      z_m: zs, art: ART["MT.ejes"]
    };
  }

  /* ---------- el montaje ------------------------------------------------ */
  function monta(d) {
    const ej = ejes(d);
    const h = d.alturaColumna_m;
    if (!(h > 0)) throw new Error("montaje: alturaColumna_m tiene que ser > 0");

    /* La armadura de cada pórtico sale del generador: una sola definición
       de la geometría del tijeral en todo el proyecto. */
    const tij = d.tijeral || GEN.genera({
      cuerdas: d.cuerdas || "dos_aguas", alma: d.alma || "howe",
      luz_m: d.luz_m, paneles: d.paneles,
      peralteApoyo_m: d.peralteApoyo_m, pendiente: d.pendiente,
      pendienteInferior: d.pendienteInferior
    });

    const arr = (d.panosArriostradosTecho || []).slice().sort((a, b) => a - b);
    const arrF = (d.panosArriostradosFachada || arr).slice().sort((a, b) => a - b);
    for (const p of arr.concat(arrF)) {
      if (!(p >= 0 && p < ej.panos) || p !== Math.round(p)) {
        throw new Error("montaje: el paño arriostrado «" + p +
          "» no existe; hay " + ej.panos + " paños, de 0 a " + (ej.panos - 1));
      }
    }

    const nudos = [];
    const barras = [];
    const apoyos = [];
    const vistos = new Set();

    const pon = (id, x, y, z, clase, eje) => {
      if (vistos.has(id)) return id;
      vistos.add(id);
      nudos.push({ id: id, x_m: x, y_m: y, z_m: z, clase: clase, eje: eje });
      return id;
    };
    const une = (id, i, j, clase, plano, extra) => {
      const b = { id: id, i: i, j: j, clase: clase, plano: plano };
      if (extra) for (const k of Object.keys(extra)) b[k] = extra[k];
      barras.push(b);
      return b;
    };

    /* --- los pórticos, uno por eje --- */
    const idN = (base, k) => base + "@" + k;
    for (let k = 0; k < ej.porticos; k++) {
      const z = ej.z_m[k];
      /* bases y columnas */
      pon(idN("B0", k), 0, 0, z, "base", k);
      pon(idN("B1", k), d.luz_m, 0, z, "base", k);
      apoyos.push({ nudo: idN("B0", k), ux: true, uy: true, uz: true });
      apoyos.push({ nudo: idN("B1", k), ux: true, uy: true, uz: true });
      /* los nudos del tijeral, subidos a la altura de columna */
      for (const n of tij.nudos) {
        pon(idN(n.id, k), n.x_m, h + n.y_m, z, n.clase, k);
      }
      une("C0@" + k, idN("B0", k), idN("I0", k), "columna", "transversal", { eje: k });
      une("C1@" + k, idN("B1", k), idN("I" + (2 * tij.paneles), k), "columna",
        "transversal", { eje: k });
      for (const b of tij.barras) {
        une(b.id + "@" + k, idN(b.i, k), idN(b.j, k), b.clase, "transversal", { eje: k });
      }
    }

    /* --- las correas: sobre cada nudo de brida superior, de eje a eje --- */
    const nudosSup = tij.nudos.filter((n) => n.clase === "superior")
      .slice().sort((a, b) => a.x_m - b.x_m);
    for (let k = 0; k < ej.panos; k++) {
      for (const n of nudosSup) {
        une("CO_" + n.id + "_" + k, idN(n.id, k), idN(n.id, k + 1),
          "correa", "longitudinal", { pano: k });
      }
    }

    /* --- las vigas de alero · fila MT.mismo.pano ---
       Van en los dos aleros, paño a paño.  Son las que tienen que llevar la
       reacción del arriostre de techo hasta el de fachada cuando no están
       en el mismo paño, y entonces trabajan a AXIAL. */
    const aleroIzq = "I0", aleroDer = "I" + (2 * tij.paneles);
    for (let k = 0; k < ej.panos; k++) {
      une("VA0_" + k, idN(aleroIzq, k), idN(aleroIzq, k + 1),
        "viga de alero", "longitudinal", { pano: k, alero: "izq" });
      une("VA1_" + k, idN(aleroDer, k), idN(aleroDer, k + 1),
        "viga de alero", "longitudinal", { pano: k, alero: "der" });
    }

    /* --- arriostre de techo: UNA CELOSÍA EN EL PAÑO, no una cruz ---
       Empecé poniendo una sola cruz de esquina a esquina, que es como se
       dibuja de carrerilla, y la comprobación de rango de planoTecho() dijo
       MECANISMO con todos los paños arriostrados.  Tenía razón: una cruz de
       esquina a esquina solo ata las dos líneas de alero.  Una línea de
       correa intermedia puede trasladarse entera a lo largo de z, porque las
       correas van en z —no se oponen a que se muevan todas juntas— y las
       bridas van en x.  Lo que ata cada línea de correa es una diagonal que
       llegue hasta ella, así que el arriostre de techo es una celosía con un
       nudo en cada correa, que además es como se detalla de verdad: las
       vigas de alero de bridas, las correas de montantes y las diagonales
       de alma.  Con un solo paño así, el resto de líneas de correa quedan
       sujetas por la propia cadena de correas hasta el paño arriostrado. */
    const sIzq = nudosSup[0].id, sDer = nudosSup[nudosSup.length - 1].id;
    for (const k of arr) {
      for (let q = 0; q + 1 < nudosSup.length; q++) {
        const a1 = nudosSup[q].id, a2 = nudosSup[q + 1].id;
        /* alternadas: Warren en planta */
        const sube = (q % 2 === 0);
        une("AT" + q + "_" + k,
          idN(sube ? a1 : a2, k), idN(sube ? a2 : a1, k + 1),
          "arriostre de techo", "techo", { pano: k, soloTraccion: false });
      }
    }

    /* --- arriostre de fachada: cruz en el plano de la pared --- */
    for (const k of arrF) {
      une("AF0a_" + k, idN("B0", k), idN(aleroIzq, k + 1), "arriostre de fachada",
        "fachada", { pano: k, alero: "izq", soloTraccion: true });
      une("AF0b_" + k, idN("B0", k + 1), idN(aleroIzq, k), "arriostre de fachada",
        "fachada", { pano: k, alero: "izq", soloTraccion: true });
      une("AF1a_" + k, idN("B1", k), idN(aleroDer, k + 1), "arriostre de fachada",
        "fachada", { pano: k, alero: "der", soloTraccion: true });
      une("AF1b_" + k, idN("B1", k + 1), idN(aleroDer, k), "arriostre de fachada",
        "fachada", { pano: k, alero: "der", soloTraccion: true });
    }

    /* --- columnas hastiales · fila MT.hastial ---
       En los dos pórticos extremos, columnas intermedias que suben desde el
       suelo hasta la brida INFERIOR del tijeral extremo.  Arriba no tienen
       dónde apoyar salvo el plano del techo: ahí es por donde el viento
       frontal entra al sistema. */
    const hast = d.columnasHastiales || [];
    const extremos = [0, ej.porticos - 1];
    for (const k of extremos) {
      const z = ej.z_m[k];
      for (let q = 0; q < hast.length; q++) {
        const x = hast[q];
        if (!(x > 0 && x < d.luz_m)) {
          throw new Error("montaje: la columna hastial en x = " + x +
            " m cae fuera de la luz (0 a " + d.luz_m + " m)");
        }
        /* tiene que rematar en un nudo del tijeral, o no descarga en nada */
        const destino = tij.nudos.find((n) => n.clase === "inferior" &&
          Math.abs(n.x_m - x) < 0.01);
        if (!destino) {
          throw new Error(
            "montaje: la columna hastial en x = " + x + " m no remata en un nudo de la\n" +
            "  brida inferior del tijeral extremo.  Rematando entre nudos, su reacción\n" +
            "  de arriba mete flexión en la brida inferior y nadie la verifica.\n" +
            "  Nudos inferiores disponibles en x = " +
            tij.nudos.filter((n) => n.clase === "inferior")
              .map((n) => n.x_m.toFixed(2)).join(", ") + " m.");
        }
        const bid = "BH" + q + "@" + k;
        pon(bid, x, 0, z, "base", k);
        apoyos.push({ nudo: bid, ux: true, uy: true, uz: true });
        une("CH" + q + "@" + k, bid, idN(destino.id, k), "columna hastial",
          "transversal", { eje: k, hastial: true });
      }
    }

    const m3 = {
      ejes: ej,
      luz_m: d.luz_m, alturaColumna_m: h,
      tijeral: tij,
      nudos: nudos, barras: barras, apoyos: apoyos,
      panosArriostradosTecho: arr,
      panosArriostradosFachada: arrF,
      columnasHastiales: hast,
      art: ART["MT.ejes"],
      artPlano: ART["MT.plano.solver"]
    };
    m3.conteo = conteo(m3);
    /* LA GUARDA · no devuelve un galpón con el camino cortado */
    m3.camino = caminoDeCarga(m3);
    m3.dilatacion = dilatacion(m3);
    return m3;
  }

  /* ---------- conteos --------------------------------------------------- */
  function conteo(m3) {
    const porClase = {}, porPlano = {};
    for (const b of m3.barras) {
      porClase[b.clase] = (porClase[b.clase] || 0) + 1;
      porPlano[b.plano] = (porPlano[b.plano] || 0) + 1;
    }
    return { nudos: m3.nudos.length, barras: m3.barras.length,
      porClase: porClase, porPlano: porPlano };
  }

  function metrado(m3) {
    const pos = {};
    for (const n of m3.nudos) pos[n.id] = n;
    const porClase = {};
    let total = 0;
    for (const b of m3.barras) {
      const a = pos[b.i], c = pos[b.j];
      const L = Math.sqrt(Math.pow(c.x_m - a.x_m, 2) + Math.pow(c.y_m - a.y_m, 2) +
        Math.pow(c.z_m - a.z_m, 2));
      porClase[b.clase] = (porClase[b.clase] || 0) + L;
      total += L;
    }
    return { total_m: total, porClase_m: porClase };
  }

  /* ---------- LA GUARDA · EL CAMINO DE CARGA ----------------------------
     hastial → plano del techo → alero → fachada → suelo.  Cada eslabón se
     comprueba y el primero que falte para el montaje.  Filas
     MT.dos.direcciones, MT.no.diafragma, MT.continuidad y MT.mismo.pano. */
  function caminoDeCarga(m3) {
    const arr = m3.panosArriostradosTecho;
    const arrF = m3.panosArriostradosFachada;
    const nPanos = m3.ejes.panos;

    /* Eslabón 1 · el plano del techo tiene que arriostrarse, porque la
       cobertura no es diafragma. */
    if (!arr.length) {
      throw new Error(
        "montaje: NO HAY ARRIOSTRE DE TECHO y el galpón no resiste en la dirección\n" +
        "  longitudinal.  " + ART["MT.dos.direcciones"] + " pide resistencia «en ambas\n" +
        "  direcciones principales», y transversalmente está el pórtico pero a lo largo\n" +
        "  no hay nada más que correas.\n" +
        "  No vale decir que reparte el techo: " + ART["MT.no.diafragma"] + " permite\n" +
        "  suponer diafragma SOLO si el sistema de techo es rígido, y una cobertura\n" +
        "  metálica sobre correas, en una nave con esta relación largo/ancho, no lo es.\n" +
        "  Hay que arriostrar al menos un paño en el plano del techo:\n" +
        "  panosArriostradosTecho: [ … ], entre 0 y " + (nPanos - 1) + ".");
    }

    /* Eslabón 2 · lo que el techo recoge tiene que poder bajar. */
    if (!arrF.length) {
      throw new Error(
        "montaje: hay arriostre de TECHO pero no de FACHADA.  El plano del techo\n" +
        "  recoge la fuerza longitudinal y no tiene dónde entregarla: la cadena se\n" +
        "  corta en el alero.  " + ART["MT.continuidad"] + " · continuidad estructural.\n" +
        "  Un arriostre de techo que no descarga en uno de fachada no es medio camino:\n" +
        "  es ninguno, porque la fuerza no se queda a mitad de bajada.");
    }

    /* Eslabón 3 · ¿están en el mismo paño? · fila MT.mismo.pano */
    const sep = m3.ejes.sepPorticos_m;
    const recorridos = [];
    for (const k of arr) {
      let mejor = null;
      for (const q of arrF) {
        const d = Math.abs(q - k);
        if (mejor === null || d < mejor) mejor = d;
      }
      recorridos.push({ panoTecho: k, panosHastaFachada: mejor,
        recorrido_m: mejor * sep });
    }
    const maxRecorrido = recorridos.reduce((a, r) => Math.max(a, r.recorrido_m), 0);

    /* Eslabón 4 · desde cada hastial, cuánto recorre la fuerza por el alero
       hasta el primer paño arriostrado de techo. */
    const distHastial = [];
    for (const extremo of [{ nombre: "hastial z = 0", pano: 0 },
      { nombre: "hastial z = " + m3.ejes.largo_m, pano: nPanos - 1 }]) {
      let mejor = null;
      for (const k of arr) {
        const d = Math.abs(k - extremo.pano);
        if (mejor === null || d < mejor) mejor = d;
      }
      distHastial.push({ desde: extremo.nombre, panos: mejor, recorrido_m: mejor * sep });
    }

    return {
      cierra: true,
      panosTecho: arr, panosFachada: arrF,
      alineados: maxRecorrido <= TOL_M,
      recorridos: recorridos,
      recorridoMaximoAlero_m: maxRecorrido,
      desdeHastiales: distHastial,
      art: ART["MT.continuidad"],
      artDirecciones: ART["MT.dos.direcciones"],
      artDiafragma: ART["MT.no.diafragma"],
      artAlero: ART["MT.mismo.pano"],
      nota: maxRecorrido <= TOL_M
        ? "techo y fachada en el mismo paño: la reacción del arriostre de techo baja " +
          "donde cae y la viga de alero solo amarra"
        : "techo y fachada en paños distintos: la reacción del arriostre de techo " +
          "recorre " + maxRecorrido.toFixed(2) + " m de alero antes de poder bajar, y " +
          "quien la lleva es la VIGA DE ALERO trabajando a axial, no a flexión. " +
          "Hay que diseñarla como puntal."
    };
  }

  /* ---------- EL PRECIO EN EL OTRO SENTIDO · fila MT.termica -------------
     Entre dos paños arriostrados el galpón no puede dilatar: son dos puntos
     fijos.  Esa longitud se mide en metros y no necesita α.  El
     alargamiento en milímetros SÍ lo necesita, y α no está (fila MT.alfa),
     así que no se calcula ni se estima. */
  function dilatacion(m3) {
    const arrF = m3.panosArriostradosFachada;
    const sep = m3.ejes.sepPorticos_m;
    /* centro de cada paño arriostrado: es el punto que queda fijo */
    const fijos = arrF.map((k) => (k + 0.5) * sep).sort((a, b) => a - b);

    let presa = 0, tramo = null;
    for (let i = 0; i + 1 < fijos.length; i++) {
      const d = fijos[i + 1] - fijos[i];
      if (d > presa) { presa = d; tramo = [fijos[i], fijos[i + 1]]; }
    }
    const libreIzq = fijos[0];
    const libreDer = m3.ejes.largo_m - fijos[fijos.length - 1];

    return {
      puntosFijos_m: fijos,
      longitudPresa_m: presa,
      tramoPreso_m: tramo,
      libreExtremoInicial_m: libreIzq,
      libreExtremoFinal_m: libreDer,
      deltaT_C: INV.num("MT.deltaT"),
      alargamiento_mm: null,          /* no se calcula: falta α */
      art: ART["MT.termica"],
      artDeltaT: ART["MT.deltaT"],
      artAlfa: ART["MT.alfa"],
      nota: fijos.length > 1
        ? "con " + fijos.length + " paños arriostrados de fachada hay " + fijos.length +
          " puntos fijos y " + presa.toFixed(2) + " m que no pueden dilatar entre los " +
          "dos más separados. La E.020 Art. 15 manda considerar 30 °C en metal y el " +
          "AISC §L6 lo exige también; el alargamiento en mm NO se calcula porque α a " +
          "temperatura ambiente no está en ninguna fuente del proyecto (fila MT.alfa)."
        : "un solo paño arriostrado: un único punto fijo, y el galpón dilata libremente " +
          "hacia los dos lados (" + libreIzq.toFixed(2) + " m y " + libreDer.toFixed(2) +
          " m). Es lo que cuesta el recorrido por el alero."
    };
  }

  /* ---------- EXTRAER UN PLANO PARA EL SOLUCIONADOR · fila MT.plano.solver
     Devuelve los nudos y barras de un plano con coordenadas 2D, listos para
     modelo.js.  No resuelve nada: eso es de quien llame. */
  function planoTransversal(m3, eje) {
    if (!(eje >= 0 && eje < m3.ejes.porticos)) {
      throw new Error("montaje: el eje " + eje + " no existe; hay " +
        m3.ejes.porticos + " pórticos, de 0 a " + (m3.ejes.porticos - 1));
    }
    const nudos = m3.nudos.filter((n) => n.eje === eje)
      .map((n) => ({ id: n.id, x_m: n.x_m, y_m: n.y_m, clase: n.clase }));
    const dentro = new Set(nudos.map((n) => n.id));
    const barras = m3.barras.filter((b) =>
      b.plano === "transversal" && dentro.has(b.i) && dentro.has(b.j));
    const apoyos = m3.apoyos.filter((a) => dentro.has(a.nudo))
      .map((a) => ({ nudo: a.nudo, ux: true, uy: true }));
    return {
      plano: "transversal", eje: eje, z_m: m3.ejes.z_m[eje],
      nudos: nudos, barras: barras, apoyos: apoyos,
      art: ART["MT.plano.solver"],
      nota: "el eje " + eje + " en 2D. La coordenada z se pierde a propósito: " +
        "solver.js es de pórtico plano"
    };
  }

  /* EL PLANO DEL TECHO, Y LA PRUEBA NUMÉRICA DE QUE NO ES UN DIAFRAGMA.

     La E.020 Art. 18.2 dice que no se puede suponer diafragma rígido cuando
     el sistema de techo es flexible.  Aquí eso deja de ser una frase: se
     monta el plano en planta —(x,z) pasa a ser (x,y)— y se le pasa el conteo
     de Maxwell de generador.js, sujetándolo donde lo sujetan de verdad.  Lo
     que sale es el GRADO DE MECANISMO del techo sin arriostrar, o sea
     exactamente cuántos movimientos tiene que impedir el arriostre.

     Y por eso ESTO NO ES UN MODELO LISTO PARA EL SOLUCIONADOR: sale negativo
     a propósito.  El modelo de cálculo del arriostre de techo es la armadura
     horizontal que salva la distancia entre paños arriostrados, con las
     vigas de alero de bridas; armarla es el paso siguiente y no este. */
  function planoTecho(m3) {
    const sup = new Set(m3.nudos.filter((n) => n.clase === "superior").map((n) => n.id));
    const nudos = m3.nudos.filter((n) => sup.has(n.id))
      .map((n) => ({ id: n.id, x_m: n.x_m, y_m: n.z_m, clase: n.clase, eje: n.eje }));
    const barras = m3.barras.filter((b) => sup.has(b.i) && sup.has(b.j) &&
      (b.plano === "techo" || b.clase === "correa" ||
        (b.plano === "transversal" && b.clase === "brida superior")));

    /* LAS CONDICIONES DE APOYO DE ESTE PLANO, Y NO SON OBVIAS.

       En planta, x sigue siendo x y z pasa a ser y.  Las dos direcciones no
       las sujeta lo mismo:

       · en x —transversal— sujeta EL PÓRTICO, que está fuera de este plano.
         Cada tijeral es rígido en su propio plano y la columna lo baja al
         suelo: por eso un galpón no necesita diafragma para el viento
         transversal, cada pórtico se come su área tributaria.  Aquí eso
         entra como apoyo en x en los dos aleros de CADA pórtico.
       · en z —longitudinal— no sujeta nadie salvo el arriostre de fachada,
         y solo en los paños donde lo haya.  Esa es toda la cuestión.

       Lo descubrí porque el rango decía MECANISMO incluso con todos los
       paños arriostrados: faltaba la sujeción en x, no sobraba estructura.
       El plano del techo NO es un sistema autónomo, y escribirlo así es
       media explicación de por qué el análisis va por planos. */
    const tij = m3.tijeral;
    const sIzq = "S0", sDer = "S" + (2 * tij.paneles);
    const apoyos = [];
    const puestos = {};
    const sujeta = (id, g) => {
      if (!puestos[id]) { puestos[id] = { nudo: id }; apoyos.push(puestos[id]); }
      puestos[id][g] = true;
    };
    for (let e = 0; e < m3.ejes.porticos; e++) {
      sujeta(sIzq + "@" + e, "ux");       /* lo sujeta el pórtico */
      sujeta(sDer + "@" + e, "ux");
    }
    for (const k of m3.panosArriostradosFachada) {
      for (const e of [k, k + 1]) {
        sujeta(sIzq + "@" + e, "uy");     /* «uy» aquí es z: lo sujeta la fachada */
        sujeta(sDer + "@" + e, "uy");
      }
    }

    const plano = { nudos: nudos, barras: barras, apoyos: apoyos,
      nombre: "plano del techo" };
    const cuenta = GEN.maxwell(plano);
    plano.conteo = cuenta;

    /* Y AQUÍ EL CONTEO VUELVE A EQUIVOCARSE, ESTA VEZ SOLO.  Con tres paños
       arriostrados de diez, b+r−2j sale POSITIVO —«hiperestática»— y el
       plano sigue siendo un mecanismo: los pórticos que no tocan ningún paño
       arriostrado deslizan en x, porque las correas son rígidas en z y las
       bridas en x, y nadie sujeta el deslizamiento relativo.  Las cruces
       sobran donde están y faltan donde no están, y la suma no distingue.
       El contraejemplo de generador.js no era de laboratorio: es la planta
       de un galpón normal.  Así que aquí manda el rango, igual que allí. */
    let esMecanismo = false, motivoRango = "";
    try {
      GEN.compruebaRango(plano);
    } catch (e) {
      esMecanismo = true;
      motivoRango = e.message.split("\n")[0];
    }
    const enganaElConteo = esMecanismo && cuenta.grado >= 0;

    return {
      plano: "techo",
      nudos: nudos, barras: barras, apoyos: apoyos,
      maxwell: cuenta,
      esDiafragma: false,
      apoyosNota: "en x sujeta EL PÓRTICO, que está fuera de este plano: cada tijeral " +
        "es rígido en su propio plano y la columna lo baja al suelo, y por eso un " +
        "galpón no necesita diafragma para el viento TRANSVERSAL. En z no sujeta " +
        "nadie salvo el arriostre de fachada, y solo donde lo haya: esa es toda la " +
        "cuestión.",
      esMecanismo: esMecanismo,
      conteoEngana: enganaElConteo,
      motivoRango: motivoRango,
      listoParaSolver: false,
      art: ART["MT.no.diafragma"],
      artRango: GEN.ART["G.rango"],
      nota: "el plano del techo, en planta, con " + m3.panosArriostradosTecho.length +
        " paño(s) arriostrado(s) de " + m3.ejes.panos + ". El conteo da grado " +
        cuenta.grado + " y EL RANGO DICE " + (esMecanismo ? "MECANISMO" : "estable") +
        (enganaElConteo
          ? " — o sea que el conteo engaña: sale «" + cuenta.veredicto + "» y los " +
            "pórticos que no tocan paño arriostrado deslizan igual. Las cruces sobran " +
            "donde están y faltan donde no están, y b+r−2j no distingue."
          : ".") +
        " Que el plano del techo sin arriostrar sea un mecanismo es la E.020 Art. 18.2 " +
        "en números: una cobertura sobre correas no reparte nada. NO es un modelo " +
        "listo para solver.js: el modelo de cálculo del arriostre es la armadura " +
        "horizontal entre paños arriostrados, con las vigas de alero de bridas, y " +
        "armarla es el paso siguiente."
    };
  }

  return {
    ART, PLANOS, TOL_M,
    ejes, monta, conteo, metrado, caminoDeCarga, dilatacion,
    planoTransversal, planoTecho
  };
});
