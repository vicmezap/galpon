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
  acero: "A36", distrito: "LIMA › LIMA · MIRAFLORES", suelo: "S2", uso: "deposito", riesgoAdicional: false, usoSecCat: "no", sistemaSismico: "OMF", industrial: false };
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
  campos, ["ca_ab_derIzq", "ca_ab_izqDer", "ca_ab_longitudinal", "ca_esp", "ca_nieve", "ca_sissis",
    "ca_tipo", "ca_v", "ed_dist", "ed_indus", "ed_suelo", "ed_uso"]);
comp("cada falta apunta a un campo que existe: los de Cargas en Cargas, los de la edificación en Datos",
  vac.faltan.filter((f) => !(R.CAMPOS_CARGAS.some((g) => g.campos.some((c) => "ca_" + c.id === f.campo)) ||
    (f.paso === "datos" && R.CAMPOS_EDIFICACION.some((g) => g.campos.some((c) => "ed_" + c.id === f.campo))))), []);
comp("sin cargas no hay nada que pasarle al análisis", vac.cargas, null);

/* ---- completo ---- */
const c = R.cargas(m3, SITIO);
comp("con todo, completo", c.completo, true);
comp("y el sismo va al análisis con lo que hace falta", c.cargas && c.cargas.sismo,
  { zona: "Z4", distrito: "LIMA › LIMA · MIRAFLORES", suelo: "S2", vs30_ms: undefined, categoria: "C", sub: "C", uso: "deposito",
    sistema: "OMF", industrial: false });
comp("8 combinaciones de acero con D, Lr, W y E", c.combinaciones.acero.length, 8);
const sinE = R.cargas(m3, Object.assign({}, SITIO, { distrito: undefined }));
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
const ordena = (o) => Object.keys(o).sort().reduce((x, k) => { x[k] = o[k]; return x; }, {});
comp("del sitio a los campos —Cargas y la edificación de Datos— y de vuelta, idéntico",
  ordena(Object.assign(R.leeSitio(val), R.leeEdificacion(R.valoresDeEdificacion(SITIO)))), ordena(SITIO));
comp("un campo vacío NO se guarda como cero", R.leeSitio({ esp: "", v: "", dotras: "" }), {});
comp("cada dato de sitio que guarda el libro tiene su campo",
  L.SITIO.filter((k) => !R.CAMPOS_CARGAS.concat(R.CAMPOS_EDIFICACION).some((g) => g.campos.some((c2) => c2.clave.split(".")[0] === k))),
  ["categoria", "zona"]);
comp("(la categoría y la zona ya no tienen campo: salen del uso y del distrito, y el libro solo las acepta de modelos viejos)",
  R.CAMPOS_CARGAS.some((g) => g.campos.some((c2) => c2.clave === "categoria")), false);
comp("ningún campo trae valor de partida",
  R.CAMPOS_CARGAS.concat(R.CAMPOS_ANALISIS, R.CAMPOS_EDIFICACION).reduce((a, g) => a.concat(g.campos), [])
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
  /* las correas */
  const DZC = Object.assign({}, DZ, { tensores: 1, panelTramos: 3, clipCorreas: true });
  const cr0 = R.correas(m3, mok, P);
  comp("sin sus datos, las correas los piden a Diseño", [cr0.ok, cr0.faltas.map((f) => f.campo)], [false, ["di_ten", "di_ptram", "di_clip"]]);
  comp("y el libro los guarda y los lee", R.leeDiseno(R.valoresDeDiseno(DZC)), DZC);
  const cr = R.correas(m3, Object.assign({}, mok, { diseno: DZC }), P);
  cierto("con ellos, verifica cada línea con el C8X11.5 del modelo", cr.ok && cr.perfil === "C8X11.5" && cr.lineas.length === 13);
  cierto("y las de puntal llevan la axial del sistema a lo largo", cr.lineas.some((l) => l.puntal));
  comp("NI UNA línea de Correas sin procedencia válida",
    cr.fichas.reduce((a, f) => a.concat(f.lineas), []).filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);
  const crNo = R.correas(m3, L.asignaPerfil(Object.assign({}, mok, { diseno: DZC }), { clase: "correa" }, "C3X4.1").modelo, P);
  cierto("un C3X4.1 no llega, y Comprobación lo da como error",
    !crNo.cumple && R.avisosCorreas(crNo).some((x) => x.nivel === "error" && /correa/.test(x.que)));
  const crSin = R.correas(m3, Object.assign({}, mok, { diseno: Object.assign({}, DZC, { clipCorreas: false }) }), P);
  cierto("sin clip, Comprobación dice que las correas no se verifican",
    R.avisosCorreas(crSin).some((x) => x.nivel === "error" && /no se verifican/.test(x.que)));
  comp("NI UNA línea de A lo largo sin procedencia válida",
    lo.fichas.reduce((a, f) => a.concat(f.lineas), []).filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);
  cierto("cada eslabón cita su fila", lo.cadena.every((x) => INV.existe(x.fuente)));
}


/* ================================================================
   LOS TIPOS DE ZAPATA · filas ZT.*
   ================================================================ */
{
  let mt = mcz;
  for (const [k, v] of [["columna hastial", "W8X18"], ["arriostre de fachada", "VAR1"], ["arriostre de techo", "HSS4X4X1/4"],
    ["arriostre vertical", "VAR1/2"], ["puntal inferior", "HSS3X3X1/4"]]) mt = L.asignaPerfil(mt, { clase: k }, v).modelo;
  const m3h = MON.monta(Object.assign({}, D, { columnasHastiales: [5, 10, 15] }));
  const aI = R.analisis(m3h, mt, P, "interior"), aF = R.analisis(m3h, mt, P, "fachada");
  const lo = R.longitudinal(m3h, mt, P, aI, aF);
  const cc = aI.cargas.cargas;
  comp("cuatro tipos de zapata", R.TIPOS_ZAPATA, ["interior", "arriostrado", "fachada", "hastial"]);
  lanza("y ninguno más", () => R.cimentacion(m3h, mt, P, aI, "esquina"), ["no «esquina»"]);

  /* la del paño arriostrado: el pórtico interior + la cruz · fila ZT.cruz */
  const cA = R.casosZapata("arriostrado", aI, lo.lg, m3h, mt, P, cc);
  const wL = aI.r.casos.filter((x) => x.tipo === "W" && x.direccion === "longitudinal")[0];
  const eW = lo.lg.estados.filter((e) => e.tipo === "W" && Math.abs(e.Ci - wL.Ci) < 1e-9)[0];
  const cz0 = eW.cruces.filter((x) => x.lado === "izq")[0];
  const tira = cA.filter((x) => x.id === wL.id + " · cruz tira")[0], compr = cA.filter((x) => x.id === wL.id + " · cruz comprime")[0];
  cerca("cruz que tira: el pórtico con su viento longitudinal, menos el tirón H·h/s", tira.reacciones.B0.Ry_kgf,
    wL.reacciones.B0.Ry_kgf - cz0.vertical_kgf, 1e-9);
  cerca("y el cortante a lo largo, H", Math.abs(tira.reacciones.B0.Rz_kgf), cz0.H_kgf, 1e-9);
  cerca("la otra columna: compresión H·h/s y nada a lo largo", compr.reacciones.B0.Ry_kgf,
    wL.reacciones.B0.Ry_kgf + cz0.vertical_kgf, 1e-9);
  comp("(sin cortante a lo largo)", compr.reacciones.B0.Rz_kgf, 0);
  const eL = lo.lg.estados.filter((e) => e.tipo === "E")[0];
  const ELt = cA.filter((x) => x.id === "EL · cruz tira")[0];
  cerca("el sismo a lo largo entra como un estado más, solo con la cruz", Math.abs(ELt.reacciones.B0.Rz_kgf),
    eL.cruces.filter((x) => x.lado === "izq")[0].H_kgf, 1e-9);
  comp("(de tipo sismo)", ELt.tipo, "E");
  cierto("los casos que no son a lo largo no cambian",
    cA.filter((x) => x.id === "D")[0].reacciones.B0.Ry_kgf === aI.r.casos[0].reacciones.B0.Ry_kgf);

  /* la del pórtico de fachada: + el viento del hastial en la esquina · fila ZT.tipos */
  const cF = R.casosZapata("fachada", aF, lo.lg, m3h, mt, P, cc);
  const wF = aF.r.casos.filter((x) => x.tipo === "W" && x.direccion === "longitudinal")[0];
  const eF = lo.lg.estados.filter((e) => e.tipo === "W" && Math.abs(e.Ci - wF.Ci) < 1e-9)[0];
  cerca("la esquina, como barlovento: Hz = la reacción de abajo de la columna de esquina",
    Math.abs(cF.filter((x) => x.id === wF.id + " · barlovento")[0].reacciones.B0.Rz_kgf), eF.hastialInicio[0].Rbase_kgf, 1e-9);
  cerca("y como sotavento, la suya", Math.abs(cF.filter((x) => x.id === wF.id + " · sotavento")[0].reacciones.B0.Rz_kgf),
    eF.hastialFinal[0].Rbase_kgf, 1e-9);
  comp("sin cruz: el paño extremo no está arriostrado", cF.conCruz, false);

  /* la de la columna hastial · fila ZT.hastial */
  const cH = R.casosZapata("hastial", aI, lo.lg, m3h, mt, P, cc);
  const W8 = P.busca("W8X18"), Lh = cH.linea;
  cerca("la columna hastial: su peso y el muro de su franja", cH[0].reacciones.H.Ry_kgf,
    W8.peso_kgfm * Lh.H_m + cc.D_kgfm2 * (Lh.b - Lh.a) * Lh.H_m, 1e-9);
  comp("y la que más viento recibe es una hastial", Lh.tipo, "hastial");

  /* las zapatas */
  const zI = R.cimentacion(m3h, mt, P, aI, "interior"), zA = R.cimentacion(m3h, mt, P, aI, "arriostrado", lo);
  const zF = R.cimentacion(m3h, mt, P, aF, "fachada", lo), zH = R.cimentacion(m3h, mt, P, aI, "hastial", lo);
  cierto("las cuatro se diseñan", zI.ok && zA.ok && zF.ok && zH.ok);
  cierto("la del paño arriostrado sale MAYOR que la interior: le baja la cruz", zA.z.zapata.B_cm > zI.z.zapata.B_cm);
  cierto("y la de la columna hastial, la menor", zH.z.zapata.B_cm <= Math.min(zI.z.zapata.B_cm, zF.z.zapata.B_cm));
  cierto("la placa del paño arriostrado mira además lo que llega a lo largo", zA.placa.conHz &&
    zA.placa.filas.some((x) => x.aLoLargo && /primer orden/.test(x.combo)));
  cierto("la de la columna hastial se verifica con compresión y cortante", zH.placa.hastial && zH.placa.Hu_kgf > 0);
  /* EL PEDESTAL CON LOS CASOS DE SU ZAPATA: primero se armaba con los del pórtico y no veía la cruz */
  cierto("el pedestal del paño arriostrado ve el cortante a lo largo: su junta resiste la resultante",
    / · cruz | EL /.test(zA.ped.friccion.combo + " " + zA.ped.flexocompresion.combo));
  cierto("y el de la columna hastial, los de la columna hastial (base H, sin viva de techo)",
    zH.ped.flexocompresion.base === "H" && !/Lr/.test(zH.ped.flexocompresion.combo));
  cierto("la ficha del suelo dice las dos excentricidades cuando hay momento a lo largo",
    zA.fichas[1].lineas.some((l) => /e\/L · e\/B/.test(l.q)));
  cierto("y el aviso de Z.plano ya no dice que no llega nada a lo largo",
    !zA.z.avisos.some((x) => /no le llega nada a lo largo/.test(x)) && zI.z.avisos.some((x) => /no le llega nada/.test(x)));
  {
    const dz0 = R.dibujoCimentacion(zA);
    cierto("el dibujo de la presión va por el borde más cargado: su pico es la qmax del servicio",
      Math.abs(Math.max.apply(null, dz0.presion.puntos.map((q) => q[1])) - zA.z.servicio.peor.qmax) < 1e-6 * zA.z.servicio.peor.qmax);
  }
  const zAm = R.cimentacion(m3h, Object.assign({}, mt, { cimentacion: Object.assign({}, mt.cimentacion,
    { B_cm: 120, L_cm: 120, h_cm: 50 }) }), P, aI, "arriostrado", lo);
  cierto("en Comprobación, el aviso dice que es la zapata del paño arriostrado",
    R.avisosResultados(null, null, zAm).some((x) => /^Zapata del paño arriostrado · /.test(x.que)));
  const m3x = MON.monta(Object.assign({}, D, { panosArriostradosTecho: [0, 9], panosArriostradosFachada: [0, 9] }));
  /* con los paños extremos arriostrados, el paño 0 va del eje 0 al 1: el eje 1 es un pórtico interior que
     lo bordea, y la zapata de FACHADA también recibe la cruz */
  const cX = R.casosZapata("fachada", R.analisis(m3x, mt, P, "fachada"),
    R.longitudinal(m3x, mt, P).lg, m3x, mt, P, cc);
  cierto("con el paño extremo arriostrado, la zapata de fachada recibe también la cruz",
    cX.conCruz && cX.some((x) => / · cruz tira · barlovento$/.test(x.id)));
  comp("y la del paño arriostrado es la del eje 1", R.casosZapata("arriostrado", aI,
    R.longitudinal(m3x, mt, P).lg, m3x, mt, P, cc).eje, 1);
  cierto("sin columnas hastiales, tampoco hay zapata de columna hastial",
    !R.cimentacion(m3, mt, P, undefined, "hastial").ok);
  comp("NI UNA línea de las cuatro sin procedencia válida",
    [zI, zA, zF, zH].reduce((a, z) => a.concat(z.fichas.reduce((b, f) => b.concat(f.lineas), [])), [])
      .filter((l) => V.ORIGENES.indexOf(l.origen) < 0).map((l) => l.q), []);
}


/* las vigas de conexión en la pantalla · fila Z.conexion */
{
  const zNo = R.cimentacion(m3, mcz, P);
  comp("con S2 en zona 4 y 1,5 kgf/cm², no se exigen", zNo.viga.exigida, false);
  const mS3 = Object.assign({}, mcz, { sitio: Object.assign({}, mcz.sitio, { suelo: "S3" }) });
  const zS3 = R.cimentacion(m3, mS3, P);
  cierto("con S3 en zona 4 se exigen, y sin sección se pide", zS3.ok && zS3.viga.exigida && /sección/.test(zS3.viga.falta) &&
    R.avisosResultados(null, null, zS3).some((x) => /viga de conexión no tiene sección/.test(x.que)));
  const zV = R.cimentacion(m3, Object.assign({}, mS3, { cimentacion: Object.assign({}, mS3.cimentacion,
    { vigaB_cm: 25, vigaH_cm: 40 }) }), P);
  cierto("con sección, se diseña con el 10 % de la mayor carga de la columna", zV.viga.cumple && zV.viga.F_kgf > 0);
  comp("y la guarda el libro", R.leeCimentacion(R.valoresDeCimentacion({ vigaB_cm: 25, vigaH_cm: 40 })), { vigaB_cm: 25, vigaH_cm: 40 });
  cierto("la ficha dice el volteo con sismo", zNo.fichas[1].lineas.some((l) => /Volteo con sismo/.test(l.q)));
}


/* LAS UNIONES DEL TIJERAL · resultados.conexiones */
{
  comp("sin nada, pide cómo van las uniones y la cartela", R.conexiones(m3, mok, P).faltas.map((f) => f.campo),
    ["di_un", "di_cart"]);
  comp("soldadas sin filete ni electrodo, los pide", R.conexiones(m3, Object.assign({}, mok, { diseno: DZ }), P)
    .faltas.map((f) => f.campo), ["di_filete", "di_elec"]);
  const DZU = Object.assign({}, DZ, { filete_mm: 4, electrodo: "E70" });
  comp("y el libro los guarda", R.leeDiseno(R.valoresDeDiseno(DZU)), DZU);
  const mu = Object.assign({}, mok, { diseno: DZU });
  const cx = R.conexiones(m3, mu, P);
  comp("con ellos, las cuatro clases del tijeral", cx.ok && cx.filas.map((f) => f.clase),
    ["diagonal", "montante", "brida superior", "brida inferior"]);
  cierto("cada una con su ratio y lo que gobierna", cx.filas.every((f) => f.ratio > 0 && f.gobierna));
  /* la diagonal: la mayor tracción de todas las diagonales, en la corrida que la da */
  const g = require("../src/analisis.js").geometria(m3, ok.r.sistema, ok.r.eje);
  const diag = g.truss.filter((b) => b.clase === "diagonal");
  const NtMax = Math.max.apply(null, diag.map((b) => ok.r.barras[b.id.split("@")[0]].traccion.Pr_kgf));
  cerca("la diagonal se une con la mayor tracción de las diagonales", cx.filas[0].Nt_kgf, NtMax, 1e-9);
  /* la brida continua: en un nudo, la diferencia entre sus dos tramos */
  const bi = cx.filas[3];
  cierto("la brida pasa: se une la diferencia de sus tramos en un nudo, menor que su axial",
    bi.Nt_kgf > 0 && bi.Nt_kgf === bi.Nc_kgf && /nudo entre/.test(bi.comboT));
  cierto("en pulgadas, el filete de 4 mm cabe en los ángulos de 1/4\" (fila J.filete.pulgadas)",
    cx.filas.every((f) => !f.faltanEsenciales));
  comp("y todo cumple, sin avisos", [cx.cumple, R.avisosConexiones(cx)], [true, []]);
  cierto("la ficha dice lo que todavía no verifica", cx.fichas[1].lineas.some((l) => /columna–tijeral/.test(l.q)));
  /* con un filete demasiado grande falla, y la Comprobación lo dice */
  const cg = R.conexiones(m3, Object.assign({}, mok, { diseno: Object.assign({}, DZU, { filete_mm: 8 }) }), P);
  cierto("un filete de 8 mm no cabe en ningún borde de 1/4\" ni de 3/16\"", !cg.cumple &&
    cg.filas.every((f) => f.faltanEsenciales));
  cierto("y la Comprobación lo lleva a Conexiones", R.avisosConexiones(cg).some((x) => x.paso === "conex" && /4 unión/.test(x.que)));
  /* sin cartela no hay unión que verificar, y se dice */
  const c0 = R.conexiones(m3, Object.assign({}, mok, { diseno: Object.assign({}, DZU, { cartela: "0" }) }), P);
  cierto("con los ángulos en contacto no hay cartela: se dice que falta", c0.ok && c0.filas.every((f) => /cartela/.test(f.falta)));
  /* empernadas: pide sus datos */
  const ce = R.conexiones(m3, Object.assign({}, mok, { diseno: Object.assign({}, DZ, { uniones: "empernadas",
    pernosPorLinea: 3, diametroPerno: "5/8" }) }), P);
  comp("empernadas: pide el grado, la separación, el borde y el gramil", ce.faltas.map((f) => f.campo),
    ["di_gperno", "di_ps", "di_ple", "di_pg"]);
  /* el de fachada, con su título en el aviso */
  const cf = R.conexiones(m3, Object.assign({}, mok, { diseno: Object.assign({}, DZU, { filete_mm: 8 }) }), P, null, "fachada");
  cierto("el pórtico de fachada también, y su aviso lo dice", cf.ok &&
    /^Pórtico de fachada/.test(R.avisosConexiones(cf)[0].que));
}


/* EL PASO DATOS · el proyecto, y lo que falta paso por paso */
{
  comp("el proyecto, de los campos y de vuelta", R.leeProyecto(R.valoresDeProyecto({ nombre: "Almacén Ica", ubicacion: "Ica" })),
    { nombre: "Almacén Ica", ubicacion: "Ica" });
  comp("un campo en blanco no se guarda", R.leeProyecto({ nom: "  ", ubi: "Ica" }), { ubicacion: "Ica" });
  const vacio = R.pendientes({ m3: m3, modelo: L.nuevo({}), perfiles: P });
  const de = (lista, k) => lista.filter((x) => x.paso === k)[0];
  comp("con el modelo vacío, los ocho pasos, ninguno completo",
    vacio.map((x) => [x.paso, x.completo]), [["datos", false], ["geom", false], ["cargas", false], ["analisis", false],
      ["diseno", false], ["conex", false], ["cimen", false], ["hojas", false]]);
  cierto("Geometría pide los perfiles AUNQUE no haya sistema estructural (el análisis no llega a mirarlos)",
    de(vacio, "geom").faltas.some((f) => /el perfil de .*columna/.test(f.que)));
  comp("con perfiles en todo, Geometría queda completa", de(R.pendientes({ m3: m3, modelo: mok, perfiles: P, analisis: ok }),
    "geom").completo, !require("../src/vistas.js").tablaPerfiles(m3, mok).sinPerfil);
  comp("Cargas pide cada dato una vez, con su campo", de(vacio, "cargas").faltas.map((f) => f.campo).sort(),
    R.cargas(m3, {}).faltan.filter((f) => !f.paso).map((f) => f.campo).concat(["ca_acero"]).sort());
  comp("y los de la edificación, en Datos", de(vacio, "datos").faltas.map((f) => f.campo).sort(), ["ed_dist", "ed_indus", "ed_suelo", "ed_uso", "pr_nom"]);
  comp("Diseño, Conexiones y Cimentación esperan al análisis", ["diseno", "conex", "cimen"].map((k) => de(vacio, k).espera
    .map((x) => x.paso)), [["analisis"], ["analisis"], ["analisis"]]);
  cierto("pero ya dicen sus propios datos, sin esperar", de(vacio, "conex").faltas.length > 0 &&
    de(vacio, "cimen").faltas.some((f) => f.campo === "ci_sigma"));
  comp("Hojas Excel espera a Cargas", de(vacio, "hojas").espera.map((x) => x.paso), ["cargas"]);
  const lleno = R.pendientes({ m3: m3, modelo: Object.assign({}, mok, { proyecto: { nombre: "x" }, diseno: Object.assign({}, DZ,
    { filete_mm: 4, electrodo: "E70", tensores: 1, panelTramos: 3, clipCorreas: true }), cimentacion: {} }), perfiles: P, analisis: ok });
  comp("con todo menos la cimentación y los perfiles de los arriostres, faltan Geometría y Cimentación",
    lleno.filter((x) => !x.completo).map((x) => x.paso), ["geom", "cimen"]);
  cierto("(Geometría dice cuáles: los arriostres de techo y de fachada)",
    /arriostre de techo/.test(de(lleno, "geom").faltas[0].que) && /arriostre de fachada/.test(de(lleno, "geom").faltas[0].que));
  comp("sin galpón, todo espera a Geometría", R.pendientes({ m3: null, fallo: { titulo: "no hay arriostre" }, modelo: {}, perfiles: P })
    .filter((x) => x.paso === "cargas")[0].espera.map((x) => x.paso), ["geom"]);
  comp("los materiales dicen dónde se eligen los que faltan", R.materiales({ sitio: { acero: "A36" } }).map((x) => [x.que, !!x.v, x.paso]),
    [["Acero estructural", true, "cargas"], ["Concreto", false, "cimen"], ["Acero de refuerzo", false, "cimen"],
      ["Electrodo de las uniones", false, "conex"], ["Pernos de anclaje", false, "cimen"]]);
  comp("el libro guarda el proyecto", L.deserializa(L.serializa(Object.assign(L.nuevo({}), { proyecto: { nombre: "A", ubicacion: "B" } })))
    .modelo.proyecto, { nombre: "A", ubicacion: "B" });
  lanza("y no guarda en silencio lo que no conoce", () => L.serializa(Object.assign(L.nuevo({}), { proyecto: { telefono: "1" } })),
    ["datos de proyecto desconocidos"]);
}


/* LA EDIFICACIÓN, en Datos · el uso da la categoría */
{
  const conUso = (x) => Object.assign({}, SITIO, x);
  comp("una nave con riesgo de incendio sube a A2 y el sismo va con U = 1,5",
    [R.cargas(m3, conUso({ uso: "industrial", riesgoAdicional: true })).cargas.sismo.categoria,
      R.cargas(m3, conUso({ uso: "industrial", riesgoAdicional: true })).cargas.sismo.sub], ["A", "A2"]);
  const sinR = R.cargas(m3, conUso({ uso: "industrial", riesgoAdicional: undefined }));
  cierto("sin decir el riesgo, falta, y se pide en Datos", !sinR.completo &&
    sinR.faltan.some((f) => f.paso === "datos" && /incendio o fuga/.test(f.que)));
  cierto("un modelo viejo con la categoría a mano y sin uso pide el uso", !R.cargas(m3, Object.assign({}, SITIO,
    { uso: undefined, categoria: "C" })).completo);
  const prov = R.cargas(m3, conUso({ uso: "provisional" }));
  cierto("lo provisional no se calcula, y dice por qué", !prov.completo && prov.faltan.some((f) => /19\.3/.test(f.que)));
  const fe = R.fichaEdificacion(conUso({ uso: "reunion", zona: "Z4", sistemaSismico: "OMF" }));
  const q = (re) => fe[0].lineas.filter((l) => re.test(l.q))[0];
  comp("la ficha: categoría B con U = 1,3", q(/^Categoría/).v, "B · U = 1,3");
  cierto("el OMF no está en la Tabla N° 9 y lo permite el Art. 21.2", /no está en la Tabla N° 9/.test(q(/cobertura liviana/).nota));
  cierto("cada línea con su procedencia", fe[0].lineas.every((l) => l.fuente ? INV.existe(l.fuente) : true));
  comp("sin uso, la ficha lo pide", R.fichaEdificacion({})[0].lineas[0].v, "FALTA");
  comp("el libro guarda la edificación", L.deserializa(L.serializa(Object.assign(L.nuevo({}), { sitio: { uso: "deposito",
    riesgoAdicional: false, usoSecCat: "B", usoSecPct: 20 } }))).modelo.sitio,
    { uso: "deposito", riesgoAdicional: false, usoSecCat: "B", usoSecPct: 20 });
  comp("el campo del riesgo solo sale para depósito y nave", R.CAMPOS_EDIFICACION[1].campos.filter((c2) => c2.id === "riesgo")[0].soloSi,
    "uso=deposito|industrial");
}


/* LA UBICACIÓN · la zona sale del distrito (fila S.zona.distrito) */
{
  const U = require("../src/ubicacion.js");
  comp("cuatro Miraflores, y solo el de Lima es zona 4", U.buscar("miraflores").filter((k) => /· MIRAFLORES$/.test(k)).map(U.zona),
    ["Z3", "Z3", "Z3", "Z4"]);
  comp("Pucallpa es Callería, Yarinacocha y Manantay, aunque la norma escriba «CALLERIA»", U.buscar("pucallpa").length, 3);
  comp("sin tildes ni mayúsculas, y por palabras sueltas", U.buscar("ancash aija"), U.buscar("ÁNCASH AIJA"));
  comp("Aija es zona 3 en la E.030-2026 (V1.xlsm y Retícula la tenían en 4)", U.buscar("ancash aija").filter((k) => /› AIJA ·/.test(k)).map(U.zona).filter((v, i, a) => a.indexOf(v) === i), ["Z3"]);
  comp("la zona de las cargas sale del distrito", R.cargas(m3, Object.assign({}, SITIO, { distrito: "AREQUIPA › AREQUIPA · MIRAFLORES" }))
    .cargas.sismo.zona, "Z3");
  const viejo = R.cargas(m3, Object.assign({}, SITIO, { distrito: undefined, zona: "Z4" }));
  cierto("un modelo viejo con la zona a mano y sin distrito pide el distrito, en Datos", !viejo.completo &&
    viejo.faltan.some((f) => f.campo === "ed_dist" && f.paso === "datos"));
  comp("un distrito que no está en el Anexo no se guarda", R.leeEdificacion({ dist: "LIMA › LIMA · NARNIA" }).distrito, undefined);
  const fs = R.fichaSitio({ distrito: "LIMA › LIMA · MIRAFLORES", suelo: "S2" })[0].lineas;
  comp("la ficha del sitio: zona 4, Z = 0,45, S = 1,100 sin V̄s30", fs.slice(1, 4).map((l) => l.v), ["4", "0,45", "1,100"]);
  cierto("y dice que el viento no se automatiza: es un mapa", /mapa/.test(fs[fs.length - 1].nota));
  comp("con S4 en zona 4 lo dice, no inventa un S", R.fichaSitio({ distrito: "LIMA › LIMA · MIRAFLORES", suelo: "S4" })[0]
    .lineas.filter((l) => /suelo S/.test(l.q))[0].v, "NO HAY");
  comp("el libro guarda el distrito", L.deserializa(L.serializa(Object.assign(L.nuevo({}), { sitio: { distrito: "LIMA › LIMA · MIRAFLORES" } })))
    .modelo.sitio.distrito, "LIMA › LIMA · MIRAFLORES");
}

fin();
