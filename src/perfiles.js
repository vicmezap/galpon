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
    "PROP.fabricacion", "PROP.unidad", "MAT.admitidos"
  ]);

  /* Por qué un perfil puede estar en espera, dicho para que se muestre. */
  const MOTIVO_ESPERA = {
    AISI: "requiere el motor AISI S100 · fase 2 (conformado en frío)"
  };

  const porNombre = new Map();
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
      if (porNombre.has(p.nombre)) {
        avisos.push({ perfil: p.nombre, catalogo: cat.catalogo, repetido: true });
      } else {
        porNombre.set(p.nombre, p);
        todos.push(p);
      }
    }
  }

  /* ---------- consultas ------------------------------------------------ */

  function busca(nombre) {
    const p = porNombre.get(nombre);
    if (!p) {
      throw new Error(
        "perfiles: «" + nombre + "» no está en el catálogo.\n" +
        "  Hay " + todos.length + " perfiles cargados. Comprueba el nombre, o\n" +
        "  defínelo con propiedades.Iarmada() si es una sección a medida.");
    }
    return p;
  }

  /* Solo los que se pueden usar hoy.  Es lo que ve la interfaz por defecto. */
  function activos(familia) {
    return todos.filter((p) => p.estado === "activo" && (!familia || p.familia === familia));
  }

  /* Todos, incluidos los que esperan a la fase 2.  La interfaz los muestra
     deshabilitados con su motivo: que se vean es parte de la decisión. */
  function catalogo(familia) {
    return familia ? todos.filter((p) => p.familia === familia) : todos.slice();
  }

  function familias() {
    const s = new Set();
    for (const p of todos) s.add(p.familia);
    return Array.from(s).sort();
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

  return { ART, busca, paraCalcular, activos, catalogo, familias, resumen, avisos, todos };
});
