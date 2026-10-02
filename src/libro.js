/* =====================================================================
   libro.js — el modelo dentro del libro de Excel

   El modelador vive en una ventana aparte y el libro es donde el trabajo
   sobrevive a cerrar Excel.  Este módulo es esa frontera, y es TODO lo que
   se puede comprobar sin Excel delante: serializar, trocear, recomponer,
   y negarse cuando toca.  Lo único que queda fuera —las llamadas a
   Excel.run y a messageChild— son diez líneas que solo se prueban abriendo
   el complemento de verdad.

   SE COPIAN TRES NÚMEROS DE RETÍCULA Y NO SE DISCUTEN · filas L.trozo y
   L.particion.  Son dos complementos de la misma suite escribiendo en el
   mismo libro, y que difieran no tendría ninguna ventaja:

       TROZO      30 000   una celda admite 32 767; esto deja margen
       MAX_FILAS     200   A1:A200, o sea 6 MB de tope
       TROZO_MSG   8 000   el mensaje entre ventana y panel tiene tope

   ─────────────────────────────────────────────────────────────────────
   LAS CUATRO COSAS QUE ESTE MÓDULO SE NIEGA A HACER.

   1 · LEER ALGO QUE NO SE SABE QUÉ ES · fila L.formato.  El texto lleva
       cabecera «GALPON \t formato \t fecha».  Si no empieza por GALPON,
       para: en este libro conviven dos complementos y la hoja equivocada
       se lee igual de bien.  Y si el formato es MÁS NUEVO del que conoce,
       para también —un complemento viejo abriendo un modelo nuevo tiene
       que negarse, no interpretarlo a medias—.

   2 · GUARDAR RESULTADOS · fila L.solo.entradas.  Se guardan entradas:
       parámetros y, si el modelo está suelto, la geometría editada.  Los
       conteos, los ratios y las fuerzas se vuelven a calcular al abrir.
       Es la misma regla que ya impide pasar combinaciones entre el acero
       y la cimentación (fila Z.costura): un resultado guardado se queda
       viejo en cuanto cambia una entrada y nada lo delata.

   3 · TIRAR EN SILENCIO LO QUE NO CONOCE.  paraGuardar() lleva lista
       blanca, y ante una clave desconocida PARA en vez de descartarla.
       Descartar pierde trabajo del proyectista sin avisar; negarse cuesta
       añadir una línea el día que el modelo crezca.

   4 · ESCRIBIR UN MODELO QUE NO CABE.  Más de 200 trozos y para, con el
       número delante.  Truncar produce un galpón incompleto que se abre
       sin protestar, que es la peor de las dos.

   ─────────────────────────────────────────────────────────────────────
   LO EDITADO MANDA, Y NO APAGA LOS PARÁMETROS · fila L.suelto.

   Las ediciones se guardan como CAPAS y se vuelven a aplicar encima cada
   vez que cambia un parámetro.  Cambias la pendiente al 25 %: el tijeral
   se regenera y encima vuelven tus nudos movidos y tus barras borradas.

   Esto se decidió al revés primero —que el modelo «se soltara» al primer
   cambio manual, dejando los parámetros de solo lectura— y se rectificó el
   mismo día al ver qué significaba: LA EDICIÓN MÁS FRECUENTE EN UN GALPÓN
   NO ES ARRASTRAR UN NUDO, ES ASIGNAR UN PERFIL, y eso es el bucle del
   diseño en acero.  Soltar el modelo al primer perfil habría apagado la
   pendiente en la primera pasada.

   Y POR ESO LOS PERFILES NO SON UNA EDICIÓN · fila L.secciones.  Van en el
   modelo al mismo nivel que la luz, por CLASE de barra y solo por barra
   suelta cuando hay excepción.  Así la edición más frecuente tiene riesgo
   CERO de quedarse huérfana: las capas quedan para lo geométrico, que es
   lo único que puede dejar de existir.

   LO QUE NO SE PUEDE REAPLICAR NO SE BORRA · fila L.perdidas.  Pasas de 12
   paños a 8 y «borrar D11» se queda sin sitio: se avisa y SE CONSERVA.  Si
   vuelves a 12, la edición vuelve sola.  Borrarla haría que ir y volver
   destruyera trabajo sin que nadie lo pidiera.

   ─────────────────────────────────────────────────────────────────────
   Y UNA COSA QUE NO HACE Y PARECE QUE DEBERÍA · fila L.particion.  No
   usa localStorage para pasar el modelo entre la ventana y el panel.  No
   es prudencia: es que NO FUNCIONA, y el comentario que lo dice está en
   el código de Retícula, pagado con un fallo:

     «ANTES esto se leía de localStorage, y esa era la mitad del fallo: la
      ventana del modelador tiene su propia partición de almacenamiento,
      así que lo que ella guardaba nunca llegaba aquí.»

   El modelo viaja por mensaje, troceado, y no hay alternativa.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.LIBRO = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("libro.js", [
    "L.formato", "L.trozo", "L.solo.entradas", "L.suelto", "L.editado",
    "L.secciones", "L.perdidas", "L.particion", "Z.costura"
  ]);

  /* ---------- las hojas · muy ocultas ----------------------------------
     «Muy oculta» y no «oculta»: una hoja oculta se enseña desde el menú
     de Excel con dos clics, y un modelo de 200 celdas de texto invita a
     que alguien lo toque. */
  const HOJA_MODELO = "GALPON_MODELO";
  const HOJA_RESULTADOS = "GALPON_RESULTADOS";
  const HOJAS = [HOJA_MODELO, HOJA_RESULTADOS];
  const VISIBILIDAD = "veryHidden";

  const TROZO = 30000;
  const MAX_FILAS = 200;
  const TROZO_MSG = 8000;
  const RANGO = "A1:A" + MAX_FILAS;

  const MARCA = "GALPON";
  const FORMATO = 1;

  /* ---------- LO QUE SE GUARDA, Y NADA MÁS · fila L.solo.entradas ------ */
  const CLAVES = ["formato", "nombre", "parametros", "secciones", "ediciones",
    "proyecto", "sitio", "sistema", "diseno", "cimentacion", "vista", "guardado"];

  /* Los datos del proyecto · paso 1.  Texto, para la cabecera de las hojas y los planos. */
  const PROYECTO = ["nombre", "ubicacion", "propietario", "proyectista"];

  /* Los datos de la cimentación · misma regla. */
  const CIMENTACION = ["sigmaAdm_kgfcm2", "esNeta", "Df_cm", "gammaRelleno_kgfm3", "sc_kgfm2", "mu",
    "fc_kgcm2", "grado", "rec_cm", "barra", "pedB_cm", "pedL_cm", "sobreTerreno_cm", "B_cm", "L_cm", "h_cm",
    "pedBarra", "pedEstribo", "pedRec_cm", "junta",
    "placaB_cm", "placaN_cm", "placaT_cm", "pernoF_cm", "pernosFila", "pernoSep_cm", "pernoD", "pernoMat",
    "pernoLd_cm", "llaveL_cm", "llaveH_cm", "llaveT_cm", "grout_cm", "electrodo", "vigaB_cm", "vigaH_cm"];

  /* Los datos de diseño · misma regla: lo que no está en la lista PARA. */
  const DISENO = ["arriostreInferior_m", "separacionLargueros_m", "LbColumna_m", "cartela",
    "tensores", "panelTramos", "clipCorreas",
    "separadores_cm", "conexionSeparadores", "condicionesE5", "uniones", "soldadura_cm",
    "pernosPorLinea", "diametroPerno", "arriostreComprobado",
    "filete_mm", "electrodo", "gradoPerno", "pernoS_cm", "pernoLe_cm", "gramil_cm"];

  /* Los datos del sitio y de las cargas.  Misma regla que PARAMETROS: una
     clave que no está aquí PARA al guardar, en vez de perderse en silencio. */
  const SITIO = ["espesorCobertura_mm", "Dotras_kgfm2", "hayNieve", "Qs_kgfm2",
    "V_kmh", "tipoEdificacion", "aberturas", "acero",
    "distrito", "suelo", "vs30_ms", "sistemaSismico", "industrial",
    "uso", "riesgoAdicional", "usoSecCat", "usoSecPct",
    /* heredados: la categoría y la zona se elegían a mano; ahora salen del uso y del distrito
       (filas S.categoria.uso y S.zona.distrito) y estas no se usan */
    "categoria", "zona"];

  /* El sistema estructural · fila A.sistema.  Sin valor por omisión: lo decide
     el proyectista, y un modelo nuevo no lo trae. */
  const SISTEMA = { base: ["empotrada", "articulada"], union: ["apoyado", "rigida"] };

  /* Los parámetros reconocidos.  Una clave nueva aquí es una línea; una
     clave nueva colada sin estar aquí sería un dato que se pierde al
     guardar sin que nadie lo note. */
  const PARAMETROS = ["luz_m", "largo_m", "sepPorticos_m", "alturaColumna_m",
    "ajustaSeparacion", "cuerdas", "alma", "pendiente", "pendienteInferior",
    "paneles", "peralteApoyo_m", "panosArriostradosTecho",
    "panosArriostradosFachada", "columnasHastiales"];

  /* Los tres tipos de capa, y ninguno más.  Uno desconocido PARA: es un
     error de quien lo escribió, no un estado del proyectista. */
  const TIPOS = ["mover", "borrar", "anadir"];

  function exige(cond, msg) { if (!cond) throw new Error("libro: " + msg); }

  /* ---------- el modelo vacío ------------------------------------------ */
  function nuevo(d) {
    const o = d || {};
    const p = {};
    for (const k of PARAMETROS) if (o[k] !== undefined) p[k] = o[k];
    return {
      formato: FORMATO,
      nombre: o.nombre || "galpón sin nombre",
      parametros: p,
      /* entrada de primera clase, no edición · fila L.secciones */
      secciones: o.secciones || { porClase: {}, porBarra: {} },
      /* las capas geométricas · fila L.suelto */
      ediciones: o.ediciones ? o.ediciones.slice() : [],
      proyecto: o.proyecto || {},
      sitio: o.sitio || {},
      sistema: o.sistema || null,
      diseno: o.diseno || {},
      cimentacion: o.cimentacion || {},
      vista: o.vista || {},
      guardado: null
    };
  }

  /* ---------- LAS CAPAS · fila L.suelto --------------------------------
     Apilar una edición no cambia el régimen del modelo: sigue siendo
     paramétrico y los parámetros siguen tocándose. */
  function edita(modelo, edicion) {
    valida(modelo);
    validaEdicion(edicion);
    const m = clona(modelo);
    m.ediciones.push(clona(edicion));
    return {
      modelo: m,
      ediciones: m.ediciones.length,
      art: ART["L.suelto"],
      artProcedencia: ART["L.editado"],
      nota: "la edición queda como capa. Los parámetros siguen activos: al " +
        "cambiar uno, el tijeral se regenera y esta capa se vuelve a aplicar " +
        "encima."
    };
  }

  function validaEdicion(e) {
    exige(e && typeof e === "object", "la edición no es un objeto");
    exige(TIPOS.indexOf(e.tipo) >= 0,
      "tipo de edición «" + e.tipo + "» desconocido; los que hay: " + TIPOS.join(" · "));
    if (e.tipo === "mover") {
      exige(typeof e.nudo === "string" && e.nudo, "mover() necesita el id del nudo");
      exige(typeof e.dx_m === "number" && typeof e.dy_m === "number",
        "mover necesita dx_m y dy_m numéricos");
    } else if (e.tipo === "borrar") {
      exige(typeof e.barra === "string" && e.barra, "borrar necesita el id de la barra");
    } else {
      exige(e.barra && typeof e.barra === "object" && e.barra.id && e.barra.i && e.barra.j,
        "añadir necesita la barra con id, i y j");
    }
    return true;
  }

  /* LOS PARÁMETROS NO SE APAGAN NUNCA · lo que pregunta la pantalla. */
  function parametrosEditables(modelo) {
    valida(modelo);
    return {
      editables: true,
      ediciones: modelo.ediciones.length,
      art: ART["L.suelto"],
      porque: modelo.ediciones.length
        ? "los parámetros siempre se tocan. Hay " + modelo.ediciones.length +
          " edición(es) encima, que se reaplicarán sobre la geometría nueva; " +
          "lo que no quepa se dirá, no se tirará."
        : "los parámetros siempre se tocan, y de momento no hay ninguna edición encima"
    };
  }

  /* ---------- REAPLICAR LAS CAPAS · filas L.suelto y L.perdidas --------
     Entra la geometría recién generada de los parámetros y salen las dos
     cosas que hacen falta: la geometría con las capas puestas, y LA LISTA
     DE LAS QUE NO CABÍAN, con su motivo.  Esto NO lanza por una capa
     perdida: una capa perdida es un aviso para el proyectista, no un error
     del programa, y lanzar dejaría la pantalla en blanco. */
  function aplica(base, ediciones) {
    exige(base && Array.isArray(base.nudos) && Array.isArray(base.barras),
      "aplica() necesita la geometría base, con nudos y barras");
    const nudos = base.nudos.map((n) => Object.assign({}, n));
    const barras = base.barras.map((b) => Object.assign({}, b));
    const porNudo = {};
    for (const n of nudos) porNudo[n.id] = n;
    const porBarra = {};
    for (const b of barras) porBarra[b.id] = b;

    const puestas = [], perdidas = [];
    const fuera = {};

    for (const e of (ediciones || [])) {
      validaEdicion(e);
      if (e.tipo === "mover") {
        const n = porNudo[e.nudo];
        if (!n) { perdidas.push({ edicion: e, porque: "el nudo «" + e.nudo + "» ya no existe" }); continue; }
        n.x_m += e.dx_m;
        n.y_m += e.dy_m;
        if (typeof e.dz_m === "number" && typeof n.z_m === "number") n.z_m += e.dz_m;
        n.editado = true;
        puestas.push(e);
      } else if (e.tipo === "borrar") {
        if (!porBarra[e.barra]) { perdidas.push({ edicion: e, porque: "la barra «" + e.barra + "» ya no existe" }); continue; }
        fuera[e.barra] = true;
        puestas.push(e);
      } else {
        const b = e.barra;
        if (porBarra[b.id] && !fuera[b.id]) { perdidas.push({ edicion: e, porque: "ya hay una barra «" + b.id + "»" }); continue; }
        if (!porNudo[b.i] || !porNudo[b.j]) {
          perdidas.push({ edicion: e, porque: "falta un extremo: " +
            (!porNudo[b.i] ? b.i : b.j) + " no existe" });
          continue;
        }
        const nueva = Object.assign({}, b, { editado: true });
        barras.push(nueva);
        porBarra[b.id] = nueva;
        delete fuera[b.id];
        puestas.push(e);
      }
    }

    return {
      nudos: nudos,
      barras: barras.filter((b) => !fuera[b.id]),
      reaplicadas: puestas,
      perdidas: perdidas,
      art: ART["L.perdidas"],
      nota: perdidas.length
        ? perdidas.length + " edición(es) no se pudieron reaplicar sobre la " +
          "geometría nueva. NO se han borrado: si la geometría vuelve a " +
          "tenerlas, vuelven solas."
        : "todas las ediciones se reaplicaron"
    };
  }

  /* Olvidar ediciones, que hay que pedirlo · fila L.perdidas */
  function olvidaEdiciones(modelo, cuales) {
    valida(modelo);
    const m = clona(modelo);
    const antes = m.ediciones.length;
    if (cuales === undefined) m.ediciones = [];
    else {
      exige(Array.isArray(cuales), "olvidaEdiciones() recibe los índices a olvidar, o nada");
      const fuera = {};
      for (const i of cuales) fuera[i] = true;
      m.ediciones = m.ediciones.filter((e, i) => !fuera[i]);
    }
    return {
      modelo: m, olvidadas: antes - m.ediciones.length, quedan: m.ediciones.length,
      art: ART["L.perdidas"],
      nota: "esto no se deshace: las capas olvidadas no vuelven aunque la " +
        "geometría vuelva a admitirlas"
    };
  }

  /* ---------- LOS PERFILES · fila L.secciones --------------------------
     Por clase, y por barra solo como excepción.  Lo de por clase es lo que
     hace que una sección NO pueda quedarse huérfana al cambiar un
     parámetro: «todas las diagonales son L2½x2½x¼» sigue valiendo haya las
     diagonales que haya. */
  function asignaPerfil(modelo, destino, perfil) {
    valida(modelo);
    exige(destino && typeof destino === "object", "asignaPerfil() necesita a qué asignarlo");
    exige(destino.clase || destino.barra,
      "hay que decir la clase de barra o la barra suelta");
    exige(!(destino.clase && destino.barra),
      "o por clase o por barra, no las dos: por clase es lo normal y por barra la excepción");
    const m = clona(modelo);
    if (destino.clase) m.secciones.porClase[destino.clase] = perfil;
    else m.secciones.porBarra[destino.barra] = perfil;
    return {
      modelo: m, art: ART["L.secciones"],
      nota: destino.clase
        ? "por clase: no se puede quedar huérfano al cambiar un parámetro"
        : "por barra suelta: si esa barra deja de existir, la excepción se " +
          "queda sin dueño y se avisa"
    };
  }

  /* El perfil que le toca a una barra: la excepción manda sobre la clase. */
  function perfilDe(modelo, barra) {
    valida(modelo);
    exige(barra && barra.id, "perfilDe() necesita la barra");
    const porBarra = modelo.secciones.porBarra[barra.id];
    if (porBarra !== undefined) return { perfil: porBarra, de: "barra", art: ART["L.secciones"] };
    const porClase = modelo.secciones.porClase[barra.clase];
    if (porClase !== undefined) return { perfil: porClase, de: "clase", art: ART["L.secciones"] };
    return { perfil: null, de: null, art: ART["L.secciones"],
      nota: "sin perfil asignado ni por barra ni por su clase «" + barra.clase + "»" };
  }

  /* Excepciones por barra que se quedaron sin dueño · se avisa, no se borra */
  function perfilesHuerfanos(modelo, geometria) {
    valida(modelo);
    exige(geometria && Array.isArray(geometria.barras), "hace falta la geometría");
    const hay = {};
    for (const b of geometria.barras) hay[b.id] = true;
    const sueltos = Object.keys(modelo.secciones.porBarra).filter((id) => !hay[id]);
    return {
      huerfanos: sueltos, art: ART["L.secciones"],
      nota: sueltos.length
        ? sueltos.length + " perfil(es) asignados a barras que ya no existen. " +
          "Se conservan por si vuelven."
        : "ninguna excepción por barra se ha quedado sin dueño"
    };
  }

  function clona(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- validación de forma -------------------------------------- */
  function valida(modelo) {
    exige(modelo && typeof modelo === "object", "el modelo no es un objeto");
    exige(modelo.parametros && typeof modelo.parametros === "object",
      "el modelo no trae parametros");
    exige(Array.isArray(modelo.ediciones),
      "el modelo no trae la lista de ediciones (puede ir vacía, pero tiene que estar)");
    exige(modelo.secciones && modelo.secciones.porClase && modelo.secciones.porBarra,
      "el modelo no trae secciones, con porClase y porBarra");
    return true;
  }

  /* ---------- LA LISTA BLANCA · fila L.solo.entradas -------------------- */
  function paraGuardar(modelo) {
    valida(modelo);
    const sobran = Object.keys(modelo).filter((k) => CLAVES.indexOf(k) < 0 &&
      modelo[k] !== undefined);
    if (sobran.length) {
      throw new Error(
        "libro: el modelo trae claves que no están en la lista de lo que se\n" +
        "  guarda: " + sobran.join(", ") + "\n" +
        "  No se descartan en silencio a propósito: descartar pierde trabajo sin\n" +
        "  avisar. Si son entradas, añádelas a CLAVES; si son resultados —conteos,\n" +
        "  ratios, fuerzas— NO se guardan y hay que sacarlas del modelo: " +
        ART["L.solo.entradas"] + ".\n" +
        "  Es la misma regla de " + ART["Z.costura"] + ": lo calculado se recalcula.");
    }
    const sobranP = Object.keys(modelo.parametros)
      .filter((k) => PARAMETROS.indexOf(k) < 0);
    if (sobranP.length) {
      throw new Error(
        "libro: parámetros desconocidos: " + sobranP.join(", ") + "\n" +
        "  Añádelos a PARAMETROS si son de verdad parámetros del galpón.");
    }
    const sobranS = Object.keys(modelo.sitio || {}).filter((k) => SITIO.indexOf(k) < 0);
    if (sobranS.length) {
      throw new Error(
        "libro: datos de sitio desconocidos: " + sobranS.join(", ") + "\n" +
        "  Añádelos a SITIO si son de verdad datos del sitio o de las cargas.");
    }
    const sobranPr = Object.keys(modelo.proyecto || {}).filter((k) => PROYECTO.indexOf(k) < 0);
    if (sobranPr.length) {
      throw new Error("libro: datos de proyecto desconocidos: " + sobranPr.join(", ") +
        ". Añádelos a PROYECTO si son de verdad datos del proyecto.");
    }
    const sobranD = Object.keys(modelo.diseno || {}).filter((k) => DISENO.indexOf(k) < 0);
    if (sobranD.length) {
      throw new Error("libro: datos de diseño desconocidos: " + sobranD.join(", ") +
        ". Añádelos a DISENO si son de verdad datos de diseño.");
    }
    const sobranC = Object.keys(modelo.cimentacion || {}).filter((k) => CIMENTACION.indexOf(k) < 0);
    if (sobranC.length) {
      throw new Error("libro: datos de cimentación desconocidos: " + sobranC.join(", ") +
        ". Añádelos a CIMENTACION si son de verdad datos de cimentación.");
    }
    if (modelo.sistema) {
      for (const k of Object.keys(SISTEMA)) {
        exige(SISTEMA[k].indexOf(modelo.sistema[k]) >= 0,
          "sistema." + k + " es " + SISTEMA[k].join(" ó ") + ", no «" + modelo.sistema[k] + "»");
      }
      const otras = Object.keys(modelo.sistema).filter((k) => !SISTEMA[k]);
      exige(!otras.length, "el sistema trae claves desconocidas: " + otras.join(", "));
    }
    const o = {};
    for (const k of CLAVES) if (modelo[k] !== undefined && modelo[k] !== null) o[k] = modelo[k];
    o.formato = FORMATO;
    return o;
  }

  /* ---------- serializar · fila L.formato ------------------------------ */
  function serializa(modelo, fecha) {
    const o = paraGuardar(modelo);
    o.guardado = fecha || new Date().toISOString();
    return MARCA + "\t" + FORMATO + "\t" + o.guardado + "\n" +
      JSON.stringify(o);
  }

  function deserializa(texto) {
    exige(typeof texto === "string" && texto.length,
      "deserializa() no ha recibido texto");
    const salto = texto.indexOf("\n");
    exige(salto > 0, "el texto guardado no tiene cabecera");
    const cab = texto.slice(0, salto).split("\t");

    if (cab[0] !== MARCA) {
      throw new Error(
        "libro: esto no es un modelo de Galpón; su cabecera dice «" +
          String(cab[0]).slice(0, 20) + "».\n" +
        "  En este libro pueden convivir varios complementos de la suite y la\n" +
        "  hoja equivocada se lee igual de bien. " + ART["L.formato"] + ".");
    }
    const f = parseInt(cab[1], 10);
    exige(!isNaN(f), "la cabecera no dice un formato válido");
    if (f > FORMATO) {
      throw new Error(
        "libro: el modelo está guardado en formato " + f + " y este complemento\n" +
        "  entiende hasta el " + FORMATO + ".\n" +
        "  Se niega a leerlo en vez de interpretarlo a medias: un complemento\n" +
        "  viejo abriendo un modelo nuevo no puede saber qué se añadió.\n" +
        "  Actualiza el complemento (recarga la página del modelador).");
    }
    let o;
    try { o = JSON.parse(texto.slice(salto + 1)); }
    catch (e) {
      throw new Error("libro: la cabecera es de Galpón pero el contenido no es " +
        "JSON válido.\n  Puede que la hoja se haya editado a mano. (" + e.message + ")");
    }
    valida(o);
    return { modelo: o, formato: f, guardado: cab[2] || null, art: ART["L.formato"] };
  }

  /* ---------- trocear para las celdas · fila L.trozo -------------------- */
  function trocea(texto) {
    exige(typeof texto === "string", "trocea() necesita texto");
    const n = Math.ceil(texto.length / TROZO) || 1;
    if (n > MAX_FILAS) {
      throw new Error(
        "libro: el modelo ocupa " + texto.length.toLocaleString("es") +
          " caracteres y no cabe en la hoja.\n" +
        "  Caben " + MAX_FILAS + " celdas de " + TROZO.toLocaleString("es") +
          ", o sea " + (MAX_FILAS * TROZO).toLocaleString("es") + ": harían falta " +
          n + ".\n" +
        "  No se trunca: un modelo truncado se vuelve a abrir como un galpón\n" +
        "  incompleto y no protesta. " + ART["L.trozo"] + ".");
    }
    const out = [];
    for (let i = 0; i < texto.length; i += TROZO) out.push(texto.substr(i, TROZO));
    if (!out.length) out.push("");
    return out;
  }

  /* Lo que se escribe en el rango: una columna de MAX_FILAS, con el resto
     en blanco para borrar lo que hubiera de un modelo anterior más largo. */
  function paraElRango(trozos) {
    exige(trozos.length <= MAX_FILAS, "más trozos de los que caben");
    const filas = [];
    for (let i = 0; i < MAX_FILAS; i++) filas.push([i < trozos.length ? trozos[i] : ""]);
    return filas;
  }

  /* Al leer: se concatena hasta la primera celda vacía.  Así un modelo
     guardado por una versión que troceaba distinto se sigue abriendo. */
  function junta(valores) {
    exige(Array.isArray(valores), "junta() necesita las filas del rango");
    const partes = [];
    for (const fila of valores) {
      const v = Array.isArray(fila) ? fila[0] : fila;
      if (v === null || v === undefined || v === "") break;
      partes.push(String(v));
    }
    return partes.length ? partes.join("") : null;
  }

  /* ---------- EL CANAL CON LA VENTANA · fila L.particion ----------------
     Mismo protocolo que Retícula, para que la lección valga en los dos:
     {a: clase, i: índice, n: total, d: trozo}. */
  function troceaMensaje(clase, texto) {
    exige(typeof clase === "string" && clase, "troceaMensaje() necesita una clase");
    exige(typeof texto === "string", "troceaMensaje() necesita texto");
    const n = Math.max(1, Math.ceil(texto.length / TROZO_MSG));
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ a: clase, i: i, n: n, d: texto.substr(i * TROZO_MSG, TROZO_MSG) });
    }
    return out;
  }

  /* Acumulador: devuelve null hasta tener todos los trozos.  Un mensaje
     con i = 0 reinicia, que es como se recupera de un envío a medias. */
  function juntaMensaje(cesta, msg) {
    exige(cesta && typeof cesta === "object", "juntaMensaje() necesita una cesta");
    exige(msg && typeof msg.a === "string" && typeof msg.n === "number" &&
      typeof msg.i === "number", "mensaje mal formado");
    let c = cesta[msg.a];
    if (!c || c.n !== msg.n || msg.i === 0) c = cesta[msg.a] = { n: msg.n, v: [], cuantos: 0 };
    if (c.v[msg.i] === undefined) { c.v[msg.i] = msg.d; c.cuantos++; }
    if (c.cuantos < c.n) return null;
    cesta[msg.a] = null;
    return c.v.join("");
  }

  /* ---------- el viaje entero, sin Excel · lo que la prueba recorre ----- */
  function vaYVuelve(modelo, fecha) {
    const texto = serializa(modelo, fecha);
    const filas = paraElRango(trocea(texto));
    const leido = junta(filas);
    return deserializa(leido);
  }

  return {
    ART, HOJA_MODELO, HOJA_RESULTADOS, HOJAS, VISIBILIDAD,
    TROZO, MAX_FILAS, TROZO_MSG, RANGO, MARCA, FORMATO,
    CLAVES, PARAMETROS, TIPOS, PROYECTO, SITIO, SISTEMA, DISENO, CIMENTACION,
    nuevo, valida, clona, edita, validaEdicion, aplica, olvidaEdiciones,
    parametrosEditables, asignaPerfil, perfilDe, perfilesHuerfanos,
    paraGuardar, serializa, deserializa,
    trocea, paraElRango, junta,
    troceaMensaje, juntaMensaje, vaYVuelve
  };
});
