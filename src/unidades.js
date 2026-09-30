/* =====================================================================
   unidades.js — la frontera del sistema de unidades

   EL SISTEMA CANÓNICO del complemento (fila de inventario: sección cargas):

       longitud geométrica ....... m        luces, alturas, separaciones
       dimensión de sección ...... cm       peraltes, anchos, espesores
       área ...................... cm²
       inercia ................... cm⁴
       módulo de sección ......... cm³
       fuerza .................... kgf      (t = 1000 kgf cuando es grande)
       esfuerzo .................. kg/cm²   Fy, Fu, E, f'c
       momento ................... kgf·m    en barras
                                   kgf·cm   dentro de la sección
       carga de superficie ....... kgf/m²
       carga de línea ............ kgf/m
       velocidad de viento ....... km/h     lo exige la E.020 Art. 12.3

   LA REGLA: la conversión ocurre UNA SOLA VEZ, al importar un catálogo.
   Aguas abajo no existe ninguna pulgada.  Este módulo es el único sitio del
   proyecto donde aparece un factor de conversión; si aparece otro en otro
   lado, es un error.

   POR QUÉ IMPORTA: en Retícula, el factor U de la E.030 se quedó fuera del
   peso sísmico y pasó desapercibido cinco meses porque con categoría Común
   valía 1,00.  Las columnas salían un tercio por debajo.  Un error de
   magnitud no se ve mirando el resultado: se ve si el nombre de la variable
   lleva su unidad y alguien lee la línea.

   Por eso la convención de nombres, que este módulo ayuda a sostener:

       A_cm2   Fy_kgcm2   L_m   Mn_kgcm   w_kgfm2   V_kmh

   Si lees `Mn_kgcm = Fy_kgcm2 * Z_cm3` sabes de un vistazo que está bien.
   Si lees `L_m * A_cm2` salta a la vista que está mal.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = definir();
  else raiz.UNIDADES = definir();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- factores exactos ----------------------------------------
     Todos son definiciones, no medidas.  La pulgada es exactamente 25,4 mm
     por acuerdo internacional desde 1959, y de ahí sale todo lo demás. */
  const PULGADA_CM = 2.54;                  /* exacto, por definición */
  const LIBRA_KGF = 0.45359237;             /* exacto, por definición */
  const PIE_CM = 12 * PULGADA_CM;           /* 30,48 */
  const KIP_KGF = 1000 * LIBRA_KGF;         /* 453,59237 */

  /* ---------- longitud ------------------------------------------------- */
  const in_a_cm = (v) => v * PULGADA_CM;
  const cm_a_in = (v) => v / PULGADA_CM;
  const m_a_cm = (v) => v * 100;
  const cm_a_m = (v) => v / 100;
  const mm_a_cm = (v) => v / 10;
  const cm_a_mm = (v) => v * 10;

  /* ---------- área, inercia, módulo ------------------------------------
     Se convierten con la potencia que les toca.  Parece obvio y es
     exactamente donde se equivoca todo el mundo: in² lleva 2,54², in⁴
     lleva 2,54⁴.  Por eso hay una función por cada una y no un factor
     suelto que alguien pueda aplicar al exponente equivocado. */
  const in2_a_cm2 = (v) => v * Math.pow(PULGADA_CM, 2);
  const in3_a_cm3 = (v) => v * Math.pow(PULGADA_CM, 3);
  const in4_a_cm4 = (v) => v * Math.pow(PULGADA_CM, 4);
  const in6_a_cm6 = (v) => v * Math.pow(PULGADA_CM, 6);   /* Cw, constante de alabeo */

  /* ---------- fuerza --------------------------------------------------- */
  const lb_a_kgf = (v) => v * LIBRA_KGF;
  const kip_a_kgf = (v) => v * KIP_KGF;
  const kgf_a_t = (v) => v / 1000;
  const t_a_kgf = (v) => v * 1000;

  /* ---------- esfuerzo -------------------------------------------------
     1 ksi = 1000 lbf/in² = 453,59237 kgf / 6,4516 cm² = 70,3069… kg/cm²
     1 MPa = 1 N/mm² = 10,19716 kg/cm² */
  const KSI_KGCM2 = KIP_KGF / Math.pow(PULGADA_CM, 2);      /* 70,30696… */
  const MPA_KGCM2 = 1 / 0.0980665;                          /* 10,19716… */
  const ksi_a_kgcm2 = (v) => v * KSI_KGCM2;
  const kgcm2_a_ksi = (v) => v / KSI_KGCM2;
  const mpa_a_kgcm2 = (v) => v * MPA_KGCM2;
  const kgcm2_a_mpa = (v) => v / MPA_KGCM2;

  /* ---------- peso por longitud ---------------------------------------- */
  const lbft_a_kgfm = (v) => (v * LIBRA_KGF) / (PIE_CM / 100);   /* lb/ft -> kgf/m */

  /* ---------- momento --------------------------------------------------
     Dentro de la sección se trabaja en kgf·cm y en la barra en kgf·m.
     Estas dos funciones existen para que el cambio sea explícito y no un
     «/100» perdido en medio de una fórmula. */
  const kgfm_a_kgfcm = (v) => v * 100;
  const kgfcm_a_kgfm = (v) => v / 100;

  /* ---------- velocidad ------------------------------------------------ */
  const kmh_a_ms = (v) => v / 3.6;
  const ms_a_kmh = (v) => v * 3.6;

  /* =====================================================================
     IMPORTAR UN CATÁLOGO IMPERIAL

     La única puerta por la que entra una pulgada al proyecto.  Recibe una
     fila del AISCProp13 (in, in², in⁴, lb/ft) y devuelve la fila métrica.
     Lo que sale de aquí ya no se vuelve a convertir nunca.
     ===================================================================== */
  /* Las columnas del AISCProp13, familia por familia.  No todas las hojas
     usan los mismos nombres: los ángulos traen b y t donde las W traen bf y
     tf, los HSS rectangulares traen h y b, los redondos OD e ID.

     clave imperial : [clave métrica, convertidor] */
  const MAPA_AISC = {
    "A": ["A_cm2", in2_a_cm2],
    "wt./ft.": ["peso_kgfm", lbft_a_kgfm],

    /* dimensiones · I, C, T */
    "d": ["d_cm", in_a_cm],      "tw": ["tw_cm", in_a_cm],
    "bf": ["bf_cm", in_a_cm],    "tf": ["tf_cm", in_a_cm],
    "ho": ["ho_cm", in_a_cm],    "T": ["T_cm", in_a_cm],
    "k": ["k_cm", in_a_cm],      "k(des)": ["kdes_cm", in_a_cm],
    "k(det)": ["kdet_cm", in_a_cm], "k1": ["k1_cm", in_a_cm],
    "gage": ["gramil_cm", in_a_cm],

    /* dimensiones · ángulos */
    "b": ["b_cm", in_a_cm],      "t": ["t_cm", in_a_cm],

    /* dimensiones · HSS */
    "t(nom)": ["tnom_cm", in_a_cm], "t(des)": ["tdes_cm", in_a_cm],
    "OD": ["OD_cm", in_a_cm],    "ID": ["ID_cm", in_a_cm],
    "h(flat)": ["hplano_cm", in_a_cm], "b(flat)": ["bplano_cm", in_a_cm],
    "h": ["h_cm", in_a_cm],

    /* eje x */
    "Ix": ["Ix_cm4", in4_a_cm4], "Sx": ["Sx_cm3", in3_a_cm3],
    "Zx": ["Zx_cm3", in3_a_cm3], "rx": ["rx_cm", in_a_cm],

    /* eje y */
    "Iy": ["Iy_cm4", in4_a_cm4], "Sy": ["Sy_cm3", in3_a_cm3],
    "Zy": ["Zy_cm3", in3_a_cm3], "ry": ["ry_cm", in_a_cm],

    /* eje principal menor · ángulos simples */
    "Iz": ["Iz_cm4", in4_a_cm4], "Sz": ["Sz_cm3", in3_a_cm3],
    "rz": ["rz_cm", in_a_cm],

    /* torsión y alabeo */
    "J": ["J_cm4", in4_a_cm4],   "Cw": ["Cw_cm6", in6_a_cm6],
    "C": ["Ctors_cm3", in3_a_cm3], "rts": ["rts_cm", in_a_cm],

    /* excentricidades y centros */
    "x(bar)": ["xbar_cm", in_a_cm], "y(bar)": ["ybar_cm", in_a_cm],
    "xp": ["xp_cm", in_a_cm],    "yp": ["yp_cm", in_a_cm],
    "eo": ["eo_cm", in_a_cm],    "ro(bar)": ["ro_cm", in_a_cm],
    "Wno": ["Wno_cm2", in2_a_cm2], "Sw": ["Sw_cm4", in4_a_cm4],

    /* doble ángulo · el AISC solo tabula las separaciones estándar, que es
       justo la razón de que exista propiedades.dobleAngulo() */
    "ry(0)": ["ry_sep0_cm", in_a_cm],
    "ry(3/8)": ["ry_sep38_cm", in_a_cm],
    "ry(3/4)": ["ry_sep34_cm", in_a_cm],
    "ro(bar)(0)": ["ro_sep0_cm", in_a_cm],
    "ro(bar)(3/8)": ["ro_sep38_cm", in_a_cm],
    "ro(bar)(3/4)": ["ro_sep34_cm", in_a_cm],

    "A(surf)": ["Asup_m2m", (v) => v * 0.3048]     /* ft²/ft -> m²/m */
  };

  /* Adimensionales: pasan tal cual, solo se les limpia el nombre.  No se
     convierten porque no tienen unidad, pero tampoco se tiran: bf/(2tf) y
     h/tw son las relaciones que clasifican la sección en la Tabla B4.1. */
  const ADIMENSIONALES = {
    "bf/(2*tf)": "bf_2tf", "h/tw": "h_tw", "d/tw": "d_tw",
    "b/t": "b_t", "h/t": "h_t", "d/t": "d_t",
    "H": "H", "H(0)": "H_sep0", "H(3/8)": "H_sep38", "H(3/4)": "H_sep34",
    "TAN a": "tan_alfa",
    "Qs(36)": "Qs36", "Qs(50)": "Qs50", "Qs(0)": "Qs0", "Qs(s)": "Qs_s",
    "Qf": "Qf", "Qw": "Qw"
  };

  /* Claves que son metadato, no medida. */
  const META = ["nombre", "Shape", "familia", "fabricacion", "espec", "estado", "origen"];

  /* =====================================================================
     IMPORTAR UN CATÁLOGO IMPERIAL

     La única puerta por la que entra una pulgada al proyecto.  Lo que sale
     de aquí ya no se vuelve a convertir nunca.

     Las claves que no están ni en MAPA_AISC ni en ADIMENSIONALES NO se
     descartan en silencio: se devuelven en `_desconocidas`.  Una columna
     que desaparece sin que nadie se entere es exactamente el fallo que
     este proyecto existe para impedir, y probar_perfiles.js exige que la
     lista esté vacía sobre las 1575 filas del catálogo.
     ===================================================================== */
  function importaAISC(filaImperial) {
    const out = { nombre: filaImperial.Shape || filaImperial.nombre, origen: "imperial" };
    const desconocidas = [];

    for (const clave of Object.keys(filaImperial)) {
      if (META.indexOf(clave) >= 0) continue;
      const v = filaImperial[clave];
      if (v === "" || v === null || v === undefined || v === "–" || v === "-") continue;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));

      if (MAPA_AISC[clave]) {
        if (!isFinite(n)) continue;
        const par = MAPA_AISC[clave];
        out[par[0]] = par[1](n);
      } else if (ADIMENSIONALES[clave]) {
        if (isFinite(n)) out[ADIMENSIONALES[clave]] = n;
      } else {
        desconocidas.push(clave);
      }
    }
    if (desconocidas.length) out._desconocidas = desconocidas;
    return out;
  }

  /* Un perfil métrico (Precor, FAM) no se convierte: solo se marca su origen,
     para que nadie intente convertirlo dos veces. */
  function importaMetrico(fila) {
    return Object.assign({ origen: "metrico" }, fila);
  }

  /* =====================================================================
     LA GUARDA DE NOMBRES

     No obliga a nada —JavaScript no lo permite— pero permite que una prueba
     compruebe que un objeto de propiedades lleva la unidad en cada clave.
     Se usa en probar_unidades.js y en el catálogo.
     ===================================================================== */
  const SUFIJOS = ["_cm", "_cm2", "_cm3", "_cm4", "_cm6", "_m", "_mm",
                   "_kgf", "_t", "_kgcm2", "_kgfm", "_kgfcm", "_kgfm2",
                   "_kmh", "_ms", "_grad", "_rad"];

  /* Claves que se aceptan sin sufijo por ser adimensionales o texto. */
  const SIN_UNIDAD = ["nombre", "origen", "fabricacion", "espec", "estado",
                      "familia", "tipo", "id", "geometria", "_desconocidas",
                      "beta", "lambda", "d_Af", "sep_cm"];

  function claveTieneUnidad(k) {
    if (SIN_UNIDAD.indexOf(k) >= 0) return true;
    /* las adimensionales del catálogo tampoco llevan sufijo, y no deben */
    for (const k2 in ADIMENSIONALES) if (ADIMENSIONALES[k2] === k) return true;
    return SUFIJOS.some((s) => k.endsWith(s));
  }

  function revisaNombres(obj) {
    return Object.keys(obj).filter((k) => !claveTieneUnidad(k));
  }

  return {
    PULGADA_CM, LIBRA_KGF, PIE_CM, KIP_KGF, KSI_KGCM2, MPA_KGCM2,
    in_a_cm, cm_a_in, m_a_cm, cm_a_m, mm_a_cm, cm_a_mm,
    in2_a_cm2, in3_a_cm3, in4_a_cm4, in6_a_cm6,
    lb_a_kgf, kip_a_kgf, kgf_a_t, t_a_kgf,
    ksi_a_kgcm2, kgcm2_a_ksi, mpa_a_kgcm2, kgcm2_a_mpa,
    lbft_a_kgfm, kgfm_a_kgfcm, kgfcm_a_kgfm, kmh_a_ms, ms_a_kmh,
    importaAISC, importaMetrico, revisaNombres, claveTieneUnidad, SUFIJOS,
    MAPA_AISC, ADIMENSIONALES
  };
});
