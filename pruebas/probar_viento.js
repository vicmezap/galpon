/* =====================================================================
   probar_viento.js — E.020 Cap. 3

   Dos cosas se prueban aquí y la segunda es la que importa:

   1) que los tres pasos den el número de la norma, y en las fronteras de
      la Tabla 4 —15° y 60°— a los dos lados y encima del límite;

   2) QUE EL ERROR QUE YA COMETÍ NO PUEDA VOLVER. Tomé Ci = ±0,3 de una
      hoja de clase como si fuera el único caso de la Tabla 5. Aquí se
      comprueba que pedir una presión sin decir dónde están las aberturas
      PARA, y se mide cuánto costaba el descuido: 50 % de succión.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const V = require("../src/viento.js");

/* ---------- velocidad de diseño · Art. 12.3 ---------------------------- */
/* Vh = V·(h/10)^0,22 · a 10 m el exponente no hace nada, es el ancla. */
comp("a h = 10 m, Vh = V", V.velocidadDiseno({ V_kmh: 90, h_m: 10 }).Vh_kmh, 90);
cerca("a h = 20 m sube un 16 %",
  V.velocidadDiseno({ V_kmh: 90, h_m: 20 }).Vh_kmh, 90 * Math.pow(2, 0.22), 1e-12);
cerca("y el número concreto es 104,826 km/h",
  V.velocidadDiseno({ V_kmh: 90, h_m: 20 }).Vh_kmh, 104.8260, 1e-6);

/* EL PISO DE 75 km/h · fila W.V.min. El mapa del Anexo 2 llega a bajar a 30,
   así que el piso muerde de verdad, no es decorativo. */
comp("V del mapa = 30 · el piso lo sube a 75",
  V.velocidadDiseno({ V_kmh: 30, h_m: 8 }).Vh_kmh, 75);
cierto("y avisa de que se aplicó el mínimo",
  V.velocidadDiseno({ V_kmh: 30, h_m: 8 }).enMinimo === true);
/* Vh CRECE con h: si a los 10 m el mínimo es 75, a los 15 no puede ser menos.
   Por eso el piso se aplica a cualquier altura y no solo hasta los 10 m. */
comp("y sigue valiendo por encima de 10 m, porque Vh crece con h",
  V.velocidadDiseno({ V_kmh: 30, h_m: 15 }).Vh_kmh, 75);
cierto("con V ≥ 75 el piso no muerde",
  V.velocidadDiseno({ V_kmh: 75, h_m: 12 }).enMinimo === false);
/* LA VELOCIDAD DEL MAPA NO SE HORNEA: el Anexo 2 es un escaneo con isotacas
   a mano. Sin V no hay cálculo, y la función lo dice en vez de suponer. */
lanza("sin V del mapa PARA",
  () => V.velocidadDiseno({ h_m: 10 }), "Mapa Eólico");

/* ---------- Ce · Tabla 4 ----------------------------------------------- */
comp("muro · barlovento +0,8", V.ceMuro().barlovento[0], 0.8);
comp("muro · sotavento −0,6", V.ceMuro().sotavento, -0.6);
comp("muros laterales, paralelos al viento · −0,7", V.T4.paralelas.barlovento[0], -0.7);

/* Las fronteras: el 15 pertenece a «15° o menos», el 60 a «entre 15° y 60°». */
comp("θ = 10° · inciso de ≤ 15°", V.ceTecho(10).caso, "inc15");
comp("θ = 15° · TODAVÍA el de ≤ 15°", V.ceTecho(15).caso, "inc15");
comp("θ = 16° · ya el de 15 a 60", V.ceTecho(16).caso, "inc1560");
comp("θ = 60° · todavía el de 15 a 60", V.ceTecho(60).caso, "inc1560");
comp("θ = 61° · el de 60 a la vertical", V.ceTecho(61).caso, "inc60");

/* LOS DOS VALORES A BARLOVENTO SON DOS CASOS, no una horquilla de la que
   elegir. Uno comprime y el otro levanta, y cuál gobierna no se sabe hasta
   resolver el pórtico. Devolverlos en lista es lo que impide quedarse con
   el cómodo. */
comp("θ ≤ 15° · barlovento trae DOS valores", V.ceTecho(10).barlovento.length, 2);
comp("y son +0,3 y −0,7", V.ceTecho(10).barlovento.join("/"), "0.3/-0.7");
comp("θ = 20° · el caso normal del galpón a dos aguas, +0,7 y −0,3",
  V.ceTecho(20).barlovento.join("/"), "0.7/-0.3");
comp("y su sotavento es −0,6", V.ceTecho(20).sotavento, -0.6);
lanza("una inclinación imposible PARA", () => V.ceTecho(120), "theta_grad");

/* ---------- Ci · Tabla 5 · EL ERROR QUE NO PUEDE VOLVER ---------------- */
comp("la Tabla 5 tiene tres casos", V.ABERTURAS.length, 3);
comp("aberturas repartidas · ±0,3", V.ci("repartidas").Ci.join("/"), "0.3/-0.3");
comp("portón a barlovento · +0,8", V.ci("barlovento").Ci[0], 0.8);
comp("aberturas a sotavento o costados · −0,6", V.ci("sotavento").Ci[0], -0.6);
lanza("pedir Ci sin decir dónde están las aberturas PARA",
  () => V.ci(undefined), "dónde están las aberturas");
lanza("y un caso inventado también",
  () => V.ci("ninguna"), "dónde están las aberturas");

/* CUÁNTO COSTABA EL DESCUIDO, medido. Techo a −0,7 exterior:
     repartidas  ->  C = −0,7 − (+0,3) = −1,0
     barlovento  ->  C = −0,7 − (+0,8) = −1,5     un 50 % más de succión
   Es el número que está escrito en la fila W.T5.barlovento. */
const rep = V.factorForma({ Ce: -0.7, aberturas: "repartidas" });
const bar = V.factorForma({ Ce: -0.7, aberturas: "barlovento" });
cerca("con aberturas repartidas la succión peor es C = −1,0", rep.Cmin, -1.0, 1e-12);
cerca("con el portón a barlovento es C = −1,5", bar.Cmin, -1.5, 1e-12);
cerca("exactamente un 50 % más", bar.Cmin / rep.Cmin, 1.5, 1e-12);
/* Y el signo contrario también sale: con Ci = −0,3 el mismo techo da −0,4.
   Por eso factorForma() devuelve todos los casos y no «el peor». */
comp("repartidas da los dos casos", rep.casos.length, 2);
cerca("y el menos severo es −0,4", rep.Cmax, -0.4, 1e-12);

/* Ce con dos valores × Ci con dos valores = cuatro casos. */
const cuatro = V.factorForma({ Ce_lista: V.ceTecho(10).barlovento, aberturas: "repartidas" });
comp("dos Ce por dos Ci son cuatro casos", cuatro.casos.length, 4);
lanza("factorForma() sin Ce PARA", () => V.factorForma({ aberturas: "repartidas" }), "Ce");

/* ---------- Ph = 0,005·C·Vh² · Art. 12.4 ------------------------------- */
/* Con Vh = 75 (el piso) y C = 1: Ph = 0,005·1·75² = 28,125 kgf/m². */
cerca("Ph con C = 1 y Vh = 75", V.presion({ C: 1, Vh_kmh: 75 }).Ph_kgfm2, 28.125, 1e-12);
/* Y el caso que decide el anclaje del galpón: succión de techo C = −1,5. */
cerca("succión de techo C = −1,5 a Vh = 75",
  V.presion({ C: -1.5, Vh_kmh: 75 }).Ph_kgfm2, -42.1875, 1e-12);
comp("y el signo se nombra", V.presion({ C: -1.5, Vh_kmh: 75 }).sentido, "succión");
comp("una C positiva es presión", V.presion({ C: 0.8, Vh_kmh: 75 }).sentido, "presión");
/* Ph va con Vh², así que la velocidad no es lineal: subir de 75 a 106 km/h
   —un 41 %— duplica la presión. */
cerca("Ph va con el cuadrado de Vh",
  V.presion({ C: 1, Vh_kmh: 150 }).Ph_kgfm2 / V.presion({ C: 1, Vh_kmh: 75 }).Ph_kgfm2,
  4, 1e-12);

/* Tipo de edificación · Art. 12.2 */
comp("Tipo 1 no lleva factor", V.presion({ C: 1, Vh_kmh: 75, tipo: 1 }).factorTipo, 1.0);
cerca("Tipo 2 lleva 1,2",
  V.presion({ C: 1, Vh_kmh: 75, tipo: 2 }).Ph_kgfm2, 28.125 * 1.2, 1e-12);
lanza("Tipo 3 PARA: pide análisis especial",
  () => V.presion({ C: 1, Vh_kmh: 75, tipo: 3 }), "análisis especial");
lanza("un tipo que no existe PARA",
  () => V.presion({ C: 1, Vh_kmh: 75, tipo: 4 }), "1, 2 o 3");

/* ---------- el galpón entero en una dirección -------------------------- */
/* Art. 12.1: las presiones y succiones exteriores se consideran
   SIMULTÁNEAS, así que esto es un estado de carga completo. */
const g = V.casos({ V_kmh: 85, h_m: 7, theta_grad: 20, aberturas: "barlovento", tipo: 1 });
comp("cinco superficies, con los muros laterales incluidos", g.superficies.length, 5);
comp("y se declaran simultáneas · Art. 12.1", g.simultaneas, true);
comp("el caso de techo es el de 15 a 60", g.casoTecho, "inc1560");
/* A 7 m de altura Vh BAJA respecto de V —el exponente 0,22 sobre 0,7— pero
   no llega al piso: 78,59 > 75, así que el mínimo no muerde aquí. */
cerca("Vh = 85·(0,7)^0,22 = 78,585", g.Vh_kmh, 78.5852, 1e-5);
cierto("y el piso de 75 NO muerde a esa altura", g.enMinimo === false);
cierto("todas las superficies traen al menos un caso",
  g.superficies.every((s) => s.casos.length >= 1));
/* El faldón a barlovento es el que trae dos, por los dos Ce de la Tabla 4. */
const fb = g.superficies.find((s) => s.superficie === "faldón barlovento");
comp("el faldón a barlovento trae dos casos", fb.casos.length, 2);
/* Con portón a barlovento (Ci = +0,8) los DOS casos del faldón son succión:
   +0,7−0,8 = −0,1 y −0,3−0,8 = −1,1. El techo entero levanta. */
cierto("con el portón a barlovento los dos casos del faldón levantan",
  fb.casos.every((c) => c.C < 0));
cerca("y el peor es C = −1,1", Math.min.apply(null, fb.casos.map((c) => c.C)), -1.1, 1e-12);
lanza("el galpón entero sin decir las aberturas PARA",
  () => V.casos({ V_kmh: 85, h_m: 7, theta_grad: 20 }), "dónde están las aberturas");

/* ---------- el método que NO se usa ------------------------------------ */
/* La fila W.zapata.metodo está en conflicto y la decisión es que manda la
   E.020. Se declara para que la cita viaje, no para usarla. */
cierto("la decisión sobre el método de Zapata viaja declarada",
  V.ART["W.zapata.metodo"].length > 0);

fin();
