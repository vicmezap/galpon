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
comp("nace sin ediciones encima", m0.ediciones.length, 0);
comp("con su formato", m0.formato, L.FORMATO);
comp("y con las secciones vacías pero presentes",
  [Object.keys(m0.secciones.porClase).length, Object.keys(m0.secciones.porBarra).length],
  [0, 0]);
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
comp("el modelo vuelve con sus ediciones", v.modelo.ediciones.length, 0);
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
cierto("entre ellas los parámetros, las secciones y las ediciones",
  g.parametros !== undefined && g.secciones !== undefined &&
  g.ediciones !== undefined);

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
   8 · LAS CAPAS · filas L.suelto, L.secciones y L.perdidas

   Esto se decidió primero al revés —que el modelo «se soltara» al primer
   cambio manual, apagando los parámetros— y se rectificó el mismo día.
   Lo que lo tumbó está comprobado abajo: asignar un perfil, que es la
   edición más frecuente del proyecto, habría apagado la pendiente.
   ================================================================ */
cierto("al nacer, los parámetros se tocan", L.parametrosEditables(m0).editables);

/* ───── LOS PERFILES SON ENTRADA, NO EDICIÓN · fila L.secciones ───── */
let mp = L.asignaPerfil(m0, { clase: "diagonal" }, "L2½x2½x¼").modelo;
mp = L.asignaPerfil(mp, { barra: "D7" }, "L3x3x¼").modelo;
comp("por clase, todas las diagonales", L.perfilDe(mp, { id: "D5", clase: "diagonal" }).perfil,
  "L2½x2½x¼");
comp("y se sabe que vino de la clase", L.perfilDe(mp, { id: "D5", clase: "diagonal" }).de,
  "clase");
comp("la excepción por barra manda sobre la clase",
  L.perfilDe(mp, { id: "D7", clase: "diagonal" }).perfil, "L3x3x¼");
comp("y se sabe que vino de la barra", L.perfilDe(mp, { id: "D7", clase: "diagonal" }).de,
  "barra");
comp("una barra sin perfil ni por clase lo dice",
  L.perfilDe(mp, { id: "BS0", clase: "brida superior" }).perfil, null);

cierto("ASIGNAR PERFILES NO APAGA LOS PARÁMETROS · es lo que tumbó la otra opción",
  L.parametrosEditables(mp).editables === true);
cierto("y la fila lo cuenta: es el bucle del diseño en acero",
  /ASIGNAR UN PERFIL/.test(INV.fila("L.suelto").nota) &&
  /rectific/.test(INV.fila("L.suelto").nota));
lanza("asignar por clase Y por barra a la vez PARA",
  () => L.asignaPerfil(m0, { clase: "diagonal", barra: "D7" }, "x"), "no las dos");

/* Una excepción por barra que se queda sin dueño se avisa, no se borra */
const huer = L.perfilesHuerfanos(mp, { barras: [{ id: "D5" }, { id: "BS0" }] });
comp("D7 ya no existe: la excepción se queda huérfana", huer.huerfanos, ["D7"]);
cierto("y se conserva por si vuelve", /Se conservan/.test(huer.nota));
comp("con las barras puestas, ninguna huérfana",
  L.perfilesHuerfanos(mp, { barras: [{ id: "D7" }] }).huerfanos, []);

/* ───── LAS CAPAS GEOMÉTRICAS ───── */
let mc = L.edita(mp, { tipo: "mover", nudo: "I3", dx_m: 0, dy_m: 0.2 }).modelo;
const e2 = L.edita(mc, { tipo: "borrar", barra: "D11" });
mc = e2.modelo;
comp("dos ediciones apiladas", mc.ediciones.length, 2);
cierto("y los parámetros SIGUEN tocándose", L.parametrosEditables(mc).editables === true);
cierto("la nota lo dice: se reaplican encima",
  /se vuelve a aplicar encima/.test(e2.nota));
cierto("y parametrosEditables cuenta cuántas hay encima",
  /2 edición\(es\) encima/.test(L.parametrosEditables(mc).porque));

lanza("un tipo de edición inventado PARA",
  () => L.edita(mc, { tipo: "retorcer", nudo: "I3" }), "desconocido");
lanza("mover sin decir cuánto PARA",
  () => L.edita(mc, { tipo: "mover", nudo: "I3" }), "dx_m y dy_m");
lanza("borrar sin barra PARA", () => L.edita(mc, { tipo: "borrar" }), "id de la barra");

/* ───── REAPLICAR ───── */
const BASE12 = {
  nudos: [{ id: "I3", x_m: 5, y_m: 0 }, { id: "I4", x_m: 6, y_m: 0 }],
  barras: [{ id: "D11", i: "I3", j: "I4", clase: "diagonal" },
    { id: "D1", i: "I3", j: "I4", clase: "diagonal" }]
};
const r12 = L.aplica(BASE12, mc.ediciones);
comp("las dos capas entran", r12.reaplicadas.length, 2);
comp("ninguna se pierde", r12.perdidas.length, 0);
cerca("el nudo I3 queda movido 0,20 m", r12.nudos[0].y_m, 0.2, 1e-12);
cierto("y marcado como editado, que es una procedencia propia",
  r12.nudos[0].editado === true);
comp("y la barra borrada ya no está", r12.barras.map((b) => b.id), ["D1"]);
cierto("la base NO se toca: aplica() no muta lo que recibe",
  BASE12.nudos[0].y_m === 0 && BASE12.barras.length === 2);

/* ───── LO QUE NO CABE SE AVISA Y SE CONSERVA · fila L.perdidas ───── */
const BASE8 = { nudos: [{ id: "I3", x_m: 5, y_m: 0 }],
  barras: [{ id: "D1", i: "I3", j: "I3", clase: "diagonal" }] };
const r8 = L.aplica(BASE8, mc.ediciones);
/* Indexar perdidas[0] sin red mata la prueba en vez de reportarla cuando la
   lista viene vacia: el runner solo imprime al final, asi que el proceso se
   muere sin decir nada. Es la SEGUNDA vez que me pasa —ya ocurrio en
   probar_complemento.js— asi que aqui va con red desde el principio. */
const perdida = (r, i) => (r.perdidas[i || 0] || { edicion: {}, porque: "" });
comp("con menos paños, una capa se queda sin sitio", r8.perdidas.length, 1);
comp("y es la de borrar D11", perdida(r8).edicion.barra, "D11");
cierto("CON SU MOTIVO, no solo «falló»", /ya no existe/.test(perdida(r8).porque));
comp("la otra sí entra", r8.reaplicadas.length, 1);
cierto("aplica() NO lanza por una capa perdida: es un aviso, no un error",
  r8.perdidas.length > 0 && Array.isArray(r8.nudos));
cierto("y la nota dice que no se han borrado", /NO se han borrado/.test(r8.nota));

comp("EL MODELO CONSERVA SUS DOS EDICIONES", mc.ediciones.length, 2);
const otraVez = L.aplica(BASE12, mc.ediciones);
comp("así que al volver a los paños de antes, la edición VUELVE SOLA",
  otraVez.perdidas.length, 0);
comp("y vuelven a entrar las dos", otraVez.reaplicadas.length, 2);

/* añadir */
const mAdd = L.edita(m0, { tipo: "anadir",
  barra: { id: "X1", i: "I3", j: "I4", clase: "arriostre de techo" } }).modelo;
const rAdd = L.aplica(BASE12, mAdd.ediciones);
comp("añadir una barra la pone", rAdd.barras.length, 3);
cierto("marcada como editada",
  rAdd.barras.filter((b) => b.id === "X1")[0].editado === true);
const rDup = L.aplica(BASE12, [{ tipo: "anadir",
  barra: { id: "D1", i: "I3", j: "I4", clase: "diagonal" } }]);
comp("añadir una que ya existe se pierde, con su motivo", rDup.perdidas.length, 1);
cierto("y el motivo lo dice", /ya hay una barra/.test(perdida(rDup).porque));
const rSinNudo = L.aplica(BASE8, [{ tipo: "anadir",
  barra: { id: "X2", i: "I3", j: "I99", clase: "diagonal" } }]);
cierto("y si falta un extremo, también, nombrándolo",
  rSinNudo.perdidas.length === 1 && /I99/.test(perdida(rSinNudo).porque));

/* ───── OLVIDAR, QUE HAY QUE PEDIRLO ───── */
const olv = L.olvidaEdiciones(mc);
comp("olvidar todas las quita", olv.modelo.ediciones.length, 0);
comp("y dice cuántas", olv.olvidadas, 2);
cierto("y que no se deshace", /no se deshace/.test(olv.nota));
const olv1 = L.olvidaEdiciones(mc, [1]);
comp("olvidar una deja la otra", olv1.quedan, 1);
comp("y es la que no se olvidó", olv1.modelo.ediciones[0].tipo, "mover");

/* ───── LAS CAPAS VIAJAN AL LIBRO ───── */
const vc = L.vaYVuelve(mc, FECHA);
comp("el modelo vuelve con sus dos ediciones", vc.modelo.ediciones.length, 2);
comp("y con sus perfiles por clase",
  vc.modelo.secciones.porClase.diagonal, "L2½x2½x¼");
comp("y la excepción por barra", vc.modelo.secciones.porBarra.D7, "L3x3x¼");

lanza("un modelo sin lista de ediciones PARA",
  () => L.valida({ parametros: {}, secciones: { porClase: {}, porBarra: {} } }),
  "lista de ediciones");
lanza("y uno sin secciones también",
  () => L.valida({ parametros: {}, ediciones: [] }), "secciones");

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
  "L.editado", "L.secciones", "L.perdidas", "L.particion"]) {
  cierto("la fila " + id + " existe y tiene fuente",
    INV.existe(id) && !!INV.fila(id).fuente);
}
cierto("L.particion es VERIFICADO: está leído del código de Retícula",
  INV.fila("L.particion").estado === "verificado" &&
  /partici[óo]n de almacenamiento/.test(INV.fila("L.particion").nota));
cierto("L.suelto cuenta que se eligió al revés primero y por qué se rectificó",
  /se rectific/i.test(INV.fila("L.suelto").nota) &&
  /ASIGNAR UN PERFIL/.test(INV.fila("L.suelto").nota));
cierto("y dice entero el precio de esta opción",
  /PRECIO DE ESTA OPCIÓN/.test(INV.fila("L.suelto").nota));
cierto("L.secciones explica que un perfil no puede quedarse huérfano",
  /HUÉRFANA/.test(INV.fila("L.secciones").nota));
cierto("L.perdidas explica que ir y volver no destruye trabajo",
  /VUELVE SOLA/.test(INV.fila("L.perdidas").nota));
cierto("L.editado explica que lo arrastrado no es reproducible",
  /REPRODUCIBLE/.test(INV.fila("L.editado").nota));
cierto("L.solo.entradas se apoya en la regla que ya existía",
  /Z\.costura/.test(INV.fila("L.solo.entradas").nota));
cierto("L.formato avisa de que se niega a adivinar",
  /adivinar/.test(INV.fila("L.formato").nota));

/* ================================================================
   EL SITIO Y EL SISTEMA · lo que necesita el análisis
   ================================================================ */
const conSitio = L.nuevo({ sitio: { espesorCobertura_mm: 0.4, V_kmh: 75, hayNieve: false,
  aberturas: "repartidas", acero: "A36" }, sistema: { base: "empotrada", union: "rigida" } });
const vuelta = L.deserializa(L.serializa(conSitio, "2026-10-01"));
comp("los datos del sitio se guardan y vuelven", vuelta.modelo.sitio, conSitio.sitio);
comp("el sistema también", vuelta.modelo.sistema, { base: "empotrada", union: "rigida" });
comp("un modelo nuevo NO trae sistema: lo decide el proyectista (fila A.sistema)",
  L.nuevo({}).sistema, null);
cierto("y sin sistema se guarda igual, sin la clave", L.paraGuardar(L.nuevo({})).sistema === undefined);
lanza("un dato de sitio desconocido PARA, no se pierde en silencio",
  () => L.paraGuardar(L.nuevo({ sitio: { velocidad: 75 } })), "desconocidos");
lanza("un sistema con valores inventados PARA",
  () => L.paraGuardar(L.nuevo({ sistema: { base: "semirrígida", union: "rigida" } })), "empotrada");
lanza("y con claves de más también",
  () => L.paraGuardar(L.nuevo({ sistema: { base: "empotrada", union: "rigida", R: 4 } })), "desconocidas");

fin();
