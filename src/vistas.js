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
      require("./montaje.js"), require("./vista3d.js"));
  } else {
    raiz.VISTAS = definir(raiz.INVENTARIO, raiz.GENERADOR, raiz.MONTAJE, raiz.VISTA3D);
  }
})(typeof self !== "undefined" ? self : this, function (INV, GEN, MON, V3) {
  "use strict";

  const ART = INV.declara("vistas.js", [
    "V.procedencia", "V.no.duplica", "V.limites", "V.armazon",
    "G.alma", "G.peralte", "G.maxwell", "G.rango", "G.hiperestatica",
    "MT.ejes", "MT.no.diafragma", "MT.mismo.pano", "MT.hastial",
    "L.secciones", "L.suelto",
    "MT.termica", "MT.deltaT", "MT.alfa", "MT.plano.solver",
    "V.isometrica", "V.profundidad"
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
      fuente: "MT.hastial", ayuda: "vacío = ninguna" },

    /* DESTINO «vista»: estos campos mueven la cámara y NO llegan al motor.
       La separación es explícita y la comprueba una prueba, porque el día que
       un parámetro de cámara se cuele en el modelo, girar la vista cambiará
       un ratio y nadie sabrá por qué. */
    { grupo: "Vista 3D", destino: "vista", id: "proy", etiqueta: "Proyección",
      tipo: "opcion", valor: "isometrica", fuente: "V.isometrica", opciones: [
        ["isometrica", "Isométrica · se puede medir"],
        ["ortografica", "Paralela, ángulo libre · se puede medir"],
        ["perspectiva", "Perspectiva · NO medir"]] },
    { grupo: "Vista 3D", destino: "vista", id: "azim", etiqueta: "Azimut", unidad: "°",
      tipo: "numero", valor: 45, paso: 5, limiteDePantalla: [-360, 360] },
    { grupo: "Vista 3D", destino: "vista", id: "elev3d", etiqueta: "Elevación",
      unidad: "°", tipo: "numero", valor: 35, paso: 5, limiteDePantalla: [-89, 89] }
  ];

  /* Todo campo tiene destino; el que no lo diga va al modelo. */
  for (const e of ENTRADAS) if (!e.destino) e.destino = "modelo";

  function soloDe(destino, d) {
    const out = {};
    for (const e of ENTRADAS) if (e.destino === destino) out[e.id] = d[e.id];
    return out;
  }
  function datosModelo(d) { return soloDe("modelo", d); }
  function datosVista(d) { return soloDe("vista", d); }

  /* La cámara que piden los campos de vista, encuadrada al modelo. */
  function camaraDe(v, m3, aspecto) {
    const o = v || {};
    return V3.encuadra(m3, V3.camara({
      tipo: o.proy || "isometrica",
      azimut: o.azim === undefined ? 45 : o.azim,
      elevacion: o.elev3d === undefined ? 35 : o.elev3d,
      aspecto: aspecto || 16 / 9
    }));
  }

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
    { id: "tresd", nombre: "3D", real: true,
      sub: "el galpón entero · isométrica, que se puede medir" }
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
  function dibujo(id, m3, vista) {
    const p = pestana(id);
    if (!p.real) return null;
    if (id === "tresd") return dibujo3d(m3, vista);
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

  /* ---------- LA 3D · proyectada, ordenada y atenuada ------------------
     Los nudos llegan con sus coordenadas de pantalla ya puestas en _x e _y,
     así que el mismo pintor que dibuja las otras tres sirve para esta: UNA
     sola ruta de dibujo en todo el complemento.  Lo que la 3D añade es el
     ORDEN —de atrás hacia delante— y la atenuación, que van aparte porque
     son por barra y no por nudo (fila V.profundidad). */
  function dibujo3d(m3, vista) {
    const cam = camaraDe(vista, m3);
    const esc = V3.escena(m3, cam);
    const nudos = [];
    for (const n of m3.nudos) {
      const q = V3.proyecta(cam, [n.x_m, n.y_m, n.z_m]);
      nudos.push({ id: n.id, _x: q.x, _y: q.y, clase: n.clase, prof: q.prof });
    }
    const orden = [], opacidad = {};
    for (const g of esc.segmentos) { orden.push(g.id); opacidad[g.id] = g.atenuacion; }
    return {
      nudos: nudos, barras: m3.barras,
      ejeX: "_x", ejeY: "_y",
      orden: orden, opacidad: opacidad,
      camara: cam, escena: esc,
      leyenda: [["lo cercano", "tinta"], ["lo lejano, atenuado", "linea"],
        ["ARRIOSTRES", "succion"]]
    };
  }

  /* ---------- LAS FICHAS DE CADA PESTAÑA -------------------------------- */
  function n2(x, d) {
    return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace(".", ",");
  }

  function fichas(id, m3, vista) {
    const p = pestana(id);
    if (!p.real) return [];
    if (id === "portico") return fichasPortico(m3);
    if (id === "planta") return fichasPlanta(m3);
    if (id === "tresd") return fichas3d(m3, vista);
    return fichasElevacion(m3);
  }

  /* LA FICHA DE LA 3D DICE SI EL DIBUJO SE PUEDE MEDIR, Y CON QUÉ ERROR ·
     fila V.isometrica.  Es lo único que una vista «solo ver» tiene
     obligación de declarar: si invita a comparar, que diga si mentiría. */
  function fichas3d(m3, vista) {
    const cam = camaraDe(vista, m3);
    const dis = V3.distorsion(m3, cam);
    const esc = V3.escena(m3, cam);
    const L = [
      ln("Proyección", cam.tipo, "norma", { fuente: "V.isometrica" }),
      ln("Azimut · elevación",
        n2(cam.azimut, 1) + "° · " + n2(cam.elevacion, 1) + "°", "entrada"),
      ln("¿Se puede medir en pantalla?", dis.medible ? "sí" : "NO", "medido",
        { estado: dis.medible ? "ok" : "no", nota: dis.nota }),
      ln("Dos columnas idénticas: la más lejana mide",
        n2(dis.razon * 100, 1) + " % de la más cercana", "medido",
        { estado: Math.abs(dis.razon - 1) < 1e-9 ? "ok" : "no" }),
      ln("Separadas en profundidad",
        n2(dis.masLejos.prof - dis.masCerca.prof, 1) + " m", "geometria"),
      ln("Segmentos dibujados", String(esc.segmentos.length), "conteo"),
      ln("Orden y atenuación", "de atrás hacia delante", "norma",
        { fuente: "V.profundidad",
          nota: "No se quitan líneas ocultas: un alambre no tiene caras. El " +
            "arriostre de la fachada de atrás se ve a través de la nave, y para " +
            "revisar que el camino de carga cierra eso es mejor que peor." })
    ];
    if (cam.esIsometricaExacta) {
      L.push(ln("Elevación isométrica exacta",
        "atan(1/√2) = " + n2(V3.ISO_ELEVACION, 4) + "°", "geometria",
        { nota: "El ángulo que hace que un metro en x, uno en y y uno en z midan " +
          "lo mismo en pantalla. No es un valor elegido a ojo." }));
    }
    return [ficha("Cómo se está mirando", pestana("tresd").sub, L,
      dis.medible ? "bien" : null)];
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

  /* ---------- ANOTACIONES · lo que convierte un croquis en un dibujo ----
     Cotas, etiquetas y apoyos salen de aquí COMO DATOS, en coordenadas del
     modelo, y la plantilla los transforma con el mismo mapa que usa para
     las barras.  Dibujarlos a mano en el HTML habría sido más corto y no
     se podría comprobar ni uno.

     UN DIBUJO ESTRUCTURAL SIN CIFRAS NO ES UN DIBUJO, ES UN CROQUIS: no se
     puede señalar una barra y hablar de ella, ni medir nada, ni llevarlo a
     obra.  Y las etiquetas no son decoración: el panel derecho dice
     «DIAGONAL D7» y si el dibujo no pone D7 en ninguna parte, el que mira
     tiene que adivinar cuál es. */

  /* Una cota: del punto 1 al 2, con su texto y a qué lado se aparta. El
     `nivel` separa las cotas paralelas para que no se pisen. */
  function cota(x1, y1, x2, y2, texto, lado, nivel) {
    return { x1: x1, y1: y1, x2: x2, y2: y2, texto: texto,
      lado: lado || "abajo", nivel: nivel || 1 };
  }

  function anotaciones(id, m3, vista) {
    const p = pestana(id);
    if (!p.real) return vacio();
    if (id === "portico") return anotaPortico(m3);
    if (id === "planta") return anotaPlanta(m3);
    if (id === "elev") return anotaElevacion(m3);
    return vacio();
  }
  function vacio() { return { cotas: [], etiquetas: [], apoyos: [], ejes: [] }; }

  /* ---------- el pórtico ---------- */
  function anotaPortico(m3) {
    const t = m3.tijeral, h = m3.alturaColumna_m, L = m3.luz_m;
    const sup = t.nudos.filter((n) => n.clase === "superior")
      .slice().sort((a, b) => a.x_m - b.x_m);
    const inf = t.nudos.filter((n) => n.clase === "inferior")
      .slice().sort((a, b) => a.x_m - b.x_m);
    const cotas = [], etiquetas = [], ejes = [];

    /* los paños, abajo, uno a uno */
    for (let i = 0; i + 1 < inf.length; i++) {
      cotas.push(cota(inf[i].x_m, 0, inf[i + 1].x_m, 0,
        n2(inf[i + 1].x_m - inf[i].x_m, 3), "abajo", 1));
    }
    /* y la luz entera, debajo de las anteriores */
    cotas.push(cota(0, 0, L, 0, n2(L, 2) + " m", "abajo", 2));

    /* las alturas, a la izquierda */
    cotas.push(cota(0, 0, 0, h, n2(h, 2) + " m", "izq", 1));
    cotas.push(cota(0, h, 0, h + t.peralteApoyo_m,
      n2(t.peralteApoyo_m, 2), "izq", 1));
    cotas.push(cota(0, 0, 0, h + t.peralteMaximo_m,
      n2(h + t.peralteMaximo_m, 2) + " m", "izq", 2));

    /* el peralte en el centro, donde se ve */
    const c = L / 2;
    cotas.push(cota(c, h + (t.peralteCentro_m ? 0 : 0), c, h + t.peralteCentro_m,
      n2(t.peralteCentro_m, 2), "der", 1));

    /* los nudos de paño: los de abajo todos, los de arriba uno sí uno no
       cuando son muchos, o se tapan entre ellos */
    const saltoSup = sup.length > 9 ? 2 : 1;
    for (let i = 0; i < inf.length; i++) {
      etiquetas.push({ x: inf[i].x_m, y: 0 + (m3.alturaColumna_m * 0),
        yModelo: inf[i].y_m + m3.alturaColumna_m, texto: inf[i].id,
        forma: "nada", donde: "debajo" });
    }
    for (let i = 0; i < sup.length; i += saltoSup) {
      etiquetas.push({ x: sup[i].x_m, yModelo: sup[i].y_m + m3.alturaColumna_m,
        texto: sup[i].id, forma: "nada", donde: "encima" });
    }
    /* los ejes de columna, discontinuos y rotulados en círculo */
    for (const x of [0, L]) {
      ejes.push({ x1: x, y1: 0, x2: x, y2: m3.alturaColumna_m + t.peralteMaximo_m });
    }
    etiquetas.push({ x: 0, yModelo: 0, texto: "A", forma: "circulo", donde: "debajo" });
    etiquetas.push({ x: L, yModelo: 0, texto: "B", forma: "circulo", donde: "debajo" });

    return { cotas: cotas, etiquetas: etiquetas, ejes: ejes,
      apoyos: [{ x: 0, y: 0, tipo: "fijo" }, { x: L, y: 0, tipo: "movil" }],
      art: ART["MT.ejes"] };
  }

  /* ---------- la planta de techo · (z, x) ---------- */
  function anotaPlanta(m3) {
    const ej = m3.ejes, L = m3.luz_m;
    const cotas = [], etiquetas = [], ejes = [];
    /* los paños a lo largo */
    for (let k = 0; k + 1 < ej.z_m.length; k++) {
      cotas.push(cota(ej.z_m[k], 0, ej.z_m[k + 1], 0,
        n2(ej.sepPorticos_m, 2), "abajo", 1));
    }
    cotas.push(cota(0, 0, ej.largo_m, 0, n2(ej.largo_m, 2) + " m", "abajo", 2));
    cotas.push(cota(0, 0, 0, L, n2(L, 2) + " m", "izq", 1));

    /* los pórticos, numerados, con su línea de eje */
    for (let k = 0; k < ej.porticos; k++) {
      ejes.push({ x1: ej.z_m[k], y1: 0, x2: ej.z_m[k], y2: L });
      etiquetas.push({ x: ej.z_m[k], yModelo: L, texto: String(k + 1),
        forma: "circulo", donde: "encima" });
    }
    /* los paños arriostrados, rotulados donde están */
    for (const k of m3.panosArriostradosTecho) {
      etiquetas.push({ x: (ej.z_m[k] + ej.z_m[k + 1]) / 2, yModelo: L / 2,
        texto: "arriostrado", forma: "marca", donde: "centro" });
    }
    return { cotas: cotas, etiquetas: etiquetas, ejes: ejes, apoyos: [],
      art: ART["MT.ejes"] };
  }

  /* ---------- la elevación longitudinal · (z, y) ---------- */
  function anotaElevacion(m3) {
    const ej = m3.ejes, h = m3.alturaColumna_m;
    const cotas = [], etiquetas = [], ejes = [];
    for (let k = 0; k + 1 < ej.z_m.length; k++) {
      cotas.push(cota(ej.z_m[k], 0, ej.z_m[k + 1], 0,
        n2(ej.sepPorticos_m, 2), "abajo", 1));
    }
    cotas.push(cota(0, 0, ej.largo_m, 0, n2(ej.largo_m, 2) + " m", "abajo", 2));
    cotas.push(cota(0, 0, 0, h, n2(h, 2) + " m", "izq", 1));
    const apoyos = [];
    for (let k = 0; k < ej.porticos; k++) {
      ejes.push({ x1: ej.z_m[k], y1: 0, x2: ej.z_m[k], y2: h });
      etiquetas.push({ x: ej.z_m[k], yModelo: 0, texto: String(k + 1),
        forma: "circulo", donde: "debajo" });
      apoyos.push({ x: ej.z_m[k], y: 0, tipo: "fijo" });
    }
    /* los puntos fijos de la dilatación, que es lo que esta vista enseña */
    for (const z of m3.dilatacion.puntosFijos_m) {
      etiquetas.push({ x: z, yModelo: h, texto: "punto fijo", forma: "marca",
        donde: "encima" });
    }
    return { cotas: cotas, etiquetas: etiquetas, ejes: ejes, apoyos: apoyos,
      art: ART["MT.termica"] };
  }

  /* ---------- LAS TABLAS DEL PANEL DERECHO -----------------------------
     Retícula tiene su tabla de ejes editable; estas son las de Galpón, y
     la primera es la que faltaba para poder trabajar: SIN ELLA NO SE
     PUEDEN ASIGNAR PERFILES, que es lo principal que hace la herramienta. */

  /* Las clases de barra que hay en el modelo, con su perfil y su cuenta. */
  function tablaPerfiles(m3, modelo) {
    const cuenta = m3.conteo.porClase;
    const filas = [];
    for (const clase of Object.keys(cuenta)) {
      const asignado = modelo && modelo.secciones
        ? modelo.secciones.porClase[clase] : undefined;
      filas.push({
        clase: clase,
        barras: cuenta[clase],
        perfil: asignado === undefined ? null : asignado,
        sinPerfil: asignado === undefined
      });
    }
    filas.sort((a, b) => b.barras - a.barras);
    const faltan = filas.filter((f) => f.sinPerfil).length;
    return {
      filas: filas, clases: filas.length, sinPerfil: faltan,
      art: ART["L.secciones"],
      nota: faltan
        ? faltan + " clase(s) de barra sin perfil. Hasta que lo tengan no hay " +
          "nada que verificar: el análisis necesita A e I para correr."
        : "todas las clases tienen perfil asignado"
    };
  }

  /* Los paños, con su arriostre. Sustituye al campo de texto «5, 9», que
     obligaba a contar paños de cabeza mirando el dibujo. */
  function tablaPanos(m3) {
    const ej = m3.ejes;
    const techo = {}, fachada = {};
    for (const k of m3.panosArriostradosTecho) techo[k] = true;
    for (const k of m3.panosArriostradosFachada) fachada[k] = true;
    const filas = [];
    for (let k = 0; k < ej.panos; k++) {
      filas.push({
        pano: k,
        entre: (k + 1) + " – " + (k + 2),
        z1_m: ej.z_m[k], z2_m: ej.z_m[k + 1],
        techo: !!techo[k], fachada: !!fachada[k],
        alineado: !!techo[k] === !!fachada[k]
      });
    }
    return {
      filas: filas, panos: ej.panos,
      conTecho: m3.panosArriostradosTecho.length,
      conFachada: m3.panosArriostradosFachada.length,
      art: ART["MT.mismo.pano"],
      nota: m3.camino.alineados
        ? "techo y fachada en los mismos paños: la viga de alero solo amarra"
        : "techo y fachada en paños distintos: " +
          n2(m3.camino.recorridoMaximoAlero_m, 2) + " m de alero a AXIAL"
    };
  }

  /* ---------- LOS PASOS · cada uno con SU armazón ----------------------
     ESTABA MAL Y SE VEIA: la barra de vistas —Pórtico, Planta, Elevación,
     3D— y el panel de la izquierda —Ver y Datos— son de GEOMETRIA, y se
     colaban en todos los pasos.  Al entrar en Cargas seguías viendo las
     capas de barras y los parámetros del tijeral, que allí no pintan nada.

     Así que cada paso declara QUE ARMAZON LLEVA, y la plantilla monta solo
     eso.  Va aquí y no en el HTML por lo de siempre: para poder comprobar
     que Cargas no enseña la barra de vistas sin tener que mirarlo. */
  const PASOS = [
    { id: "inicio", grupo: "Estado", nombre: "Inicio", listo: true,
      vistas: false, lados: [],
      sub: "qué hay en este libro y qué falta" },

    { id: "datos", grupo: "Paso 1", nombre: "Datos", listo: false,
      vistas: false, lados: [],
      hara: "una pantalla de datos del proyecto",
      motor: "proyecto.js y el inventario entero, escritos",
      que: "nombre y ubicación, normas que mandan, materiales y f'c" },

    { id: "geom", grupo: "Paso 2 · Modelo", nombre: "Geometría", listo: true,
      vistas: true, lados: ["ver", "parametros"],
      sub: "el galpón entero, en cuatro vistas" },

    { id: "cargas", grupo: "Paso 2 · Modelo", nombre: "Cargas", listo: false,
      vistas: false, lados: [],
      hara: "una pantalla de cargas",
      motor: "e020.js, viento.js, e030.js y combinaciones.js, escritos y probados",
      que: "E.020 muerta y viva de techo, viento por zonas con la Tabla 5, " +
        "E.030 y las combinaciones de la E.090" },

    { id: "analisis", grupo: "Paso 3", nombre: "Análisis", listo: false,
      vistas: false, lados: [],
      hara: "una pantalla de análisis",
      motor: "modelo.js, solver.js, estabilidad.js y riostras.js, escritos",
      que: "las fuerzas de cada barra, el Método Directo y la pasada del bucle. " +
        "ES EL QUE MÁS FALTA: sin él la selección no puede decir un ratio" },

    { id: "diseno", grupo: "Paso 4", nombre: "Diseño", listo: false,
      vistas: false, lados: [],
      hara: "una pantalla de diseño",
      motor: "acero.js con los cinco capítulos, y las cuatro piezas de E5",
      que: "cada barra contra su capítulo del AISC, con su doble referencia" },

    { id: "conex", grupo: "Paso 5", nombre: "Conexiones", listo: false,
      vistas: false, lados: [],
      hara: "una pantalla de conexiones",
      motor: "placabase.js escrito; conexiones.js (Cap. J) pendiente",
      que: "placa de apoyo, pernos de anclaje y llave de corte" },

    { id: "cimen", grupo: "Paso 6", nombre: "Cimentación", listo: false,
      vistas: false, lados: [],
      hara: "pedestal.js y zapatas.js",
      motor: "no escrito todavía · etapa E8",
      que: "pedestal y zapata por E.060, con el levantamiento que un galpón sí tiene" },

    { id: "comprob", grupo: "Paso 7", nombre: "Comprobación", listo: true,
      vistas: false, lados: [],
      sub: "lo que las guardas tienen que decir" },

    { id: "hojas", grupo: "Salida", nombre: "Hojas Excel", listo: false,
      vistas: false, lados: [],
      hara: "escritor.js y hojas.js",
      motor: "no escrito todavía · etapa E9",
      que: "las hojas de cálculo rellenas, que es donde se queda el cálculo" },

    { id: "cad", grupo: "Salida", nombre: "AutoCAD", listo: false,
      vistas: false, lados: [],
      hara: "cad.js",
      motor: "no escrito todavía · etapa E9",
      que: "los planos E-1 a E-5" }
  ];

  function paso(id) {
    const p = PASOS.filter((x) => x.id === id)[0];
    if (!p) {
      throw new Error("vistas: el paso «" + id + "» no existe. Los que hay: " +
        PASOS.map((x) => x.id).join(" · "));
    }
    return p;
  }

  /* El armazón que le toca a un paso.  La plantilla pregunta esto y monta
     solo lo que diga: ni una barra de vistas de más. */
  function armazon(id) {
    const p = paso(id);
    return {
      id: p.id, nombre: p.nombre, listo: p.listo,
      vistas: !!p.vistas,
      lados: (p.lados || []).slice(),
      sub: p.sub || null
    };
  }

  /* ---------- INICIO · el tablero -------------------------------------
     El primer paso puede estar lleno hoy, porque no calcula nada nuevo:
     dice qué hay en el libro y qué falta.  Es lo que uno quiere ver al
     abrir el archivo tres semanas después. */
  function inicio(m3, modelo) {
    const fichas = [];
    if (m3) {
      const met = MON_OPC ? MON_OPC.metrado(m3) : null;
      const area = m3.luz_m * m3.ejes.largo_m;
      fichas.push(ficha("El galpón", "lo que hay definido ahora mismo", [
        ln("Luz · largo", n2(m3.luz_m, 2) + " · " + n2(m3.ejes.largo_m, 2) + " m",
          "entrada"),
        ln("Pórticos", m3.ejes.porticos + " @ " + n2(m3.ejes.sepPorticos_m, 2) + " m",
          "geometria"),
        ln("Área techada en planta", n2(area, 0) + " m²", "geometria"),
        ln("Nudos · barras", m3.conteo.nudos + " · " + m3.conteo.barras, "conteo"),
        met ? ln("Acero", n2(met.total_m, 0) + " m de barra", "medido")
            : ln("Acero", "—", "medido")
      ]));
    }

    const listos = PASOS.filter((p) => p.listo);
    fichas.push(ficha("Los pasos", listos.length + " de " + PASOS.length +
      " con pantalla",
      PASOS.map((p) => ln(p.nombre, p.listo ? "listo" : "todavía no",
        p.listo ? "medido" : "medido",
        { estado: p.listo ? "ok" : null,
          nota: p.listo ? null : (p.motor || "") }))));

    const r = INV.resumen();
    const pend = INV.ids().filter((id) => INV.fila(id).estado === "pendiente");
    fichas.push(ficha("El inventario", "ningún número sin fuente", [
      ln("Filas", String(r.total), "conteo"),
      ln("Verificado · adoptado", r.verificado + " · " + r.adoptado, "conteo"),
      ln("En conflicto, con decisión escrita", String(r.conflicto), "conteo"),
      ln("Sin fuente", String(r.sin_fuente), "conteo",
        { estado: r.sin_fuente === 0 ? "ok" : "no" }),
      ln("Pendientes", pend.join(" · ") || "ninguno", "conteo",
        { estado: r.pendiente ? "no" : "ok",
          nota: r.pendiente
            ? "son documentos que faltan, no cálculos sin hacer" : null })
    ], r.sin_fuente === 0 ? "bien" : null));

    return fichas;
  }

  /* ---------- COMPROBACION · lo que las guardas tienen que decir -------
     Las guardas de los módulos LANZAN cuando algo es imposible, y eso se
     ve enseguida.  Lo que no se ve es lo que es legal pero cuesta: el
     alero trabajando a axial, los metros que no dilatan, las clases sin
     perfil.  Esta es esa lista. */
  const NIVELES = ["error", "aviso", "nota"];

  function comprobacion(m3, modelo) {
    const L = [];
    const pon = (nivel, que, porque, extra) => {
      const o = { nivel: nivel, que: que, porque: porque };
      if (extra) for (const k of Object.keys(extra)) o[k] = extra[k];
      L.push(o);
    };

    /* 1 · las clases sin perfil · bloquea el análisis */
    const tp = tablaPerfiles(m3, modelo);
    if (tp.sinPerfil) {
      pon("aviso", tp.sinPerfil + " clase(s) de barra sin perfil asignado",
        "Hasta que lo tengan no hay nada que verificar: el análisis necesita " +
        "A e I para correr. Se asignan en la tabla de perfiles del paso Geometría.",
        { fuente: "L.secciones", paso: "geom",
          cuales: tp.filas.filter((f) => f.sinPerfil).map((f) => f.clase) });
    } else {
      pon("nota", "Todas las clases tienen perfil", "", { fuente: "L.secciones" });
    }

    /* 2 · el camino de carga */
    if (!m3.camino.alineados) {
      pon("aviso", "Techo y fachada arriostrados en paños distintos",
        "La reacción del arriostre de techo recorre " +
        n2(m3.camino.recorridoMaximoAlero_m, 2) + " m de alero antes de poder " +
        "bajar, y quien la lleva es la VIGA DE ALERO trabajando a AXIAL, no a " +
        "flexión. Hay que diseñarla como puntal.",
        { fuente: "MT.mismo.pano", paso: "geom" });
    } else {
      pon("nota", "Techo y fachada en los mismos paños",
        "la viga de alero solo amarra", { fuente: "MT.mismo.pano" });
    }

    /* 3 · lo que no puede dilatar */
    if (m3.dilatacion.longitudPresa_m > 0) {
      pon("aviso", n2(m3.dilatacion.longitudPresa_m, 2) +
        " m del galpón no pueden dilatar",
        "Entre dos paños arriostrados hay dos puntos fijos. La E.020 Art. 15 " +
        "manda considerar " + m3.dilatacion.deltaT_C + " °C en construcciones de " +
        "metal y el AISC §L6 también lo exige. El alargamiento en mm no se " +
        "calcula porque α a temperatura ambiente no está en ninguna fuente.",
        { fuente: "MT.termica", paso: "geom" });
    }

    /* 4 · el tijeral hiperestático acopla el bucle */
    if (m3.tijeral.conteo.grado > 0) {
      pon("nota", "El tijeral es hiperestático de grado " + m3.tijeral.conteo.grado,
        "Las fuerzas se redistribuyen al cambiar las secciones, así que el bucle " +
        "de dimensionamiento se acopla de verdad: cada pasada cambia las fuerzas.",
        { fuente: "G.hiperestatica" });
    }

    /* 5 · el arriostre que no cae en el alero */
    if (m3.tijeral.alma === "warren") {
      pon("nota", "La Warren no tiene nudo superior en el alero",
        "Su primer nudo de brida superior está medio paño adentro, así que la " +
        "correa del alero se queda sin nudo.", { fuente: "G.alma" });
    }

    /* 6 · perfiles asignados a barras que ya no existen */
    if (modelo) {
      const h = LIB_OPC ? LIB_OPC.perfilesHuerfanos(modelo, m3) : null;
      if (h && h.huerfanos.length) {
        pon("aviso", h.huerfanos.length + " perfil(es) asignados a barras que ya no existen",
          "Se conservan por si la geometría vuelve a tenerlas: " +
          h.huerfanos.join(", "), { fuente: "L.secciones" });
      }
      if (modelo.ediciones && modelo.ediciones.length) {
        pon("nota", modelo.ediciones.length + " edición(es) encima de lo paramétrico",
          "Se reaplican al cambiar un parámetro; lo que no quepa se dirá.",
          { fuente: "L.suelto" });
      }
    }

    /* 7 · lo que el proyecto entero sabe que le falta */
    const pend = INV.ids().filter((id) => INV.fila(id).estado === "pendiente");
    for (const id of pend) {
      pon("nota", "Pendiente de norma: " + id,
        INV.fila(id).magnitud + ". " + (INV.fila(id).fuente || ""),
        { fuente: null, pendiente: id });
    }

    const cuenta = { error: 0, aviso: 0, nota: 0 };
    for (const a of L) cuenta[a.nivel]++;
    L.sort((a, b) => NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel));
    return {
      lista: L, cuenta: cuenta, total: L.length,
      insignia: cuenta.error + cuenta.aviso,
      art: ART["V.procedencia"],
      nota: cuenta.error
        ? "hay " + cuenta.error + " cosa(s) que impiden seguir"
        : (cuenta.aviso
          ? cuenta.aviso + " aviso(s): el galpón se puede calcular, pero hay " +
            "decisiones que cuestan"
          : "ningún aviso")
    };
  }

  /* montaje.js y libro.js son OPCIONALES aquí, por lo mismo que perfiles.js
     más abajo: vistas.js tiene que poder cargarse y probarse sin ellos. */
  const LIB_OPC = (typeof require === "function")
    ? (function () { try { return require("./libro.js"); } catch (e) { return null; } })()
    : (typeof self !== "undefined" ? self.LIBRO : null);
  const MON_OPC = (typeof require === "function")
    ? (function () { try { return require("./montaje.js"); } catch (e) { return null; } })()
    : (typeof self !== "undefined" ? self.MONTAJE : null);

  /* ---------- VER Y AISLAR · lo que sustituye a la paleta de dibujo ----
     ESTO EMPEZO SIENDO UNA PALETA DE DIBUJO copiada de Reticula, y estaba
     mal por un error de metodo que conviene dejar escrito.

     En Reticula la planta es LIBRE: las columnas van donde van, los vanos
     son irregulares, hay vacios y ejes inclinados.  Ahi una paleta de
     dibujo es imprescindible.  En un galpon NO HAY NADA LIBRE: todo sale
     de la luz, el largo, la separacion de porticos, la pendiente, los
     panos y la tipologia.  No hay nada que dibujar a mano.

     Se copio la forma de la herramienta de al lado sin preguntar si el
     problema de debajo era el mismo, y no lo era.  Lo que un modelo de 733
     barras que NO se dibuja necesita de verdad es poder MIRARSE: apagar
     las correas para ver el alma, aislar las diagonales, pinchar una barra
     y saber que es.  Eso es esto. */
  function capas(m3, estado) {
    const e = estado || {};
    const cuenta = m3.conteo.porClase;
    const aislada = e.aislada || null;
    const apagadas = e.apagadas || {};
    const filas = Object.keys(cuenta).map((clase) => ({
      clase: clase,
      barras: cuenta[clase],
      plano: planoDe(m3, clase),
      visible: aislada ? clase === aislada : !apagadas[clase],
      aislada: clase === aislada
    }));
    filas.sort((a, b) => b.barras - a.barras);
    const vistas = filas.filter((f) => f.visible);
    return {
      filas: filas, aislada: aislada,
      clasesVisibles: vistas.length,
      barrasVisibles: vistas.reduce((a, f) => a + f.barras, 0),
      barrasTotales: m3.conteo.barras,
      art: ART["V.procedencia"],
      nota: aislada
        ? "aislada «" + aislada + "»: lo demás sigue en el modelo, solo no se dibuja"
        : (vistas.length === filas.length
          ? "se ven las " + m3.conteo.barras + " barras"
          : "ocultas " + (filas.length - vistas.length) + " clase(s)")
    };
  }

  function planoDe(m3, clase) {
    for (const b of m3.barras) if (b.clase === clase) return b.plano;
    return null;
  }

  /* Las barras que hay que dibujar con las capas puestas. NO se filtran
     los nudos: un nudo suelto no estorba y quitarlo obligaria a recalcular
     el encuadre, con lo que el dibujo daria un salto al apagar una capa. */
  function filtra(barras, estado) {
    const c = capas({ conteo: { porClase: cuentaClases(barras),
      barras: barras.length }, barras: barras }, estado);
    const ver = {};
    for (const f of c.filas) if (f.visible) ver[f.clase] = true;
    return barras.filter((b) => ver[b.clase]);
  }
  function cuentaClases(barras) {
    const o = {};
    for (const b of barras) o[b.clase] = (o[b.clase] || 0) + 1;
    return o;
  }

  /* ---------- LA SELECCION · el panel contextual ------------------------
     Reticula dice «CRUCE VACIO · Sin columna en B-2'».  Esto es su
     equivalente: pinchas una barra y sale lo que es.

     LO QUE NO DICE ES EL RATIO, y se dice que no lo dice.  Para el ratio
     hacen falta las fuerzas, las fuerzas salen del analisis y el analisis
     es el PASO 3, que todavia no tiene pantalla.  Ensenar aqui un numero
     que parezca un ratio seria exactamente lo que este proyecto no hace. */
  function seleccion(m3, modelo, idBarra) {
    const b = m3.barras.filter((x) => x.id === idBarra)[0];
    if (!b) return null;
    const pos = {};
    for (const n of m3.nudos) pos[n.id] = n;
    const a = pos[b.i], c = pos[b.j];
    const L = (a && c)
      ? Math.sqrt(Math.pow(c.x_m - a.x_m, 2) + Math.pow(c.y_m - a.y_m, 2) +
          Math.pow(c.z_m - a.z_m, 2))
      : null;

    const per = modelo ? perfilDeBarra(modelo, b) : { perfil: null, de: null };
    const L2 = [
      ln("Clase", b.clase, "geometria"),
      ln("Entre nudos", b.i + " y " + b.j, "geometria"),
      ln("Plano", b.plano, "norma", { fuente: "MT.ejes" })
    ];
    if (L !== null) L2.push(ln("Longitud", n2(L, 3) + " m", "geometria"));
    if (b.eje !== undefined) L2.push(ln("Pórtico", String(b.eje + 1), "conteo"));
    if (b.pano !== undefined) L2.push(ln("Paño", String(b.pano), "conteo"));

    if (per.perfil) {
      L2.push(ln("Perfil", per.perfil, "entrada",
        { nota: per.de === "clase"
          ? "asignado a toda la clase «" + b.clase + "»"
          : "excepción asignada a esta barra" }));
      if (per.datos) {
        L2.push(ln("Área", n2(per.datos.A_cm2, 2) + " cm²", "entrada"));
        if (per.datos.peso_kgfm !== undefined) {
          L2.push(ln("Peso", n2(per.datos.peso_kgfm, 2) + " kgf/m", "entrada"));
          if (L !== null) {
            L2.push(ln("Peso de esta barra",
              n2(per.datos.peso_kgfm * L, 1) + " kgf", "geometria"));
          }
        }
        if (per.datos.rx_cm !== undefined && L !== null) {
          L2.push(ln("L/rx", n2(L * 100 / per.datos.rx_cm, 0), "geometria"));
        }
      }
    } else {
      L2.push(ln("Perfil", "sin asignar", "entrada",
        { estado: "no", nota: "asígnalo en la tabla de perfiles: sin A ni I el " +
          "análisis no puede correr" }));
    }

    L2.push(ln("Ratio", "falta el análisis", "medido",
      { nota: "el ratio necesita las fuerzas, las fuerzas salen del análisis y " +
        "el análisis es el PASO 3, que todavía no tiene pantalla. Un número " +
        "aquí que pareciera un ratio sería justo lo que este proyecto no hace." }));

    return {
      id: b.id, clase: b.clase, longitud_m: L, perfil: per.perfil,
      lineas: L2, faltaAnalisis: true,
      art: ART["V.procedencia"]
    };
  }

  function perfilDeBarra(modelo, b) {
    if (!modelo || !modelo.secciones) return { perfil: null, de: null };
    const pb = modelo.secciones.porBarra[b.id];
    const pc = modelo.secciones.porClase[b.clase];
    const id = pb !== undefined ? pb : pc;
    if (id === undefined) return { perfil: null, de: null };
    let datos = null;
    try { datos = PERFILES_OPC ? PERFILES_OPC.busca(id) : null; } catch (e) { datos = null; }
    return { perfil: id, de: pb !== undefined ? "barra" : "clase", datos: datos };
  }

  /* perfiles.js es opcional aqui: en Node la prueba puede no cargarlo, y
     la seleccion tiene que seguir funcionando sin los datos del perfil. */
  const PERFILES_OPC = (typeof require === "function")
    ? (function () { try { return require("./perfiles.js"); } catch (e) { return null; } })()
    : (typeof self !== "undefined" ? self.PERFILES : null);

  /* ---------- lo que la prueba necesita para barrerlo todo -------------- */
  function todasLasLineas(m3, vista) {
    const out = [];
    for (const p of PESTANAS) {
      if (!p.real) continue;
      for (const f of fichas(p.id, m3, vista)) {
        for (const l of f.lineas) out.push({ pestana: p.id, ficha: f.titulo, linea: l });
      }
    }
    return out;
  }

  return {
    ART, ORIGENES, ENTRADAS, PESTANAS,
    ln, ficha, grupos, valida, problema, pestana, dibujo, fichas, todasLasLineas,
    datosModelo, datosVista, camaraDe,
    anotaciones, cota, tablaPerfiles, tablaPanos,
    capas, filtra, seleccion, perfilDeBarra,
    PASOS, paso, armazon, inicio, comprobacion, NIVELES
  };
});
