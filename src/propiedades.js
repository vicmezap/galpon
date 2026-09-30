/* =====================================================================
   propiedades.js — la calculadora de propiedades de sección

   Sin este módulo el complemento solo puede diseñar lo que alguien ya
   tabuló, que es justo lo que no hace falta.  Con él:

     · la diagonal de tijeral de verdad — dos ángulos con la separación de
       TU cartela, no la que casualmente esté en la tabla del AISC
     · la columna soldada a medida — una I de 8 m que no existe en ningún
       catálogo del mundo
     · el solucionador — la matriz de rigidez necesita A e I de cada barra,
       y una sección definida por el usuario no las tiene tabuladas
     · el metrado — el peso por metro sale del área
     · la verificación del propio catálogo — calcular las propiedades de un
       perfil tabulado y compararlas es la prueba de oro del proyecto

   UNIDADES: todo en cm, cm², cm³, cm⁴, cm⁶.  Ver unidades.js.

   LO QUE NO HACE: pandeo, resistencia, clasificación.  Aquí solo hay
   geometría.  La geometría no discute con nadie.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.PROPIEDADES = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  /* De qué filas del inventario depende este módulo.  Si alguna no existe,
     se entera al cargarse y no a mitad de un cálculo. */
  const ART = INV.declara("propiedades.js", [
    "PROP.basicas", "PROP.Z", "PROP.J", "PROP.Cw",
    "PROP.compuestas", "PROP.planchas", "PROP.fabricacion", "PROP.unidad",
    "CAT.soldados.prueba", "CAT.hss.espesor"
  ]);

  /* =====================================================================
     1 · SECCIÓN COMPUESTA DE RECTÁNGULOS

     La base de todo lo demás.  Cada rectángulo se da por su ancho, su alto
     y la posición de SU centroide respecto a un origen cualquiera; el
     módulo encuentra el centroide del conjunto y traslada.

         rect(b_cm, h_cm, xc_cm, yc_cm)

     El eje x es horizontal (flexión de eje fuerte en un perfil I), el y
     vertical.  b es la dimensión en x, h la dimensión en y.
     ===================================================================== */

  function rect(b_cm, h_cm, xc_cm, yc_cm) {
    return { b_cm, h_cm, xc_cm, yc_cm, A_cm2: b_cm * h_cm };
  }

  function compuesta(piezas) {
    if (!piezas.length) throw new Error("propiedades: sección sin piezas");

    let A = 0, Sx = 0, Sy = 0;
    for (const p of piezas) {
      A += p.A_cm2;
      Sy += p.A_cm2 * p.xc_cm;   /* primer momento respecto al eje y */
      Sx += p.A_cm2 * p.yc_cm;   /* respecto al eje x */
    }
    if (A <= 0) throw new Error("propiedades: el área resulta nula o negativa");

    const xg_cm = Sy / A;
    const yg_cm = Sx / A;

    /* Ejes paralelos: I = Σ(I_propio + A·d²) */
    let Ix = 0, Iy = 0;
    for (const p of piezas) {
      const dy = p.yc_cm - yg_cm;
      const dx = p.xc_cm - xg_cm;
      Ix += (p.b_cm * Math.pow(p.h_cm, 3)) / 12 + p.A_cm2 * dy * dy;
      Iy += (p.h_cm * Math.pow(p.b_cm, 3)) / 12 + p.A_cm2 * dx * dx;
    }

    /* Las fibras extremas, para los módulos elásticos. */
    let yMax = -Infinity, yMin = Infinity, xMax = -Infinity, xMin = Infinity;
    for (const p of piezas) {
      yMax = Math.max(yMax, p.yc_cm + p.h_cm / 2);
      yMin = Math.min(yMin, p.yc_cm - p.h_cm / 2);
      xMax = Math.max(xMax, p.xc_cm + p.b_cm / 2);
      xMin = Math.min(xMin, p.xc_cm - p.b_cm / 2);
    }
    const cSup_cm = yMax - yg_cm, cInf_cm = yg_cm - yMin;
    const cDer_cm = xMax - xg_cm, cIzq_cm = xg_cm - xMin;

    return {
      A_cm2: A, xg_cm, yg_cm,
      Ix_cm4: Ix, Iy_cm4: Iy,
      /* El módulo elástico se toma con la fibra MÁS ALEJADA: es la que
         decide.  En secciones simétricas las dos coinciden. */
      Sx_cm3: Ix / Math.max(cSup_cm, cInf_cm),
      Sy_cm3: Iy / Math.max(cDer_cm, cIzq_cm),
      SxSup_cm3: Ix / cSup_cm, SxInf_cm3: Ix / cInf_cm,
      rx_cm: Math.sqrt(Ix / A), ry_cm: Math.sqrt(Iy / A),
      d_cm: yMax - yMin, ancho_cm: xMax - xMin,
      cSup_cm, cInf_cm, cDer_cm, cIzq_cm,
      Zx_cm3: plastico(piezas, "y"),
      Zy_cm3: plastico(piezas, "x")
    };
  }

  /* =====================================================================
     2 · MÓDULO PLÁSTICO

     El eje neutro plástico NO es el centroide: es la línea que deja la
     mitad del área a cada lado.  Coinciden solo si la sección es simétrica
     respecto a ese eje, que es el caso de una I de doble simetría pero no
     el de una te ni el de un ángulo.

     Se busca por bisección sobre la coordenada del eje.  Es más lento que
     una fórmula cerrada y funciona para CUALQUIER sección compuesta, que
     es lo que hace falta aquí.

     eje = "y" → el eje neutro es horizontal, se busca en la coordenada y
                 (da Zx, flexión de eje fuerte)
     eje = "x" → el eje neutro es vertical (da Zy)
     ===================================================================== */

  function plastico(piezas, eje) {
    const esY = eje === "y";
    const c = (p) => (esY ? p.yc_cm : p.xc_cm);
    const esp = (p) => (esY ? p.h_cm : p.b_cm);   /* dimensión perpendicular al eje */
    const anc = (p) => (esY ? p.b_cm : p.h_cm);   /* dimensión paralela al eje */

    const Atot = piezas.reduce((s, p) => s + p.A_cm2, 0);

    let lo = Math.min(...piezas.map((p) => c(p) - esp(p) / 2));
    let hi = Math.max(...piezas.map((p) => c(p) + esp(p) / 2));

    /* Área que queda por encima de la línea z. */
    const arriba = (z) => {
      let a = 0;
      for (const p of piezas) {
        const b0 = c(p) - esp(p) / 2, b1 = c(p) + esp(p) / 2;
        const t = Math.min(b1, Math.max(z, b0));      /* corte dentro de la pieza */
        a += (b1 - t) * anc(p);
      }
      return a;
    };

    /* Bisección: 80 iteraciones dejan el eje localizado muy por debajo del
       error de cualquier dimensión de fabricación. */
    for (let i = 0; i < 80; i++) {
      const z = (lo + hi) / 2;
      if (arriba(z) > Atot / 2) lo = z; else hi = z;
    }
    const zp = (lo + hi) / 2;

    /* Z = Σ|A_i · d_i| respecto al eje neutro plástico, partiendo las
       piezas que el eje atraviesa. */
    let Z = 0;
    for (const p of piezas) {
      const b0 = c(p) - esp(p) / 2, b1 = c(p) + esp(p) / 2;
      const tramos = [];
      if (zp <= b0) tramos.push([b0, b1]);
      else if (zp >= b1) tramos.push([b0, b1]);
      else { tramos.push([b0, zp]); tramos.push([zp, b1]); }
      for (const [t0, t1] of tramos) {
        const a = (t1 - t0) * anc(p);
        const brazo = Math.abs((t0 + t1) / 2 - zp);
        Z += a * brazo;
      }
    }
    return Z;
  }

  /* =====================================================================
     3 · PERFIL I ARMADO DE PLANCHAS

     Lo que Zapata llama perfil soldado y recomienda para pórticos de un
     piso (p. 280: «los perfiles más adecuados son los perfiles VS»).

         h_cm  : altura LIBRE del alma, entre caras interiores de alas
         tw_cm : espesor del alma
         bf_cm : ancho del ala
         tf_cm : espesor del ala

     El peralte total es d = h + 2·tf.
     ===================================================================== */

  function Iarmada(o) {
    const { h_cm, tw_cm, bf_cm, tf_cm } = o;
    for (const [k, v] of Object.entries({ h_cm, tw_cm, bf_cm, tf_cm })) {
      if (!(v > 0)) throw new Error("propiedades: I armada con " + k + " = " + v);
    }
    const d_cm = h_cm + 2 * tf_cm;
    const ho_cm = d_cm - tf_cm;          /* distancia entre centroides de alas */

    const piezas = [
      rect(tw_cm, h_cm, 0, 0),                            /* alma, centrada */
      rect(bf_cm, tf_cm, 0, (h_cm + tf_cm) / 2),          /* ala superior */
      rect(bf_cm, tf_cm, 0, -(h_cm + tf_cm) / 2)          /* ala inferior */
    ];
    const g = compuesta(piezas);

    /* Torsión de Saint-Venant, aproximación de paredes delgadas.
       Es la misma expresión que publica FAM para la serie VS/CS/CVS:
       IT = [(h + tf)·tw³ + 2·bf·tf³] / 3  */
    g.J_cm4 = ((h_cm + tf_cm) * Math.pow(tw_cm, 3) + 2 * bf_cm * Math.pow(tf_cm, 3)) / 3;

    /* Alabeo.  Para I de doble simetría con alas rectangulares el propio
       AISC autoriza Cw = Iy·ho²/4 (User Note de E4 y de F2). */
    g.Cw_cm6 = (g.Iy_cm4 * ho_cm * ho_cm) / 4;
    g.ho_cm = ho_cm;
    g.d_cm = d_cm;

    /* rts del Cap. F: rts² = √(Iy·Cw)/Sx  (AISC F2-7) */
    g.rts_cm = Math.sqrt(Math.sqrt(g.Iy_cm4 * g.Cw_cm6) / g.Sx_cm3);

    g.fabricacion = "soldado";
    g.geometria = { tipo: "I_armada", h_cm, tw_cm, bf_cm, tf_cm, d_cm };
    return g;
  }

  /* =====================================================================
     4 · DOBLE ÁNGULO ESPALDA CON ESPALDA

     LA sección de la diagonal de tijeral.  El AISC tabula «Double Angles»
     solo para las separaciones estándar (3/8", 3/4"); si tu cartela es de
     8 mm, esa sección no está en ninguna tabla y hay que calcularla.

         angulo : { A_cm2, Ix_cm4, Iy_cm4, xbar_cm, J_cm4 }  de UN ángulo
         sep_cm : separación entre los dorsos (el espesor de la cartela)

     El eje x del par coincide con el x de cada ángulo: Ix y rx NO cambian
     al emparejar, y ese es el mejor control de que el cálculo está bien.
     El eje y es el de simetría entre los dos, y ahí sí crece mucho.
     ===================================================================== */

  function dobleAngulo(o) {
    const { angulo, sep_cm } = o;
    if (!angulo) throw new Error("propiedades: dobleAngulo sin ángulo");
    for (const k of ["A_cm2", "Ix_cm4", "Iy_cm4", "xbar_cm"]) {
      if (!(angulo[k] > 0)) {
        throw new Error("propiedades: al ángulo le falta " + k +
          " (hace falta para el teorema de ejes paralelos)");
      }
    }
    if (!(sep_cm >= 0)) throw new Error("propiedades: separación negativa");

    const A_cm2 = 2 * angulo.A_cm2;
    const Ix_cm4 = 2 * angulo.Ix_cm4;                  /* el eje NO se mueve */
    const dy = sep_cm / 2 + angulo.xbar_cm;            /* centroide de cada ángulo al eje de simetría */
    const Iy_cm4 = 2 * (angulo.Iy_cm4 + angulo.A_cm2 * dy * dy);

    return {
      A_cm2, Ix_cm4, Iy_cm4,
      rx_cm: Math.sqrt(Ix_cm4 / A_cm2),
      ry_cm: Math.sqrt(Iy_cm4 / A_cm2),
      J_cm4: angulo.J_cm4 ? 2 * angulo.J_cm4 : undefined,
      sep_cm,
      /* La separación entre presillas la decide el Cap. E6 (compresión,
         a/ri ≤ 3/4 de la esbeltez del conjunto) o el D4 (tracción, 300).
         Aquí solo se deja el radio del componente, que es lo que esas
         reglas necesitan. */
      ri_cm: Math.min(Math.sqrt(angulo.Ix_cm4 / angulo.A_cm2),
                      Math.sqrt(angulo.Iy_cm4 / angulo.A_cm2)),
      fabricacion: "compuesto",
      geometria: { tipo: "2L", sep_cm }
    };
  }

  /* =====================================================================
     5 · LAS SIETE RELACIONES DE AUTOVERIFICACIÓN

     Fila CAT.soldados.prueba del inventario.  Cada fila de un catálogo se
     comprueba sola: si las siete cuadran, el parseo está bien Y la tabla
     está bien transcrita.  Dos certezas de un tiro, sin intervención
     humana.

     La tolerancia la pone el catálogo, no el cálculo: las tablas publican
     tres o cuatro cifras significativas, así que un 0,4 % de desviación es
     redondeo de la fuente.  Una columna mal leída da errores de decenas
     por ciento, no de décimas: la prueba los separa sin ambigüedad.
     ===================================================================== */

  /* Cada relación tiene su propia tolerancia y su propia condición de
     aplicabilidad.  Una sola tolerancia global era mentira: las tres
     primeras son definiciones puras y deben cuadrar al 1 %, mientras que
     el peso compara contra una DESIGNACIÓN nominal redondeada a 0,1 lb/ft,
     que en un perfil de 4,8 kgf/m ya son tres por ciento. */
  /* 1,5 % · MEDIDO sobre las 1575 filas del catálogo, no elegido a ojo.
     Peor desviación por familia en rx y ry:
         I 0,50 · C 0,54 · T 0,67 · 2L 0,64 · HSS 0,55 · L 1,41
     Un solo ángulo de 127 necesita pasar de 1,2 %; el resto sobra.  Y la
     holgura no cuesta poder de detección: una columna mal leída se desvía
     decenas por ciento, no décimas. */
  const TOL_CATALOGO = 0.015;
  /* La comprobación del peso contra A·γ.  Las tolerancias salen de medir,
     no de elegir.  Peor desviación por familia:

                    > 10 kgf/m   < 10 kgf/m
         I             1,34 %       7,41 %
         C             1,61 %       5,99 %
         T             1,22 %       3,01 %
         L             2,66 %       1,69 %
         2L            0,43 %       0,20 %
         HSS           2,80 %  (escalando por 1/0,93)

     Dos causas distintas, las dos legítimas: en perfiles pequeños la
     DESIGNACIÓN redondea (M4X3.2 son 3,2 lb/ft nominales, no exactos), y
     en los ángulos el AISC tabula área e inercias desde idealizaciones
     ligeramente distintas. */
  const TOL_PESO_GRANDE = 0.030;   /* 3 % · sobre 10 kgf/m */
  const TOL_PESO_CHICO = 0.08;     /* 8 % · por debajo, la designación redondea */
  const PESO_CHICO = 10;           /* kgf/m */

  /* AISC §B4.2 · fila CAT.hss.espesor del inventario.
     Se usa el valor NORMATIVO, no el que se deduzca de los datos: cinco
     filas del catálogo traen el espesor nominal mal y deducir el factor de
     ellas propagaría el error en vez de delatarlo. */
  const HSS_T_DISENO = 0.93;

  const GAMMA_ACERO_KGFCM3 = 7.85e-3;   /* fila D.acero.gamma: 7850 kgf/m³ */

  /* Qué familias tienen doble simetría, que es lo que decide si valen
     Sx = 2·Ix/d, Sy = 2·Iy/bf y Cw = Iy·ho²/4.

     LA TRAMPA QUE ESTO EVITA: el AISC autoriza Cw = Iy·ho²/4 solo «for
     doubly symmetric I-shaped sections» (User Notes de E4 y F2).  Un CANAL
     es de simetría SIMPLE —su centro de corte está fuera del alma— y
     aplicarle la fórmula da hasta un 35 % de error.  Aplicarla a todo el
     catálogo hacía fallar 1250 de 1575 perfiles y el fallo era mío, no de
     la tabla. */
  const DOBLE_SIMETRIA = ["I", "HSS_rect", "HSS_red"];
  const I_DOBLE_SIMETRIA = ["I"];   /* solo estas admiten Cw = Iy·ho²/4 */

  function verifica(p, opciones) {
    const o = opciones || {};
    const fam = o.familia || p.familia || null;

    const dobleSim = o.simetriaDoble !== undefined
      ? o.simetriaDoble
      : (fam ? DOBLE_SIMETRIA.indexOf(fam) >= 0 : true);

    const esIdoble = o.esIdoble !== undefined
      ? o.esIdoble
      : (fam ? I_DOBLE_SIMETRIA.indexOf(fam) >= 0 : false);

    const fallos = [];
    const cerca = (nombre, obtenido, tabulado, tol) => {
      if (!(tabulado > 0) || !isFinite(obtenido)) return;   /* la tabla no lo trae */
      const rel = Math.abs(obtenido - tabulado) / Math.abs(tabulado);
      if (rel > tol) {
        fallos.push(nombre + ": calculado " + obtenido.toPrecision(6) +
          " contra tabulado " + Number(tabulado).toPrecision(6) +
          "  (" + (rel * 100).toFixed(2) + " %)");
      }
    };

    /* 1 y 2 · los radios de giro son DEFINICIONES: valen en cualquier
       sección, con o sin simetría, en cualquier sistema de unidades. */
    if (p.Ix_cm4 && p.A_cm2) cerca("rx = √(Ix/A)", Math.sqrt(p.Ix_cm4 / p.A_cm2), p.rx_cm, TOL_CATALOGO);
    if (p.Iy_cm4 && p.A_cm2) cerca("ry = √(Iy/A)", Math.sqrt(p.Iy_cm4 / p.A_cm2), p.ry_cm, TOL_CATALOGO);

    /* 3 y 4 · los módulos elásticos solo salen así con doble simetría: en
       una te o un ángulo las dos fibras extremas están a distinta
       distancia y S se toma con la más alejada. */
    if (dobleSim) {
      if (p.Ix_cm4 && p.d_cm) cerca("Sx = 2·Ix/d", (2 * p.Ix_cm4) / p.d_cm, p.Sx_cm3, TOL_CATALOGO);
      if (p.Iy_cm4 && p.bf_cm) cerca("Sy = 2·Iy/bf", (2 * p.Iy_cm4) / p.bf_cm, p.Sy_cm3, TOL_CATALOGO);
    }

    /* 5 · la constante de alabeo, SOLO en I de doble simetría */
    if (esIdoble && p.Iy_cm4 && p.Cw_cm6) {
      const ho = p.ho_cm || (p.d_cm && p.tf_cm ? p.d_cm - p.tf_cm : null);
      if (ho) cerca("Cw = Iy·ho²/4", (p.Iy_cm4 * ho * ho) / 4, p.Cw_cm6, 0.05);
    }

    /* 6 · el peso contra el área por el peso específico.
       La tolerancia depende del tamaño porque la DESIGNACIÓN redondea: un
       W14X211 cuadra al 0,001 % y un M4X3.2 se desvía un 7 %, y las dos
       cosas son correctas. */
    if (p.A_cm2 && p.peso_kgfm) {
      /* EL CASO DE LOS HSS · fila CAT.hss.espesor del inventario.
         El AISC tabula el área con el espesor de DISEÑO (0,93 del nominal,
         AISC §B4.2) pero el peso con el NOMINAL.  Comparar sin corregir da
         un 6,5 % de desfase sistemático en las 367 filas de HSS, y no es
         un error de transcripción: es la norma. */
      /* El área de un HSS es la del espesor de DISEÑO; el peso, la del
         NOMINAL.  Se escala por el 0,93 de la norma —no por el cociente
         tnom/tdes de la fila— para que una fila con el espesor mal escrito
         FALLE en vez de corregirse sola y pasar desapercibida. */
      const esHSS = (p.familia === "HSS_rect" || p.familia === "HSS_red");
      const escala = esHSS ? 1 / HSS_T_DISENO : 1;
      const tol = p.peso_kgfm >= PESO_CHICO ? TOL_PESO_GRANDE : TOL_PESO_CHICO;
      cerca("peso = A·γ", p.A_cm2 * escala * GAMMA_ACERO_KGFCM3 * 100, p.peso_kgfm, tol);
    }

    /* 7 · el factor de forma.  No es una igualdad sino un rango, y depende
       de la forma: una I anda en 1,10-1,20 y una te o un ángulo llegan más
       alto porque el eje neutro plástico se desplaza mucho. */
    if (p.Zx_cm3 && p.Sx_cm3) {
      const f = p.Zx_cm3 / p.Sx_cm3;
      /* Medido: I 1,297 · C 1,290 · HSS 1,500 · L 1,827 · 2L 1,970 · T 2,233.
         El eje neutro plástico de una te se desplaza mucho más que el de
         una I, y por eso su factor de forma llega tan alto. */
      const lim = dobleSim ? 1.6 : 2.3;
      if (f < 1.0 || f > lim) {
        fallos.push("Zx/Sx = " + f.toFixed(3) + " fuera del rango razonable (1,0 a " + lim + ")");
      }
    }
    return fallos;
  }

  return {
    ART, TOL_CATALOGO, HSS_T_DISENO, DOBLE_SIMETRIA, I_DOBLE_SIMETRIA, GAMMA_ACERO_KGFCM3,
    rect, compuesta, plastico, Iarmada, dobleAngulo, verifica
  };
});
