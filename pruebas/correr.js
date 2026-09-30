/* =====================================================================
   correr.js — ejecuta TODAS las pruebas y da un solo veredicto

   Esta es la pieza que Retícula no tiene y que cuesta media hora escribir.
   Allá hay 30 archivos probar_*.js y ninguna forma de correrlos juntos:
   «todo pasa» es una creencia, no un hecho comprobable en diez segundos.

       node pruebas/correr.js

   Descubre los archivos solo —un directorio, no una lista a mano— y cada
   prueba es un proceso aparte: si una revienta con un error no capturado,
   no se lleva a las demás por delante.

   Sale con código 1 si algo falla, que es lo que GitHub Actions mira.
   ===================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const AQUI = __dirname;
const soloEste = process.argv[2] || null;

function archivos() {
  return fs.readdirSync(AQUI)
    .filter((f) => /^probar_.*\.js$/.test(f))
    .filter((f) => !soloEste || f.indexOf(soloEste) >= 0)
    .sort();
}

const lista = archivos();
if (!lista.length) {
  console.error(soloEste
    ? "correr: ninguna prueba coincide con «" + soloEste + "»"
    : "correr: no hay archivos probar_*.js en " + AQUI);
  process.exit(1);
}

console.log("");
console.log("  GALPÓN · pruebas");
console.log("  " + "─".repeat(58));

let okTotal = 0, malTotal = 0;
const rotas = [];

for (const f of lista) {
  const t0 = Date.now();
  let salida = "", codigo = 0;
  try {
    salida = execFileSync(process.execPath, [path.join(AQUI, f)],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    codigo = e.status === undefined ? 1 : e.status;
    salida = (e.stdout || "") + (e.stderr || "");
  }
  const ms = Date.now() - t0;

  /* Cada prueba imprime su propio resumen; aquí se lee el conteo. */
  const m = salida.match(/correctas:\s*(\d+)\s+fallidas:\s*(\d+)/);
  const ok = m ? +m[1] : 0;
  const mal = m ? +m[2] : (codigo ? 1 : 0);
  okTotal += ok; malTotal += mal;

  const nombre = f.replace(/^probar_/, "").replace(/\.js$/, "");
  const marca = codigo === 0 && mal === 0 ? "ok  " : "FALLA";
  console.log("  " + marca + "  " + nombre.padEnd(26) +
    String(ok).padStart(4) + " ok " +
    (mal ? String(mal).padStart(3) + " mal" : "       ") +
    String(ms).padStart(6) + " ms");

  if (codigo !== 0 || mal > 0) rotas.push({ f, salida });
}

console.log("  " + "─".repeat(58));
console.log("  " + lista.length + " archivo(s) · " + okTotal + " comprobaciones correctas · " +
  malTotal + " fallidas");

if (rotas.length) {
  console.log("");
  for (const r of rotas) {
    console.log("  ══ " + r.f + " ".repeat(Math.max(0, 50 - r.f.length)) + "══");
    console.log(r.salida.split("\n").map((l) => "     " + l).join("\n"));
  }
  console.log("  " + rotas.length + " archivo(s) con fallos.");
  process.exit(1);
}

console.log("  todo en orden.");
console.log("");
