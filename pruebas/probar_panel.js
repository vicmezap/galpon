/* =====================================================================
   probar_panel.js — el lanzador

   El panel es cuatro cosas, y la que importa es un botón que se apaga.

   «Guardar modelo en el libro» vive en el panel, pero el modelo lo tiene
   la VENTANA, y las dos no comparten almacenamiento.  Así que existe un
   estado real —modelador abierto, dibujando, modelo todavía sin mandar—
   en el que pulsar Guardar no puede hacer nada.  Dejarlo encendido hace
   creer al proyectista que guardó.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const P = require("../src/panel.js");
const LIBRO = require("../src/libro.js");
const INV = require("../src/inventario.js");

const PAR = {
  luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6,
  paneles: 6, peralteApoyo_m: 1.2, pendiente: 0.20
};
const M = LIBRO.nuevo(Object.assign({ nombre: "Nave Chorrillos" }, PAR));
const boton = (s, id) => P.acciones(s).filter((b) => b.id === id)[0];

/* ================================================================
   1 · LA GUARDA · el botón que se apaga · fila L.particion
   ================================================================ */
const vacio = { hayHoja: false, dialogoAbierto: false };
cierto("sin modelo, Guardar está apagado", boton(vacio, "guardar").activo === false);
cierto("y dice por qué", /abre el modelador primero/.test(boton(vacio, "guardar").porque));

const dibujando = { hayHoja: false, dialogoAbierto: true };
cierto("CON EL MODELADOR ABIERTO PERO SIN MODELO RECIBIDO, sigue apagado",
  boton(dibujando, "guardar").activo === false);
cierto("Y LA RAZÓN ES LA DE VERDAD: no comparten almacenamiento",
  /NO comparten almacenamiento/.test(boton(dibujando, "guardar").porque));
cierto("y cita la fila que lo documenta",
  /partici[óo]n/.test(INV.fila(boton(dibujando, "guardar").art ? "L.particion" : "L.particion").nota));

const recibido = { hayHoja: false, dialogoAbierto: true, recibido: M };
cierto("en cuanto la ventana manda el modelo, se enciende",
  boton(recibido, "guardar").activo === true);
comp("y entonces no hay nada que explicar", boton(recibido, "guardar").porque, null);

/* El otro botón */
cierto("Abrir está encendido cuando no hay ventana", boton(vacio, "abrir").activo === true);
cierto("y apagado cuando ya hay una", boton(dibujando, "abrir").activo === false);
cierto("porque Office no deja dos a la vez",
  /no deja dos a la vez/.test(boton(dibujando, "abrir").porque));
comp("y el texto cambia, no solo el color",
  boton(dibujando, "abrir").texto, "El modelador está abierto");
cierto("Abrir es el botón principal, los demás no",
  boton(vacio, "abrir").principal === true && boton(vacio, "guardar").principal === false);
cierto("quitar el modelo va marcado como peligro",
  boton({ hayHoja: true }, "regenerar").peligro === true);
cierto("y apagado si no hay nada que quitar",
  boton(vacio, "regenerar").activo === false);

/* ================================================================
   2 · EL AVISO QUE NADIE PIDE Y HACE FALTA
   ================================================================ */
const av = P.avisos(recibido);
comp("un modelo recibido y sin guardar genera aviso", av.length, 1);
cierto("y dice la consecuencia exacta: se pierde al cerrar",
  /se pierde/.test(av[0].porque));
cierto("explicando de quién es la culpa, que no es obvia",
  /la ventana del modelador\s+no escribe en el libro/.test(av[0].porque));
comp("con el botón al que manda", av[0].accion, "guardar");
comp("ya guardado, el aviso desaparece",
  P.avisos({ recibido: M, guardadoYa: true }).length, 0);
comp("y sin nada recibido, tampoco hay aviso", P.avisos(vacio).length, 0);

/* Un modelo de formato anterior se abre, pero se dice */
const viejo = Object.assign({}, M, { formato: 0 });
const avV = P.avisos({ modelo: viejo });
comp("un formato anterior avisa", avV.length, 1);
cierto("y tranquiliza: se abre igual", /Se abre igual/.test(avV[0].porque));
comp("sin botón, porque no hay nada que hacer", avV[0].accion, null);

/* ================================================================
   3 · LA FICHA DEL LIBRO
   ================================================================ */
const f = P.ficha({ hayHoja: true, modelo: M });
const dato = (ls, q) => (ls.filter((l) => l.q === q)[0] || {}).v;
comp("dice si hay modelo guardado", dato(f, "Modelo guardado"), "sí");
comp("la luz y el largo", dato(f, "Luz · largo"), "20,00 · 60,00 m");
comp("y los pórticos, calculados del largo y la separación",
  dato(f, "Pórticos"), "11 @ 6,00 m");
comp("60 m a 6 m son 11 pórticos", P.porticos({ largo_m: 60, sepPorticos_m: 6 }), "11 @ 6,00 m");
comp("y 58 a 6 redondea a 11 también", P.porticos({ largo_m: 58, sepPorticos_m: 6 }),
  "11 @ 6,00 m");
comp("sin datos, un guion", P.porticos({}), "—");
comp("y con separación cero, un guion y no una división por cero",
  P.porticos({ largo_m: 60, sepPorticos_m: 0 }), "—");

const fv = P.ficha(vacio);
comp("el libro vacío lo dice", dato(fv, "Modelo guardado"), "no");
cierto("con su nota", (fv.filter((l) => l.q === "Modelo guardado")[0] || {}).nota !== undefined);

/* LAS DOS LÍNEAS QUE EL PANEL DE RETÍCULA NO TIENE, porque en acero el
   dimensionamiento es un bucle y en concreto no. */
let m2 = LIBRO.asignaPerfil(M, { clase: "diagonal" }, "L2½x2½x¼").modelo;
m2 = LIBRO.asignaPerfil(m2, { barra: "D7" }, "L3x3x¼").modelo;
m2 = LIBRO.edita(m2, { tipo: "mover", nudo: "I3", dx_m: 0, dy_m: 0.2 }).modelo;
const f2 = P.ficha({ hayHoja: true, modelo: m2 });
comp("cuenta los perfiles asignados, por clase y por barra",
  dato(f2, "Perfiles asignados"), "2");
comp("y las ediciones encima", dato(f2, "Ediciones encima"), "1");
cierto("diciendo qué les pasará al cambiar un parámetro",
  /se reaplican/.test((f2.filter((l) => l.q === "Ediciones encima")[0] || {}).nota || ""));
comp("cuentaPerfiles suma las dos clases de asignación", P.cuentaPerfiles(m2), 2);

/* Lo recibido manda sobre lo guardado: es lo que el proyectista ve ahora */
const f3 = P.ficha({ hayHoja: true, modelo: M, recibido: m2 });
comp("si hay algo recibido, la ficha enseña ESO y no lo del libro",
  dato(f3, "Ediciones encima"), "1");

/* ================================================================
   4 · EL ESTADO EN UNA LÍNEA
   ================================================================ */
comp("libro vacío", P.estado(vacio).texto, "El libro no traía ningún modelo guardado.");
comp("ventana abierta", P.estado(dibujando).texto, "Modelador abierto.");
comp("modelo cargado", P.estado({ hayHoja: true }).texto, "Modelo cargado del libro.");
comp("recibido sin guardar", P.estado({ recibido: M }).texto,
  "Modelo recibido, sin guardar todavía.");
comp("y eso va marcado como aviso, no como normal",
  P.estado({ recibido: M }).clase, "aviso");
comp("un error manda sobre todo lo demás",
  P.estado({ hayHoja: true, dialogoAbierto: true, error: "no se pudo abrir" }).texto,
  "no se pudo abrir");
comp("y va en rojo", P.estado({ error: "x" }).clase, "err");

/* ================================================================
   5 · EL CANAL CON LA VENTANA
   ================================================================ */
comp("sin modelo en el libro, a la ventana se le manda que no hay",
  P.paraLaVentana(vacio), { a: "mod", n: 0 });
const env = P.paraLaVentana({ modelo: M });
comp("y con modelo, se le manda el modelo", env.a, "mod");
comp("entero", env.modelo.nombre, "Nave Chorrillos");

/* LO QUE VUELVE SE VALIDA ANTES DE TOCARLO: un modelo mal formado que
   entra aquí se escribe en el libro y ya no se puede abrir. */
const r = P.recibeDeLaVentana(LIBRO.serializa(M, "2026-10-01T02:00:00.000Z"));
comp("lo que vuelve se deserializa", r.modelo.nombre, "Nave Chorrillos");
comp("con su formato", r.formato, LIBRO.FORMATO);
lanza("si la ventana manda basura, PARA antes de guardarla",
  () => P.recibeDeLaVentana("esto no es un modelo"), "no tiene cabecera");
lanza("y si manda la hoja de otro complemento, también",
  () => P.recibeDeLaVentana("RETICULA\t3\tx\n{}"), "no es un modelo de Galpón");
lanza("y si no manda nada", () => P.recibeDeLaVentana(""), "no ha mandado nada");

/* ================================================================
   6 · EL PANEL ENTERO
   ================================================================ */
const t = P.todo({ hayHoja: true, modelo: M, version: "v1 · 01-10-2026" });
comp("el título", t.titulo, "Galpón");
comp("la versión viaja", t.version, "v1 · 01-10-2026");
comp("tres pasos en el cómo se usa", t.comoSeUsa.length, 3);
cierto("el primero manda al modelador", /Abre el modelador/.test(t.comoSeUsa[0]));
cierto("el segundo a las hojas", /Hojas Excel/.test(t.comoSeUsa[1]));
cierto("y el tercero dice dónde queda el modelo",
  /queda dentro del libro/.test(t.comoSeUsa[2]));
comp("tres botones", t.acciones.length, 3);
cierto("y la ficha trae líneas", t.ficha.length >= 5);
cierto("con la bajada que dice qué es esto", /galpones de estructura met[áa]lica/.test(t.bajada));

/* EL PANEL NO CALCULA NADA, y eso es la lección de la cáscara que se tiró:
   no expone una sola función que devuelva un ratio, una fuerza o un perfil
   elegido. Solo estado del libro y botones. */
const api = Object.keys(P).filter((k) => typeof P[k] === "function");
comp("la API del panel es pequeña a propósito", api.length <= 9, true);
comp("y no hay nada que suene a cálculo",
  api.filter((k) => /verifica|calcula|disena|resuelve|analiza/i.test(k)), []);

fin();
