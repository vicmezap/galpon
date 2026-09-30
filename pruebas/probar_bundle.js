/* =====================================================================
   probar_bundle.js

   La guarda que avisa de que el complemento generado está rancio tiene
   que probarse ella misma — si no, es una guarda en la que confiamos sin
   motivo.

   Todavía no hay complemento generado (eso llega con gen_complemento.py
   en la etapa E6), así que lo que se comprueba hoy es:
     · que reconoce que no hay bundle y lo dice con instrucciones
     · que la lista de fuentes es un DIRECTORIO, no una enumeración: si
       mañana aparece un módulo nuevo, la guarda lo ve sin que nadie la
       edite.  Esa es la única razón de que exista así.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { comp, cierto, lanza, fin } = require("./_comun.js");
const B = require("../src/bundle.js");

/* ---------- las fuentes salen de recorrer directorios ----------------- */
const f = B.fuentes();
cierto("encuentra fuentes", f.length > 0);

const nombres = f.map((x) => path.basename(x));
for (const esperado of ["inventario.js", "unidades.js", "proyecto.js", "bundle.js"]) {
  cierto("vigila " + esperado, nombres.indexOf(esperado) >= 0);
}
for (const esperado of ["cargas.json", "sismo.json", "cimentacion.json"]) {
  cierto("vigila el inventario: " + esperado, nombres.indexOf(esperado) >= 0);
}

/* LA COMPROBACIÓN QUE IMPORTA: la lista es el contenido real del directorio.
   Se cuentan los .js de src/ y tienen que estar todos, sin excepción. */
const enDisco = fs.readdirSync(path.join(B.RAIZ, "src")).filter((x) => x.endsWith(".js"));
const vigilados = nombres.filter((x) => enDisco.indexOf(x) >= 0);
comp("vigila TODOS los módulos de src/, no una lista a mano",
  vigilados.sort(), enDisco.sort());

/* ---------- sin bundle generado --------------------------------------- */
const e = B.estado();
if (!e.hayBundle) {
  comp("sabe que todavía no hay complemento generado", e.hayBundle, false);
  comp("y no lo da por al día", e.alDia, false);
  lanza("y al exigirlo, para con instrucciones",
    () => B.alDiaOMuere(), "gen_complemento.py");
} else {
  /* Si alguien ya generó, la guarda tiene que ser capaz de decidir. */
  cierto("con bundle presente, emite un veredicto",
    e.alDia === true || e.alDia === false);
  if (!e.alDia) cierto("y si está rancio, dice cuál fuente lo delata", !!e.motivo);
}

fin();
