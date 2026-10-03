/* =====================================================================
   elemento.js — verificar UNA pieza contra todos los capítulos que apliquen

   La maquinaria que comparten correas.js, tijeral.js, columnas.js y
   arriostres.js.  Se le da una sección, sus fuerzas y sus longitudes no
   arriostradas, y devuelve la lista de razones demanda/capacidad con su
   estado límite, cuál gobierna, y la combinación culpable.

   UN CONTROL QUE NO SE HIZO ES PEOR QUE UNO QUE FALLA.  Un ratio de 0,82
   parece bueno, y si detrás falta el pandeo lateral-torsional porque nadie
   pasó Lb, el elemento está mal y el número dice que está bien.  Así que
   esto NO se salta ninguna verificación en silencio: lo que no se puede
   comprobar se apunta en `omitidos` con su motivo, y `cumple` es false
   mientras haya un omitido esencial.  Si falta un dato imprescindible, PARA.

   QUÉ SE COMPRUEBA, según lo que traiga la pieza:
       axial de tracción    → Cap. D  (fluencia y rotura)
       axial de compresión  → Cap. E  (pandeo por flexión, y E5 si es ángulo)
       momento eje mayor    → Cap. F2
       momento eje menor    → Cap. F6
       cortante             → Cap. G
       axial + momento      → Cap. H  (y entonces el axial solo NO basta)

   LA COMBINACIÓN VIAJA CON EL RATIO.  Un elemento con ratio 0,95 no dice
   nada; «0,95 por pandeo lateral-torsional bajo 0,9D − 1,3W» dice qué
   cambiar y por qué.  El diagrama lo pide así y es lo que distingue un
   resultado utilizable de un número.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./acero.js"));
  } else {
    raiz.ELEMENTO = definir(raiz.INVENTARIO, raiz.ACERO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, AC) {
  "use strict";

  const ART = INV.declara("elemento.js", [
    "T.menor", "C.Pn", "F.phi", "V.Vn", "H.1a", "H.Pr", "E.C3.arriostre", "H.biaxial"
  ]);

  /* Los estados límite que este módulo sabe comprobar, en el orden del AISC.
     La lista existe para que `omitidos` pueda nombrar lo que NO se hizo. */
  const ESTADOS = [
    "tracción (Cap. D)",
    "compresión (Cap. E)",
    "flexión eje mayor (Cap. F2)",
    "flexión eje menor (Cap. F6)",
    "cortante (Cap. G)",
    "fuerzas combinadas (Cap. H)"
  ];

  function exigeNumero(v, nombre, contexto) {
    if (typeof v !== "number" || !isFinite(v)) {
      throw new Error("elemento: " + contexto + " necesita " + nombre + " numérico");
    }
  }

  /* ---------- la verificación --------------------------------------- */
  function verifica(d) {
    const id = d.id || "(sin id)";
    const p = d.perfil;
    if (!p || typeof p !== "object") {
      throw new Error("elemento: «" + id + "» necesita un perfil (del catálogo o a medida)");
    }
    const acero = d.acero || "A36";
    const F = d.fuerzas || {};
    const L = d.longitudes || {};
    const comb = d.combinacion || null;

    const Pu = F.Pu_kgf || 0;            /* + tracción · − compresión */
    const Mux = F.Mux_kgfcm || 0;
    const Muy = F.Muy_kgfcm || 0;
    const Vu = F.Vu_kgf || 0;
    for (const [v, n] of [[Pu, "Pu_kgf"], [Mux, "Mux_kgfcm"], [Muy, "Muy_kgfcm"], [Vu, "Vu_kgf"]]) {
      exigeNumero(v, n, "«" + id + "»");
    }

    const ratios = [];
    const omitidos = [];
    let Pc = null, Mcx = null, Mcy = null;

    /* ---- Cap. D · tracción ---- */
    if (Pu > 0) {
      const t = AC.traccion({ acero: acero, Ag_cm2: p.A_cm2,
        An_cm2: d.An_cm2, U: d.U, Pu_kgf: Pu });
      ratios.push({ estado: "tracción · " + t.manda, valor: t.ratio,
        capacidad_kgf: t.Pd_kgf, art: t.art, cap: "D" });
      Pc = t.Pd_kgf;
      if (d.An_cm2 === undefined || d.U === undefined) {
        /* No se omite el control: se hace con An = Ag y U = 1, que es el caso
           soldado sin agujeros. Pero hay que DECIRLO, porque en una diagonal
           de ángulo empernada eso sobrestima hasta un 36 % (fila T.U.c8). */
        omitidos.push({ que: "el retraso de cortante y el área neta",
          motivo: "no se dieron An_cm2 ni U: se calculó como sección soldada sin " +
            "agujeros. En una diagonal de ángulo empernada eso sobrestima la " +
            "capacidad hasta un 36 %",
          esencial: d.empernado === true });
      }
    }

    /* ---- Cap. E · compresión ---- */
    if (Pu < 0) {
      const Pcomp = -Pu;
      const Lc = L.Lc_cm;
      if (!(Lc > 0)) {
        throw new Error(
          "elemento: «" + id + "» está en compresión (" + Pcomp.toFixed(0) + " kgf) y\n" +
          "  necesita su longitud efectiva Lc_cm. Sin ella no hay Capítulo E, y una\n" +
          "  compresión sin comprobar pandeo no es una comprobación.");
      }
      const r = L.r_cm;
      if (!(r > 0)) {
        throw new Error("elemento: «" + id + "» en compresión necesita r_cm, el radio de " +
          "giro que gobierna");
      }
      const c = AC.compresion({ acero: acero, Ag_cm2: p.A_cm2, Lc_cm: Lc, r_cm: r,
        noEsbelta: d.noEsbelta, elementos: d.elementosEsbeltez, Pu_kgf: Pcomp,
        Fe_kgcm2: L.Fe_kgcm2, feOrigen: L.feOrigen });
      ratios.push({ estado: "compresión · pandeo " + (c.feOrigen === "flexión (E3)"
        ? "por flexión" : c.feOrigen) + ", " + c.tramo,
        valor: c.ratio, capacidad_kgf: c.Pd_kgf, art: c.art, cap: "E" });
      Pc = c.Pd_kgf;
      /* El arriostre que define Lc tiene que ganárselo · fila E.C3.arriostre */
      if (d.arriostreComprobado !== true) {
        omitidos.push({ que: "que el arriostre cumpla el Apéndice 6",
          motivo: "el C3 exige que el arriostre que define la longitud no arriostrada " +
            "tenga rigidez y resistencia suficientes. Decir que un punto está " +
            "arriostrado sin comprobarlo da una Lc que no existe. Se comprueba con " +
            "arriostres.js, que aplica el Apéndice 6",
          esencial: false, art: ART["E.C3.arriostre"] });
      }
    }

    /* ---- Cap. F2 · flexión eje mayor ---- */
    if (Mux !== 0) {
      if (!(p.Zx_cm3 > 0) || !(p.Sx_cm3 > 0)) {
        throw new Error("elemento: «" + id + "» con momento de eje mayor necesita Zx_cm3 y Sx_cm3");
      }
      const Lb = L.Lb_cm;
      if (Lb === undefined) {
        throw new Error(
          "elemento: «" + id + "» tiene momento de eje mayor y falta Lb_cm, la longitud\n" +
          "  NO ARRIOSTRADA. Sin ella no se puede comprobar el pandeo lateral-torsional,\n" +
          "  que es el estado límite que gobierna casi todas las vigas de galpón.\n" +
          "  Si de verdad está arriostrada continuamente, pásalo como Lb_cm: 0.");
      }
      const geo = d.geometriaF2;
      if (!geo || !(geo.Lp_cm > 0) || !(geo.Lr_cm > 0)) {
        throw new Error(
          "elemento: «" + id + "» necesita geometriaF2 con Lp_cm y Lr_cm.\n" +
          "  Se calculan con acero.Lp(), acero.rts(), acero.coefC() y acero.Lr():\n" +
          "  van juntos porque dependen de la misma sección y del mismo Fy.");
      }
      const f = AC.flexionF2(Object.assign({ acero: acero, Zx_cm3: p.Zx_cm3,
        Sx_cm3: p.Sx_cm3, Lb_cm: Lb, Cb: d.Cb, Mu_kgfcm: Mux }, geo));
      ratios.push({ estado: "flexión eje mayor · " + f.zona, valor: f.ratio,
        capacidad_kgfcm: f.Md_kgfcm, art: f.art, cap: "F2" });
      Mcx = f.Md_kgfcm;
      if (d.Cb === undefined) {
        omitidos.push({ que: "el Cb real del tramo",
          motivo: "se tomó Cb = 1,0, que es conservador y está permitido, pero " +
            "desaprovecha capacidad: en curvatura inversa Cb llega a 2,27",
          esencial: false });
      }
    }

    /* ---- Cap. F6 · flexión eje menor ---- */
    if (Muy !== 0) {
      if (!(p.Zy_cm3 > 0) || !(p.Sy_cm3 > 0)) {
        throw new Error("elemento: «" + id + "» con momento de eje menor necesita Zy_cm3 y Sy_cm3");
      }
      const f6 = AC.flexionF6({ acero: acero, Zy_cm3: p.Zy_cm3, Sy_cm3: p.Sy_cm3,
        b_cm: d.bF6_cm, tf_cm: p.tf_cm, Mu_kgfcm: Muy });
      ratios.push({ estado: "flexión eje menor · " + f6.estado, valor: f6.ratio,
        capacidad_kgfcm: f6.Md_kgfcm, art: f6.art, cap: "F6" });
      Mcy = f6.Md_kgfcm;
      if (d.bF6_cm === undefined) {
        omitidos.push({ que: "el pandeo local del ala en eje menor",
          motivo: "no se dio bF6_cm, que es la MITAD del ala en una I y el ala " +
            "COMPLETA en un canal. Sin él solo se comprobó la fluencia",
          esencial: false });
      }
    }

    /* ---- Cap. G · cortante ----
       EL ARTÍCULO SE REPARTE POR FORMA, y no es decorativo: cada uno usa otra
       geometría y otro kv.  Aplicar el G2 a un ángulo no da un resultado algo
       distinto, da uno sin sentido, porque un ángulo no tiene alma.

       Lo tuve mal: mandaba TODO al G2, y no se notó porque hasta la primera
       correa de canal solo había pasado por aquí perfiles W — que son justo
       los que sí van por G2.  El fallo estaba tapado por la muestra
       (fila V.articulo). */
    if (Vu !== 0) {
      const fam = d.familia || p.familia;
      if (!fam) {
        throw new Error("elemento: «" + id + "» con cortante necesita la familia del " +
          "perfil, para saber qué artículo del Cap. G aplica");
      }
      const art = AC.articuloCorte(fam).articulo;
      let v;
      if (art === "G2") {
        if (!(p.d_cm > 0) || !(p.tw_cm > 0)) {
          throw new Error("elemento: «" + id + "» con cortante por G2 necesita d_cm y tw_cm");
        }
        const h = AC.hSobreTw(p);
        v = AC.corteAlma({ acero: acero, d_cm: p.d_cm, tw_cm: p.tw_cm,
          h_tw: h.h_tw, fabricacion: d.fabricacion || p.fabricacion, Vu_kgf: Vu });
        v.estado = "cortante G2 · " + (v.enG21a ? "fluencia del alma, φv = 1,00" : v.tramo);
        if (h.origen !== "tabulado") {
          omitidos.push({ que: "h/tw tabulado", motivo: "el catálogo no lo trae para esta " +
            "familia y se derivó como d − 2k: " + h.nota, esencial: false, art: h.art });
        }
      } else if (art === "G3") {
        const b = d.bCorte_cm, t = d.tCorte_cm;
        if (!(b > 0) || !(t > 0)) {
          throw new Error(
            "elemento: «" + id + "» es de la familia " + fam + ", así que su cortante va\n" +
            "  por el G3, no por el G2. Necesita bCorte_cm y tCorte_cm: el ancho del lado\n" +
            "  que resiste el corte (o el peralte del alma de la te) y su espesor.\n" +
            "  Un ángulo no tiene alma, así que d y tw no sirven aquí.");
        }
        v = AC.corteAngulo({ acero: acero, b_cm: b, t_cm: t, Vu_kgf: Vu });
        v.estado = "cortante G3 · " + v.tramo;
      } else if (art === "G4") {
        v = AC.corteHSS({ acero: acero, h_cm: d.hCorte_cm,
          dimExterior_cm: d.dimExterior_cm || p.d_cm, t_cm: d.tCorte_cm || p.tdes_cm,
          Vu_kgf: Vu });
        v.estado = "cortante G4 · dos almas · " + v.tramo;
      } else {
        v = AC.corteRedondo({ acero: acero, D_t: d.D_t, Lv_cm: d.Lv_cm,
          D_cm: d.D_cm || p.d_cm, Ag_cm2: p.A_cm2, Vu_kgf: Vu });
        v.estado = "cortante G5 · " + (v.mandaFluencia ? "fluencia" : "pandeo");
      }
      ratios.push({ estado: v.estado, valor: v.ratio, capacidad_kgf: v.Vd_kgf,
        art: v.art, cap: art });
    }

    /* ---- Cap. H · fuerzas combinadas ----
       CUANDO HAY AXIAL Y MOMENTO A LA VEZ, EL AXIAL SOLO NO BASTA, y tampoco
       la flexión sola: manda la interacción.  Los ratios individuales se
       quedan como información, pero el que gobierna sale de H. */
    const hayAxial = Pu !== 0, hayMomento = Mux !== 0 || Muy !== 0;
    if (hayAxial && hayMomento) {
      if (Pc === null) {
        throw new Error("elemento: «" + id + "» necesita la capacidad axial para el Cap. H");
      }
      if (Mux !== 0 && Mcx === null) {
        throw new Error("elemento: «" + id + "» necesita Mcx para el Cap. H");
      }
      const h = AC.interaccionH1({
        origen: d.origenFuerzas, Pr_kgf: Pu, Pc_kgf: Pc,
        Mrx_kgfcm: Mux, Mcx_kgfcm: Mcx, Mry_kgfcm: Muy, Mcy_kgfcm: Mcy
      });
      ratios.push({ estado: "fuerzas combinadas · " + h.ecuacion, valor: h.valor,
        art: h.art, cap: "H", manda: true });
    } else if (hayAxial || hayMomento) {
      /* Sin interacción no hace falta el origen, pero si viene, se respeta. */
      if (d.origenFuerzas === "primer-orden") {
        throw new Error(
          "elemento: «" + id + "» trae fuerzas de PRIMER ORDEN.\n" +
          "  Aunque aquí no haya interacción, el Capítulo C pide el segundo orden para\n" +
          "  cualquier efecto dependiente de la carga. Amplifícalas antes.");
      }
      /* FLEXIÓN BIAXIAL SIN AXIAL · fila H.biaxial. También va por el Cap. H: H1-1b con Pr = 0 deja
         Mrx/Mcx + Mry/Mcy ≤ 1. El caso de TODA correa de techo, que flexiona en los dos ejes por la
         pendiente. Estaba mal: sin axial se tomaba el mayor de los dos ratios en vez de sumarlos, del
         lado inseguro (salió al escribir el ejemplo de la separación de pórticos). */
      if (Mux !== 0 && Muy !== 0) {
        const v = Math.abs(Mux) / Mcx + Math.abs(Muy) / Mcy;
        ratios.push({ estado: "flexión biaxial · H1-1b con Pr = 0", valor: v, art: ART["H.biaxial"], cap: "H", manda: true });
      }
    }

    if (!ratios.length) {
      throw new Error(
        "elemento: «" + id + "» no tiene ninguna fuerza que comprobar.\n" +
        "  Pasa al menos una de Pu_kgf, Mux_kgfcm, Muy_kgfcm o Vu_kgf. Un elemento\n" +
        "  sin fuerzas no es un elemento que cumple: es uno que no se ha analizado.");
    }

    /* EL QUE GOBIERNA · si hay interacción, manda ella; si no, el mayor. */
    const conH = ratios.filter((x) => x.manda);
    const gob = conH.length
      ? conH[conH.length - 1]
      : ratios.reduce((a, b) => (b.valor > a.valor ? b : a));

    const esenciales = omitidos.filter((x) => x.esencial);
    return {
      id: id, combinacion: comb,
      ratio: gob.valor, gobierna: gob.estado, capitulo: gob.cap, art: gob.art,
      ratios: ratios, omitidos: omitidos,
      cumple: gob.valor <= 1 + 1e-12 && esenciales.length === 0,
      cumpleResistencia: gob.valor <= 1 + 1e-12,
      faltanEsenciales: esenciales.length > 0,
      resumen: "ratio " + gob.valor.toFixed(3) + " por " + gob.estado +
        (comb ? " bajo " + comb : "") +
        (esenciales.length ? " · PERO falta comprobar: " +
          esenciales.map((x) => x.que).join("; ") : ""),
      art_H: ART["H.Pr"]
    };
  }

  /* La peor de varias combinaciones, con la culpable señalada. */
  function envolvente(lista) {
    if (!Array.isArray(lista) || !lista.length) {
      throw new Error("elemento: envolvente() necesita al menos un resultado de verifica()");
    }
    const peor = lista.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    return {
      ratio: peor.ratio, gobierna: peor.gobierna, combinacion: peor.combinacion,
      capitulo: peor.capitulo, cumple: lista.every((x) => x.cumple),
      cuantas: lista.length,
      resumen: peor.resumen,
      todas: lista.map((x) => ({ combinacion: x.combinacion, ratio: x.ratio,
        gobierna: x.gobierna }))
    };
  }

  return { ART, ESTADOS, verifica, envolvente };
});
