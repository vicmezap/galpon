/* =====================================================================
   bundle.js — ¿ESTOY PROBANDO LO QUE ACABO DE ESCRIBIR?

   Heredado de Retícula, donde nació a golpes.  Allá pasó esto, dos veces
   en un mismo día: se edita un módulo, no se regenera el bundle, y la
   prueba corre contra el generado VIEJO.  Sale verde comprobando código
   que ya no existe, o sale roja por algo que ya está arreglado.  Las dos
   formas de fallar son peores que no tener prueba.

   Aquí la guarda existe desde el primer commit, que es la mejora concreta
   que Retícula no tuvo.

   Se pregunta lo único que hay que preguntarse antes de creerse un
   resultado: ¿el generado es POSTERIOR a todo lo que lo genera?

       const BUNDLE = require("./bundle.js");
       BUNDLE.alDiaOMuere();       // aborta con instrucciones si está rancio

   La lista de fuentes es UN DIRECTORIO ENTERO, no una enumeración a mano.
   Una lista a mano se pudre: el día que se añade un módulo y nadie se
   acuerda de apuntarlo, la guarda deja de proteger de él y nadie se entera.
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const SALIDA = path.join(RAIZ, "complemento");

/* Todo lo que entra en el bundle.  Directorios completos, no nombres. */
function fuentes() {
  const dirs = [
    path.join(RAIZ, "src"),
    path.join(RAIZ, "inventario"),
    path.join(RAIZ, "scripts")
  ];
  const out = [];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (/\.(js|json|py|html)$/.test(f)) out.push(path.join(d, f));
    }
  }
  return out;
}

/* Los archivos publicables que produce gen_complemento.py */
function generados() {
  if (!fs.existsSync(SALIDA)) return [];
  return fs.readdirSync(SALIDA)
    .filter((f) => /\.(html|xml)$/.test(f))
    .map((f) => path.join(SALIDA, f));
}

function mtime(f) { return fs.statSync(f).mtimeMs; }

/* Devuelve el estado sin abortar, por si alguien quiere decidir él. */
function estado() {
  const gen = generados();
  if (!gen.length) {
    return { hayBundle: false, alDia: false, motivo: "todavía no se ha generado el complemento" };
  }
  const masNuevoFuente = fuentes().reduce(
    (acc, f) => (mtime(f) > acc.t ? { t: mtime(f), f } : acc), { t: 0, f: null });
  const masViejoGenerado = gen.reduce(
    (acc, f) => (mtime(f) < acc.t ? { t: mtime(f), f } : acc), { t: Infinity, f: null });

  const alDia = masViejoGenerado.t >= masNuevoFuente.t;
  return {
    hayBundle: true,
    alDia,
    fuenteMasNueva: masNuevoFuente.f,
    generadoMasViejo: masViejoGenerado.f,
    motivo: alDia ? "" :
      "el generado es ANTERIOR a una fuente: " +
      path.basename(masNuevoFuente.f) + " es más nuevo que " +
      path.basename(masViejoGenerado.f)
  };
}

/* La versión que para.  Es la que se llama desde las pruebas que cargan
   el bundle en vez de los módulos sueltos. */
function alDiaOMuere() {
  const e = estado();
  if (!e.hayBundle) {
    throw new Error(
      "bundle: no hay complemento generado todavía.\n" +
      "  Ejecuta:  python scripts/gen_complemento.py");
  }
  if (!e.alDia) {
    throw new Error(
      "bundle: EL COMPLEMENTO GENERADO ESTÁ RANCIO.\n" +
      "  " + e.motivo + "\n" +
      "  Lo que estás probando no es lo que acabas de escribir.\n" +
      "  Ejecuta:  python scripts/gen_complemento.py");
  }
  return true;
}

module.exports = { fuentes, generados, estado, alDiaOMuere, RAIZ, SALIDA };
