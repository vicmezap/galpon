/* =====================================================================
   inventario.js — el inventario de magnitudes, cargado como código

   LA REGLA DEL PROYECTO:
     Ningún número entra al código sin fila en el inventario.
     Sin fuente primaria leída, no entra.

   Este módulo es lo que la vuelve MECÁNICA en vez de una buena intención.
   Cualquier módulo que necesite un valor o una cita lo pide por su id:

       const { def, art } = INVENTARIO;
       const Fy = def("MAT.A36.Fy");        // 2530
       const cita = art("MAT.A36.Fy");      // "ASTM A36 (36 ksi) · admitido por…"

   Si el id no existe, art() y def() LANZAN. No devuelven undefined, no
   devuelven un valor por defecto: paran. Un número sin fila en el inventario
   rompe la prueba en la primera corrida, que es donde tiene que romperse.

   El inventario vive en ../inventario/*.json y es la misma fuente que genera
   inventario.html.  En Node se lee del disco; en el navegador lo hornea
   gen_complemento.py dentro del bundle, igual que Retícula hornea la Tabla 1
   de la E.020.  Las dos rutas leen EXACTAMENTE los mismos datos: no pueden
   desincronizarse.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = definir(cargarDeDisco());
  else raiz.INVENTARIO = definir(raiz.INVENTARIO_DATOS || []);

  /* En Node el inventario se lee del disco.  Si falta una sección, para:
     un inventario incompleto que no avisa es peor que no tenerlo. */
  function cargarDeDisco() {
    const fs = require("fs"), path = require("path");
    const dir = path.join(__dirname, "..", "inventario");
    if (!fs.existsSync(dir)) throw new Error("inventario: no existe la carpeta " + dir);
    const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (!archivos.length) throw new Error("inventario: la carpeta está vacía -> " + dir);
    return archivos.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
})(typeof self !== "undefined" ? self : this, function (secciones) {
  "use strict";

  /* Los estados posibles de una fila.  Se validan al cargar: un estado que no
     esté aquí es un error de datos, no una categoría nueva. */
  const ESTADOS = ["verificado", "adoptado", "conflicto", "sin_fuente", "pendiente"];

  /* Los estados que NO bloquean escribir código con esa fila.  «pendiente»
     significa que falta el documento: se puede referenciar la fila para dejar
     el hueco marcado, pero el valor no sirve todavía. */
  const USABLES = ["verificado", "adoptado", "conflicto", "sin_fuente"];

  const filas = new Map();
  const porSeccion = new Map();

  for (const sec of secciones) {
    const lista = sec.magnitudes || [];
    porSeccion.set(sec.seccion, lista.map((m) => m.id));
    for (const m of lista) {
      if (filas.has(m.id)) {
        throw new Error("inventario: id repetido -> " + m.id +
          " (secciones " + filas.get(m.id)._seccion + " y " + sec.seccion + ")");
      }
      m._seccion = sec.seccion;
      m._titulo = sec.titulo;
      filas.set(m.id, m);
    }
  }

  /* ---------- consultas ------------------------------------------------ */

  function fila(id) {
    const f = filas.get(id);
    if (!f) {
      throw new Error(
        "inventario: la magnitud «" + id + "» NO TIENE FILA.\n" +
        "  Ningún número entra al código sin fila en el inventario.\n" +
        "  Añádela en inventario/<seccion>.json con su fuente primaria leída,\n" +
        "  o corrige el id si está mal escrito.");
    }
    return f;
  }

  /* El valor, para usarlo en un cálculo. */
  function def(id) {
    const f = fila(id);
    if (f.estado === "pendiente") {
      throw new Error(
        "inventario: «" + id + "» está PENDIENTE y no se puede usar todavía.\n" +
        "  Falta: " + (f.fuente || "(sin fuente anotada)") + "\n" +
        "  " + (f.nota || ""));
    }
    return f.valor;
  }

  /* EL VALOR COMO NÚMERO, y por qué hace falta una función aparte.

     def() devuelve el TEXTO de la fila, que es texto de presentación: MAT.E
     vale «2 039 000», con separadores de miles, y MAT.G «787 000».  Hacer
     Number() sobre eso da NaN, y un NaN no avisa: se propaga por toda la
     matriz de rigidez y sale al final como una celda vacía.  Me pasó al
     escribir modelo.js —E_ACERO quedó en NaN— y lo cazó una prueba, no el
     código.

     Así que num() normaliza lo normalizable —espacios de millar de cualquier
     clase, coma decimal— y LANZA con todo lo demás.  Una fila cuyo valor es
     «Z4 = 0,45 · Z3 = 0,35» no es un número y pedirlo como número es un
     error de quien llama, no algo que resolver adivinando. */
  function num(id) {
    const crudo = def(id);
    if (typeof crudo === "number") return crudo;
    const limpio = String(crudo).replace(/[\s  ]/g, "").replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(limpio)) {
      throw new Error(
        "inventario: «" + id + "» no es un número: su valor es «" + crudo + "».\n" +
        "  num() acepta un único número, con separador de millar o coma decimal.\n" +
        "  Si la fila guarda una tabla, una fórmula o varios valores, hay que\n" +
        "  leerla con def() y decidir qué se toma — no adivinarlo aquí.");
    }
    return parseFloat(limpio);
  }

  /* La cita, para el ART del módulo y para la memoria de cálculo. */
  function art(id) { return fila(id).fuente; }

  /* Todo junto, para cuando la interfaz quiere mostrar el porqué. */
  function todo(id) {
    const f = fila(id);
    return {
      id: f.id, magnitud: f.magnitud, valor: f.valor, unidad: f.unidad,
      fuente: f.fuente, estado: f.estado, nota: f.nota || "",
      editable: !!f.editable, clave: !!f.clave, seccion: f._seccion
    };
  }

  function existe(id) { return filas.has(id); }
  function ids() { return Array.from(filas.keys()); }
  function seccion(nombre) { return porSeccion.get(nombre) || []; }
  function secciones_() { return Array.from(porSeccion.keys()); }

  function resumen() {
    const c = {};
    for (const e of ESTADOS) c[e] = 0;
    for (const f of filas.values()) c[f.estado] = (c[f.estado] || 0) + 1;
    c.total = filas.size;
    return c;
  }

  /* ---------- integridad ----------------------------------------------- */
  /* Lo que se comprueba en cada corrida de pruebas.  No es paranoia: el
     inventario se edita a mano y una fila sin fuente es exactamente lo que
     este proyecto existe para impedir. */
  function integridad() {
    const fallos = [];
    const exige = (cond, msg) => { if (!cond) fallos.push(msg); };

    exige(filas.size > 0, "el inventario está vacío");

    for (const f of filas.values()) {
      const d = "[" + f.id + "] ";
      exige(typeof f.id === "string" && f.id.length > 0, d + "sin id");
      exige(!!f.magnitud, d + "sin magnitud");
      exige(f.valor !== undefined && f.valor !== null && f.valor !== "", d + "sin valor");
      exige(ESTADOS.indexOf(f.estado) >= 0, d + "estado no válido: «" + f.estado + "»");

      /* La comprobación que da sentido a todo: toda fila usable tiene fuente. */
      if (USABLES.indexOf(f.estado) >= 0 && f.estado !== "sin_fuente") {
        exige(!!f.fuente && f.fuente !== "—",
          d + "estado «" + f.estado + "» pero SIN FUENTE PRIMARIA");
      }

      /* Un conflicto sin explicación es un conflicto sin resolver. */
      if (f.estado === "conflicto") {
        exige(!!f.nota, d + "es un conflicto y no dice cuál fue la decisión");
      }

      /* Un criterio propio que no se declara no se puede defender. */
      if (f.estado === "sin_fuente") {
        exige(!!f.nota, d + "es criterio propio y no dice por qué se adopta");
      }

      /* Un pendiente tiene que decir qué falta. */
      if (f.estado === "pendiente") {
        exige(!!f.nota, d + "está pendiente y no dice qué falta");
      }
    }
    return fallos;
  }

  /* ---------- el ART de un módulo -------------------------------------- */
  /* Un módulo declara de qué filas depende.  Si alguna no existe, se entera
     al cargarse y no a mitad de un cálculo.

         const ART = INVENTARIO.declara("acero.js", [
           "T.fluencia", "T.rotura", "T.U.c8"
         ]);
         ART["T.fluencia"]   // -> la cita
  */
  function declara(modulo, listaIds) {
    const mapa = {};
    const faltan = [];
    for (const id of listaIds) {
      if (!filas.has(id)) faltan.push(id);
      else mapa[id] = filas.get(id).fuente;
    }
    if (faltan.length) {
      throw new Error(
        "inventario: el módulo «" + modulo + "» declara magnitudes que no existen:\n" +
        faltan.map((x) => "    · " + x).join("\n") +
        "\n  Añádelas al inventario con su fuente, o corrige los ids.");
    }
    return mapa;
  }

  return {
    ESTADOS, USABLES,
    fila, def, num, art, todo, existe, ids, seccion, resumen, integridad, declara,
    secciones: secciones_
  };
});
