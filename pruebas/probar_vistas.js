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

fin();
