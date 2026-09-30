/* =====================================================================
   probar_generador.js — el tijeral paramétrico

   Tres cosas se comprueban aquí y solo la primera es «que funcione»:

   1) que la Howe que sale del generador sea EXACTAMENTE la que tijeral.js
      tenía escrita a mano, nudo por nudo y barra por barra.  Es la única
      verificación externa disponible: esa geometría ya pasó E5 entera.

   2) que el conteo de Maxwell se equivoque y el rango lo cace.  Con un
      contraejemplo construido: misma b, misma j, misma r, mismo grado, y
      mecanismo.  Si esta prueba pasara sola, la guarda no serviría.

   3) cuánto vale de verdad elegir bien el alma, midiendo la ENVOLVENTE de
      gravedad y levantamiento en vez de solo la gravedad, que es de donde
      sale la regla de los libros.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const G = require("../src/generador.js");
const T = require("../src/tijeral.js");
const M = require("../src/modelo.js");
const S = require("../src/solver.js");
const INV = require("../src/inventario.js");

const BASE = { luz_m: 20, peralteApoyo_m: 1.2, pendiente: 0.20 };
const g = (extra) => G.genera(Object.assign({}, BASE, extra));

/* ================================================================
   1 · LAS DIECISÉIS
   ================================================================ */
comp("cuatro cuerdas por cuatro almas son dieciséis tipologías", G.tipos().length, 16);
comp("las cuerdas son las cuatro previstas", Object.keys(G.CUERDAS).sort(),
  ["dos_aguas", "paralelos", "tijera", "un_agua"]);
comp("las almas son las cuatro de Neufert", Object.keys(G.ALMAS).sort(),
  ["howe", "pratt", "warren", "warren_montantes"]);

/* Cada alma cita la lámina de Neufert de la que sale su nombre. */
for (const a of Object.keys(G.ALMAS)) {
  cierto("el alma «" + a + "» cita su forma en Neufert",
    typeof G.ALMAS[a].neufert === "string" && G.ALMAS[a].neufert.length > 10);
}

/* LAS DIECISÉIS SE GENERAN Y LAS DIECISÉIS PASAN EL RANGO.  No es un
   trámite: cada combinación arma su K y la resuelve. */
let generadas = 0, conRango = 0;
for (const cu of Object.keys(G.CUERDAS)) {
  for (const al of Object.keys(G.ALMAS)) {
    const geo = g({ cuerdas: cu, alma: al, paneles: 6, pendienteInferior: 0.08 });
    generadas++;
    if (geo.rango && geo.rango.verificado) conRango++;
  }
}
comp("las dieciséis se generan", generadas, 16);
comp("y las dieciséis quedan autorizadas POR EL RANGO, no por el conteo", conRango, 16);

/* ================================================================
   2 · LA VERIFICACIÓN EXTERNA: reproducir lo que ya pasó E5
   ================================================================ */
const gen = g({ cuerdas: "dos_aguas", alma: "howe", paneles: 6 });
const man = T.geometria({ luz_m: 20, paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20 });

const clavesNudo = (a) => a.map((x) =>
  x.id + "|" + x.x_m.toFixed(9) + "|" + x.y_m.toFixed(9) + "|" + x.clase).sort();
const clavesBarra = (a) => a.map((x) => x.id + "|" + x.i + "|" + x.j + "|" + x.clase).sort();

comp("la Howe generada tiene los MISMOS nudos que tijeral.js escrito a mano",
  clavesNudo(gen.nudos), clavesNudo(man.nudos));
comp("y las MISMAS barras", clavesBarra(gen.barras), clavesBarra(man.barras));
cerca("y el mismo paso de paño", gen.paso_m, man.paso_m, 1e-12);
cerca("y el mismo peralte en la cumbre", gen.peralteCumbre_m, man.peralteCumbre_m, 1e-12);

/* ================================================================
   3 · EL CONTEO DE MAXWELL · fila G.maxwell
   ================================================================ */
comp("Howe de 6 paños: b, j, r", [gen.conteo.b, gen.conteo.j, gen.conteo.r], [49, 26, 3]);
comp("grado = b + r − 2j = 0", gen.conteo.grado, 0);
comp("veredicto isostática", gen.conteo.veredicto, "isostática");
cierto("una isostática NO acopla el bucle de E5", gen.conteo.fuerzasDependenDeSecciones === false);
cierto("el conteo cita su procedencia", /Maxwell/.test(gen.conteo.art));

/* La Warren pura escalona los nudos, así que con el MISMO parámetro
   `paneles` no es la misma armadura: tiene la mitad de nudos de paño. */
const w6 = g({ cuerdas: "dos_aguas", alma: "warren", paneles: 6 });
comp("Warren con paneles = 6: la mitad de nudos que la Howe",
  [w6.conteo.b, w6.conteo.j], [23, 13]);
comp("y también es isostática", w6.conteo.grado, 0);

/* HIPERESTÁTICA · fila G.hiperestatica.  Una cruz en el paño extremo. */
const conCruz = Object.assign({}, gen, {
  barras: gen.barras.concat([{ id: "D0b", i: "I1", j: "S0", clase: "diagonal", panel: 0 }])
});
const mh = G.maxwell(conCruz);
comp("una cruz de más deja la armadura hiperestática de grado 1", mh.grado, 1);
comp("y el veredicto lo dice", mh.veredicto, "hiperestática");
cierto("Y AVISA DE LO QUE CUESTA: las fuerzas pasan a depender de las secciones",
  mh.fuerzasDependenDeSecciones === true);
cierto("la nota explica que el bucle de E5 se acopla", /acopla/.test(mh.nota));
cierto("una hiperestática sí pasa el rango: es legal, solo cuesta",
  G.compruebaRango(conCruz).verificado === true);

/* MECANISMO POR CONTEO: falta una diagonal y la suma se entera. */
const sinD3 = Object.assign({}, gen, { barras: gen.barras.filter((b) => b.id !== "D3") });
comp("quitando una diagonal el grado se va a −1", G.maxwell(sinD3).grado, -1);
comp("y el veredicto es mecanismo", G.maxwell(sinD3).veredicto, "mecanismo");
lanza("y el rango también se niega", () => G.compruebaRango(sinD3), "MECANISMO");

/* ================================================================
   4 · EL CONTRAEJEMPLO · fila G.rango
   La razón de ser de la comprobación de rango: quito la diagonal del
   paño 1 y pongo una segunda en el paño 4.  b, j y r no se mueven, así
   que el conteo devuelve EXACTAMENTE lo mismo — y es un mecanismo.
   ================================================================ */
const trucado = Object.assign({}, gen, {
  barras: gen.barras.filter((b) => b.id !== "D1")
    .concat([{ id: "D4b", i: "I5", j: "S4", clase: "diagonal", panel: 4 }])
});
const mt = G.maxwell(trucado);
comp("el contraejemplo tiene las mismas b, j, r que la armadura buena",
  [mt.b, mt.j, mt.r], [gen.conteo.b, gen.conteo.j, gen.conteo.r]);
comp("y por tanto el MISMO grado", mt.grado, gen.conteo.grado);
comp("y el conteo lo declara isostática", mt.veredicto, "isostática");
lanza("PERO ES UN MECANISMO, y lo caza el rango",
  () => G.compruebaRango(trucado), "MECANISMO");
lanza("y el mensaje dice por qué el conteo no bastaba",
  () => G.compruebaRango(trucado), "necesario y no suficiente");

/* genera() nunca devuelve algo así, porque no devuelve sin comprobar. */
cierto("genera() deja constancia de que la autorización la dio el rango",
  gen.rango.verificado === true && /rango/.test(gen.rango.art + gen.rango.nota));

/* nudosDebiles() no decide, pero orienta cuando el fallo es de un nudo. */
const suelto = Object.assign({}, gen, {
  nudos: gen.nudos.concat([{ id: "X", x_m: 5, y_m: 9, clase: "superior", panel: 99 }]),
  barras: gen.barras.concat([{ id: "BX", i: "X", j: "S3", clase: "diagonal", panel: 99 }])
});
const flojos = G.nudosDebiles(suelto);
cierto("un nudo colgado de una sola barra sale en nudosDebiles",
  flojos.some((f) => f.nudo === "X"));
comp("y en la armadura buena no hay ninguno", G.nudosDebiles(gen).length, 0);

/* ================================================================
   5 · LO QUE JUSTIFICA EL MÓDULO · fila G.tipologia.signo
   Howe contra Pratt, en gravedad y en levantamiento.
   ================================================================ */
const E = INV.num("MAT.E");
function corre(geo, Pnudo) {
  const m = M.nuevo({ nivel: "LRFD", nombre: "medida" });
  for (const n of geo.nudos) M.nudo(m, { id: n.id, x_m: n.x_m, y_m: n.y_m });
  for (const a of geo.apoyos) M.apoyo(m, a);
  for (const b of geo.barras) {
    M.barraArmadura(m, { id: b.id, i: b.i, j: b.j, A_cm2: 20, I_cm4: 0, E_kgcm2: E });
  }
  for (const n of geo.nudos) {
    if (n.clase === "superior") M.cargaNudo(m, { nudo: n.id, Fy_kgf: Pnudo });
  }
  const r = S.resuelve(m);
  let minN = 0, maxN = 0;
  for (const b of geo.barras) {
    if (b.clase !== "diagonal") continue;
    const N = r.fuerzas[b.id].N_kgf;
    if (N < minN) minN = N;
    if (N > maxN) maxN = N;
  }
  return { compresion: minN, traccion: maxN };
}

const howe = g({ cuerdas: "dos_aguas", alma: "howe", paneles: 6 });
const pratt = g({ cuerdas: "dos_aguas", alma: "pratt", paneles: 6 });

const hG = corre(howe, -2000), hU = corre(howe, +1400);
const pG = corre(pratt, -2000), pU = corre(pratt, +1400);

cerca("Howe · gravedad · la diagonal larga se COMPRIME", hG.compresion, -16247, 2e-3);
cerca("Pratt · gravedad · la diagonal larga se TRACCIONA", pG.traccion, 14733, 2e-3);
cerca("Pratt · gravedad · apenas hay compresión de diagonal", pG.compresion, -3181, 2e-3);
cierto("bajo gravedad la Pratt comprime mucho menos que la Howe",
  Math.abs(pG.compresion) < Math.abs(hG.compresion));

/* Y BAJO LEVANTAMIENTO SE INVIERTE, que es lo que la regla del libro no
   contempla porque nace de techos que gobierna la gravedad. */
cerca("Howe · levantamiento · casi no se comprime", hU.compresion, -2423, 2e-3);
cerca("Pratt · levantamiento · AHORA SE COMPRIME ELLA", pU.compresion, -10313, 2e-3);
cierto("bajo levantamiento la que comprime más es la Pratt",
  Math.abs(pU.compresion) > Math.abs(hU.compresion));

/* La envolvente es lo que dimensiona, y es donde la regla rinde menos. */
const envH = Math.min(hG.compresion, hU.compresion);
const envP = Math.min(pG.compresion, pU.compresion);
cerca("envolvente Howe", envH, -16247, 2e-3);
cerca("envolvente Pratt", envP, -10313, 2e-3);

const soloGravedad = 1 - Math.abs(pG.compresion) / Math.abs(hG.compresion);
const conEnvolvente = 1 - Math.abs(envP) / Math.abs(envH);
cerca("mirando SOLO la gravedad, la Pratt parece ahorrar el 80 %", soloGravedad, 0.80421, 1e-4);
cerca("mirando la ENVOLVENTE, ahorra el 37 %", conEnvolvente, 0.36521, 1e-4);
cierto("o sea que la regla del libro rinde menos de la mitad de lo que promete",
  conEnvolvente < soloGravedad / 2);
cierto("la Pratt sigue ganando, que eso no cambia", envP > envH);

/* ================================================================
   6 · GEOMETRÍA DE LAS CUERDAS
   ================================================================ */
function longitudTotal(geo) {
  const p = {};
  for (const n of geo.nudos) p[n.id] = n;
  let L = 0;
  for (const b of geo.barras) {
    const a = p[b.i], c = p[b.j];
    L += Math.sqrt(Math.pow(c.x_m - a.x_m, 2) + Math.pow(c.y_m - a.y_m, 2));
  }
  return L;
}

/* En cordones paralelos, Howe y Pratt son espejo exacto una de otra. */
const hPar = g({ cuerdas: "paralelos", alma: "howe", paneles: 6 });
const pPar = g({ cuerdas: "paralelos", alma: "pratt", paneles: 6 });
cerca("con cordones paralelos, Howe y Pratt miden EXACTAMENTE lo mismo",
  longitudTotal(hPar), longitudTotal(pPar), 1e-12);
comp("y la pendiente se ignora aunque se pase", hPar.pendiente, 0);

/* A dos aguas NO son espejo: la diagonal de la Howe sube al nudo alto. */
cerca("a dos aguas la Howe mide 102,96 m de barra", longitudTotal(howe), 102.96, 1e-3);
cerca("y la Pratt 99,85 m", longitudTotal(pratt), 99.85, 1e-3);
cierto("la Pratt es además la más corta de las dos", longitudTotal(pratt) < longitudTotal(howe));

/* LA WARREN NO AHORRA LA MITAD: hay que compararla al MISMO paso de nudo,
   y entonces son dos barras de menos sobre cuarenta y nueve. */
const w12 = g({ cuerdas: "dos_aguas", alma: "warren", paneles: 12 });
const supHowe = howe.nudos.filter((n) => n.clase === "superior").map((n) => n.x_m).sort((a, b) => a - b);
const supWarr = w12.nudos.filter((n) => n.clase === "superior").map((n) => n.x_m).sort((a, b) => a - b);
cerca("Warren de 12 paños tiene el MISMO paso de nudo superior que la Howe de 6",
  supWarr[1] - supWarr[0], supHowe[1] - supHowe[0], 1e-12);
comp("y entonces son 47 barras contra 49, no la mitad", [w12.conteo.b, howe.conteo.b], [47, 49]);
cerca("en longitud de barra sí ahorra: 95,35 m contra 102,96", longitudTotal(w12), 95.35, 1e-3);
cerca("un 7,4 % menos de acero", 1 - longitudTotal(w12) / longitudTotal(howe), 0.0739, 1e-2);

/* Un agua: el punto alto está en el extremo, no en el centro. */
const unAgua = g({ cuerdas: "un_agua", alma: "howe", paneles: 4 });
const altoUA = unAgua.nudos.filter((n) => n.clase === "superior")
  .reduce((a, b) => (b.y_m > a.y_m ? b : a));
cerca("un agua · el nudo más alto está en el extremo", altoUA.x_m, 20, 1e-12);
cerca("y vale h0 + s·L", altoUA.y_m, 1.2 + 0.20 * 20, 1e-12);
cerca("peralteCentro_m es el del centro de la luz", unAgua.peralteCentro_m, 3.2, 1e-12);
cerca("y peralteMaximo_m es el de verdad", unAgua.peralteMaximo_m, 5.2, 1e-12);
cierto("a dos aguas los dos coinciden", howe.peralteCentro_m === howe.peralteMaximo_m);

/* Tijera: la brida inferior sube, y el peralte tiene que ABRIRSE. */
const tij = g({ cuerdas: "tijera", alma: "howe", paneles: 4, pendienteInferior: 0.08 });
const tS = tij.nudos.find((n) => n.id === "S4"), tI = tij.nudos.find((n) => n.id === "I4");
cerca("tijera · la brida inferior sube al centro", tI.y_m, 0.08 * 10, 1e-12);
cerca("tijera · el peralte en el centro es 2,40 m", tS.y_m - tI.y_m, 2.40, 1e-12);
cierto("y es mayor que en el apoyo, o no sería una tijera",
  (tS.y_m - tI.y_m) > tij.peralteApoyo_m);
cerca("los apoyos siguen a cota cero", tij.nudos.find((n) => n.id === "I0").y_m, 0, 1e-12);

/* Ángulos de diagonal: informan, no juzgan. */
const ang = G.angulos(howe);
comp("la Howe de 6 paños tiene 12 diagonales", ang.diagonales, 12);
cerca("la más tendida va a 42,6°", ang.minGrados, 42.614, 1e-3);
cerca("la más empinada a 62,5°", ang.maxGrados, 62.488, 1e-3);
cerca("y la más larga mide 3,61 m", ang.maxLongitud_m, 3.608, 1e-3);
comp("una Warren pura no tiene montantes, solo diagonales",
  w12.barras.filter((b) => b.clase === "montante").length, 0);

/* ================================================================
   7 · CASAR LOS PAÑOS CON LAS CORREAS · fila G.correa.nudo
   ================================================================ */
const cor = G.panelesParaCorreas({ luz_m: 20, pendiente: 0.20, sepMaxCorrea_m: 1.80, alma: "howe" });
cerca("el factor de pendiente con s = 0,20 vale 1,0198", cor.factorPendiente, 1.019804, 1e-6);
cierto("Y ES SIEMPRE MAYOR QUE UNO: comparar contra el paso en planta se pasa de largo",
  cor.factorPendiente > 1);
comp("con luz 20 m y panel de 1,80 m bastan 6 paños por media luz", cor.recomendado.paneles, 6);
cerca("el paso sale 1,667 m en planta", cor.recomendado.paso_m, 20 / 12, 1e-12);
cerca("y 1,700 m sobre la pendiente", cor.recomendado.sepEnPendiente_m, 1.69967, 1e-4);
cierto("que es lo que hay que comparar contra la tabla del TR-4",
  cor.recomendado.sepEnPendiente_m > cor.recomendado.paso_m);
comp("son 13 correas", cor.recomendado.correas, 13);
cierto("la correa cae en el nudo, así que no hace falta el Capítulo H",
  cor.recomendado.requiereCapituloH === false);
cierto("y queda dentro de la separación habitual de McCormac",
  cor.recomendado.fueraDeLoHabitual === false);
cerca("el habitual empieza en 2 pies", cor.habitual_m[0], 2 * 0.3048, 2e-3);
cerca("y acaba en 6 pies", cor.habitual_m[1], 6 * 0.3048, 2e-3);

/* LA WARREN PAGA SU AHORRO AQUÍ: necesita el doble de paños para el mismo
   paso de nudo, y encima su primer nudo no cae en el alero. */
const corW = G.panelesParaCorreas({ luz_m: 20, pendiente: 0.20, sepMaxCorrea_m: 1.80, alma: "warren" });
comp("la Warren necesita 12 paños para el mismo paso de nudo", corW.recomendado.paneles, 12);
cerca("y el paso de nudo superior es el mismo", corW.recomendado.sepNudosSuperiores_m,
  cor.recomendado.sepNudosSuperiores_m, 1e-12);
cierto("PERO SU PRIMER NUDO NO ESTÁ EN EL ALERO", corW.recomendado.nudoEnElAlero === false);
cerca("está medio paño adentro", corW.recomendado.primerNudoSuperior_m, 20 / 24, 1e-12);
cierto("en la Howe sí está en el alero", cor.recomendado.nudoEnElAlero === true);

/* LA SALIDA DE McCORMAC, CUANTIFICADA: 40 m de luz con correa cada 0,70 m. */
const cor40 = G.panelesParaCorreas({ luz_m: 40, pendiente: 0.10, sepMaxCorrea_m: 0.70, alma: "howe" });
comp("con la correa en el nudo hacen falta 29 paños", cor40.recomendado.paneles, 29);
comp("o sea 59 nudos de brida superior", cor40.recomendado.nudosSuperiores, 59);
comp("con 4 correas por paño bastan 8 paños", cor40.masPocosNudos.paneles, 8);
comp("y 17 nudos", cor40.masPocosNudos.nudosSuperiores, 17);
cerca("el ahorro de nudos es del 71 %",
  1 - cor40.masPocosNudos.nudosSuperiores / cor40.recomendado.nudosSuperiores, 0.71186, 1e-4);
cierto("pero la segunda EXIGE el Capítulo H y lo dice",
  cor40.masPocosNudos.requiereCapituloH === true);
cierto("y la nota cita a McCormac para que no parezca un apaño",
  /McCormac/.test(cor40.nota) && /económica/.test(cor40.nota));
cierto("las dos salidas citan la fila del inventario", /McCormac/.test(cor40.art));

/* No se enumeran repartos absurdos: un paño de 20 m con 29 correas encima
   no es una armadura subdividida, es una viga. */
comp("no se enumeran más de 4 correas por paño", G.K_MAX, 4);
cierto("así que ninguna opción pide más",
  cor40.opciones.every((o) => o.correasPorPano <= 4));

lanza("panelesParaCorreas() sin la luz admisible del panel PARA",
  () => G.panelesParaCorreas({ luz_m: 20, pendiente: 0.20 }), "sepMaxCorrea_m");
cierto("y dice de dónde sale ese dato",
  (() => { try { G.panelesParaCorreas({ luz_m: 20 }); } catch (e) { return /TR-4/.test(e.message); } })());

/* ================================================================
   8 · LA BRIDA SUPERIOR SUBDIVIDIDA
   ================================================================ */
const g4 = g({ cuerdas: "dos_aguas", alma: "howe", paneles: 4 });
const sub = G.subdivideBridaSuperior(g4, 3);
const segSup = g4.barras.filter((b) => b.clase === "brida superior").length;
comp("partir en 3 cada paño añade 2 nudos por tramo de brida superior",
  sub.nudos.length, g4.nudos.length + segSup * 2);
comp("y triplica los tramos de brida superior",
  sub.barras.filter((b) => b.clase === "brida superior").length,
  g4.barras.filter((b) => b.clase === "brida superior").length * 3);
cierto("queda marcada como que YA NO ES UNA ARMADURA ahí", sub.requiereCapituloH === true);
comp("y se guarda cuántas correas por paño", sub.correasPorPano, 3);

const tramos = sub.barras.filter((b) => b.clase === "brida superior");
cierto("el primer tramo libera el giro en el nudo de paño", tramos[0].liberaI === true);
cierto("y NO en el nudo intermedio", tramos[0].liberaJ === false);
cierto("el tramo del medio no libera por ningún lado: va continuo",
  tramos[1].liberaI === false && tramos[1].liberaJ === false);
cierto("el último libera solo en el nudo de paño siguiente",
  tramos[2].liberaI === false && tramos[2].liberaJ === true);

/* EL CONTEO SE ANULA A PROPÓSITO: b+r=2j supone rótulas en todos los nudos
   y aquí hay tramos continuos, así que el número no significaría nada. */
comp("el conteo de Maxwell se anula, no se devuelve un número sin sentido", sub.conteo, null);
comp("y la comprobación de rango también", sub.rango, null);
cierto("la nota manda al Capítulo H con su cita", /Cap[íi]tulo H/.test(sub.nota));
cierto("y dice que es la salida que el libro llama económica",
  /econ[óo]mica/.test(sub.nota));

lanza("subdividir en menos de 2 no tiene sentido y PARA",
  () => G.subdivideBridaSuperior(g4, 1), "≥ 2");

/* Y tijeral.js se niega a montarla como armadura, que es donde el error
   se habría hecho invisible. */
lanza("tijeral.arma() RECHAZA una brida superior subdividida",
  () => T.arma(sub, { secciones: { "brida superior": { A_cm2: 20, I_cm4: 100, E_kgcm2: E } } }),
  "SUBDIVIDIDA");
cierto("y explica que liberar los giros borraría el momento que se buscaba",
  (() => {
    try { T.arma(sub, { secciones: {} }); } catch (e) { return /borra el momento local/.test(e.message); }
  })());

/* El mensaje de la correa fuera de nudo ya no se niega en redondo: ofrece
   las dos salidas de McCormac, y nombra la tercera que no existe. */
const malas = (() => {
  const m = T.arma(g4, {
    secciones: {
      "brida superior": { A_cm2: 20, I_cm4: 100, E_kgcm2: E },
      "brida inferior": { A_cm2: 20, I_cm4: 100, E_kgcm2: E },
      "diagonal": { A_cm2: 10, I_cm4: 40, E_kgcm2: E },
      "montante": { A_cm2: 10, I_cm4: 40, E_kgcm2: E }
    }
  });
  try {
    T.cargaEnNudos(m, g4, { xCorreas_m: [0, 1.1, 2.5, 3.9], PporCorrea_kgf: -1000 });
  } catch (e) { return e.message; }
  return "";
})();
cierto("el rechazo de la correa fuera de nudo ofrece DOS salidas", /DOS SALIDAS/.test(malas));
cierto("manda a panelesParaCorreas() para la primera",
  /panelesParaCorreas/.test(malas));
cierto("y a subdivideBridaSuperior() para la segunda",
  /subdivideBridaSuperior/.test(malas));
cierto("y deja claro cuál es la tercera que NO existe",
  /nudos vecinos y callarse/.test(malas));

/* ================================================================
   9 · LO QUE TIENE QUE PARAR
   ================================================================ */
lanza("sin peralte de apoyo PARA",
  () => G.genera({ cuerdas: "dos_aguas", alma: "howe", luz_m: 20, paneles: 6, pendiente: 0.2 }),
  "OBLIGATORIO");
cierto("Y EXPLICA POR QUÉ NO HAY VALOR POR OMISIÓN: no hay fuente",
  (() => {
    try { G.genera({ cuerdas: "dos_aguas", alma: "howe", luz_m: 20, paneles: 6, pendiente: 0.2 }); }
    catch (e) { return /LARGUERO/.test(e.message) && /AASHTO/.test(e.message); }
  })());
comp("y la fila del inventario está marcada como pendiente",
  INV.fila("G.peralte").estado, "pendiente");
lanza("pedir el valor de G.peralte PARA, porque no lo hay",
  () => INV.def("G.peralte"), "PENDIENTE");

lanza("un alma que no existe PARA", () => g({ cuerdas: "dos_aguas", alma: "fink", paneles: 6 }),
  "no existe");
cierto("Y LA FINK SE NOMBRA: no está, y se dice por qué",
  (() => {
    try { g({ cuerdas: "dos_aguas", alma: "fink", paneles: 6 }); }
    catch (e) { return /Fink/.test(e.message) && /figura/.test(e.message); }
  })());
lanza("una cuerda que no existe PARA",
  () => g({ cuerdas: "arco", alma: "howe", paneles: 6 }), "no existe");

lanza("paneles fraccionario PARA", () => g({ cuerdas: "dos_aguas", alma: "howe", paneles: 6.5 }),
  "entero");
lanza("luz negativa PARA", () => G.genera({
  cuerdas: "dos_aguas", alma: "howe", luz_m: -1, paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.2
}), "luz_m");
lanza("pendiente negativa PARA", () => g({ cuerdas: "dos_aguas", alma: "howe", paneles: 6, pendiente: -0.1 }),
  "pendiente");

lanza("una tijera sin pendiente inferior PARA",
  () => g({ cuerdas: "tijera", alma: "howe", paneles: 4 }), "pendienteInferior");
lanza("una tijera que se cierra hacia el centro PARA",
  () => g({ cuerdas: "tijera", alma: "howe", paneles: 4, pendienteInferior: 0.30 }),
  "subir MENOS");

/* ================================================================
   10 · LAS FILAS DEL INVENTARIO
   ================================================================ */
for (const id of ["G.armadura.def", "G.maxwell", "G.rango", "G.hiperestatica",
  "G.correa.nudo", "G.correa.sep", "G.correa.inclinada", "G.peralte",
  "G.alma", "G.tipologia.signo"]) {
  cierto("la fila " + id + " existe y tiene fuente",
    INV.existe(id) && !!INV.fila(id).fuente);
}
cierto("la definición de armadura es de Zapata y son DOS condiciones",
  /Zapata/.test(INV.art("G.armadura.def")) &&
  /nudos sean libres de rotar/.test(INV.fila("G.armadura.def").nota));
cierto("la correa en el nudo cita a McCormac con la palabra que lo cambia todo",
  /McCormac/.test(INV.art("G.correa.nudo")) &&
  /MÁS ECONÓMICO/.test(INV.fila("G.correa.nudo").nota));
cierto("G.peralte deja escrito que la cita del 1/24 es del larguero",
  /LARGUEROS/.test(INV.fila("G.peralte").nota));
cierto("G.alma dice que la Fink no está y por qué",
  /Fink/.test(INV.fila("G.alma").nota));
cierto("G.tipologia.signo avisa de que el levantamiento invierte los signos",
  /invierte/.test(INV.fila("G.tipologia.signo").nota) &&
  /0,9D/.test(INV.fila("G.tipologia.signo").nota));

fin();
