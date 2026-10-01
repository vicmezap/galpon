/* =====================================================================
   probar_montaje.js — el galpón entero, en tres planos

   Lo que de verdad se comprueba aquí:

   1) que el camino de carga longitudinal exista, eslabón por eslabón, y que
      el montaje se NIEGUE en cuanto falte uno.  Un galpón sin arriostre de
      techo resuelve, dibuja y se metra igual de bien, y no resiste a lo
      largo: por eso tiene que parar, no avisar.

   2) la cifra del Art. 18.2 de la E.020 en números: el plano del techo SIN
      arriostrar, con el conteo de Maxwell diciendo «hiperestática» y el
      rango diciendo MECANISMO.  El contraejemplo de generador.js, que allí
      hubo que construir, aquí aparece solo y en la planta de un galpón
      normal.

   3) la moneda de dos caras: acortar el camino de carga alarga la longitud
      que no puede dilatar, y al revés.  Las dos cifras, medidas.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const MT = require("../src/montaje.js");
const GEN = require("../src/generador.js");
const INV = require("../src/inventario.js");

const BASE = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20,
  columnasHastiales: [5, 10, 15]
};
const monta = (extra) => MT.monta(Object.assign({}, BASE, extra));
const centro = monta({ panosArriostradosTecho: [5], panosArriostradosFachada: [5] });
const extremos = monta({ panosArriostradosTecho: [0, 9], panosArriostradosFachada: [0, 9] });

/* ================================================================
   1 · LOS EJES · fila MT.ejes
   ================================================================ */
const ej = MT.ejes({ largo_m: 60, sepPorticos_m: 6 });
comp("60 m a 6 m son 10 paños", ej.panos, 10);
comp("y 11 pórticos", ej.porticos, 11);
comp("el último eje cae en el largo", ej.z_m[ej.z_m.length - 1], 60);
cierto("no hubo que ajustar nada", ej.ajustada === false);

/* EL RESTO NO SE REPARTE EN SILENCIO: cambia el área tributaria del pórtico
   extremo y nadie lo ve. */
lanza("un largo que no es múltiplo de la separación PARA",
  () => MT.ejes({ largo_m: 58, sepPorticos_m: 6 }), "número entero de paños");
cierto("y propone las dos separaciones que sí caben enteras",
  (() => {
    try { MT.ejes({ largo_m: 58, sepPorticos_m: 6 }); }
    catch (e) { return /5\.800/.test(e.message) && /6\.444/.test(e.message); }
  })());
const aj = MT.ejes({ largo_m: 58, sepPorticos_m: 6, ajustaSeparacion: true });
cerca("declarándolo, la separación se ajusta a 5,80 m", aj.sepPorticos_m, 5.8, 1e-12);
cierto("y queda constancia de que se ajustó", aj.ajustada === true);
comp("la separación pedida se conserva para la memoria", aj.sepPedida_m, 6);
lanza("una separación mayor que el largo PARA",
  () => MT.ejes({ largo_m: 10, sepPorticos_m: 20 }), "ni un paño");

/* ================================================================
   2 · EL MONTAJE
   ================================================================ */
comp("el galpón de 60 × 20 tiene 314 nudos", centro.conteo.nudos, 314);
comp("y 733 barras", centro.conteo.barras, 733);

/* El reparto cuadra pieza por pieza, y cada número sale de la geometría. */
const pc = centro.conteo.porClase;
comp("2 columnas por pórtico", pc["columna"], 2 * 11);
comp("13 montantes por pórtico", pc["montante"], 13 * 11);
comp("12 bridas superiores por pórtico", pc["brida superior"], 12 * 11);
comp("una correa por nudo de brida superior y por paño", pc["correa"], 13 * 10);
comp("dos vigas de alero por paño", pc["viga de alero"], 2 * 10);
comp("tres columnas hastiales en cada uno de los dos hastiales",
  pc["columna hastial"], 3 * 2);
comp("y solo en los hastiales: no las hay en los pórticos interiores",
  centro.barras.filter((b) => b.hastial).map((b) => b.eje).sort((a, b) => a - b),
  [0, 0, 0, 10, 10, 10]);

const pp = centro.conteo.porPlano;
comp("los cuatro planos están poblados", Object.keys(pp).sort(),
  ["fachada", "longitudinal", "techo", "transversal"]);
comp("y las barras suman", pp.transversal + pp.longitudinal + pp.techo + pp.fachada, 733);

/* La armadura de cada pórtico la hace el generador: una sola definición. */
comp("el tijeral de cada pórtico sale de generador.js",
  centro.tijeral.conteo.b, 49);
cierto("y queda autorizado por el rango, como todos",
  centro.tijeral.rango.verificado === true);

/* Las coordenadas: el tijeral va encima de la columna. */
const I0e3 = centro.nudos.find((n) => n.id === "I0@3");
cerca("el arranque del tijeral está a la altura de la columna", I0e3.y_m, 6, 1e-12);
cerca("y en el eje 3, o sea a z = 18 m", I0e3.z_m, 18, 1e-12);
const cumbre = centro.nudos.filter((n) => n.eje === 0 && n.clase === "superior")
  .reduce((a, b) => (b.y_m > a.y_m ? b : a));
cerca("la cumbre está a 6 + 1,2 + 2,0 = 9,2 m", cumbre.y_m, 9.2, 1e-12);
cerca("y en el centro de la luz", cumbre.x_m, 10, 1e-12);

/* ================================================================
   3 · LA GUARDA · EL CAMINO DE CARGA
   ================================================================ */
lanza("SIN ARRIOSTRE DE TECHO el montaje se niega",
  () => monta({ panosArriostradosTecho: [], panosArriostradosFachada: [3] }),
  "NO HAY ARRIOSTRE DE TECHO");
const sinTecho = (() => {
  try { monta({ panosArriostradosTecho: [], panosArriostradosFachada: [3] }); }
  catch (e) { return e.message; } return "";
})();
cierto("y cita la E.030 Art. 6 y sus dos direcciones principales",
  /E\.030/.test(sinTecho) && /ambas\s*\n?\s*direcciones/.test(sinTecho));
cierto("Y DESMONTA LA EXCUSA: el techo metálico no es diafragma, E.020 Art. 18",
  /E\.020 Art\. 18/.test(sinTecho) && /no lo es/.test(sinTecho));

lanza("con techo pero SIN FACHADA también se niega",
  () => monta({ panosArriostradosTecho: [3], panosArriostradosFachada: [] }),
  "no de FACHADA");
cierto("y explica que la fuerza no se queda a mitad de bajada",
  (() => {
    try { monta({ panosArriostradosTecho: [3], panosArriostradosFachada: [] }); }
    catch (e) { return /mitad de bajada/.test(e.message) && /continuidad/.test(e.message); }
  })());

lanza("un paño arriostrado que no existe PARA",
  () => monta({ panosArriostradosTecho: [99], panosArriostradosFachada: [5] }),
  "no existe");

/* La columna hastial tiene que rematar en un nudo · fila MT.hastial */
lanza("una columna hastial que remata entre nudos PARA",
  () => monta({ panosArriostradosTecho: [5], panosArriostradosFachada: [5],
    columnasHastiales: [4.2] }), "no remata en un nudo");
cierto("y explica que metería flexión en la brida inferior sin que nadie la verifique",
  (() => {
    try {
      monta({ panosArriostradosTecho: [5], panosArriostradosFachada: [5],
        columnasHastiales: [4.2] });
    } catch (e) { return /flexi[óo]n en la brida inferior/.test(e.message); }
  })());
lanza("una columna hastial fuera de la luz PARA",
  () => monta({ panosArriostradosTecho: [5], panosArriostradosFachada: [5],
    columnasHastiales: [25] }), "fuera de la luz");

/* ================================================================
   4 · TECHO Y FACHADA EN EL MISMO PAÑO · fila MT.mismo.pano
   ================================================================ */
cierto("con los dos en el paño 5, están alineados", centro.camino.alineados === true);
comp("y el recorrido por el alero es cero", centro.camino.recorridoMaximoAlero_m, 0);
cierto("la nota dice que la viga de alero solo amarra",
  /solo amarra/.test(centro.camino.nota));

const desalineado = monta({ panosArriostradosTecho: [2], panosArriostradosFachada: [7] });
cierto("en paños distintos ya no están alineados", desalineado.camino.alineados === false);
cerca("y la reacción recorre 30 m de alero antes de poder bajar",
  desalineado.camino.recorridoMaximoAlero_m, 30, 1e-12);
cierto("LA CONSECUENCIA SE DICE: la viga de alero trabaja a AXIAL, no a flexión",
  /axial, no a flexi[óo]n/.test(desalineado.camino.nota) &&
  /puntal/.test(desalineado.camino.nota));
cierto("no se niega, porque es legal: se dice lo que cuesta",
  desalineado.camino.cierra === true);

/* ================================================================
   5 · LA MONEDA DE DOS CARAS · camino de carga contra dilatación
   ================================================================ */
const hCentro = centro.camino.desdeHastiales.map((x) => x.recorrido_m);
const hExtremos = extremos.camino.desdeHastiales.map((x) => x.recorrido_m);
comp("un paño al centro: la fuerza del hastial recorre 30 y 24 m", hCentro, [30, 24]);
comp("dos paños en los extremos: recorre cero desde los dos", hExtremos, [0, 0]);

cerca("pero con un solo paño no hay nada preso: dilata libre",
  centro.dilatacion.longitudPresa_m, 0, 1e-12);
cerca("y con dos en los extremos quedan 54 m presos entre puntos fijos",
  extremos.dilatacion.longitudPresa_m, 54, 1e-12);
comp("los puntos fijos son los centros de los paños arriostrados",
  extremos.dilatacion.puntosFijos_m, [3, 57]);
cerca("con uno al centro, el galpón dilata 33 m hacia un lado",
  centro.dilatacion.libreExtremoInicial_m, 33, 1e-12);
cerca("y 27 m hacia el otro", centro.dilatacion.libreExtremoFinal_m, 27, 1e-12);

cierto("ES LA MISMA DECISIÓN: lo que acorta el camino alarga lo que no dilata",
  hExtremos[0] < hCentro[0] &&
  extremos.dilatacion.longitudPresa_m > centro.dilatacion.longitudPresa_m);

/* El ΔT viene del inventario como NÚMERO, no sacado a tirones de un texto. */
comp("ΔT = 30 °C para construcciones de metal", centro.dilatacion.deltaT_C, 30);
cerca("y es el mismo que da num() sobre la fila", INV.num("MT.deltaT"), 30, 1e-12);
cierto("la fuente es la E.020 Art. 15", /E\.020 Art\. 15/.test(INV.art("MT.deltaT")));
cierto("y la obligación la respaldan las DOS normas",
  /E\.020/.test(INV.art("MT.termica")) && /AISC/.test(INV.art("MT.termica")));

/* EL ALARGAMIENTO EN MILÍMETROS NO SE CALCULA, y eso es deliberado. */
comp("el alargamiento en mm se devuelve nulo, no estimado",
  centro.dilatacion.alargamiento_mm, null);
comp("porque α está pendiente", INV.fila("MT.alfa").estado, "pendiente");
lanza("y pedirlo PARA", () => INV.def("MT.alfa"), "PENDIENTE");
cierto("LA TRAMPA QUEDA ESCRITA: el α del AISC es el de incendio y lo dice",
  /INCENDIO/i.test(INV.fila("MT.alfa").nota) &&
  /66\s*°C/.test(INV.fila("MT.alfa").nota));
cierto("y se compara con la trampa gemela del 1/24 del larguero",
  /G\.peralte/.test(INV.fila("MT.alfa").nota));

/* ================================================================
   6 · EL PLANO DEL TECHO · la E.020 Art. 18.2 en números
   ================================================================ */
const techo = MT.planoTecho(centro);
comp("el plano del techo tiene un nudo por correa y pórtico", techo.maxwell.j, 13 * 11);
cierto("y NO se declara diafragma", techo.esDiafragma === false);
cierto("ni modelo listo para el solucionador", techo.listoParaSolver === false);
cierto("con el arriostre puesto, el rango dice que se tiene en pie",
  techo.esMecanismo === false);

/* LAS CONDICIONES DE APOYO NO SON OBVIAS: en x sujeta el pórtico, que está
   fuera de este plano; en z solo el arriostre de fachada. */
const conX = techo.apoyos.filter((a) => a.ux).length;
const conZ = techo.apoyos.filter((a) => a.uy).length;
comp("en x sujetan los dos aleros de CADA pórtico", conX, 2 * 11);
comp("en z solo los aleros del paño arriostrado de fachada", conZ, 4);
cierto("y la asimetría viene explicada en los propios datos, no en un comentario",
  /sujeta EL PÓRTICO/.test(techo.apoyosNota) &&
  /TRANSVERSAL/.test(techo.apoyosNota));

/* ───────── LA CIFRA ─────────
   Se le quita el arriostre de techo y se deja todo lo demás igual: eso es
   exactamente lo que el Art. 18.1 tentaría a suponer, una cobertura que
   reparte sola. */
const desnudo = {
  nudos: techo.nudos,
  barras: techo.barras.filter((b) => b.clase !== "arriostre de techo"),
  apoyos: techo.apoyos,
  nombre: "techo sin arriostrar"
};
const cuentaDesnudo = GEN.maxwell(desnudo);
desnudo.conteo = cuentaDesnudo;
let desnudoEsMecanismo = false;
try { GEN.compruebaRango(desnudo); } catch (e) { desnudoEsMecanismo = /MECANISMO/.test(e.message); }

comp("sin arriostre quedan 262 barras", cuentaDesnudo.b, 262);
comp("EL CONTEO DICE grado +2", cuentaDesnudo.grado, 2);
comp("o sea «hiperestática»", cuentaDesnudo.veredicto, "hiperestática");
cierto("Y EL RANGO DICE MECANISMO", desnudoEsMecanismo === true);
cierto("el conteo de Maxwell, aquí, autoriza un techo que no se tiene en pie",
  cuentaDesnudo.grado >= 0 && desnudoEsMecanismo);

/* Y con el arriostre puesto, el mismo plano sí se tiene en pie. */
comp("con el arriostre son 274 barras", techo.maxwell.b, 274);
comp("doce barras más", techo.maxwell.b - cuentaDesnudo.b, 12);
cierto("y esas doce son la diferencia entre mecanismo y estructura",
  desnudoEsMecanismo === true && techo.esMecanismo === false);

/* El arriostre de techo es una CELOSÍA, no una cruz de esquina a esquina:
   una cruz solo ata las dos líneas de alero. */
comp("hay una diagonal de techo por paño de brida superior y paño arriostrado",
  centro.conteo.porClase["arriostre de techo"], 12);
const nudosTocados = new Set();
for (const b of centro.barras) {
  if (b.clase !== "arriostre de techo") continue;
  nudosTocados.add(b.i.split("@")[0]);
  nudosTocados.add(b.j.split("@")[0]);
}
comp("y toca las 13 líneas de correa, no solo las dos de alero",
  nudosTocados.size, 13);

/* ================================================================
   7 · EXTRAER EL PÓRTICO · fila MT.plano.solver
   ================================================================ */
const p0 = MT.planoTransversal(centro, 0);
const p3 = MT.planoTransversal(centro, 3);
comp("un pórtico interior tiene 28 nudos", p3.nudos.length, 28);
comp("y dos apoyos", p3.apoyos.length, 2);
comp("el hastial tiene tres nudos y tres apoyos más", p0.nudos.length, 31);
comp("y cinco apoyos", p0.apoyos.length, 5);
cierto("los nudos extraídos ya no llevan z: el solucionador es plano",
  p3.nudos.every((n) => n.z_m === undefined));
cerca("pero el plano recuerda a qué z estaba", p3.z_m, 18, 1e-12);
cierto("y todas sus barras son del plano transversal",
  p3.barras.every((b) => b.plano === "transversal"));
lanza("pedir un eje que no existe PARA", () => MT.planoTransversal(centro, 99), "no existe");

/* ================================================================
   8 · METRADO
   ================================================================ */
const me = MT.metrado(centro);
cerca("el galpón son 2309 m de barra", me.total_m, 2309.370, 1e-5);
cerca("las correas son el tramo más largo: 780 m", me.porClase_m["correa"], 780, 1e-9);
cerca("132 m de columna", me.porClase_m["columna"], 2 * 11 * 6, 1e-9);
cerca("220 m de brida inferior", me.porClase_m["brida inferior"], 220, 1e-9);
cierto("y las bridas superiores miden más que las inferiores, por la pendiente",
  me.porClase_m["brida superior"] > me.porClase_m["brida inferior"]);
cerca("exactamente el factor √(1+s²)",
  me.porClase_m["brida superior"] / me.porClase_m["brida inferior"],
  Math.sqrt(1 + 0.20 * 0.20), 1e-9);

/* ================================================================
   9 · LAS FILAS DEL INVENTARIO
   ================================================================ */
for (const id of ["MT.ejes", "MT.dos.direcciones", "MT.continuidad", "MT.no.diafragma",
  "MT.plano.solver", "MT.hastial", "MT.mismo.pano", "MT.termica", "MT.deltaT", "MT.alfa"]) {
  cierto("la fila " + id + " existe y tiene fuente",
    INV.existe(id) && !!INV.fila(id).fuente);
}
cierto("las dos direcciones son textuales de la E.030 Art. 6 d)",
  /E\.030-2026 Art\. 6/.test(INV.art("MT.dos.direcciones")) &&
  /AMBAS DIRECCIONES PRINCIPALES/.test(INV.fila("MT.dos.direcciones").nota));
cierto("el no-diafragma es textual de la E.020 Art. 18.2",
  /E\.020 Art\. 18/.test(INV.art("MT.no.diafragma")) &&
  /NO PERMITAN SU COMPORTAMIENTO COMO DIAFRAGMA RÍGIDO/
    .test(INV.fila("MT.no.diafragma").nota));
cierto("y recuerda que el 18.1 nombra la relación largo/ancho, que un galpón tiene",
  /largo\/ancho/.test(INV.fila("MT.no.diafragma").nota));
cierto("MT.plano.solver declara que el 3D no se analiza en 3D",
  /no es defendible/.test(INV.fila("MT.plano.solver").nota));
cierto("el convenio de ejes dice por qué importa fijarlo una vez",
  /plausible y equivocado/.test(INV.fila("MT.ejes").nota));

fin();
