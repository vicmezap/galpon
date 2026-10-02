/* =====================================================================
   probar_excel.js — el evaluador de fórmulas de las hojas

   Lo que importa es que evalúe COMO EXCEL: si aquí -2^2 diera −4 y en
   Excel 4, la guarda H.coincide daría por buena una hoja que en el libro
   sale mal.  Cada regla de Excel que cambia resultados tiene su prueba.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const X = require("../src/excel.js");

const h = (celdas, nombres) => ({ celdas: celdas, nombres: nombres || {} });
const val = (f, extra, nombres) => String(X.valor(h(Object.assign({ Z9: { f: f } }, extra || {}), nombres), "Z9"));

/* ---- las reglas de Excel que cambian resultados ---- */
comp("el menos unario va ANTES que la potencia: -2^2 = 4", val("=-2^2"), "4");
comp("pero 0-2^2 = −4", val("=0-2^2"), "-4");
comp("la potencia encadena de izquierda a derecha: 2^3^2 = 64", val("=2^3^2"), "64");
comp("la precedencia de siempre", val("=1+2*3-4/2"), "5");
comp("el porcentaje", val("=50%*4"), "2");
comp("& une texto, y los números pasan a texto", val("=\"Z\"&4"), "Z4");
comp("la celda vacía vale 0 en una cuenta", val("=A1+3"), "3");
comp("y \"\" en una comparación", val("=A1=\"\""), "true");
comp("y 0 comparada con un número", val("=A1=0"), "true");
comp("el texto se compara sin mayúsculas", val("=\"inc15\"=\"INC15\""), "true");
comp("y un número es menor que un texto, como en Excel", val("=5<\"a\""), "true");
comp("IF solo evalúa la rama que toca: la división por cero de la otra no salta", val("=IF(1>0,7,1/0)"), "7");
comp("la división por cero, en la rama que toca, sí", val("=IF(1<0,7,1/0)"), "#DIV/0!");
comp("los errores se propagan por las cuentas", val("=NA()+1"), "#N/A");
comp("y por MAX", val("=MAX(1,NA())"), "#N/A");
comp("la raíz de un negativo es #NUM!", val("=SQRT(-1)"), "#NUM!");
comp("un texto en una cuenta es #VALUE!", val("=\"a\"*2"), "#VALUE!");
comp("un nombre que no existe es #NAME?", val("=noExiste*2"), "#NAME?");

/* ---- nombres, rangos y búsquedas ---- */
const T = { A1: { v: "Z4" }, A2: { v: "Z3" }, A3: { v: "Z2" }, B1: { v: 0.45 }, B2: { v: 0.35 }, B3: { v: 0.25 },
  C1: { v: 0.35 }, C2: { v: 0.45 }, C3: { v: 0.55 }, D1: { v: "z3" } };
const N = { claves: "A1:A3", zeta: "B1:B3", desde: "C1:C3", zona: "D1" };
comp("INDEX/MATCH exacto, con nombres de rango y sin mayúsculas", val("=INDEX(zeta,MATCH(zona,claves,0))", T, N), "0.35");
comp("MATCH exacto que no encuentra: #N/A", val("=MATCH(\"Z9\",claves,0)", T, N), "#N/A");
comp("MATCH 1: el mayor que no pasa", [0.35, 0.44, 0.45, 0.6].map((x) => val("=MATCH(" + x + ",desde,1)", T, N)),
  ["1", "1", "2", "3"]);
comp("MATCH 1 por debajo del primero: #N/A", val("=MATCH(0.1,desde,1)", T, N), "#N/A");
comp("INDEX fuera del rango: #REF!", val("=INDEX(zeta,4)", T, N), "#REF!");
comp("MAX y MIN sobre rangos", [val("=MAX(desde)", T, N), val("=MIN(desde,0.1)", T, N)], ["0.55", "0.1"]);
comp("OR y AND", [val("=OR(1>2,2>1)"), val("=AND(1>2,2>1)")], ["true", "false"]);
comp("las celdas con $ también", val("=$B$1*2", T), "0.9");
cerca("las fórmulas de las hojas se encadenan", X.valor(h({ A1: { v: 3 }, A2: { f: "=lado^2" }, A3: { f: "=A2*2" } },
  { lado: "A1" }), "A3"), 18, 1e-12);

/* ---- lo que NO se deja pasar ---- */
lanza("una función que no está comprobada aquí no se escribe en la hoja", () => val("=VLOOKUP(1,A1:B3,2)"),
  ["VLOOKUP no está comprobada"]);
lanza("la referencia circular", () => X.valor(h({ A1: { f: "=A2" }, A2: { f: "=A1" } }), "A1"), ["circular"]);
lanza("la fórmula mal cerrada", () => val("=MAX(1,2"), ["falta"]);
lanza("y la que no empieza por =", () => X.valor(h({ A1: { f: "MAX(1,2)" } }), "A1"), ["no empieza por ="]);

/* ---- LA GUARDA H.coincide ---- */
const ok = X.comprueba(h({ A1: { v: 2 }, A2: { f: "=A1*3", debe: 6 }, A3: { f: "=\"no\"&\" aplica\"", debe: "no aplica" } }));
comp("si las fórmulas dan el número del motor, pasa", [ok.ok, ok.comprobadas], [true, 2]);
const mal = X.comprueba(h({ A1: { v: 2 }, A2: { f: "=A1*3", debe: 6.000001, que: "la de prueba" } }));
comp("si no, dice cuál, con la fórmula, lo que debía dar y lo que da",
  [mal.ok, mal.malas[0].celda, mal.malas[0].formula, mal.malas[0].sale], [false, "A2", "=A1*3", "6"]);
cierto("la tolerancia es de la misma cuenta, 1e-9, no de una aproximación",
  X.comprueba(h({ A2: { f: "=0.1+0.2", debe: 0.3 } })).ok && !X.comprueba(h({ A2: { f: "=0.1+0.2", debe: 0.3000001 } })).ok);
comp("las funciones que usa una hoja, para saber qué se escribe",
  X.funciones(h({ A1: { f: "=IF(MAX(1,2)>1,SQRT(4),0)" }, A2: { v: 1 } })), ["IF", "MAX", "SQRT"]);
comp("las direcciones, ida y vuelta", [X.colLetras(28), X.colNum("AB"), X.celda(3, 7), X.parte("$M$12")],
  ["AB", 28, "C7", { c: 13, f: 12 }]);

fin();
