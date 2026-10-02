/* =====================================================================
   probar_resultados.js — lo que enseñan Cargas y Análisis

   La regla que más importa aquí es la que no se ve: NINGÚN DATO DEL
   PROYECTO SE RELLENA SOLO.  Con el modelo vacío, Cargas dice lo que
   falta y Análisis manda a cada paso a por lo suyo.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const R = require("../src/resultados.js");
const MON = require("../src/montaje.js");
const L = require("../src/libro.js");
const P = require("../src/perfiles.js");
const V = require("../src/vistas.js");
const INV = require("../src/inventario.js");

const D = { luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6,
  peralteApoyo_m: 1.2, pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe",
  panosArriostradosTecho: [5], panosArriostradosFachada: [5] };
const m3 = MON.monta(D);
const SITIO = { espesorCobertura_mm: 0.4, Dotras_kgfm2: 5, hayNieve: false, V_kmh: 75,
  tipoEdificacion: 1, aberturas: { izqDer: "repartidas", derIzq: "repartidas", longitudinal: "repartidas" },
  acero: "A36", zona: "Z4", suelo: "S2", categoria: "C", sistemaSismico: "OMF", industrial: false };
const NOMBRES = { "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4",
  "diagonal": "L2X2X3/16", "montante": "L2X2X3/16", "correa": "C8X11.5", "viga de alero": "C8X11.5" };
const conPerfiles = (m) => {
  for (const k of Object.keys(NOMBRES)) m = L.asignaPerfil(m, { clase: k }, NOMBRES[k]).modelo;
  return m;
};

comp("todas las filas que cita el módulo existen", Object.keys(R.ART).filter((id) => !INV.existe(id)), []);

/* ================================================================
   1 · CARGAS · vacío, dice lo que falta
   ================================================================ */
const vac = R.cargas(m3, {});
comp("vacío no está completo", vac.completo, false);
const campos = vac.faltan.map((f) => f.campo).sort();
comp("y pide cada dato de proyecto, sin rellenar ninguno",
  campos, ["ca_ab_derIzq", "ca_ab_izqDer", "ca_ab_longitudinal", "ca_categoria", "ca_esp", "ca_indus",
    "ca_nieve", "ca_sissis", "ca_suelo", "ca_tipo", "ca_v", "ca_zona"]);
comp("cada falta apunta a un campo que existe en el formulario",
  vac.faltan.filter((f) => !R.CAMPOS_CARGAS.some((g) => g.campos.some((c) => "ca_" + c.id === f.campo))), []);
comp("sin cargas no hay nada que pasarle al análisis", vac.cargas, null);

/* ---- completo ---- */
const c = R.cargas(m3, SITIO);
comp("con todo, completo", c.completo, true);
comp("y el sismo va al análisis con lo que hace falta", c.cargas && c.cargas.sismo,
  { zona: "Z4", suelo: "S2", vs30_ms: undefined, categoria: "C", sistema: "OMF", industrial: false });
comp("8 combinaciones de acero con D, Lr, W y E", c.combinaciones.acero.length, 8);
const sinE = R.cargas(m3, Object.assign({}, SITIO, { zona: undefined }));
comp("SIN SISMO NO ESTÁ COMPLETO: la E.030 aplica en todo el Perú", sinE.completo, false);
cerca("D = 3,35 (TR-4 de 0,40) + 5 declarados", c.cargas.D_kgfm2, 3.35 + 5, 1e-12);
cerca("Lr reducida con At = luz × separación: 30·(0,25 + 4,6/√120)",
  c.cargas.Lr_kgfm2, 30 * (0.25 + 4.6 / Math.sqrt(120)), 1e-9);
comp("sin nieve no hay S", c.cargas.S, null);
comp("el viento lleva las tres aberturas", Object.keys(c.cargas.viento.aberturas).sort(),
  ["derIzq", "izqDer", "longitudinal"]);
cierto("la tabla de viento trae las tres direcciones",
  ["izquierda → derecha", "derecha → izquierda", "longitudinal (paralelo a la cumbrera)"]
    .every((d) => c.tablaViento.some((r) => r.direccion === d)));
cierto("con Ph = 0,005·C·Vh² en cada fila",
  c.tablaViento.every((r) => Math.abs(r.Ph_kgfm2 - 0.005 * r.C * 75 * 75) < 1e-9));

cierto("y las de la cimentación, aparte", c.combinaciones.concreto.length > 0);
const todas = c.fichas.reduce((a, f) => a.concat(f.lineas), []);
comp("NI UNA línea de Cargas sin procedencia válida",
  todas.filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);

/* ---- con nieve: S en vez de Lr ---- */
const cn = R.cargas(m3, Object.assign({}, SITIO, { hayNieve: true }));
cierto("con nieve y sin Qs, pide Qs", cn.faltan.some((f) => f.campo === "ca_qs"));
const cs = R.cargas(m3, Object.assign({}, SITIO, { hayNieve: true, Qs_kgfm2: 10 }));
cerca("con Qs = 10 sube al mínimo de 40 (N.Qs.min)", cs.cargas.S.Qt_kgfm2, 40, 1e-12);
comp("y no hay Lr", cs.cargas.Lr_kgfm2, null);

/* ================================================================
   2 · LOS FORMULARIOS · ida y vuelta
   ================================================================ */
const val = R.valoresDeSitio(SITIO);
comp("del sitio a los campos y de vuelta, idéntico", R.leeSitio(val), SITIO);
comp("un campo vacío NO se guarda como cero", R.leeSitio({ esp: "", v: "", dotras: "" }), {});
comp("cada dato de sitio que guarda el libro tiene su campo",
  L.SITIO.filter((k) => !R.CAMPOS_CARGAS.some((g) => g.campos.some((c2) => c2.clave.split(".")[0] === k))), []);
comp("ningún campo trae valor de partida",
  R.CAMPOS_CARGAS.concat(R.CAMPOS_ANALISIS).reduce((a, g) => a.concat(g.campos), [])
    .filter((c2) => c2.tipo === "opcion" && c2.opciones[0][0] !== "").map((c2) => c2.id), []);
comp("el sistema solo se lee entero", [R.leeSistema({ base: "empotrada", union: "" }),
  R.leeSistema({ base: "empotrada", union: "rigida" })], [null, { base: "empotrada", union: "rigida" }]);

/* ================================================================
   3 · ANÁLISIS · cada falta, a su paso
   ================================================================ */
const a0 = R.analisis(m3, L.nuevo({}), P);
comp("vacío no corre", a0.ok, false);
comp("y manda a donde toca: el sistema aquí, las cargas y el acero a Cargas",
  a0.faltas.map((f) => f.paso), ["analisis", "cargas", "cargas"]);
const m1 = Object.assign(L.nuevo({}), { sitio: SITIO, sistema: { base: "empotrada", union: "rigida" } });
const a1 = R.analisis(m3, m1, P);
comp("con cargas y sistema pero sin perfiles, manda a Geometría", a1.faltas.map((f) => f.paso), ["geom"]);
cierto("y dice qué clases faltan", /columna/.test(a1.faltas[0].que));
const m2 = Object.assign(L.nuevo({}), { sitio: SITIO, sistema: { base: "articulada", union: "apoyado" } });
const a2 = R.analisis(m3, m2, P);
cierto("el mecanismo se dice como una falta del paso Análisis, con su motivo",
  a2.faltas.length === 1 && a2.faltas[0].paso === "analisis" && /MECANISMO/.test(a2.faltas[0].que));

const mok = conPerfiles(Object.assign(L.nuevo({}), { sitio: SITIO, sistema: { base: "empotrada", union: "rigida" } }));
const ok = R.analisis(m3, mok, P);
comp("con todo, corre", ok.ok, true);
comp("con las 44 corridas, sismo incluido", ok.r.combinaciones.length, 44);
cierto("y la ficha del sismo sale en Análisis", ok.fichas.some((f) => f.titulo === "Sismo"));
const lf = ok.fichas.reduce((a, f) => a.concat(f.lineas), []);
comp("NI UNA línea de Análisis sin procedencia válida",
  lf.filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);

/* ---- el dibujo ---- */
for (const [modo] of R.MODOS) {
  const dj = R.dibujo(ok.r, m3, modo);
  cierto("el dibujo en modo " + modo + " pinta todas las barras del pórtico", dj.barras.length >= 40);
  cierto("y escala por el máximo: el peso va de 0 a 1",
    dj.barras.every((b) => b.peso >= 0 && b.peso <= 1 + 1e-12) && dj.barras.some((b) => b.peso > 0.999));
}
cierto("en modo momento solo llevan valor las columnas",
  R.dibujo(ok.r, m3, "momento").barras.filter((b) => b.valor !== 0).every((b) => b.clase === "columna"));
cierto("en tracción todos los valores son ≥ 0, en compresión ≤ 0",
  R.dibujo(ok.r, m3, "traccion").barras.every((b) => b.valor >= 0) &&
  R.dibujo(ok.r, m3, "compresion").barras.every((b) => b.valor <= 0));

/* ---- la selección ---- */
const sel = R.lineasFuerzas(ok.r, "BI3@0");
cierto("pinchar una barra de CUALQUIER pórtico da las fuerzas del típico (mismo nombre)", !!sel);
cierto("la brida inferior dice que cambia de signo", sel.lineas.some((l) => l.q === "Cambia de signo"));
cierto("y el ratio dice que falta el DISEÑO, no el análisis",
  sel.lineas.some((l) => l.q === "Ratio" && /diseño/.test(l.v)));
cierto("la columna lleva su momento", R.lineasFuerzas(ok.r, "C0@3").lineas.some((l) => /Momento/.test(l.q)));
comp("una barra que no es del pórtico (una correa) no tiene fuerzas aquí",
  R.lineasFuerzas(ok.r, "CO_S3_2"), null);

/* ---- las reacciones, por caso ---- */
const tr = R.tablaReacciones(ok.r);
comp("una fila por caso sin factorizar", tr.map((x) => x.caso), ok.r.casos.map((x) => x.id));
cerca("la D carga igual las dos bases", tr[0].B0.Ry, tr[0].B1.Ry, 1e-9);

/* ================================================================
   4 · DISEÑO
   ================================================================ */
comp("ningún dato de diseño trae valor de partida",
  R.CAMPOS_DISENO.reduce((a, g) => a.concat(g.campos), [])
    .filter((c2) => c2.tipo === "opcion" && c2.opciones[0][0] !== "").map((c2) => c2.id), []);
const DZ = { arriostreInferior_m: 3.33, separacionLargueros_m: 1.5, LbColumna_m: 3, arriostreComprobado: true,
  cartela: "3/8", separadores_cm: 60, conexionSeparadores: "requintado", condicionesE5: true,
  uniones: "soldadas", soldadura_cm: 10 };
comp("del diseño a los campos y de vuelta, idéntico", R.leeDiseno(R.valoresDeDiseno(DZ)), DZ);
comp("la soldadura no se guarda si las uniones son empernadas",
  R.leeDiseno({ un: "empernadas", sold: "10", pern: "4", dperno: "5/8" }),
  { uniones: "empernadas", pernosPorLinea: 4, diametroPerno: "5/8" });
const md0 = R.diseno(m3, mok, P);
comp("sin datos de diseño no verifica, y manda al paso Diseño a por ellos",
  [md0.ok, md0.faltas.every((f) => f.paso === "diseno")], [false, true]);
const mdz = Object.assign({}, mok, { diseno: DZ });
const dd = R.diseno(m3, mdz, P);
comp("con todo, verifica", dd.ok, true);
comp("todas las barras del pórtico en el dibujo", R.dibujoDiseno(dd, m3).barras.length, dd.v.resumen.total);
cierto("cada barra con su color: cumple, no cumple o falta", R.dibujoDiseno(dd, m3).barras
  .every((b) => ["ok", "no", "falta"].indexOf(b.cls) >= 0));
const ldd = R.lineasDiseno(dd.v, "C0@2");
cierto("la ficha de una columna dice su ratio y su perfil",
  ldd.lineas.some((l) => l.q === "Ratio") && ldd.lineas.some((l) => l.q === "Perfil"));
const sinE5 = R.diseno(m3, Object.assign({}, mok, { diseno: Object.assign({}, DZ, { condicionesE5: false }) }), P);
const lsin = R.lineasDiseno(sinE5.v, "D0@1");
cierto("sin el E5 la diagonal comprimida se pinta como «falta»",
  R.dibujoDiseno(sinE5, m3).barras.some((b) => b.clase === "diagonal" && b.cls === "falta"));
cierto("y su ficha dice FALTA, con el motivo en la nota",
  lsin.lineas.some((l) => l.v === "FALTA" && /E5/.test(l.nota)));
/* ---- lo que Comprobación tiene que oír ---- */
{
  const chica = (m) => {
    for (const k of ["diagonal", "montante"]) m = L.asignaPerfil(m, { clase: k }, "L2X2X3/16").modelo;
    return m;
  };
  const mp = chica(Object.assign({}, mok, { diseno: DZ, sistema: { base: "empotrada", union: "apoyado" },
    sitio: Object.assign({}, SITIO, { sistemaSismico: "OMF" }) }));
  const ap = R.analisis(m3, mp, P), dp = R.diseno(m3, mp, P, ap);
  const av = R.avisosResultados(ap, dp);
  cierto("Comprobación oye la deriva sísmica que no cumple", av.some((x) => /deriva sísmica/.test(x.que) && x.nivel === "error"));
  cierto("y las barras con ratio mayor que 1, con cuáles son", av.some((x) => /ratio mayor que 1/.test(x.que) && x.cuales.length > 0));
  comp("y el sistema sísmico que no es el de la geometría, UNA vez",
    av.filter((x) => /sistema sísmico/.test(x.que)).length, 1);
  cierto("cada aviso manda a su paso", av.every((x) => ["analisis", "cargas", "diseno"].indexOf(x.paso) >= 0));
  comp("sin resultados vigentes, nada que añadir", R.avisosResultados(null, null), []);
}
comp("NI UNA línea de Diseño sin procedencia válida",
  ldd.lineas.concat(lsin.lineas).concat(dd.fichas[0].lineas)
    .filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);

/* ================================================================
   6 · CIMENTACIÓN · E8
   ================================================================ */
const CZ = { sigmaAdm_kgfcm2: 1.5, esNeta: false, Df_cm: 150, gammaRelleno_kgfm3: 1800, sc_kgfm2: 500,
  fc_kgcm2: 210, grado: "60", rec_cm: 7.5, barra: "5/8", pedB_cm: 40, pedL_cm: 60, sobreTerreno_cm: 20,
  pedBarra: "5/8", pedEstribo: "3/8", pedRec_cm: 4, junta: "rugosa",
  placaB_cm: 30, placaN_cm: 40, pernoF_cm: 14, pernosFila: 1, pernoD: "1-1/4", pernoMat: "A36",
  pernoLd_cm: 40, electrodo: "E70", llaveL_cm: 15, llaveH_cm: 10, llaveT_cm: 2.5, grout_cm: 2.5 };
comp("de los datos a los campos y de vuelta, idéntico",
  R.leeCimentacion(R.valoresDeCimentacion(CZ)), CZ);
comp("un campo vacío NO se guarda como cero", R.leeCimentacion({ sigma: "", df: "", neta: "" }), {});
comp("cada dato de cimentación que guarda el libro tiene su campo",
  L.CIMENTACION.filter((k) => !R.CAMPOS_CIMENTACION.some((g) => g.campos.some((c2) => c2.clave === k))), []);
comp("y cada campo, su dato en el libro",
  R.CAMPOS_CIMENTACION.reduce((a, g) => a.concat(g.campos), []).filter((c2) => L.CIMENTACION.indexOf(c2.clave) < 0)
    .map((c2) => c2.id), []);
comp("ningún campo de cimentación trae valor de partida",
  R.CAMPOS_CIMENTACION.reduce((a, g) => a.concat(g.campos), [])
    .filter((c2) => c2.tipo === "opcion" && c2.opciones[0][0] !== "").map((c2) => c2.id), []);
const cz0 = R.cimentacion(m3, L.nuevo({}), P);
comp("sin análisis no corre, y manda primero al análisis", [cz0.ok, cz0.faltas[0].paso], [false, "analisis"]);
const cz1 = R.cimentacion(m3, mok, P);
comp("con análisis y sin datos, todo lo que falta es del paso Cimentación",
  cz1.faltas.every((f) => f.paso === "cimen"), true);
const idsCz = R.CAMPOS_CIMENTACION.reduce((a, g) => a.concat(g.campos), []).map((c2) => "ci_" + c2.id);
comp("y cada falta lleva a un campo que existe", cz1.faltas.filter((f) => idsCz.indexOf(f.campo) < 0)
  .map((f) => f.campo), []);
const mcz = Object.assign({}, mok, { cimentacion: CZ });
const cz = R.cimentacion(m3, mcz, P, ok);
comp("con todo, corre", cz.ok, true);
cierto("y busca las medidas", cz.z.auto === true && cz.z.zapata.B_cm > 0 && cz.z.zapata.h_cm > 0);
cierto("usa los casos del análisis que se le da", cz.r === ok.r);
const czm = R.cimentacion(m3, Object.assign({}, mok, { cimentacion: Object.assign({}, CZ,
  { B_cm: 120, L_cm: 140, h_cm: 50 }) }), P, ok);
comp("con medidas dadas, las verifica tal cual", [czm.z.auto, czm.z.zapata], [false, { B_cm: 120, L_cm: 140, h_cm: 50 }]);
const czIncompleta = R.cimentacion(m3, Object.assign({}, mok, { cimentacion: Object.assign({}, CZ,
  { B_cm: 120 }) }), P, ok);
comp("con solo una medida, no verifica a medias: las busca", czIncompleta.z.auto, true);
comp("el libro guarda la cimentación", L.nuevo({ cimentacion: CZ }).cimentacion, CZ);
lanza("y rechaza una clave que no es de cimentación",
  () => L.paraGuardar(Object.assign(L.nuevo({}), { cimentacion: { fc: 210 } })), ["cimentación desconocidos"]);
const dcz = R.dibujoCimentacion(cz);
comp("el dibujo trae las medidas de la zapata y del pedestal",
  [dcz.B, dcz.L, dcz.h, dcz.pedB, dcz.pedL, dcz.Df], [cz.z.zapata.B_cm, cz.z.zapata.L_cm, cz.z.zapata.h_cm, 40, 60, 150]);
cierto("la presión dibujada es la de servicio que manda, y su pico es qmax",
  dcz.presion.combo === cz.z.servicio.peor.combo &&
  Math.abs(Math.max.apply(null, dcz.presion.puntos.map((q) => q[1])) - cz.z.servicio.peor.qmax) < 1e-9);
cierto("con presión triangular, un borde queda sin apoyo (q = 0)",
  cz.z.servicio.peor.forma !== "triángulo" || dcz.presion.puntos.some((q) => q[1] === 0));
comp("las barras dibujadas son las calculadas", [dcz.barrasL, dcz.barrasB],
  [cz.z.concreto.aceroL.n, cz.z.concreto.aceroB.n]);
comp("si la zapata cumple, Comprobación no dice nada de ella",
  R.avisosResultados(null, null, cz).length, cz.z.cumple ? 0 : 1);
const czMal = R.cimentacion(m3, Object.assign({}, mok, { cimentacion: Object.assign({}, CZ,
  { B_cm: 80, L_cm: 80, h_cm: 40 }) }), P, ok);
const avMal = R.avisosResultados(null, null, czMal);
cierto("una zapata dada que no cumple es un ERROR en Comprobación, con su paso",
  avMal.some((x) => x.nivel === "error" && x.paso === "cimen" && /La zapata no cumple/.test(x.que)));
/* ---- el pedestal y la placa, dentro ---- */
cierto("EL PERALTE QUE VUELVE: la zapata buscada sube hasta anclar las barras del pedestal",
  cz.z.zapata.h_cm >= cz.ped.anclaje.hMin_cm - 1e-9 && cz.ped.anclaje.cumple && cz.z.zapata.h_cm > 40);
cerca("y el pedestal mide Df − h + lo que sobresale", cz.ped.peso_kgf,
  2400e-6 * 40 * 60 * (150 - cz.z.zapata.h_cm + 20), 1e-9);
{
  const z40 = R.cimentacion(m3, Object.assign({}, mok, { cimentacion: Object.assign({}, CZ,
    { B_cm: 200, L_cm: 200, h_cm: 40 }) }), P, ok);
  cierto("con la zapata dada de 40 cm, fallan la zapata y el pedestal por el anclaje",
    z40.z.fallas.indexOf("anclaje del pedestal") >= 0 && z40.ped.fallas.indexOf("anclaje en la zapata") >= 0);
  comp("y con 50 cm, no", czm.z.fallas.indexOf("anclaje del pedestal"), -1);
}
{
  /* la placa: una fila por corrida y por base, con las fuerzas del tramo de columna del pie */
  comp("la placa se mira en todas las corridas, en las dos bases", cz.placa.filas.length, 2 * ok.r.corridas.length);
  const f0 = cz.placa.filas[0], fz = ok.r.corridas[0].fuerzas["C0@" + ok.r.eje];
  cerca("con Pu = −Pr del pie de la columna, que ya lleva B2", f0.m.Pu_kgf, -fz.Pr_kgf, 1e-9);
  cerca("y el momento del extremo de abajo", f0.m.Mu_kgfcm, Math.abs(fz.Mi_kgfcm), 1e-9);
  cerca("A2 sale del pedestal: 30×40 crece hasta 40/30 = 1,33", cz.placa.A2.A2_cm2, Math.pow(40 / 30, 2) * 1200, 1e-9);
  cerca("y llega al aplastamiento: fp = 0,65·0,85·f'c·√(A2/A1)", cz.placa.filas[0].m.fp_kgcm2,
    0.65 * 0.85 * 210 * (40 / 30), 1e-9);
  const delgada = R.cimentacion(m3, Object.assign({}, mok, { cimentacion: Object.assign({}, CZ, { placaT_cm: 0.6 }) }), P, ok);
  cierto("una placa de 6 mm no llega y Comprobación lo da como error",
    delgada.placa.fallas.indexOf("espesor de la placa") >= 0 &&
    R.avisosResultados(null, null, delgada).some((x) => x.nivel === "error" && x.paso === "cimen" &&
      /La placa base no cumple/.test(x.que)));
  const sinLlave = R.cimentacion(m3, Object.assign({}, mok, { cimentacion: Object.assign({}, CZ, { llaveL_cm: undefined }) }), P, ok);
  cierto("sin llave de corte no diseña: la pide, porque los pernos no toman el cortante",
    !sinLlave.ok && sinLlave.faltas.some((f) => f.campo === "ci_lll" && /llave/.test(f.que)));
  const dz = R.dibujoCimentacion(cz);
  cierto("el dibujo lleva el pedestal armado y la placa con sus pernos",
    dz.pedestal.nb === cz.ped.seccion.nb && dz.placa.N === 40 && dz.placa.n === 1);
}
/* ---- EL PÓRTICO DE FACHADA ---- */
{
  const aF = R.analisis(m3, mok, P, "fachada");
  comp("el pórtico de fachada corre, en el eje 0 y con medio paño", [aF.ok, aF.r.eje, aF.r.trib_m, aF.r.fachada],
    [true, 0, ok.r.trib_m / 2, true]);
  cierto("y su ficha dice que es el de fachada", aF.fichas[0].lineas.some((l) => /de fachada, eje 0/.test(l.v)));
  lanza("un pórtico que no existe se rechaza", () => R.analisis(m3, mok, P, "lateral"), ["no «lateral»"]);
  const dF = R.diseno(m3, mdz, P, aF);
  cierto("se diseña con sus fuerzas, y como lleva menos carga, su peor ratio es menor",
    dF.ok && dF.v.resumen.peor.ratio < dd.v.resumen.peor.ratio);
  const cF = R.cimentacion(m3, mcz, P, aF);
  cierto("su zapata buscada sale MÁS CHICA que la interior", cF.ok && cF.z.zapata.B_cm < cz.z.zapata.B_cm);
  const cF2 = R.cimentacion(m3, mcz, P, undefined, "fachada");
  comp("y sin pasarle el análisis, lo corre del pórtico que se le pide", cF2.z.zapata, cF.z.zapata);
  const malF = R.cimentacion(m3, Object.assign({}, mok, { cimentacion: Object.assign({}, CZ, { B_cm: 80, L_cm: 80, h_cm: 50 }) }), P, aF);
  cierto("en Comprobación, el aviso dice de qué pórtico es",
    R.avisosResultados(null, null, malF).some((x) => /^Pórtico de fachada · La zapata no cumple/.test(x.que)) &&
    R.avisosResultados(null, null, czMal).every((x) => !/fachada/.test(x.que)));
  cierto("las fuerzas de una barra dicen de qué pórtico salen",
    /pórtico de fachada \(eje 0\)/.test(R.lineasFuerzas(aF.r, "C0@0").nota));
}
comp("NI UNA línea de Cimentación sin procedencia válida",
  cz.fichas.reduce((a, f) => a.concat(f.lineas), []).concat(czm.fichas.reduce((a, f) => a.concat(f.lineas), []))
    .filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);


/* ================================================================
   A LO LARGO · longitudinal()
   ================================================================ */
{
  const lo0 = R.longitudinal(m3, L.nuevo({}), P);
  comp("sin el análisis de los pórticos no corre, y manda al análisis", [lo0.ok, lo0.faltas[0].paso], [false, "analisis"]);
  const lo = R.longitudinal(m3, mok, P);
  cierto("con el análisis, corre y da la cadena entera", lo.ok && lo.cadena.length >= 7);
  cierto("con el sismo a lo largo, del peso de TODOS los pórticos",
    lo.lg.sismo && Math.abs(lo.lg.sismo.P_kgf - (2 * R.analisis(m3, mok, P, "fachada").r.sismo.P_kgf +
      (m3.ejes.porticos - 2) * ok.r.sismo.P_kgf)) < 1e-6);
  comp("sin los datos de diseño, el diseño a lo largo los pide a Diseño", [lo.diseno, lo.faltasDiseno[0].paso], [null, "diseno"]);
  const lod = R.longitudinal(m3, mdz, P);
  cierto("con ellos, verifica cada pieza", lod.diseno && lod.diseno.piezas.length >= 5);
  cierto("sin perfil asignado, la pieza lo dice y no cumple",
    lod.diseno.piezas.filter((x) => x.pieza === "cruz de fachada")[0].faltanEsenciales);
  const av = R.avisosLongitudinal(lod);
  cierto("y Comprobación lo da como error, con el paso", av.length && av.every((x) => x.nivel === "error" && x.paso === "diseno") &&
    av.some((x) => /^A lo largo/.test(x.que)));
  {
    let mp = mdz;
    for (const [k, v] of [["arriostre de fachada", "VAR3/8"], ["arriostre de techo", "HSS4X4X1/4"]]) mp = L.asignaPerfil(mp, { clase: k }, v).modelo;
    const lp = R.longitudinal(m3, mp, P);
    const avp = R.avisosLongitudinal(lp);
    cierto("una cruz de VAR3/8 no llega: Comprobación lo da como ERROR y la nombra",
      avp.some((x) => x.nivel === "error" && /no cumplen/.test(x.que) && /cruz de fachada/.test(x.porque)));
  }
  comp("NI UNA línea de A lo largo sin procedencia válida",
    lo.fichas.reduce((a, f) => a.concat(f.lineas), []).filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);
  cierto("cada eslabón cita su fila", lo.cadena.every((x) => INV.existe(x.fuente)));
}

fin();
