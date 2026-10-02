/* =====================================================================
   solidos.js — el galpón con su acero de verdad, para la vista 3D

   La 3D era un alambre: el eje de cada barra.  Servía para revisar la
   geometría, pero no enseñaba el acero —un W10X33 y una varilla de 1/2"
   eran la misma raya—, y el usuario lo pidió: «me gustaría ver el
   material de acero real».

   Esto arma la MALLA: el contorno de cada sección, sacado de las medidas
   del catálogo, extruido a lo largo de su barra con su orientación, en
   triángulos con su normal.  Son funciones puras y se comprueban en Node;
   la plantilla solo los pasa a WebGL con la MISMA matriz de cámara que ya
   se comprobó contra el alambre (vista3d.matriz).

   LO QUE SE SIMPLIFICA, y se dice (fila V.solidos):
     · sin los radios de acuerdo del laminado: esquinas vivas
     · el HSS se dibuja por fuera: un tubo y una barra maciza se ven igual
     · las barras no se recortan en los nudos: se cruzan como los ejes
     · las cartelas, pernos y soldaduras no se dibujan
   Es una vista para ver, no un modelo de fabricación.

   LA ORIENTACIÓN de cada sección es un convenio y va escrito en
   ejesDe(): las columnas y el tijeral con el peralte en el plano del
   pórtico; las correas con el alma perpendicular al techo; la columna
   hastial con el peralte perpendicular a su muro, que es lo que la flecta
   el viento; los 2L de la brida superior con las alas horizontales arriba,
   donde apoyan las correas, y los de la inferior abajo.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.SOLIDOS = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("solidos.js", ["V.solidos"]);

  function exige(c, msg) { if (!c) throw new Error("solidos: " + msg); }
  const CM = 0.01;
  const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const suma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const por = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const largo = (a) => Math.sqrt(punto(a, a));
  const unit = (a) => { const l = largo(a); return l < 1e-12 ? null : por(a, 1 / l); };

  /* ---------- EL CONTORNO DE CADA SECCIÓN ------------------------------
     En el plano de la sección: u a lo ancho, v a lo alto (el peralte).
     En metros, antihorario, alrededor del eje de la barra.  Puede salir
     más de un contorno: el 2L son dos ángulos. */
  function circulo(r, n) {
    const p = [];
    for (let k = 0; k < n; k++) p.push([r * Math.cos(2 * Math.PI * k / n), r * Math.sin(2 * Math.PI * k / n)]);
    return p;
  }
  /* un ángulo con la esquina en (u0, v0), el ala de largo bu hacia su, la de bv hacia sv */
  function angulo(u0, v0, bu, bv, t, su, sv) {
    const p = [[u0, v0], [u0 + su * bu, v0], [u0 + su * bu, v0 + sv * t], [u0 + su * t, v0 + sv * t],
      [u0 + su * t, v0 + sv * bv], [u0, v0 + sv * bv]];
    return su * sv > 0 ? p : p.reverse();            /* siempre antihorario */
  }
  function contornos(p, o) {
    const op = o || {};
    exige(p && p.familia, "contornos() necesita un perfil del catálogo");
    const f = p.familia;
    if (f === "I" || f === "CS" || f === "CVS" || f === "VS") {
      const d = p.d_cm * CM, b = p.bf_cm * CM, tf = p.tf_cm * CM, tw = p.tw_cm * CM;
      const h = d / 2, a = b / 2, w = tw / 2;
      return [[[-a, -h], [a, -h], [a, -h + tf], [w, -h + tf], [w, h - tf], [a, h - tf], [a, h], [-a, h],
        [-a, h - tf], [-w, h - tf], [-w, -h + tf], [-a, -h + tf]]];
    }
    if (f === "C") {
      const d = p.d_cm * CM, b = p.bf_cm * CM, tf = p.tf_cm * CM, tw = p.tw_cm * CM, x = (p.xbar_cm || 0) * CM;
      const h = d / 2, u0 = -x;
      return [[[u0, -h], [u0 + b, -h], [u0 + b, -h + tf], [u0 + tw, -h + tf], [u0 + tw, h - tf], [u0 + b, h - tf],
        [u0 + b, h], [u0, h]]];
    }
    if (f === "T") {
      const d = p.d_cm * CM, b = p.bf_cm * CM, tf = p.tf_cm * CM, tw = p.tw_cm * CM, y = (p.ybar_cm || 0) * CM;
      const top = y, bot = y - d, a = b / 2, w = tw / 2;
      return [[[-w, bot], [w, bot], [w, top - tf], [a, top - tf], [a, top], [-a, top], [-a, top - tf], [-w, top - tf]]];
    }
    if (f === "L") {
      const bu = p.b_cm * CM, bv = p.d_cm * CM, t = p.t_cm * CM;
      const x = (p.xbar_cm || 0) * CM, y = (p.ybar_cm || 0) * CM;
      return [angulo(-x, -y, bu, bv, t, 1, 1)];
    }
    if (f === "2L") {
      /* espalda con espalda, separados por la cartela; las alas horizontales arriba o abajo */
      const bu = p.b_cm * CM, bv = p.d_cm * CM, t = p.t_cm * CM, y = (p.ybar_cm || 0) * CM;
      const g = (op.separacion_cm || 0) * CM / 2;
      const sv = op.alasArriba ? -1 : 1, v0 = op.alasArriba ? y : -y;
      return [angulo(g, v0, bu, bv, t, 1, sv), angulo(-g, v0, bu, bv, t, -1, sv)];
    }
    if (f === "HSS_rect") {
      const b = p.b_cm * CM / 2, h = p.h_cm * CM / 2;
      return [[[-b, -h], [b, -h], [b, h], [-b, h]]];
    }
    if (f === "HSS_red") return [circulo(p.OD_cm * CM / 2, 16)];
    if (f === "VAR") return [circulo(p.d_cm * CM / 2, 10)];
    exige(false, "no sé dibujar la familia «" + f + "»");
  }

  /* área con signo: positiva si es antihoraria */
  function area(pol) {
    let s = 0;
    for (let k = 0; k < pol.length; k++) {
      const a = pol[k], b = pol[(k + 1) % pol.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  }

  /* TAPAS: orejas, para polígonos simples (la I y la C no son convexas) */
  function triangula(pol) {
    const idx = pol.map((_, k) => k), out = [];
    const cruz2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const dentro = (p, a, b, c) => cruz2(a, b, p) >= -1e-15 && cruz2(b, c, p) >= -1e-15 && cruz2(c, a, p) >= -1e-15;
    let guardia = 0;
    while (idx.length > 3 && guardia++ < 1000) {
      let hecho = false;
      for (let k = 0; k < idx.length; k++) {
        const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
        const a = pol[i0], b = pol[i1], c = pol[i2];
        if (cruz2(a, b, c) <= 1e-15) continue;            /* esquina entrante: no es oreja */
        let vacia = true;
        for (const j of idx) {
          if (j === i0 || j === i1 || j === i2) continue;
          if (dentro(pol[j], a, b, c)) { vacia = false; break; }
        }
        if (!vacia) continue;
        out.push([i0, i1, i2]);
        idx.splice(k, 1);
        hecho = true;
        break;
      }
      exige(hecho, "no se pudo triangular la tapa");
    }
    out.push([idx[0], idx[1], idx[2]]);
    return out;
  }

  /* ---------- LA ORIENTACIÓN · el convenio de la cabecera ----------------
     Devuelve { x, u, v }: x a lo largo de la barra, v el peralte, u = v × x... de
     modo que (u, v, x) sea dextrógiro. */
  const Z = [0, 0, 1], Y = [0, 1, 0], X = [1, 0, 0];
  /* la pendiente del faldón en x: derivada de la brida superior; en la cumbrera, el
     promedio de los dos faldones (el alma de la correa de cumbrera sale vertical) */
  function pendienteTecho(m3) {
    const sup = m3.nudos.filter((n) => n.clase === "superior" && Math.abs(n.z_m) < 1e-9).sort((a, b) => a.x_m - b.x_m);
    const y = (x) => {
      if (x <= sup[0].x_m) return sup[0].y_m;
      for (let k = 0; k + 1 < sup.length; k++) {
        if (x <= sup[k + 1].x_m) return sup[k].y_m + (sup[k + 1].y_m - sup[k].y_m) * (x - sup[k].x_m) / (sup[k + 1].x_m - sup[k].x_m);
      }
      return sup[sup.length - 1].y_m;
    };
    const x0 = sup[0].x_m, x1 = sup[sup.length - 1].x_m, h = 1e-3;
    return function (x) {
      const a = Math.max(x0, x - h), b = Math.min(x1, x + h);
      return b > a ? (y(b) - y(a)) / (b - a) : 0;
    };
  }
  function ejesDe(b, A, B, ctx) {
    const x = unit(resta(B, A));
    if (!x) return null;
    let v;
    const c = b.clase;
    if (c === "correa") {
      /* el alma perpendicular al techo: la normal del faldón donde apoya */
      const s = ctx.pendiente(A[0]);
      v = unit([-s, 1, 0]);
    } else if (c === "columna hastial") {
      v = Math.abs(punto(x, Z)) > 0.9 ? X : Z;          /* el peralte, perpendicular a su muro */
    } else if (Math.abs(punto(x, Z)) < 0.9 && (b.plano === "transversal" || c === "columna")) {
      v = cruz(Z, x);                                    /* en el plano del pórtico */
    } else {
      /* el resto: el peralte lo más vertical posible; si la barra es vertical, a lo ancho de la nave */
      v = resta(Y, por(x, punto(Y, x)));
      if (largo(v) < 1e-6) v = resta(X, por(x, punto(X, x)));
    }
    v = unit(resta(v, por(x, punto(v, x))));
    const u = cruz(v, x);
    return { x: x, u: u, v: v };
  }

  /* ---------- LA MALLA -------------------------------------------------
     o = { seccion: (barra) → perfil | null, separacion_cm (la cartela de los 2L), visibles: (barra) → bool }
     Sale: posiciones, normales e índice de barra por vértice (Float32), los triángulos por barra,
     y las barras que no tienen perfil, que se dibujan como línea. */
  function malla(m3, o) {
    exige(m3 && m3.barras && m3.nudos, "malla() necesita el galpón montado");
    const pos = {};
    for (const n of m3.nudos) pos[n.id] = [n.x_m, n.y_m, n.z_m];
    const ctx = { pendiente: pendienteTecho(m3) };
    const P = [], N = [], sin = [], porClase = {}, cache = {};
    let barras = 0;
    for (const b of m3.barras) {
      if (o.visibles && !o.visibles(b)) continue;
      const A = pos[b.i], B = pos[b.j];
      if (!A || !B) continue;
      const p = o.seccion(b);
      if (!p) { sin.push({ id: b.id, clase: b.clase, a: A, b: B }); continue; }
      const e = ejesDe(b, A, B, ctx);
      if (!e) continue;
      const clave = p.id + "|" + b.clase;
      let cs = cache[clave];
      if (!cs) {
        cs = cache[clave] = contornos(p, { separacion_cm: o.separacion_cm, alasArriba: b.clase === "brida superior" })
          .map((pol) => ({ pol: pol, tri: triangula(pol) }));
      }
      const en = (s, q) => suma(suma(s, por(e.u, q[0])), por(e.v, q[1]));
      const n3 = (q) => suma(por(e.u, q[0]), por(e.v, q[1]));
      const t0 = P.length / 9;
      for (const c of cs) {
        const pol = c.pol;
        /* los lados */
        for (let k = 0; k < pol.length; k++) {
          const a = pol[k], d = pol[(k + 1) % pol.length];
          const nn = unit(n3([d[1] - a[1], -(d[0] - a[0])]));        /* hacia fuera, por ser antihorario */
          const a0 = en(A, a), d0 = en(A, d), a1 = en(B, a), d1 = en(B, d);
          P.push.apply(P, a0.concat(d0, d1)); N.push.apply(N, nn.concat(nn, nn));
          P.push.apply(P, a0.concat(d1, a1)); N.push.apply(N, nn.concat(nn, nn));
        }
        /* las dos tapas */
        const atras = por(e.x, -1);
        for (const [i0, i1, i2] of c.tri) {
          P.push.apply(P, en(A, pol[i0]).concat(en(A, pol[i2]), en(A, pol[i1]))); N.push.apply(N, atras.concat(atras, atras));
          P.push.apply(P, en(B, pol[i0]).concat(en(B, pol[i1]), en(B, pol[i2]))); N.push.apply(N, e.x.concat(e.x, e.x));
        }
      }
      porClase[b.clase] = (porClase[b.clase] || 0) + (P.length / 9 - t0);
      barras++;
    }
    return { posiciones: new Float32Array(P), normales: new Float32Array(N), triangulos: P.length / 9,
      barras: barras, sinPerfil: sin, porClase: porClase, art: ART["V.solidos"] };
  }

  return { ART, contornos, area, triangula, ejesDe, pendienteTecho, malla };
});
