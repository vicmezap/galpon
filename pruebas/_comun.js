/* =====================================================================
   _comun.js — el mínimo para escribir una prueba

   Sin framework a propósito.  Una prueba es un archivo que compara valores
   y al final imprime cuántas cuadraron.  El runner lee ese conteo.

   No empieza por «probar_» para que correr.js no intente ejecutarlo.
   ===================================================================== */
"use strict";

let ok = 0;
const mal = [];

/* Compara valores simples o estructuras.  Se serializa para poder comparar
   arrays y objetos sin traer una librería. */
function comp(titulo, obtenido, esperado) {
  const a = JSON.stringify(obtenido), b = JSON.stringify(esperado);
  if (a === b) ok++;
  else mal.push(titulo + "\n        obtenido: " + a + "\n        esperado: " + b);
}

/* Números con tolerancia.  La mayoría de lo que comprobamos son cálculos:
   comparar flotantes por igualdad exacta es pedir fallos falsos. */
function cerca(titulo, obtenido, esperado, tol) {
  tol = tol === undefined ? 1e-9 : tol;
  const d = Math.abs(obtenido - esperado);
  const rel = Math.abs(esperado) > 1e-12 ? d / Math.abs(esperado) : d;
  if (rel <= tol) ok++;
  else mal.push(titulo + "\n        obtenido: " + obtenido +
    "\n        esperado: " + esperado + "  (dif. relativa " + rel.toExponential(2) + ")");
}

function cierto(titulo, cond) { comp(titulo, !!cond, true); }

/* Comprueba que algo LANZA, y opcionalmente que el mensaje dice lo que debe.
   Importa tanto como comprobar que algo funciona: media parte de este
   proyecto consiste en parar a tiempo. */
function lanza(titulo, fn, fragmento) {
  let salto = false, msg = "";
  try { fn(); } catch (e) { salto = true; msg = e.message || String(e); }
  if (!salto) { mal.push(titulo + "\n        no lanzó, y debía"); return; }
  if (fragmento && msg.indexOf(fragmento) < 0) {
    mal.push(titulo + "\n        lanzó, pero el mensaje no menciona «" + fragmento + "»" +
      "\n        mensaje: " + msg.split("\n")[0]);
    return;
  }
  ok++;
}

function fin() {
  console.log("");
  console.log("  comprobaciones correctas: " + ok + "   fallidas: " + mal.length);
  mal.forEach((x) => console.log("   FALLO " + x));
  if (mal.length) process.exitCode = 1;
}

module.exports = { comp, cerca, cierto, lanza, fin };
