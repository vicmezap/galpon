/* =====================================================================
   probar_combinaciones.js — la costura entre el acero y el concreto

   Esta prueba no comprueba sobre todo que los factores sean los de la
   norma: comprueba QUE LAS DOS FAMILIAS SON DISTINTAS y que no hay forma
   de confundirlas.  Es el error de la fila J.costura, y es el peor de los
   que puede cometer este complemento porque ningún resultado lo delata:
   los números salen, las unidades cuadran, y la zapata queda mal.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const C = require("../src/combinaciones.js");
const E020 = require("../src/e020.js");

const TODO = { D: true, L: true, Lr: true, S: true, W: true, E: true };

/* ---------- LA COSTURA, medida ----------------------------------------- */
/* Los mismos casos, las dos normas, y los factores NO coinciden. */
const ac = C.paraAcero({ casos: { D: true, L: true } });
const co = C.paraConcreto({ casos: { D: true, L: true } });
const g090 = ac.combinaciones.find((x) => x.id === "1.4-2");
const g060 = co.combinaciones.find((x) => x.id === "9-1");
comp("acero en gravedad · 1,2 D + 1,6 L", g090.texto, "1.2 D + 1.6 L");
comp("concreto en gravedad · 1,4 CM + 1,7 CV", g060.texto, "1.4 CM + 1.7 CV");
cierto("y no son la misma combinación", g090.texto !== g060.texto);
/* Cuánto se equivoca quien reutiliza la del acero para la zapata: en carga
   muerta un 14 % menos, en viva un 6 % menos. */
cerca("reutilizar el 1,2 del acero deja la muerta un 14 % corta", 1 - 1.2 / 1.4, 0.1429, 1e-3);
cerca("y el 1,6 deja la viva un 6 % corta", 1 - 1.6 / 1.7, 0.0588, 1e-3);

/* LA QUE GOBIERNA EL GALPÓN · levantamiento, en las dos normas. */
const up090 = C.paraAcero({ casos: { D: true, W: true } })
  .combinaciones.find((x) => x.id === "1.4-6");
const up060 = C.paraConcreto({ casos: { D: true, W: true } })
  .combinaciones.find((x) => x.id === "9-3−");
comp("acero · 0,9 D − 1,3 W", up090.texto, "0.9 D − 1.3 W");
comp("concreto · 0,9 CM − 1,25 CVi", up060.texto, "0.9 CM − 1.25 CVi");
/* Coinciden en el 0,9 de la muerta y discrepan en el viento: 1,3 contra 1,25. */
cierto("coinciden en el 0,9 sobre la carga muerta",
  up090.terminos[0][1] === up060.terminos[0][1]);
cierto("y discrepan en el viento, 1,3 contra 1,25",
  Math.abs(up090.terminos[1][1]) !== Math.abs(up060.terminos[1][1]));

/* ---------- LA NIEVE · la costura que NO es de factor ------------------ */
/* En el acero la nieve es un CASO con factores propios. En la E.060 §9.2.8
   es carga viva: deja de existir como caso y se lleva el 1,7 de la 9-1. */
const cn = C.paraConcreto({ casos: { D: true, Lr: true, S: true } });
comp("en el concreto la nieve se traduce a CV",
  cn.traduccion.CV.slice().sort().join("+"), "Lr+S");
cierto("y no queda ningún caso S en las combinaciones de concreto",
  cn.combinaciones.every((x) => x.terminos.every(([c]) => c !== "S")));
cierto("pero en el acero sí lo hay",
  C.paraAcero({ casos: TODO }).combinaciones
    .some((x) => x.terminos.some(([c]) => c === "S")));
comp("el mapa lo dice: S va a CV", C.MAPA_E060.S, "CV");
comp("y Lr también", C.MAPA_E060.Lr, "CV");
comp("D va a CM", C.MAPA_E060.D, "CM");
comp("W va a CVi", C.MAPA_E060.W, "CVi");
comp("E va a CS", C.MAPA_E060.E, "CS");

/* ---------- el factor de CS es 1,0 y el de CVi 1,25 · U060.CS ---------- */
const cs = C.paraConcreto({ casos: { D: true, E: true } })
  .combinaciones.find((x) => x.id === "9-5+");
const cvi = C.paraConcreto({ casos: { D: true, W: true } })
  .combinaciones.find((x) => x.id === "9-3+");
comp("CS entra con 1,0", Math.abs(cs.terminos[1][1]), 1.0);
comp("CVi entra con 1,25", Math.abs(cvi.terminos[1][1]), 1.25);
cierto("son distintos a propósito", Math.abs(cs.terminos[1][1]) !== Math.abs(cvi.terminos[1][1]));

/* ---------- los grupos «ó» se expanden, no se promedian ---------------- */
/* «0,5 (Lr ó S ó R)» es una elección, y cada rama da un estado de carga
   distinto: la nieve desbalanceada carga un faldón y la viva de techo los
   dos. Así que salen combinaciones separadas. */
const dos = C.paraAcero({ casos: { D: true, L: true, Lr: true, S: true } });
const c142 = dos.combinaciones.filter((x) => x.id === "1.4-2");
comp("con Lr y S presentes, la 1.4-2 se desdobla", c142.length, 2);
cierto("una con Lr y otra con S",
  c142.some((x) => x.terminos.some(([c]) => c === "Lr")) &&
  c142.some((x) => x.terminos.some(([c]) => c === "S")));
comp("con solo Lr, una sola",
  C.paraAcero({ casos: { D: true, L: true, Lr: true } })
    .combinaciones.filter((x) => x.id === "1.4-2").length, 1);

/* ---------- la exención de viento y nieve · E.020 Art. 11.1 ------------ */
/* e020.js expone NIEVE_CON_VIENTO = false y este módulo lo LEE, no lo
   vuelve a decidir. */
comp("e020 dice que no son simultáneos", E020.NIEVE_CON_VIENTO, false);
const ex = C.paraAcero({ casos: { D: true, S: true, W: true } });
comp("se descartan dos combinaciones", ex.descartadas.length, 2);
cierto("y son las que juntan W con S",
  ex.descartadas.every((x) =>
    x.terminos.some(([c]) => c === "W") && x.terminos.some(([c]) => c === "S")));
cierto("ninguna combinación viva junta W con S",
  ex.combinaciones.every((x) =>
    !(x.terminos.some(([c]) => c === "W") && x.terminos.some(([c]) => c === "S"))));
cierto("y cada descartada dice por qué y con qué artículo",
  ex.descartadas.every((x) => /Art\. 11\.1/.test(x.motivo) && x.art.length > 0));
/* PERO ES PERMISIVA, NO PROHIBITIVA: la norma dice «no será necesario», no
   «está prohibido». Así que se puede desactivar. */
const sinEx = C.paraAcero({ casos: { D: true, S: true, W: true }, nieveConViento: true });
comp("desactivándola no se descarta nada", sinEx.descartadas.length, 0);
cierto("y reaparecen las combinaciones con W y S",
  sinEx.combinaciones.some((x) =>
    x.terminos.some(([c]) => c === "W") && x.terminos.some(([c]) => c === "S")));
cierto("son dos más que con la exención puesta",
  sinEx.combinaciones.length === ex.combinaciones.length + 2);
/* El sismo SÍ va con la nieve: la exención es solo del viento. */
cierto("la 1.4-5 mantiene el 0,2 S junto al sismo",
  C.paraAcero({ casos: { D: true, E: true, S: true } })
    .combinaciones.some((x) => x.id === "1.4-5" &&
      x.terminos.some(([c, f]) => c === "S" && f === 0.2)));

/* ---------- el factor de L a 1,0 · fila U.L1 --------------------------- */
comp("el umbral es 4800 Pa", C.L1_UMBRAL_PA, 4800);
const baja = C.paraAcero({ casos: { D: true, L: true, Lr: true, W: true } });
const alta = C.paraAcero({ casos: { D: true, L: true, Lr: true, W: true }, vivaAlta_Pa: 5000 });
cierto("con viva normal, la 1.4-4 lleva 0,5 L",
  baja.combinaciones.find((x) => x.id === "1.4-4")
    .terminos.some(([c, f]) => c === "L" && f === 0.5));
cierto("con viva mayor a 4800 Pa, la 1.4-4 lleva 1,0 L",
  alta.combinaciones.find((x) => x.id === "1.4-4")
    .terminos.some(([c, f]) => c === "L" && f === 1.0));
cierto("pero la 1.4-2 no cambia: su L ya iba a 1,6",
  alta.combinaciones.find((x) => x.id === "1.4-2")
    .terminos.some(([c, f]) => c === "L" && f === 1.6));
comp("las tres afectadas son 1.4-3, 1.4-4 y 1.4-5", C.CON_L1.join(","), "1.4-3,1.4-4,1.4-5");

/* ---------- combinaciones que no se generan sin su caso ---------------- */
const soloD = C.paraAcero({ casos: { D: true } });
comp("con solo carga muerta sale una sola combinación", soloD.combinaciones.length, 1);
comp("y es 1.4 D", soloD.combinaciones[0].texto, "1.4 D");
cierto("sin viento no hay 1.4-6",
  !C.paraAcero({ casos: { D: true, E: true } }).combinaciones.some((x) => x.id === "1.4-6"));
cierto("sin sismo no hay 1.4-5",
  !C.paraAcero({ casos: { D: true, W: true } }).combinaciones.some((x) => x.id === "1.4-5"));
cierto("sin empuje de suelos no hay 9-6 ni 9-7",
  !C.paraConcreto({ casos: { D: true, L: true } })
    .combinaciones.some((x) => x.id === "9-6" || x.id === "9-7"));
cierto("con CE sí aparecen",
  C.paraConcreto({ casos: { D: true, L: true, CE: true } })
    .combinaciones.filter((x) => x.id === "9-6" || x.id === "9-7").length === 2);

/* ---------- los ± del concreto se generan los dos --------------------- */
const pm = C.paraConcreto({ casos: { D: true, L: true, W: true } });
cierto("la 9-2 sale con los dos signos",
  pm.combinaciones.filter((x) => x.id.indexOf("9-2") === 0).length === 2);
cierto("y la 9-3 también",
  pm.combinaciones.filter((x) => x.id.indexOf("9-3") === 0).length === 2);
/* La 9-1, 9-6 y 9-7 no llevan ±: comprobado a nivel de glífico en el PDF. */
comp("la 9-1 sale una sola vez",
  pm.combinaciones.filter((x) => x.id.indexOf("9-1") === 0).length, 1);

/* ---------- LA GUARDA · lo que este módulo existe para impedir --------- */
cierto("una reacción sin factorizar pasa", C.exigeSinFactorizar({ N_kgf: 1000 }) === true);
lanza("una reacción que viene de una combinación PARA",
  () => C.exigeSinFactorizar({ N_kgf: 1000, combinacion: "1.4-6" }), "CASOS sin factorizar");
lanza("y el mensaje nombra las dos familias",
  () => C.exigeSinFactorizar({ combinacion: "1.4-2" }), "1,25 CVi");
/* Y no se aceptan casos inventados. */
lanza("un caso de carga que no existe PARA",
  () => C.paraAcero({ casos: { D: true, X: true } }), "no es un caso de carga");
lanza("sin pasar casos PARA",
  () => C.paraAcero({}), "casos presentes");

/* ---------- las citas viajan ------------------------------------------- */
cierto("cada combinación trae su artículo",
  ac.combinaciones.every((x) => x.art && x.art.length > 0) &&
  co.combinaciones.every((x) => x.art && x.art.length > 0));
cierto("y la familia entera cita J.costura", ac.art.indexOf("E.090") >= 0 ||
  ac.art.indexOf("E.060") >= 0);

fin();
