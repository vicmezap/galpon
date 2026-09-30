/* =====================================================================
   generador.js — el tijeral paramétrico

   Hasta aquí el complemento sabía montar UNA armadura: la que está escrita a
   mano dentro de tijeral.js —dos aguas, montante en cada nudo, diagonales
   hacia la cumbre—.  Con eso se resuelve un galpón.  Con esto se resuelve
   cualquiera.

   DOS PARÁMETROS ORTOGONALES, no un catálogo de tipologías:

       cuerdas    dos_aguas · un_agua · paralelos · tijera
       alma       howe · pratt · warren · warren_montantes

   Son dieciséis combinaciones y salen de sesenta líneas, porque la forma de
   las cuerdas y la forma del alma no se estorban: una dice dónde están los
   nudos en vertical y la otra dice cómo se unen.  Un catálogo de dieciséis
   funciones escritas a mano tendría dieciséis sitios donde equivocarse.

   LOS NOMBRES NO SE INVENTAN · fila G.alma.  La taxonomía es la de Neufert
   p. 87: diagonales bajando con montantes (Pratt), subiendo con montantes
   (Howe), alternadas (Warren), alternadas con montantes.  Es una lámina de
   armaduras de MADERA y sirve igual, porque la taxonomía es geométrica.

   LA FINK NO ESTÁ, y es una ausencia decidida.  Su alma la define una figura
   —McCormac Fig. 19.4, «armadura compuesta Fink»— que en el PDF solo se lee
   esquemática: se ve el patrón de triángulos anidados pero no el reparto
   exacto de nudos, y hay varias variantes que se llaman parecido.  Ponerle a
   una geometría adivinada el nombre de una armadura con nombre propio es la
   misma falta que meter un número sin fuente, en geometría en vez de en
   aritmética.  Para el galpón peruano no es una pérdida grande: manda la
   Howe y la Warren.

   ─────────────────────────────────────────────────────────────────────
   LO QUE JUSTIFICA EL MÓDULO NO ES GENERAR: ES NEGARSE A GENERAR UN
   MECANISMO.

   Se cuenta con Maxwell —fila G.maxwell— porque es barato: grado = b+r−2j.
   Y luego NO SE LE HACE CASO, porque el conteo es necesario y no suficiente:
   una barra de más en un paño compensa una de menos en otro y la suma da
   igual mientras el paño vacío es una tijera.  Lo único que lo sabe es el
   rango de K.  Así que toda geometría que sale de aquí se ARMA, se resuelve
   con una carga de prueba y la autoriza la guarda de pivote de solver.js
   —fila G.rango—.  El conteo se devuelve para informar; la que manda es la
   matriz.  La prueba trae el contraejemplo: grado = 0 y mecanismo.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./modelo.js"),
      require("./solver.js"));
  } else {
    raiz.GENERADOR = definir(raiz.INVENTARIO, raiz.MODELO, raiz.SOLVER);
  }
})(typeof self !== "undefined" ? self : this, function (INV, M, S) {
  "use strict";

  const ART = INV.declara("generador.js", [
    "G.armadura.def", "G.maxwell", "G.rango", "G.hiperestatica",
    "G.correa.nudo", "G.correa.sep", "G.correa.inclinada", "G.peralte",
    "G.alma", "G.tipologia.signo", "E.armadura"
  ]);

  /* ---------- las cuerdas ------------------------------------------------
     Cada una da dos funciones de x: dónde va la brida superior y dónde la
     inferior.  Nada más.  El alma no necesita saber cuál se eligió. */
  const CUERDAS = {
    dos_aguas: {
      nombre: "dos aguas",
      usaPendiente: true,
      ySup: (x, d) => d.h0 + d.s * Math.min(x, d.L - x),
      yInf: () => 0
    },
    un_agua: {
      nombre: "un agua",
      usaPendiente: true,
      ySup: (x, d) => d.h0 + d.s * x,
      yInf: () => 0
    },
    paralelos: {
      nombre: "cordones paralelos",
      usaPendiente: false,
      ySup: (x, d) => d.h0,
      yInf: () => 0
    },
    tijera: {
      nombre: "tijera",
      usaPendiente: true,
      usaPendienteInferior: true,
      ySup: (x, d) => d.h0 + d.s * Math.min(x, d.L - x),
      yInf: (x, d) => d.sInf * Math.min(x, d.L - x)
    }
  };

  /* ---------- el alma ----------------------------------------------------
     `nudosInferiores(i)` y `nudosSuperiores(i)` dicen si en la estación i
     hay nudo; `diagonal(i, n)` dice de qué nudo a qué nudo va la diagonal
     del paño i.  El espejo es en el CENTRO DE LA LUZ y no en la cumbre:
     lo que invierte el sentido conveniente de la diagonal es el cortante,
     y el cortante cambia de signo en el centro aunque el techo sea de un
     agua o plano. */
  const ALMAS = {
    howe: {
      nombre: "Howe · diagonales subiendo hacia el centro, con montantes",
      neufert: "(b) Rising diagonals with vertical posts",
      todosLosNudos: true, montantes: true,
      diagonal: (i, n) => (i < n ? { i: "I" + i, j: "S" + (i + 1) }
                                 : { i: "I" + (i + 1), j: "S" + i })
    },
    pratt: {
      nombre: "Pratt · diagonales bajando hacia el centro, con montantes",
      neufert: "(a) Falling diagonals with vertical posts",
      todosLosNudos: true, montantes: true,
      diagonal: (i, n) => (i < n ? { i: "I" + (i + 1), j: "S" + i }
                                 : { i: "I" + i, j: "S" + (i + 1) })
    },
    warren_montantes: {
      nombre: "Warren con montantes · diagonales alternadas",
      neufert: "(d) Rising and falling diagonals with vertical posts",
      todosLosNudos: true, montantes: true,
      diagonal: (i) => (i % 2 === 0 ? { i: "I" + i, j: "S" + (i + 1) }
                                    : { i: "I" + (i + 1), j: "S" + i })
    },
    warren: {
      nombre: "Warren · alternadas, sin montantes",
      neufert: "(c) Rising and falling diagonals",
      todosLosNudos: false, montantes: false
      /* la Warren pura se arma aparte: sus nudos están escalonados */
    }
  };

  function tipos() {
    const out = [];
    for (const c of Object.keys(CUERDAS)) {
      for (const a of Object.keys(ALMAS)) {
        out.push({ cuerdas: c, alma: a,
          nombre: CUERDAS[c].nombre + " · " + ALMAS[a].nombre.split(" ·")[0] });
      }
    }
    return out;
  }

  /* ---------- validación de los datos ----------------------------------- */
  function valida(d) {
    const cu = CUERDAS[d.cuerdas];
    if (!cu) {
      throw new Error("generador: cuerdas «" + d.cuerdas + "» no existe.\n" +
        "  Las que hay: " + Object.keys(CUERDAS).join(" · "));
    }
    const al = ALMAS[d.alma];
    if (!al) {
      throw new Error("generador: alma «" + d.alma + "» no existe.\n" +
        "  Las que hay: " + Object.keys(ALMAS).join(" · ") + "\n" +
        "  La Fink NO está, y a propósito: su alma la define una figura que\n" +
        "  solo se lee esquemática. Ver la fila G.alma del inventario.");
    }
    if (!(d.luz_m > 0)) throw new Error("generador: luz_m tiene que ser > 0");
    if (!(d.paneles >= 1) || d.paneles !== Math.round(d.paneles)) {
      throw new Error("generador: paneles tiene que ser un entero ≥ 1, POR MEDIA LUZ.\n" +
        "  La armadura tendrá 2·paneles paños.");
    }

    /* EL PERALTE NO TIENE VALOR POR OMISIÓN · fila G.peralte.  No hay
       fuente en la biblioteca del proyecto para una relación peralte/luz
       de armadura de techo: se buscó y no está. Así que se pide. */
    if (!(d.peralteApoyo_m > 0)) {
      throw new Error(
        "generador: peralteApoyo_m es OBLIGATORIO y tiene que ser > 0.\n" +
        "  No hay valor por omisión y no es un olvido: " + ART["G.peralte"] + ".\n" +
        "  El 1/24 de McCormac p. 327 es del LARGUERO, no del tijeral; el 1/25\n" +
        "  de la AASHTO es de puentes. Mientras no haya fuente, el peralte lo\n" +
        "  pone el proyectista y el programa no lo adivina.");
    }
    if (cu.usaPendiente) {
      if (!(d.pendiente >= 0)) {
        throw new Error("generador: la cuerda «" + d.cuerdas +
          "» necesita pendiente ≥ 0 (tanto por uno)");
      }
    }
    if (cu.usaPendienteInferior) {
      if (!(d.pendienteInferior > 0)) {
        throw new Error("generador: la tijera necesita pendienteInferior > 0");
      }
      if (!(d.pendiente > d.pendienteInferior)) {
        throw new Error(
          "generador: en una tijera la brida inferior tiene que subir MENOS que la\n" +
          "  superior, o el peralte se cierra hacia el centro en vez de abrirse.\n" +
          "  Llegó pendiente = " + d.pendiente + " y pendienteInferior = " +
          d.pendienteInferior + ".");
      }
    }
    /* La Warren pura escalona los nudos: los inferiores en las estaciones
       pares y los superiores en las impares. Con 2n paños eso sale siempre,
       pero con n = 1 la armadura es un solo triángulo y conviene decirlo. */
    return { cu, al };
  }

  /* ---------- la geometría ---------------------------------------------- */
  function genera(d) {
    const { cu, al } = valida(d);
    const L = d.luz_m, n = d.paneles, paso = L / (2 * n);
    const g = {
      L: L, h0: d.peralteApoyo_m,
      s: cu.usaPendiente ? d.pendiente : 0,
      sInf: cu.usaPendienteInferior ? d.pendienteInferior : 0
    };
    const ySup = (x) => cu.ySup(x, g);
    const yInf = (x) => cu.yInf(x, g);

    const nudos = [];
    const barras = [];
    const hayInf = [], haySup = [];

    if (al.todosLosNudos) {
      for (let i = 0; i <= 2 * n; i++) { hayInf.push(true); haySup.push(true); }
    } else {
      /* Warren pura: inferiores en pares, superiores en impares. */
      for (let i = 0; i <= 2 * n; i++) {
        hayInf.push(i % 2 === 0);
        haySup.push(i % 2 === 1);
      }
    }

    for (let i = 0; i <= 2 * n; i++) {
      if (!hayInf[i]) continue;
      const x = i * paso;
      nudos.push({ id: "I" + i, x_m: x, y_m: yInf(x), clase: "inferior", panel: i });
    }
    for (let i = 0; i <= 2 * n; i++) {
      if (!haySup[i]) continue;
      const x = i * paso;
      nudos.push({ id: "S" + i, x_m: x, y_m: ySup(x), clase: "superior", panel: i });
    }

    /* Cuerdas: unen nudos consecutivos DE LOS QUE EXISTEN, que es lo que
       hace que la Warren pura salga sola sin un caso aparte. */
    const idsInf = [], idsSup = [];
    for (let i = 0; i <= 2 * n; i++) { if (hayInf[i]) idsInf.push(i); }
    for (let i = 0; i <= 2 * n; i++) { if (haySup[i]) idsSup.push(i); }

    for (let k = 0; k + 1 < idsSup.length; k++) {
      barras.push({ id: "BS" + idsSup[k], i: "S" + idsSup[k], j: "S" + idsSup[k + 1],
        clase: "brida superior", panel: idsSup[k] });
    }
    for (let k = 0; k + 1 < idsInf.length; k++) {
      barras.push({ id: "BI" + idsInf[k], i: "I" + idsInf[k], j: "I" + idsInf[k + 1],
        clase: "brida inferior", panel: idsInf[k] });
    }

    if (al.montantes) {
      for (let i = 0; i <= 2 * n; i++) {
        barras.push({ id: "V" + i, i: "I" + i, j: "S" + i, clase: "montante", panel: i });
      }
    }

    if (al.todosLosNudos) {
      for (let i = 0; i < 2 * n; i++) {
        const dg = al.diagonal(i, n);
        barras.push({ id: "D" + i, i: dg.i, j: dg.j, clase: "diagonal", panel: i });
      }
    } else {
      /* Warren pura: zigzag I0-S1-I2-S3-…-I2n */
      for (let i = 0; i < 2 * n; i++) {
        const dg = (i % 2 === 0)
          ? { i: "I" + i, j: "S" + (i + 1) }
          : { i: "S" + i, j: "I" + (i + 1) };
        barras.push({ id: "D" + i, i: dg.i, j: dg.j, clase: "diagonal", panel: i });
      }
    }

    const apoyos = [
      { nudo: "I0", ux: true, uy: true },
      { nudo: "I" + (2 * n), uy: true }
    ];

    const geo = {
      cuerdas: d.cuerdas, alma: d.alma,
      nombre: cu.nombre + " · " + al.nombre,
      neufert: al.neufert,
      luz_m: L, paneles: n, paso_m: paso,
      peralteApoyo_m: d.peralteApoyo_m,
      pendiente: g.s, pendienteInferior: g.sInf,
      /* «cumbre» solo tiene sentido a dos aguas; se conserva el nombre porque
         tijeral.js ya lo usa, y al lado van los dos que sí valen siempre. */
      peralteCumbre_m: ySup(L / 2) - yInf(L / 2),
      peralteCentro_m: ySup(L / 2) - yInf(L / 2),
      peralteMaximo_m: (function () {
        let mx = 0;
        for (let i = 0; i <= 2 * n; i++) {
          const x = i * paso;
          mx = Math.max(mx, ySup(x) - yInf(x));
        }
        return mx;
      })(),
      nudos: nudos, barras: barras, apoyos: apoyos,
      xNudosSuperiores: nudos.filter((x) => x.clase === "superior").map((x) => x.x_m),
      art: ART["E.armadura"],
      artTipologia: ART["G.alma"]
    };

    geo.conteo = maxwell(geo);
    /* LA AUTORIZACIÓN NO LA DA EL CONTEO · fila G.rango */
    geo.rango = compruebaRango(geo);
    return geo;
  }

  /* ---------- el conteo de Maxwell · fila G.maxwell ---------------------- */
  function maxwell(g) {
    const j = g.nudos.length;
    const b = g.barras.length;
    let r = 0;
    for (const a of g.apoyos) {
      if (a.ux) r++;
      if (a.uy) r++;
      if (a.rz) r++;
    }
    const grado = b + r - 2 * j;
    return {
      b: b, j: j, r: r, grado: grado,
      veredicto: grado < 0 ? "mecanismo" : (grado === 0 ? "isostática" : "hiperestática"),
      /* fila G.hiperestatica: esto decide si el bucle de E5 se acopla */
      fuerzasDependenDeSecciones: grado > 0,
      art: ART["G.maxwell"],
      artHiper: ART["G.hiperestatica"],
      nota: grado > 0
        ? "hiperestática de grado " + grado + ": las fuerzas de barra se " +
          "redistribuyen al cambiar las secciones, así que el bucle de E5 se acopla"
        : (grado === 0
          ? "isostática: las fuerzas salen del equilibrio y no cambian con la sección"
          : "faltan " + (-grado) + " barras o reacciones: NO se puede analizar")
    };
  }

  /* ---------- nudos que se ven débiles a simple vista --------------------
     No decide nada: sirve para que el mensaje del mecanismo diga DÓNDE
     mirar en vez de solo que algo falla.  Un nudo libre con menos de dos
     barras, o con todas sus barras alineadas, no puede equilibrar la
     componente perpendicular. */
  function nudosDebiles(g) {
    const rest = {};
    for (const a of g.apoyos) rest[a.nudo] = a;
    const inc = {};
    const pos = {};
    for (const n of g.nudos) { inc[n.id] = []; pos[n.id] = n; }
    for (const b of g.barras) {
      if (inc[b.i]) inc[b.i].push(b.j);
      if (inc[b.j]) inc[b.j].push(b.i);
    }
    const flojos = [];
    for (const n of g.nudos) {
      const r = rest[n.id];
      if (r && r.ux && r.uy) continue;          /* totalmente sujeto */
      const vecinos = inc[n.id];
      if (vecinos.length < 2) {
        flojos.push({ nudo: n.id, motivo: vecinos.length + " barra(s)" });
        continue;
      }
      /* ¿todas alineadas? producto vectorial contra la primera dirección */
      const p0 = pos[vecinos[0]];
      const ax = p0.x_m - n.x_m, ay = p0.y_m - n.y_m;
      let alineadas = true;
      for (let k = 1; k < vecinos.length; k++) {
        const p = pos[vecinos[k]];
        const bx = p.x_m - n.x_m, by = p.y_m - n.y_m;
        if (Math.abs(ax * by - ay * bx) > 1e-9) { alineadas = false; break; }
      }
      if (alineadas && !r) flojos.push({ nudo: n.id, motivo: "todas sus barras alineadas" });
    }
    return flojos;
  }

  /* ---------- LA VERIFICACIÓN QUE MANDA · fila G.rango -------------------
     Se arma la geometría con secciones de prueba y se resuelve con una
     carga que toca todos los nudos libres.  Si K es singular, la guarda de
     pivote de solver.js lo dice; y lo dice en casos en que el conteo de
     Maxwell no puede decirlo.  El resultado numérico se tira: lo único que
     interesa es que exista. */
  const A_PRUEBA_CM2 = 10;
  const I_PRUEBA_CM4 = 0;

  function compruebaRango(g) {
    const E = INV.num("MAT.E");
    const m = M.nuevo({ nivel: "LRFD", nombre: "sonda de rango" });
    for (const n of g.nudos) M.nudo(m, { id: n.id, x_m: n.x_m, y_m: n.y_m });
    for (const a of g.apoyos) M.apoyo(m, a);
    for (const b of g.barras) {
      M.barraArmadura(m, { id: b.id, i: b.i, j: b.j,
        A_cm2: A_PRUEBA_CM2, I_cm4: I_PRUEBA_CM4, E_kgcm2: E });
    }
    /* Una carga en CADA nudo libre y en las dos direcciones: una carga
       vertical sola puede pasar de largo por un mecanismo horizontal. */
    let k = 0;
    for (const n of g.nudos) {
      k++;
      M.cargaNudo(m, { nudo: n.id, Fx_kgf: 100 * (((k % 3)) - 1), Fy_kgf: -100 - (k % 7) });
    }

    try {
      S.resuelve(m);
    } catch (e) {
      if (/SINGULAR/.test(e.message)) {
        const flojos = nudosDebiles(g);
        throw new Error(
          "generador: la geometría «" + g.nombre + "» es un MECANISMO.\n" +
          "  El conteo de Maxwell dice «" + g.conteo.veredicto + "» (grado " +
            g.conteo.grado + ", b=" + g.conteo.b + " j=" + g.conteo.j +
            " r=" + g.conteo.r + "),\n" +
          "  y el conteo se equivoca: es necesario y no suficiente. Manda el rango.\n" +
          (flojos.length
            ? "  Nudos sospechosos: " +
              flojos.map((f) => f.nudo + " (" + f.motivo + ")").join(", ") + "\n"
            : "  Ningún nudo suelto a simple vista: el mecanismo es de conjunto,\n" +
              "  no de un nudo — típico de un paño sin diagonal con otro que tiene dos.\n") +
          "  (" + e.message.split("\n")[0] + ")");
      }
      throw e;
    }
    return {
      verificado: true,
      art: ART["G.rango"],
      nota: "K armada y resuelta con carga de prueba: el rango autoriza la geometría"
    };
  }

  /* ---------- ángulos de las diagonales ----------------------------------
     No hay norma que los limite, así que esto informa y no juzga.  Importa
     porque una diagonal tendida cuesta cara de dos maneras: necesita más
     área para el mismo cortante y su conexión se alarga. */
  function angulos(g) {
    const pos = {};
    for (const n of g.nudos) pos[n.id] = n;
    const lista = [];
    for (const b of g.barras) {
      if (b.clase !== "diagonal") continue;
      const a = pos[b.i], c = pos[b.j];
      const dx = Math.abs(c.x_m - a.x_m), dy = Math.abs(c.y_m - a.y_m);
      lista.push({
        barra: b.id,
        grados: Math.atan2(dy, dx) * 180 / Math.PI,
        longitud_m: Math.sqrt(dx * dx + dy * dy)
      });
    }
    if (!lista.length) return { diagonales: 0 };
    const gs = lista.map((x) => x.grados);
    const ls = lista.map((x) => x.longitud_m);
    return {
      diagonales: lista.length,
      minGrados: Math.min.apply(null, gs),
      maxGrados: Math.max.apply(null, gs),
      maxLongitud_m: Math.max.apply(null, ls),
      lista: lista
    };
  }

  /* ---------- CASAR LOS PAÑOS CON LAS CORREAS · fila G.correa.nudo -------
     El error que tijeral.js rechaza —correa entre nudos— se evita eligiendo
     el número de paños DESPUÉS de saber cada cuánto van las correas, no
     antes.  Esta función es esa elección, y además ofrece la otra salida
     que McCormac llama la económica en luces grandes.

     LA LUZ DEL PANEL SE MIDE SOBRE LA PENDIENTE · fila G.correa.inclinada.
     El paso del paño se define en planta; la tabla del TR-4 tabula la luz
     del panel, que descansa sobre el faldón.  El factor √(1+s²) es siempre
     mayor que uno: comparar contra el paso horizontal se pasa de largo
     SIEMPRE, nunca del lado seguro. */
  const N_MAX = 40;

  /* Práctica reportada, fila G.correa.sep. Contraste, no tope. */
  const HABITUAL_MIN_M = 0.61, HABITUAL_MAX_M = 1.83;

  /* CUÁNTAS CORREAS INTERMEDIAS SE LLEGAN A ENUMERAR, y no es un límite de
     diseño: ninguna fuente fija uno.  Es que el reparto deja de significar
     nada mucho antes de llegar lejos.  Con un paño de 20 m y 29 correas
     encima, la «brida superior» ya no es una barra de armadura con algo de
     flexión: es una viga continua de 20 m que casualmente tiene dos barras
     de alma en los extremos, y lo que hay que modelar es una viga, no una
     armadura subdividida.  Se enumeran hasta cuatro y las que pidan más se
     descartan en vez de ofrecerse. */
  const K_MAX = 4;

  function panelesParaCorreas(d) {
    const L = d.luz_m, sepMax = d.sepMaxCorrea_m;
    if (!(L > 0)) throw new Error("generador: panelesParaCorreas() necesita luz_m > 0");
    if (!(sepMax > 0)) {
      throw new Error(
        "generador: panelesParaCorreas() necesita sepMaxCorrea_m, la luz máxima\n" +
        "  admisible del panel de cobertura. Sale de la tabla del TR-4, no de aquí.");
    }
    const s = d.pendiente || 0;
    const f = Math.sqrt(1 + s * s);
    const alma = d.alma || "howe";
    if (!ALMAS[alma]) throw new Error("generador: alma «" + alma + "» no existe");
    /* La Warren pura solo tiene nudo superior en las estaciones impares, así
       que sus nudos de brida superior están a DOS pasos uno de otro, y el
       primero no cae en el alero sino medio paño adentro. */
    const factorNudo = ALMAS[alma].todosLosNudos ? 1 : 2;

    const opciones = [];
    for (let n = 1; n <= N_MAX; n++) {
      const paso = L / (2 * n);
      const sepNudos = paso * factorNudo;
      /* el mínimo número de correas por paño que cumple la tabla */
      const k = Math.max(1, Math.ceil(sepNudos * f / sepMax - 1e-9));
      if (k > K_MAX) continue;      /* el paño es tan largo que ya no es un paño */
      const sepPend = (sepNudos / k) * f;
      const nudosSup = (factorNudo === 1) ? (2 * n + 1) : n;
      const segmentos = nudosSup - 1;
      opciones.push({
        paneles: n,
        correasPorPano: k,
        paso_m: paso,
        sepNudosSuperiores_m: sepNudos,
        sepEnPendiente_m: sepPend,
        nudosSuperiores: nudosSup,
        correas: segmentos * k + 1,
        holgura: sepMax / sepPend,
        primerNudoSuperior_m: (factorNudo === 1) ? 0 : paso,
        nudoEnElAlero: factorNudo === 1,
        requiereCapituloH: k > 1,
        fueraDeLoHabitual: sepPend < HABITUAL_MIN_M || sepPend > HABITUAL_MAX_M
      });
    }

    const enNudo = opciones.filter((o) => o.correasPorPano === 1);
    const conIntermedias = opciones.filter((o) => o.correasPorPano > 1);

    if (!enNudo.length && !conIntermedias.length) {
      throw new Error(
        "generador: con luz " + L + " m y separación máxima de correa " + sepMax +
        " m no hay\n  solución ni con " + N_MAX + " paños por media luz.");
    }

    /* EL DEFECTO ES LA ARMADURA DE VERDAD: el menor número de paños que deja
       la correa EN EL NUDO. Si eso obliga a una barbaridad de paños, la
       alternativa de McCormac está ahí al lado y con sus números, para que
       la comparación se pueda hacer en vez de suponerse. */
    const recomendado = enNudo.length ? enNudo[0] : null;
    const masCorto = conIntermedias.length ? conIntermedias[0] : null;

    let nota;
    if (!recomendado) {
      nota = "ningún número de paños deja la correa en el nudo: hay que ir por " +
        "correas intermedias y verificar la brida superior por el Capítulo H";
    } else if (masCorto && recomendado.nudosSuperiores > masCorto.nudosSuperiores) {
      nota = "con " + recomendado.paneles + " paños la correa cae en el nudo y la brida " +
        "superior sigue siendo una barra axial, pero son " + recomendado.nudosSuperiores +
        " nudos de brida superior. Con " + masCorto.paneles + " paños y " +
        masCorto.correasPorPano + " correas por paño bastan " + masCorto.nudosSuperiores +
        " nudos, a cambio de verificar la brida superior por FLEXIÓN Y CARGA AXIAL " +
        "(Cap. H). McCormac llama a esa la económica en luces grandes, no al revés.";
    } else {
      nota = "con " + recomendado.paneles + " paños por media luz la correa cae en el " +
        "nudo y la brida superior sigue siendo una barra axial";
    }

    return {
      factorPendiente: f,
      alma: alma,
      opciones: opciones,
      enNudo: enNudo,
      conIntermedias: conIntermedias,
      recomendado: recomendado,
      masPocosNudos: masCorto,
      habitual_m: [HABITUAL_MIN_M, HABITUAL_MAX_M],
      art: ART["G.correa.nudo"],
      artSep: ART["G.correa.sep"],
      artInclinada: ART["G.correa.inclinada"],
      nota: nota
    };
  }

  /* ---------- LA OTRA SALIDA DE McCORMAC · fila G.correa.nudo ------------
     Parte cada paño de la brida superior en k tramos con nudos intermedios,
     para poder colgar ahí las correas.  La geometría que sale YA NO ES UNA
     ARMADURA en la brida superior, y lo dice en la marca `requiereCapituloH`:
     los tramos tienen que ir CONTINUOS —sin liberar el giro entre ellos— o
     el momento local que se quería capturar no aparece.  Un nudo intermedio
     con los giros liberados y sin barra de alma es, además, un mecanismo, y
     la comprobación de rango lo caza. */
  function subdivideBridaSuperior(g, k) {
    if (!(k >= 2) || k !== Math.round(k)) {
      throw new Error("generador: subdivideBridaSuperior() necesita k entero ≥ 2");
    }
    const pos = {};
    for (const n of g.nudos) pos[n.id] = n;

    const nudos = g.nudos.slice();
    const barras = [];
    for (const b of g.barras) {
      if (b.clase !== "brida superior") { barras.push(b); continue; }
      const a = pos[b.i], c = pos[b.j];
      let anterior = b.i;
      for (let t = 1; t <= k; t++) {
        let destino;
        if (t === k) destino = b.j;
        else {
          const u = t / k;
          destino = b.id + "m" + t;
          nudos.push({
            id: destino,
            x_m: a.x_m + (c.x_m - a.x_m) * u,
            y_m: a.y_m + (c.y_m - a.y_m) * u,
            clase: "superior", panel: b.panel, intermedio: true
          });
        }
        barras.push({
          id: b.id + "_" + t, i: anterior, j: destino,
          clase: "brida superior", panel: b.panel,
          continua: true,                 /* NO liberar el giro aquí */
          liberaI: (t === 1), liberaJ: (t === k)
        });
        anterior = destino;
      }
    }

    const out = {};
    for (const key of Object.keys(g)) out[key] = g[key];
    out.nudos = nudos;
    out.barras = barras;
    out.correasPorPano = k;
    out.requiereCapituloH = true;
    out.xNudosSuperiores = nudos.filter((x) => x.clase === "superior").map((x) => x.x_m)
      .sort((p, q) => p - q);
    out.art = ART["G.correa.nudo"];
    out.nota =
      "brida superior partida en " + k + " tramos por paño. YA NO ES UNA ARMADURA ahí: " +
      "los tramos van continuos y se verifican por FLEXIÓN Y CARGA AXIAL, Capítulo H " +
      "(«Capítulo 11» en McCormac). Es la salida que el libro llama la económica en " +
      "luces grandes, no un apaño.";
    /* El conteo pierde sentido con barras continuas: b+r=2j supone rótulas.
       Se anula a propósito en vez de devolver un número que no significa. */
    out.conteo = null;
    out.rango = null;
    return out;
  }

  return {
    ART, CUERDAS, ALMAS, N_MAX, K_MAX, A_PRUEBA_CM2,
    tipos, valida, genera, maxwell, nudosDebiles, compruebaRango,
    angulos, panelesParaCorreas, subdivideBridaSuperior
  };
});
