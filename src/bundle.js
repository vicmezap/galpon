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

/* LOS DIRECTORIOS DE SALIDA, y son dos porque hoy solo existe el segundo.
   Esta guarda estuvo DORMIDA desde el primer commit: vigilaba solo
   complemento/, que lo produciría gen_complemento.py, un script que entonces no
   existía. Al no haber nada generado, estado() contestaba siempre «todavía no
   se ha generado el complemento» y la guarda no podía delatar nada.  Peor:
   cuando apareció el visor —que SÍ se genera y SÍ se puede quedar rancio—
   seguía sin verlo, así que se podía publicar una página que no corresponde al
   código.  Justo el fallo que este archivo existe para impedir.

   Desde E6c el script existe y las dos salidas se vigilan de verdad.  LA
   COMPARACIÓN ES GRUESA A PROPÓSITO: el generado más viejo contra la fuente
   más nueva, por directorios enteros.  Eso hace que tocar la plantilla del
   complemento deje rancio también al visor, que no la usa.  Es un falso
   positivo y cuesta un comando; el falso negativo costaría publicar una
   página que no corresponde al código.  Por eso el comando es UNO solo:
   scripts/hornear.py los corre los tres en orden. */
const SALIDAS = [
  path.join(RAIZ, "visor"),        /* gen_visor.py · el banco de cargas */
  path.join(RAIZ, "complemento")   /* gen_complemento.py · el add-in de Excel */
];
const SALIDA = SALIDAS[0];

/* Todo lo que entra en el bundle.  Directorios completos, no nombres. */
function fuentes() {
  const dirs = [
    path.join(RAIZ, "src"),
    path.join(RAIZ, "inventario"),
    path.join(RAIZ, "catalogos"),
    path.join(RAIZ, "catalogos", "coberturas"),
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

/* Todo lo publicable que producen los generadores, en los dos directorios. */
function generados() {
  const out = [];
  for (const d of SALIDAS) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (/\.(html|xml)$/.test(f)) out.push(path.join(d, f));
    }
  }
  return out;
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
      "bundle: no hay nada generado todavía.\n" +
      "  Ejecuta:  python scripts/hornear.py");
  }
  if (!e.alDia) {
    throw new Error(
      "bundle: LO GENERADO ESTÁ RANCIO.\n" +
      "  " + e.motivo + "\n" +
      "  Lo que estás mirando no es lo que acabas de escribir.\n" +
      "  Ejecuta:  python scripts/hornear.py");
  }
  return true;
}

module.exports = { fuentes, generados, estado, alDiaOMuere, RAIZ, SALIDA, SALIDAS };
