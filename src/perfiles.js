/* =====================================================================
   perfiles.js — el catálogo

   Tres catálogos, un solo acceso.  Cada perfil viaja con dos campos que no
   son geometría pero deciden todo lo demás (filas PROP.fabricacion y
   PROP.unidad del inventario):

       fabricacion : "laminado" | "soldado" | "frio"
       espec       : "AISC360"  | "AISI"
       estado      : "activo"   | "espera"

   El campo `espec` es lo que hace que la fase 2 sea un módulo nuevo y no
   una refactorización: los perfiles Precor entran HOY al catálogo, se ven
   en la interfaz, y quedan en `espera` hasta que exista el motor AISI
   S100.  El día que exista, cambia una línea.

   LA CONVERSIÓN OCURRE AQUÍ Y SOLO AQUÍ, al cargar.  Aguas abajo no existe
   ninguna pulgada.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./unidades.js"), cargarDeDisco());
  } else {
    raiz.PERFILES = definir(raiz.INVENTARIO, raiz.UNIDADES, raiz.CATALOGOS_DATOS || []);
  }

  /* El catálogo ES un artefacto versionado, no un generado que se pueda
     rehacer en cualquier máquina: el .xls del AISC vive fuera del
     repositorio y en un clon limpio no está.  Si el catálogo falta, esto
     PARA con instrucciones en vez de devolver una lista vacía que haría
     fallar las pruebas cien líneas más abajo con un mensaje sin sentido.

     Me pasó: gitignoré catalogos/ y el CI habría salido rojo en el primer
     push diciendo «W12X26 no está en el catálogo». */
  function cargarDeDisco() {
    const fs = require("fs"), path = require("path");
    const dir = path.join(__dirname, "..", "catalogos");
    if (!fs.existsSync(dir)) {
      throw new Error(
        "perfiles: no existe la carpeta catalogos/.\n" +
        "  El catálogo va versionado en el repositorio porque es el artefacto\n" +
        "  que prueban las pruebas, y su origen (.xls del AISC) vive fuera.\n" +
        "  Si lo estás regenerando:  python scripts/importa_aisc.py");
    }
    const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (!archivos.length) {
      throw new Error("perfiles: la carpeta catalogos/ está vacía -> " + dir);
    }
    return archivos.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
})(typeof self !== "undefined" ? self : this, function (INV, U, catalogos) {
  "use strict";

  const ART = INV.declara("perfiles.js", [
    "CAT.aisc", "CAT.precor", "CAT.soldados", "CAT.soldados.cols",
    "CAT.nombre.noUnico", "CAT.familia.conflicto", "CAT.hss.espesor",
    "PROP.fabricacion", "PROP.unidad", "MAT.admitidos"
  ]);

  /* Por qué un perfil puede estar en espera, dicho para que se muestre. */
  const MOTIVO_ESPERA = {
    AISI: "requiere el motor AISI S100 · fase 2 (conformado en frío)"
  };

  const homonimos = new Map();   /* designación -> TODOS los que la llevan */
  const porId = new Map();       /* id único -> perfil */
  const ambiguos = new Map();    /* designación -> los que la comparten */
  const todos = [];
  const avisos = [];

  for (const cat of catalogos) {
    for (const crudo of (cat.perfiles || [])) {
      /* La única conversión del proyecto. */
      const p = cat.origen === "imperial"
        ? U.importaAISC(crudo)
        : U.importaMetrico(crudo);

      p.nombre = crudo.nombre;
      p.familia = crudo.familia;
      p.fabricacion = crudo.fabricacion;
      p.espec = crudo.espec;
      p.catalogo = cat.catalogo;
      /* LA FAMILIA NO ES ÚNICA ENTRE CATÁLOGOS, y entra en conflicto en dos:
         «C» son 70 canales laminados del AISC y 63 canales de alas atiesadas
         de Precor, que son otra sección; «L» son 127 ángulos laminados y 29
         conformados.  Misma letra, distinta pieza y distinta especificación.

         No se renombran —la designación es la del catálogo, no la nuestra—:
         se agrupan por fabricación, que es lo que de verdad los separa.  La
         interfaz lista `grupos()`, no `familias()`. */
      p.grupo = p.fabricacion + ":" + p.familia;
      p.estado = crudo.espec === "AISI" ? "espera" : "activo";
      if (p.estado === "espera") p.motivo = MOTIVO_ESPERA.AISI;

      /* CONTROL DE INTEGRIDAD DEL CATÁLOGO · AISC §B4.2 dice que el
         espesor de diseño de un HSS es 0,93 del nominal, así que el
         cociente tnom/tdes tiene que dar 1,0753 en todas las filas.  Las
         que no lo dan traen un dato mal en el archivo de origen, y hay
         cinco.  Se anotan en avisos en vez de corregirse en silencio: el
         catálogo es de otro y no nos toca arreglarlo, pero sí saberlo. */
      if (p.tnom_cm && p.tdes_cm) {
        const ratio = p.tnom_cm / p.tdes_cm;
        if (Math.abs(ratio - 1 / 0.93) > 0.01) {
          avisos.push({ perfil: p.nombre, catalogo: cat.catalogo,
            espesorInconsistente: true, ratio: ratio });
        }
      }

      if (p._desconocidas) {
        avisos.push({ perfil: p.nombre, catalogo: cat.catalogo, columnas: p._desconocidas });
      }
      /* EL NOMBRE NO ES CLAVE ÚNICA, y descubrirlo costó una prueba en rojo.
         La NBR 5884 designa por peralte × peso —VS400x32 son 400 mm y unos
         32 kg/m— y dos geometrías distintas pueden redondear al mismo peso:
         una con ala de 8 mm × 140 y otra de 6,3 × 180. El catálogo lista las
         dos, y tiene razón: son dos perfiles.

         El `id` se asigna DESPUÉS de cargarlo todo, no aquí: para saber qué
         distingue dos secciones homónimas hay que tener delante las dos. */
      homonimos.has(p.nombre) || homonimos.set(p.nombre, []);
      homonimos.get(p.nombre).push(p);
      todos.push(p);
    }
  }

  /* ---------- el id ----------------------------------------------------- */

  /* EL DISCRIMINADOR NO PUEDE SER UN CAMPO FIJO.  Era `bf_cm`, que valen los
     perfiles I y no existe en un ángulo ni en un canal Precor: las ocho
     familias conformadas habrían colapsado todas a «·bf0», que es un id
     repetido, o sea ninguno.

     Así que se busca cuál es la dimensión que de verdad los separa, y se
     nombra en el id.  `VS400x32·bf14` y `VS400x32·bf18` dicen en qué se
     diferencian; «·bf0» no decía nada. */
  const CLAVES_GEO = ["d_cm", "D_cm", "bf_cm", "B_cm", "tf_cm", "tw_cm",
                      "t_cm", "labio_cm", "h_cm", "A_cm2", "Ix_cm4", "Iy_cm4"];

  function firma(p, claves) {
    return claves.map((k) => k.replace(/_cm\d?$/, "") + Math.round(p[k] * 10)).join("·");
  }

  /* Las claves mínimas que dan una firma distinta a cada uno de la lista.
     Una clave solo entra si SEPARA MÁS que las que ya están: dos VS400x32
     comparten el peralte, así que `d` no va en el id —no distinguía nada— y
     sí va `bf`, que es lo único en que difieren. */
  function clavesQueSeparan(lista) {
    const usadas = [];
    let distintas = 1;
    for (const k of CLAVES_GEO) {
      if (lista.some((p) => typeof p[k] !== "number")) continue;
      const n = new Set(lista.map((p) => firma(p, usadas.concat(k)))).size;
      if (n <= distintas) continue;
      usadas.push(k);
      distintas = n;
      if (distintas === lista.length) return usadas;
    }
    return usadas;   /* no separan del todo: se avisa abajo */
  }

  homonimos.forEach((lista, nombre) => {
    if (lista.length === 1) {
      lista[0].id = nombre;
      porId.set(nombre, lista[0]);
      return;
    }
    const claves = clavesQueSeparan(lista);
    for (const p of lista) p.id = nombre + "·" + firma(p, claves);

    /* Dos filas idénticas en toda la geometría no son dos perfiles: es el
       catálogo de origen repitiendo una.  No se elige una en silencio. */
    if (new Set(lista.map((p) => p.id)).size !== lista.length) {
      avisos.push({ perfil: nombre, catalogo: lista[0].catalogo,
        idNoUnico: true, cuantos: lista.length,
        nota: "filas con la misma designación y la misma geometría" });
      lista.forEach((p, i) => { p.id = nombre + "·" + (i + 1); });
    }
    for (const p of lista) porId.set(p.id, p);
    ambiguos.set(nombre, lista);
  });

  /* ---------- consultas ------------------------------------------------ */

  function busca(clave) {
    /* Por id único primero: es lo que devuelve la interfaz cuando el usuario
       ya desambiguó. */
    if (porId.has(clave)) return porId.get(clave);

    /* Cuando hay colisión NO se elige por cuenta propia: se lanza con las
       opciones y su geometría.  Devolver una de dos secciones distintas en
       silencio es de las peores cosas que puede hacer un catálogo.

       El detalle se imprime con los campos QUE EXISTAN: un ángulo Precor no
       tiene bf ni tw, y la versión anterior de este mensaje reventaba con un
       TypeError justo cuando hacía falta que se leyera. */
    if (ambiguos.has(clave)) {
      const lista = ambiguos.get(clave);
      throw new Error(
        "perfiles: «" + clave + "» designa " + lista.length + " secciones distintas.\n" +
        lista.map((x) => "    " + x.id + "   " + CLAVES_GEO
          .filter((k) => typeof x[k] === "number")
          .map((k) => k.replace(/_cm\d?$/, "") + "=" + x[k].toFixed(2))
          .join(" · ")).join("\n") + "\n" +
        "  Dos geometrías distintas pueden compartir designación —la NBR 5884\n" +
        "  designa por peralte y peso—. Elige por su id.");
    }
    throw new Error(
      "perfiles: «" + clave + "» no está en el catálogo.\n" +
      "  Hay " + todos.length + " perfiles cargados. Comprueba el nombre, o\n" +
      "  defínelo con propiedades.Iarmada() si es una sección a medida.");
  }

  /* Las designaciones compartidas por más de una sección. La interfaz las
     necesita para presentar la elección en vez de esconderla. */
  function ambiguas() {
    const out = [];
    ambiguos.forEach((lista, nombre) => out.push({ nombre, ids: lista.map((x) => x.id) }));
    return out;
  }

  /* Acepta familia («C», y entonces salen las dos fabricaciones) o grupo
     («laminado:C», y sale solo esa).  Pedir «C» y recibir las dos mezcladas
     es correcto solo si quien pregunta sabe que están mezcladas; pedir el
     grupo es la forma de no tener que saberlo. */
  function coincide(p, clave) {
    return !clave || p.grupo === clave || p.familia === clave;
  }

  /* Solo los que se pueden usar hoy.  Es lo que ve la interfaz por defecto. */
  function activos(clave) {
    return todos.filter((p) => p.estado === "activo" && coincide(p, clave));
  }

  /* Todos, incluidos los que esperan a la fase 2.  La interfaz los muestra
     deshabilitados con su motivo: que se vean es parte de la decisión. */
  function catalogo(clave) {
    return clave ? todos.filter((p) => coincide(p, clave)) : todos.slice();
  }

  function familias() {
    const s = new Set();
    for (const p of todos) s.add(p.familia);
    return Array.from(s).sort();
  }

  /* Las familias sin ambigüedad: fabricación + letra.  Es lo que la interfaz
     tiene que listar, porque «C» sola no identifica una sección. */
  function grupos() {
    const s = new Set();
    for (const p of todos) s.add(p.grupo);
    return Array.from(s).sort();
  }

  /* Las letras que significan dos secciones distintas según el catálogo. */
  function familiasEnConflicto() {
    const m = new Map();
    for (const p of todos) {
      m.has(p.familia) || m.set(p.familia, new Set());
      m.get(p.familia).add(p.fabricacion);
    }
    const out = [];
    m.forEach((fabs, fam) => {
      if (fabs.size > 1) out.push({ familia: fam, fabricaciones: Array.from(fabs).sort() });
    });
    return out.sort((a, b) => (a.familia < b.familia ? -1 : 1));
  }

  /* Un perfil en espera se puede CONSULTAR pero no usar en un cálculo: la
     especificación que lo gobierna todavía no está implementada. */
  function paraCalcular(nombre) {
    const p = busca(nombre);
    if (p.estado !== "activo") {
      throw new Error(
        "perfiles: «" + nombre + "» está en espera y no se puede calcular todavía.\n" +
        "  " + (p.motivo || "") + "\n" +
        "  Está en el catálogo a propósito: se ve, se elige, y el día que exista\n" +
        "  el motor que lo gobierna se activa sin tocar nada más.");
    }
    return p;
  }

  function resumen() {
    const r = { total: todos.length, activos: 0, espera: 0, porFamilia: {}, porCatalogo: {} };
    for (const p of todos) {
      if (p.estado === "activo") r.activos++; else r.espera++;
      r.porFamilia[p.familia] = (r.porFamilia[p.familia] || 0) + 1;
      r.porCatalogo[p.catalogo] = (r.porCatalogo[p.catalogo] || 0) + 1;
    }
    return r;
  }

  return { ART, busca, paraCalcular, activos, catalogo, familias, grupos,
           familiasEnConflicto, resumen, ambiguas, avisos, todos };
});
