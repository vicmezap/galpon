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
    "L.particion", "Z.costura"
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
  const CLAVES = ["formato", "estado", "nombre", "parametros", "sitio",
    "geometria", "vista", "guardado"];

  /* Los parámetros reconocidos.  Una clave nueva aquí es una línea; una
     clave nueva colada sin estar aquí sería un dato que se pierde al
     guardar sin que nadie lo note. */
  const PARAMETROS = ["luz_m", "largo_m", "sepPorticos_m", "alturaColumna_m",
    "ajustaSeparacion", "cuerdas", "alma", "pendiente", "pendienteInferior",
    "paneles", "peralteApoyo_m", "panosArriostradosTecho",
    "panosArriostradosFachada", "columnasHastiales"];

  const ESTADOS = ["parametrico", "suelto"];

  function exige(cond, msg) { if (!cond) throw new Error("libro: " + msg); }

  /* ---------- el modelo vacío ------------------------------------------ */
  function nuevo(d) {
    const o = d || {};
    const p = {};
    for (const k of PARAMETROS) if (o[k] !== undefined) p[k] = o[k];
    return {
      formato: FORMATO,
      estado: "parametrico",
      nombre: o.nombre || "galpón sin nombre",
      parametros: p,
      sitio: o.sitio || {},
      geometria: null,
      vista: o.vista || {},
      guardado: null
    };
  }

  /* ---------- PARAMÉTRICO Y SUELTO · fila L.suelto ---------------------
     El paso es de ida.  La vuelta existe pero hay que pedirla, y dice lo
     que descarta. */
  function edita(modelo, geometria, queSeEdito) {
    valida(modelo);
    exige(geometria && Array.isArray(geometria.nudos) && Array.isArray(geometria.barras),
      "edita() necesita la geometría editada, con nudos y barras");
    const m = clona(modelo);
    const yaEstaba = m.estado === "suelto";
    m.estado = "suelto";
    m.geometria = { nudos: geometria.nudos, barras: geometria.barras };
    return {
      modelo: m,
      seSolto: !yaEstaba,
      art: ART["L.suelto"],
      artProcedencia: ART["L.editado"],
      nota: yaEstaba
        ? "el modelo ya estaba suelto: se guarda la geometría nueva"
        : "EL MODELO SE HA SOLTADO" + (queSeEdito ? " al " + queSeEdito : "") +
          ". Los parámetros pasan a solo lectura: quedan como historial de " +
          "cómo nació. Para volver a parametrizar hay que regenerar desde " +
          "cero, y eso descarta lo editado."
    };
  }

  function regenera(modelo, parametros) {
    valida(modelo);
    const m = nuevo(parametros || modelo.parametros);
    m.nombre = modelo.nombre;
    m.sitio = modelo.sitio;
    m.vista = modelo.vista;
    return {
      modelo: m,
      descartado: modelo.estado === "suelto",
      barrasDescartadas: modelo.geometria ? modelo.geometria.barras.length : 0,
      art: ART["L.suelto"],
      nota: modelo.estado === "suelto"
        ? "se ha descartado la geometría editada y el modelo vuelve a ser " +
          "paramétrico. Esto no se deshace."
        : "el modelo ya era paramétrico: solo se han cambiado los parámetros"
    };
  }

  /* ¿Se pueden tocar los parámetros? · la pregunta que hace la pantalla */
  function parametrosEditables(modelo) {
    valida(modelo);
    return {
      editables: modelo.estado === "parametrico",
      estado: modelo.estado,
      art: ART["L.suelto"],
      porque: modelo.estado === "parametrico"
        ? "el modelo es paramétrico: los parámetros mandan"
        : "el modelo está SUELTO. Los parámetros son el historial de cómo " +
          "nació y no se pueden tocar: si se pudieran, lo que se ve en " +
          "pantalla dejaría de ser lo que dicen los parámetros."
    };
  }

  function clona(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- validación de forma -------------------------------------- */
  function valida(modelo) {
    exige(modelo && typeof modelo === "object", "el modelo no es un objeto");
    exige(ESTADOS.indexOf(modelo.estado) >= 0,
      "estado «" + modelo.estado + "» desconocido; los que hay: " + ESTADOS.join(" · "));
    exige(modelo.parametros && typeof modelo.parametros === "object",
      "el modelo no trae parametros");
    if (modelo.estado === "suelto") {
      exige(modelo.geometria && Array.isArray(modelo.geometria.nudos),
        "el modelo dice estar SUELTO y no trae geometría. Un modelo suelto es " +
        "exactamente el que ya no se puede reconstruir de los parámetros: sin " +
        "geometría no hay nada.");
    }
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
    const o = {};
    for (const k of CLAVES) if (modelo[k] !== undefined) o[k] = modelo[k];
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
    CLAVES, PARAMETROS, ESTADOS,
    nuevo, valida, clona, edita, regenera, parametrosEditables,
    paraGuardar, serializa, deserializa,
    trocea, paraElRango, junta,
    troceaMensaje, juntaMensaje, vaYVuelve
  };
});
