/* =====================================================================
   resultados.js — lo que enseñan los pasos Cargas y Análisis, como datos

   Igual que vistas.js para Geometría: la plantilla solo pinta, y aquí se
   decide qué número sale y de dónde viene.  Cada línea lleva su
   procedencia por la guarda de vistas.ln(), así que un número de norma sin
   fila no llega a la pantalla.

   NADA TIENE VALOR POR OMISIÓN que sea una decisión del proyecto: ni la
   velocidad del viento, ni las aberturas, ni si hay nieve, ni el tipo de
   edificación, ni el acero, ni el sistema estructural.  Lo que falte se
   DICE, con el paso al que hay que ir, en vez de rellenarse con un valor
   razonable que nadie eligió.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./vistas.js"),
      require("./e020.js"), require("./viento.js"), require("./combinaciones.js"),
      require("./analisis.js"), require("./libro.js"), require("./e030.js"),
      require("./diseno.js"), require("./zapatas.js"), require("./pedestal.js"), require("./placabase.js"),
      require("./conexiones.js"), require("./acero.js"), require("./longitudinal.js"), require("./ubicacion.js"),
      require("./unidades.js"));
  } else {
    raiz.RESULTADOS = definir(raiz.INVENTARIO, raiz.VISTAS, raiz.E020, raiz.VIENTO,
      raiz.COMBINACIONES, raiz.ANALISIS, raiz.LIBRO, raiz.E030, raiz.DISENO, raiz.ZAPATAS,
      raiz.PEDESTAL, raiz.PLACABASE, raiz.CONEXIONES, raiz.ACERO, raiz.LONGITUDINAL, raiz.UBICACION, raiz.UNIDADES);
  }
})(typeof self !== "undefined" ? self : this, function (INV, V, E020, VI, CB, AN, LIBRO, E030, DI, ZA, PD, PB,
  CX, AC, LG, UB, UN) {
  "use strict";

  const ART = INV.declara("resultados.js", [
    "D.cobertura.peso", "Lr.liviana", "Lr.red.formula", "N.Qs.min", "N.Qt.a", "N.Qt.b",
    "N.Qt.c", "N.desbal.corto", "N.desbal.largo", "W.V.mapa", "W.Vh", "W.Ph", "W.C", "W.tipo",
    "A.sistema", "A.acero.Pns", "A.reacciones.casos", "SV.viento.H", "A.segundo.orden",
    "S.Z", "S.U", "S.perfil", "S.R0", "S.pendulo", "S.T.rayleigh", "S.C.estatico", "S.V", "S.CR",
    "S.vertical", "S.despl", "S.deriva", "S.deriva.industrial", "A.sismo.sistema", "A.sismo.periodo",
    "S.categoria.uso", "S.categoria.riesgo", "S.usos.combinados", "S.sistemas.categoria", "S.cobertura.liviana",
    "S.irregularidad.categoria", "S.P", "A.sismo.regular", "S.zona.distrito", "S.perfil", "S.sinVs30",
    "C.Ec", "MAT.E", "LG.sismo.sistema", "Lr.red.Ai", "Lr.red.min40", "D.perfil.peso", "L.secciones", "Z.sigma.neta", "Z.peso",
    "Z.As.min", "Z.bloque", "Z.deslizamiento",
    "D.DIS.longitudes", "D.DIS.cartela", "D.DIS.E5", "E.C3.arriostre", "C.E6.a", "C.E5.cond",
    "T.U.c2", "T.U.c8", "C.E4.2L",
    "Z.sigma.neta", "Z.inc30", "Z.levantamiento", "Z.deslizamiento", "Z.punzon.momento", "Z.Vc.viga",
    "Z.As.min", "Z.s.max", "Z.rec", "Z.peralte.min", "Z.vuelco", "Z.servicio",
    "Z.bloque", "Z.franja", "Z.peso",
    "PD.compatibilidad", "PD.Vs", "PD.friccion", "PD.anclaje.zapata", "PD.rho", "PD.esbeltez", "PD.rec",
    "J.base.momento.metodo", "J.base.momento.t", "J.base.phi", "J.anclaje.acero", "J.llave.aplast",
    "J.llave.flexion", "J.anclaje.geometria", "J.anclaje.concreto", "J.base.momento.soldadura",
    "J.anclaje.E060.confinamiento",
    "LG.vertical", "LG.correa.puntal", "LG.techo.armadura", "LG.fachada.cruz", "LG.sismo.sistema",
    "LG.hastial.reparto", "LG.factores", "D.DIS.correas", "F.F6.sinLTB", "F.hipotesis", "D.cobertura.tabla",
    "SV.deflex", "SV.correa.Ld", "CR.cargas", "Z.longitudinal.articulada", "PD.biaxial", "ZT.tipos",
    "ZT.cruz", "ZT.hastial", "ZT.placa.cruz", "Z.volteo.E030", "Z.conexion",
    "Z.conexion.diseno", "J.union.angulo", "J.whitmore", "J.pernos.detalle", "J.cartela.pandeo",
    "J.excentricidad.angulo"
  ]);
  const ln = V.ln, ficha = V.ficha;
  const n2 = (x, d) => (Math.round(x * Math.pow(10, d)) / Math.pow(10, d))
    .toFixed(d).replace(".", ",");
  const t2 = (kgf) => n2(kgf / 1000, 2) + " t";
  const tm = (kgfcm) => n2(kgfcm / 1e5, 2) + " t·m";

  const DIRECCIONES = [["izqDer", "izquierda → derecha"], ["derIzq", "derecha → izquierda"],
    ["longitudinal", "longitudinal (paralelo a la cumbrera)"]];
  const ACEROS = ["A36", "A572"];

  /* la pendiente y la altura de cumbre, de la geometría montada */
  function forma(m3) {
    const sup = m3.tijeral.nudos.filter((n) => n.clase === "superior").slice()
      .sort((a, b) => a.x_m - b.x_m);
    let s = 0;
    for (let k = 0; k + 1 < sup.length; k++) {
      s = Math.max(s, Math.abs((sup[k + 1].y_m - sup[k].y_m) / (sup[k + 1].x_m - sup[k].x_m)));
    }
    return {
      theta_grad: Math.atan(s) * 180 / Math.PI,
      hCumbre_m: Math.max.apply(null, m3.nudos.map((n) => n.y_m)),
      luz_m: m3.luz_m, sep_m: m3.ejes.sepPorticos_m
    };
  }

  /* =====================================================================
     EL PASO DATOS · el proyecto, y lo que falta en cada paso
     ===================================================================== */
  const CAMPOS_PROYECTO = [
    { grupo: "Proyecto", campos: [
      { id: "nom", clave: "nombre", etiqueta: "Nombre del proyecto", tipo: "texto" },
      { id: "ubi", clave: "ubicacion", etiqueta: "Ubicación", tipo: "texto" },
      { id: "pro", clave: "propietario", etiqueta: "Propietario", tipo: "texto" },
      { id: "ing", clave: "proyectista", etiqueta: "Proyectista", tipo: "texto" }] }];
  function leeProyecto(val) {
    const p = {};
    for (const c of CAMPOS_PROYECTO[0].campos) {
      const t = String(val[c.id] === undefined || val[c.id] === null ? "" : val[c.id]).trim();
      if (t) p[c.clave] = t;
    }
    return p;
  }
  function valoresDeProyecto(p) {
    const v = {};
    for (const c of CAMPOS_PROYECTO[0].campos) if (p && p[c.clave] !== undefined) v[c.id] = p[c.clave];
    return v;
  }

  const ELEGIR = ["", "— elegir —"];          /* ningún campo trae valor: se elige */
  const ABERTURAS = [ELEGIR, ["repartidas", "repartidas · Ci ±0,3"],
    ["barlovento", "principales a barlovento · Ci +0,8"],
    ["sotavento", "a sotavento o en los costados · Ci −0,6"]];

  /* LA EDIFICACIÓN · el uso da la categoría (filas S.categoria.uso y siguientes) */
  /* LOS VALORES QUE SALEN SOLOS, en la misma tarjeta que el dato que los da (como en Retícula).
     tipo «fijo»: no se escribe, se calcula con fijosDatos(); el id es el de su elemento, fx_<id>. */
  const fijo = (id, etiqueta, fuente) => ({ id: id, tipo: "fijo", etiqueta: etiqueta, fuente: fuente });
  const CAMPOS_EDIFICACION = [
    { grupo: "Sitio y sismo", campos: [
      { id: "dist", clave: "distrito", etiqueta: "Distrito", tipo: "distrito", fuente: "S.zona.distrito" },
      fijo("zona", "Zona sísmica", "S.zona.distrito"),
      fijo("Z", "Factor de zona Z", "S.Z"),
      { id: "suelo", clave: "suelo", etiqueta: "Perfil de suelo", tipo: "opcion", fuente: "S.perfil",
        opciones: [ELEGIR, ["S0", "S0 · roca dura"], ["S1", "S1 · roca o suelo muy rígido"],
          ["S2", "S2 · suelo intermedio"], ["S3", "S3 · suelo blando"], ["S4", "S4 · excepcional"]] },
      { id: "vs30", clave: "vs30_ms", etiqueta: "V̄s30 medido (opcional)", unidad: "m/s", tipo: "numero",
        fuente: "S.sinVs30" },
      fijo("S", "Factor de suelo S", "S.perfil"),
      fijo("TPTL", "Períodos TP / TL", "S.perfil"),
      { id: "sissis", clave: "sistemaSismico", etiqueta: "Sistema sísmico transversal", tipo: "opcion",
        fuente: "S.R0", opciones: [ELEGIR, ["pendulo", "péndulo invertido · R₀ 2,5"],
          ["OMF", "ordinario OMF · R₀ 4"], ["IMF", "intermedio IMF · R₀ 5"],
          ["SMF", "especial SMF · R₀ 8"]] },
      fijo("R0", "R₀ transversal", "S.R0"),
      fijo("R0L", "R₀ a lo largo", "LG.sismo.sistema")] },
    { grupo: "Edificación", campos: [
      { id: "uso", clave: "uso", etiqueta: "Uso de la edificación", tipo: "opcion", fuente: "S.categoria.uso",
        opciones: [ELEGIR].concat(Object.keys(E030.USOS).map((k) => [k, E030.USOS[k].nombre])) },
      { id: "riesgo", clave: "riesgoAdicional", etiqueta: "¿Su falla puede acarrear incendio o fuga de contaminantes?",
        tipo: "opcion", fuente: "S.categoria.riesgo", soloSi: "uso=deposito|industrial",
        opciones: [ELEGIR, ["no", "no · categoría C"], ["si", "sí · categoría A2"]] },
      { id: "sec", clave: "usoSecCat", etiqueta: "¿Una parte tiene otro uso? Su categoría", tipo: "opcion",
        fuente: "S.usos.combinados", opciones: [ELEGIR, ["no", "no, todo es del mismo uso"], ["A2", "A2 · esencial"],
          ["B", "B · importante"], ["C", "C · común"]] },
      { id: "secpct", clave: "usoSecPct", etiqueta: "Área de ese otro uso, sin sótanos", unidad: "% del total", tipo: "numero",
        fuente: "S.usos.combinados", soloSi: "sec=A2|B|C" },
      { id: "indus", clave: "industrial", etiqueta: "¿Es de uso industrial? (deriva hasta 2× la tabla)",
        tipo: "opcion", fuente: "S.deriva.industrial", opciones: [ELEGIR, ["no", "no"], ["si", "sí"]] },
      fijo("cat", "Categoría y factor U", "S.categoria.uso"),
      fijo("peso", "Viva en el peso sísmico", "S.P"),
      fijo("sist", "Sistemas permitidos", "S.cobertura.liviana")] },
    { grupo: "Viento", campos: [
      { id: "v", clave: "V_kmh", etiqueta: "Velocidad del Mapa Eólico", unidad: "km/h",
        tipo: "numero", fuente: "W.V.mapa" },
      fijo("Vh", "Velocidad de diseño Vh", "W.Vh"),
      { id: "tipo", clave: "tipoEdificacion", etiqueta: "Tipo de edificación", tipo: "opcion",
        fuente: "W.tipo", opciones: [ELEGIR, ["1", "Tipo 1"], ["2", "Tipo 2 · × 1,2"]] },
      fijo("q", "Presión de referencia (C = 1)", "W.Ph"),
      { id: "ab_izqDer", clave: "aberturas.izqDer", etiqueta: "Aberturas · viento izq → der",
        tipo: "opcion", fuente: "W.C", opciones: ABERTURAS },
      { id: "ab_derIzq", clave: "aberturas.derIzq", etiqueta: "Aberturas · viento der → izq",
        tipo: "opcion", fuente: "W.C", opciones: ABERTURAS },
      { id: "ab_longitudinal", clave: "aberturas.longitudinal", etiqueta: "Aberturas · viento longitudinal",
        tipo: "opcion", fuente: "W.C", opciones: ABERTURAS }] }];

  /* MATERIALES · el acero de los perfiles, el concreto y la armadura, y el suelo */
  const CAMPOS_MATERIALES = [
    { grupo: "Acero estructural", campos: [
      { id: "acero", clave: "acero", etiqueta: "Acero de los perfiles", tipo: "opcion",
        fuente: "A.acero.Pns", opciones: [ELEGIR, ["A36", "A36"], ["A572", "A572 Gr. 50"]] },
      fijo("Fy", "Fluencia Fy", "A.acero.Pns"),
      fijo("Fu", "Rotura Fu", "A.acero.Pns"),
      fijo("E", "Módulo de elasticidad E", "MAT.E")] },
    { grupo: "Concreto y armadura", campos: [
      { id: "fc", clave: "fc_kgcm2", etiqueta: "f'c del concreto", tipo: "opcion", fuente: "Z.bloque",
        opciones: [ELEGIR, ["210", "210 kgf/cm²"], ["280", "280 kgf/cm²"], ["350", "350 kgf/cm²"]] },
      fijo("Ec", "Ec = 15 000·√f'c", "C.Ec"),
      { id: "grado", clave: "grado", etiqueta: "Acero de refuerzo", tipo: "opcion", fuente: "Z.As.min",
        opciones: [ELEGIR, ["60", "Grado 60 · fy 420 MPa"], ["40", "Grado 40 · fy 280 MPa"]] },
      fijo("fy", "Fluencia fy", "Z.As.min")] },
    { grupo: "Suelo", campos: [
      { id: "sigma", clave: "sigmaAdm_kgfcm2", etiqueta: "Presión admisible del estudio de suelos",
        unidad: "kgf/cm²", tipo: "numero", fuente: "Z.sigma.neta" },
      { id: "neta", clave: "esNeta", etiqueta: "Esa presión es", tipo: "opcion", fuente: "Z.sigma.neta",
        opciones: [ELEGIR, ["bruta", "bruta: se descuenta el relleno y la sobrecarga"], ["neta", "neta: ya descontada"]] },
      { id: "df", clave: "Df_cm", etiqueta: "Profundidad de desplante", unidad: "cm", tipo: "numero",
        fuente: "Z.sigma.neta" },
      { id: "gr", clave: "gammaRelleno_kgfm3", etiqueta: "Peso específico del relleno", unidad: "kgf/m³",
        tipo: "numero", fuente: "Z.peso" },
      { id: "sc", clave: "sc_kgfm2", etiqueta: "Sobrecarga sobre el piso", unidad: "kgf/m²", tipo: "numero",
        fuente: "Z.sigma.neta" },
      fijo("sn", "Presión neta σn", "Z.sigma.neta"),
      { id: "mu", clave: "mu", etiqueta: "Coeficiente de rozamiento μ (opcional)", tipo: "numero",
        fuente: "Z.deslizamiento" }] }];

  /* CARGAS PERMANENTES · la cobertura, la viva de techo y el peso del acero */
  const CAMPOS_PERMANENTES = [
    { grupo: "Cobertura", campos: [
      { id: "esp", clave: "espesorCobertura_mm", etiqueta: "Espesor de la plancha TR-4", unidad: "mm",
        tipo: "opcion", fuente: "D.cobertura.peso",
        opciones: [ELEGIR, ["0.40", "0,35 a 0,40"], ["0.50", "0,45 a 0,50"],
          ["0.60", "0,55 a 0,60"], ["0.80", "0,75 a 0,80"]] },
      fijo("pcob", "Peso de la plancha", "D.cobertura.peso"),
      { id: "dotras", clave: "Dotras_kgfm2", etiqueta: "Otras cargas muertas (instalaciones, luminarias…)", unidad: "kgf/m²",
        tipo: "numero" },
      fijo("Dsup", "Carga muerta sobre la cobertura", "D.cobertura.peso")] },
    { grupo: "Viva de techo", campos: [
      { id: "nieve", clave: "hayNieve", etiqueta: "¿Puede acumularse nieve?", tipo: "opcion",
        fuente: "Lr.liviana", opciones: [ELEGIR, ["no", "no"], ["si", "sí"]] },
      { id: "qs", clave: "Qs_kgfm2", etiqueta: "Nieve básica del sitio Qs", unidad: "kgf/m²",
        tipo: "numero", fuente: "N.Qs.min", soloSi: "nieve=si" },
      fijo("At", "Área tributaria de un pórtico", "Lr.red.Ai"),
      fijo("Lr", "Carga viva de techo", "Lr.red.formula")] },
    { grupo: "Peso de la estructura", campos: [
      fijo("kgAcero", "Acero de la estructura", "D.perfil.peso"),
      fijo("kgm2", "Por m² de planta", "D.perfil.peso"),
      fijo("sinPerf", "Clases sin perfil", "L.secciones")] }];
  function leeEdificacion(val) {
    const s = {};
    if (val.uso && E030.USOS[val.uso]) s.uso = val.uso;
    if (s.uso && E030.USOS[s.uso].conRiesgo && (val.riesgo === "si" || val.riesgo === "no")) s.riesgoAdicional = val.riesgo === "si";
    if (val.sec === "no") s.usoSecCat = "no";
    if (["A2", "B", "C"].indexOf(val.sec) >= 0) {
      s.usoSecCat = val.sec;
      if (val.secpct !== "" && val.secpct !== undefined && !isNaN(+val.secpct)) s.usoSecPct = +val.secpct;
    }
    if (val.indus === "si" || val.indus === "no") s.industrial = val.indus === "si";
    if (val.dist && UB.existe(val.dist)) s.distrito = val.dist;
    if (["S0", "S1", "S2", "S3", "S4"].indexOf(val.suelo) >= 0) s.suelo = val.suelo;
    if (val.vs30 !== "" && val.vs30 !== undefined && !isNaN(+val.vs30)) s.vs30_ms = +val.vs30;
    return s;
  }
  function valoresDeEdificacion(sitio) {
    const s = sitio || {}, v = {};
    if (s.distrito) v.dist = s.distrito;
    if (s.suelo) v.suelo = s.suelo;
    if (s.vs30_ms !== undefined) v.vs30 = String(s.vs30_ms);
    if (s.uso) v.uso = s.uso;
    if (typeof s.riesgoAdicional === "boolean") v.riesgo = s.riesgoAdicional ? "si" : "no";
    if (s.usoSecCat) v.sec = s.usoSecCat;
    if (s.usoSecPct !== undefined) v.secpct = String(s.usoSecPct);
    if (typeof s.industrial === "boolean") v.indus = s.industrial ? "si" : "no";
    return v;
  }
  /* LA ZONA SALE DEL DISTRITO, y de nada más · fila S.zona.distrito */
  function zonaDe(s) { return s && s.distrito ? UB.zona(s.distrito) : null; }

  /* la clasificación, o por qué no la hay · lo que falta va a Datos */
  function clasificacion(s) {
    const sit = s || {};
    if (!sit.uso) return { falta: { campo: "ed_uso", paso: "datos", que: "el uso de la edificación, que da su categoría (en Datos)" } };
    if (!sit.usoSecCat) return { falta: { campo: "ed_sec", paso: "datos", que: "si una parte de la edificación tiene otro uso (en Datos)" } };
    try {
      return { c: E030.clasifica({ uso: sit.uso, riesgoAdicional: sit.riesgoAdicional,
        usoSecCat: sit.usoSecCat === "no" ? undefined : sit.usoSecCat, usoSecPct: sit.usoSecPct,
        zona: zonaDe(sit), sistema: sit.sistemaSismico }) };
    } catch (e) {
      return { falta: { campo: "ed_uso", paso: "datos", que: e.message.split("\n")[0].replace(/^e030: /, "") } };
    }
  }
  /* LOS VALORES QUE SALEN SOLOS en Datos · { id: { v, nota } } para los campos «fijo».
     Lo que todavía no se puede calcular dice qué le falta, en vez de inventar. */
  function fijosDatos(modelo, m3, perfiles) {
    const s = (modelo && modelo.sitio) || {}, c = (modelo && modelo.cimentacion) || {};
    const F = {};
    const pon = (id, v, nota) => { F[id] = { v: v, nota: nota || "" }; };
    const miles = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");   /* 2 039 000 */
    const falta = (id, que) => pon(id, "—", "falta " + que);
    /* sitio y sismo */
    const z = zonaDe(s);
    if (z) { pon("zona", z.replace("Z", ""), "del distrito, Anexo II"); pon("Z", n2(E030.Z[z], 2), "Tabla N° 1"); }
    else { falta("zona", "el distrito"); falta("Z", "el distrito"); }
    if (z && s.suelo) {
      try {
        const st = E030.sitio({ zona: z, suelo: s.suelo, vs30_ms: s.vs30_ms });
        pon("S", n2(st.S, 3), st.sinVs30 ? "sin V̄s30: el extremo blando del intervalo" : "Tabla N° 4");
        pon("TPTL", n2(st.TP, 2) + " / " + n2(st.TL, 2) + " s", "Tabla N° 5");
      } catch (e) { pon("S", "NO HAY", e.message.split("\n")[0].replace(/^e030: /, "")); pon("TPTL", "—", ""); }
    } else { falta("S", z ? "el perfil de suelo" : "el distrito"); falta("TPTL", z ? "el perfil de suelo" : "el distrito"); }
    if (s.sistemaSismico) {
      const r0 = s.sistemaSismico === "pendulo" ? E030.R0_PENDULO : E030.R0[s.sistemaSismico];
      pon("R0", n2(r0, 1), "estructura regular: R = R₀ (Ia = Ip = 1)");
    } else falta("R0", "el sistema transversal");
    pon("R0L", "OCBF · " + n2(E030.R0.OCBF, 1), "arriostres concéntricos ordinarios, a lo largo");
    /* edificación */
    const cl = clasificacion(s);
    if (cl.c) {
      pon("cat", cl.c.sub + " · U = " + n2(cl.c.U, 1), cl.c.combinado && cl.c.combinado.manda ? "por el otro uso (Art. 19.2)" : "Tabla N° 7");
      pon("peso", n2(100 * cl.c.pctVivaTecho, 0) + " % de la de techo", "Art. 31 d); con entrepiso, " + n2(100 * cl.c.pctVivaPiso, 0) + " % de la de piso");
      pon("sist", "cualquiera", z && cl.c.sistemas && cl.c.sistemas.lista ? "cobertura liviana (Art. 21.2); la Tabla N° 9 pediría " +
        cl.c.sistemas.lista.join(", ") : "cobertura liviana (Art. 21.2)");
    } else { falta("cat", "el uso"); falta("peso", "el uso"); falta("sist", "el uso"); }
    /* viento */
    if (s.V_kmh > 0 && m3) {
      const vel = VI.velocidadDiseno({ V_kmh: s.V_kmh, h_m: forma(m3).hCumbre_m });
      pon("Vh", n2(vel.Vh_kmh, 2) + " km/h", vel.enMinimo ? "manda el mínimo de 75 km/h" : "V·(h/10)^0,22 con h = " + n2(forma(m3).hCumbre_m, 2) + " m");
      const ft = VI.TIPO_FACTOR[s.tipoEdificacion];
      pon("q", n2(VI.K_PRESION * vel.Vh_kmh * vel.Vh_kmh * (ft || 1), 2) + " kgf/m²", ft ? "0,005·Vh²" + (ft !== 1 ? " × " + n2(ft, 1) : "") : "falta el tipo");
    } else { falta("Vh", s.V_kmh > 0 ? "el galpón" : "la velocidad del mapa"); falta("q", "la velocidad del mapa"); }
    /* materiales */
    if (ACEROS.indexOf(s.acero) >= 0) {
      const m = AC.material(s.acero);
      pon("Fy", miles(m.Fy) + " kgf/cm²", s.acero === "A36" ? "ASTM A36" : "ASTM A572 Gr. 50");
      pon("Fu", miles(m.Fu) + " kgf/cm²", "");
    } else { falta("Fy", "el acero"); falta("Fu", "el acero"); }
    pon("E", miles(INV.num("MAT.E")) + " kgf/cm²", "200 000 MPa");
    if (c.fc_kgcm2 > 0) pon("Ec", miles(15000 * Math.sqrt(c.fc_kgcm2)) + " kgf/cm²", "E.060 ec. 8-3");
    else falta("Ec", "el f'c");
    if (ZA.GRADOS[c.grado]) pon("fy", miles(UN.mpa_a_kgcm2(ZA.GRADOS[c.grado])) + " kgf/cm²", ZA.GRADOS[c.grado] + " MPa");
    else falta("fy", "el grado");
    if (c.sigmaAdm_kgfcm2 > 0 && typeof c.esNeta === "boolean") {
      if (c.esNeta) pon("sn", n2(c.sigmaAdm_kgfcm2, 2) + " kgf/cm²", "el estudio ya la da neta");
      else if (c.Df_cm > 0 && c.gammaRelleno_kgfm3 > 0 && c.sc_kgfm2 >= 0) {
        const sn0 = c.sigmaAdm_kgfcm2 - c.gammaRelleno_kgfm3 / 1e6 * c.Df_cm - c.sc_kgfm2 / 1e4;
        pon("sn", "≥ " + n2(sn0, 2) + " kgf/cm²", "σt − s/c − γ·(Df − h): con h = 0, lo más bajo; el peralte de la zapata la sube");
      } else falta("sn", "Df, γ y s/c");
    } else falta("sn", "la presión y si es neta");
    /* cargas permanentes */
    if (s.espesorCobertura_mm > 0) {
      try {
        const pc = E020.pesoCobertura(s.espesorCobertura_mm).peso_kgfm2;
        pon("pcob", n2(pc, 2) + " kgf/m²", "TR-4 de " + n2(s.espesorCobertura_mm, 2) + " mm");
        pon("Dsup", n2(pc + (s.Dotras_kgfm2 || 0), 2) + " kgf/m²", "plancha + otras; el peso de los perfiles lo suma el análisis");
      } catch (e) { pon("pcob", "NO HAY", e.message.split("\n")[0]); falta("Dsup", "el peso de la plancha"); }
    } else { falta("pcob", "el espesor"); falta("Dsup", "el espesor"); }
    if (m3) {
      const f = forma(m3), At = f.luz_m * f.sep_m;
      pon("At", n2(At, 1) + " m²", "luz × separación");
      if (s.hayNieve === false) {
        const lo = E020.vivaTecho({ tipo: "liviana", hayNieve: false }).Lo_kgfm2;
        const rd = E020.reduceViva({ Lo_kgfm2: lo, At_m2: At });
        pon("Lr", n2(rd.Lr_kgfm2, 2) + " kgf/m²", rd.reducido ? "Lo = " + lo + " reducida por el área" : rd.motivo);
      } else if (s.hayNieve === true && s.Qs_kgfm2 >= 0) {
        const qt = E020.nieveQt({ Qs_kgfm2: s.Qs_kgfm2, theta_grad: f.theta_grad });
        pon("Lr", n2(qt.Qt_kgfm2, 2) + " kgf/m² de nieve", "Qt, " + qt.caso + "; manda sobre la viva de techo");
      } else falta("Lr", "si hay nieve");
      /* el peso del acero: la longitud de cada clase por el peso de su perfil */
      const pos = {};
      for (const n of m3.nudos) pos[n.id] = n;
      const sec = seccionDesde(modelo, perfiles);
      let kg = 0;
      const sinP = {};
      for (const b of m3.barras) {
        const p = sec(b);
        if (!p) { sinP[b.clase] = true; continue; }
        const a = pos[b.i], d = pos[b.j];
        kg += p.peso_kgfm * Math.sqrt(Math.pow(d.x_m - a.x_m, 2) + Math.pow(d.y_m - a.y_m, 2) + Math.pow(d.z_m - a.z_m, 2));
      }
      const area = m3.luz_m * m3.ejes.largo_m, faltan = Object.keys(sinP);
      pon("kgAcero", n2(kg / 1000, 2) + " t", faltan.length ? "sin las clases que no tienen perfil" : "todas las barras, sin conexiones");
      pon("kgm2", n2(kg / area, 1) + " kg/m²", "sobre " + n2(area, 0) + " m² de planta");
      pon("sinPerf", faltan.length ? String(faltan.length) : "ninguna", faltan.length ? faltan.join(", ") + " (Geometría)" : "");
    } else { falta("At", "el galpón"); falta("Lr", "el galpón"); falta("kgAcero", "el galpón"); falta("kgm2", "el galpón"); falta("sinPerf", "el galpón"); }
    return F;
  }

  /* EL SITIO · del distrito a Z, S, TP y TL, con su tabla al lado */
  function fichaSitio(sitio) {
    const s = sitio || {};
    if (!s.distrito || !UB.existe(s.distrito)) {
      return [ficha("El sitio", "E.030-2026 Anexo II", [ln("Distrito", "FALTA", "medido", { estado: "no",
        nota: "búscalo por departamento, provincia, distrito o ciudad: la zona sale de él" })])];
    }
    const p = UB.partes(s.distrito);
    const L = [ln("Distrito", p.distrito + " · " + p.provincia + " · " + p.departamento, "entrada"),
      ln("Zona sísmica", p.zona.replace("Z", ""), "norma", { fuente: "S.zona.distrito", nota: "por el distrito, no a mano" }),
      ln("Factor de zona Z", n2(E030.Z[p.zona], 2), "norma", { fuente: "S.Z" })];
    if (s.suelo) {
      try {
        const st = E030.sitio({ zona: p.zona, suelo: s.suelo, vs30_ms: s.vs30_ms });
        L.push(ln("Factor de suelo S", n2(st.S, 3), "norma", { fuente: st.sinVs30 ? "S.sinVs30" : "S.perfil",
          nota: "suelo " + s.suelo + (st.sinVs30 ? ", sin V̄s30: el extremo blando del intervalo" : "") }));
        L.push(ln("Períodos TP / TL", n2(st.TP, 2) + " / " + n2(st.TL, 2) + " s", "norma", { fuente: "S.perfil" }));
      } catch (e) {
        L.push(ln("Factor de suelo S", "NO HAY", "medido", { estado: "no", nota: e.message.split("\n")[0].replace(/^e030: /, "") }));
      }
    } else {
      L.push(ln("Perfil de suelo", "FALTA", "medido", { estado: "no", nota: "del estudio de suelos" }));
    }
    L.push(ln("Velocidad del viento", "del Mapa Eólico", "medido", { nota: "la E.020 la da en un mapa (Anexo 2), no en una tabla: se lee y se escribe en Cargas" }));
    return [ficha("El sitio", "E.030-2026 Art. 10, 12, 13 y 14 · Anexo II", L, "bien")];
  }

  function fichaEdificacion(sitio) {
    const k = clasificacion(sitio);
    if (k.falta) return [ficha("La edificación", "E.030-2026 Cap. III", [ln(k.falta.que, "FALTA", "medido", { estado: "no" })])];
    const c = k.c, s = sitio || {};
    const L = [ln("Uso", c.nombre, "entrada"),
      ln("Categoría", c.sub + " · U = " + n2(c.U, 1), "norma", { fuente: c.combinado && c.combinado.manda ? "S.usos.combinados"
        : (E030.USOS[c.uso].conRiesgo ? "S.categoria.riesgo" : "S.categoria.uso"), nota: "«" + c.cita + "»" })];
    if (c.combinado) {
      L.push(ln("Otro uso", c.combinado.sub + " en el " + n2(c.combinado.pct, 0) + " % del área", "norma",
        { fuente: "S.usos.combinados", nota: c.combinado.cuenta ? (c.combinado.manda ? "supera el 15 % y su U es mayor: manda"
          : "supera el 15 %, pero su U no es mayor") : "no supera el 15 % del área: no cuenta" }));
    }
    L.push(ln("Peso sísmico", n2(100 * c.pctVivaTecho, 0) + " % de la viva de techo", "norma", { fuente: "S.P",
      nota: "inciso d); si hubiera entrepiso, su viva entraría al " + n2(100 * c.pctVivaPiso, 0) + " % por ser " + c.categoria }));
    if (c.sistemas) {
      L.push(ln("Sistemas de la Tabla N° 9", c.sistemas.tabla9, "norma", { fuente: "S.sistemas.categoria",
        nota: "para " + c.sub + " en " + zonaDe(s) }));
      L.push(ln("Con cobertura liviana", "cualquier sistema", "norma", { fuente: "S.cobertura.liviana",
        estado: "ok", nota: c.sistemas.sistema
          ? (c.sistemas.enTabla9 ? s.sistemaSismico + " está además en la tabla"
            : s.sistemaSismico + " no está en la Tabla N° 9: lo permite este artículo, por la cobertura TR-4 (fila Lr.liviana)")
          : "el sistema transversal se elige en Cargas" }));
      L.push(ln("Irregularidades", c.irregularidad.texto, "norma", { fuente: "S.irregularidad.categoria",
        nota: "Galpón solo acepta estructura regular (fila A.sismo.regular)" }));
    } else {
      L.push(ln("Sistemas e irregularidades", "según la zona", "medido", { nota: "salen de la zona, que da el distrito (Sitio)" }));
    }
    if (typeof s.industrial === "boolean") {
      L.push(ln("Uso industrial", s.industrial ? "sí" : "no", "entrada"));
      L.push(ln("Límite de la deriva", s.industrial ? "hasta el doble de la Tabla N° 14" : "el de la Tabla N° 14", "norma",
        { fuente: s.industrial ? "S.deriva.industrial" : "S.deriva" }));
    } else {
      L.push(ln("Uso industrial", "FALTA", "medido", { estado: "no", nota: "cambia el límite de la deriva" }));
    }
    return [ficha("La edificación", "E.030-2026 Art. 19, 21, 25 y 31", L, "bien")];
  }

  /* Las normas que mandan, y para qué · cada número que sale de ellas tiene su fila */
  const NORMAS = [
    ["E.020", "Cargas: muerta, viva de techo, nieve y viento"],
    ["E.030-2026", "Diseño sismorresistente"],
    ["E.090", "Estructuras metálicas: combinaciones y lo que remite al AISC"],
    ["AISC 360-22", "Specification for Structural Steel Buildings: barras y uniones"],
    ["E.060", "Concreto armado: zapata, pedestal y sus combinaciones"],
    ["ACI 318", "Anclajes en concreto, donde la E.060 no llega"]];

  /* Los materiales del proyecto, de donde se eligieron */
  function materiales(modelo) {
    const s = (modelo && modelo.sitio) || {}, c = (modelo && modelo.cimentacion) || {}, d = (modelo && modelo.diseno) || {};
    const L = [];
    if (ACEROS.indexOf(s.acero) >= 0) {
      const m = AC.material(s.acero);
      L.push({ que: "Acero estructural", v: s.acero + " · Fy " + n2(m.Fy, 0) + " · Fu " + n2(m.Fu, 0) + " kgf/cm²", paso: "datos" });
    } else L.push({ que: "Acero estructural", v: null, paso: "datos" });
    L.push({ que: "Concreto", v: c.fc_kgcm2 > 0 ? "f'c " + n2(c.fc_kgcm2, 0) + " kgf/cm²" : null, paso: "datos" });
    L.push({ que: "Acero de refuerzo", v: c.grado ? "grado " + c.grado : null, paso: "datos" });
    L.push({ que: "Electrodo de las uniones", v: d.electrodo || null, paso: "conex" });
    L.push({ que: "Pernos de anclaje", v: c.pernoMat ? c.pernoMat + (c.pernoD ? " · Ø" + c.pernoD + "\"" : "") : null, paso: "cimen" });
    return L;
  }

  /* LO QUE FALTA, PASO POR PASO.  Cada dato aparece UNA vez, en el paso donde
     se pide; un paso que depende de otro sin terminar lo dice como «espera».
     o = { m3, fallo, modelo, perfiles, analisis (el del pórtico interior, si ya está) } */
  const NOMBRE_PASO = { datos: "Datos", geom: "Geometría", cargas: "Cargas", analisis: "Análisis", diseno: "Diseño",
    conex: "Conexiones", cimen: "Cimentación", hojas: "Hojas Excel" };
  function pendientes(o) {
    const modelo = o.modelo || {}, P = {};
    for (const k of Object.keys(NOMBRE_PASO)) P[k] = { paso: k, nombre: NOMBRE_PASO[k], faltas: [], espera: [] };
    const pon = (k, f) => { if (!P[k].faltas.some((x) => x.que === f.que)) P[k].faltas.push({ que: f.que, campo: f.campo || null }); };
    if (!(modelo.proyecto && modelo.proyecto.nombre)) pon("datos", { que: "el nombre del proyecto", campo: "pr_nom" });
    if (!o.m3) {
      pon("geom", { que: o.fallo ? o.fallo.titulo : "el galpón no se puede montar" });
      for (const k of ["cargas", "analisis", "diseno", "conex", "cimen", "hojas"]) P[k].espera.push("geom");
    } else {
      /* los perfiles, de la tabla de Geometría: no esperan al sistema estructural */
      const sinPerfil = V.tablaPerfiles(o.m3, modelo).filas.filter((f) => f.sinPerfil).map((f) => f.clase);
      if (sinPerfil.length) pon("geom", { que: "el perfil de " + sinPerfil.join(", ") });
      const c = cargas(o.m3, modelo.sitio || {});
      for (const f of c.faltan) pon(f.paso || "cargas", f);
      if (ACEROS.indexOf((modelo.sitio || {}).acero) < 0) pon("datos", { que: "el acero del proyecto, A36 ó A572 (en Datos › Materiales)", campo: "ma_acero" });
      if (!c.completo) { P.hojas.espera.push("datos"); if (!P.cargas.faltas.length) P.cargas.espera.push("datos"); }
      const a = o.analisis || analisis(o.m3, modelo, o.perfiles, "interior");
      if (!modelo.sistema) pon("analisis", { que: "el sistema estructural: la base y la unión columna–tijeral" });
      if (!a.ok) {
        for (const f of a.faltas) {
          if (f.paso === "geom") { if (!sinPerfil.length) pon("geom", f); }
          else if (f.paso === "analisis") pon("analisis", f);
        }
        if (P.cargas.faltas.length || P.datos.faltas.length) P.analisis.espera.push(P.cargas.faltas.length ? "cargas" : "datos");
        if (P.geom.faltas.length) P.analisis.espera.push("geom");
        for (const k of ["diseno", "conex", "cimen"]) P[k].espera.push("analisis");
      }
      /* los datos propios de cada paso, que no necesitan el análisis para saber que faltan */
      const dz = modelo.diseno || {};
      if (modelo.sistema) {
        try {
          for (const f of DI.faltan(AN.geometria(o.m3, modelo.sistema), seccionDesde(modelo, o.perfiles), dz)) pon("diseno", f);
        } catch (e) { /* lo dice el análisis */ }
      }
      for (const f of DI.faltanCorreas(dz)) pon("diseno", f);
      for (const f of faltanUniones(dz)) pon("conex", f);
      for (const f of faltanCimentacion(modelo.cimentacion || {})) pon(f.paso || "cimen", f);
    }
    return Object.keys(NOMBRE_PASO).map((k) => Object.assign(P[k], {
      completo: !P[k].faltas.length && !P[k].espera.length,
      espera: P[k].espera.map((x) => ({ paso: x, nombre: NOMBRE_PASO[x] })) }));
  }

  /* =====================================================================
     EL PASO CARGAS
     ===================================================================== */
  function cargas(m3, sitio) {
    const s = sitio || {};
    const faltan = [];
    const f = forma(m3);
    const fichas = [];
    const out = { faltan: faltan, fichas: fichas, cargas: null, forma: f };

    /* ---- gravedad ---- */
    const L1 = [
      ln("Pendiente del techo", n2(f.theta_grad, 2) + "°", "geometria"),
      ln("Altura a la cumbre", n2(f.hCumbre_m, 2) + " m", "geometria")
    ];
    let D = null;
    if (!(s.espesorCobertura_mm > 0)) {
      faltan.push({ campo: "cp_esp", paso: "datos", que: "el espesor de la cobertura (en Datos › Cargas permanentes)" });
    } else {
      try {
        const cob = E020.pesoCobertura(s.espesorCobertura_mm);
        const otras = s.Dotras_kgfm2 || 0;
        D = cob.peso_kgfm2 + otras;
        L1.push(ln("Peso de la cobertura", n2(cob.peso_kgfm2, 2) + " kgf/m²", "norma",
          { fuente: "D.cobertura.peso", nota: "rango " + cob.rango }));
        L1.push(ln("Otras cargas muertas", n2(otras, 2) + " kgf/m²", "entrada",
          { nota: otras ? null : "no se declaró ninguna: instalaciones, luminarias, falso techo" }));
        L1.push(ln("Carga muerta sobre la cobertura", n2(D, 2) + " kgf/m²", "medido",
          { nota: "sobre la superficie inclinada; el peso propio de los perfiles se suma en el análisis" }));
      } catch (e) {
        faltan.push({ campo: "cp_esp", paso: "datos", que: e.message.split("\n")[0].replace(/^e020: /, "") });
      }
    }

    let Lr = null, S = null;
    if (typeof s.hayNieve !== "boolean") {
      faltan.push({ campo: "cp_nieve", paso: "datos", que: "si en el sitio puede acumularse nieve (E.020 Art. 7.1 d) (en Datos › Cargas permanentes)" });
    } else if (!s.hayNieve) {
      const vt = E020.vivaTecho({ tipo: "liviana", hayNieve: false });
      const At = f.luz_m * f.sep_m;
      const rd = E020.reduceViva({ Lo_kgfm2: vt.Lo_kgfm2, At_m2: At });
      Lr = rd.reducido ? rd.Lr_kgfm2 : vt.Lo_kgfm2;
      L1.push(ln("Carga viva de techo Lo", n2(vt.Lo_kgfm2, 0) + " kgf/m²", "norma",
        { fuente: "Lr.liviana" }));
      L1.push(ln("Área tributaria de un pórtico", n2(At, 1) + " m²", "geometria",
        { nota: "luz × separación" }));
      L1.push(ln("Carga viva reducida Lr", n2(Lr, 2) + " kgf/m²", "norma",
        { fuente: "Lr.red.formula", nota: rd.reducido ? null : rd.motivo }));
    } else {
      if (!(s.Qs_kgfm2 >= 0)) {
        faltan.push({ campo: "cp_qs", paso: "datos", que: "la carga básica de nieve del sitio, Qs (en Datos › Cargas permanentes)" });
      } else {
        const qs = E020.nieveQs(s.Qs_kgfm2);
        const qt = E020.nieveQt({ Qs_kgfm2: qs.Qs_kgfm2, theta_grad: f.theta_grad });
        const db = E020.nieveDesbalanceada({ Qt_kgfm2: qt.Qt_kgfm2, semiluz_m: f.luz_m / 2,
          theta_grad: f.theta_grad });
        S = { Qt_kgfm2: qt.Qt_kgfm2,
          desbalanceada: db.aplica ? { faldonA_kgfm2: db.faldonA_kgfm2, faldonB_kgfm2: db.faldonB_kgfm2 } : null };
        L1.push(ln("Nieve básica Qs", n2(qs.Qs_kgfm2, 0) + " kgf/m²", "norma",
          { fuente: "N.Qs.min", nota: qs.enMinimo ? "se subió al mínimo de la norma" : null }));
        const filaQt = { "Art. 11.3 a)": "N.Qt.a", "Art. 11.3 b)": "N.Qt.b", "Art. 11.3 c)": "N.Qt.c" }[qt.caso];
        L1.push(ln("Nieve sobre el techo Qt", n2(qt.Qt_kgfm2, 2) + " kgf/m²",
          filaQt ? "norma" : "medido", filaQt ? { fuente: filaQt, nota: "sobre la proyección horizontal" } : {}));
        L1.push(ln("Nieve desbalanceada", db.aplica
          ? n2(db.faldonA_kgfm2, 1) + " / " + n2(db.faldonB_kgfm2, 1) + " kgf/m²" : "no aplica", "medido",
          { nota: db.aplica ? "puede invertir el signo de las diagonales" : db.motivo }));
      }
    }
    fichas.push(ficha("Gravedad", "E.020 Art. 4, 7, 10 y 11", L1));

    /* ---- viento ---- */
    const L2 = [];
    let viento = null;
    if (!(s.V_kmh > 0)) faltan.push({ campo: "ed_v", paso: "datos", que: "la velocidad del viento del Mapa Eólico (en Datos)" });
    if (s.tipoEdificacion !== 1 && s.tipoEdificacion !== 2) {
      faltan.push({ campo: "ed_tipo", paso: "datos", que: "el tipo de edificación para el viento, Tipo 1 ó 2 (en Datos)" });
    }
    const ab = s.aberturas || {};
    for (const [k, nom] of DIRECCIONES) {
      if (!ab[k]) faltan.push({ campo: "ed_ab_" + k, paso: "datos", que: "las aberturas para el viento " + nom + " (en Datos)" });
    }
    const tablaViento = [];
    if (s.V_kmh > 0 && (s.tipoEdificacion === 1 || s.tipoEdificacion === 2)) {
      const vel = VI.velocidadDiseno({ V_kmh: s.V_kmh, h_m: f.hCumbre_m });
      L2.push(ln("Velocidad del mapa V", n2(s.V_kmh, 0) + " km/h", "entrada"));
      L2.push(ln("Velocidad de diseño Vh", n2(vel.Vh_kmh, 2) + " km/h", "norma",
        { fuente: "W.Vh", nota: vel.enMinimo ? "manda el piso de 75 km/h" : null }));
      L2.push(ln("Presión de referencia 0,005·Vh²", n2(0.005 * vel.Vh_kmh * vel.Vh_kmh, 2) +
        " kgf/m²", "norma", { fuente: "W.Ph" }));
      for (const [k, nom] of DIRECCIONES) {
        if (!ab[k]) continue;
        if (k === "longitudinal") {
          for (const Ci of VI.ci(ab[k]).Ci) {
            const C = VI.T4.paralelas.barlovento[0] - Ci;
            tablaViento.push({ direccion: nom, superficie: "techo y muros largos", Ce: VI.T4.paralelas.barlovento[0],
              Ci: Ci, C: C, Ph_kgfm2: VI.presion({ C: C, Vh_kmh: vel.Vh_kmh, tipo: s.tipoEdificacion }).Ph_kgfm2 });
          }
          continue;
        }
        const g = VI.casos({ V_kmh: s.V_kmh, h_m: f.hCumbre_m, theta_grad: f.theta_grad,
          aberturas: ab[k], tipo: s.tipoEdificacion });
        for (const sup of g.superficies) {
          if (sup.superficie === "muros laterales") continue;
          for (const c of sup.casos) {
            tablaViento.push({ direccion: nom, superficie: sup.superficie, Ce: c.Ce, Ci: c.Ci,
              C: c.C, Ph_kgfm2: c.Ph_kgfm2 });
          }
        }
      }
      if (ab.izqDer && ab.derIzq && ab.longitudinal) {
        viento = { V_kmh: s.V_kmh, tipo: s.tipoEdificacion,
          aberturas: { izqDer: ab.izqDer, derIzq: ab.derIzq, longitudinal: ab.longitudinal } };
      }
    }
    fichas.push(ficha("Viento", "E.020 Cap. 3 · Art. 12 · Tablas 4 y 5", L2));
    out.tablaViento = tablaViento;

    /* ---- sismo · lo que se puede decir sin el modelo; T y V salen en el Análisis ---- */
    const L3 = [];
    let sismo = null;
    const zona = zonaDe(s);
    if (!zona) faltan.push({ campo: "ed_dist", paso: "datos", que: "el distrito del proyecto, que da la zona sísmica (en Datos)" });
    if (!s.suelo) faltan.push({ campo: "ed_suelo", paso: "datos", que: "el perfil de suelo (en Datos)" });
    if (!s.sistemaSismico) faltan.push({ campo: "ed_sissis", paso: "datos", que: "el sistema sísmico de la dirección transversal (en Datos)" });
    const cl = clasificacion(s);
    if (cl.falta) faltan.push(cl.falta);
    if (typeof s.industrial !== "boolean") {
      faltan.push({ campo: "ed_indus", paso: "datos", que: "si el uso es industrial, que cambia el límite de la deriva (en Datos)" });
    }
    const categoria = cl.c ? cl.c.categoria : null;
    if (zona && s.suelo && categoria && s.sistemaSismico) {
      try {
        const st = E030.sitio({ zona: zona, suelo: s.suelo, vs30_ms: s.vs30_ms });
        const u = E030.factorU(categoria);
        const pend = s.sistemaSismico === "pendulo";
        const rr = E030.coefR({ pendulo: pend, sistema: pend ? undefined : s.sistemaSismico });
        L3.push(ln("Factor de zona Z", n2(st.Z, 2), "norma", { fuente: "S.Z" }));
        L3.push(ln("Factor de uso U", n2(u.U, 2), "norma", { fuente: "S.U", nota: "categoría " + cl.c.sub + " por el uso (Datos)" }));
        L3.push(ln("Factor de suelo S", n2(st.S, 3), "norma", { fuente: "S.perfil",
          nota: st.sinVs30 ? "sin Vs30 medido: el mayor valor del intervalo" : null }));
        L3.push(ln("Períodos TP / TL", n2(st.TP, 2) + " / " + n2(st.TL, 2) + " s", "norma",
          { fuente: "S.perfil" }));
        L3.push(ln("Coeficiente R", n2(rr.R, 2), "norma", { fuente: pend ? "S.pendulo" : "S.R0",
          nota: rr.sistema + (rr.exigeAISC341 ? " · exige el detallado del AISC 341" : "") }));
        L3.push(ln("Vertical", "2/3·Z·U·S = " + n2(2 / 3 * st.Z * u.U * st.S, 3) + " del peso", "norma",
          { fuente: "S.vertical", nota: "sin dividir por R, a la vez que la horizontal" }));
        L3.push(ln("Período y cortante", "en el Análisis", "medido",
          { nota: "T sale de Rayleigh con el propio pórtico (Art. 36.2), que aquí no está resuelto" }));
        if (typeof s.industrial === "boolean") {
          sismo = { zona: zona, distrito: s.distrito, suelo: s.suelo, vs30_ms: s.vs30_ms, categoria: categoria, sub: cl.c.sub, uso: cl.c.uso,
            sistema: s.sistemaSismico, industrial: s.industrial };
        }
      } catch (e) {
        faltan.push({ campo: "ed_suelo", paso: "datos", que: e.message.split("\n")[0].replace(/^e030: /, "") });
      }
    }
    fichas.push(ficha("Sismo", "E.030-2026 · Art. 28, 31, 34, 36 y 38", L3));

    /* ---- combinaciones ---- */
    if (typeof s.hayNieve === "boolean") {
      const casos = { D: true, Lr: !s.hayNieve, S: s.hayNieve, W: true, E: true };
      out.combinaciones = {
        acero: CB.paraAcero({ casos: casos }).combinaciones.map((c) => ({ id: c.id, texto: c.texto })),
        concreto: CB.paraConcreto({ casos: casos }).combinaciones
          .map((c) => ({ id: c.id, texto: c.texto }))
      };
    }

    if (D !== null && (Lr !== null || S !== null) && viento && sismo) {
      out.cargas = { D_kgfm2: D, Lr_kgfm2: Lr, S: S, viento: viento, sismo: sismo };
    }
    out.completo = !faltan.length && !!out.cargas;
    return out;
  }

  /* =====================================================================
     EL PASO ANÁLISIS
     ===================================================================== */
  function seccionDesde(modelo, perfiles) {
    const cache = {};
    return function (b) {
      const p = LIBRO.perfilDe(modelo, b).perfil;
      if (!p) return null;
      if (cache[p] === undefined) {
        let x = null;
        try { x = perfiles.busca(p); } catch (e) { x = null; }
        cache[p] = x;
      }
      return cache[p];
    };
  }

  /* Los dos pórticos que se analizan · fila A.portico.tipico.  El de fachada es
     el eje 0: el último es simétrico (fila A.fachada.trib). */
  function exige(c, msg) { if (!c) throw new Error("resultados: " + msg); }
  const PORTICOS = ["interior", "fachada"];
  function ejeDe(portico) {
    exige(!portico || PORTICOS.indexOf(portico) >= 0,
      "el pórtico es " + PORTICOS.join(" ó ") + ", no «" + portico + "»");
    return portico === "fachada" ? 0 : undefined;
  }

  function analisis(m3, modelo, perfiles, portico) {
    const eje = ejeDe(portico);
    const faltas = [];
    const sitio = modelo.sitio || {};
    const c = cargas(m3, sitio);
    if (!modelo.sistema) {
      faltas.push({ paso: "analisis", que: "elige el sistema estructural: la base y la unión columna–tijeral",
        fuente: "A.sistema" });
    }
    if (!c.completo) {
      faltas.push({ paso: "cargas", que: "faltan datos de carga: " + c.faltan.map((x) => x.que).join(" · ") });
    }
    if (ACEROS.indexOf(sitio.acero) < 0) {
      faltas.push({ paso: "datos", que: "falta el acero del proyecto, A36 ó A572 (en Datos › Materiales)", fuente: "A.acero.Pns" });
    }
    let g = null;
    const seccion = seccionDesde(modelo, perfiles);
    if (modelo.sistema) {
      try {
        g = AN.geometria(m3, modelo.sistema, eje);
        const sin = AN.faltanSecciones(g, seccion, m3);
        if (sin.length) {
          faltas.push({ paso: "geom", que: "faltan perfiles para: " + sin.join(" · ") +
            ". Sin A ni I no hay análisis." });
        }
      } catch (e) {
        faltas.push({ paso: "analisis", que: e.message.split("\n").join(" ").replace(/^analisis: /, "") });
      }
    }
    if (faltas.length) return { ok: false, faltas: faltas, cargas: c };

    let r;
    try {
      r = AN.analiza({ m3: m3, sistema: modelo.sistema, seccion: seccion, acero: sitio.acero,
        cargas: c.cargas, eje: eje });
    } catch (e) {
      return { ok: false, cargas: c,
        faltas: [{ paso: "analisis", que: e.message.split("\n").join(" ").replace(/^\w+: /, "") }] };
    }
    return { ok: true, r: r, cargas: c, fichas: fichasAnalisis(r) };
  }

  function fichasAnalisis(r) {
    const F = [];
    F.push(ficha("El modelo", r.sistema.nombre, [
      ln("Pórtico analizado", (r.fachada ? "de fachada" : "interior") + ", eje " + r.eje, "geometria",
        r.fachada ? { nota: "el otro extremo es simétrico · las " + r.hastiales.length + " columnas hastiales " +
          "no están en el plano (unión deslizante)" } : undefined),
      ln("Ancho tributario", n2(r.trib_m, 2) + " m", "geometria"),
      ln("Estados de carga", r.casos.length + " (" + r.viento.estados + " de viento)", "conteo"),
      ln("Corridas", String(r.combinaciones.length), "conteo",
        { nota: "cada combinación con cada estado de viento, y las de gravedad en los dos sentidos de nocional" }),
      ln("Acero", r.acero, "entrada")
    ]));
    const d = r.deriva;
    F.push(ficha("Deriva con viento de servicio", "H/100, fila SV.viento.H", [
      ln("Peor deriva del alero", n2(d.peor.deriva_cm, 2) + " cm", "medido", { nota: d.peor.caso }),
      ln("Relación", "H/" + n2(1 / d.peor.relacion, 0), "medido",
        { estado: d.cumple ? "ok" : "no" }),
      ln("Límite", "H/100", "norma", { fuente: "SV.viento.H" })
    ], d.cumple ? "bien" : null));
    if (r.sismo) {
      const s = r.sismo, dd = s.deriva;
      F.push(ficha("Sismo", "E.030-2026", [
        ln("Peso sísmico P", t2(s.P_kgf), "medido",
          { nota: "carga muerta del pórtico + 25 % de la viva de techo" }),
        ln("Período de Rayleigh", n2(s.T_rayleigh_s, 3) + " s", "norma", { fuente: "S.T.rayleigh" }),
        ln("Período usado, × 0,85", n2(s.T_s, 3) + " s", "norma",
          { fuente: "A.sismo.periodo", nota: "hn/35 daría " + n2(s.T_hnCT_s, 3) + " s" }),
        ln("C estático", n2(s.C, 2), "norma", { fuente: "S.C.estatico" }),
        ln("C/R", n2(s.CR_usado, 3), "norma",
          { fuente: "S.CR", nota: s.enMinimoCR ? "manda el mínimo 0,11" : null }),
        ln("Cortante en la base V", t2(s.V_kgf), "norma", { fuente: "S.V" }),
        ln("Vertical ± Ev", t2(s.Ev_kgf), "norma", { fuente: "S.vertical" }),
        ln("Deriva sísmica", "Δ × " + n2(dd.multiplicador, 2) + " = " + n2(dd.deriva_cm, 2) + " cm",
          "norma", { fuente: "S.despl" }),
        ln("Relación", n2(dd.relacion, 4) + " contra " + n2(dd.limite, 3), "norma",
          { fuente: s.industrial ? "S.deriva.industrial" : "S.deriva", estado: dd.cumple ? "ok" : "no",
            nota: dd.cumple ? null : "NO CUMPLE: hace falta más rigidez lateral (columnas o sistema)" })
      ], dd.cumple ? "bien" : null));
    }
    F.push(ficha("Segundo orden", "Método Directo · Apéndice 8", [
      ln("B2 máximo", n2(r.segundoOrden.maxB2, 3), "medido",
        { nota: r.segundoOrden.maxB2 <= 1.1 ? "el ladeo amplifica poco" : null }),
      ln("τb", r.segundoOrden.tauBalt ? "nocional adicional 0,001·Yi" : "1,0", "medido",
        { nota: r.segundoOrden.nota })
    ]));
    return F;
  }

  /* Las reacciones por caso, para la tabla y para la cimentación */
  function tablaReacciones(r) {
    return r.casos.map((c) => ({
      caso: c.id, desc: c.desc,
      B0: { Rx: c.reacciones.B0.Rx_kgf, Ry: c.reacciones.B0.Ry_kgf, Mz: c.reacciones.B0.Mz_kgfcm },
      B1: { Rx: c.reacciones.B1.Rx_kgf, Ry: c.reacciones.B1.Ry_kgf, Mz: c.reacciones.B1.Mz_kgfcm }
    }));
  }

  /* ---------- EL DIBUJO DE LAS FUERZAS ----------------------------------
     El pórtico analizado, con cada barra pintada por lo que pide el modo:
       traccion · compresion · momento (solo columnas)
     El ancho y la etiqueta salen del valor; el color, del signo. */
  const MODOS = [["compresion", "Compresión máx."], ["traccion", "Tracción máx."],
    ["momento", "Momento en columnas"]];

  function dibujo(r, m3, modo) {
    const md = modo || "compresion";
    const g = AN.geometria(m3, r.sistema, r.eje);
    const barras = [];
    let max = 0;
    for (const b of g.columnas.concat(g.truss)) {
      const e = r.barras[b.id.split("@")[0]];
      let v = 0, combo = null;
      if (md === "traccion") { v = e.traccion.Pr_kgf; combo = e.traccion.combo; }
      else if (md === "compresion") { v = e.compresion.Pr_kgf; combo = e.compresion.combo; }
      else if (e.columna) { v = e.momento.Mr_kgfcm; combo = e.momento.combo; }
      max = Math.max(max, Math.abs(v));
      barras.push({ id: b.id, base: e.id, i: b.i, j: b.j, clase: b.clase, valor: v, combo: combo,
        invierte: e.invierte });
    }
    for (const b of barras) {
      b.peso = max > 0 ? Math.abs(b.valor) / max : 0;
      b.etiqueta = Math.abs(b.valor) < 1e-6 ? "" :
        (md === "momento" ? n2(b.valor / 1e5, 2) : n2(Math.abs(b.valor) / 1000, 2));
    }
    return {
      modo: md, modos: MODOS, nudos: g.nudos, barras: barras, max: max,
      unidad: md === "momento" ? "t·m" : "t",
      leyenda: md === "momento" ? "momento de segundo orden Mr = B1·Mnt + B2·Mlt, en t·m"
        : (md === "traccion" ? "tracción máxima de la envolvente, en t"
          : "compresión máxima de la envolvente, en t"),
      art: ART["A.segundo.orden"]
    };
  }

  /* Lo que la ficha de selección dice de una barra cuando hay análisis */
  function lineasFuerzas(r, idBarra) {
    const base = String(idBarra).split("@")[0];
    const e = r && r.barras[base];
    if (!e) return null;
    const L = [
      ln("Tracción máxima", e.traccion.Pr_kgf > 0 ? t2(e.traccion.Pr_kgf) : "—", "medido",
        { nota: e.traccion.combo }),
      ln("Compresión máxima", e.compresion.Pr_kgf < 0 ? t2(-e.compresion.Pr_kgf) : "—", "medido",
        { nota: e.compresion.combo })
    ];
    if (e.columna) {
      L.push(ln("Momento máximo Mr", tm(e.momento.Mr_kgfcm), "medido",
        { nota: e.momento.combo + (e.momento.B1 > 1 ? " · B1 = " + n2(e.momento.B1, 3) : "") }));
    }
    if (e.invierte) {
      L.push(ln("Cambia de signo", "sí", "medido",
        { estado: "no", nota: "tracciona en unas combinaciones y comprime en otras: hay que verificarla a las dos" }));
    }
    L.push(ln("Ratio", "falta el diseño", "medido",
      { nota: "las fuerzas ya están; el ratio es demanda entre capacidad, y la capacidad es el paso 4, Diseño" }));
    return { lineas: L, nota: (r.fachada ? "del pórtico de fachada (eje " : "del pórtico interior típico (eje ") +
      r.eje + "), " + r.sistema.nombre };
  }

  /* =====================================================================
     LOS FORMULARIOS, como datos · cada campo dice a qué clave del modelo va
     ===================================================================== */
  /* Cargas ya no pide nada: lo que pedía es dato del proyecto y está en Datos (el viento y el sistema en
     «Proyecto y sitio», el acero en «Materiales», la cobertura y el techo en «Cargas permanentes»). */
  const CAMPOS_CARGAS = [];
  const CAMPOS_ANALISIS = [
    { grupo: "Sistema estructural", campos: [
      { id: "base", clave: "base", etiqueta: "Base de las columnas", tipo: "opcion", fuente: "A.sistema",
        opciones: [ELEGIR, ["empotrada", "empotrada"], ["articulada", "articulada"]] },
      { id: "union", clave: "union", etiqueta: "Unión columna–tijeral", tipo: "opcion", fuente: "A.sistema",
        opciones: [ELEGIR, ["apoyado", "apoyado · tijeral sobre la columna"],
          ["rigida", "rígida · columna a la brida sup."]] }] }
  ];

  /* De lo que hay en los campos al sitio del modelo, y de vuelta.  Un campo
     vacío NO se guarda como cero: se queda sin poner, y cargas() lo pide. */
  function leeSitio(val) {
    const s = {};
    const num = (x) => (x === "" || x === undefined || x === null || isNaN(+x)) ? undefined : +x;
    if (num(val.esp) !== undefined) s.espesorCobertura_mm = num(val.esp);
    if (num(val.dotras) !== undefined) s.Dotras_kgfm2 = num(val.dotras);
    if (val.nieve === "si" || val.nieve === "no") s.hayNieve = val.nieve === "si";
    if (s.hayNieve && num(val.qs) !== undefined) s.Qs_kgfm2 = num(val.qs);
    if (num(val.v) !== undefined) s.V_kmh = num(val.v);
    if (val.tipo === "1" || val.tipo === "2") s.tipoEdificacion = +val.tipo;
    const ab = {};
    for (const [k] of DIRECCIONES) if (val["ab_" + k]) ab[k] = val["ab_" + k];
    if (Object.keys(ab).length) s.aberturas = ab;
    if (ACEROS.indexOf(val.acero) >= 0) s.acero = val.acero;
    if (val.sissis) s.sistemaSismico = val.sissis;
    return s;
  }
  function valoresDeSitio(sitio) {
    const s = sitio || {};
    const v = {};
    if (s.espesorCobertura_mm !== undefined) v.esp = s.espesorCobertura_mm.toFixed(2);
    if (s.Dotras_kgfm2 !== undefined) v.dotras = String(s.Dotras_kgfm2);
    if (typeof s.hayNieve === "boolean") v.nieve = s.hayNieve ? "si" : "no";
    if (s.Qs_kgfm2 !== undefined) v.qs = String(s.Qs_kgfm2);
    if (s.V_kmh !== undefined) v.v = String(s.V_kmh);
    if (s.tipoEdificacion !== undefined) v.tipo = String(s.tipoEdificacion);
    for (const [k] of DIRECCIONES) if (s.aberturas && s.aberturas[k]) v["ab_" + k] = s.aberturas[k];
    if (s.acero) v.acero = s.acero;
    if (s.sistemaSismico) v.sissis = s.sistemaSismico;
    return v;
  }
  function leeSistema(val) {
    return (val.base && val.union) ? { base: val.base, union: val.union } : null;
  }

  /* =====================================================================
     EL PASO DISEÑO
     ===================================================================== */
  const SINO = [ELEGIR, ["si", "sí"], ["no", "no"]];
  const CAMPOS_DISENO = [
    { grupo: "Arriostramiento", campos: [
      { id: "arrinf", clave: "arriostreInferior_m", etiqueta: "Arriostre lateral de la brida inferior cada",
        unidad: "m", tipo: "numero", fuente: "D.DIS.longitudes" },
      { id: "larg", clave: "separacionLargueros_m", etiqueta: "Separación de los largueros", unidad: "m",
        tipo: "numero", fuente: "D.DIS.longitudes" },
      { id: "lb", clave: "LbColumna_m", etiqueta: "Lb de la columna (pandeo lateral-torsional)", unidad: "m",
        tipo: "numero", fuente: "D.DIS.longitudes" },
      { id: "ap6", clave: "arriostreComprobado", etiqueta: "Correas, largueros y arriostres cumplen el Apéndice 6",
        tipo: "opcion", fuente: "E.C3.arriostre", opciones: SINO }] },
    { grupo: "Tijeral", campos: [
      { id: "cart", clave: "cartela", etiqueta: "Ángulos dobles: separación", tipo: "opcion",
        fuente: "D.DIS.cartela", opciones: [ELEGIR, ["0", "en contacto"], ["3/8", "cartela de 3/8\""],
          ["3/4", "cartela de 3/4\""]] },
      { id: "sep", clave: "separadores_cm", etiqueta: "Separadores de los ángulos dobles cada", unidad: "cm",
        tipo: "numero", fuente: "C.E6.a" },
      { id: "consep", clave: "conexionSeparadores", etiqueta: "Los separadores van", tipo: "opcion",
        fuente: "C.E6.a", opciones: [ELEGIR, ["requintado", "soldados"], ["apretado", "con pernos ajustados"]] },
      { id: "e5", clave: "condicionesE5", etiqueta: "Las barras de ángulo simple cumplen las 5 condiciones del E5",
        tipo: "opcion", fuente: "C.E5.cond", opciones: SINO },
      { id: "un", clave: "uniones", etiqueta: "Uniones de las barras", tipo: "opcion", fuente: "T.U.c2",
        opciones: [ELEGIR, ["soldadas", "soldadas"], ["empernadas", "empernadas"]] },
      { id: "filete", clave: "filete_mm", etiqueta: "Tamaño del filete", unidad: "mm", tipo: "numero",
        fuente: "J.union.angulo", soloSi: "un=soldadas" },
      { id: "elec", clave: "electrodo", etiqueta: "Electrodo", tipo: "opcion", fuente: "J.union.angulo",
        soloSi: "un=soldadas", opciones: [ELEGIR, ["E70", "E70XX"], ["E60", "E60XX"]] },
      { id: "sold", clave: "soldadura_cm", etiqueta: "Longitud de soldadura en la cartela", unidad: "cm",
        tipo: "numero", fuente: "T.U.c2", soloSi: "un=soldadas" },
      { id: "pern", clave: "pernosPorLinea", etiqueta: "Pernos por línea", tipo: "numero", fuente: "T.U.c8",
        soloSi: "un=empernadas" },
      { id: "dperno", clave: "diametroPerno", etiqueta: "Diámetro de los pernos", tipo: "opcion",
        fuente: "T.U.c8", soloSi: "un=empernadas",
        opciones: [ELEGIR, ["1/2", "1/2\""], ["5/8", "5/8\""], ["3/4", "3/4\""], ["7/8", "7/8\""],
          ["M16", "M16"], ["M20", "M20"], ["M22", "M22"]] },
      { id: "gperno", clave: "gradoPerno", etiqueta: "Grado de los pernos", tipo: "opcion", fuente: "J.pernos.detalle",
        soloSi: "un=empernadas", opciones: [ELEGIR, ["A325", "A325"], ["A307", "A307"], ["A490", "A490"]] },
      { id: "ps", clave: "pernoS_cm", etiqueta: "Separación entre pernos", unidad: "cm", tipo: "numero",
        fuente: "J.pernos.detalle", soloSi: "un=empernadas" },
      { id: "ple", clave: "pernoLe_cm", etiqueta: "Distancia al borde, en la dirección de la fuerza", unidad: "cm",
        tipo: "numero", fuente: "J.pernos.detalle", soloSi: "un=empernadas" },
      { id: "pg", clave: "gramil_cm", etiqueta: "Gramil: del talón a la línea de pernos", unidad: "cm", tipo: "numero",
        fuente: "J.pernos.detalle", soloSi: "un=empernadas" }] },
    { grupo: "Correas", campos: [
      { id: "ten", clave: "tensores", etiqueta: "Tensores por correa en cada paño (0 si ninguno)", tipo: "numero",
        fuente: "F.F6.sinLTB" },
      { id: "ptram", clave: "panelTramos", etiqueta: "Cada plancha apoya sobre", tipo: "opcion", fuente: "D.cobertura.tabla",
        opciones: [ELEGIR, ["1", "1 tramo de correa"], ["2", "2 tramos"], ["3", "3 tramos o más"]] },
      { id: "clip", clave: "clipCorreas", etiqueta: "La correa se fija al tijeral con clip", tipo: "opcion",
        fuente: "F.hipotesis", opciones: SINO }] }
  ];

  function leeDiseno(val) {
    const d = {};
    const num = (x) => (x === "" || x === undefined || x === null || isNaN(+x)) ? undefined : +x;
    const pon = (k, v) => { if (v !== undefined) d[k] = v; };
    pon("arriostreInferior_m", num(val.arrinf));
    pon("separacionLargueros_m", num(val.larg));
    pon("LbColumna_m", num(val.lb));
    if (val.ap6 === "si" || val.ap6 === "no") d.arriostreComprobado = val.ap6 === "si";
    if (DI.CARTELAS[val.cart] !== undefined && val.cart !== "") d.cartela = val.cart;
    pon("separadores_cm", num(val.sep));
    if (val.consep === "requintado" || val.consep === "apretado") d.conexionSeparadores = val.consep;
    if (val.e5 === "si" || val.e5 === "no") d.condicionesE5 = val.e5 === "si";
    if (val.un === "soldadas" || val.un === "empernadas") d.uniones = val.un;
    if (d.uniones === "soldadas") pon("soldadura_cm", num(val.sold));
    if (d.uniones === "empernadas") {
      pon("pernosPorLinea", num(val.pern));
      if (val.dperno) d.diametroPerno = val.dperno;
    }
    if (d.uniones === "soldadas") {
      pon("filete_mm", num(val.filete));
      if (val.elec === "E70" || val.elec === "E60") d.electrodo = val.elec;
    }
    if (d.uniones === "empernadas") {
      if (["A325", "A307", "A490"].indexOf(val.gperno) >= 0) d.gradoPerno = val.gperno;
      pon("pernoS_cm", num(val.ps)); pon("pernoLe_cm", num(val.ple)); pon("gramil_cm", num(val.pg));
    }
    pon("tensores", num(val.ten));
    if (["1", "2", "3"].indexOf(val.ptram) >= 0) d.panelTramos = +val.ptram;
    if (val.clip === "si" || val.clip === "no") d.clipCorreas = val.clip === "si";
    return d;
  }
  function valoresDeDiseno(dz) {
    const d = dz || {}, v = {};
    const s = (k, x) => { if (x !== undefined) v[k] = String(x); };
    s("arrinf", d.arriostreInferior_m); s("larg", d.separacionLargueros_m); s("lb", d.LbColumna_m);
    if (typeof d.arriostreComprobado === "boolean") v.ap6 = d.arriostreComprobado ? "si" : "no";
    s("cart", d.cartela); s("sep", d.separadores_cm); s("consep", d.conexionSeparadores);
    if (typeof d.condicionesE5 === "boolean") v.e5 = d.condicionesE5 ? "si" : "no";
    s("un", d.uniones); s("sold", d.soldadura_cm); s("pern", d.pernosPorLinea); s("dperno", d.diametroPerno);
    s("filete", d.filete_mm); s("elec", d.electrodo); s("gperno", d.gradoPerno); s("ps", d.pernoS_cm);
    s("ple", d.pernoLe_cm); s("pg", d.gramil_cm);
    s("ten", d.tensores); s("ptram", d.panelTramos);
    if (typeof d.clipCorreas === "boolean") v.clip = d.clipCorreas ? "si" : "no";
    return v;
  }

  /* El diseño entero: corre el análisis si hace falta y verifica.  Lo que
     falte se dice con el paso al que hay que ir, como en el análisis. */
  function diseno(m3, modelo, perfiles, an, portico) {
    const a = an || analisis(m3, modelo, perfiles, portico);
    if (!a.ok) {
      return { ok: false, faltas: [{ paso: "analisis",
        que: "el diseño necesita el análisis, y el análisis todavía no corre" }].concat(a.faltas) };
    }
    const seccion = seccionDesde(modelo, perfiles);
    const v = DI.verificaPortico({ analisis: a.r, m3: m3, seccion: seccion, acero: modelo.sitio.acero,
      diseno: modelo.diseno || {} });
    if (!v.ok) {
      return { ok: false, faltas: v.faltan.map((f) => ({ paso: "diseno", que: f.que, campo: f.campo })) };
    }
    return { ok: true, v: v, r: a.r, fichas: fichasDiseno(v) };
  }

  function fichasDiseno(v) {
    const R = v.resumen;
    const L = [
      ln("Barras verificadas", String(R.total), "conteo"),
      ln("Cumplen", R.cumplen + " de " + R.total, "conteo", { estado: R.cumplen === R.total ? "ok" : "no" }),
      ln("Con un control esencial sin hacer", String(R.conOmitidosEsenciales), "conteo",
        { estado: R.conOmitidosEsenciales ? "no" : "ok",
          nota: R.conOmitidosEsenciales ? "no cumplen aunque su ratio sea bajo: falta comprobar algo que manda" : null }),
      ln("La peor", R.peor.id + " · " + (R.peor.ratio === null ? "—" : n2(R.peor.ratio, 2)), "medido",
        { estado: R.peor.ratio > 1 ? "no" : null, nota: R.peor.estado ? R.peor.estado + " · " + R.peor.combo : null })
    ];
    return [ficha("Resumen", "ratio = demanda / capacidad, AISC 360-22", L,
      R.cumplen === R.total ? "bien" : null)];
  }

  function nivelRatio(x) {
    if (x.faltanEsenciales || x.ratio === null) return "falta";
    return x.ratio > 1 + 1e-12 ? "no" : "ok";
  }

  /* El pórtico pintado por ratio: verde cumple, rojo no, naranja discontinuo
     si falta un control esencial.  El grosor crece con el ratio. */
  function dibujoDiseno(dv, m3) {
    const g = AN.geometria(m3, dv.r.sistema, dv.r.eje);
    const barras = [];
    for (const b of g.columnas.concat(g.truss)) {
      const x = dv.v.barras[b.id.split("@")[0]];
      const nivel = nivelRatio(x);
      barras.push({ id: b.id, base: x.id, i: b.i, j: b.j, clase: b.clase, valor: x.ratio || 0,
        nivel: nivel, cls: nivel === "ok" ? "ok" : (nivel === "no" ? "no" : "falta"),
        peso: Math.min(1, (x.ratio || 0) / 1.5),
        etiqueta: x.ratio === null ? "?" : n2(x.ratio, 2) });
    }
    return { modo: "ratio", nudos: g.nudos, barras: barras,
      leyenda: "ratio = demanda / capacidad · el grosor crece con el ratio" };
  }

  function tablaDiseno(v) {
    return Object.keys(v.porClase).map((k) => v.porClase[k]);
  }

  function lineasDiseno(v, idBarra) {
    const x = v && v.barras[String(idBarra).split("@")[0]];
    if (!x) return null;
    const L = [
      ln("Perfil", x.perfil, "entrada"),
      ln("Ratio", x.ratio === null ? "no se pudo calcular" : n2(x.ratio, 3), "medido",
        { estado: nivelRatio(x) === "ok" ? "ok" : "no", nota: x.estado ? x.estado + " · " + x.combo : null })
    ];
    for (const q of (x.ratios || [])) {
      if (q.estado === x.estado) continue;
      L.push(ln(q.estado.split(" · ")[0], n2(q.valor, 3), "medido", { nota: q.estado }));
    }
    for (const o of x.omitidos) {
      /* lo que falta va en la etiqueta y la palabra corta en el valor: el valor no
         parte línea y un texto largo ahí se montaba sobre la etiqueta */
      L.push(ln(o.que, o.esencial ? "FALTA" : "supuesto", "medido",
        { estado: o.esencial ? "no" : null, nota: o.motivo }));
    }
    return { lineas: L, cumple: x.cumple,
      nota: x.cumple ? "cumple" : (x.faltanEsenciales ? "no cumple: falta un control esencial" : "no cumple: ratio mayor que 1") };
  }

  /* Lo que el análisis y el diseño tienen que contarle a Comprobación.  Solo
     lo que ya está calculado: Comprobación no corre nada por su cuenta. */
  function avisosResultados(a, d, cz) {
    const L = [];
    const rr = (a && a.ok && a.r) || (d && d.ok && d.r) || (cz && cz.ok && cz.r) || null;
    const quien = (cz && cz.ok && cz.tipo === "arriostrado") ? "Zapata del paño arriostrado · " :
      ((cz && cz.ok && cz.tipo === "hastial") ? "Zapata de la columna hastial · " :
        (rr && rr.fachada ? "Pórtico de fachada · " : ""));
    if (a && a.ok) {
      const r = a.r;
      if (!r.deriva.cumple) {
        L.push({ nivel: "error", que: "La deriva con viento de servicio no cumple: H/" +
          Math.round(1 / r.deriva.peor.relacion), porque: "el límite es H/100 (fila SV.viento.H). " +
          "Hace falta más rigidez lateral.", fuente: "SV.viento.H", paso: "analisis" });
      }
      if (r.sismo && !r.sismo.deriva.cumple) {
        L.push({ nivel: "error", que: "La deriva sísmica no cumple: " +
          r.sismo.deriva.relacion.toFixed(4).replace(".", ",") + " contra " +
          r.sismo.deriva.limite.toFixed(3).replace(".", ","),
          porque: "desplazamiento × 0,75·R contra la Tabla N° 14. Más rigidez lateral, o declarar uso " +
            "industrial si lo es.", fuente: "S.despl", paso: "analisis" });
      }
      for (const x of r.avisos) {
        if (/sale al \d+,\d %/.test(x)) L.push({ nivel: "aviso", que: "El sistema sísmico no es el de la geometría",
          porque: x, fuente: "A.sismo.sistema", paso: "cargas" });
      }
    }
    if (d && d.ok) {
      const filas = Object.keys(d.v.barras).map((k) => d.v.barras[k]);
      const no = filas.filter((x) => !x.faltanEsenciales && x.ratio > 1 + 1e-12);
      const falta = filas.filter((x) => x.faltanEsenciales);
      if (no.length) {
        L.push({ nivel: "error", que: no.length + " barra(s) con ratio mayor que 1",
          porque: "la peor, " + d.v.resumen.peor.id + " con " + d.v.resumen.peor.ratio.toFixed(2)
            .replace(".", ",") + ". Se cambia el perfil en la tabla de Geometría.",
          cuales: no.map((x) => x.id), paso: "diseno" });
      }
      if (falta.length) {
        L.push({ nivel: "error", que: falta.length + " barra(s) con un control esencial sin hacer",
          porque: "no cumplen aunque su ratio sea bajo: " + falta[0].omitidos.filter((o) => o.esencial)[0].que,
          cuales: falta.map((x) => x.id), paso: "diseno" });
      }
    }
    if (cz && cz.ok && !cz.z.cumple) {
      L.push({ nivel: "error", que: "La zapata no cumple: " + cz.z.fallas.join(", "),
        porque: cz.z.auto ? "ni con las medidas buscadas: revisa el suelo, el desplante o el pedestal"
          : "con las medidas dadas. Borra B, L y h para que se busquen.", paso: "cimen" });
    }
    if (cz && cz.ok && cz.viga && cz.viga.exigida && (cz.viga.falta || !cz.viga.cumple)) {
      L.push({ nivel: "error", que: "La viga de conexión " + (cz.viga.falta ? "no tiene sección" : "no cumple"),
        porque: "con este suelo la E.030 Art. 65.1 la exige en las dos direcciones", fuente: "Z.conexion", paso: "cimen" });
    }
    if (cz && cz.ok && cz.ped && !cz.ped.cumple) {
      L.push({ nivel: "error", que: "El pedestal no cumple: " + cz.ped.fallas.join(", "),
        porque: "se arregla con sus medidas, la barra o el estribo, en Cimentación", paso: "cimen" });
    }
    if (cz && cz.ok && cz.placa && !cz.placa.cumple) {
      L.push({ nivel: "error", que: "La placa base no cumple: " + cz.placa.fallas.join(", "),
        porque: "se arregla con la placa, los pernos o la llave, en Cimentación", paso: "cimen" });
    }
    /* de qué pórtico es cada aviso, cuando no es el interior */
    for (const x of L) x.que = quien + x.que;
    return L;
  }

  /* =====================================================================
     EL PASO CIMENTACIÓN · E8
     ===================================================================== */
  const CAMPOS_CIMENTACION = [
    /* el suelo, el f'c y el grado se piden en Datos › Materiales */
    { grupo: "Recubrimiento y parrilla", campos: [
      { id: "rec", clave: "rec_cm", etiqueta: "Recubrimiento (mín. 7 cm)", unidad: "cm", tipo: "numero",
        fuente: "Z.rec" },
      { id: "barra", clave: "barra", etiqueta: "Barra de la parrilla", tipo: "opcion", fuente: "Z.s.max",
        opciones: [ELEGIR, ["1/2", "1/2\""], ["5/8", "5/8\""], ["3/4", "3/4\""], ["1", "1\""]] }] },
    { grupo: "Pedestal", campos: [
      { id: "pedb", clave: "pedB_cm", etiqueta: "Ancho del pedestal (fuera del plano)", unidad: "cm", tipo: "numero" },
      { id: "pedl", clave: "pedL_cm", etiqueta: "Largo del pedestal (en el plano del pórtico)", unidad: "cm",
        tipo: "numero" },
      { id: "sobre", clave: "sobreTerreno_cm", etiqueta: "Cuánto sobresale del terreno", unidad: "cm",
        tipo: "numero" },
      { id: "pbarra", clave: "pedBarra", etiqueta: "Barra longitudinal", tipo: "opcion", fuente: "PD.rho",
        opciones: [ELEGIR, ["1/2", "1/2\""], ["5/8", "5/8\""], ["3/4", "3/4\""], ["1", "1\""]] },
      { id: "pest", clave: "pedEstribo", etiqueta: "Estribo", tipo: "opcion", fuente: "PD.Vs",
        opciones: [ELEGIR, ["8mm", "8 mm"], ["3/8", "3/8\""], ["1/2", "1/2\""]] },
      { id: "prec", clave: "pedRec_cm", etiqueta: "Recubrimiento al estribo (mín. 4 cm)", unidad: "cm",
        tipo: "numero", fuente: "PD.rec" },
      { id: "junta", clave: "junta", etiqueta: "La junta con la zapata", tipo: "opcion", fuente: "PD.friccion",
        opciones: [ELEGIR, ["monolitico", "vaciado junto con la zapata (μ = 1,4)"],
          ["rugosa", "sobre la zapata, junta rugosa de 6 mm (μ = 1,0)"],
          ["lisa", "sobre la zapata, junta sin hacer rugosa (μ = 0,6)"]] }] },
    { grupo: "Placa base y pernos de anclaje", campos: [
      { id: "plb", clave: "placaB_cm", etiqueta: "Ancho de la placa B (fuera del plano)", unidad: "cm", tipo: "numero" },
      { id: "pln", clave: "placaN_cm", etiqueta: "Largo de la placa N (en el plano)", unidad: "cm", tipo: "numero" },
      { id: "plt", clave: "placaT_cm", etiqueta: "Espesor (vacío: se calcula el que hace falta)", unidad: "cm",
        tipo: "numero", fuente: "J.base.momento.t" },
      { id: "pf", clave: "pernoF_cm", etiqueta: "Del eje de la columna a cada fila de pernos", unidad: "cm",
        tipo: "numero", fuente: "J.base.momento.metodo" },
      { id: "pnf", clave: "pernosFila", etiqueta: "Pernos en cada fila", tipo: "numero" },
      { id: "psep", clave: "pernoSep_cm", etiqueta: "Separación entre pernos de una fila", unidad: "cm",
        tipo: "numero", fuente: "J.anclaje.geometria" },
      { id: "pd", clave: "pernoD", etiqueta: "Diámetro del perno", tipo: "opcion", fuente: "J.anclaje.acero",
        opciones: [ELEGIR, ["3/4", "3/4\""], ["7/8", "7/8\""], ["1", "1\""], ["1-1/8", "1 1/8\""],
          ["1-1/4", "1 1/4\""]] },
      { id: "pmat", clave: "pernoMat", etiqueta: "Acero del perno", tipo: "opcion", fuente: "J.anclaje.acero",
        opciones: [ELEGIR, ["A36", "A36"], ["A572", "A572 Gr. 50"]] },
      { id: "pld", clave: "pernoLd_cm", etiqueta: "Longitud embebida del perno", unidad: "cm", tipo: "numero",
        fuente: "J.anclaje.geometria" },
      { id: "elec", clave: "electrodo", etiqueta: "Electrodo de la soldadura columna-placa", tipo: "opcion",
        fuente: "J.base.momento.soldadura", opciones: [ELEGIR, ["E70", "E70XX"], ["E60", "E60XX"]] }] },
    { grupo: "Vigas de conexión (si se exigen)", campos: [
      { id: "vcb", clave: "vigaB_cm", etiqueta: "Ancho de la viga de conexión", unidad: "cm", tipo: "numero",
        fuente: "Z.conexion" },
      { id: "vch", clave: "vigaH_cm", etiqueta: "Peralte de la viga de conexión", unidad: "cm", tipo: "numero",
        fuente: "Z.conexion" }] },
    { grupo: "Llave de corte", campos: [
      { id: "lll", clave: "llaveL_cm", etiqueta: "Ancho de la llave", unidad: "cm", tipo: "numero", fuente: "J.llave.aplast" },
      { id: "llh", clave: "llaveH_cm", etiqueta: "Altura embebida", unidad: "cm", tipo: "numero", fuente: "J.llave.aplast" },
      { id: "llt", clave: "llaveT_cm", etiqueta: "Espesor de la llave", unidad: "cm", tipo: "numero", fuente: "J.llave.flexion" },
      { id: "grout", clave: "grout_cm", etiqueta: "Espesor del grout bajo la placa", unidad: "cm", tipo: "numero",
        fuente: "J.llave.flexion" }] },
    { grupo: "Zapata (vacío: se buscan las medidas)", campos: [
      { id: "zb", clave: "B_cm", etiqueta: "B", unidad: "cm", tipo: "numero" },
      { id: "zl", clave: "L_cm", etiqueta: "L (en el plano del pórtico)", unidad: "cm", tipo: "numero" },
      { id: "zh", clave: "h_cm", etiqueta: "Peralte h", unidad: "cm", tipo: "numero", fuente: "Z.peralte.min" }] }
  ];

  function leeCimentacion(val) {
    const c = {};
    const num = (x) => (x === "" || x === undefined || x === null || isNaN(+x)) ? undefined : +x;
    const pon = (k, v) => { if (v !== undefined) c[k] = v; };
    pon("sigmaAdm_kgfcm2", num(val.sigma));
    if (val.neta === "neta" || val.neta === "bruta") c.esNeta = val.neta === "neta";
    pon("Df_cm", num(val.df)); pon("gammaRelleno_kgfm3", num(val.gr)); pon("sc_kgfm2", num(val.sc));
    pon("mu", num(val.mu)); pon("fc_kgcm2", num(val.fc));
    if (val.grado === "60" || val.grado === "40") c.grado = val.grado;
    pon("rec_cm", num(val.rec));
    if (val.barra) c.barra = val.barra;
    pon("pedB_cm", num(val.pedb)); pon("pedL_cm", num(val.pedl)); pon("sobreTerreno_cm", num(val.sobre));
    pon("B_cm", num(val.zb)); pon("L_cm", num(val.zl)); pon("h_cm", num(val.zh));
    if (val.pbarra) c.pedBarra = val.pbarra;
    if (val.pest) c.pedEstribo = val.pest;
    pon("pedRec_cm", num(val.prec));
    if (val.junta) c.junta = val.junta;
    pon("placaB_cm", num(val.plb)); pon("placaN_cm", num(val.pln)); pon("placaT_cm", num(val.plt));
    pon("pernoF_cm", num(val.pf)); pon("pernosFila", num(val.pnf)); pon("pernoSep_cm", num(val.psep));
    if (val.pd) c.pernoD = val.pd;
    if (val.pmat) c.pernoMat = val.pmat;
    pon("pernoLd_cm", num(val.pld));
    if (val.elec) c.electrodo = val.elec;
    pon("llaveL_cm", num(val.lll)); pon("llaveH_cm", num(val.llh)); pon("llaveT_cm", num(val.llt));
    pon("grout_cm", num(val.grout));
    pon("vigaB_cm", num(val.vcb)); pon("vigaH_cm", num(val.vch));
    return c;
  }
  function valoresDeCimentacion(cz) {
    const c = cz || {}, v = {};
    const s = (k, x) => { if (x !== undefined) v[k] = String(x); };
    s("sigma", c.sigmaAdm_kgfcm2);
    if (typeof c.esNeta === "boolean") v.neta = c.esNeta ? "neta" : "bruta";
    s("df", c.Df_cm); s("gr", c.gammaRelleno_kgfm3); s("sc", c.sc_kgfm2); s("mu", c.mu); s("fc", c.fc_kgcm2);
    s("grado", c.grado); s("rec", c.rec_cm); s("barra", c.barra);
    s("pedb", c.pedB_cm); s("pedl", c.pedL_cm); s("sobre", c.sobreTerreno_cm);
    s("zb", c.B_cm); s("zl", c.L_cm); s("zh", c.h_cm);
    s("pbarra", c.pedBarra); s("pest", c.pedEstribo); s("prec", c.pedRec_cm); s("junta", c.junta);
    s("plb", c.placaB_cm); s("pln", c.placaN_cm); s("plt", c.placaT_cm); s("pf", c.pernoF_cm);
    s("pnf", c.pernosFila); s("psep", c.pernoSep_cm); s("pd", c.pernoD); s("pmat", c.pernoMat);
    s("pld", c.pernoLd_cm); s("elec", c.electrodo); s("lll", c.llaveL_cm); s("llh", c.llaveH_cm);
    s("llt", c.llaveT_cm); s("grout", c.grout_cm); s("vcb", c.vigaB_cm); s("vch", c.vigaH_cm);
    return v;
  }

  /* La zapata: necesita el análisis, porque lo que le llega son sus casos */
  /* =====================================================================
     LOS TIPOS DE ZAPATA · fila ZT.tipos
     interior     · pórtico interior, sin nada a lo largo
     arriostrado  · pórtico interior en un paño arriostrado de fachada: + la cruz
     fachada      · pórtico de fachada: + el viento del hastial en la esquina (y la cruz si el paño extremo
                    está arriostrado)
     hastial      · la columna hastial: su peso y el viento del hastial
     ===================================================================== */
  const TIPOS_ZAPATA = ["interior", "arriostrado", "fachada", "hastial"];

  /* los paños arriostrados de fachada que tocan este eje */
  const panosDe = (m3, eje) => m3.panosArriostradosFachada.filter((k) => k === eje || k + 1 === eje);
  function existeTipo(m3, tipo) {
    const ult = m3.ejes.porticos - 1;
    if (tipo === "arriostrado") {
      return m3.panosArriostradosFachada.some((k) => (k > 0 && k < ult) || (k + 1 > 0 && k + 1 < ult));
    }
    if (tipo === "hastial") return (m3.columnasHastiales || []).length > 0;
    return true;
  }

  /* LOS CASOS DE UNA ZAPATA: los del pórtico más lo que llega a lo largo, por variantes ·
     la cruz no se sabe de qué lado tira (el viento va en los dos sentidos), así que cada estado
     a lo largo da DOS variantes: la base de la diagonal que tracciona (Hz y tirón) y la otra
     columna (compresión) · fila ZT.cruz */
  function casosZapata(tipo, a, lg, m3, modelo, perfiles, c) {
    const conCero = (r) => Object.assign({ Rz_kgf: 0 }, r);
    const copia = (cs) => cs.map((x) => Object.assign({}, x, { reacciones: Object.keys(x.reacciones)
      .reduce((o, b) => { o[b] = conCero(x.reacciones[b]); return o; }, {}) }));
    if (tipo === "interior") return copia(a.r.casos);
    const lgW = (Ci) => lg.estados.filter((e) => e.tipo === "W" && Math.abs(e.Ci - Ci) < 1e-9)[0];
    const lgE = lg.estados.filter((e) => e.tipo === "E")[0];
    const lado = { B0: "izq", B1: "der" };
    /* la cruz de un estado, en el lado de la base · H y V */
    const cruzDe = (e, b) => {
      const cs = e.cruces.filter((x) => x.lado === lado[b]);
      return cs.length ? { H: Math.max.apply(null, cs.map((x) => Math.abs(x.H_kgf))),
        V: Math.max.apply(null, cs.map((x) => x.vertical_kgf)) } : null;
    };
    if (tipo === "hastial") {
      /* la columna hastial que más recibe · fila ZT.hastial */
      const p = seccionDesde(modelo, perfiles)({ id: "clase:columna hastial", clase: "columna hastial" });
      let peorJ = -1, peorR = -1;
      lg.estados.filter((e) => e.tipo === "W").forEach((e) => e.hastialInicio.concat(e.hastialFinal).forEach((x, i) => {
        const j = i % e.hastialInicio.length;
        if (lg.geometria.lineas[j].tipo === "hastial" && Math.abs(x.Rbase_kgf) > peorR) { peorR = Math.abs(x.Rbase_kgf); peorJ = j; }
      }));
      const L = lg.geometria.lineas[peorJ];
      const ancho = L.b - L.a;
      const P = (p ? (p.peso_kgfm || 0) : 0) * L.H_m + c.D_kgfm2 * ancho * L.H_m;
      const R = (Ry, Rz) => ({ H: { Rx_kgf: 0, Ry_kgf: Ry, Mz_kgfcm: 0, Rz_kgf: Rz } });
      const out = [{ id: "D", tipo: "D", desc: "peso de la columna hastial y del muro de su franja", reacciones: R(P, 0) }];
      for (const e of lg.estados.filter((x) => x.tipo === "W")) {
        out.push({ id: e.id + " · barlovento", tipo: "W", reacciones: R(0, -e.hastialInicio[peorJ].Rbase_kgf) });
        out.push({ id: e.id + " · sotavento", tipo: "W", reacciones: R(0, e.hastialFinal[peorJ].Rbase_kgf) });
      }
      out.linea = L;
      out.perfil = p;
      return out;
    }
    const eje = tipo === "fachada" ? 0 : m3.panosArriostradosFachada.map((k) => (k > 0 ? k : k + 1))
      .filter((e) => e > 0 && e < m3.ejes.porticos - 1)[0];
    const conCruz = panosDe(m3, eje).length > 0;
    const out = [];
    for (const x of copia(a.r.casos)) {
      const longi = x.tipo === "W" && x.direccion === "longitudinal";
      if (!longi) { out.push(x); continue; }
      const e = lgW(x.Ci);
      /* las variantes: la cruz (tracciona o comprime) × el papel del hastial (barlovento o sotavento) */
      const vs = [];
      for (const cz of conCruz ? ["T", "C"] : [null]) {
        for (const papel of tipo === "fachada" ? ["barlovento", "sotavento"] : [null]) vs.push([cz, papel]);
      }
      for (const [cz, papel] of vs) {
        const reac = {};
        for (const b of Object.keys(x.reacciones)) {
          const r = Object.assign({}, x.reacciones[b]);
          const k = cz ? cruzDe(e, b) : null;
          if (k && cz === "T") { r.Ry_kgf -= k.V; r.Rz_kgf -= k.H; }
          if (k && cz === "C") r.Ry_kgf += k.V;
          if (papel) {
            const j = b === "B0" ? 0 : e.hastialInicio.length - 1;
            r.Rz_kgf += papel === "barlovento" ? -e.hastialInicio[j].Rbase_kgf : e.hastialFinal[j].Rbase_kgf;
          }
          reac[b] = r;
        }
        out.push(Object.assign({}, x, { id: x.id + (cz ? " · cruz " + (cz === "T" ? "tira" : "comprime") : "") +
          (papel ? " · " + papel : ""), reacciones: reac }));
      }
    }
    /* el sismo a lo largo, solo con la cruz */
    if (conCruz && lgE) {
      for (const cz of ["T", "C"]) {
        const reac = {};
        for (const b of Object.keys(a.r.casos[0].reacciones)) {
          const k = cruzDe(lgE, b) || { H: 0, V: 0 };
          reac[b] = { Rx_kgf: 0, Ry_kgf: cz === "T" ? -k.V : k.V, Mz_kgfcm: 0, Rz_kgf: cz === "T" ? -k.H : 0 };
        }
        out.push({ id: "EL · cruz " + (cz === "T" ? "tira" : "comprime"), tipo: "E", desc: "sismo a lo largo",
          reacciones: reac });
      }
    }
    out.eje = eje;
    out.conCruz = conCruz;
    return out;
  }

  /* los datos de la zapata y del pedestal, como los piden zapatas.js y pedestal.js */
  function datosZapata(c, casos) {
    return { casos: casos,
      suelo: { sigmaAdm_kgfcm2: c.sigmaAdm_kgfcm2, esNeta: c.esNeta, Df_cm: c.Df_cm,
        gammaRelleno_kgfm3: c.gammaRelleno_kgfm3, sc_kgfm2: c.sc_kgfm2, mu: c.mu },
      concreto: { fc_kgcm2: c.fc_kgcm2, grado: c.grado, rec_cm: c.rec_cm, barra: c.barra },
      pedestal: { b_cm: c.pedB_cm, l_cm: c.pedL_cm, sobreTerreno_cm: c.sobreTerreno_cm },
      zapata: (c.B_cm > 0 && c.L_cm > 0 && c.h_cm > 0) ? { B_cm: c.B_cm, L_cm: c.L_cm, h_cm: c.h_cm } : null };
  }
  function datosPedestal(c) {
    return { b_cm: c.pedB_cm, l_cm: c.pedL_cm, fc_kgcm2: c.fc_kgcm2, grado: c.grado, barra: c.pedBarra,
      estribo: c.pedEstribo, rec_cm: c.pedRec_cm, junta: c.junta };
  }
  /* lo que falta de la zapata, el pedestal y la placa, junto y sin repetir · no necesita el análisis */
  const MOVIDOS_A_DATOS = ["sigma", "neta", "df", "gr", "sc", "mu", "fc", "grado"];
  function faltanCimentacion(c) {
    const vistos = {}, faltas = [];
    for (const f of ZA.faltan(datosZapata(c, null)).concat(PD.faltan(datosPedestal(c)), faltanPlaca(c))) {
      const campo = f.campo === "ci_ped" ? "ci_pedb" : f.campo;    /* el pedestal tiene dos campos */
      if (vistos[campo]) continue;
      vistos[campo] = true;
      /* el suelo, el f'c y el grado están en Datos › Materiales */
      const id = campo.replace(/^ci_/, "");
      if (MOVIDOS_A_DATOS.indexOf(id) >= 0) faltas.push({ que: f.que + " (en Datos › Materiales)", campo: "ma_" + id, paso: "datos" });
      else faltas.push({ que: f.que, campo: campo });
    }
    return faltas;
  }

  function cimentacion(m3, modelo, perfiles, an, portico, lo) {
    const tipo = portico || "interior";
    exige(TIPOS_ZAPATA.indexOf(tipo) >= 0, "la zapata es " + TIPOS_ZAPATA.join(" ó ") + ", no «" + tipo + "»");
    const a = an || analisis(m3, modelo, perfiles, tipo === "fachada" ? "fachada" : "interior");
    if (!a.ok) {
      return { ok: false, faltas: [{ paso: "analisis",
        que: "la cimentación necesita las reacciones del análisis, y el análisis todavía no corre" }].concat(a.faltas) };
    }
    if (!existeTipo(m3, tipo)) {
      return { ok: false, faltas: [{ paso: "geom", que: tipo === "hastial"
        ? "no hay columnas hastiales, así que no hay zapata de columna hastial"
        : "los paños arriostrados de fachada están en los extremos: sus zapatas son las de fachada" }] };
    }
    const c = modelo.cimentacion || {};
    let casosZ = a.r.casos;
    if (tipo !== "interior") {
      const L0 = lo || longitudinal(m3, modelo, perfiles, tipo === "fachada" ? undefined : a,
        tipo === "fachada" ? a : undefined);
      if (!L0.ok) return { ok: false, faltas: L0.faltas };
      casosZ = casosZapata(tipo, a, L0.lg, m3, modelo, perfiles, a.cargas.cargas);
    } else {
      casosZ = casosZapata("interior", a, null, m3, modelo, perfiles, null);
    }
    const d = datosZapata(c, casosZ);
    const pdDatos = datosPedestal(c);
    const faltas = faltanCimentacion(c);
    if (faltas.length) return { ok: false, faltas: faltas.map((f) => Object.assign({ paso: "cimen" }, f)) };  /* el paso propio gana */

    /* EL PERALTE QUE VUELVE · fila PD.anclaje.zapata.  La zapata da su peralte, el
       pedestal sale de ahí (su altura es Df − h + lo que sobresale) y sus barras piden
       un peralte para anclarse; si piden más, se rehace la zapata con ese mínimo. */
    /* los casos de ESTA zapata (con lo que llega a lo largo), no los del pórtico: primero se
       armaba con a.r.casos y el pedestal del paño arriostrado no veía la cruz */
    const est = ZA.estados(casosZ);
    const combos = ZA.combosE060(est);
    const bases = Object.keys(casosZ[0].reacciones);
    const sols = [];
    for (const cb of combos) {
      for (const b of bases) {
        const s = ZA.suma(cb.partes, b);
        sols.push({ id: cb.id, base: b, P_kgf: s.P, M_kgfcm: s.M, H_kgf: s.H, Hz_kgf: s.Hz, factorCM: cb.factorCM });
      }
    }
    let hMin = 0, z = null, ped = null;
    for (let k = 0; k < 4; k++) {
      z = ZA.disena(Object.assign({}, d, { hMinPedestal_cm: hMin }));
      ped = PD.disena(Object.assign({}, pdDatos, {
        altura_cm: Math.max(0, d.suelo.Df_cm - z.zapata.h_cm) + d.pedestal.sobreTerreno_cm,
        solicitaciones: sols,
        zapata: { h_cm: z.zapata.h_cm, rec_cm: c.rec_cm, barra_cm: ZA.BARRAS[c.barra] } }));
      if (ped.anclaje.hMin_cm <= hMin + 1e-9) break;
      hMin = ped.anclaje.hMin_cm;
    }
    /* LAS VIGAS DE CONEXIÓN · filas Z.conexion y Z.conexion.diseno */
    const sitio = modelo.sitio || {};
    const exig = ZA.conexionExigida({ suelo: sitio.suelo, zona: zonaDe(sitio), sigmaAdm_kgfcm2: c.sigmaAdm_kgfcm2 });
    let viga = Object.assign({}, exig);
    if (exig.exigida) {
      if (!(c.vigaB_cm > 0 && c.vigaH_cm > 0)) {
        viga.falta = "la sección de la viga de conexión, que aquí se exige";
      } else {
        const Pu = Math.max.apply(null, sols.map((x) => x.P_kgf));
        viga = Object.assign(viga, ZA.vigaConexion({ Pu_kgf: Pu, b_cm: c.vigaB_cm, h_cm: c.vigaH_cm,
          fc_kgcm2: c.fc_kgcm2, grado: c.grado, barra: c.pedBarra }));
      }
    }
    const placa = tipo === "hastial" ? placaHastial(casosZ, modelo, c, ped, z)
      : placaBase(m3, a.r, modelo, perfiles, c, ped, z, tipo === "interior" ? null : casosZ);
    return { ok: true, tipo: tipo, z: z, ped: ped, placa: placa, viga: viga, r: a.r, datos: c,
      eje: casosZ.eje, conCruz: !!casosZ.conCruz, linea: casosZ.linea || null,
      fichas: fichasCimentacion(z).concat(fichasPedestal(ped), fichasPlaca(placa), fichasViga(viga, sitio, c)) };
  }

  /* LA PLACA DE LA COLUMNA HASTIAL · fila ZT.hastial: compresión y cortante, sin momento
     (es articulada en las dos direcciones) */
  function placaHastial(casos, modelo, c, ped, z) {
    const p = casos.perfil;
    if (!p) return { fallas: ["la columna hastial no tiene perfil"], cumple: false, sinPerfil: true };
    const D = casos.filter((x) => x.tipo === "D")[0].reacciones.H;
    const Hmax = Math.max.apply(null, casos.filter((x) => x.tipo === "W").map((x) => Math.abs(x.reacciones.H.Rz_kgf)));
    const A2 = PB.A2DesdePedestal({ B_cm: c.placaB_cm, N_cm: c.placaN_cm, pedB_cm: c.pedB_cm, pedL_cm: c.pedL_cm });
    const mat = AC.ACEROS[modelo.sitio.acero];
    let r, fallas = [];
    try {
      r = PB.verifica({ B_cm: c.placaB_cm, N_cm: c.placaN_cm, d_cm: p.d_cm, bf_cm: p.bf_cm, tf_cm: p.tf_cm,
        fc_kgcm2: c.fc_kgcm2, A2_cm2: A2.A2_cm2, Pu_kgf: 1.2 * D.Ry_kgf, Fy_kgcm2: mat.Fy, Hu_kgf: 1.3 * Hmax,
        llave: { l_cm: c.llaveL_cm, h_cm: c.llaveH_cm, t_cm: c.llaveT_cm, grout_cm: c.grout_cm } });
      if (!r.cumple) fallas.push(r.gobierna);
    } catch (e) {
      fallas.push(e.message.split("\n")[0].replace(/^\w+: /, ""));
    }
    return { hastial: true, seccion: p.nombre, r: r, Pu_kgf: 1.2 * D.Ry_kgf, Hu_kgf: 1.3 * Hmax, B_cm: c.placaB_cm,
      N_cm: c.placaN_cm, fallas: fallas, cumple: !fallas.length, art: ART["ZT.hastial"] };
  }

  /* =====================================================================
     LAS UNIONES DEL TIJERAL · filas J.union.angulo y siguientes
     Cada clase de barra con su peor fuerza: las almas, la suya; las bridas,
     continuas, la diferencia entre sus dos tramos en cada nudo.
     ===================================================================== */
  const CARTELA_CM = { "3/8": 0.9525, "3/4": 1.905 };
  function faltanUniones(dz) {
    const F = [];
    if (dz.uniones !== "soldadas" && dz.uniones !== "empernadas") F.push({ campo: "di_un", que: "si las barras van soldadas o empernadas" });
    if (dz.uniones === "soldadas") {
      if (!(dz.soldadura_cm > 0)) F.push({ campo: "di_sold", que: "la longitud de cada filete en la cartela" });
      if (!(dz.filete_mm > 0)) F.push({ campo: "di_filete", que: "el tamaño del filete" });
      if (!dz.electrodo) F.push({ campo: "di_elec", que: "el electrodo" });
    }
    if (dz.uniones === "empernadas") {
      if (!(dz.pernosPorLinea >= 1)) F.push({ campo: "di_pern", que: "los pernos por línea" });
      if (!dz.diametroPerno) F.push({ campo: "di_dperno", que: "el diámetro de los pernos" });
      if (!dz.gradoPerno) F.push({ campo: "di_gperno", que: "el grado de los pernos" });
      if (!(dz.pernoS_cm > 0) && dz.pernosPorLinea > 1) F.push({ campo: "di_ps", que: "la separación entre pernos" });
      if (!(dz.pernoLe_cm > 0)) F.push({ campo: "di_ple", que: "la distancia al borde" });
      if (!(dz.gramil_cm > 0)) F.push({ campo: "di_pg", que: "el gramil de la línea de pernos" });
    }
    if (CARTELA_CM[dz.cartela] === undefined && dz.cartela !== "0") F.push({ campo: "di_cart", que: "el espesor de la cartela" });
    return F;
  }

  function conexiones(m3, modelo, perfiles, an, portico) {
    const a = an || analisis(m3, modelo, perfiles, portico);
    if (!a.ok) {
      return { ok: false, faltas: [{ paso: "analisis", que: "las uniones necesitan las fuerzas del análisis" }].concat(a.faltas) };
    }
    const dz = modelo.diseno || {};
    const F = faltanUniones(dz);
    if (F.length) return { ok: false, faltas: F.map((f) => ({ paso: "conex", que: f.que, campo: f.campo })) };
    const r = a.r, g = AN.geometria(m3, r.sistema, r.eje);
    const seccion = seccionDesde(modelo, perfiles);
    const filas = [];
    const sinCartela = dz.cartela === "0";
    for (const clase of ["diagonal", "montante", "brida superior", "brida inferior"]) {
      const barras = g.truss.filter((b) => b.clase === clase);
      if (!barras.length) continue;
      const p = seccion(barras[0]);
      let Nt = 0, Nc = 0, cNt = null, cNc = null;
      if (clase.indexOf("brida") < 0) {
        for (const b of barras) {
          const e = r.barras[b.id.split("@")[0]];
          if (e.traccion.Pr_kgf > Nt) { Nt = e.traccion.Pr_kgf; cNt = e.traccion.combo + " · " + e.id; }
          if (-e.compresion.Pr_kgf > Nc) { Nc = -e.compresion.Pr_kgf; cNc = e.compresion.combo + " · " + e.id; }
        }
      } else {
        /* la brida continua: en cada nudo, la diferencia de sus dos tramos en la misma corrida */
        for (const b1 of barras) for (const b2 of barras) {
          if (b1.id >= b2.id || !(b1.j === b2.i || b1.i === b2.j || b1.i === b2.i || b1.j === b2.j)) continue;
          for (const c of r.corridas) {
            const dN = Math.abs(c.fuerzas[b1.id].Pr_kgf - c.fuerzas[b2.id].Pr_kgf);
            if (dN > Nt) { Nt = dN; Nc = dN; cNt = cNc = c.id + " · nudo entre " + b1.id.split("@")[0] + " y " + b2.id.split("@")[0]; }
          }
        }
      }
      const fila = { clase: clase, perfil: p ? (p.id || p.nombre) : null, Nt_kgf: Nt, Nc_kgf: Nc, comboT: cNt, comboC: cNc };
      if (!p) { filas.push(Object.assign(fila, { ratio: null, cumple: false, falta: "sin perfil" })); continue; }
      if (p.familia !== "L" && p.familia !== "2L") {
        filas.push(Object.assign(fila, { ratio: null, cumple: false, falta: "la unión de una barra " + p.familia +
          " no está conectada: solo ángulos simples y dobles" }));
        continue;
      }
      if (sinCartela) {
        filas.push(Object.assign(fila, { ratio: null, cumple: false, falta: "con los ángulos en contacto no hay cartela: " +
          "la unión de las almas a la brida no está conectada (fila J.union.angulo)" }));
        continue;
      }
      if (!(Nt > 0 || Nc > 0)) { filas.push(Object.assign(fila, { ratio: 0, cumple: true, nota: "sin fuerza" })); continue; }
      let u;
      try {
        u = CX.unionAngulo({ perfil: p, acero: modelo.sitio.acero, tCartela_cm: CARTELA_CM[dz.cartela],
          Nt_kgf: Nt, Nc_kgf: Nc, union: dz.uniones, Lw_cm: dz.soldadura_cm, w_mm: dz.filete_mm, electrodo: dz.electrodo,
          porLinea: dz.pernosPorLinea, diametro: dz.diametroPerno, grado: dz.gradoPerno, s_cm: dz.pernoS_cm,
          le_cm: dz.pernoLe_cm, g_cm: dz.gramil_cm });
      } catch (e) {
        filas.push(Object.assign(fila, { ratio: null, cumple: false, falta: e.message.split("\n")[0].replace(/^\w+: /, "") }));
        continue;
      }
      filas.push(Object.assign(fila, { ratio: u.ratio, gobierna: u.gobierna, cumple: u.cumple, estados: u.estados,
        omitidos: u.omitidos, faltanEsenciales: u.faltanEsenciales, W_cm: u.W_cm }));
    }
    const out = { ok: true, filas: filas, r: r, union: dz.uniones, cumple: filas.every((f) => f.cumple) };
    out.fichas = fichasConexiones(out, dz);
    return out;
  }

  function fichasConexiones(cx, dz) {
    const L = [ln("Uniones", dz.uniones, "entrada", { nota: dz.uniones === "soldadas"
      ? "filetes de " + dz.filete_mm + " mm, " + dz.soldadura_cm + " cm cada uno, " + dz.electrodo
      : dz.pernosPorLinea + " pernos " + dz.gradoPerno + " de " + dz.diametroPerno + " por línea" }),
      ln("Cartela", dz.cartela === "0" ? "no hay (ángulos en contacto)" : dz.cartela + "\"", "entrada")];
    for (const f of cx.filas) {
      L.push(ln(f.clase, f.ratio === null ? "FALTA" : n2(f.ratio, 3), f.ratio === null ? "medido" : "norma",
        f.ratio === null ? { estado: "no", nota: f.falta } : { fuente: "J.union.angulo", estado: ok(f.cumple),
          nota: (f.gobierna || "") + " · " + t2(Math.max(f.Nt_kgf, f.Nc_kgf)) }));
    }
    const pend = [ln("La cartela a compresión", "no se verifica", "medido",
      { nota: "falta su longitud libre (fila J.cartela.pandeo)" }),
      ln("La unión columna–tijeral", "pendiente", "medido", { nota: "las bridas a la columna en la unión rígida" }),
      ln("Los empalmes de las bridas", "pendiente", "medido"),
      ln("Las uniones de lo que trabaja a lo largo", "pendiente", "medido",
        { nota: "cruces, arriostre de techo, puntales y clips de correa" })];
    return [ficha("Las uniones del tijeral", "AISC 360-22 Cap. J", L, cx.cumple ? "bien" : null),
      ficha("Lo que esta pantalla todavía no verifica", "se dice en vez de darlo por hecho", pend)];
  }

  function avisosConexiones(cx) {
    if (!cx || !cx.ok) return [];
    const no = cx.filas.filter((f) => !f.cumple);
    if (!no.length) return [];
    return [{ nivel: "error", que: (cx.r.fachada ? "Pórtico de fachada · " : "") + no.length + " unión(es) del tijeral no cumplen o faltan",
      porque: no.map((f) => f.clase + (f.ratio !== null ? " (" + n2(f.ratio, 2) + ")" : ": " + f.falta)).join(" · "),
      paso: "conex" }];
  }

  /* =====================================================================
     A LO LARGO · el sistema longitudinal y sus piezas
     Necesita los DOS pórticos: el peso sísmico de cada uno, y las corridas del
     de fachada para la columna de esquina.
     ===================================================================== */
  function longitudinal(m3, modelo, perfiles, ai, af) {
    const aI = ai || analisis(m3, modelo, perfiles, "interior");
    const aF = af || analisis(m3, modelo, perfiles, "fachada");
    if (!aI.ok || !aF.ok) {
      return { ok: false, faltas: [{ paso: "analisis",
        que: "lo que trabaja a lo largo necesita el análisis de los dos pórticos, y todavía no corre" }]
        .concat(aI.ok ? [] : aI.faltas) };
    }
    const c = aI.cargas.cargas;
    let lg;
    try {
      lg = LG.analiza({ m3: m3, sistema: modelo.sistema, viento: c.viento, sismo: c.sismo || null,
        P_interior_kgf: aI.r.sismo ? aI.r.sismo.P_kgf : undefined,
        P_fachada_kgf: aF.r.sismo ? aF.r.sismo.P_kgf : undefined });
    } catch (e) {
      return { ok: false, faltas: [{ paso: "analisis", que: e.message.split("\n").join(" ").replace(/^\w+: /, "") }] };
    }
    const out = { ok: true, lg: lg, r: aI.r, fichas: fichasLongitudinal(lg), cadena: cadena(lg), diseno: null };
    out.correas = correasDe(m3, modelo, perfiles, aI, lg);
    /* el diseño, con los mismos datos de diseño que los pórticos */
    const seccion = seccionDesde(modelo, perfiles);
    const F = DI.faltan(AN.geometria(m3, modelo.sistema), seccion, modelo.diseno || {});
    if (F.length) {
      out.faltasDiseno = F.map((f) => ({ paso: "diseno", que: f.que, campo: f.campo }));
    } else {
      out.diseno = DI.verificaLongitudinal({ lg: lg, interior: aI.r, fachada: aF.r, m3: m3, seccion: seccion,
        acero: modelo.sitio.acero, diseno: modelo.diseno, cerramiento_kgfm2: c.D_kgfm2, correas: out.correas });
    }
    return out;
  }

  /* =====================================================================
     LAS CORREAS · con el pórtico interior y, si está, el sistema a lo largo
     (las que hacen de puntal llevan su axial)
     ===================================================================== */
  function correasDe(m3, modelo, perfiles, aI, lg) {
    const v = DI.verificaCorreas({ m3: m3, interior: aI.r, cargas: aI.cargas.cargas,
      seccion: seccionDesde(modelo, perfiles), acero: modelo.sitio.acero, diseno: modelo.diseno || {},
      espesor_mm: modelo.sitio.espesorCobertura_mm, lg: lg });
    if (!v.ok) v.faltas = v.faltan.map((f) => ({ paso: "diseno", que: f.que, campo: f.campo }));
    return v;
  }

  function correas(m3, modelo, perfiles, ai, af) {
    const lo = longitudinal(m3, modelo, perfiles, ai, af);
    if (!lo.ok) {
      /* sin el sistema a lo largo, igual se pueden verificar a flexión... pero las de puntal no: se dice */
      const aI = ai || analisis(m3, modelo, perfiles, "interior");
      if (!aI.ok) return { ok: false, faltas: lo.faltas };
      const v = correasDe(m3, modelo, perfiles, aI, null);
      v.sinLargo = true;
      return v.ok ? Object.assign(v, { fichas: fichasCorreas(v) }) : v;
    }
    const v = lo.correas;
    return v.ok ? Object.assign(v, { fichas: fichasCorreas(v) }) : v;
  }

  function fichasCorreas(v) {
    if (v.omitida) {
      return [ficha("Las correas", "no se verifican", [ln(v.omitida.que, "FALTA", "medido",
        { estado: "no", nota: v.omitida.motivo })])];
    }
    const L = [
      ln("Perfil", v.perfil, "entrada"),
      ln("Luz", n2(v.L_m, 2) + " m", "geometria", { nota: v.tensores + " tensor(es): el eje menor, con " +
        n2(v.L_m / (v.tensores + 1), 2) + " m" }),
      ln("La peor", v.peor ? "línea " + v.peor.q + " · " + n2(v.peor.ratio, 3) : "—", "medido",
        { estado: v.peor && v.peor.ratio <= 1 ? "ok" : "no", nota: v.peor ? v.peor.combo + " · " + v.peor.estado : null }),
      ln("Flecha con " + v.deflexion.carga, n2(v.deflexion.delta_cm, 2) + " cm", "norma", { fuente: "SV.deflex",
        estado: v.deflexion.pasa ? "ok" : "no", nota: "límite L/240 = " + n2(v.deflexion.limite_cm, 2) + " cm" }),
      ln("Esbeltez L/d", n2(v.Ld.Ld, 1), "norma", { fuente: "SV.correa.Ld",
        estado: v.Ld.pasa ? "ok" : "no", nota: "límite " + n2(v.Ld.limite, 1) + " · criterio adoptado: se avisa, no rechaza" }),
      v.panel.ratio === null
        ? ln("La plancha entre correas", "FALTA", "medido", { estado: "no", nota: v.panel.motivo })
        : ln("La plancha entre correas", n2(v.panel.ratio, 3), "norma", { fuente: "D.cobertura.tabla",
          estado: v.panel.cumple ? "ok" : "no", nota: "aguanta " + n2(v.panel.P_kgfm2, 0) + " kgf/m² netos con " +
            v.panel.tramos + " tramo(s)" })
    ];
    if (v.sinLargo) L.push(ln("Correas de puntal", "sin axial", "medido", { estado: "no",
      nota: "el sistema a lo largo todavía no corre, así que la axial de las correas de puntal no está" }));
    return [ficha("Las correas", v.combinaciones + " combinaciones por línea", L, v.cumple && !v.sinLargo ? "bien" : null)];
  }

  function avisosCorreas(v) {
    if (!v || !v.ok) return [];
    const L = [];
    if (v.omitida) {
      L.push({ nivel: "error", que: "Las correas no se verifican: " + v.omitida.que, porque: v.omitida.motivo, paso: "diseno" });
      return L;
    }
    const no = v.lineas.filter((l) => !l.cumple);
    if (no.length) L.push({ nivel: "error", que: no.length + " línea(s) de correa no cumplen",
      porque: "la peor, la " + (v.peor ? v.peor.q + " con " + n2(v.peor.ratio, 2) : "—") + ". Se cambia el perfil o los tensores.",
      paso: "diseno" });
    if (!v.deflexion.pasa) L.push({ nivel: "error", que: "La correa flecta más de L/240", porque: n2(v.deflexion.delta_cm, 2) +
      " cm con " + v.deflexion.carga, fuente: "SV.deflex", paso: "diseno" });
    if (!v.panel.cumple) L.push({ nivel: "error", que: "La plancha no aguanta entre correas",
      porque: v.panel.motivo || ("pide " + n2(v.panel.demanda_kgfm2, 0) + " kgf/m² y aguanta " + n2(v.panel.P_kgfm2, 0)),
      fuente: "D.cobertura.tabla", paso: "diseno" });
    if (!v.Ld.pasa) L.push({ nivel: "aviso", que: "La correa es esbelta: L/d = " + n2(v.Ld.Ld, 1),
      porque: "pasa de " + n2(v.Ld.limite, 1) + " (criterio adoptado de Zapata 7.4): no es rechazo, pero se ve",
      fuente: "SV.correa.Ld", paso: "diseno" });
    return L;
  }

  /* La cadena, eslabón por eslabón, con su mayor fuerza factorizada · fila LG.factores */
  function cadena(lg) {
    const e = lg.envolvente;
    const fila = (que, x, fuente, nota) => ({ que: que, valor_kgf: x.valor, estado: x.estado, fuente: fuente, nota: nota });
    const L = [];
    const hast = lg.columnas.filter((c) => c && c.tipo === "hastial");
    if (hast.length) {
      const peor = hast.reduce((a, c) => (c.M_kgfm > a.M_kgfm ? c : a));
      L.push({ que: "columna hastial · momento", valor_kgfm: lg.factor.W * peor.M_kgfm, estado: peor.estado,
        fuente: "LG.hastial.reparto", nota: "x = " + n2(peor.x, 2) + " m · " + peor.papel });
      L.push(fila("arriostre vertical · diagonal", e.verticalDiagonal, "LG.vertical"));
      L.push(fila("arriostre vertical · puntal", e.verticalPuntal, "LG.vertical"));
    }
    L.push(fila("correa de puntal", e.correaPuntal, "LG.correa.puntal"));
    L.push(fila("viga de alero de puntal", e.aleroPuntal, "LG.correa.puntal"));
    L.push(fila("arriostre de techo · diagonal", e.armaduraTecho, "LG.techo.armadura"));
    L.push(fila("brida superior · cordón añadido", e.cordonTecho, "LG.techo.armadura"));
    L.push(fila("cruz de fachada · diagonal", e.cruzFachada, "LG.fachada.cruz"));
    L.push(fila("base del paño arriostrado · cortante a lo largo", e.baseCortante, "LG.fachada.cruz"));
    L.push(fila("base del paño arriostrado · tirón y compresión", e.baseVertical, "LG.fachada.cruz"));
    return L;
  }

  function fichasLongitudinal(lg) {
    const F = [];
    const g = lg.geometria;
    F.push(ficha("El sistema a lo largo", "del hastial al suelo", [
      ln("Paños arriostrados de techo", g.panosTecho.join(", "), "entrada"),
      ln("Paños arriostrados de fachada", g.panosFachada.join(", "), "entrada"),
      ln("Líneas del hastial", String(g.lineas.length), "conteo",
        { nota: g.lineas.filter((L) => L.tipo === "hastial").length + " columnas hastiales y las dos esquinas" }),
      ln("Estados", String(lg.estados.length), "conteo",
        { nota: lg.estados.filter((x) => x.tipo === "W").length + " de viento longitudinal" + (lg.sismo ? " y el sismo" : "") }),
      ln("Factor de diseño", "1,3·W · 1,0·E", "norma", { fuente: "LG.factores" })
    ]));
    if (lg.sismo) {
      const s = lg.sismo;
      F.push(ficha("Sismo a lo largo", "E.030 · OCBF", [
        ln("Peso sísmico P", t2(s.P_kgf), "medido", { nota: "todos los pórticos" }),
        ln("Período T = hn/45", n2(s.T_s, 3) + " s", "norma", { fuente: "LG.sismo.peso" }),
        ln("R", n2(s.R, 1), "norma", { fuente: "LG.sismo.sistema" }),
        ln("Cortante basal V", t2(s.V_kgf), "medido", { nota: "C/R = " + n2(s.CR_usado, 3) })
      ]));
    }
    return F;
  }

  function avisosLongitudinal(lo) {
    const L = [];
    if (!lo || !lo.ok || !lo.diseno) return L;
    const no = lo.diseno.piezas.filter((x) => !x.faltanEsenciales && !x.cumple);
    const falta = lo.diseno.piezas.filter((x) => x.faltanEsenciales);
    if (no.length) {
      L.push({ nivel: "error", que: "A lo largo · " + no.length + " pieza(s) no cumplen",
        porque: no.map((x) => x.pieza + (x.ratio !== null ? " (" + n2(x.ratio, 2) + ")" : "")).join(" · ") +
          ". Se cambia el perfil en la tabla de Geometría.", paso: "diseno" });
    }
    if (falta.length) {
      L.push({ nivel: "error", que: "A lo largo · " + falta.length + " pieza(s) con un control esencial sin hacer",
        porque: falta.map((x) => x.pieza + ": " + x.omitidos.filter((o) => o.esencial)[0].motivo).join(" · "),
        paso: "diseno" });
    }
    return L;
  }

  /* ---------- LA PLACA BASE: con las corridas, que son E.090 y segundo orden ---------- */
  function faltanPlaca(c) {
    const F = [];
    const n = (k) => c[k] > 0;
    if (!n("placaB_cm") || !n("placaN_cm")) F.push({ campo: "ci_plb", que: "las medidas de la placa base" });
    if (!n("pernoF_cm")) F.push({ campo: "ci_pf", que: "dónde van las filas de pernos" });
    if (!(c.pernosFila >= 1)) F.push({ campo: "ci_pnf", que: "cuántos pernos van en cada fila" });
    if (!(c.pernosFila === 1 || n("pernoSep_cm"))) F.push({ campo: "ci_psep", que: "la separación entre pernos" });
    if (!c.pernoD) F.push({ campo: "ci_pd", que: "el diámetro de los pernos" });
    if (!c.pernoMat) F.push({ campo: "ci_pmat", que: "el acero de los pernos" });
    if (!n("pernoLd_cm")) F.push({ campo: "ci_pld", que: "la longitud embebida de los pernos" });
    if (!c.electrodo) F.push({ campo: "ci_elec", que: "el electrodo de la soldadura" });
    if (!n("llaveL_cm") || !n("llaveH_cm") || !n("llaveT_cm")) {
      F.push({ campo: "ci_lll", que: "la llave de corte: los pernos no toman el cortante (fila J.anclaje.solo.traccion)" });
    }
    if (!(c.grout_cm >= 0)) F.push({ campo: "ci_grout", que: "el espesor del grout" });
    return F;
  }

  function placaBase(m3, r, modelo, perfiles, c, ped, z, casosLargo) {
    const g = AN.geometria(m3, r.sistema, r.eje);
    const secDe = seccionDesde(modelo, perfiles);
    const mat = AC.ACEROS[modelo.sitio.acero], matP = AC.ACEROS[c.pernoMat];
    const dp = CX.diametro(c.pernoD);
    const A2 = PB.A2DesdePedestal({ B_cm: c.placaB_cm, N_cm: c.placaN_cm, pedB_cm: c.pedB_cm, pedL_cm: c.pedL_cm });
    const filas = [];
    let col = null, sec = null;
    for (const ap of g.apoyos) {
      col = g.columnas.filter((x) => x.i === ap.nudo || x.j === ap.nudo)[0];
      sec = secDe(col.de ? { id: col.de, clase: "columna" } : col);
      for (const f of r.corridas) {
        const fz = f.fuerzas[col.id];
        const M = col.i === ap.nudo ? fz.Mi_kgfcm : fz.Mj_kgfcm;
        const m = PB.momento({ Pu_kgf: -fz.Pr_kgf, Mu_kgfcm: M || 0, d_cm: sec.d_cm, bf_cm: sec.bf_cm,
          tf_cm: sec.tf_cm, tw_cm: sec.tw_cm, B_cm: c.placaB_cm, N_cm: c.placaN_cm, fc_kgcm2: c.fc_kgcm2,
          A2_cm2: A2.A2_cm2, Fy_kgcm2: mat.Fy, t_cm: c.placaT_cm, f_cm: c.pernoF_cm, nPorLado: c.pernosFila,
          db_cm: dp.d_cm, Fy_perno_kgcm2: matP.Fy, Fu_perno_kgcm2: matP.Fu });
        filas.push({ combo: f.id, base: ap.nudo.split("@")[0], H_kgf: fz.Vr_kgf || 0, m: m });
      }
    }
    /* LO QUE LLEGA A LO LARGO · fila ZT.placa.cruz: las corridas del pórtico no llevan el tirón de
       la cruz ni el Hz del hastial, así que se añaden las combinaciones de la E.090 con los casos de
       la zapata, en PRIMER orden (a lo largo no hay B2 que amplifique: lo lleva la cruz) */
    if (casosLargo) {
      const fam = CB.paraAcero({ casos: { D: true, Lr: true, W: true, E: true } }).combinaciones;
      const largo = casosLargo.filter((x) => (x.tipo === "W" && x.direccion === "longitudinal") || x.id.indexOf("EL") === 0);
      const deTipo = (t) => casosLargo.filter((x) => x.tipo === t)[0];
      for (const cb of fam) {
        const tW = cb.terminos.filter(([k]) => k === "W" || k === "E")[0];
        if (!tW) continue;
        for (const v of largo.filter((x) => x.tipo === tW[0])) {
          for (const ap of g.apoyos) {
            const b = ap.nudo.split("@")[0];
            let P = 0, M = 0, Hx = 0, Hz = 0;
            for (const [k, f] of cb.terminos) {
              const cs = (k === tW[0]) ? v : deTipo(k);
              if (!cs) continue;
              const rr = cs.reacciones[b];
              const ff = (k === tW[0]) ? Math.abs(f) : f;
              P += ff * rr.Ry_kgf; M += ff * rr.Mz_kgfcm; Hx += ff * rr.Rx_kgf; Hz += ff * (rr.Rz_kgf || 0);
            }
            const m = PB.momento({ Pu_kgf: P, Mu_kgfcm: M, d_cm: sec.d_cm, bf_cm: sec.bf_cm,
              tf_cm: sec.tf_cm, tw_cm: sec.tw_cm, B_cm: c.placaB_cm, N_cm: c.placaN_cm, fc_kgcm2: c.fc_kgcm2,
              A2_cm2: A2.A2_cm2, Fy_kgcm2: mat.Fy, t_cm: c.placaT_cm, f_cm: c.pernoF_cm, nPorLado: c.pernosFila,
              db_cm: dp.d_cm, Fy_perno_kgcm2: matP.Fy, Fu_perno_kgcm2: matP.Fu });
            filas.push({ combo: cb.id + " · " + v.id + " (primer orden)", base: b, H_kgf: Math.hypot(Hx, Hz), m: m,
              aLoLargo: true });
          }
        }
      }
    }
    const peor = (k) => filas.reduce((a, x) => (k(x) > k(a) ? x : a));
    const pApl = peor((x) => x.m.ratioAplastamiento);
    const pT = peor((x) => x.m.placa.Mu_kgfcm_cm);
    const pPer = peor((x) => (x.m.pernos ? x.m.pernos.ratio : 0));
    const pSol = peor((x) => x.m.soldadura.Ff_kgf);
    const pH = peor((x) => x.H_kgf);
    /* la soldadura: el tamaño que hace falta, contra el mínimo y el máximo */
    const Lw = pSol.m.soldadura.L_cm;
    const porMm = CX.filete({ w_mm: 1, L_cm: Lw, electrodo: c.electrodo }).phiRnPorCm_kgf;
    const tPlaca = c.placaT_cm > 0 ? c.placaT_cm : pT.m.placa.t_cm;
    const tam = CX.tamanosFilete({ t1_mm: sec.tf_cm * 10, t2_mm: tPlaca * 10, tBorde_mm: sec.tf_cm * 10,
      sistema: CX.sistemaDe(sec) });
    const wReq = pSol.m.soldadura.Ff_kgf / (Lw * porMm);
    const w = Math.ceil(Math.max(wReq, tam.wMin_mm) - 1e-9);
    const soldadura = { Ff_kgf: pSol.m.soldadura.Ff_kgf, L_cm: Lw, wReq_mm: wReq, w_mm: w, wMin_mm: tam.wMin_mm,
      wMax_mm: tam.wMax_mm, cumple: w <= tam.wMax_mm, combo: pSol.combo, base: pSol.base,
      art: ART["J.base.momento.soldadura"] };
    /* la llave de corte */
    const llave = pH.H_kgf > 0 ? PB.llaveDeCorte({ Hu_kgf: pH.H_kgf, fc_kgcm2: c.fc_kgcm2, l_cm: c.llaveL_cm,
      h_cm: c.llaveH_cm, t_cm: c.llaveT_cm, Fy_kgcm2: mat.Fy, grout_cm: c.grout_cm }) : null;
    /* la geometría de los pernos, y si caben */
    const ancho = (c.pernosFila - 1) * (c.pernoSep_cm || 0);
    const alBorde = Math.min(c.pedL_cm / 2 - c.pernoF_cm, (c.pedB_cm - ancho) / 2);
    const geo = PB.geometriaAnclajes({ db_cm: dp.d_cm, separacion_cm: c.pernosFila > 1 ? c.pernoSep_cm : undefined,
      alBorde_cm: alBorde, Ld_cm: c.pernoLd_cm, fc_kgcm2: c.fc_kgcm2 });
    const fondo = z ? (Math.max(0, c.Df_cm - z.zapata.h_cm) + c.sobreTerreno_cm + z.zapata.h_cm - c.rec_cm) : null;
    const fallas = [];
    if (pApl.m.ratioAplastamiento > 1 + 1e-9) fallas.push("aplastamiento bajo la placa");
    if (c.placaT_cm > 0 && pT.m.placa.ratio > 1 + 1e-9) fallas.push("espesor de la placa");
    if (pPer.m.pernos && !pPer.m.pernos.cumple) fallas.push("pernos a tracción");
    if (!soldadura.cumple) fallas.push("soldadura");
    if (llave && llave.cumple === false) fallas.push("llave de corte");
    const conHz = filas.some((x) => x.aLoLargo);
    if (!geo.cumpleTodas) fallas.push("geometría de los pernos");
    if (ancho >= c.placaB_cm) fallas.push("los pernos no caben en la placa");
    if (fondo !== null && c.pernoLd_cm > fondo) fallas.push("el perno no cabe en el pedestal y la zapata");
    return { seccion: sec.nombre, d_cm: sec.d_cm, bf_cm: sec.bf_cm, tf_cm: sec.tf_cm,
      B_cm: c.placaB_cm, N_cm: c.placaN_cm, tDado_cm: c.placaT_cm > 0 ? c.placaT_cm : null,
      A2: A2, aplastamiento: pApl, espesor: pT, pernos: pPer, soldadura: soldadura, llave: llave, geometria: geo,
      alBorde_cm: alBorde, fondo_cm: fondo, filas: filas, fallas: fallas, cumple: !fallas.length, conHz: conHz,
      pernoD: c.pernoD, pernosFila: c.pernosFila, pernoF_cm: c.pernoF_cm, pernoSep_cm: c.pernoSep_cm };
  }

  /* El dibujo de la zapata en cm: la sección en el plano del pórtico con la
     presión de la combinación de servicio que manda, y la planta con las barras.
     La plantilla solo lo escala. */
  function dibujoCimentacion(cz) {
    const z = cz.z, p = z.servicio.peor, c = z.concreto;
    const d = cz.datos;
    /* la sección en el plano del pórtico, por el borde más cargado en B si hay momento a lo largo */
    const pr = ZA.presion2(p.N, p.e, p.ey || 0, z.zapata.B_cm, z.zapata.L_cm);
    const L = z.zapata.L_cm, puntos = [];
    const yb = (p.ey || 0) === 0 ? 0 : Math.sign(p.ey) * z.zapata.B_cm / 2;
    if (pr.q2) for (let i = 0; i <= 40; i++) { const x = -L / 2 + L * i / 40; puntos.push([x, pr.q2(x, yb)]); }
    return {
      B: z.zapata.B_cm, L: L, h: z.zapata.h_cm, Df: d.Df_cm, sobre: d.sobreTerreno_cm,
      pedB: d.pedB_cm, pedL: d.pedL_cm,
      presion: { puntos: puntos, qmax: p.qmax, admisible: p.admisible, combo: p.combo, base: p.base,
        forma: p.forma || (p.vuelca ? "vuelca: la resultante cae fuera" : "se levanta"), cumple: p.ratio <= 1 },
      barrasL: c.aceroL && !c.aceroL.insuficiente ? c.aceroL.n : 0,
      barrasB: c.aceroB && !c.aceroB.insuficiente ? c.aceroB.n : 0,
      barrasSup: c.aceroSup && !c.aceroSup.insuficiente ? c.aceroSup.n : 0,
      rec: d.rec_cm, cumple: z.cumple,
      pedestal: cz.ped ? { nb: cz.ped.seccion.nb, ns: cz.ped.seccion.ns, aEje: cz.ped.seccion.aEje_cm,
        gancho: cz.ped.anclaje.l_cm } : null,
      placa: cz.placa && !cz.placa.sinPerfil ? { B: cz.placa.B_cm, N: cz.placa.N_cm,
        t: cz.placa.hastial ? (cz.datos.placaT_cm || (cz.placa.r && cz.placa.r.espesor ? cz.placa.r.espesor.t_cm : 1))
          : (cz.placa.tDado_cm || cz.placa.espesor.m.placa.t_cm),
        f: cz.datos.pernoF_cm, n: cz.datos.pernosFila, sep: cz.datos.pernoSep_cm || 0,
        Ld: cz.datos.pernoLd_cm } : null
    };
  }

  const cm2 = (x) => n2(x, 2) + " cm²";
  const ok = (x) => (x ? "ok" : "no");

  function fichasPedestal(p) {
    const s = p.seccion, fx = p.flexocompresion, e = p.estribos, fr = p.friccion, an = p.anclaje;
    const L = [
      /* lo largo en la etiqueta y lo corto en el valor: el valor no parte línea */
      ln("Armado: " + s.nb + " por cara y " + s.ns + " por lado", s.n + " Ø" + s.barra + "\"",
        p.auto ? "medido" : "entrada"),
      ln("Cuantía entre 1 % y 6 %", n2(p.cuantia.rho * 100, 2) + " %", "norma",
        { fuente: "PD.rho", estado: ok(p.cuantia.cumple) }),
      ln("Flexocompresión, " + (fx.donde === "junta" ? "en la junta" : "arriba"), n2(fx.ratio, 3), "norma",
        { fuente: "PD.compatibilidad", estado: ok(fx.ratio <= 1),
          nota: fx.combo + " · base " + fx.base + " · Pu " + t2(fx.Pu_kgf) + " · Mu " + tm(fx.Mu_kgfcm) }),
      ln("Estribos", "Ø" + e.estribo + " @ " + e.s_cm + " cm", "norma",
        { fuente: "PD.Vs", estado: ok(e.cumple), nota: e.porQue + " · y arriba, " + e.arriba }),
      ln("Cortante en la junta", n2(fr.ratio, 3), "norma", { fuente: "PD.friccion", estado: ok(fr.ratio <= 1),
        nota: "μ = " + n2(fr.mu, 1) + " · Avf " + cm2(fr.AvfEficaz_cm2) + " · " + fr.combo }),
      ln("Anclaje de las barras en la zapata", n2(an.l_cm, 1) + " cm", "norma",
        { fuente: "PD.anclaje.zapata", estado: an.cumple === false ? "no" : "ok",
          nota: "manda " + (an.manda === "compresión" ? "ℓdc" : "el gancho ℓdg") + " · pide h ≥ " +
            n2(an.hMin_cm, 1) + " cm de zapata" }),
      ln("Recubrimiento", n2(p.recubrimiento.estribo_cm, 1) + " cm al estribo", "entrada",
        { estado: ok(p.recubrimiento.cumple), nota: "mín. 4 cm, y 5 cm a la barra si es de 3/4\" o más (§7.7.1 b)" })
    ];
    if (!p.esbeltez.esPedestal) {
      L.push(ln("Esbeltez k·ℓu/r", n2(Math.max(p.esbeltez.kLr_plano, p.esbeltez.kLr_fuera), 1), "norma",
        { fuente: "PD.esbeltez", estado: ok(p.esbeltez.cumple), nota: "altura/lado " + n2(p.esbeltez.relacion, 2) +
          " > 3: ya no es pedestal" }));
    }
    if (!p.separacion.cumple) {
      L.push(ln("las barras no caben con 1,5·db y 40 mm libres", "NO CABEN", "medido", { estado: "no" }));
    }
    return [ficha("El pedestal", "columna corta a flexocompresión · E.060", L, p.cumple ? "bien" : null)];
  }

  function fichasViga(v, sitio, c) {
    if (!v.exigida) {
      return [ficha("Vigas de conexión", "E.030 Art. 65.1", [ln("Se exigen", "no", "norma", { fuente: "Z.conexion",
        estado: "ok", nota: "suelo " + (sitio.suelo || "—") + " en la zona " + (zonaDe(sitio) || "—") + " y presión admisible " +
          n2(c.sigmaAdm_kgfcm2, 2) + " kgf/cm² (el límite es " + n2(v.sigmaLimite_kgfcm2, 2) + ")" })])];
    }
    const L = [ln("Se exigen", "sí", "norma", { fuente: "Z.conexion", nota: v.porSuelo ? "suelo " + sitio.suelo +
      " en la zona " + zonaDe(sitio) : "presión admisible menor que 0,10 MPa" })];
    if (v.falta) {
      L.push(ln(v.falta, "FALTA", "medido", { estado: "no" }));
    } else {
      L.push(ln("Fuerza: 10 % de la carga de la columna", t2(v.F_kgf), "norma", { fuente: "Z.conexion",
        nota: "Pu = " + t2(v.Pu_kgf) + ", a tracción y a compresión" }));
      L.push(ln("Acero", v.n + " Ø" + v.barra + "\"", "norma", { fuente: "Z.conexion.diseno",
        nota: "hacen falta " + cm2(Math.max(v.As_traccion_cm2, v.As_min_cm2)) + " (manda " +
          (v.As_min_cm2 >= v.As_traccion_cm2 ? "el 1 %" : "la tracción") + ")" }));
      L.push(ln("Compresión", n2(v.ratioCompresion, 3), "norma", { fuente: "Z.conexion.diseno", estado: ok(v.cumple),
        nota: v.nota }));
    }
    return [ficha("Vigas de conexión", "E.030 Art. 65.1 · en las dos direcciones", L, v.falta || !v.cumple ? null : "bien")];
  }

  function fichasPlacaHastial(q) {
    const L = [ln("Placa B × N", n2(q.B_cm, 0) + " × " + n2(q.N_cm, 0) + " cm", "entrada", { nota: "bajo " + q.seccion }),
      ln("Compresión 1,2·D", t2(q.Pu_kgf), "medido"), ln("Cortante 1,3·W en la llave", t2(q.Hu_kgf), "medido")];
    const r = q.r;
    if (r && r.compresion) {
      L.push(ln("Aplastamiento del concreto", n2(r.compresion.ratio, 3), "norma", { fuente: "J.base.phi",
        estado: ok(r.compresion.cumple) }));
      L.push(ln("Espesor que hace falta", n2(r.espesor.t_cm, 2) + " cm", "norma", { fuente: "J.base.momento.t",
        nota: r.espesor.metodo }));
    }
    if (r && r.cortante) {
      L.push(ln("Llave de corte · aplastamiento", n2(r.cortante.aplastamiento.ratio, 3), "norma",
        { fuente: "J.llave.aplast", estado: ok(r.cortante.aplastamiento.cumple) }));
      if (r.cortante.flexion) L.push(ln("Llave de corte · flexión", n2(r.cortante.flexion.ratio, 3), "norma",
        { fuente: "J.llave.flexion", estado: ok(r.cortante.flexion.cumple) }));
    }
    for (const f of q.fallas) L.push(ln(f, "NO", "medido", { estado: "no" }));
    return [ficha("La placa de la columna hastial", "compresión y cortante, sin momento · articulada", L,
      q.cumple ? "bien" : null)];
  }

  function fichasPlaca(q) {
    if (q.hastial) return fichasPlacaHastial(q);
    const ap = q.aplastamiento.m, es = q.espesor.m.placa, pe = q.pernos.m.pernos, so = q.soldadura;
    const L = [
      ln("Placa B × N", n2(q.B_cm, 0) + " × " + n2(q.N_cm, 0) + " cm", "entrada", { nota: "bajo " + q.seccion }),
      ln("Aplastamiento del concreto", n2(ap.ratioAplastamiento, 3), "norma", { fuente: "J.base.phi",
        estado: ok(ap.ratioAplastamiento <= 1), nota: q.aplastamiento.combo + " · " + ap.caso +
          " · fp = " + n2(ap.fp_kgcm2, 1) + " kgf/cm²" }),
      q.tDado_cm ? ln("Espesor de la placa", n2(es.ratio, 3), "norma", { fuente: "J.base.momento.t",
        estado: ok(es.ratio <= 1), nota: "t = " + n2(q.tDado_cm, 2) + " cm · hace falta " + n2(es.t_cm, 2) + " cm" })
        : ln("Espesor que hace falta", n2(es.t_cm, 2) + " cm", "norma", { fuente: "J.base.momento.t",
          nota: es.gobierna + " · con el elástico de McCormac saldría " + n2(es.tElastico_cm, 2) + " cm" }),
      pe ? ln("Pernos a tracción", n2(pe.ratio, 3), "norma", { fuente: "J.anclaje.acero", estado: ok(pe.cumple),
        nota: q.pernosFila + " Ø" + q.pernoD + "\" por fila · " + t2(pe.porPerno_kgf) + " por perno · manda la " +
          pe.gobierna + " · " + q.pernos.combo })
        : ln("Pernos a tracción", "no tiran", "medido", { nota: "la resultante cae siempre dentro de los patines" }),
      ln("Soldadura columna-placa", "filete de " + so.w_mm + " mm", "norma", { fuente: "J.base.momento.soldadura",
        estado: ok(so.cumple), nota: "hacen falta " + n2(so.wReq_mm, 1) + " mm · mín. " + so.wMin_mm + ", máx. " +
          n2(so.wMax_mm, 1) + " · " + t2(so.Ff_kgf) + " por patín en " + n2(so.L_cm, 1) + " cm" })
    ];
    if (q.llave) {
      L.push(ln("Llave de corte · aplastamiento", n2(q.llave.aplastamiento.ratio, 3), "norma",
        { fuente: "J.llave.aplast", estado: ok(q.llave.aplastamiento.cumple), nota: "Hu " + t2(q.llave.Hu_kgf) }));
      L.push(ln("Llave de corte · flexión", n2(q.llave.flexion.ratio, 3), "norma",
        { fuente: "J.llave.flexion", estado: ok(q.llave.flexion.cumple) }));
    }
    L.push(ln("Distancia de los pernos al borde del pedestal", n2(q.alBorde_cm, 1) + " cm", "norma",
      { fuente: "J.anclaje.geometria", estado: ok(q.geometria.cumpleTodas),
        nota: "reglas de 1983: el anclaje queda PLAUSIBLE, el cono sigue sin verificar (fila J.anclaje.concreto)" }));
    for (const f of q.fallas.filter((x) => /caben|cabe en/.test(x))) L.push(ln(f, "NO", "medido", { estado: "no" }));
    return [ficha("La placa base", "con las combinaciones de la E.090 y el segundo orden del análisis", L,
      q.cumple ? "bien" : null)];
  }
  function fichasCimentacion(z) {
    const s = z.servicio.peor, l = z.levantamiento, c = z.concreto;
    const F = [];
    F.push(ficha("La zapata", z.auto ? "medidas buscadas: las mínimas que cumplen" : "medidas dadas", [
      ln("B × L × h", n2(z.zapata.B_cm, 0) + " × " + n2(z.zapata.L_cm, 0) + " × " + n2(z.zapata.h_cm, 0) + " cm",
        z.auto ? "medido" : "entrada"),
      ln("Peso de zapata + pedestal", t2(z.pesos.zapata + z.pesos.pedestal), "medido"),
      ln("Peso del relleno encima", t2(z.pesos.relleno), "medido",
        { nota: "contra el levantamiento, y cargando los volados" })
    /* lo largo va en la etiqueta y la palabra corta en el valor: el valor no parte línea */
    ].concat(z.cumple ? [] : [ln(z.fallas.join(" · "), "NO CUMPLE", "medido", { estado: "no" })]),
    z.cumple ? "bien" : null));
    F.push(ficha("El suelo, en servicio", "sin tracción · +30 % con viento o sismo", [
      ln("Presión admisible neta", n2(z.sigmaN, 3) + " kgf/cm²", "norma", { fuente: "Z.sigma.neta" }),
      ln("Presión máxima", s.qmax ? n2(s.qmax, 3) + " kgf/cm²" : "—", "medido",
        { nota: s.combo + " · base " + s.base + " · " + (s.forma || (s.vuelca ? "VUELCA" : "se levanta")) }),
      ln("Contra la admisible", n2(s.admisible, 3) + " kgf/cm²", "norma",
        { fuente: "Z.inc30", estado: s.ratio <= 1 ? "ok" : "no" }),
      (Math.abs(s.eB || 0) > 1e-9
        ? ln("Excentricidad e/L · e/B", n2(Math.abs(s.eL), 3) + " · " + n2(Math.abs(s.eB), 3), "medido",
          { nota: s.vuelca ? "la resultante cae fuera de la base: vuelca"
            : (Math.abs(s.eL) + Math.abs(s.eB) > 1 / 6 ? "fuera del núcleo: parte de la base no apoya (" +
              (s.forma || "") + ")" : "dentro del núcleo: apoya entera") })
        : ln("Excentricidad e/L", n2(Math.abs(s.eL), 3), "medido",
          { nota: s.vuelca ? "más de L/2: la resultante cae fuera de la base, la zapata vuelca"
            : (Math.abs(s.eL) > 1 / 6 ? "más de L/6: presión triangular, parte de la base no apoya"
              : "dentro del tercio central") })),
      (isFinite(z.volteo.fs)
        ? ln("Volteo con sismo, FS", n2(z.volteo.fs, 2), "norma", { fuente: "Z.volteo.E030", estado: ok(z.volteo.cumple),
          nota: "mínimo 1,2 · " + z.volteo.combo + " en " + z.volteo.direccion + ", sin el 0,8" })
        : ln("Volteo con sismo", "sin sismo", "medido", { nota: "a esta zapata no le llega sismo" })),
      ln("Deslizamiento μ·N/H", z.servicio.deslizamiento ? n2(z.servicio.deslizamiento.deslizamiento, 2) : "sin μ",
        "medido", { nota: "la E.060 no fija factor: lo decide el estudio de suelos (fila Z.deslizamiento)" })
    ]));
    F.push(ficha("Levantamiento", "0,9·(D + zapata + pedestal + relleno) contra el viento y el sismo", [
      ln("Lo que tira hacia arriba / lo que sujeta", l.combo ? n2(l.ratio, 3) : "nada tira", "norma",
        { fuente: "Z.levantamiento", estado: l.ratio <= 1 ? "ok" : "no", nota: l.combo || null }),
      ln("Resultante amplificada dentro de la base", z.vuelcoAmplificado.length ? "cae fuera en " +
        z.vuelcoAmplificado.length : "en todas", "norma", { fuente: "Z.vuelco",
        estado: z.vuelcoAmplificado.length ? "no" : "ok",
        nota: z.vuelcoAmplificado.length ? z.vuelcoAmplificado[0].combo + " · base " + z.vuelcoAmplificado[0].base : null })
    ]));
    const ac = (a, nom) => a.insuficiente ? ln("Acero " + nom, "peralte insuficiente", "medido", { estado: "no" })
      : ln("Acero " + nom, a.n + " Ø" + a.barra + "\" @ " + n2(a.s, 0) + " cm", "norma",
        { fuente: { "mínimo": "Z.As.min", "separación": "Z.s.max", "flexión": "Z.bloque" }[a.manda],
          nota: "As " + cm2(a.As) + " · manda " + { "mínimo": "el mínimo", "separación": "la separación máxima",
            "flexión": "la flexión" }[a.manda] + " (hacen falta " + cm2(Math.max(a.As_req, a.As_min)) + ") · Mu " + tm(a.Mu) });
    F.push(ficha("El concreto, con cargas amplificadas", "E.060 · secciones críticas en la cara del pedestal", [
      ln("Cortante como viga, L", n2(c.cortL.ratio, 3), "norma", { fuente: "Z.Vc.viga", estado: c.cortL.ratio <= 1 ? "ok" : "no" }),
      ln("Cortante como viga, B", n2(c.cortB.ratio, 3), "norma", { fuente: "Z.Vc.viga", estado: c.cortB.ratio <= 1 ? "ok" : "no" }),
      ln("Punzonamiento con momento", n2(c.punz.ratio, 3), "norma", { fuente: "Z.punzon.momento",
        estado: c.punz.ratio <= 1 ? "ok" : "no", nota: "γv = " + n2(c.punz.gv, 3) + " · momento transferido " + tm(c.punz.Mt) }),
      ac(c.aceroL, "en L"), ac(c.aceroB, "en B")].concat(c.aceroSup ? [ac(c.aceroSup, "arriba, en L")] : []).concat([
      ln("Peralte mínimo", n2(c.hMin, 1) + " cm", "norma", { fuente: "Z.peralte.min",
        estado: z.zapata.h_cm >= c.hMin - 1e-9 ? "ok" : "no" })
    ]).concat(c.franja ? [ln("Franja central (lado corto)", n2(c.franja.gs, 3) + " del acero", "norma",
      { fuente: "Z.franja", nota: c.franja.nota })] : [])));
    return F;
  }

  return {
    ART, DIRECCIONES, ACEROS, MODOS, PORTICOS, longitudinal, fichasLongitudinal, avisosLongitudinal, cadena,
    correas, fichasCorreas, avisosCorreas, conexiones, fichasConexiones, avisosConexiones, faltanUniones, CAMPOS_CARGAS, CAMPOS_ANALISIS, CAMPOS_DISENO, avisosResultados,
    TIPOS_ZAPATA, CAMPOS_CIMENTACION, leeCimentacion, casosZapata, valoresDeCimentacion, cimentacion, fichasCimentacion, dibujoCimentacion,
    leeSitio, valoresDeSitio, leeSistema, leeDiseno, valoresDeDiseno,
    CAMPOS_PROYECTO, leeProyecto, valoresDeProyecto, CAMPOS_EDIFICACION, leeEdificacion, valoresDeEdificacion,
    clasificacion, fichaEdificacion, fichaSitio, zonaDe, CAMPOS_MATERIALES, CAMPOS_PERMANENTES, fijosDatos, NORMAS, materiales, pendientes, faltanCimentacion,
    diseno, fichasDiseno, dibujoDiseno, tablaDiseno, lineasDiseno, nivelRatio,
    forma, cargas, seccionDesde, analisis, fichasAnalisis, tablaReacciones, dibujo, lineasFuerzas
  };
});
