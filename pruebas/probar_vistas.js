/* =====================================================================
   probar_vistas.js — las cuatro pestañas, como datos

   LA COMPROBACIÓN QUE DA SENTIDO AL MÓDULO es la conversa de la que había
   en E6c.  Allí se comprobaba que los botones de «fuente» apuntaran a filas
   que existen, y eso pasaba — y aun así, de las veintitrés cifras que
   enseñaba el panel, once salían a pantalla sin decir de dónde venían.  No
   estaban mal: estaban sin avalar, que delante de un plano es lo mismo.

   Aquí se comprueba que NO HAYA NI UNA sin procedencia declarada, barriendo
   las tres pestañas reales con un galpón de verdad.  Y que las cinco
   procedencias se respeten: «norma» obliga a dar la fila, las otras cuatro
   prohíben citarla.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const V = require("../src/vistas.js");
const MON = require("../src/montaje.js");
const INV = require("../src/inventario.js");

const D = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20,
  cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5],
  columnasHastiales: [5, 10, 15]
};
const m3 = MON.monta(D);

/* ================================================================
   1 · LA REGLA, EN SU FORMA FUERTE · fila V.procedencia
   ================================================================ */
const todas = V.todasLasLineas(m3);
cierto("el panel enseña más de treinta cifras", todas.length >= 30);

comp("NI UNA SOLA sin procedencia declarada",
  todas.filter((t) => !t.linea.origen).map((t) => t.ficha + " · " + t.linea.q), []);
comp("y ninguna con una procedencia inventada",
  todas.filter((t) => V.ORIGENES.indexOf(t.linea.origen) < 0)
    .map((t) => t.linea.q), []);

/* Las cinco, y cada una usada de verdad: si una no se usa nunca, sobra. */
const porOrigen = {};
for (const t of todas) porOrigen[t.linea.origen] = (porOrigen[t.linea.origen] || 0) + 1;
comp("las cinco procedencias son las declaradas", V.ORIGENES.slice().sort(),
  ["conteo", "entrada", "geometria", "medido", "norma"]);
comp("y las cinco se usan", V.ORIGENES.filter((o) => !porOrigen[o]), []);

/* «norma» obliga a la fila; las otras cuatro la prohíben. */
const deNorma = todas.filter((t) => t.linea.origen === "norma");
cierto("hay al menos una docena de cifras normativas", deNorma.length >= 12);
comp("todas citan su fila", deNorma.filter((t) => !t.linea.fuente).map((t) => t.linea.q), []);
comp("y todas las filas citadas existen",
  deNorma.filter((t) => !INV.existe(t.linea.fuente)).map((t) => t.linea.fuente), []);
comp("NINGUNA de las otras cuatro cita una fila",
  todas.filter((t) => t.linea.origen !== "norma" && t.linea.fuente)
    .map((t) => t.linea.q + " -> " + t.linea.fuente), []);

/* Y lo citado no es decorativo: son las filas que sostienen los módulos. */
const citadas = Array.from(new Set(deNorma.map((t) => t.linea.fuente))).sort();
for (const id of ["G.maxwell", "MT.no.diafragma", "MT.termica", "MT.deltaT", "MT.alfa"]) {
  cierto("se cita " + id + " en pantalla", citadas.indexOf(id) >= 0);
}
cierto("y la que no se puede usar también se enseña, para que se vea el hueco",
  citadas.indexOf("MT.alfa") >= 0 && INV.fila("MT.alfa").estado === "pendiente");

/* ================================================================
   2 · LA GUARDA DE ln()
   ================================================================ */
lanza("una procedencia inventada PARA", () => V.ln("x", "1", "a_ojo"), "no existe");
lanza("y nombra las cinco que hay", () => V.ln("x", "1", "a_ojo"), "V.procedencia");
lanza("«norma» sin la fila PARA", () => V.ln("x", "1", "norma"),
  "no da la fila del inventario");
lanza("y explica por qué importa", () => V.ln("x", "1", "norma"),
  "sin que nadie la pueda");
lanza("«norma» con una fila que no existe PARA",
  () => V.ln("x", "1", "norma", { fuente: "NO.EXISTE" }), "NO EXISTE");
lanza("una procedencia que NO es norma y además cita PARA",
  () => V.ln("x", "1", "conteo", { fuente: "G.maxwell" }), "es peor que no");
cierto("una línea bien formada no lanza y conserva lo suyo",
  V.ln("Paso", "1,667 m", "geometria").origen === "geometria" &&
  V.ln("Paso", "1,667 m", "geometria").fuente === undefined);

/* ================================================================
   3 · LOS CAMPOS DE ENTRADA
   ================================================================ */
comp("hay diecisiete campos", V.ENTRADAS.length, 17);
comp("en cuatro grupos", V.grupos().length, 4);
comp("y los grupos no pierden ningún campo",
  V.grupos().reduce((a, g) => a + g.campos.length, 0), V.ENTRADAS.length);
comp("los ids no se repiten",
  V.ENTRADAS.length, new Set(V.ENTRADAS.map((e) => e.id)).size);
comp("todo campo tiene etiqueta",
  V.ENTRADAS.filter((e) => !e.etiqueta).map((e) => e.id), []);

/* Un campo puede citar una fila, y si lo hace tiene que existir: se
   comprueba al CARGAR el módulo, no aquí, porque un id mal escrito es un
   botón que revienta al pulsarlo y eso lo descubre el usuario. */
comp("los campos que citan una fila la citan bien",
  V.ENTRADAS.filter((e) => e.fuente && !INV.existe(e.fuente)).map((e) => e.id), []);
cierto("el peralte cita su pendiente, que es la que dice que no hay fuente",
  V.ENTRADAS.filter((e) => e.id === "h0")[0].fuente === "G.peralte");

/* LOS TOPES SON DE PANTALLA · fila V.limites.  Llevan el nombre puesto
   para que nadie los defienda en una memoria de cálculo. */
const conTope = V.ENTRADAS.filter((e) => e.limiteDePantalla);
cierto("los campos numéricos llevan tope", conTope.length >= 8);
comp("y el tope se llama limiteDePantalla, no «mínimo» ni «máximo»",
  V.ENTRADAS.filter((e) => e.min !== undefined || e.max !== undefined), []);
cierto("la fila del inventario dice que no son criterios de diseño",
  /NO SON CRITERIOS DE DISE/.test(INV.fila("V.limites").nota));

/* ================================================================
   4 · valida() MIRA LA FORMA Y NADA MÁS · fila V.no.duplica
   ================================================================ */
const bien = {
  luz: 20, largo: 60, sep: 6, hcol: 6, ajusta: false,
  cuerdas: "dos_aguas", alma: "howe", pend: 20, pendi: 8, pan: 6, h0: 1.2,
  at: "5", af: "5", ch: "5, 10, 15",
  proy: "isometrica", azim: 45, elev3d: 35
};
cierto("con datos buenos no hay nada que decir", V.valida(bien).ok === true);

const vacio = V.valida(Object.assign({}, bien, { luz: NaN }));
cierto("un campo que no es número se detecta", vacio.ok === false);
comp("y se dice cuál", vacio.malos[0].campo, "luz");

const fuera = V.valida(Object.assign({}, bien, { luz: 1 }));
cierto("un valor fuera del tope de pantalla se detecta", fuera.ok === false);
cierto("Y SE MARCA COMO TOPE DE PANTALLA, no como criterio",
  fuera.malos[0].limiteDePantalla === true);
cierto("el mensaje nombra el rango", /2 a 120 m/.test(fuera.malos[0].que));

const opcion = V.valida(Object.assign({}, bien, { alma: "fink" }));
cierto("un alma que no existe se detecta en el formulario", opcion.ok === false);

/* LO QUE valida() NO HACE, Y ES DELIBERADO: no sabe nada de física. */
cierto("valida() NO se entera de que faltan arriostres: eso es del motor",
  V.valida(Object.assign({}, bien, { at: "", af: "" })).ok === true);
lanza("y el motor sí se entera",
  () => MON.monta(Object.assign({}, D, { panosArriostradosTecho: [] })),
  "NO HAY ARRIOSTRE DE TECHO");
cierto("valida() lo dice de sí mismo", /FORMA/.test(V.valida(bien).nota));
cierto("y cita su fila", /arquitectura/.test(V.valida(bien).art));

/* ================================================================
   5 · EL RECHAZO NO SE ABLANDA
   ================================================================ */
let pr = null;
try { MON.monta(Object.assign({}, D, { panosArriostradosTecho: [] })); }
catch (e) { pr = V.problema(e); }
cierto("problema() devuelve algo pintable", !!pr);
cierto("con el mensaje ENTERO del motor, sin resumir",
  /NO HAY ARRIOSTRE DE TECHO/.test(pr.mensaje) &&
  /E\.020 Art\. 18/.test(pr.mensaje) &&
  pr.mensaje.split("\n").length >= 8);
cierto("y deja claro que no hay modelo", pr.hayModelo === false);
cierto("y por qué no se dibuja nada igualmente",
  /puerta de atr[áa]s/.test(pr.porQueNoSeDibuja));
cierto("el título dice que no es un aviso", /no es un aviso/.test(pr.titulo));

/* ================================================================
   6 · LAS PESTAÑAS Y SUS PROYECCIONES
   ================================================================ */
comp("son cuatro", V.PESTANAS.length, 4);
comp("y las cuatro son reales: la 3D ya está",
  V.PESTANAS.filter((p) => p.real).length, 4);
lanza("una pestaña que no existe PARA", () => V.pestana("planta3"), "no existe");

/* ───── LOS CAMPOS DE CAMARA NO LLEGAN AL MOTOR ─────
   Tres de los diecisiete campos mueven la vista. Si uno se colara en el
   modelo, girar la cámara cambiaría un ratio y nadie sabría por qué. */
comp("diecisiete campos", V.ENTRADAS.length, 17);
comp("catorce van al modelo", V.ENTRADAS.filter((e) => e.destino === "modelo").length, 14);
comp("y tres a la vista", V.ENTRADAS.filter((e) => e.destino === "vista").length, 3);
comp("todo campo declara destino",
  V.ENTRADAS.filter((e) => ["modelo", "vista"].indexOf(e.destino) < 0).map((e) => e.id), []);
const todoD = Object.assign({}, bien, { proy: "perspectiva", azim: 123, elev3d: 12 });
comp("datosModelo() no deja pasar ni un campo de vista",
  Object.keys(V.datosModelo(todoD)).filter((k) => ["proy", "azim", "elev3d"].indexOf(k) >= 0), []);
comp("y datosVista() solo trae esos tres",
  Object.keys(V.datosVista(todoD)).sort(), ["azim", "elev3d", "proy"]);

/* Y LA PRUEBA QUE IMPORTA DE VERDAD: girar la cámara no mueve un número.
   Dos cámaras distintas de par en par, y los datos que llegan al motor
   tienen que ser IDÉNTICOS. */
const camA = Object.assign({}, bien, { proy: "isometrica", azim: 45, elev3d: 35 });
const camB = Object.assign({}, bien, { proy: "perspectiva", azim: 123, elev3d: -40 });
comp("cambiar de cámara no cambia un solo dato del modelo",
  V.datosModelo(camA), V.datosModelo(camB));
cierto("y los dos juegos de cámara sí son distintos, o la prueba no diría nada",
  JSON.stringify(V.datosVista(camA)) !== JSON.stringify(V.datosVista(camB)));
comp("las fichas de las otras tres pestañas ni miran la cámara",
  JSON.stringify(V.fichas("portico", m3, V.datosVista(camB))),
  JSON.stringify(V.fichas("portico", m3, V.datosVista(camA))));

/* LAS CUATRO PROYECCIONES, y cada una mira algo distinto. */
const dP = V.dibujo("portico", m3), dT = V.dibujo("planta", m3), dE = V.dibujo("elev", m3);
const d3 = V.dibujo("tresd", m3, { proy: "isometrica" });
comp("el pórtico se dibuja en (x, y)", [dP.ejeX, dP.ejeY], ["x_m", "y_m"]);
comp("la planta de techo en (z, x)", [dT.ejeX, dT.ejeY], ["z_m", "x_m"]);
comp("la elevación en (z, y)", [dE.ejeX, dE.ejeY], ["z_m", "y_m"]);
cierto("las tres traen nudos y barras",
  dP.nudos.length > 20 && dT.nudos.length > 100 && dE.nudos.length > 10);
cierto("y las tres, leyenda", dP.leyenda.length && dT.leyenda.length && dE.leyenda.length);
cierto("la planta destaca el arriostre de techo",
  dT.leyenda.some((x) => /ARRIOSTRE DE TECHO/.test(x[0])));
cierto("y la elevación el de fachada",
  dE.leyenda.some((x) => /ARRIOSTRE DE FACHADA/.test(x[0])));

/* LA 3D llega con las coordenadas ya proyectadas, para que el pintor sea
   el mismo que el de las otras tres: una sola ruta de dibujo. */
comp("la 3D trae las coordenadas puestas, no un par de ejes del modelo",
  [d3.ejeX, d3.ejeY], ["_x", "_y"]);
comp("y trae el galpón entero", [d3.nudos.length, d3.barras.length],
  [m3.nudos.length, m3.barras.length]);
comp("con un orden de pintado por cada barra", d3.orden.length, m3.barras.length);
cierto("el orden va de atrás hacia delante",
  d3.escena.segmentos[0].prof >= d3.escena.segmentos[d3.escena.segmentos.length - 1].prof);
cierto("y la atenuación acompaña: lo lejano más tenue que lo cercano",
  d3.opacidad[d3.orden[0]] < d3.opacidad[d3.orden[d3.orden.length - 1]]);
cierto("la ficha de la 3D dice si se puede medir",
  V.fichas("tresd", m3, { proy: "isometrica" })[0].lineas
    .some((l) => /puede medir/.test(l.q)));
const fIso = V.fichas("tresd", m3, { proy: "isometrica" })[0];
const fPer = V.fichas("tresd", m3, { proy: "perspectiva" })[0];
const medible = (f) => f.lineas.filter((l) => /puede medir/.test(l.q))[0];
comp("en isométrica, sí", medible(fIso).v, "sí");
comp("en perspectiva, NO", medible(fPer).v, "NO");
comp("y la ficha entera se marca en verde solo cuando es medible",
  [fIso.estado, fPer.estado], ["bien", null]);

/* Las barras de cada proyección existen de verdad en el modelo. */
const ids = new Set(m3.barras.map((b) => b.id));
for (const [n, d] of [["planta", dT], ["elevación", dE]]) {
  comp("todas las barras de la " + n + " son del modelo",
    d.barras.filter((b) => !ids.has(b.id)).length, 0);
}

/* ================================================================
   7 · LAS FICHAS CAMBIAN CON EL GALPÓN
   Si las líneas fueran texto fijo, esto pasaría igual. No lo son.
   ================================================================ */
const otro = MON.monta(Object.assign({}, D, {
  panosArriostradosTecho: [0, 9], panosArriostradosFachada: [0, 9]
}));
const buscaLinea = (mm, pest, q) => {
  for (const f of V.fichas(pest, mm)) {
    for (const l of f.lineas) if (l.q === q) return l;
  }
  return null;
};
const presa1 = buscaLinea(m3, "elev", "Longitud que NO puede dilatar");
const presa2 = buscaLinea(otro, "elev", "Longitud que NO puede dilatar");
comp("con un paño al centro no hay nada preso", presa1.v, "0,00 m");
comp("con dos en los extremos, 54 m", presa2.v, "54,00 m");
comp("y el estado cambia de bien a mal", [presa1.estado, presa2.estado], ["ok", "no"]);

const hast1 = buscaLinea(m3, "planta", "Desde el hastial z = 0");
const hast2 = buscaLinea(otro, "planta", "Desde el hastial z = 0");
comp("y el recorrido desde el hastial, al revés", [hast1.v, hast2.v], ["30,00 m", "0,00 m"]);

/* La ficha del camino de carga se marca «bien» solo si están alineados. */
const desalineado = MON.monta(Object.assign({}, D, {
  panosArriostradosTecho: [2], panosArriostradosFachada: [7]
}));
comp("alineados: la ficha va en verde",
  V.fichas("planta", m3)[0].estado, "bien");
comp("desalineados: no", V.fichas("planta", desalineado)[0].estado, null);

/* ================================================================
   7b · LAS ANOTACIONES · lo que separa un dibujo de un croquis

   Un dibujo estructural sin cifras no se puede medir, y sin etiquetas no
   se puede señalar: el panel derecho dice «DIAGONAL D7» y si el dibujo no
   pone D7 en ninguna parte, el que mira tiene que adivinar cuál es.
   Van como DATOS, en coordenadas del modelo, para que se puedan comprobar
   aquí en vez de mirarlos.
   ================================================================ */
const an = V.anotaciones("portico", m3);
cierto("el pórtico se acota", an.cotas.length >= 15);
cierto("se etiqueta", an.etiquetas.length >= 20);
comp("y lleva sus dos apoyos", an.apoyos.length, 2);
comp("uno fijo y otro móvil, que es como apoya un tijeral",
  an.apoyos.map((a) => a.tipo), ["fijo", "movil"]);

/* las cotas están EN COORDENADAS DEL MODELO, no en píxeles: así la
   plantilla las transforma con el mismo mapa que las barras y si el
   dibujo se mueve, las cifras se mueven con él */
const luz = an.cotas.filter((c) => c.texto === "20,00 m")[0];
cierto("la luz entera está acotada", !!luz);
comp("de 0 a 20 en coordenadas del modelo", [luz.x1, luz.x2], [0, 20]);
comp("abajo y en el segundo nivel, para no pisar las de los paños",
  [luz.lado, luz.nivel], ["abajo", 2]);
comp("hay una cota por paño", an.cotas.filter((c) => c.texto === "1,667").length, 12);
cierto("la altura de columna se acota a la izquierda",
  an.cotas.some((c) => c.lado === "izq" && c.texto === "6,00 m"));
cierto("y la altura total hasta la cumbre, 6 + 1,2 + 2,0 = 9,20",
  an.cotas.some((c) => c.texto === "9,20 m"));
cierto("el peralte del centro va a la derecha, donde se ve",
  an.cotas.some((c) => c.lado === "der" && c.texto === "3,20"));

const circ = an.etiquetas.filter((e) => e.forma === "circulo");
comp("los ejes de columna van en círculo, como en un plano", circ.length, 2);
comp("y se llaman A y B", circ.map((e) => e.texto), ["A", "B"]);
cierto("los nudos llevan su id, que es como los nombra el panel derecho",
  an.etiquetas.some((e) => e.texto === "I0") &&
  an.etiquetas.some((e) => /^S\d+$/.test(e.texto)));
comp("y hay dos líneas de eje, una por columna", an.ejes.length, 2);

/* la planta numera los pórticos y marca el paño arriostrado */
const anP = V.anotaciones("planta", m3);
comp("la planta numera los once pórticos",
  anP.etiquetas.filter((e) => e.forma === "circulo").length, 11);
comp("con una línea de eje cada uno", anP.ejes.length, 11);
cierto("y marca dónde está el arriostre, que es lo que esta vista enseña",
  anP.etiquetas.some((e) => e.texto === "arriostrado"));
cierto("el largo se acota", anP.cotas.some((c) => c.texto === "60,00 m"));

/* la elevación marca los puntos fijos de la dilatación */
const anE = V.anotaciones("elev", m3);
comp("la elevación dibuja un apoyo por pórtico", anE.apoyos.length, 11);
cierto("y marca los puntos fijos, que es lo que esta vista enseña",
  anE.etiquetas.some((e) => e.texto === "punto fijo"));
comp("la 3D no se acota: una isométrica acotada no es una isométrica",
  V.anotaciones("tresd", m3).cotas.length, 0);

/* ================================================================
   7c · LAS TABLAS · la de perfiles es la que faltaba para trabajar
   ================================================================ */
const tp0 = V.tablaPerfiles(m3, null);
comp("hay una fila por clase de barra del modelo", tp0.clases, 10);
comp("y sin modelo, ninguna tiene perfil", tp0.sinPerfil, 10);
cierto("ordenadas por número de barras, que es por donde se empieza",
  tp0.filas[0].barras >= tp0.filas[tp0.filas.length - 1].barras);
cierto("y se dice lo que significa no tenerlos",
  /el análisis necesita A e I/.test(tp0.nota));

const LIBRO = require("../src/libro.js");
let mod = LIBRO.nuevo({ luz_m: 20 });
mod = LIBRO.asignaPerfil(mod, { clase: "diagonal" }, "L2½x2½x¼").modelo;
const tp1 = V.tablaPerfiles(m3, mod);
comp("asignando uno, queda una clase menos sin perfil", tp1.sinPerfil, 9);
comp("y la diagonal lo enseña",
  tp1.filas.filter((f) => f.clase === "diagonal")[0].perfil, "L2½x2½x¼");
cierto("las demás siguen marcadas como sin asignar",
  tp1.filas.filter((f) => f.clase === "columna")[0].sinPerfil === true);

const tn = V.tablaPanos(m3);
comp("una fila por paño", tn.filas.length, 10);
comp("y dice entre qué pórticos está cada uno", tn.filas[0].entre, "1 – 2");
comp("el paño 5 está arriostrado en los dos planos",
  [tn.filas[5].techo, tn.filas[5].fachada], [true, true]);
cierto("y por eso está alineado", tn.filas[5].alineado === true);
comp("el 4 no lo está en ninguno", [tn.filas[4].techo, tn.filas[4].fachada],
  [false, false]);
cierto("la nota dice que la viga de alero solo amarra",
  /solo amarra/.test(tn.nota));

const desal2 = MON.monta(Object.assign({}, D, {
  panosArriostradosTecho: [2], panosArriostradosFachada: [7]
}));
const tnD = V.tablaPanos(desal2);
cierto("con el techo en el 2 y la fachada en el 7, los dos salen desalineados",
  tnD.filas[2].alineado === false && tnD.filas[7].alineado === false);
cierto("y la nota da los metros de alero a axial",
  /30,00 m de alero a AXIAL/.test(tnD.nota));

/* ================================================================
   7d · VER Y AISLAR · lo que sustituye a la paleta de dibujo

   Aquí había una paleta de dibujo copiada de Retícula y era un error de
   método: en Retícula la planta es LIBRE y dibujar es imprescindible; en
   un galpón no hay nada libre, todo sale de los parámetros. Lo que hace
   falta no es dibujar: es poder mirar un modelo de 733 barras.
   ================================================================ */
const cp = V.capas(m3, {});
comp("una capa por clase de barra", cp.filas.length, 10);
comp("y con todo encendido se ven las 733", cp.barrasVisibles, 733);
cierto("ordenadas por número de barras", cp.filas[0].barras >= cp.filas[9].barras);
cierto("cada capa sabe en qué plano vive",
  cp.filas.every((f) => typeof f.plano === "string"));

const apag = V.capas(m3, { apagadas: { correa: true, "viga de alero": true } });
comp("apagando correas y vigas de alero quedan 583", apag.barrasVisibles, 583);
comp("y se dice cuántas clases se ocultaron", apag.nota, "ocultas 2 clase(s)");
cierto("las apagadas se marcan como no visibles",
  apag.filas.filter((f) => f.clase === "correa")[0].visible === false);

const ais = V.capas(m3, { aislada: "diagonal" });
comp("aislando las diagonales quedan 132", ais.barrasVisibles, 132);
comp("y una sola clase visible", ais.clasesVisibles, 1);
cierto("LO DEMÁS SIGUE EN EL MODELO, solo no se dibuja",
  /sigue en el modelo/.test(ais.nota) && ais.barrasTotales === 733);
comp("filtra() devuelve justo esas barras",
  V.filtra(m3.barras, { aislada: "diagonal" }).length, 132);
comp("y sin estado, todas", V.filtra(m3.barras, {}).length, 733);

/* ================================================================
   7e · LA SELECCIÓN · el panel contextual
   ================================================================ */
const idD = m3.barras.filter((b) => b.clase === "diagonal")[0].id;
let modS = LIBRO.nuevo({});
modS = LIBRO.asignaPerfil(modS, { clase: "diagonal" }, "L4X4X1/2").modelo;
const sel = V.seleccion(m3, modS, idD);
comp("la barra seleccionada se identifica", sel.id, idD);
comp("con su clase", sel.clase, "diagonal");
cierto("y su longitud medida", sel.longitud_m > 0);
const dq = (ls, q) => (ls.filter((l) => l.q === q)[0] || {});
comp("dice entre qué nudos va", dq(sel.lineas, "Entre nudos").origen, "geometria");
comp("y en qué plano", dq(sel.lineas, "Plano").origen, "norma");
comp("el perfil, con su procedencia de entrada",
  dq(sel.lineas, "Perfil").v, "L4X4X1/2");
cierto("y de dónde viene la asignación",
  /toda la clase/.test(dq(sel.lineas, "Perfil").nota));
cierto("trae el área del catálogo", dq(sel.lineas, "Área").v !== undefined);
cierto("y el peso de ESTA barra, que es área por longitud",
  dq(sel.lineas, "Peso de esta barra").v !== undefined);

/* LO QUE NO DICE, Y SE DICE QUE NO LO DICE */
comp("el ratio NO se inventa", dq(sel.lineas, "Ratio").v, "falta el análisis");
cierto("y se explica por qué: el análisis es el paso 3",
  /PASO 3/.test(dq(sel.lineas, "Ratio").nota));
cierto("diciendo que un número aquí sería justo lo que no se hace",
  /lo que este proyecto no hace/.test(dq(sel.lineas, "Ratio").nota));
cierto("la selección se marca como pendiente de análisis", sel.faltaAnalisis === true);

/* sin perfil, lo dice y explica qué bloquea */
const sinP = V.seleccion(m3, LIBRO.nuevo({}), idD);
comp("sin perfil asignado, lo dice", dq(sinP.lineas, "Perfil").v, "sin asignar");
comp("y lo marca en rojo", dq(sinP.lineas, "Perfil").estado, "no");
cierto("explicando que sin A ni I no corre el análisis",
  /sin A ni I/.test(dq(sinP.lineas, "Perfil").nota));

comp("una barra que no existe devuelve null", V.seleccion(m3, modS, "NO.EXISTE"), null);

/* TODAS las líneas de la selección declaran procedencia, como las demás */
comp("ninguna línea de la selección sin procedencia",
  sel.lineas.filter((l) => V.ORIGENES.indexOf(l.origen) < 0), []);
comp("y las de norma citan filas que existen",
  sel.lineas.filter((l) => l.origen === "norma" && !INV.existe(l.fuente)), []);

/* ================================================================
   8 · LAS FILAS DEL INVENTARIO
   ================================================================ */
for (const id of ["V.procedencia", "V.no.duplica", "V.limites",
  "V.isometrica", "V.profundidad"]) {
  cierto("la fila " + id + " existe y tiene fuente",
    INV.existe(id) && !!INV.fila(id).fuente);
}
cierto("V.procedencia cuenta el agujero que lo originó",
  /veintitr[ée]s/.test(INV.fila("V.procedencia").nota) &&
  /doce/.test(INV.fila("V.procedencia").nota));
cierto("V.no.duplica dice por qué no se copian las reglas",
  /discrepen/.test(INV.fila("V.no.duplica").nota));

/* ================================================================
   LOS PASOS · CADA UNO CON SU ARMAZON

   ESTABA MAL Y SE VEIA: la barra de vistas -Portico, Planta, Elevacion,
   3D- y el panel de la izquierda -Ver y Datos- son de GEOMETRIA, y se
   colaban en los once pasos. Al entrar en Cargas seguias viendo las capas
   de barras y los parametros del tijeral, que alli no pintan nada.

   Se comprueba AQUI y no mirando la pagina porque mirando es como se
   colo: el armazon parecia el de todos los pasos porque era el de todos.
   ================================================================ */
/* UNO O NINGUNO, PERO NUNCA UN TypeError. Una prueba que muere no informa:
   el corredor solo imprime en fin(), asi que un [0] sobre un filtro vacio se
   lleva por delante las comprobaciones que venian detras. Bajo un mutante es
   justo cuando el filtro se queda vacio, o sea justo cuando mas falta hace
   que la prueba HABLE. */
const uno = (a, campo) => (a.length === 1 && a[0][campo] !== undefined)
  ? a[0][campo] : ("no hay exactamente uno: " + a.length);

comp("son once pasos", V.PASOS.length, 11);
comp("y los del diagrama, en orden",
  V.PASOS.map((p) => p.id),
  ["inicio", "datos", "geom", "cargas", "analisis", "diseno", "conex",
    "cimen", "comprob", "hojas", "cad"]);
comp("ninguno repite id", V.PASOS.length,
  V.PASOS.filter((p, i, a) => a.map((x) => x.id).indexOf(p.id) === i).length);
comp("y todos dicen a que grupo del diagrama pertenecen",
  V.PASOS.filter((p) => !p.grupo).map((p) => p.id), []);

/* LA BARRA DE VISTAS ES DE GEOMETRIA, Y DE NADIE MAS */
comp("SOLO Geometria lleva la barra de cuatro vistas",
  V.PASOS.filter((p) => p.vistas).map((p) => p.id), ["geom"]);
comp("LOS PANELES DE GEOMETRIA —Ver y Datos— solo los lleva Geometria",
  V.PASOS.filter((p) => (p.lados || []).some((l) => l === "ver" || l === "parametros"))
    .map((p) => p.id), ["geom"]);
comp("y cada paso con panel a la izquierda lleva EL SUYO",
  V.PASOS.filter((p) => (p.lados || []).length).map((p) => p.id + ":" + p.lados.join("+")),
  ["geom:ver+parametros", "cargas:cargas", "analisis:analisis"]);
comp("Analisis lleva panel derecho sin la barra de cuatro vistas",
  [V.armazon("analisis").derecha, V.armazon("analisis").vistas], [true, false]);
comp("Cargas no lleva panel derecho", V.armazon("cargas").derecha, false);
comp("con sus dos lados: las capas y los parametros",
  V.armazon("geom").lados, ["ver", "parametros"]);
comp("CARGAS NO ENSENA LA BARRA DE VISTAS", V.armazon("cargas").vistas, false);
comp("ni los parametros del tijeral: lleva los suyos", V.armazon("cargas").lados, ["cargas"]);
comp("ni Comprobacion", V.armazon("comprob").vistas, false);
comp("ni Inicio", V.armazon("inicio").vistas, false);

/* un paso que no existe PARA, con la lista delante */
lanza("pedir un paso que no existe PARA", () => V.armazon("cimentacion"),
  "no existe");
lanza("y ensena los que hay", () => V.armazon("xx"), "inicio · datos · geom");

/* los que no estan listos no se fingen: dicen que hara falta */
const flojos = V.PASOS.filter((p) => !p.listo);
comp("los pasos sin pantalla dicen QUE ensenaran",
  flojos.filter((p) => !p.que).map((p) => p.id), []);
comp("y QUIEN la hara", flojos.filter((p) => !p.hara).map((p) => p.id), []);
comp("y si el motor esta escrito", flojos.filter((p) => !p.motor).map((p) => p.id), []);
comp("los que si tienen pantalla llevan subtitulo en vez de excusa",
  V.PASOS.filter((p) => p.listo && !p.sub).map((p) => p.id), []);
comp("cinco estan llenos hoy", V.PASOS.filter((p) => p.listo).map((p) => p.id),
  ["inicio", "geom", "cargas", "analisis", "comprob"]);

/* ---------------- INICIO · el tablero ---------------- */
const tab = V.inicio(m3, null);
comp("el tablero trae tres fichas", tab.length, 3);
comp("y las tres que importan al abrir el archivo tres semanas despues",
  tab.map((f) => f.titulo), ["El galpón", "Los pasos", "El inventario"]);
const lTab = tab.reduce((a, f) => a.concat(f.lineas), []);
comp("NI UNA linea del tablero sin procedencia",
  lTab.filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);
comp("dice el area techada, que es lo primero que se pregunta",
  uno(lTab.filter((l) => /Área techada/.test(l.q)), "v"), "1200 m²");
comp("y cuantas filas tiene el inventario",
  uno(lTab.filter((l) => l.q === "Filas"), "v"), String(INV.resumen().total));
comp("el tablero sin galpon montado no revienta: ensena dos fichas",
  V.inicio(null, null).length, 2);

/* ---------------- COMPROBACION · lo que las guardas tienen que decir ----
   Las guardas LANZAN cuando algo es imposible, y eso se ve enseguida. Lo
   que no se ve es lo que es legal pero cuesta. Esta es esa lista. */
const cmp = V.comprobacion(m3, null);
cierto("la comprobacion dice algo", cmp.total >= 3);
comp("los niveles son tres y ninguno mas",
  cmp.lista.filter((a) => V.NIVELES.indexOf(a.nivel) < 0), []);
/* EL ORDEN, CON UN CASO QUE LO DISTINGA. Con el galpon de siempre los
   avisos ya salian antes que las notas por casualidad del orden en que se
   empujan, asi que quitar el sort() no fallaba: la comprobacion era una
   TAUTOLOGIA y el mutante la sobrevivio. Hace falta un galpon donde un
   aviso se empuje DESPUES de una nota, y lo da la dilatacion: se empuja
   tercera, detras de la nota del camino de carga, y solo salta cuando hay
   DOS panos arriostrados -dos puntos fijos y algo preso entre ellos-. */
const dosPanos = MON.monta(Object.assign({}, D, {
  panosArriostradosTecho: [2, 8], panosArriostradosFachada: [2, 8]
}));
cierto("el caso elegido SI distingue: hay metros presos que avisan",
  dosPanos.dilatacion.longitudPresa_m > 0);
const cDos = V.comprobacion(dosPanos, null);
cierto("y ese aviso se empuja detras de una nota, que es lo que el orden arregla",
  cDos.lista.filter((a) => a.nivel === "nota").length > 0 &&
  cDos.lista.filter((a) => /no pueden dilatar/.test(a.que)).length === 1);
comp("vienen ordenados por gravedad", cDos.lista.map((a) => a.nivel),
  cDos.lista.map((a) => a.nivel).slice()
    .sort((a, b) => V.NIVELES.indexOf(a) - V.NIVELES.indexOf(b)));
comp("y el de siempre tambien", cmp.lista.map((a) => a.nivel),
  cmp.lista.map((a) => a.nivel).slice()
    .sort((a, b) => V.NIVELES.indexOf(a) - V.NIVELES.indexOf(b)));
comp("la insignia cuenta errores y avisos, no notas",
  cmp.insignia, cmp.cuenta.error + cmp.cuenta.aviso);
comp("cada aviso explica por que", cmp.lista.filter((a) => !a.porque &&
  a.nivel !== "nota").map((a) => a.que), []);
comp("y el que cita una fila, la cita de verdad",
  cmp.lista.filter((a) => a.fuente && !INV.existe(a.fuente)).map((a) => a.fuente), []);
comp("el que manda a un paso, manda a uno que existe",
  cmp.lista.filter((a) => a.paso && !V.PASOS.filter((p) => p.id === a.paso).length)
    .map((a) => a.paso), []);

/* SIN PERFILES NO HAY NADA QUE VERIFICAR, y lo dice */
comp("avisa de las clases sin perfil, que es lo que bloquea el analisis",
  cmp.lista.filter((a) => /sin perfil asignado/.test(a.que)).length, 1);
comp("y enumera CUALES, en vez de decir «hay 10»",
  (uno(cmp.lista.filter((a) => a.cuales), "cuales") || []).length, 10);

/* EL ALERO A AXIAL · el aviso que el galpon alineado NO tiene que dar */
cierto("con techo y fachada en el mismo pano, el alero solo amarra",
  cmp.lista.filter((a) => /mismos paños/.test(a.que)).length === 1);
const cdes = V.comprobacion(desalineado, null);
const axial = cdes.lista.filter((a) => /paños distintos/.test(a.que));
comp("desalineados, EL AVISO SALE", axial.length, 1);
comp("y es aviso, no nota", uno(axial, "nivel"), "aviso");
const porqueAxial = String(uno(axial, "porque"));
cierto("y dice quien se come la reaccion: la viga de alero, A AXIAL",
  /AXIAL/.test(porqueAxial) && /puntal/.test(porqueAxial));
cierto("y a que paso hay que ir a arreglarlo", uno(axial, "paso") === "geom");
cierto("la insignia del desalineado es mayor", cdes.insignia > cmp.insignia);

/* LO QUE AL PROYECTO LE FALTA, EN LA MISMA LISTA */
const pends = cmp.lista.filter((a) => a.pendiente);
comp("los tres pendientes de norma salen aqui, no en un cuaderno aparte",
  pends.length, INV.resumen().pendiente);
comp("y cada uno nombra su fila",
  pends.filter((a) => !INV.existe(a.pendiente)), []);

fin();
