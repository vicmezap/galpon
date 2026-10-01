/* =====================================================================
   placabase.js — la placa de apoyo y sus anclajes

   El diagrama la pone primero de E7 por una razón que no es de orden:
   «es la que decide el dimensionamiento del pedestal y la zapata».  El
   área de la placa fija el área de aplastamiento, los pernos fijan dónde
   tiene que haber jaula, y la llave de corte fija el peralte del pedestal.

   ─────────────────────────────────────────────────────────────────────
   AQUÍ SE JUNTAN EL ACERO Y EL CONCRETO, Y NO HABLAN EL MISMO IDIOMA.

   El concreto bajo la placa es UNA superficie física y tres normas la
   verifican con tres φ distintos (fila Z.tres.phi):

       AISC 360-22 J8   φc = 0,65        ← manda, fila J.base.phi
       E.090 §10.9      φc = 0,60        (dice hacerlo «en concordancia
                                          con la E.060», que da otro)
       E.060 §9.3.2.4   φ  = 0,70

   La fórmula la escriben IGUAL las tres.  Lo que cambia es el φ, y un φ
   va emparejado con los factores de carga de su propia norma: no se
   pueden mezclar.  La E.090 y el AISC usan los MISMOS factores —la E.090
   los copió de allí—, así que entre esos dos es solo diferencia de
   edición y manda el AISC.  El 0,70 de la E.060 va con 1,4CM+1,7CV y no
   es trasladable (fila J.costura).

   φc es parámetro, con el 0,65 por omisión, y el módulo DICE cuánto
   cambiaría la respuesta con los otros dos.  Esconder una diferencia del
   17 % detrás de un valor por omisión sería lo contrario de lo que este
   proyecto hace.

   ─────────────────────────────────────────────────────────────────────
   EL ESPESOR NO ESTÁ EN EL AISC 360-22.  J8 cubre el aplastamiento del
   concreto y nada más; el método del voladizo vive en el Manual y en el
   Design Guide 1, que no están en la carpeta (fila J.dg1).  Zapata 9.7 sí
   lo trae entero y CON DOS EJEMPLOS RESUELTOS, que es lo que lo hace
   verificable: la prueba reproduce sus 2,05 cm y sus 0,54 cm.

   Y son DOS métodos para dos situaciones físicas distintas, no dos
   fórmulas intercambiables (fila J.base.metodo).  Con la placa grande, la
   ménsula; con la placa pequeña, las líneas de fluencia.  Aplicar la
   ménsula con el voladizo negativo da un espesor —de elevar al cuadrado
   un número negativo— que parece razonable y no significa nada.  Por eso
   aquí no se elige a ojo: se elige por la geometría y se dice cuál salió.

   ─────────────────────────────────────────────────────────────────────
   EL CORTANTE NO LO TOMAN LOS PERNOS · fila J.anclaje.solo.traccion.  Los
   agujeros de la placa base son mucho mayores que los normales, para
   absorber la tolerancia de obra, así que el perno no toca el borde del
   agujero y no puede aplastar contra él hasta que la columna se haya
   movido.  Zapata lo dice en una línea: «los pernos de anclaje, entonces,
   solamente son diseñados para Tracción, ya que la Llave de Corte se
   encarga de Hu».  Así que aquí hay llave de corte, y si no la hay el
   módulo lo exige en vez de repartir el cortante entre los pernos.

   EL LADO DEL CONCRETO DEL ANCLAJE SIGUE PENDIENTE · fila
   J.anclaje.concreto.  Las reglas geométricas de Zapata —15d, 5d, 12d,
   Ld = 12d— se comprueban y son la segunda ruta documentada, pero
   cumplirlas hace el anclaje PLAUSIBLE, no verificado: son de 1983 y el
   arrancamiento del cono entró en el ACI 318 en 2002.  El módulo las
   comprueba y acto seguido declara que el cono sigue sin verificar.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./acero.js"));
  } else {
    raiz.PLACABASE = definir(raiz.INVENTARIO, raiz.ACERO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC) {
  "use strict";

  const ART = INV.declara("placabase.js", [
    "J.base.Pp1", "J.base.Pp2", "J.base.phi",
    "J.base.cantilever", "J.base.t", "J.base.lineas", "J.base.metodo",
    "J.anclaje.acero", "J.anclaje.concreto", "J.anclaje.phi",
    "J.anclaje.solo.traccion", "J.anclaje.geometria", "J.anclaje.horiz",
    "J.anclaje.E060.capacidad", "J.anclaje.E060.confinamiento",
    "J.llave.aplast", "J.llave.flexion",
    "J.costura", "J.dg1", "T.fluencia", "T.rotura",
    "J.base.A2", "J.base.momento.metodo", "J.base.momento.t", "J.base.momento.secciones",
    "J.base.momento.todo.traccion", "J.base.momento.soldadura"
  ]);

  /* Los tres φ de la misma superficie · filas J.base.phi y Z.tres.phi */
  const PHI_C = { AISC: 0.65, E090: 0.60, E060: 0.70 };
  const PHI_B = 0.90;       /* flexión de la placa · fluencia */
  const PHI_P = 0.60;       /* aplastamiento en la llave de corte · Zapata 9.8 */
  const PHI_T_FLUENCIA = 0.90;   /* tracción · fluencia en el área bruta */
  const PHI_T_ROTURA = 0.75;     /* tracción · rotura en la zona roscada */
  const FACTOR_ROSCA = 0.75;     /* Fnt = 0,75·Fu · Tabla J3.2, partes roscadas */

  function exige(cond, msg) { if (!cond) throw new Error("placabase: " + msg); }

  /* ---------- APLASTAMIENTO EN EL CONCRETO · AISC J8 -------------------- */
  function aplastamiento(d) {
    const A1 = d.B_cm * d.N_cm;
    const fc = d.fc_kgcm2;
    exige(d.B_cm > 0 && d.N_cm > 0, "la placa necesita B_cm y N_cm > 0");
    exige(fc > 0, "f'c tiene que ser > 0");
    const A2 = (d.A2_cm2 === undefined) ? A1 : d.A2_cm2;
    exige(A2 >= A1 - 1e-9,
      "A2 (" + A2.toFixed(0) + " cm²) no puede ser menor que A1 (" + A1.toFixed(0) +
      " cm²).\n  A2 es la superficie de apoyo, A1 la placa: la placa no puede ser\n" +
      "  mayor que el pedestal sobre el que apoya.");

    /* √(A2/A1) ≤ 2, que es lo mismo que el tope de 1,7·f'c·A1 */
    const raizBruta = Math.sqrt(A2 / A1);
    const raiz = Math.min(raizBruta, 2);
    const areaTotal = Math.abs(A2 - A1) < 1e-9;
    /* Pp SIN topar y Pn topado son dos números distintos, y conviene tener
       los dos: el primero dice cuánto daría el confinamiento si no hubiera
       tope, y el segundo es el que manda. Zapata los escribe los dos en el
       Ejemplo 9.4 —481,8 t y 192,6 t— y se ve de un vistazo que el premio
       por confinamiento se lo come el tope entero. */
    const Pp = 0.85 * fc * A1 * (areaTotal ? 1 : raizBruta);
    const tope = 1.7 * fc * A1;
    const Pn = Math.min(Pp, tope);

    const phi = (d.phi_c === undefined) ? PHI_C.AISC : d.phi_c;
    exige(phi > 0 && phi <= 1, "phi_c fuera de (0, 1]: llegó " + phi);

    const Pu = d.Pu_kgf;
    const out = {
      A1_cm2: A1, A2_cm2: A2,
      raizA2A1: raizBruta, raizUsada: raiz, topada: raizBruta > 2,
      areaTotal: areaTotal,
      Pp_kgf: Pp, tope_kgf: tope, Pn_kgf: Pn,
      phi_c: phi, phiPn_kgf: phi * Pn,
      art: areaTotal ? ART["J.base.Pp1"] : ART["J.base.Pp2"],
      artPhi: ART["J.base.phi"]
    };
    if (typeof Pu === "number") {
      exige(Pu >= 0, "aplastamiento() es el caso de COMPRESIÓN: Pu_kgf no puede ser " +
        "negativo. El levantamiento va por anclajes(), que es otro mecanismo.");
      out.Pu_kgf = Pu;
      out.ratio = Pu / out.phiPn_kgf;
      out.cumple = out.ratio <= 1 + 1e-12;
    }
    /* LO QUE CAMBIARÍA CON LOS OTROS DOS φ · no se esconde */
    out.conLosTresPhi = {};
    for (const k of Object.keys(PHI_C)) {
      out.conLosTresPhi[k] = { phi: PHI_C[k], phiPn_kgf: PHI_C[k] * Pn,
        ratio: (typeof Pu === "number") ? Pu / (PHI_C[k] * Pn) : null };
    }
    out.dispersionPhi = PHI_C.E060 / PHI_C.E090 - 1;
    return out;
  }

  /* Área de placa que hace falta, invirtiendo lo anterior.  Con A2
     desconocida se va a lo seguro: sin premio por confinamiento. */
  function areaNecesaria(d) {
    const fc = d.fc_kgcm2, Pu = d.Pu_kgf;
    exige(fc > 0 && Pu > 0, "areaNecesaria() necesita f'c y Pu > 0");
    const phi = (d.phi_c === undefined) ? PHI_C.AISC : d.phi_c;
    const premio = (d.raiz === undefined) ? 1 : Math.min(d.raiz, 2);
    return {
      A1_cm2: Pu / (phi * 0.85 * fc * premio),
      phi_c: phi, premio: premio,
      art: ART["J.base.Pp2"],
      nota: premio === 1
        ? "sin premio por confinamiento: con A2 desconocida es lo seguro"
        : "con √(A2/A1) = " + premio.toFixed(3)
    };
  }

  /* ---------- LOS VOLADIZOS · fila J.base.cantilever -------------------- */
  function voladizos(d) {
    exige(d.d_cm > 0 && d.bf_cm > 0, "voladizos() necesita d_cm y bf_cm del perfil");
    const m = (d.N_cm - 0.95 * d.d_cm) / 2;
    const n = (d.B_cm - 0.80 * d.bf_cm) / 2;
    return {
      m_cm: m, n_cm: n, mayor_cm: Math.max(m, n),
      gobierna: m >= n ? "m" : "n",
      hayVoladizo: m > 0 && n > 0,
      art: ART["J.base.cantilever"]
    };
  }

  /* ---------- ESPESOR, MÉTODO DEL VOLADIZO · fila J.base.t -------------- */
  function espesorVoladizo(d) {
    const v = voladizos(d);
    exige(v.hayVoladizo,
      "los voladizos salen m = " + v.m_cm.toFixed(2) + " cm y n = " + v.n_cm.toFixed(2) +
      " cm.\n  Con uno nulo o negativo NO HAY MÉNSULA QUE FLEXIONAR y este método no\n" +
      "  aplica: elevar al cuadrado un voladizo negativo da un espesor que parece\n" +
      "  razonable y no significa nada. Va por líneas de fluencia —" +
      "espesorLineas()—,\n  que es lo que " + ART["J.base.metodo"] + " manda para " +
      "placas poco cargadas.");
    const Fy = d.Fy_kgcm2, Pu = d.Pu_kgf;
    exige(Fy > 0, "espesorVoladizo() necesita Fy_kgcm2");
    exige(Pu > 0, "espesorVoladizo() necesita Pu_kgf > 0");
    const phib = (d.phi_b === undefined) ? PHI_B : d.phi_b;
    const t = Math.sqrt(2 * Pu * v.mayor_cm * v.mayor_cm /
      (phib * d.B_cm * d.N_cm * Fy));
    return {
      metodo: "voladizo", m_cm: v.m_cm, n_cm: v.n_cm,
      gobierna: v.gobierna, l_cm: v.mayor_cm,
      presion_kgcm2: Pu / (d.B_cm * d.N_cm),
      phi_b: phib, t_cm: t,
      art: ART["J.base.t"], artVoladizo: ART["J.base.cantilever"]
    };
  }

  /* ---------- ESPESOR, LÍNEAS DE FLUENCIA · fila J.base.lineas ---------- */
  function espesorLineas(d) {
    exige(d.d_cm > 0 && d.bf_cm > 0 && d.tf_cm > 0,
      "espesorLineas() necesita d_cm, bf_cm y tf_cm del perfil");
    const Pu = d.Pu_kgf, fc = d.fc_kgcm2, Fy = d.Fy_kgcm2;
    exige(Pu > 0 && fc > 0 && Fy > 0, "espesorLineas() necesita Pu, f'c y Fy");
    const phic = (d.phi_c === undefined) ? PHI_C.AISC : d.phi_c;
    const phib = (d.phi_b === undefined) ? PHI_B : d.phi_b;

    /* la porción de carga directamente bajo la columna */
    const Po = Pu * (d.bf_cm * d.d_cm) / (d.B_cm * d.N_cm);
    /* el área H que hace falta, con el premio por confinamiento topado */
    const premio = (d.raiz === undefined) ? 2 : Math.min(d.raiz, 2);
    /* Ah se puede imponer: el proyectista puede querer un área H concreta, y
       además sirve para comprobar c y t por separado del redondeo de Po.
       Hace falta: el Ejemplo 9.5 de Zapata redondea Po de 24,79 a 24,73 t y
       eso le arrastra Ah de 115,7 a 115 y c de 1,251 a 1,24. Fijando Ah = 115
       salen SUS dos cifras exactas, que es la manera de demostrar que la
       diferencia es su redondeo y no un error de aquí. */
    const Ah = (d.Ah_cm2 === undefined) ? Po / (phic * 0.85 * fc * premio) : d.Ah_cm2;

    const s = d.d_cm + d.bf_cm - d.tf_cm;
    const bajoRaiz = s * s - 4 * (Ah - d.bf_cm * d.tf_cm);
    exige(bajoRaiz >= 0,
      "la raíz del método de líneas de fluencia sale negativa (" + bajoRaiz.toFixed(1) +
      ").\n  Significa que el área H que pide el concreto, " + Ah.toFixed(0) +
      " cm², no cabe alrededor\n  del perfil: hay que agrandar la placa o subir el f'c. " +
      "No es un fallo numérico,\n  es que la geometría no existe.");
    const c = 0.25 * (s - Math.sqrt(bajoRaiz));
    const t = Math.sqrt(2 * Po * c * c / (phib * Ah * Fy));
    return {
      metodo: "lineas de fluencia",
      Po_kgf: Po, Ah_cm2: Ah, premio: premio,
      c_cm: c, phi_b: phib, phi_c: phic, t_cm: t,
      art: ART["J.base.lineas"], artMetodo: ART["J.base.metodo"]
    };
  }

  /* ---------- EL QUE TOCA · fila J.base.metodo -------------------------- */
  function espesor(d) {
    /* EL CRITERIO ES EL DE ZAPATA Y NO EL QUE PARECE.  Primero escribí
       «hay voladizo si m > 0 y n > 0», y su Ejemplo 9.5 lo tumbó: ahí
       m = 1,5 cm y n = 3 cm, los dos positivos, y Zapata usa líneas de
       fluencia igualmente.  Lo que él mira es otra cosa, y la dice en el
       inciso c): «para aquellas planchas que reciben cargas relativamente
       pequeñas, LAS DIMENSIONES B Y N PUEDEN RESULTAR MENORES DE LAS
       DIMENSIONES b Y d».  O sea: la pregunta es si el concreto pide MÁS
       ÁREA DE LA QUE LA COLUMNA YA CUBRE.  Si pide menos, la placa se hace
       del tamaño del perfil por geometría —no por resistencia— y no hay
       ménsula de verdad que flexionar, aunque sobresalga unos centímetros.
         Ejemplo 9.4: el concreto pide 821 cm² y la huella es 400  -> ménsula
         Ejemplo 9.5: el concreto pide 281 cm² y la huella es 400  -> líneas
       El área se calcula SIN premio por confinamiento, que es como hace él
       el tanteo. */
    exige(d.fc_kgcm2 > 0, "espesor() necesita f'c para decidir el método");
    exige(d.d_cm > 0 && d.bf_cm > 0, "espesor() necesita d_cm y bf_cm");
    const phic = (d.phi_c === undefined) ? PHI_C.AISC : d.phi_c;
    const pedida = d.Pu_kgf / (phic * 0.85 * d.fc_kgcm2);
    const huella = d.bf_cm * d.d_cm;
    const hayMensula = pedida > huella;

    const v = voladizos(d);
    const r = hayMensula ? espesorVoladizo(d) : espesorLineas(d);
    r.areaPedida_cm2 = pedida;
    r.huellaColumna_cm2 = huella;
    r.m_cm = v.m_cm;
    r.n_cm = v.n_cm;
    r.porQueEsteMetodo = hayMensula
      ? "el concreto pide " + pedida.toFixed(0) + " cm² y la huella del perfil es " +
        huella.toFixed(0) + " cm²: la placa tiene que crecer por RESISTENCIA, " +
        "así que hay ménsula de verdad (m = " + v.m_cm.toFixed(2) + " cm, n = " +
        v.n_cm.toFixed(2) + " cm)"
      : "el concreto pide " + pedida.toFixed(0) + " cm² y la huella del perfil es " +
        huella.toFixed(0) + " cm²: la placa se hace del tamaño del perfil por " +
        "GEOMETRÍA, no por resistencia, así que no hay ménsula que flexionar " +
        "aunque sobresalga " + Math.min(v.m_cm, v.n_cm).toFixed(2) + " cm";
    r.artMetodo = ART["J.base.metodo"];
    return r;
  }

  /* ---------- LOS ANCLAJES A TRACCIÓN ----------------------------------
     Un perno de anclaje es un elemento en tracción y tiene los DOS estados
     límite de siempre: fluencia en el área bruta y rotura en la zona
     roscada.  Zapata comprueba los dos en el Ejemplo 9.6 y el AISC los
     tiene repartidos —D2(a) uno, Tabla J3.2 el otro (fila
     J.anclaje.acero)—, que es por lo que es fácil olvidar el primero. */
  function anclajesTraccion(d) {
    const n = d.nPernos;
    exige(n >= 1 && n === Math.round(n), "nPernos tiene que ser un entero ≥ 1");
    exige(d.db_cm > 0, "anclajesTraccion() necesita db_cm, el diámetro del perno");
    exige(d.Fy_perno_kgcm2 > 0 && d.Fu_perno_kgcm2 > 0,
      "anclajesTraccion() necesita Fy y Fu del perno");
    const Tu = d.Tu_kgf;
    exige(typeof Tu === "number" && Tu >= 0,
      "Tu_kgf es la tracción TOTAL de levantamiento, y no puede ser negativa.\n" +
      "  Si la combinación da compresión, el mecanismo es el aplastamiento y no\n" +
      "  hay nada que anclar por resistencia (sí por estabilidad de montaje).");

    /* El área se puede imponer. Hace falta por lo mismo que Ah en las líneas
       de fluencia: Zapata usa 1,25 cm² para un perno de ½" y el área exacta
       es 1,2668, así que sus 2,84 y 2,87 t salen un 1,3 % por debajo. Fijando
       Ab salen SUS cifras, y queda demostrado que la diferencia es su
       redondeo. Y de paso sirve para lo que sirve de verdad: un perno real
       se especifica a veces por área y no por diámetro. */
    const Ab = (d.Ab_cm2 === undefined) ? Math.PI * d.db_cm * d.db_cm / 4 : d.Ab_cm2;
    const porPerno = Tu / n;
    const fluencia = PHI_T_FLUENCIA * d.Fy_perno_kgcm2 * Ab;
    const rotura = PHI_T_ROTURA * FACTOR_ROSCA * d.Fu_perno_kgcm2 * Ab;
    const dis = Math.min(fluencia, rotura);
    return {
      nPernos: n, db_cm: d.db_cm, Ab_cm2: Ab,
      Tu_kgf: Tu, porPerno_kgf: porPerno,
      fluencia_kgf: fluencia, rotura_kgf: rotura,
      gobierna: fluencia <= rotura ? "fluencia en el área bruta" : "rotura en la rosca",
      disponible_kgf: dis,
      ratio: dis > 0 ? porPerno / dis : Infinity,
      cumple: porPerno <= dis + 1e-9,
      art: ART["J.anclaje.acero"],
      artFluencia: ART["T.fluencia"], artRotura: ART["T.rotura"],
      /* Y LO QUE ESTO NO ES */
      ladoConcretoVerificado: false,
      artConcreto: ART["J.anclaje.concreto"],
      nota: "ESTO ES SOLO EL LADO DEL ACERO. El arrancamiento del cono, la " +
        "extracción y el desprendimiento lateral son el ACI 318 Cap. 17 y siguen " +
        "sin ecuaciones en este proyecto."
    };
  }

  /* ---------- LAS REGLAS GEOMÉTRICAS · fila J.anclaje.geometria ---------
     Se comprueban y se dice exactamente qué valen: cumplirlas hace el
     anclaje plausible, no verificado. */
  function geometriaAnclajes(d) {
    exige(d.db_cm > 0, "geometriaAnclajes() necesita db_cm");
    const db = d.db_cm;
    const reglas = [];
    const pon = (que, exigido, hay, unidad) => {
      reglas.push({ que: que, exigido_cm: exigido, hay_cm: hay,
        cumple: hay === null ? null : hay >= exigido - 1e-9, unidad: unidad || "cm" });
    };
    pon("separación entre pernos, para que no se solapen los conos", 15 * db,
      d.separacion_cm === undefined ? null : d.separacion_cm);
    pon("distancia al borde, para no recortar el cono", Math.max(5 * db, 10),
      d.alBorde_cm === undefined ? null : d.alBorde_cm);
    if (d.sinLlaveDeCorte) {
      pon("distancia al borde con el cortante por los pernos", 12 * db,
        d.alBorde_cm === undefined ? null : d.alBorde_cm);
    }
    pon("longitud de anclaje", 12 * db,
      d.Ld_cm === undefined ? null : d.Ld_cm);

    const fcMin = 210;
    const fcOk = d.fc_kgcm2 === undefined ? null : d.fc_kgcm2 >= fcMin;
    const faltan = reglas.filter((r) => r.cumple === false);
    const sinDato = reglas.filter((r) => r.cumple === null);

    return {
      reglas: reglas, fcMinimo_kgcm2: fcMin, fcCumple: fcOk,
      cumpleTodas: faltan.length === 0 && fcOk !== false,
      faltan: faltan, sinDato: sinDato,
      art: ART["J.anclaje.geometria"],
      /* LO QUE ESTO SIGNIFICA Y LO QUE NO */
      conoVerificado: false,
      artConcreto: ART["J.anclaje.concreto"],
      nota: "Son reglas prescriptivas de 1983 —Shipp y Haninger, AISC Engineering " +
        "Journal— anteriores al Apéndice D del ACI 318-02. Cumplirlas hace el " +
        "anclaje PLAUSIBLE; el arrancamiento del cono sigue SIN VERIFICAR, y " +
        "decir lo contrario sería mentir con una fuente leída en la mano."
    };
  }

  /* ---------- LA LLAVE DE CORTE · filas J.llave.* ----------------------- */
  function llaveDeCorte(d) {
    const Hu = d.Hu_kgf;
    exige(typeof Hu === "number" && Hu > 0, "llaveDeCorte() necesita Hu_kgf > 0");
    exige(d.fc_kgcm2 > 0, "llaveDeCorte() necesita f'c");
    exige(d.l_cm > 0 && d.h_cm > 0, "la llave necesita l_cm (ancho) y h_cm (altura embebida)");
    const phip = (d.phi_p === undefined) ? PHI_P : d.phi_p;
    const phib = (d.phi_b === undefined) ? PHI_B : d.phi_b;
    const g = (d.grout_cm === undefined) ? 2.5 : d.grout_cm;
    exige(g >= 0, "el grout no puede tener espesor negativo");

    const fcu = Hu / (d.l_cm * d.h_cm);
    const fcAdm = phip * d.fc_kgcm2;
    const areaNec = Hu / fcAdm;

    const r = {
      Hu_kgf: Hu, l_cm: d.l_cm, h_cm: d.h_cm, grout_cm: g,
      aplastamiento: {
        fcu_kgcm2: fcu, admisible_kgcm2: fcAdm, phi_p: phip,
        areaNecesaria_cm2: areaNec,
        ratio: fcu / fcAdm, cumple: fcu <= fcAdm + 1e-9,
        art: ART["J.llave.aplast"]
      }
    };
    if (d.t_cm !== undefined) {
      exige(d.t_cm > 0 && d.Fy_kgcm2 > 0,
        "para la flexión de la llave hacen falta t_cm y Fy_kgcm2");
      const brazo = g + d.h_cm / 2;
      const Hres = phib * d.Fy_kgcm2 * d.l_cm * d.t_cm * d.t_cm / (4 * brazo);
      r.flexion = {
        t_cm: d.t_cm, brazo_cm: brazo, phi_b: phib,
        resistencia_kgf: Hres, ratio: Hu / Hres,
        cumple: Hu <= Hres + 1e-9,
        art: ART["J.llave.flexion"],
        nota: "el brazo incluye el grout: alarga el momento sin aportar nada"
      };
      r.cumple = r.aplastamiento.cumple && r.flexion.cumple;
    }
    r.artSoloTraccion = ART["J.anclaje.solo.traccion"];
    return r;
  }

  /* ---------- A2 DESDE EL PEDESTAL · fila J.base.A2 ---------------------
     «la mayor porción de la superficie de apoyo geométricamente semejante a
     la placa y concéntrica con ella»: el rectángulo de la placa agrandado
     hasta tocar el primer borde del pedestal. */
  function A2DesdePedestal(d) {
    exige(d.B_cm > 0 && d.N_cm > 0, "A2DesdePedestal() necesita la placa, B_cm y N_cm");
    exige(d.pedB_cm > 0 && d.pedL_cm > 0, "A2DesdePedestal() necesita el pedestal, pedB_cm y pedL_cm");
    exige(d.B_cm <= d.pedB_cm + 1e-9 && d.N_cm <= d.pedL_cm + 1e-9,
      "la placa (" + d.B_cm + " × " + d.N_cm + " cm) no cabe en el pedestal (" + d.pedB_cm + " × " +
      d.pedL_cm + " cm): A2 sería menor que A1 y el pedestal no la sostiene entera");
    const k = Math.min(d.pedB_cm / d.B_cm, d.pedL_cm / d.N_cm);
    return { A2_cm2: k * k * d.B_cm * d.N_cm, escala: k, art: ART["J.base.A2"] };
  }

  /* La presión bajo la placa sin tracción: trapecio o triángulo, con la
     resultante R a la distancia e del centro, hacia +x */
  function contacto(R, e, B, N) {
    const ae = Math.abs(e);
    exige(ae < N / 2, "la resultante de la compresión cae fuera de la placa (e = " + ae.toFixed(2) +
      " cm, N/2 = " + (N / 2).toFixed(2) + " cm): no hay presión que la equilibre");
    if (ae <= N / 6) {
      const q0 = R / (B * N);
      const qa = q0 * (1 - 6 * ae / N), qb = q0 * (1 + 6 * ae / N);
      return { forma: "trapecio", qmax: qb, qmin: qa, contacto_cm: N,
        q: (x) => qa + (qb - qa) * (x + N / 2) / N };
    }
    const a = 3 * (N / 2 - ae), qmax = 2 * R / (B * a);
    return { forma: "triángulo", qmax: qmax, qmin: 0, contacto_cm: a,
      q: (x) => { const t = x - (N / 2 - a); return t <= 0 ? 0 : qmax * t / a; } };
  }
  function integra(f, a, b) {
    if (!(b > a)) return 0;
    const n = 400, h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  }

  /* ---------- LA PLACA CON MOMENTO · filas J.base.momento.* ------------
     La columna empotrada del galpón le da a la placa P y M a la vez.  El AISC
     360-22 solo trae el aplastamiento (J8); cómo se reparte la presión y cómo
     entran los pernos es del Design Guide 1, que no está en la carpeta (fila
     J.dg1).  Lo que sí está es McCormac-Csernak, Apéndice D, con DOS ejemplos
     resueltos que la prueba reproduce:
       · e = M/P dentro de los patines: la placa entera comprime, presión lineal
         (trapecio o triángulo) y los pernos no trabajan (Ejemplo D-1)
       · e fuera: los pernos del otro lado tiran; la compresión se supone con
         su resultante en el centro del patín comprimido, repartida en
         triángulo, y la tracción sale de tomar momentos respecto a ese punto
         (Ejemplo D-2)
     El espesor NO es el de McCormac: él usa el módulo elástico (6·M/φFy) y el
     AISC F11-1 da a una barra rectangular su momento plástico, Fy·Z = Fy·t²/4
     por unidad de ancho, y el pandeo lateral no aplica a una placa que
     flexiona como losa (fila J.base.momento.t).  Es lo mismo que hace Zapata
     en la placa con carga axial, así que las dos fórmulas del módulo son
     coherentes.  El elástico se da al lado: sale un 22 % más grueso. */
  function momento(d) {
    const P = d.Pu_kgf, M = Math.abs(d.Mu_kgfcm || 0);
    exige(typeof P === "number", "momento() necesita Pu_kgf (+ compresión, − tracción)");
    exige(d.d_cm > 0 && d.bf_cm > 0 && d.tf_cm > 0, "momento() necesita d_cm, bf_cm y tf_cm del perfil");
    exige(d.B_cm > 0 && d.N_cm > 0, "momento() necesita la placa, B_cm y N_cm");
    exige(d.N_cm > d.d_cm, "la placa (N = " + d.N_cm + " cm) tiene que ser más larga que el perfil (d = " +
      d.d_cm + " cm) en la dirección del momento");
    exige(d.Fy_kgcm2 > 0, "momento() necesita el Fy de la placa");
    const B = d.B_cm, N = d.N_cm;
    const a = (d.d_cm - d.tf_cm) / 2;                   /* del eje al centro del patín */
    const phib = (d.phi_b === undefined) ? PHI_B : d.phi_b;

    /* el esfuerzo de aplastamiento que se permite, J8 */
    const ap = aplastamiento({ B_cm: B, N_cm: N, fc_kgcm2: d.fc_kgcm2, A2_cm2: d.A2_cm2, phi_c: d.phi_c });
    const fp = ap.phiPn_kgf / ap.A1_cm2;

    const out = { Pu_kgf: P, Mu_kgfcm: M, a_cm: a, fp_kgcm2: fp, aplastamiento: ap,
      art: ART["J.base.momento.metodo"] };
    let T = 0, C = 0, pr = null;
    const e = P > 0 ? M / P : Infinity;
    out.e_cm = P > 0 ? e : null;
    if (P > 0 && e <= a + 1e-12) {
      out.caso = "sin tracción en los pernos";
      out.porQue = "e = M/P = " + e.toFixed(2) + " cm cae dentro de los patines (" + a.toFixed(2) +
        " cm): la placa comprime entera o en parte, y los pernos no tiran";
      C = P;
      pr = contacto(P, e, B, N);
    } else {
      exige(d.f_cm > 0 && d.f_cm < N / 2, "con los pernos en tracción hace falta f_cm, la distancia del " +
        "eje de la columna a la fila de pernos, dentro de la placa");
      exige(d.nPorLado >= 1, "con los pernos en tracción hace falta nPorLado, los pernos de cada fila");
      const f = d.f_cm;
      T = (M - P * a) / (f + a);
      C = P + T;
      if (C > 1e-9) {
        out.caso = "pernos en tracción";
        out.porQue = (P > 0 ? "e = " + e.toFixed(2) + " cm sale de los patines (" + a.toFixed(2) + " cm)"
          : "la columna tira") + ": los pernos del otro lado tiran y la compresión se concentra " +
          "bajo el patín comprimido";
        pr = contacto(C, a, B, N);
      } else {
        /* la tracción neta puede más que el momento: tiran las dos filas · fila
           J.base.momento.todo.traccion, por equilibrio, y empalma con lo anterior en C = 0 */
        out.caso = "todo en tracción";
        out.porQue = "la columna tira más de lo que el momento comprime: tiran las dos filas de pernos";
        T = -P / 2 + M / (2 * f);
        out.T2_kgf = -P / 2 - M / (2 * f);
        C = 0;
        out.artTodo = ART["J.base.momento.todo.traccion"];
      }
      out.f_cm = f;
    }
    out.T_kgf = T;
    out.C_kgf = C;

    /* ---- el concreto ---- */
    if (pr) {
      out.presion = { forma: pr.forma, qmax_kgcm2: pr.qmax, qmin_kgcm2: pr.qmin, contacto_cm: pr.contacto_cm };
      out.ratioAplastamiento = pr.qmax / fp;
    } else {
      out.presion = null;
      out.ratioAplastamiento = 0;
    }

    /* ---- la placa · las tres secciones de McCormac, fila J.base.momento.secciones ---- */
    const Mc = pr ? integra((x) => pr.q(x) * (x - a), a, N / 2) : 0;
    const Mt = T > 0 && d.f_cm > a ? T * (d.f_cm - a) / B : 0;
    const n = (B - 0.80 * d.bf_cm) / 2;
    const Mn = pr && n > 0 ? (pr.qmax + pr.qmin) / 2 * n * n / 2 : 0;
    const Mp = Math.max(Mc, Mt, Mn);
    out.placa = {
      Mcompresion_kgfcm_cm: Mc, Mtraccion_kgfcm_cm: Mt, Mtransversal_kgfcm_cm: Mn, n_cm: n,
      gobierna: Mp === Mc ? "lado comprimido, en el centro del patín" :
        (Mp === Mt ? "lado de los pernos, en el centro del patín" : "dirección transversal, a 0,8·bf"),
      Mu_kgfcm_cm: Mp, phi_b: phib,
      t_cm: Math.sqrt(4 * Mp / (phib * d.Fy_kgcm2)),
      tElastico_cm: Math.sqrt(6 * Mp / (phib * d.Fy_kgcm2)),
      art: ART["J.base.momento.t"], artSecciones: ART["J.base.momento.secciones"]
    };
    if (d.t_cm !== undefined) {
      out.placa.tDado_cm = d.t_cm;
      out.placa.ratio = Mp / (phib * d.Fy_kgcm2 * d.t_cm * d.t_cm / 4);
    }

    /* ---- los pernos ---- */
    if (T > 0) {
      out.pernos = anclajesTraccion(Object.assign({}, d, { nPernos: d.nPorLado, Tu_kgf: T }));
      if (out.T2_kgf > 0) out.pernos.otraFila_kgf = out.T2_kgf;
    }

    /* ---- la soldadura columna-placa: la fuerza en cada patín · fila J.base.momento.soldadura ---- */
    out.soldadura = {
      Ff_kgf: M / (d.d_cm - d.tf_cm) + Math.max(0, -P) / 2,
      L_cm: 2 * d.bf_cm - (d.tw_cm || 0),
      art: ART["J.base.momento.soldadura"]
    };

    const ratios = [{ que: "aplastamiento del concreto", ratio: out.ratioAplastamiento }];
    if (out.placa.ratio !== undefined) ratios.push({ que: "flexión de la placa", ratio: out.placa.ratio });
    if (out.pernos) ratios.push({ que: "pernos a tracción", ratio: out.pernos.ratio });
    out.ratios = ratios;
    const peor = ratios.reduce((x, y) => (y.ratio > x.ratio ? y : x));
    out.gobierna = peor.que;
    out.ratioMaximo = peor.ratio;
    out.cumple = peor.ratio <= 1 + 1e-9;
    return out;
  }

  /* ---------- LA PLACA ENTERA ------------------------------------------
     Compresión y levantamiento son DOS casos y los dos se miran.  Si hay
     cortante y no hay llave, se exige: repartirlo entre los pernos sin
     decirlo es la forma silenciosa de equivocarse aquí. */
  function verifica(d) {
    const out = { art: ART["J.base.phi"], artCostura: ART["J.costura"] };

    if (typeof d.Pu_kgf === "number" && d.Pu_kgf > 0) {
      out.compresion = aplastamiento(d);
      out.espesor = espesor(d);
    }

    if (typeof d.Tu_kgf === "number" && d.Tu_kgf > 0) {
      out.levantamiento = anclajesTraccion(d);
      out.geometria = geometriaAnclajes(d);
    }

    if (typeof d.Hu_kgf === "number" && d.Hu_kgf > 0) {
      if (d.llave) {
        out.cortante = llaveDeCorte(Object.assign({}, d, d.llave));
      } else {
        throw new Error(
          "placabase: hay cortante en la base (Hu = " + (d.Hu_kgf / 1000).toFixed(2) +
          " tonf) y no hay llave de corte.\n" +
          "  Los pernos de anclaje NO lo toman: los agujeros de la placa base son\n" +
          "  mucho mayores que los normales —para absorber la tolerancia de obra— y\n" +
          "  el perno no toca el borde hasta que la columna se ha movido.\n" +
          "  " + ART["J.anclaje.solo.traccion"] + ": «los pernos de anclaje, entonces,\n" +
          "  solamente son diseñados para Tracción, ya que la Llave de Corte se\n" +
          "  encarga de Hu».\n" +
          "  Qué hacer: poner llave —llave: {l_cm, h_cm, t_cm}—, o soldar " +
          "arandelas-plancha\n  que puenteen el agujero (" + ART["J.anclaje.horiz"] +
          "), o ir por la\n  interacción tracción-corte de Zapata 9.8.1, que no está escrita aquí.");
      }
    }

    const ratios = [];
    if (out.compresion && out.compresion.ratio !== undefined) {
      ratios.push({ que: "aplastamiento del concreto", ratio: out.compresion.ratio });
    }
    if (out.levantamiento) {
      ratios.push({ que: "pernos a tracción", ratio: out.levantamiento.ratio });
    }
    if (out.cortante) {
      ratios.push({ que: "llave · aplastamiento", ratio: out.cortante.aplastamiento.ratio });
      if (out.cortante.flexion) {
        ratios.push({ que: "llave · flexión", ratio: out.cortante.flexion.ratio });
      }
    }
    out.ratios = ratios;
    if (ratios.length) {
      const peor = ratios.reduce((a, b) => (b.ratio > a.ratio ? b : a));
      out.gobierna = peor.que;
      out.ratioMaximo = peor.ratio;
      out.cumple = peor.ratio <= 1 + 1e-9;
    }

    /* LO QUE NO SE HA COMPROBADO, DICHO SIEMPRE */
    out.sinVerificar = [];
    if (out.levantamiento) {
      out.sinVerificar.push({
        que: "el lado del concreto del anclaje: arrancamiento del cono, extracción " +
          "y desprendimiento lateral",
        porque: ART["J.anclaje.concreto"],
        ruta: "por capacidad según " + ART["J.anclaje.E060.capacidad"] + ", con el " +
          "refuerzo lateral de " + ART["J.anclaje.E060.confinamiento"] + " y las " +
          "reglas geométricas de " + ART["J.anclaje.geometria"]
      });
    }
    return out;
  }

  return {
    ART, PHI_C, PHI_B, PHI_P, PHI_T_FLUENCIA, PHI_T_ROTURA, FACTOR_ROSCA,
    aplastamiento, areaNecesaria, voladizos, espesorVoladizo, espesorLineas,
    espesor, anclajesTraccion, geometriaAnclajes, llaveDeCorte, verifica,
    A2DesdePedestal, contacto, momento
  };
});
