/* =====================================================================
   probar_solidos.js — el acero de verdad en la 3D · fila V.solidos

   Lo que se comprueba es lo que en pantalla engañaría sin avisar:
     · que la sección dibujada ES la del catálogo (su área)
     · que cada perfil va orientado como dice el convenio
     · que las caras miran hacia fuera y las tapas cierran
     · que lo que no tiene perfil no desaparece: se dibuja como eje
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const S = require("../src/solidos.js");
const P = require("../src/perfiles.js");
const MON = require("../src/montaje.js");
const INV = require("../src/inventario.js");

comp("la fila que cita existe", Object.keys(S.ART).filter((id) => !INV.existe(id)), []);

/* ---- 1 · LAS SECCIONES SON LAS DEL CATÁLOGO ---- */
const area = (id, o) => S.contornos(P.busca(id), o).reduce((s, c) => s + S.area(c), 0) * 1e4;   /* cm² */
const A = (id) => P.busca(id).A_cm2;
/* sin los radios de acuerdo del laminado: un poco menos que el área del catálogo, nunca más */
for (const id of ["W10X33", "W8X18", "C8X11.5", "WT6X20"]) {
  const r = area(id) / A(id);
  cierto(id + ": el contorno tiene el área del catálogo, menos los radios de acuerdo (" + (100 * r).toFixed(1) + " %)",
    r > 0.96 && r <= 1.0);
}
for (const id of ["L2X2X3/16", "L3X3X1/4", "2L3X3X1/4", "CS200x29"]) {
  cerca(id + ": las alas rectas dan el área del catálogo", area(id, { separacion_cm: 0.9525 }), A(id), 0.01 * A(id));
}
cerca("el HSS se dibuja por fuera: b × h", area("HSS4X4X1/4"), 10.16 * 10.16, 1e-6);
cerca("la varilla, un decágono inscrito en su diámetro", area("VAR1/2"),
  10 / 2 * Math.sin(2 * Math.PI / 10) * Math.pow(1.27 / 2, 2), 1e-9);
comp("el 2L son dos ángulos, y la cartela los separa", S.contornos(P.busca("2L3X3X1/4"), { separacion_cm: 0.9525 }).length, 2);
{
  const [a, b] = S.contornos(P.busca("2L3X3X1/4"), { separacion_cm: 0.9525 });
  const umin = Math.min.apply(null, a.map((p) => p[0])), umax = Math.max.apply(null, b.map((p) => p[0]));
  cerca("espalda con espalda, a media cartela del plano del tijeral", [umin, -umax].reduce((x, y) => x + y) / 2, 0.009525 / 2, 1e-12);
  /* la punta del ala horizontal: el punto más alejado del plano del tijeral */
  const punta = (c) => c.reduce((m, p) => (p[0] > m[0] + 1e-12 ? p : m), [-1, 0]);
  const arriba = S.contornos(P.busca("2L3X3X1/4"), { alasArriba: true })[0];
  const abajo = S.contornos(P.busca("2L3X3X1/4"), {})[0];
  cierto("con las alas arriba en la brida superior y abajo en la inferior",
    punta(arriba)[1] > 0 && punta(abajo)[1] < 0 &&
    Math.max.apply(null, arriba.map((q) => q[1])) - punta(arriba)[1] < 0.00636 &&
    punta(abajo)[1] - Math.min.apply(null, abajo.map((q) => q[1])) < 0.00636);
}
cierto("todo contorno antihorario, para que la normal salga hacia fuera",
  ["W10X33", "C8X11.5", "L2X2X3/16", "2L3X3X1/4", "HSS4X4X1/4", "VAR1/2", "WT6X20", "CS200x29"].every((id) =>
    S.contornos(P.busca(id), { separacion_cm: 1, alasArriba: true }).every((c) => S.area(c) > 0) &&
    S.contornos(P.busca(id), { separacion_cm: 1 }).every((c) => S.area(c) > 0)));
cierto("las tapas cubren el contorno entero, también la I y la C, que no son convexas",
  ["W10X33", "C8X11.5", "L2X2X3/16", "WT6X20"].every((id) => {
    const c = S.contornos(P.busca(id))[0];
    const t = S.triangula(c).reduce((s, [a, b, d]) => s + S.area([c[a], c[b], c[d]]), 0);
    return Math.abs(t - S.area(c)) < 1e-12 && S.triangula(c).length === c.length - 2;
  }));
{
  /* el eje de la barra pasa por el centroide: en la C y el L, desplazados por x̄ e ȳ del catálogo */
  const centroide = (c) => {
    let A = 0, cx = 0, cy = 0;
    for (let k = 0; k < c.length; k++) {
      const p = c[k], q = c[(k + 1) % c.length], w = p[0] * q[1] - q[0] * p[1];
      A += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w;
    }
    return [cx / (3 * A), cy / (3 * A)];
  };
  for (const id of ["L2X2X3/16", "L3X3X1/4"]) {
    const g = centroide(S.contornos(P.busca(id))[0]);
    cierto(id + ": el eje pasa por el centroide (a menos de 1 mm, por los radios de acuerdo)",
      Math.abs(g[0]) < 0.001 && Math.abs(g[1]) < 0.001);
  }
  /* la C del AISC tiene las alas inclinadas y aquí van con su espesor medio: el centroide del
     dibujo cae 1,9 mm del x̄ del catálogo. Sin x̄ caería 14,5 mm. */
  const gC = centroide(S.contornos(P.busca("C8X11.5"))[0]);
  cierto("C8X11.5: el eje pasa por el centroide, a menos de 3 mm (alas inclinadas dibujadas rectas)",
    Math.abs(gC[0]) < 0.003 && Math.abs(gC[1]) < 1e-9);
}
lanza("una familia que no sabe dibujar lo dice", () => S.contornos({ familia: "Z" }), ["Z"]);

/* ---- 2 · LA ORIENTACIÓN, el convenio de la cabecera ---- */
const m3 = MON.monta({ luz_m: 20, largo_m: 60, sepPorticos_m: 6, alturaColumna_m: 6, paneles: 6, peralteApoyo_m: 1.2,
  pendiente: 0.20, cuerdas: "dos_aguas", alma: "howe", panosArriostradosTecho: [5], panosArriostradosFachada: [5],
  columnasHastiales: [5, 10, 15] });
const pos = {};
for (const n of m3.nudos) pos[n.id] = [n.x_m, n.y_m, n.z_m];
const ctx = { pendiente: S.pendienteTecho(m3) };
const ejes = (pred) => { const b = m3.barras.filter(pred)[0]; return S.ejesDe(b, pos[b.i], pos[b.j], ctx); };
const r = (v) => v.map((x) => +x.toFixed(3) + 0);
comp("la columna: el peralte en el plano del pórtico (x), las alas a lo largo de la nave (z)",
  [r(ejes((b) => b.clase === "columna").v).map(Math.abs), r(ejes((b) => b.clase === "columna").u).map(Math.abs)], [[1, 0, 0], [0, 0, 1]]);
const t = Math.atan(0.2);
comp("la correa del faldón izquierdo: el alma perpendicular al techo (inclinada 11,3°)",
  r(ejes((b) => b.clase === "correa" && pos[b.i][0] > 1 && pos[b.i][0] < 9).v), r([-Math.sin(t), Math.cos(t), 0]));
comp("y la del derecho, al otro lado", r(ejes((b) => b.clase === "correa" && pos[b.i][0] > 11 && pos[b.i][0] < 19).v),
  r([Math.sin(t), Math.cos(t), 0]));
comp("la de cumbrera, vertical: el promedio de los dos faldones",
  r(ejes((b) => b.clase === "correa" && Math.abs(pos[b.i][0] - 10) < 1e-6).v), [0, 1, 0]);
comp("la columna hastial: el peralte perpendicular a su muro, que es lo que flecta el viento",
  r(ejes((b) => b.clase === "columna hastial").v).map(Math.abs), [0, 0, 1]);
comp("la viga de alero: el alma vertical", r(ejes((b) => b.clase === "viga de alero").v), [0, 1, 0]);
cierto("los ejes siempre ortonormales y dextrógiros", m3.barras.slice(0, 200).every((b) => {
  const e = S.ejesDe(b, pos[b.i], pos[b.j], ctx);
  const d = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const c = [e.v[1] * e.x[2] - e.v[2] * e.x[1], e.v[2] * e.x[0] - e.v[0] * e.x[2], e.v[0] * e.x[1] - e.v[1] * e.x[0]];
  return Math.abs(d(e.x, e.v)) < 1e-9 && Math.abs(d(e.x, e.u)) < 1e-9 && Math.abs(d(e.u, e.v)) < 1e-9 &&
    Math.abs(d(c, e.u) - 1) < 1e-9;
}));

/* ---- 3 · LA MALLA DEL GALPÓN ---- */
const N = { "columna": "W10X33", "brida superior": "2L3X3X1/4", "brida inferior": "2L3X3X1/4", "diagonal": "L2X2X3/16",
  "montante": "L2X2X3/16", "correa": "C8X11.5", "viga de alero": "C8X11.5", "arriostre de techo": "HSS4X4X1/4",
  "arriostre de fachada": "VAR1", "arriostre vertical": "VAR1/2", "columna hastial": "W8X18" };
const sec = (b) => (N[b.clase] ? P.busca(N[b.clase]) : null);
const m = S.malla(m3, { seccion: sec, separacion_cm: 0.9525 });
const sinP = m3.barras.filter((b) => !N[b.clase]).length;
comp("cada barra con perfil, sólida; las que no tienen, como eje", [m.barras + m.sinPerfil.length, m.sinPerfil.length],
  [m3.barras.length, sinP]);
comp("(las que faltan son las del puntal inferior)", m.sinPerfil.map((x) => x.clase).filter((v, i, a) => a.indexOf(v) === i),
  ["puntal inferior"]);
comp("nueve números por triángulo, posición y normal", [m.posiciones.length, m.normales.length], [m.triangulos * 9, m.triangulos * 9]);
{
  /* la columna: 12 lados × 2 + 2 tapas × 10 = 44 triángulos */
  comp("una W: 12 lados en dos triángulos cada uno y dos tapas de 10", m.porClase.columna / m3.barras.filter((b) => b.clase === "columna").length, 44);
  /* LAS NORMALES MIRAN HACIA FUERA: un poco hacia fuera de cada cara se cae fuera de la
     sección, y un poco hacia dentro, dentro.  (Las caras interiores de las alas miran
     hacia el alma, y están bien: no vale «alejarse del eje».) */
  const b = m3.barras.filter((x) => x.clase === "columna")[0];
  const sola = S.malla(Object.assign({}, m3, { barras: [b] }), { seccion: sec });
  const e = S.ejesDe(b, pos[b.i], pos[b.j], ctx), A0 = pos[b.i];
  const pol = S.contornos(P.busca("W10X33"))[0];
  const dentro = (q) => {
    let c = false;
    for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
      const a = pol[i], d = pol[j];
      if ((a[1] > q[1]) !== (d[1] > q[1]) && q[0] < (d[0] - a[0]) * (q[1] - a[1]) / (d[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  const dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  let fuera = 0, lados = 0;
  for (let k = 0; k < sola.triangulos; k++) {
    const n = [sola.normales[9 * k], sola.normales[9 * k + 1], sola.normales[9 * k + 2]];
    if (Math.abs(dot(n, e.x)) > 0.5) continue;                     /* tapas */
    lados++;
    const c = [0, 1, 2].map((q) => (sola.posiciones[9 * k + q] + sola.posiciones[9 * k + 3 + q] + sola.posiciones[9 * k + 6 + q]) / 3);
    const r0 = [c[0] - A0[0], c[1] - A0[1], c[2] - A0[2]];
    const q = [dot(r0, e.u), dot(r0, e.v)], nq = [dot(n, e.u), dot(n, e.v)], h = 1e-4;
    if (!dentro([q[0] + h * nq[0], q[1] + h * nq[1]]) && dentro([q[0] - h * nq[0], q[1] - h * nq[1]])) fuera++;
  }
  comp("las normales de los lados de una W miran hacia fuera", [fuera, lados], [24, 24]);
}
{
  /* la brida superior, con las alas arriba: lo más alto del sólido queda a ȳ del eje, no a d − ȳ */
  const b = m3.barras.filter((x) => x.clase === "brida superior")[0];
  const m1 = S.malla(Object.assign({}, m3, { barras: [b] }), { seccion: sec, separacion_cm: 0.9525 });
  const e = S.ejesDe(b, pos[b.i], pos[b.j], ctx), A0 = pos[b.i];
  let vmax = -1, vmin = 1;
  for (let k = 0; k < m1.posiciones.length; k += 3) {
    const v = (m1.posiciones[k] - A0[0]) * e.v[0] + (m1.posiciones[k + 1] - A0[1]) * e.v[1] + (m1.posiciones[k + 2] - A0[2]) * e.v[2];
    vmax = Math.max(vmax, v); vmin = Math.min(vmin, v);
  }
  const p2 = P.busca("2L3X3X1/4");
  cierto("la brida superior, con las alas horizontales arriba: el sólido sube ȳ y baja d − ȳ",
    Math.abs(vmax - p2.ybar_cm / 100) < 1e-6 && Math.abs(-vmin - (p2.d_cm - p2.ybar_cm) / 100) < 1e-6);
}
const vis = S.malla(m3, { seccion: sec, visibles: (b) => b.clase === "columna" });
comp("lo que se apaga en «Ver» no se dibuja", vis.barras, m3.barras.filter((b) => b.clase === "columna").length);
const t0 = Date.now();
S.malla(m3, { seccion: sec, separacion_cm: 0.9525 });
cierto("el galpón entero en menos de medio segundo (" + (Date.now() - t0) + " ms)", Date.now() - t0 < 500);

fin();
