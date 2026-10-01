/* =====================================================================
   panel.js — lo que enseña el panel de tareas

   El panel estrecho de Excel NO es la aplicación: es un lanzador.  Cuatro
   cosas y se acabó —qué hay en el libro, abrir el modelador, guardar, y
   cómo se usa— porque todo lo demás se mira mejor en la ventana grande.
   Meter aquí el cálculo es lo que produjo la cáscara que hubo que tirar.

   Este módulo es ESO COMO DATOS: las líneas de la ficha y el estado de los
   botones.  La plantilla los pinta y no decide nada.  Así el panel se
   puede comprobar en Node, que es donde se puede comprobar.

   ─────────────────────────────────────────────────────────────────────
   LA GUARDA QUE JUSTIFICA EL MÓDULO: NO SE PUEDE GUARDAR LO QUE NO SE HA
   RECIBIDO · fila L.particion.

   El botón «Guardar modelo en el libro» vive en el panel, pero el modelo
   lo tiene la VENTANA, y las dos no comparten almacenamiento —es el fallo
   que Retícula ya pagó y dejó escrito—.  Así que hay un hueco real: abres
   el modelador, dibujas, y si el modelo no ha llegado por mensaje, el
   panel no tiene nada que guardar por mucho que el botón esté ahí.

   Aquí el botón se APAGA y dice por qué, en vez de dejar pulsarlo y
   fallar.  Un botón que se puede pulsar y no hace nada es peor que uno
   apagado: el primero te hace creer que guardaste.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./libro.js"));
  } else {
    raiz.PANEL = definir(raiz.INVENTARIO, raiz.LIBRO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, LIBRO) {
  "use strict";

  const ART = INV.declara("panel.js", [
    "L.particion", "L.suelto", "L.secciones", "L.solo.entradas", "V.procedencia"
  ]);

  const TITULO = "Galpón";
  const BAJADA = "Prediseño, análisis y diseño de galpones de estructura metálica.";

  /* Los tres pasos, que son los del modelador y no los del panel. */
  const COMO_SE_USA = [
    "Abre el modelador y define el galpón. Se predimensiona solo.",
    "En Hojas Excel elige las hojas y púlsalo: se generan rellenas.",
    "Cierra con Guardar y cerrar: el modelo queda dentro del libro."
  ];

  function exige(cond, msg) { if (!cond) throw new Error("panel: " + msg); }

  /* ---------- LA FICHA DEL LIBRO ---------------------------------------
     `s` es lo que el panel sabe en este instante:
       { hayHoja, modelo, recibido, dialogoAbierto, error }
     `modelo` es lo que había en el libro al abrir; `recibido` es lo que ha
     mandado la ventana y todavía no se ha guardado. */
  function ficha(s) {
    const e = s || {};
    const m = e.recibido || e.modelo || null;
    const L = [];

    L.push(linea("Modelo guardado", e.hayHoja ? "sí" : "no",
      e.hayHoja ? null : "el libro no traía ninguno"));

    if (m) {
      const p = m.parametros || {};
      L.push(linea("Luz · largo",
        p.luz_m !== undefined ? n2(p.luz_m) + " · " + n2(p.largo_m) + " m" : "—"));
      L.push(linea("Pórticos", porticos(p)));
      /* Las dos que el panel de Retícula no tiene y este sí, porque en
         acero el dimensionamiento es un bucle y en concreto no. */
      L.push(linea("Perfiles asignados", String(cuentaPerfiles(m))));
      L.push(linea("Ediciones encima", String((m.ediciones || []).length),
        (m.ediciones || []).length
          ? "se reaplican al cambiar un parámetro" : null));
      L.push(linea("Guardado", m.guardado ? m.guardado.slice(0, 16).replace("T", " ") : "—"));
    } else {
      L.push(linea("Pórticos", "—"));
      L.push(linea("Ediciones encima", "—"));
    }
    return L;
  }

  function linea(q, v, nota) {
    const o = { q: q, v: v };
    if (nota) o.nota = nota;
    return o;
  }

  function n2(x) {
    return typeof x === "number"
      ? (Math.round(x * 100) / 100).toFixed(2).replace(".", ",") : "—";
  }

  function porticos(p) {
    if (typeof p.largo_m !== "number" || typeof p.sepPorticos_m !== "number") return "—";
    if (!(p.sepPorticos_m > 0)) return "—";
    const n = Math.round(p.largo_m / p.sepPorticos_m);
    return (n + 1) + " @ " + n2(p.sepPorticos_m) + " m";
  }

  function cuentaPerfiles(m) {
    const s = m.secciones || { porClase: {}, porBarra: {} };
    return Object.keys(s.porClase || {}).length + Object.keys(s.porBarra || {}).length;
  }

  /* ---------- LOS BOTONES, Y CUÁNDO SE APAGAN -------------------------- */
  function acciones(s) {
    const e = s || {};
    const abrir = {
      id: "abrir",
      texto: e.dialogoAbierto ? "El modelador está abierto" : "Abrir modelador",
      principal: true,
      activo: !e.dialogoAbierto,
      porque: e.dialogoAbierto
        ? "ya hay una ventana abierta: Office no deja dos a la vez" : null
    };

    /* LA GUARDA · fila L.particion */
    const hayQueGuardar = !!e.recibido;
    const guardar = {
      id: "guardar",
      texto: "Guardar modelo en el libro",
      principal: false,
      activo: hayQueGuardar,
      porque: hayQueGuardar ? null
        : (e.dialogoAbierto
          ? "la ventana todavía no ha mandado el modelo. El panel y la ventana " +
            "NO comparten almacenamiento: hasta que no llega por mensaje, aquí " +
            "no hay nada que guardar."
          : "no hay modelo que guardar: abre el modelador primero"),
      art: ART["L.particion"]
    };

    const regenerar = {
      id: "regenerar", texto: "Quitar el modelo del libro",
      principal: false, activo: !!e.hayHoja, peligro: true,
      porque: e.hayHoja ? null : "el libro no trae ningún modelo"
    };

    return [abrir, guardar, regenerar];
  }

  /* ---------- EL ESTADO EN UNA LÍNEA ----------------------------------- */
  function estado(s) {
    const e = s || {};
    if (e.error) return { texto: e.error, clase: "err" };
    if (e.dialogoAbierto) return { texto: "Modelador abierto.", clase: "" };
    if (e.recibido) {
      return { texto: "Modelo recibido, sin guardar todavía.", clase: "aviso" };
    }
    if (e.hayHoja) return { texto: "Modelo cargado del libro.", clase: "" };
    return { texto: "El libro no traía ningún modelo guardado.", clase: "" };
  }

  /* ---------- LO QUE EL PANEL AVISA SIN QUE SE LO PIDAN ----------------
     Un modelo recibido y no guardado se pierde al cerrar el libro, y eso
     no lo puede saber el proyectista mirando la pantalla. */
  function avisos(s) {
    const e = s || {};
    const out = [];
    if (e.recibido && !e.guardadoYa) {
      out.push({
        que: "Hay un modelo sin guardar en el libro.",
        porque: "Si cierras Excel ahora, se pierde: la ventana del modelador " +
          "no escribe en el libro, lo hace este panel.",
        accion: "guardar",
        art: ART["L.particion"]
      });
    }
    if (e.modelo && e.modelo.formato !== undefined &&
        e.modelo.formato < LIBRO.FORMATO) {
      out.push({
        que: "El modelo del libro es de un formato anterior (" +
          e.modelo.formato + " contra " + LIBRO.FORMATO + ").",
        porque: "Se abre igual. Al guardarlo se escribirá en el formato nuevo.",
        accion: null
      });
    }
    return out;
  }

  /* ---------- EL PANEL ENTERO, PARA PINTARLO --------------------------- */
  function todo(s) {
    const e = s || {};
    return {
      titulo: TITULO, bajada: BAJADA,
      version: e.version || "—",
      ficha: ficha(e),
      acciones: acciones(e),
      estado: estado(e),
      avisos: avisos(e),
      comoSeUsa: COMO_SE_USA
    };
  }

  /* ---------- LO QUE SE LE PIDE A LA VENTANA --------------------------- */
  /* El panel manda esto al abrir, para que la ventana arranque con lo que
     había en el libro en vez de en blanco. */
  function paraLaVentana(s) {
    const e = s || {};
    if (!e.modelo) return { a: "mod", n: 0 };
    LIBRO.valida(e.modelo);
    return { a: "mod", modelo: e.modelo };
  }

  /* Y esto es lo que el panel acepta de vuelta.  Se valida ANTES de
     tocarlo: un modelo mal formado que entra aquí se escribe en el libro
     y ya no se puede abrir. */
  function recibeDeLaVentana(texto) {
    exige(typeof texto === "string" && texto.length,
      "la ventana no ha mandado nada");
    const r = LIBRO.deserializa(texto);
    return { modelo: r.modelo, formato: r.formato, guardado: r.guardado };
  }

  return {
    ART, TITULO, BAJADA, COMO_SE_USA,
    ficha, acciones, estado, avisos, todo,
    paraLaVentana, recibeDeLaVentana,
    porticos, cuentaPerfiles
  };
});
