/* =====================================================================
   ejemplo.js — un galpón completo, para probar de una vez · fila V.ejemplo

   El usuario: «déjame cargado un ejemplo completo, de modo que pueda
   probar las hojas de una, de manera rápida».  Esto NO son valores por
   omisión: un campo vacío sigue vacío y se sigue pidiendo.  Es un PROYECTO
   de muestra que solo entra si se pulsa «Cargar el ejemplo completo», y
   reemplaza lo que hubiera en la ventana (el libro no cambia hasta guardar).

   Almacén de 20 × 60 m en Miraflores (Lima): pórtico de columnas W
   empotradas con tijeral Howe a dos aguas, correas C, cobertura TR-4,
   arriostrado en los paños 2 y 9, tres columnas hastiales por fachada.
   Lo que se elige aquí es lo que elegiría un proyectista en Lima para un
   depósito común; el cálculo lo hace el motor, como con cualquier otro.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./libro.js"));
  } else {
    raiz.EJEMPLO = definir(raiz.INVENTARIO, raiz.LIBRO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, LIBRO) {
  "use strict";

  const ART = INV.declara("ejemplo.js", ["V.ejemplo"]);

  const PARAMETROS = {
    luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, ajustaSeparacion: false,
    cuerdas: "dos_aguas", alma: "howe", pendiente: 0.20, pendienteInferior: 0.08,
    paneles: 6, peralteApoyo_m: 1.2,
    panosArriostradosTecho: [1, 8], panosArriostradosFachada: [1, 8], columnasHastiales: [5, 10, 15]
  };
  const PERFILES = {
    "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4",
    "diagonal": "2L2X2X3/16", "montante": "2L2X2X3/16", "correa": "C10X15.3", "viga de alero": "C8X11.5",
    "columna hastial": "W8X18", "arriostre de techo": "HSS4X4X1/4", "arriostre de fachada": "VAR1",
    "arriostre vertical": "VAR1/2", "puntal inferior": "HSS3X3X1/4"
  };
  const PROYECTO = { nombre: "Ejemplo · almacén de 20 × 60 m", ubicacion: "Miraflores, Lima" };
  const SITIO = {
    distrito: "LIMA › LIMA · MIRAFLORES", suelo: "S2", sistemaSismico: "OMF",
    uso: "deposito", riesgoAdicional: false, usoSecCat: "no", industrial: false,
    V_kmh: 75, tipoEdificacion: 1,
    aberturas: { izqDer: "repartidas", derIzq: "repartidas", longitudinal: "repartidas" },
    acero: "A36", espesorCobertura_mm: 0.4, Dotras_kgfm2: 5, hayNieve: false
  };
  const SISTEMA = { base: "empotrada", union: "rigida" };
  const DISENO = {
    arriostreInferior_m: 3.33, separacionLargueros_m: 1.5, LbColumna_m: 3, arriostreComprobado: true,
    cartela: "3/8", separadores_cm: 60, conexionSeparadores: "requintado", condicionesE5: true,
    uniones: "soldadas", soldadura_cm: 10, filete_mm: 4, electrodo: "E70",
    tensores: 1, panelTramos: 3, clipCorreas: true
  };
  const CIMENTACION = {
    sigmaAdm_kgfcm2: 1.5, esNeta: false, Df_cm: 150, gammaRelleno_kgfm3: 1800, sc_kgfm2: 500, mu: 0.45,
    fc_kgcm2: 210, grado: "60", rec_cm: 7.5, barra: "5/8",
    pedB_cm: 40, pedL_cm: 60, sobreTerreno_cm: 20, pedBarra: "5/8", pedEstribo: "3/8", pedRec_cm: 4, junta: "rugosa",
    placaB_cm: 30, placaN_cm: 40, pernoF_cm: 14, pernosFila: 1, pernoD: "1-1/4", pernoMat: "A36", pernoLd_cm: 40,
    electrodo: "E70", llaveL_cm: 15, llaveH_cm: 10, llaveT_cm: 2.5, grout_cm: 2.5
  };

  /* un modelo nuevo cada vez: quien lo cargue puede tocarlo sin ensuciar el siguiente */
  function modelo() {
    let m = LIBRO.nuevo(Object.assign({ nombre: PROYECTO.nombre }, JSON.parse(JSON.stringify(PARAMETROS))));
    for (const clase of Object.keys(PERFILES)) m = LIBRO.asignaPerfil(m, { clase: clase }, PERFILES[clase]).modelo;
    m.proyecto = Object.assign({}, PROYECTO);
    m.sitio = JSON.parse(JSON.stringify(SITIO));
    m.sistema = Object.assign({}, SISTEMA);
    m.diseno = Object.assign({}, DISENO);
    m.cimentacion = Object.assign({}, CIMENTACION);
    return m;
  }

  return { ART, PARAMETROS, PERFILES, modelo };
});
