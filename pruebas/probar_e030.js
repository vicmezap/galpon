/* =====================================================================
   probar_e030.js — E.030-2026

   Lo que más vale de este archivo no son las comprobaciones de valores: es
   LA CONTINUIDAD DE LAS TABLAS.  La nota (*) de la Tabla N° 5 manda
   interpolar S, TP y TL pero no dice en qué sentido, y el sentido no se
   adivina porque TP crece mientras TL decrece en el mismo intervalo.

   La prueba lo demuestra sola: recorre los bordes entre tipos de suelo y
   comprueba que los valores coinciden por los dos lados.  Solo hay un
   emparejamiento que lo consigue: MEDIDO, invertir el sentido dentro de
   interpola() pone 31 comprobaciones en rojo de golpe.  Es la prueba de oro
   de este módulo.
   ===================================================================== */
"use strict";
const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const E = require("../src/e030.js");

/* ---------- LA PRUEBA DE ORO · continuidad de las Tablas 4 y 5 ---------- */
/* En V̄s30 = 550 m/s terminan los S1 y empiezan los S2; en 350, S2 y S3; en
   200, S3 y S4. Los valores tienen que coincidir por los dos lados. */
for (const z of E.ZONAS) {
  const a = E.sitio({ zona: z, suelo: "S1", vs30_ms: 550 });
  const b = E.sitio({ zona: z, suelo: "S2", vs30_ms: 550 });
  cerca("continuidad S1|S2 en 550 m/s · " + z + " · S", a.S, b.S, 1e-12);
  cerca("continuidad S1|S2 en 550 m/s · " + z + " · TP", a.TP, b.TP, 1e-12);
  cerca("continuidad S1|S2 en 550 m/s · " + z + " · TL", a.TL, b.TL, 1e-12);

  const c = E.sitio({ zona: z, suelo: "S2", vs30_ms: 350 });
  const d = E.sitio({ zona: z, suelo: "S3", vs30_ms: 350 });
  cerca("continuidad S2|S3 en 350 m/s · " + z + " · S", c.S, d.S, 1e-12);
  cerca("continuidad S2|S3 en 350 m/s · " + z + " · TP", c.TP, d.TP, 1e-12);
  cerca("continuidad S2|S3 en 350 m/s · " + z + " · TL", c.TL, d.TL, 1e-12);
}
/* En 200 m/s, TL también coincide con el S4. TP no: ahí la norma da un
   escalón de verdad, 0,9 a 1,2, porque S4 es un valor único y no intervalo. */
const s3 = E.sitio({ zona: "Z2", suelo: "S3", vs30_ms: 200 });
const s4 = E.sitio({ zona: "Z2", suelo: "S4", vs30_ms: 150 });
cerca("continuidad S3|S4 en 200 m/s · TL", s3.TL, s4.TL, 1e-12);
comp("TP sí da un escalón real en S3|S4 · 0,9 a 1,2", [s3.TP, s4.TP].join("/"), "0.9/1.2");

/* Y el sentido explícito: el primer valor del intervalo va con el suelo MÁS
   RÍGIDO. Con Z1-S3, que va de 1,30 a 1,60, el extremo rígido es el 1,30. */
cerca("Z1-S3 en el extremo rígido (350 m/s) · S = 1,30",
  E.sitio({ zona: "Z1", suelo: "S3", vs30_ms: 350 }).S, 1.30, 1e-12);
cerca("Z1-S3 en el extremo blando (200 m/s) · S = 1,60",
  E.sitio({ zona: "Z1", suelo: "S3", vs30_ms: 200 }).S, 1.60, 1e-12);
cerca("y en el medio (275 m/s) · S = 1,45",
  E.sitio({ zona: "Z1", suelo: "S3", vs30_ms: 275 }).S, 1.45, 1e-12);
/* TL va al revés en el mismo tramo: 2,0 en el rígido, 1,6 en el blando. */
cerca("TL en S3 decrece al ablandarse · 350 m/s → 2,0",
  E.sitio({ zona: "Z1", suelo: "S3", vs30_ms: 350 }).TL, 2.0, 1e-12);
cerca("TL en S3 · 200 m/s → 1,6",
  E.sitio({ zona: "Z1", suelo: "S3", vs30_ms: 200 }).TL, 1.6, 1e-12);

/* ---------- Tablas 1, 4 y la guarda de Z4-S4 --------------------------- */
comp("Z4 = 0,45", E.Z.Z4, 0.45);
comp("Z1 = 0,10", E.Z.Z1, 0.10);
comp("S0 vale 0,80 en las cuatro zonas",
  E.ZONAS.map((z) => E.sitio({ zona: z, suelo: "S0" }).S).join(","), "0.8,0.8,0.8,0.8");
comp("S1 vale 1,00 en las cuatro zonas",
  E.ZONAS.map((z) => E.sitio({ zona: z, suelo: "S1" }).S).join(","), "1,1,1,1");
/* La Tabla 4 NO da valor para Z4-S4: dice «Requiere un análisis de respuesta
   de sitio». No hay número que inventar ahí. */
lanza("Z4 con suelo S4 PARA: la norma pide análisis de respuesta de sitio",
  () => E.sitio({ zona: "Z4", suelo: "S4" }), "análisis de respuesta de sitio");
comp("pero Z3-S4 sí está tabulado", E.sitio({ zona: "Z3", suelo: "S4" }).S, 1.30);
lanza("una zona inventada PARA", () => E.sitio({ zona: "Z9", suelo: "S1" }), "la zona es");
lanza("un suelo inventado PARA", () => E.sitio({ zona: "Z4", suelo: "S7" }), "perfil de suelo");

/* ---------- sin V̄s30 · el caso normal en un galpón -------------------- */
/* Casi nunca hay ensayo de ondas de corte. La nota (*) da la salida
   conservadora y el módulo la usa: MAYOR valor de S, TP = 0,6 y TL = 2,0. */
const sinM = E.sitio({ zona: "Z4", suelo: "S2" });
cierto("sin V̄s30 lo declara", sinM.sinVs30 === true);
comp("y toma el mayor valor del intervalo de S", sinM.S, 1.10);
comp("con TP = 0,6", sinM.TP, 0.6);
comp("y TL = 2,0", sinM.TL, 2.0);
comp("en S3 la salida es TP = 0,9", E.sitio({ zona: "Z4", suelo: "S3" }).TP, 0.9);
comp("y TL = 1,6", E.sitio({ zona: "Z4", suelo: "S3" }).TL, 1.6);
/* Conservadora de verdad: el mayor S del intervalo contra el que saldría
   interpolando en el extremo rígido. */
cierto("y es más conservadora que interpolar en el extremo rígido",
  sinM.S > E.sitio({ zona: "Z4", suelo: "S2", vs30_ms: 550 }).S);

/* ---------- U · Tabla 7 ------------------------------------------------- */
comp("categoría C · almacén corriente", E.factorU("C").U, 1.0);
comp("categoría B · concentra gente", E.factorU("B").U, 1.3);
comp("categoría A · inflamables o tóxicos", E.factorU("A").U, 1.5);
cerca("del almacén al depósito inflamable la fuerza sube un 50 %",
  E.factorU("A").U / E.factorU("C").U, 1.5, 1e-12);
lanza("una categoría inventada PARA", () => E.factorU("D"), "categoría es A, B o C");

/* ---------- C · LA TRAMPA DEL ANÁLISIS ESTÁTICO ------------------------ */
/* La rampa del primer tramo es nueva en 2026: C va de 1,0 en T = 0 a 2,5 en
   T = 0,2·TP. Un galpón es corto y rígido, así que cae justo ahí. */
const TP = 0.6, TL = 2.0;
comp("espectro · T = 0 arranca en C = 1,0", E.factorC({ T_s: 0, TP: TP, TL: TL }).C, 1.0);
cerca("espectro · T = 0,2·TP llega a 2,5",
  E.factorC({ T_s: 0.2 * TP, TP: TP, TL: TL }).C, 2.5, 1e-12);
cerca("espectro · a la mitad de la rampa, 1,75",
  E.factorC({ T_s: 0.1 * TP, TP: TP, TL: TL }).C, 1.75, 1e-12);
comp("espectro · meseta entre 0,2·TP y TP", E.factorC({ T_s: 0.4, TP: TP, TL: TL }).C, 2.5);
cerca("espectro · TP < T < TL cae con TP/T",
  E.factorC({ T_s: 1.0, TP: TP, TL: TL }).C, 2.5 * 0.6, 1e-12);
cerca("espectro · T > TL cae con 1/T²",
  E.factorC({ T_s: 4.0, TP: TP, TL: TL }).C, 2.5 * (0.6 * 2.0 / 16), 1e-12);

/* EL ART. 18.3 Y EL 34.1 LO DICEN DOS VECES: para la cortante basal estática,
   C = 2,5 en todo 0 ≤ T ≤ TP. Sin rampa. */
comp("estático · T = 0 ya vale 2,5", E.factorCestatico({ T_s: 0, TP: TP, TL: TL }).C, 2.5);
comp("estático · T = 0,05 s sigue 2,5", E.factorCestatico({ T_s: 0.05, TP: TP, TL: TL }).C, 2.5);
/* Y AQUÍ ESTÁ LA TRAMPA MEDIDA: un galpón con T = 0,05 s recibiría del
   espectro C = 1,625 y del estático 2,5. Usar el del espectro en un cálculo
   estático deja la fuerza en el 65 % de la correcta. */
cerca("el espectro daría 1,625 con T = 0,05 s",
  E.factorC({ T_s: 0.05, TP: TP, TL: TL }).C, 1.625, 1e-12);
cerca("o sea el 65 % de la fuerza que toca",
  E.factorC({ T_s: 0.05, TP: TP, TL: TL }).C / E.factorCestatico({ T_s: 0.05, TP: TP, TL: TL }).C,
  0.65, 1e-12);
/* Por encima de TP los dos coinciden: la diferencia vive exactamente donde
   está el galpón. */
cerca("por encima de TP los dos C coinciden",
  E.factorC({ T_s: 1.2, TP: TP, TL: TL }).C,
  E.factorCestatico({ T_s: 1.2, TP: TP, TL: TL }).C, 1e-12);

/* ---------- R · Tabla 10 y el péndulo invertido ------------------------ */
comp("SMF = 8", E.coefR({ sistema: "SMF", pendulo: false }).R0, 8);
comp("OMF = 4", E.coefR({ sistema: "OMF", pendulo: false }).R0, 4);
comp("SCBF = 7", E.coefR({ sistema: "SCBF", pendulo: false }).R0, 7);
comp("péndulo invertido = 2,5", E.coefR({ pendulo: true }).R0, 2.5);
/* V ∝ 1/R: llamar OMF a un péndulo da el 62 % de la fuerza correcta. */
cerca("llamar OMF a un péndulo da el 62,5 % de la fuerza",
  E.coefR({ pendulo: true }).R / E.coefR({ sistema: "OMF", pendulo: false }).R, 0.625, 1e-12);
/* NO SE SUPONE que no es péndulo: un tijeral sobre columnas en voladizo lo
   es, y es el candidato directo en la dirección transversal del galpón. */
lanza("no decir si es péndulo invertido PARA",
  () => E.coefR({ sistema: "OMF" }), "péndulo invertido");
lanza("un sistema fuera de la Tabla 10 PARA",
  () => E.coefR({ sistema: "XYZ", pendulo: false }), "Tabla N° 10");
comp("R = R₀·Ia·Ip", E.coefR({ sistema: "SMF", pendulo: false, Ia: 0.75, Ip: 0.9 }).R, 8 * 0.75 * 0.9);
/* HUECO NORMATIVO · la Tabla 10 usa las siglas del AISC 341 pero la E.030 no
   invoca el documento. Los sistemas «especiales» quedan señalados. */
cierto("SMF señala que exige el detallado del AISC 341",
  E.coefR({ sistema: "SMF", pendulo: false }).exigeAISC341 === true);
cierto("OMF no lo exige",
  E.coefR({ sistema: "OMF", pendulo: false }).exigeAISC341 === false);

/* ---------- período · Art. 36 ------------------------------------------ */
comp("CT = 35 para pórticos a momento", E.periodo({ tipo: "momento", hn_m: 7 }).CT, 35);
cerca("T = hn/CT", E.periodo({ tipo: "momento", hn_m: 7 }).T_s, 7 / 35, 1e-12);
comp("CT = 45 arriostrados", E.periodo({ tipo: "arriostrado", hn_m: 9 }).CT, 45);
lanza("un CT inventado PARA", () => E.periodo({ tipo: "tijeral", hn_m: 7 }), "Art. 36.1");
/* Rayleigh · la salida cuando la geometría no encaja en ninguna CT. */
const ray = E.periodoRayleigh({ P_kgf: [10000], d_cm: [1.5], f_kgf: [2000] });
cerca("Rayleigh con un nivel", ray.T_s,
  2 * Math.PI * Math.sqrt(10000 * 2.25 / (981 * 3000)), 1e-12);
lanza("Rayleigh con arreglos desparejos PARA",
  () => E.periodoRayleigh({ P_kgf: [1, 2], d_cm: [1], f_kgf: [1] }), "del mismo largo");

/* ---------- peso sísmico · Art. 31 ------------------------------------- */
/* Para el pórtico manda el inciso d): 25 % de la carga viva de TECHO. */
comp("techo · 25 % de la viva", E.pesoSismico({ caso: "techo", D_kgf: 1000, L_kgf: 400 }).P_kgf, 1100);
comp("categoría C · 25 %", E.pesoSismico({ caso: "C", D_kgf: 1000, L_kgf: 400 }).P_kgf, 1100);
comp("categoría A · 50 %", E.pesoSismico({ caso: "A", D_kgf: 1000, L_kgf: 400 }).P_kgf, 1200);
comp("depósito · 80 % de lo almacenable",
  E.pesoSismico({ caso: "deposito", D_kgf: 1000, L_kgf: 400 }).P_kgf, 1320);
lanza("un caso del Art. 31 inventado PARA",
  () => E.pesoSismico({ caso: "otro", D_kgf: 1000 }), "Art. 31");

/* ---------- cortante basal · Art. 34 ---------------------------------- */
/* Un galpón: Z4, suelo S2 sin medición, almacén (C), péndulo invertido,
   T = 0,2 s, P = 20 000 kgf.
   V = Z·U·C·S·P/R = 0,45·1,0·2,5·1,10·20000/2,5 */
const V = E.cortanteBasal({
  zona: "Z4", suelo: "S2", categoria: "C", pendulo: true,
  T_s: 0.2, P_kgf: 20000
});
comp("C del estático es 2,5", V.C, 2.5);
comp("S sin medición es 1,10", V.S, 1.10);
comp("R del péndulo es 2,5", V.R, 2.5);
cerca("V = 0,45·1,0·2,5·1,10·20000/2,5 = 9 900 kgf", V.V_kgf, 9900, 1e-9);
cierto("y C/R = 1,0 queda muy por encima del mínimo", V.enMinimoCR === false);

/* EL MÍNIMO C/R ≥ 0,11 · Art. 34.2, piso absoluto. Con SMF (R = 8) y un
   período largo, C/R cae por debajo y el mínimo manda. */
const Vmin = E.cortanteBasal({
  zona: "Z1", suelo: "S1", categoria: "C", sistema: "SMF", pendulo: false,
  T_s: 3.0, P_kgf: 20000
});
cierto("con R = 8 y T = 3 s el mínimo C/R muerde", Vmin.enMinimoCR === true);
comp("y se usa 0,11", Vmin.CR_usado, 0.11);
cierto("que es mayor que el C/R real", Vmin.CR < 0.11);
/* SIN ESTA GUARDA DEVOLVÍA NaN EN SILENCIO, que se propaga por todo el
   cálculo y no lo delata ningún resultado hasta que alguien mira una celda
   vacía. Lo encontré auditando antes de E3. */
lanza("la cortante basal sin peso sísmico PARA en vez de devolver NaN",
  () => E.cortanteBasal({ zona: "Z4", suelo: "S2", categoria: "C", pendulo: true, T_s: 0.2 }),
  "P_kgf");
lanza("y con un peso de cero también",
  () => E.cortanteBasal({ zona: "Z4", suelo: "S2", categoria: "C", pendulo: true,
    T_s: 0.2, P_kgf: 0 }), "P_kgf");

/* ---------- reparto en altura · Art. 35 -------------------------------- */
comp("T ≤ 0,5 s · k = 1,0", E.exponenteK(0.4).k, 1.0);
cerca("T = 1,0 s · k = 0,75 + 0,5·1,0 = 1,25", E.exponenteK(1.0).k, 1.25, 1e-12);
comp("k tiene tope 2,0", E.exponenteK(10).k, 2.0);
const rep = E.fuerzasPorNivel({ P_kgf: [10000, 8000], h_m: [4, 8], T_s: 0.3, V_kgf: 1000 });
cerca("los α suman 1", rep.alfa.reduce((a, b) => a + b, 0), 1, 1e-12);
cerca("las fuerzas suman V", rep.F_kgf.reduce((a, b) => a + b, 0), 1000, 1e-9);
cierto("el nivel alto se lleva más aunque pese menos", rep.F_kgf[1] > rep.F_kgf[0]);

/* ---------- desplazamientos · EL PASO QUE MÁS SE OLVIDA ---------------- */
const dsp = E.desplazamientos({ regularidad: "regular", R: 8, delta_cm: [1.0, 2.0] });
comp("regular · multiplicador 0,75·R", dsp.multiplicador, 6);
comp("y amplifica los desplazamientos", dsp.delta_cm.join(","), "6,12");
comp("irregular · 0,85·R",
  E.desplazamientos({ regularidad: "irregular", R: 8, delta_cm: [1] }).multiplicador, 6.8);
/* CUÁNTO COSTABA OLVIDARLO: con R = 8 la deriva quedaría dividida por 6, y
   con R = 4 por 3. Cumpliría siempre. */
comp("olvidarlo con R = 8 divide la deriva por 6", dsp.multiplicador, 6);
comp("y con R = 4, por 3",
  E.desplazamientos({ regularidad: "regular", R: 4, delta_cm: [1] }).multiplicador, 3);
lanza("no decir la regularidad PARA",
  () => E.desplazamientos({ R: 8, delta_cm: [1] }), "regular");
/* Y los mínimos NO se aplican aquí · Art. 50.3 */
cierto("lo dice al devolver", /no se aplican/i.test(dsp.nota));

/* ---------- deriva · Tabla 14 y la licencia industrial ----------------- */
comp("acero · 0,010", E.limiteDeriva({ material: "acero" }).limite, 0.010);
comp("concreto armado · 0,007", E.limiteDeriva({ material: "concreto" }).limite, 0.007);
/* La nota de la Tabla 14 es una licencia explícita para uso industrial: lo
   fija el proyectista, pero NUNCA excede el doble. */
comp("industrial en acero · tope 0,020",
  E.limiteDeriva({ material: "acero", industrial: true }).limite, 0.020);
comp("el proyectista puede fijar menos",
  E.limiteDeriva({ material: "acero", industrial: true, propuesto: 0.015 }).limite, 0.015);
lanza("pasar del doble PARA: la nota dice «en ningún caso»",
  () => E.limiteDeriva({ material: "acero", industrial: true, propuesto: 0.025 }),
  "doble de la");
lanza("un material fuera de la Tabla 14 PARA",
  () => E.limiteDeriva({ material: "vidrio" }), "Tabla N° 14");

/* ---------- las citas viajan ------------------------------------------- */
cierto("cada resultado trae su artículo de la E.030",
  V.art.indexOf("E.030") >= 0 && dsp.art.indexOf("E.030") >= 0);


/* ================================================================
   LA EDIFICACIÓN · el uso da la categoría (Tabla N° 7, leída en la
   página 10 renderizada) · filas S.categoria.uso y siguientes
   ================================================================ */
{
  const cl = (d) => E.clasifica(Object.assign({ riesgoAdicional: false }, d));
  comp("cada uso, a su categoría de la Tabla N° 7",
    ["deposito", "industrial", "abastecimiento", "reunion", "patrimonio", "transporte", "educativo", "emergencia",
      "servicios", "archivo", "salud"].map((u) => cl({ uso: u }).sub),
    ["C", "C", "B", "B", "B", "A2", "A2", "A2", "A2", "A2", "A2"]);
  comp("y su U: C 1,0 · B 1,3 · A2 1,5", ["deposito", "reunion", "educativo"].map((u) => cl({ uso: u }).U), [1.0, 1.3, 1.5]);
  cierto("con la frase de la tabla que la sostiene", /cuya falla no acarree peligros adicionales/.test(cl({ uso: "deposito" }).cita) &&
    /Instituciones educativas/.test(cl({ uso: "educativo" }).cita));
  /* el depósito y la nave: C o A2 según su falla, y SE PREGUNTA */
  comp("la nave cuya falla acarrea incendio o fuga de contaminantes es A2", [cl({ uso: "industrial", riesgoAdicional: true }).sub,
    cl({ uso: "industrial", riesgoAdicional: true }).U], ["A2", 1.5]);
  cierto("con la otra frase: «grandes hornos, fábricas y depósitos de materiales inflamables o tóxicos»",
    /grandes hornos, fábricas/.test(cl({ uso: "deposito", riesgoAdicional: true }).cita));
  lanza("sin decirlo, no hay categoría: es U = 1,0 contra 1,5", () => E.clasifica({ uso: "deposito" }),
    ["incendio o fuga de contaminantes"]);
  cierto("(a los usos que no dependen de eso no se les pregunta)", E.clasifica({ uso: "reunion" }).sub === "B");
  /* lo que se niega, con su motivo */
  lanza("A1 se niega: aislamiento sísmico (E.031)", () => cl({ uso: "saludA1" }), ["aislamiento"]);
  lanza("lo provisional se niega: el Art. 19.3 deja U al proyectista", () => cl({ uso: "provisional" }), ["19.3"]);
  lanza("un uso que no está en la lista", () => cl({ uso: "granja" }), ["el uso de la edificación es uno de"]);
  /* usos combinados · Art. 19.2: «supere el 15 %» */
  comp("un 15 % exacto de otro uso NO cuenta: «supere»", [cl({ uso: "deposito", usoSecCat: "B", usoSecPct: 15 }).sub,
    cl({ uso: "deposito", usoSecCat: "B", usoSecPct: 15 }).combinado.cuenta], ["C", false]);
  comp("un 15,1 % sí, y su U es mayor: manda", [cl({ uso: "deposito", usoSecCat: "B", usoSecPct: 15.1 }).sub,
    cl({ uso: "deposito", usoSecCat: "B", usoSecPct: 15.1 }).U], ["B", 1.3]);
  comp("un otro uso de menor U no baja la categoría", cl({ uso: "reunion", usoSecCat: "C", usoSecPct: 60 }).sub, "B");
  lanza("otro uso sin su porcentaje", () => cl({ uso: "deposito", usoSecCat: "B" }), ["porcentaje"]);
  /* Tabla N° 9 y Art. 21.2 */
  const b4 = cl({ uso: "reunion", zona: "Z4", sistema: "OMF" });
  comp("B en zona 4: la Tabla N° 9 da acero SMF, IMF, SCBF, OCBF y EBF", b4.sistemas.lista, ["SMF", "IMF", "SCBF", "OCBF", "EBF"]);
  comp("el OMF no está en ella, pero la cobertura liviana permite cualquiera (Art. 21.2)",
    [b4.sistemas.enTabla9, b4.sistemas.permitido], [false, true]);
  comp("A2 en zonas 4, 3 y 2: SCBF y EBF; en la 1, cualquiera", ["Z4", "Z3", "Z2", "Z1"].map((z) =>
    cl({ uso: "educativo", zona: z }).sistemas.tabla9), ["acero SCBF, EBF", "acero SCBF, EBF", "acero SCBF, EBF", "cualquier sistema"]);
  comp("C, cualquiera en todas", cl({ uso: "deposito", zona: "Z4" }).sistemas.tabla9, "cualquier sistema");
  /* Tabla N° 13 */
  comp("las irregularidades de la Tabla N° 13, fila por fila",
    [["educativo", "Z4"], ["educativo", "Z1"], ["reunion", "Z2"], ["reunion", "Z1"], ["deposito", "Z3"], ["deposito", "Z2"],
      ["deposito", "Z1"]].map(([u, z]) => cl({ uso: u, zona: z }).irregularidad.texto.split(":")[0]),
    ["No se permiten irregularidades", "No se permiten irregularidades extremas", "No se permiten irregularidades extremas",
      "Sin restricciones", "No se permiten irregularidades extremas",
      "No se permiten irregularidades extremas excepto en edificios de hasta 2 pisos u 8 m de altura total",
      "Sin restricciones"]);
  comp("el peso sísmico del techo, 25 % (inciso d); el de piso según la categoría", [cl({ uso: "reunion" }).pctVivaTecho,
    cl({ uso: "reunion" }).pctVivaPiso, cl({ uso: "deposito" }).pctVivaPiso], [0.25, 0.5, 0.25]);
}

fin();
