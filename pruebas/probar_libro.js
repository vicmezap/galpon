/* =====================================================================
   probar_libro.js — el modelo dentro del libro

   Esto es la frontera con Excel, y casi toda ella se puede comprobar sin
   Excel: serializar, trocear, recomponer y negarse.  Lo que queda fuera
   son las llamadas a Excel.run y messageChild, que son diez líneas.

   La comprobación que más vale es la del PADDING: guardar un modelo
   grande y luego uno pequeño sin blanquear el resto de las celdas deja la
   cola del viejo detrás del nuevo, y al leer se concatenan los dos. El
   JSON resultante no es válido y el libro parece corrupto. Pasa una vez y
   no se olvida; mejor que no pase.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const L = require("../src/libro.js");
const INV = require("../src/inventario.js");

const PAR = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20,
  cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5],
  columnasHastiales: [5, 10, 15]
};
const FECHA = "2026-10-01T01:20:00.000Z";
const m0 = L.nuevo(Object.assign({ nombre: "Nave Chorrillos" }, PAR));

/* ================================================================
   1 · LOS NÚMEROS QUE SE COPIAN DE RETÍCULA · fila L.trozo
   ================================================================ */
comp("el trozo de celda son 30 000 caracteres", L.TROZO, 30000);
cierto("y cabe en una celda de Excel, que admite 32 767", L.TROZO < 32767);
comp("caben 200 celdas", L.MAX_FILAS, 200);
comp("el rango es A1:A200", L.RANGO, "A1:A200");
comp("el trozo de mensaje son 8 000", L.TROZO_MSG, 8000);
comp("la hoja va MUY oculta, no solo oculta", L.VISIBILIDAD, "veryHidden");
comp("y se llama con el prefijo del complemento", L.HOJA_MODELO, "GALPON_MODELO");
cierto("la fila cita de dónde salen los números", /Ret[íi]cula/.test(INV.art("L.trozo")));

/* ================================================================
   2 · EL MODELO NUEVO
   ================================================================ */
comp("nace paramétrico", m0.estado, "parametrico");
comp("con su formato", m0.formato, L.FORMATO);
comp("sin geometría, que todavía no hay", m0.geometria, null);
comp("y con los parámetros que se le dieron",
  Object.keys(m0.parametros).sort().length, 12);
cierto("los parámetros que llegaron están todos",
  Object.keys(PAR).every((k) => m0.parametros[k] !== undefined));
comp("una clave desconocida en nuevo() simplemente no entra",
  L.nuevo({ luz_m: 20, loQueSea: 1 }).parametros.loQueSea, undefined);

/* ================================================================
   3 · IDA Y VUELTA
   ================================================================ */
const v = L.vaYVuelve(m0, FECHA);
comp("el modelo vuelve con el mismo estado", v.modelo.estado, "parametrico");
comp("y el mismo nombre", v.modelo.nombre, "Nave Chorrillos");
comp("y los mismos parámetros", v.modelo.parametros, m0.parametros);
comp("el formato leído es el escrito", v.formato, L.FORMATO);
comp("y la fecha de guardado viaja", v.guardado, FECHA);

const texto = L.serializa(m0, FECHA);
comp("la cabecera es GALPON, formato y fecha, separados por tabulador",
  texto.slice(0, texto.indexOf("\n")).split("\t"), ["GALPON", "1", FECHA]);
cierto("y debajo va JSON", texto.slice(texto.indexOf("\n") + 1)[0] === "{");

/* ================================================================
   4 · LO QUE SE NIEGA A LEER · fila L.formato
   ================================================================ */
lanza("la hoja de OTRO complemento PARA",
  () => L.deserializa("RETICULA\t3\t2026-09-29\n{\"niveles\":2}"),
  "no es un modelo de Galpón");
cierto("y explica que en el libro conviven varios",
  (() => {
    try { L.deserializa("RETICULA\t3\tx\n{}"); }
    catch (e) { return /convivir varios complementos/.test(e.message); }
  })());

lanza("un formato MÁS NUEVO del que se conoce PARA",
  () => L.deserializa("GALPON\t9\t" + FECHA + "\n{}"), "formato 9");
cierto("y dice que se niega en vez de interpretar a medias",
  (() => {
    try { L.deserializa("GALPON\t9\tx\n{}"); }
    catch (e) { return /a medias/.test(e.message) && /Actualiza el complemento/.test(e.message); }
  })());
cierto("pero un formato IGUAL o más viejo sí se lee",
  L.deserializa(L.serializa(m0, FECHA)).formato === 1);

lanza("texto sin cabecera PARA", () => L.deserializa("{\"a\":1}"), "no tiene cabecera");
lanza("cabecera buena y JSON roto PARA",
  () => L.deserializa("GALPON\t1\t" + FECHA + "\n{esto no es json"), "no es JSON válido");
cierto("y sugiere lo que suele ser",
  (() => {
    try { L.deserializa("GALPON\t1\tx\n{roto"); }
    catch (e) { return /editado a mano/.test(e.message); }
  })());
lanza("deserializar nada PARA", () => L.deserializa(""), "no ha recibido texto");

/* ================================================================
   5 · LA LISTA BLANCA · fila L.solo.entradas
   ================================================================ */
lanza("una clave desconocida en el modelo PARA",
  () => L.paraGuardar(Object.assign({}, m0, { conteo: { b: 49 } })), "conteo");
cierto("y dice POR QUÉ no se descarta en silencio",
  (() => {
    try { L.paraGuardar(Object.assign({}, m0, { ratios: [] })); }
    catch (e) { return /pierde trabajo sin\n  avisar/.test(e.message); }
  })());
cierto("y manda a la regla que ya existía para la cimentación",
  (() => {
    try { L.paraGuardar(Object.assign({}, m0, { fuerzas: {} })); }
    catch (e) { return /E\.090/.test(e.message) || /costura/i.test(e.message); }
  })());
lanza("un parámetro desconocido PARA",
  () => L.paraGuardar(Object.assign({}, L.nuevo(PAR),
    { parametros: Object.assign({}, PAR, { inventado_m: 3 }) })), "inventado_m");

/* Y lo que SÍ pasa */
const g = L.paraGuardar(m0);
comp("lo guardado solo trae las claves de la lista",
  Object.keys(g).filter((k) => L.CLAVES.indexOf(k) < 0), []);
cierto("entre ellas los parámetros y el estado",
  g.parametros !== undefined && g.estado !== undefined);

/* ================================================================
   6 · TROCEAR, Y EL PADDING QUE EVITA EL FALLO FEO
   ================================================================ */
comp("un modelo corto cabe en un trozo", L.trocea(texto).length, 1);
comp("exactamente 30 000 caracteres son un trozo",
  L.trocea("x".repeat(30000)).length, 1);
comp("uno más son dos", L.trocea("x".repeat(30001)).length, 2);
comp("6 000 000 son los 200 que caben", L.trocea("x".repeat(6000000)).length, 200);
lanza("uno más NO cabe y PARA", () => L.trocea("x".repeat(6000001)), "no cabe en la hoja");
cierto("y dice cuántas harían falta y que no se trunca",
  (() => {
    try { L.trocea("x".repeat(6000001)); }
    catch (e) { return /201/.test(e.message) && /No se trunca/.test(e.message); }
  })());
comp("texto vacío da un trozo vacío, no cero trozos", L.trocea(""), [""]);

/* ───── EL PADDING ─────
   Guardar un modelo grande y luego uno pequeño sin blanquear el resto
   deja la cola del viejo y al leer se concatenan los dos. */
const filas = L.paraElRango(L.trocea(texto));
comp("se escriben SIEMPRE las 200 filas", filas.length, 200);
comp("la primera trae el modelo", filas[0][0].length, texto.length);
comp("y el resto van en blanco, que es lo que borra lo que hubiera",
  filas.slice(1).every((f) => f[0] === ""), true);

const grande = L.serializa(L.nuevo(Object.assign({}, PAR,
  { nombre: "x".repeat(70000) })), FECHA);
const hojaGrande = L.paraElRango(L.trocea(grande));
cierto("un modelo de 3 trozos ocupa tres celdas",
  hojaGrande[0][0] !== "" && hojaGrande[1][0] !== "" && hojaGrande[2][0] !== "");
/* ahora se guarda encima uno corto, sobre LA MISMA hoja */
const hojaCorta = L.paraElRango(L.trocea(texto));
const releido = L.junta(hojaCorta);
comp("al guardar uno corto encima, lo que se lee es SOLO el corto",
  releido, texto);
cierto("y se abre sin problema", L.deserializa(releido).modelo.nombre === "Nave Chorrillos");
/* la demostración de que sin padding fallaría */
const sinPadding = [[texto]].concat(hojaGrande.slice(1, 3));
cierto("SIN blanquear, lo leído sería el corto pegado a la cola del viejo",
  L.junta(sinPadding).length > texto.length);
lanza("y eso no se abre", () => L.deserializa(L.junta(sinPadding)), "no es JSON válido");

/* ================================================================
   7 · JUNTAR
   ================================================================ */
comp("junta se para en la primera celda vacía",
  L.junta([["abc"], ["def"], [""], ["NO"]]), "abcdef");
comp("una hoja vacía devuelve null", L.junta([[""], [""]]), null);
comp("y una hoja de nulos también", L.junta([[null]]), null);
/* un modelo guardado por una versión que troceaba distinto se sigue leyendo */
const trocitos = [];
for (let i = 0; i < texto.length; i += 100) trocitos.push([texto.substr(i, 100)]);
comp("un modelo troceado de otra manera se lee igual", L.junta(trocitos), texto);
cierto("y se abre", L.deserializa(L.junta(trocitos)).modelo.nombre === "Nave Chorrillos");

/* ================================================================
   8 · PARAMÉTRICO Y SUELTO · fila L.suelto
   ================================================================ */
cierto("al nacer, los parámetros se tocan", L.parametrosEditables(m0).editables);

const GEO = { nudos: [{ id: "I0" }, { id: "I1" }], barras: [{ id: "BS0" }] };
const e1 = L.edita(m0, GEO, "mover el nudo I3");
comp("editar lo suelta", e1.modelo.estado, "suelto");
cierto("y lo dice la primera vez", e1.seSolto === true);
cierto("con el aviso entero: a solo lectura y cómo volver",
  /SE HA SOLTADO/.test(e1.nota) && /solo lectura/.test(e1.nota) &&
  /regenerar desde cero/.test(e1.nota));
cierto("y nombra lo que se editó", /mover el nudo I3/.test(e1.nota));
cierto("ahora los parámetros NO se tocan", L.parametrosEditables(e1.modelo).editables === false);
cierto("y se explica que si se pudieran, la pantalla mentiría",
  /dejar[íi]a de ser lo que dicen los par[áa]metros/
    .test(L.parametrosEditables(e1.modelo).porque));

const e2 = L.edita(e1.modelo, GEO, "borrar una diagonal");
cierto("editar otra vez ya no «suelta»: ya estaba suelto", e2.seSolto === false);
comp("y sigue suelto", e2.modelo.estado, "suelto");

/* EL MODELO SUELTO VIAJA CON SU GEOMETRÍA */
const vs = L.vaYVuelve(e1.modelo, FECHA);
comp("un modelo suelto se guarda y vuelve suelto", vs.modelo.estado, "suelto");
comp("con su geometría entera", vs.modelo.geometria.nudos.length, 2);
lanza("un modelo que dice estar suelto SIN geometría PARA",
  () => L.valida({ estado: "suelto", parametros: {}, geometria: null }),
  "no trae geometría");
cierto("y explica por qué eso no puede ser",
  (() => {
    try { L.valida({ estado: "suelto", parametros: {} }); }
    catch (e) { return /ya no se puede reconstruir de los par[áa]metros/.test(e.message); }
  })());

/* LA VUELTA, QUE HAY QUE PEDIRLA */
const r = L.regenera(e1.modelo, Object.assign({}, PAR, { pendiente: 0.25 }));
comp("regenerar devuelve a paramétrico", r.modelo.estado, "parametrico");
cierto("y avisa de que descartó", r.descartado === true);
comp("diciendo cuántas barras", r.barrasDescartadas, 1);
cierto("y que no se deshace", /no se deshace/.test(r.nota));
cerca("con los parámetros nuevos ya puestos", r.modelo.parametros.pendiente, 0.25, 1e-12);
comp("y sin rastro de la geometría vieja", r.modelo.geometria, null);
cierto("el nombre se conserva, que no es geometría", r.modelo.nombre === "Nave Chorrillos");
cierto("regenerar un modelo que ya era paramétrico no descarta nada",
  L.regenera(m0, PAR).descartado === false);

lanza("un estado inventado PARA", () => L.valida({ estado: "a medias", parametros: {} }),
  "desconocido");
lanza("editar sin geometría PARA", () => L.edita(m0, null), "necesita la geometría");

/* ================================================================
   9 · EL CANAL · fila L.particion
   ================================================================ */
const largo = "x".repeat(20000);
const msgs = L.troceaMensaje("mod", largo);
comp("20 000 caracteres van en 3 mensajes", msgs.length, 3);
comp("de 8 000 el primero", msgs[0].d.length, 8000);
comp("y el último con el resto", msgs[2].d.length, 4000);
comp("cada uno dice su índice y el total", [msgs[1].a, msgs[1].i, msgs[1].n],
  ["mod", 1, 3]);

const cesta = {};
let res = null;
for (const m of msgs) { const x = L.juntaMensaje(cesta, m); if (x) res = x; }
comp("se recompone igual", res, largo);
comp("y la cesta queda limpia para el siguiente envío", cesta.mod, null);

/* desordenados, que es lo que puede pasar de verdad */
const cesta2 = {};
let res2 = null;
for (const i of [0, 2, 1]) { const x = L.juntaMensaje(cesta2, msgs[i]); if (x) res2 = x; }
comp("llegando desordenados, también", res2, largo);

/* un envío a medias y otro que empieza: el i = 0 reinicia */
const cesta3 = {};
L.juntaMensaje(cesta3, msgs[0]);
L.juntaMensaje(cesta3, msgs[1]);
let res3 = null;
for (const m of msgs) { const x = L.juntaMensaje(cesta3, m); if (x) res3 = x; }
comp("un envío a medias no estropea el siguiente", res3, largo);

comp("un mensaje corto va en uno solo", L.troceaMensaje("mod", "hola").length, 1);
lanza("un mensaje mal formado PARA", () => L.juntaMensaje({}, { a: "x" }), "mal formado");

/* El modelo entero cabe en pocos mensajes, que es lo que importa */
cierto("el modelo de ejemplo viaja en un solo mensaje",
  L.troceaMensaje("mod", texto).length === 1);

/* ================================================================
   10 · LAS FILAS DEL INVENTARIO
   ================================================================ */
for (const id of ["L.formato", "L.trozo", "L.solo.entradas", "L.suelto",
  "L.editado", "L.particion"]) {
  cierto("la fila " + id + " existe y tiene fuente",
    INV.existe(id) && !!INV.fila(id).fuente);
}
cierto("L.particion es VERIFICADO: está leído del código de Retícula",
  INV.fila("L.particion").estado === "verificado" &&
  /partici[óo]n de almacenamiento/.test(INV.fila("L.particion").nota));
cierto("L.suelto cuenta que se eligió entre tres",
  /entre tres/i.test(INV.fila("L.suelto").nota) &&
  /no puede mentir/i.test(INV.fila("L.suelto").nota));
cierto("L.editado explica que lo arrastrado no es reproducible",
  /REPRODUCIBLE/.test(INV.fila("L.editado").nota));
cierto("L.solo.entradas se apoya en la regla que ya existía",
  /Z\.costura/.test(INV.fila("L.solo.entradas").nota));
cierto("L.formato avisa de que se niega a adivinar",
  /adivinar/.test(INV.fila("L.formato").nota));

fin();
