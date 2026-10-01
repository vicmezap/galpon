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

fin();
