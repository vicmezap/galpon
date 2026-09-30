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

/* ---------- LA GUARDA ESTABA DORMIDA ----------------------------------
   Vigilaba solo complemento/, que lo produciría gen_complemento.py: un script
   que nunca se escribió.  Así que estado() contestaba siempre «todavía no hay
   nada generado» y esta prueba se iba por la rama de arriba, que NO comprueba
   nada del mecanismo.  Doce comprobaciones en verde sobre una guarda que no
   podía delatar nada.

   Ahora vigila también visor/, que sí se genera.  Y esta prueba EXIGE que lo
   generado esté al día, así que el gancho de pre-commit rechaza un commit que
   toque un módulo sin regenerar el visor: la página publicada y el código no
   se pueden separar. */
const e = B.estado();
cierto("hay algo generado que vigilar", e.hayBundle === true);
comp("y está AL DÍA · si esto falla: python scripts/gen_visor.py", e.alDia, true);
comp("sin motivo de queja", e.motivo, "");

/* Y muerde de verdad: se toca un fuente y el veredicto cambia. */
const fuente = path.join(B.RAIZ, "src", "e020.js");
const antes = fs.statSync(fuente);
const gen = B.generados()[0];
const futuro = new Date(fs.statSync(gen).mtimeMs + 5000);
fs.utimesSync(fuente, futuro, futuro);
try {
  const r = B.estado();
  comp("con una fuente más nueva, lo declara rancio", r.alDia, false);
  cierto("y nombra la fuente que lo delata", /e020\.js/.test(r.motivo));
  lanza("y al exigirlo, para con instrucciones",
    () => B.alDiaOMuere(), "gen_visor.py");
} finally {
  fs.utimesSync(fuente, antes.atime, antes.mtime);
}
comp("y al restaurar la fecha vuelve a estar al día", B.estado().alDia, true);

fin();
