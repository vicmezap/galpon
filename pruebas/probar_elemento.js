/* =====================================================================
   probar_elemento.js — la verificación de una pieza, y el bucle

   Cubre elemento.js y bucle.js, la maquinaria que comparten correas.js,
   tijeral.js, columnas.js y arriostres.js.

   LO QUE MÁS SE PRUEBA AQUÍ ES QUE NADA SE SALTE EN SILENCIO. Un ratio de
   0,82 parece bueno, y si detrás falta el pandeo lateral-torsional porque
   nadie pasó Lb, el elemento está mal y el número dice que está bien. Así
   que:
     · lo que no se puede comprobar hace PARAR, cuando es imprescindible;
     · lo que se comprobó con una hipótesis cómoda se apunta en `omitidos`,
       y si es esencial, `cumple` es false aunque la resistencia dé;
     · cuando hay axial y momento, manda la INTERACCIÓN y no el mayor de los
       ratios sueltos.

   Y del bucle se prueban las tres formas de terminar, que son distintas y
   hay que distinguirlas: convergió, OSCILA, y se agotó.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const P = require("../src/perfiles.js");
const A = require("../src/acero.js");
const EL = require("../src/elemento.js");
const B = require("../src/bucle.js");

const Fy = 2530;
const W = P.busca("W12X26");
const HO = W.d_cm - W.tf_cm;
const RT = A.rts({ Iy_cm4: W.Iy_cm4, Cw_cm6: W.Cw_cm6, Sx_cm3: W.Sx_cm3 }).rts_cm;
const GEO = {
  Lp_cm: A.Lp({ ry_cm: W.ry_cm, Fy_kgcm2: Fy }).Lp_cm,
  Lr_cm: A.Lr({ rts_cm: RT, Fy_kgcm2: Fy, J_cm4: W.J_cm4, c: 1,
    Sx_cm3: W.Sx_cm3, ho_cm: HO }).Lr_cm,
  rts_cm: RT, J_cm4: W.J_cm4, c: 1, ho_cm: HO
};

/* ---------- una viga: solo flexión y cortante ------------------------- */
const viga = EL.verifica({ id: "VIGA-1", perfil: W, acero: "A36",
  combinacion: "1,2D + 1,6Lr", fabricacion: "laminado",
  fuerzas: { Mux_kgfcm: 900000, Vu_kgf: 6000 },
  longitudes: { Lb_cm: 200 }, geometriaF2: GEO, Cb: 1.0 });
comp("una viga trae dos controles: F2 y G", viga.ratios.length, 2);
cierto("y gobierna la flexión", viga.capitulo === "F2");
cerca("con el ratio de F2", viga.ratio,
  viga.ratios.find((x) => x.cap === "F2").valor, 1e-12);
cierto("cumple", viga.cumple === true);
/* EL RESUMEN LLEVA LA COMBINACIÓN, que es lo que lo hace utilizable: un 0,95
   no dice nada; «0,95 por pandeo lateral bajo 0,9D − 1,3W» dice qué cambiar. */
cierto("el resumen nombra el estado límite y la combinación",
  /flexi/.test(viga.resumen) && /1,2D/.test(viga.resumen));

/* ---------- una columna: axial + momento → MANDA LA INTERACCIÓN ------- */
/* En un galpón los largueros arriostran el eje menor, así que la columna
   pandea en el mayor: Lc/r se toma con rx. */
const col = EL.verifica({ id: "COL-1", perfil: W, acero: "A36",
  combinacion: "1,2D + 1,3W", fabricacion: "laminado",
  origenFuerzas: "segundo-orden", noEsbelta: true, arriostreComprobado: true,
  fuerzas: { Pu_kgf: -25000, Mux_kgfcm: 600000, Vu_kgf: 4000 },
  longitudes: { Lc_cm: 700, r_cm: W.rx_cm, Lb_cm: 250 },
  geometriaF2: GEO, Cb: 1.0 });
comp("una columna con momento trae cuatro controles", col.ratios.length, 4);
cierto("y el último es el Capítulo H", col.capitulo === "H");
/* LA INTERACCIÓN MANDA AUNQUE NO SEA EL MAYOR DE LOS SUELTOS. Es el punto:
   con axial y momento a la vez, el axial solo no basta. */
const mayorSuelto = Math.max.apply(null, col.ratios
  .filter((x) => x.cap !== "H").map((x) => x.valor));
cierto("la interacción gobierna, no el mayor de los ratios sueltos",
  col.gobierna.indexOf("combinadas") >= 0);
cierto("y de hecho supera a todos los sueltos", col.ratio > mayorSuelto);
cierto("cumple", col.cumple === true);

/* LA GUARDA DEL SEGUNDO ORDEN llega hasta aquí: el Cap. H pide fuerzas del
   Cap. C, y elemento.js las pasa tal cual. */
lanza("una columna con fuerzas de primer orden PARA",
  () => EL.verifica({ id: "X", perfil: W, acero: "A36", fabricacion: "laminado",
    origenFuerzas: "primer-orden", noEsbelta: true,
    fuerzas: { Pu_kgf: -25000, Mux_kgfcm: 600000 },
    longitudes: { Lc_cm: 700, r_cm: W.rx_cm, Lb_cm: 250 }, geometriaF2: GEO }),
  "PRIMER ORDEN");
lanza("y sin declarar el origen tampoco calcula la interacción",
  () => EL.verifica({ id: "X", perfil: W, acero: "A36", fabricacion: "laminado",
    noEsbelta: true, fuerzas: { Pu_kgf: -25000, Mux_kgfcm: 600000 },
    longitudes: { Lc_cm: 700, r_cm: W.rx_cm, Lb_cm: 250 }, geometriaF2: GEO }),
  "Chapter C");
/* Sin interacción no hace falta el origen, pero si se declara primer orden,
   también para: el Cap. C pide segundo orden para cualquier efecto
   dependiente de la carga. */
lanza("incluso sin interacción, unas fuerzas de primer orden paran",
  () => EL.verifica({ id: "X", perfil: W, acero: "A36",
    origenFuerzas: "primer-orden", fuerzas: { Mux_kgfcm: 600000 },
    longitudes: { Lb_cm: 250 }, geometriaF2: GEO }), "PRIMER ORDEN");

/* ---------- LO QUE NO SE PUEDE COMPROBAR HACE PARAR ------------------ */
/* Una compresión sin Lc no es una comprobación: es un número. */
lanza("compresión sin longitud efectiva PARA",
  () => EL.verifica({ id: "X", perfil: W, fuerzas: { Pu_kgf: -1000 } }),
  "no hay Cap");
lanza("y sin el radio de giro tampoco",
  () => EL.verifica({ id: "X", perfil: W, fuerzas: { Pu_kgf: -1000 },
    longitudes: { Lc_cm: 700 } }), "r_cm");
/* Un momento de eje mayor sin Lb deja fuera el pandeo lateral-torsional, que
   es el estado límite que gobierna casi todas las vigas de galpón. */
lanza("momento de eje mayor sin Lb PARA",
  () => EL.verifica({ id: "X", perfil: W, fuerzas: { Mux_kgfcm: 900000 } }),
  "NO ARRIOSTRADA");
/* Pero Lb = 0 SÍ se acepta: es «arriostrada continuamente», que es una
   afirmación legítima y distinta de olvidarse del dato. */
cierto("Lb = 0 se acepta: arriostrada continuamente",
  EL.verifica({ id: "X", perfil: W, fuerzas: { Mux_kgfcm: 900000 },
    longitudes: { Lb_cm: 0 }, geometriaF2: GEO }).ratio > 0);
lanza("y sin la geometría de F2 PARA, diciendo qué funciones la dan",
  () => EL.verifica({ id: "X", perfil: W, fuerzas: { Mux_kgfcm: 900000 },
    longitudes: { Lb_cm: 200 } }), "acero.Lp()");
/* UN ELEMENTO SIN FUERZAS NO ES UNO QUE CUMPLE: es uno que no se analizó. */
lanza("un elemento sin ninguna fuerza PARA",
  () => EL.verifica({ id: "X", perfil: W, fuerzas: {} }), "no se ha analizado");
lanza("y sin perfil también", () => EL.verifica({ id: "X" }), "perfil");

/* ---------- LO QUE SE COMPROBÓ CON UNA HIPÓTESIS CÓMODA SE APUNTA ---- */
/* Una diagonal de ángulo EMPERNADA sin dar U se calcula como si fuera
   soldada sin agujeros, y eso sobrestima hasta un 36 % (fila T.U.c8). El
   control se hace, pero queda marcado como ESENCIAL pendiente: la resistencia
   da, y aun así `cumple` es false. */
const L = P.busca("L4X4X1/2");
const diag = EL.verifica({ id: "DIAG-3", perfil: L, acero: "A36",
  combinacion: "1,2D + 1,6Lr", empernado: true,
  fuerzas: { Pu_kgf: 15000 } });
cierto("la resistencia da", diag.cumpleResistencia === true);
cierto("pero NO cumple, porque falta un control esencial", diag.cumple === false);
cierto("y se dice cuál", diag.faltanEsenciales === true);
cierto("el resumen lo pone por delante", /falta comprobar/.test(diag.resumen));
cierto("con el motivo y el porcentaje", /36 %/.test(diag.omitidos[0].motivo));
/* Dando U y An, el omitido desaparece. */
const diagOk = EL.verifica({ id: "DIAG-3", perfil: L, acero: "A36",
  empernado: true, An_cm2: L.A_cm2 - 2.15, U: 0.60, fuerzas: { Pu_kgf: 15000 } });
comp("con U y An no queda nada esencial pendiente", diagOk.omitidos.length, 0);
cierto("y entonces sí cumple", diagOk.cumple === true);
cierto("con un ratio mayor, porque U = 0,60 castiga", diagOk.ratio > diag.ratio);

/* Los omitidos NO esenciales informan sin bloquear: Cb = 1 es conservador y
   está permitido, y el arriostre del Apéndice 6 es una deuda de E7. */
const vigaSinCb = EL.verifica({ id: "VIGA-2", perfil: W, acero: "A36",
  fuerzas: { Mux_kgfcm: 700000 }, longitudes: { Lb_cm: 200 }, geometriaF2: GEO });
cierto("no pasar Cb se anota pero no bloquea",
  vigaSinCb.omitidos.some((x) => /Cb/.test(x.que)) && vigaSinCb.cumple === true);
cierto("y pasarlo no deja ese omitido",
  !viga.omitidos.some((x) => /Cb/.test(x.que)));
const sinArr = EL.verifica({ id: "X", perfil: W, acero: "A36", noEsbelta: true,
  fuerzas: { Pu_kgf: -20000 }, longitudes: { Lc_cm: 700, r_cm: W.rx_cm } });
cierto("y la deuda del Apéndice 6 también se anota sin bloquear",
  sinArr.omitidos.some((x) => /Ap.ndice 6/.test(x.que)) && sinArr.cumple === true);

/* ---------- la envolvente de varias combinaciones -------------------- */
/* Un elemento no tiene un ratio: tiene uno por combinación, y lo que importa
   es el peor CON SU CULPABLE señalada. */
function conM(m, nombre) {
  return EL.verifica({ id: "VIGA-1", perfil: W, acero: "A36", combinacion: nombre,
    fuerzas: { Mux_kgfcm: m }, longitudes: { Lb_cm: 200 }, geometriaF2: GEO, Cb: 1.0 });
}
const env = EL.envolvente([conM(500000, "1,4D"), conM(900000, "1,2D + 1,6Lr"),
  conM(700000, "0,9D − 1,3W")]);
comp("la envolvente mira las tres", env.cuantas, 3);
comp("y señala la combinación culpable", env.combinacion, "1,2D + 1,6Lr");
cerca("con el ratio peor", env.ratio, conM(900000, "x").ratio, 1e-12);
cierto("cumple solo si cumplen todas", env.cumple === true);
cierto("y lista todas para poder mirarlas", env.todas.length === 3);
lanza("una envolvente vacía PARA", () => EL.envolvente([]), "al menos un");

/* =====================================================================
   EL BUCLE
   ===================================================================== */

/* ---------- convergió ------------------------------------------------ */
const b1 = B.nuevo({ nombre: "pórtico" });
const p1 = B.pasada(b1, { antes: { c1: "W12X26", v1: "W16X26" },
  despues: { c1: "W12X30", v1: "W16X31" } });
comp("la primera pasada cuenta dos cambios", p1.cambios, 2);
cierto("y el mensaje es el del diagrama",
  /Pasada 1: 2 elementos cambiaron, vuelve a analizar/.test(p1.mensaje));
cierto("dice que hay que seguir", p1.seguir === true);
cierto("y el detalle lleva de qué a qué",
  p1.detalle[0].de === "W12X26" && p1.detalle[0].a === "W12X30");
const p2 = B.pasada(b1, { antes: { c1: "W12X30", v1: "W16X31" },
  despues: { c1: "W12X30", v1: "W16X31" } });
comp("la segunda no cambia nada", p2.cambios, 0);
cierto("y ahí convergió", p2.resultado === "convergió");
cierto("no hay que seguir", p2.seguir === false);
const inf = B.informe(b1);
comp("el informe cuenta dos pasadas", inf.pasadas, 2);
cierto("y lo declara convergido", inf.convergio === true);
/* Que el número de cambios BAJE es la señal de que va a converger. */
cierto("y va convergiendo", inf.convergiendo === true);
comp("el historial tiene los dos mensajes", inf.historial.length, 2);
/* Un bucle terminado no se reutiliza: mezclaría dos historiales. */
lanza("reutilizar un bucle terminado PARA",
  () => B.pasada(b1, { antes: { c1: "A" }, despues: { c1: "A" } }), "ya terminó");

/* ---------- OSCILA · la guarda que de verdad hace falta -------------- */
/* Pasa de verdad: A pide B y B vuelve a pedir A. Sin esta guarda el bucle no
   acaba; con un tope a secas acabaría diciendo «no convergió», que es cierto
   pero inútil, porque el problema no es que falten pasadas. */
const b2 = B.nuevo({ nombre: "oscilante" });
B.pasada(b2, { antes: { a: "A" }, despues: { a: "B" } });
B.pasada(b2, { antes: { a: "B" }, despues: { a: "A" } });
lanza("volver a un conjunto ya visto PARA y dice que OSCILA",
  () => B.pasada(b2, { antes: { a: "A" }, despues: { a: "B" } }), "OSCILA");
/* El mensaje tiene que explicar qué hacer, no solo que falló. */
lanza("y el mensaje dice qué hacer",
  () => { const b = B.nuevo({});
    B.pasada(b, { antes: { a: "A" }, despues: { a: "B" } });
    B.pasada(b, { antes: { a: "B" }, despues: { a: "A" } });
    B.pasada(b, { antes: { a: "A" }, despues: { a: "B" } }); },
  "fijar a mano");
lanza("y avisa de que más pasadas NO lo arreglan",
  () => { const b = B.nuevo({});
    B.pasada(b, { antes: { a: "A" }, despues: { a: "B" } });
    B.pasada(b, { antes: { a: "B" }, despues: { a: "A" } });
    B.pasada(b, { antes: { a: "A" }, despues: { a: "B" } }); },
  "NO lo arreglan");

/* ---------- se agotó · y se distingue del ciclo ---------------------- */
/* Aquí cada pasada da un conjunto NUEVO, así que no hay ciclo: es que de
   verdad hacen falta más pasadas. El mensaje lo dice con esas palabras. */
const b3 = B.nuevo({ nombre: "lento", maxPasadas: 4 });
lanza("llegar al tope sin repetir estado PARA diciendo que NO es un ciclo",
  () => { for (let i = 0; i < 5; i++) {
      B.pasada(b3, { antes: { a: "S" + i }, despues: { a: "S" + (i + 1) } });
    } }, "no es un ciclo");
comp("el tope por omisión son diez pasadas", B.MAX_PASADAS, 10);

/* ---------- lo que el bucle NO tolera -------------------------------- */
lanza("cambiar el conjunto de elementos entre antes y después PARA",
  () => B.pasada(B.nuevo({}), { antes: { a: "A" }, despues: { a: "A", b: "B" } }),
  "cambió entre antes");
lanza("y una pasada sin los dos mapas tampoco vale",
  () => B.pasada(B.nuevo({}), { antes: { a: "A" } }), "antes` y `despues");

/* La firma de un conjunto no depende del orden de las claves: el mismo
   conjunto tiene que dar la misma firma o la detección de ciclos falla. */
comp("la firma no depende del orden de las claves",
  B.firma({ b: "2", a: "1" }), B.firma({ a: "1", b: "2" }));

/* ---------- que el bucle exista lo pide la propia norma ------------- */
/* τb depende de Pr, que depende del análisis, que depende de τb
   (fila E.C2.taub). No es una comodidad del programa. */
cierto("el informe cita la fila que obliga a iterar", inf.art.length > 0);
cierto("y explica la circularidad de tau_b", /depende de/.test(inf.nota));

fin();
