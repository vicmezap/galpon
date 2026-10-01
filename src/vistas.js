/* =====================================================================
   vistas.js — las cuatro pestañas, como DATOS

   Lo que se ve en pantalla deja de estar escrito dentro del HTML y pasa a
   ser una lista de líneas con su procedencia.  La plantilla se vuelve un
   pintor tonto: recibe {q, v, origen, fuente} y lo dibuja.  Y entonces se
   puede comprobar en Node, sin navegador, lo único que de verdad importa
   de una interfaz técnica:

   NINGUN NUMERO SE ENSEÑA SIN PODER DECIR DE DONDE SALE · fila
   V.procedencia.  La regla del proyecto —ningún número entra al código sin
   fila en el inventario— en pantalla se vuelve más exigente, porque en
   pantalla el número ya no es código: es una afirmación delante de alguien
   que va a firmarla.  Las procedencias son cinco y ninguna más:

       norma      sale de una fila del inventario · EXIGE su id
       entrada    lo escribió el proyectista
       geometria  aritmética sobre lo que escribió
       conteo     contar barras, nudos o paños
       medido     lo calculó el motor (el rango, una fuerza, un recorrido)

   «norma» obliga a dar el id y las otras cuatro lo PROHIBEN: colgarle una
   norma a un número que salió de contar barras es peor que no citar nada,
   porque el botón de fuente invita a creérselo.  Una línea sin procedencia,
   o con las dos cosas, hace que lineas() LANCE.

   Esto nació de un agujero medido: el panel de E6c enseñaba veintitrés
   cifras y solo doce decían de dónde venían.  Las once restantes no estaban
   mal — estaban sin avalar, que delante de un plano es lo mismo.

   LA VISTA NO VUELVE A IMPLEMENTAR EL MOTOR · fila V.no.duplica.  valida()
   mira la FORMA: vacío, no es número, fuera del rango de pantalla.  La
   física la comprueban generador.js y montaje.js, y cuando se niegan la
   vista enseña SU mensaje entero, con su artículo, sin resumirlo.  Dos
   copias de una regla es garantizar que algún día discrepen y gane la
   equivocada.

   Y LOS TOPES DE LOS CAMPOS NO SON CRITERIOS · fila V.limites.  Que la luz
   empiece en 2 m es que un cuadro de texto necesita un tope.  Van marcados
   como limiteDePantalla para que nadie los defienda nunca en una memoria.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./generador.js"),
      require("./montaje.js"));
  } else {
    raiz.VISTAS = definir(raiz.INVENTARIO, raiz.GENERADOR, raiz.MONTAJE);
  }
})(typeof self !== "undefined" ? self : this, function (INV, GEN, MON) {
  "use strict";

  const ART = INV.declara("vistas.js", [
    "V.procedencia", "V.no.duplica", "V.limites",
    "G.alma", "G.peralte", "G.maxwell", "G.rango", "G.hiperestatica",
    "MT.ejes", "MT.no.diafragma", "MT.mismo.pano", "MT.hastial",
    "MT.termica", "MT.deltaT", "MT.alfa", "MT.plano.solver"
  ]);

  /* Las cinco, y ninguna más. */
  const ORIGENES = ["norma", "entrada", "geometria", "conteo", "medido"];

  /* ---------- la línea, y su guarda ------------------------------------ */
  function ln(q, v, origen, extra) {
    const l = { q: q, v: v, origen: origen };
    if (extra) for (const k of Object.keys(extra)) l[k] = extra[k];

    if (ORIGENES.indexOf(origen) < 0) {
      throw new Error(
        "vistas: «" + q + "» declara la procedencia «" + origen + "», que no existe.\n" +
        "  Las que hay: " + ORIGENES.join(" · ") + " (fila V.procedencia).");
    }
    if (origen === "norma") {
      if (!l.fuente) {
        throw new Error(
          "vistas: «" + q + "» dice venir de NORMA y no da la fila del inventario.\n" +
          "  Una cifra que se presenta como normativa sin poder enseñar el artículo\n" +
          "  es la que acaba en una memoria de cálculo sin que nadie la pueda\n" +
          "  defender. O se da el id, o la procedencia es otra.");
      }
      if (!INV.existe(l.fuente)) {
        throw new Error(
          "vistas: «" + q + "» cita la fila «" + l.fuente + "», que NO EXISTE en el\n" +
          "  inventario. Ningún número entra al código sin fila, y ninguno sale a\n" +
          "  pantalla citando una que no está.");
      }
    } else if (l.fuente) {
      throw new Error(
        "vistas: «" + q + "» tiene procedencia «" + origen + "» y además cita la fila «" +
          l.fuente + "».\n" +
        "  Colgarle una norma a un número que salió de " + origen + " es peor que no\n" +
        "  citar nada: el botón de fuente invita a creérselo. O es «norma», o no cita.");
    }
    return l;
  }

  function ficha(titulo, sub, lineas, estado) {
    return { titulo: titulo, sub: sub, lineas: lineas, estado: estado || null };
  }

  /* ---------- LOS CAMPOS DE ENTRADA ------------------------------------
     `limiteDePantalla` lleva el nombre puesto a propósito · fila V.limites. */
  const ENTRADAS = [
    { grupo: "Nave", id: "luz", etiqueta: "Luz del pórtico", unidad: "m",
      tipo: "numero", valor: 20, paso: 0.5, limiteDePantalla: [2, 120] },
    { grupo: "Nave", id: "largo", etiqueta: "Largo total", unidad: "m",
      tipo: "numero", valor: 60, paso: 1, limiteDePantalla: [2, 400] },
    { grupo: "Nave", id: "sep", etiqueta: "Separación de pórticos", unidad: "m",
      tipo: "numero", valor: 6, paso: 0.5, limiteDePantalla: [1, 40] },
    { grupo: "Nave", id: "hcol", etiqueta: "Altura de columna", unidad: "m",
      tipo: "numero", valor: 6, paso: 0.25, limiteDePantalla: [1, 40] },
    { grupo: "Nave", id: "ajusta", etiqueta: "Ajustar la separación a la que cabe entera",
      tipo: "si/no", valor: false },

    { grupo: "Tijeral", id: "cuerdas", etiqueta: "Cuerdas", tipo: "opcion",
      valor: "dos_aguas", opciones: [
        ["dos_aguas", "Dos aguas"], ["un_agua", "Un agua"],
        ["paralelos", "Cordones paralelos"], ["tijera", "Tijera"]] },
    { grupo: "Tijeral", id: "alma", etiqueta: "Alma", tipo: "opcion",
      valor: "howe", fuente: "G.alma", opciones: [
        ["howe", "Howe · diagonales subiendo al centro"],
        ["pratt", "Pratt · diagonales bajando al centro"],
        ["warren", "Warren · sin montantes"],
        ["warren_montantes", "Warren con montantes"]] },
    { grupo: "Tijeral", id: "pend", etiqueta: "Pendiente del techo", unidad: "%",
      tipo: "numero", valor: 20, paso: 1, limiteDePantalla: [0, 100] },
    { grupo: "Tijeral", id: "pendi", etiqueta: "Pendiente inferior, tijera", unidad: "%",
      tipo: "numero", valor: 8, paso: 1, limiteDePantalla: [0, 100] },
    { grupo: "Tijeral", id: "pan", etiqueta: "Paños por media luz", tipo: "numero",
      valor: 6, paso: 1, limiteDePantalla: [1, 40] },
    { grupo: "Tijeral", id: "h0", etiqueta: "Peralte en el apoyo", unidad: "m",
      tipo: "numero", valor: 1.2, paso: 0.1, limiteDePantalla: [0.1, 10],
      fuente: "G.peralte" },

    { grupo: "Arriostres y hastiales", id: "at",
      etiqueta: "Paños arriostrados · techo", tipo: "lista", valor: "5",
      fuente: "MT.no.diafragma", ayuda: "p. ej. 0, 9" },
    { grupo: "Arriostres y hastiales", id: "af",
      etiqueta: "Paños arriostrados · fachada", tipo: "lista", valor: "5",
      ayuda: "vacío = los mismos del techo" },
    { grupo: "Arriostres y hastiales", id: "ch",
      etiqueta: "Columnas hastiales en x", unidad: "m", tipo: "lista", valor: "5, 10, 15",
      fuente: "MT.hastial", ayuda: "vacío = ninguna" }
  ];

  /* La misma regla vale para los CAMPOS: un campo que cita una fila tiene
     que citar una que exista.  Se comprueba al cargar el módulo y no en una
     prueba, porque un id mal escrito aquí es un botón de fuente que revienta
     al pulsarlo, y eso lo descubre el usuario, no el que lo escribió. */
  (function compruebaEntradas() {
    for (const e of ENTRADAS) {
      if (!e.fuente) continue;
      if (!INV.existe(e.fuente)) {
        throw new Error(
          "vistas: el campo «" + e.id + "» cita la fila «" + e.fuente +
          "», que no existe en el inventario.");
      }
    }
  })();

  function grupos() {
    const out = [], visto = {};
    for (const e of ENTRADAS) {
      if (!visto[e.grupo]) { visto[e.grupo] = { nombre: e.grupo, campos: [] }; out.push(visto[e.grupo]); }
      visto[e.grupo].campos.push(e);
    }
    return out;
  }

  /* ---------- LA FORMA, Y SOLO LA FORMA · fila V.no.duplica ------------- */
  function valida(d) {
    const malos = [];
    for (const e of ENTRADAS) {
      const v = d[e.id];
      if (e.tipo === "numero") {
        if (v === "" || v === null || v === undefined || typeof v !== "number" || isNaN(v)) {
          malos.push({ campo: e.id, etiqueta: e.etiqueta, que: "no es un número" });
          continue;
        }
        const r = e.limiteDePantalla;
        if (r && (v < r[0] || v > r[1])) {
          malos.push({ campo: e.id, etiqueta: e.etiqueta,
            que: "fuera del rango de pantalla (" + r[0] + " a " + r[1] +
              (e.unidad ? " " + e.unidad : "") + ")",
            limiteDePantalla: true });
        }
      } else if (e.tipo === "opcion") {
        if (!e.opciones.some((o) => o[0] === v)) {
          malos.push({ campo: e.id, etiqueta: e.etiqueta, que: "opción desconocida: " + v });
        }
      }
    }
    return {
      ok: malos.length === 0, malos: malos,
      art: ART["V.no.duplica"],
      nota: "esto comprueba la FORMA. Las reglas de diseño las comprueban " +
        "generador.js y montaje.js, y no se copian aquí."
    };
  }

  /* ---------- EL RECHAZO DEL MOTOR, SIN ABLANDAR ----------------------- */
  function problema(e) {
    return {
      titulo: "El motor se niega, y no es un aviso",
      mensaje: String(e && e.message ? e.message : e),
      hayModelo: false,
      art: ART["V.no.duplica"],
      porQueNoSeDibuja:
        "Mientras el motor se niegue, las vistas no dibujan nada. Enseñar el " +
        "galpón igualmente, con una advertencia al lado, sería saltarse la guarda " +
        "por la puerta de atrás."
    };
  }

  /* ---------- LAS PESTAÑAS --------------------------------------------- */
  const PESTANAS = [
    { id: "portico", nombre: "Pórtico", real: true,
      sub: "eje 0 · el hastial, con sus columnas intermedias" },
    { id: "planta", nombre: "Planta de techo", real: true,
      sub: "donde se ve el camino de carga" },
    { id: "elev", nombre: "Elevación longitudinal", real: true,
      sub: "la fachada x = 0, y lo que cuesta decidir dónde van los arriostres" },
    { id: "tresd", nombre: "3D", real: false,
      sub: "vista3d.js · todavía no",
      porque: "La vista 3D es vista3d.js, el renderizador WebGL que se adapta del " +
        "de Retícula, " +
        "y no está escrito. Aquí no hay una maqueta provisional a propósito: una " +
        "vista que parece el modelo y no lo es engaña más que una pestaña vacía. " +
        "El modelo 3D SÍ existe —lo monta montaje.js y las otras tres pestañas son " +
        "proyecciones suyas—; lo que falta es dibujarlo." }
  ];

  function pestana(id) {
    const p = PESTANAS.filter((x) => x.id === id)[0];
    if (!p) {
      throw new Error("vistas: la pestaña «" + id + "» no existe. Las que hay: " +
        PESTANAS.map((x) => x.id).join(" · "));
    }
    return p;
  }

  /* ---------- LA PROYECCION DE CADA PESTAÑA ----------------------------
     Qué nudos entran, y qué par de coordenadas se dibuja.  También es dato:
     así la rutina que pinta no decide nada. */
  function dibujo(id, m3) {
    const p = pestana(id);
    if (!p.real) return null;
    if (id === "portico") {
      const pl = MON.planoTransversal(m3, 0);
      return { nudos: pl.nudos, barras: pl.barras,
        ejeX: "x_m", ejeY: "y_m",
        leyenda: [["columna y bridas", "tinta"], ["alma", "tinta-2"],
          ["columna hastial", "tinta-2"]] };
    }
    if (id === "planta") {
      const dentro = {};
      for (const n of m3.nudos) if (n.clase === "superior") dentro[n.id] = n;
      return {
        nudos: Object.keys(dentro).map((k) => dentro[k]),
        barras: m3.barras.filter((b) => dentro[b.i] && dentro[b.j]),
        ejeX: "z_m", ejeY: "x_m",
        leyenda: [["bridas superiores y correas", "suave"],
          ["ARRIOSTRE DE TECHO", "succion"]] };
    }
    /* elevación: la fachada x = 0 */
    const dentro = {};
    for (const n of m3.nudos) if (n.x_m < 1e-9) dentro[n.id] = n;
    return {
      nudos: Object.keys(dentro).map((k) => dentro[k]),
      barras: m3.barras.filter((b) => dentro[b.i] && dentro[b.j]),
      ejeX: "z_m", ejeY: "y_m",
      leyenda: [["columnas y vigas de alero", "tinta"],
        ["ARRIOSTRE DE FACHADA", "succion"]] };
  }

  /* ---------- LAS FICHAS DE CADA PESTAÑA -------------------------------- */
  function n2(x, d) {
    return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace(".", ",");
  }

  function fichas(id, m3) {
    const p = pestana(id);
    if (!p.real) return [];
    if (id === "portico") return fichasPortico(m3);
    if (id === "planta") return fichasPlanta(m3);
    return fichasElevacion(m3);
  }

  function fichasPortico(m3) {
    const t = m3.tijeral, c = t.conteo;
    const L = [
      ln("Tipología", t.nombre, "norma", { fuente: "G.alma" }),
      ln("Luz · altura de columna",
        n2(m3.luz_m, 2) + " · " + n2(m3.alturaColumna_m, 2) + " m", "entrada"),
      ln("Paños por media luz", String(t.paneles), "entrada"),
      ln("Paso del paño", n2(t.paso_m, 3) + " m", "geometria"),
      ln("Peralte en el apoyo", n2(t.peralteApoyo_m, 2) + " m", "entrada",
        { nota: "No hay fuente para una relación peralte/luz de armadura de techo: " +
          "se buscó y no está, así que el peralte es dato y el programa no lo inventa." }),
      ln("Peralte en el centro", n2(t.peralteCentro_m, 2) + " m", "geometria"),
      ln("Peralte máximo", n2(t.peralteMaximo_m, 2) + " m", "geometria"),
      ln("Barras · nudos · reacciones",
        c.b + " · " + c.j + " · " + c.r, "conteo"),
      ln("Conteo de Maxwell · b + r − 2j",
        c.b + " + " + c.r + " − 2·" + c.j + " = " + c.grado, "norma",
        { fuente: "G.maxwell" }),
      ln("Veredicto del conteo", c.veredicto, "norma",
        { fuente: "G.hiperestatica", nota: c.nota }),
      ln("Autorizado por el RANGO", "sí", "medido",
        { estado: "ok",
          nota: "El conteo informa; quien autoriza es el rango de K. Es necesario " +
            "y no suficiente, y la prueba trae el contraejemplo." })
    ];
    const a = GEN.angulos(t);
    if (a.diagonales) {
      L.push(ln("Diagonales", String(a.diagonales), "conteo"));
      L.push(ln("Ángulo mínimo y máximo",
        n2(a.minGrados, 1) + "° a " + n2(a.maxGrados, 1) + "°", "geometria"));
      L.push(ln("Diagonal más larga", n2(a.maxLongitud_m, 2) + " m", "geometria"));
    }
    const met = MON.metrado(m3);
    L.push(ln("Acero de todo el galpón", n2(met.total_m, 1) + " m de barra", "medido"));

    return [ficha("El pórtico", pestana("portico").sub, L)];
  }

  function fichasPlanta(m3) {
    const cam = m3.camino;
    const A = [
      ln("Paños arriostrados · techo", "[" + cam.panosTecho.join(", ") + "]", "norma",
        { fuente: "MT.no.diafragma",
          nota: "La cobertura no es diafragma rígido (E.020 Art. 18.2): el reparto " +
            "lo hace esto, o no lo hace nadie." }),
      ln("Paños arriostrados · fachada", "[" + cam.panosFachada.join(", ") + "]", "entrada"),
      ln("¿En el mismo paño?", cam.alineados ? "sí" : "no", "norma",
        { fuente: "MT.mismo.pano", estado: cam.alineados ? "ok" : "no" }),
      ln("Recorrido por el alero", n2(cam.recorridoMaximoAlero_m, 2) + " m", "medido",
        { estado: cam.recorridoMaximoAlero_m > 0 ? "no" : "ok", nota: cam.nota })
    ];
    for (const d of cam.desdeHastiales) {
      A.push(ln("Desde el " + d.desde, n2(d.recorrido_m, 2) + " m", "medido"));
    }

    const techo = MON.planoTecho(m3);
    const k = techo.maxwell;
    const B = [
      ln("Nudos del plano del techo", String(k.j), "conteo"),
      ln("Conteo del plano", "grado " + k.grado + " · " + k.veredicto, "norma",
        { fuente: "G.maxwell" }),
      ln("Y el rango dice", techo.esMecanismo ? "MECANISMO" : "estable", "medido",
        { estado: techo.esMecanismo ? "no" : "ok", nota: techo.apoyosNota }),
      ln("¿Es diafragma?", "no", "norma",
        { fuente: "MT.no.diafragma", estado: "no",
          nota: "Sin el arriostre, este mismo plano da grado POSITIVO en el conteo y " +
            "MECANISMO en el rango. Son doce barras las que separan una cosa de la otra." }),
      ln("Cómo se analiza", "por planos, no en 3D", "norma", { fuente: "MT.plano.solver" })
    ];
    return [
      ficha("El camino de carga", "hastial → techo → alero → fachada → suelo", A,
        cam.alineados ? "bien" : null),
      ficha("El plano del techo", "la E.020 Art. 18.2 en números", B)
    ];
  }

  function fichasElevacion(m3) {
    const di = m3.dilatacion, ej = m3.ejes;
    const L = [
      ln("Pórticos", String(ej.porticos), "conteo"),
      ln("Separación real", n2(ej.sepPorticos_m, 3) + " m",
        ej.ajustada ? "geometria" : "entrada",
        ej.ajustada ? { nota: "ajustada: se pidió " + n2(ej.sepPedida_m, 2) +
          " m y no cabía entera en el largo" } : null),
      ln("Convenio de ejes", "x transversal · y vertical · z longitudinal", "norma",
        { fuente: "MT.ejes" }),
      ln("Puntos fijos",
        "[" + di.puntosFijos_m.map((x) => n2(x, 1)).join(", ") + "] m", "geometria"),
      ln("Longitud que NO puede dilatar", n2(di.longitudPresa_m, 2) + " m", "medido",
        { estado: di.longitudPresa_m > 0 ? "no" : "ok", nota: di.nota }),
      ln("Dilata libre hacia cada extremo",
        n2(di.libreExtremoInicial_m, 2) + " y " + n2(di.libreExtremoFinal_m, 2) + " m",
        "geometria"),
      ln("Hay que considerar la dilatación", "sí", "norma", { fuente: "MT.termica" }),
      ln("ΔT de norma para metal", di.deltaT_C + " °C", "norma", { fuente: "MT.deltaT" }),
      ln("Alargamiento", "no se calcula", "norma",
        { fuente: "MT.alfa",
          nota: "α a temperatura ambiente no está en ninguna fuente del proyecto. El " +
            "AISC sí da uno, pero es el de incendio y su propio texto lo condiciona " +
            "a más de 66 °C." })
    ];
    return [ficha("La fachada x = 0", pestana("elev").sub, L)];
  }

  /* ---------- lo que la prueba necesita para barrerlo todo -------------- */
  function todasLasLineas(m3) {
    const out = [];
    for (const p of PESTANAS) {
      if (!p.real) continue;
      for (const f of fichas(p.id, m3)) {
        for (const l of f.lineas) out.push({ pestana: p.id, ficha: f.titulo, linea: l });
      }
    }
    return out;
  }

  return {
    ART, ORIGENES, ENTRADAS, PESTANAS,
    ln, ficha, grupos, valida, problema, pestana, dibujo, fichas, todasLasLineas
  };
});
