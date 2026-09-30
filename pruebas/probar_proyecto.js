/* =====================================================================
   probar_proyecto.js

   Lo que se comprueba no es que guarde: es que ABRA lo que guardó, que
   diga POR QUÉ cuando no puede, y que no deje colar una combinación de
   cargas por la puerta de atrás.
   ===================================================================== */
"use strict";
const { comp, cierto, lanza, fin } = require("./_comun.js");
const P = require("../src/proyecto.js");

/* ---------- nuevo ------------------------------------------------------ */
const p = P.nuevo("Almacén de prueba");
comp("lleva la versión del esquema", p.esquema, P.ESQUEMA);
comp("y el nombre que se le dio", p.nombre, "Almacén de prueba");
cierto("tiene las secciones de los pasos", !!(p.sitio && p.materiales && p.geometria && p.cargas));
comp("los casos de carga nacen vacíos y son los siete de la E.090",
  Object.keys(p.cargas).sort(), ["D", "E", "L", "Lr", "R", "S", "W"]);

/* ---------- ida y vuelta ----------------------------------------------- */
p.sitio.V_kmh = 75;
p.materiales.acero.Fy_kgcm2 = 2530;
p.geometria.luz_m = 20;
p.geometria.tipologia = "tijeral";

const r = P.deTexto(P.aTexto(p));
cierto("un proyecto guardado se vuelve a abrir", r.ok);
comp("con su velocidad de viento", r.proyecto.sitio.V_kmh, 75);
comp("su Fy", r.proyecto.materiales.acero.Fy_kgcm2, 2530);
comp("su luz", r.proyecto.geometria.luz_m, 20);
comp("y su tipología", r.proyecto.geometria.tipologia, "tijeral");

/* ---------- los errores dicen qué pasó --------------------------------- */
const malos = [
  ["texto que no es JSON", "esto no es json {", "no es JSON válido"],
  ["JSON que no es un proyecto", "42", "no contiene un proyecto"],
  ["proyecto sin versión de esquema", '{"sitio":{}}', "no dice con qué versión"],
  ["proyecto de una versión futura", '{"esquema":99}', "versión más nueva"],
  ["proyecto al que le faltan secciones", '{"esquema":1}', "le faltan secciones"]
];
for (const [titulo, txt, fragmento] of malos) {
  const x = P.deTexto(txt);
  cierto("rechaza: " + titulo, x.ok === false);
  cierto("  y explica por qué (" + fragmento + ")", x.msg.indexOf(fragmento) >= 0);
}

/* ---------- la regla que viene del inventario -------------------------- */
/* Fila Z.costura: el acero y el concreto usan factores de carga distintos,
   así que el proyecto guarda CASOS y cada norma arma sus combinaciones. */
P.agregaCarga(p, "W", { barra: 3, w_kgfm2: -120, dir: "normal" });
comp("un caso válido se agrega", p.cargas.W.length, 1);

lanza("una COMBINACIÓN no se puede guardar como si fuera un caso",
  () => P.agregaCarga(p, "1.2D+1.3W", { q: 1 }), "no es un caso de carga");
lanza("y el mensaje explica por qué",
  () => P.agregaCarga(p, "U1", { q: 1 }), "cada una arma los suyos");

fin();
