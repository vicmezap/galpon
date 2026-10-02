/* =====================================================================
   probar_ubicacion.js — el Anexo II de la E.030-2026, por distrito

   distritos.js es GENERADO del PDF (scripts/genera_distritos.py), que ya
   cuenta cada grupo contra su ÁMBITO. Aquí se fija lo que salió, para que
   una regeneración que cambie algo no pase callada.
   ===================================================================== */
"use strict";

const { comp, cierto, fin } = require("./_comun.js");
const D = require("../src/distritos.js");
const U = require("../src/ubicacion.js");
const INV = require("../src/inventario.js");

comp("la fila que cita existe", Object.keys(U.ART).filter((id) => !INV.existe(id)), []);
comp("1892 distritos", D.length, 1892);
comp("25 departamentos, con el Callao, y 196 provincias",
  [new Set(D.map((f) => f[0])).size, new Set(D.map((f) => f[0] + "|" + f[1])).size], [25, 196]);
const cuenta = (z) => D.filter((f) => f[3] === z).length;
comp("por zona: 32 · 696 · 799 · 365", [1, 2, 3, 4].map(cuenta), [32, 696, 799, 365]);
comp("ninguno repetido", new Set(D.map(U.clave)).size, D.length);
const z = (k) => U.zona(k);
comp("la costa central es zona 4, la selva baja zona 1 ó 2",
  [z("LIMA › LIMA · MIRAFLORES"), z("CALLAO › CALLAO · CALLAO"), z("MADRE DE DIOS › TAMBOPATA · TAMBOPATA"),
    z("UCAYALI › CORONEL PORTILLO · CALLERIA")], ["Z4", "Z4", "Z1", "Z2"]);
comp("LOS CINCO QUE V1.xlsm (y Retícula) TIENE EN ZONA 4 Y LA E.030-2026 EN 3 (página 40)",
  ["ÁNCASH › AIJA · HUACLLÁN", "ÁNCASH › AIJA · LA MERCED", "ÁNCASH › AIJA · SUCCHA", "ÁNCASH › OCROS · OCROS",
    "ÁNCASH › OCROS · SANTIAGO DE CHILCAS"].map(z), ["Z3", "Z3", "Z3", "Z3", "Z3"]);
comp("y en Ocros, Cochas y San Pedro sí son zona 4", [z("ÁNCASH › OCROS · COCHAS"), z("ÁNCASH › OCROS · SAN PEDRO")], ["Z4", "Z4"]);
comp("Yauyos: 30 en zona 3 aunque la norma diga «VEINTINUEVE», y 3 en zona 4",
  [D.filter((f) => f[1] === "YAUYOS" && f[3] === 3).length, D.filter((f) => f[1] === "YAUYOS" && f[3] === 4).length], [30, 3]);
comp("sin texto, el buscador no devuelve 1892 opciones", U.buscar(""), []);
cierto("y nunca más de las que se le piden", U.buscar("a", 25).length === 25);
comp("un distrito que no existe no tiene zona", U.zona("LIMA › LIMA · NARNIA"), null);
cierto("la etiqueta dice la zona", /— zona 4$/.test(U.etiqueta("LIMA › LIMA · MIRAFLORES")));

fin();
