/* =====================================================================
   probar_pedestal.js — el pedestal como columna corta, E.060

   Cada número se rehace a mano con las ecuaciones de la norma, no con el
   código: los puntos notables de la curva (compresión pura topada,
   tracción pura, balanceado y flexión pura de una sección de 4 barras),
   la transición de φ, el cortante con y sin tracción, los estribos, el
   cortante-fricción y el anclaje en la zapata.
   ===================================================================== */
"use strict";

const { comp, cerca, cierto, lanza, fin } = require("./_comun.js");
const PD = require("../src/pedestal.js");
const UN = require("../src/unidades.js");
const INV = require("../src/inventario.js");

const MPA = UN.MPA_KGCM2;
const fy = 420 * MPA, fc = 210;
const db = 1.5875, dt = 0.9525, Ab = Math.PI * db * db / 4;
const BASE = { b_cm: 40, l_cm: 60, altura_cm: 120, fc_kgcm2: fc, grado: "60", barra: "5/8", estribo: "3/8",
  rec_cm: 4, junta: "rugosa" };

/* ================================================================
   1 · LA SECCIÓN Y LA CURVA, CON 4 BARRAS EN LAS ESQUINAS
   ================================================================ */
const s4 = PD.seccion(Object.assign({}, BASE, { n: 4 }));
const dp = 4 + dt + db / 2, dd = 60 - dp;          /* a las barras comprimidas y traccionadas */
comp("4 barras: dos en cada cara de ancho b, ninguna en los lados", [s4.nb, s4.ns], [2, 0]);
cerca("al eje de la barra: recubrimiento + estribo + db/2", s4.aEje_cm, dp, 1e-12);
const cv4 = PD.curva(s4, fc, 420);
const Ag = 2400, Ast = 4 * Ab;
const Po = 0.85 * fc * (Ag - Ast) + fy * Ast;
cerca("compresión pura: φPn,max = 0,80·0,70·[0,85·f'c·(Ag − Ast) + fy·Ast] (ec. 10-2)", cv4.phiPnMax,
  0.80 * 0.70 * Po, 1e-9);
cerca("tracción pura: φ·fy·Ast con φ = 0,90", cv4.phiPnt, 0.90 * fy * Ast, 1e-9);
/* el balanceado a mano: la barra traccionada justo en fy */
{
  const ey = 420 / 200000;
  const cb = 0.003 * dd / (0.003 + ey);
  const a = 0.85 * cb;
  const es2 = 0.003 * (cb - dp) / cb;              /* la comprimida */
  const fs2 = Math.min(fy, es2 * 200000 * MPA);
  const Cc = 0.85 * fc * a * 40;
  const Pb = Cc + 2 * Ab * (fs2 - 0.85 * fc) - 2 * Ab * fy;
  cerca("balanceado a mano: Pb = Cc + A's·(f's − 0,85·f'c) − As·fy", cv4.Pb, Pb, 1e-9);
  cerca("y Plim = mín(0,1·f'c·Ag, 0,70·Pb)", cv4.Plim, Math.min(0.1 * fc * Ag, 0.7 * Pb), 1e-9);
}
/* la flexión pura a mano: con solo 4 barras el eje neutro queda POR ENCIMA de las
   barras de arriba (c < d'), que trabajan en tracción elástica y fuera del bloque */
{
  const Es = 200000 * MPA, As = 2 * Ab;
  /* 0,85·f'c·0,85·c·b + As·Es·0,003·(c − d')/c = As·fy */
  const A = 0.85 * fc * 0.85 * 40, k = -As * fy + As * Es * 0.003, m = -As * Es * 0.003 * dp;
  const c = (-k + Math.sqrt(k * k - 4 * A * m)) / (2 * A);
  const fs2 = Es * 0.003 * (c - dp) / c;
  cierto("(a mano: c < d', la barra de arriba tracciona sin fluir y la de abajo fluye)",
    c < dp && fs2 < 0 && -fs2 < fy && 0.003 * (dd - c) / c > 420 / 200000);
  const a = 0.85 * c;
  const Mn = 0.85 * fc * a * 40 * (30 - a / 2) + As * fs2 * (30 - dp) + As * fy * (30 - dp);
  const r = PD.ratioPM(cv4, 0, 0.9 * Mn);
  cerca("flexión pura: con M = 0,90·Mn hecho a mano, el ratio es 1", r.ratio, 1, 1e-9);
}
/* la transición de φ: en cada punto de la curva, φ = 0,9/(1 + 0,2·Pn/Plim) mientras 0,7·Pn < Plim */
{
  const enTransicion = cv4.puntos.filter((p) => p.Pn > 0 && 0.7 * p.Pn < cv4.Plim);
  cierto("hay puntos en la transición", enTransicion.length > 3);
  comp("en todos, φPn baja linealmente: φ = 0,9 − 0,2·φPn/Plim (fila Z.phi.compresion)",
    enTransicion.filter((p) => Math.abs(p.phi - (0.9 - 0.2 * p.phi * p.Pn / cv4.Plim)) > 1e-12).length, 0);
  comp("con tracción φ = 0,90, y con compresión alta 0,70",
    [cv4.puntos.filter((p) => p.Pn < 0).every((p) => p.phi === 0.9),
      cv4.puntos.filter((p) => 0.7 * p.Pn > cv4.Plim).every((p) => p.phi === 0.7)], [true, true]);
}
/* el ratio por el rayo: un punto de la curva da exactamente 1, y la mitad da 0,5 */
{
  const p = cv4.puntos[120];
  cerca("un punto de la curva da ratio 1", PD.ratioPM(cv4, p.phiPn, p.phiMn).ratio, 1, 1e-6);
  cerca("y su mitad, 0,5", PD.ratioPM(cv4, p.phiPn / 2, p.phiMn / 2).ratio, 0.5, 1e-6);
  cerca("compresión sin momento: contra el tope de 0,80·φPo", PD.ratioPM(cv4, cv4.phiPnMax / 2, 0).ratio, 0.5, 1e-9);
  cerca("tracción sin momento: contra φ·fy·Ast", PD.ratioPM(cv4, -cv4.phiPnt / 4, 0).ratio, 0.25, 1e-9);
}

/* ================================================================
   2 · EL PEDESTAL ENTERO
   ================================================================ */
const sol = (P, M, H, fCM) => [{ id: "c", base: "B0", P_kgf: P, M_kgfcm: M, H_kgf: H, factorCM: fCM }];
const ZAP = { h_cm: 60, rec_cm: 7.5, barra_cm: 1.5875 };
const r = PD.disena(Object.assign({}, BASE, { solicitaciones: sol(8000, 3e5, 2000, 1.4), zapata: ZAP }));
comp("busca barras desde el 1 %: 24 cm² / 1,98 = 12,1, en par: 14", r.seccion.n, 14);
cierto("y el reparto llena el perímetro", 2 * r.seccion.nb + 2 * r.seccion.ns === 14);
cerca("su peso: γc·b·l·altura", r.peso_kgf, 2400e-6 * 2400 * 120, 1e-9);
/* el momento en la junta: M − H·altura, con el peso por el factor de la muerta */
{
  const rj = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: sol(8000, 1e5, 2000, 1.4), zapata: ZAP }));
  comp("con el cortante llevado por la altura, manda la junta", rj.flexocompresion.donde, "junta");
  cerca("en la junta: M − H·altura", rj.flexocompresion.Mu_kgfcm, Math.abs(1e5 - 2000 * 120), 1e-9);
  cerca("y P + 1,4·peso", rj.flexocompresion.Pu_kgf, 8000 + 1.4 * rj.peso_kgf, 1e-9);
}
{
  /* el cortante a mano, con compresión: ec. 11-4 */
  const dEf = 60 - dp;
  const Nu = 8000 + 1.4 * r.peso_kgf;
  const Vc = 0.17 * (1 + Nu / Ag / MPA / 14) * Math.sqrt(fc / MPA) * MPA * 40 * dEf;
  cerca("Vc con compresión = 0,17·√f'c·(1 + Nu/(14·Ag))·bw·d (ec. 11-4)", r.estribos.phiVc, 0.85 * Vc, 1e-9);
  comp("con poco cortante los estribos van por §7.10.5.2: mín(16·db, 48·dest, 40) = 25,4 → 25",
    [r.estribos.s_cm, r.estribos.porQue], [25, "como elemento en compresión (§7.10.5.2)"]);
}
{
  /* con tracción: ec. 11-8, que no baja de cero */
  const rt = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: sol(-30000, 0, 1000, 0.9), zapata: ZAP }));
  const dEf = 60 - dp;
  const Nu = -30000 + 0.9 * rt.peso_kgf;
  const Vc = Math.max(0, 0.17 * (1 + 0.29 * Nu / Ag / MPA)) * Math.sqrt(fc / MPA) * MPA * 40 * dEf;
  cerca("Vc con tracción = 0,17·(1 + 0,29·Nu/Ag)·√f'c·bw·d (ec. 11-8)", rt.estribos.phiVc, 0.85 * Vc, 1e-9);
  cierto("(y la tracción sí lo baja)", Vc < 0.17 * Math.sqrt(fc / MPA) * MPA * 40 * dEf);
  comp("con tracción en la junta, las barras se anclan con gancho", rt.anclaje.manda, "gancho en tracción");
  /* el cortante-fricción: Avf sin la cara traccionada, menos la tracción neta */
  const fyv = 420 * MPA;
  const Avf = 14 * Ab - rt.seccion.nb * Ab;
  const AvfEf = Avf - (30000 - 0.9 * rt.peso_kgf) / (0.85 * fyv);
  cerca("fricción: Avf eficaz = Avf − Nt/(φ·fy) (§11.7.7)", rt.friccion.AvfEficaz_cm2, AvfEf, 1e-9);
  cerca("y φVn = φ·μ·Avf·fy con μ = 1,0 en junta rugosa", rt.friccion.phiVn, 0.85 * 1.0 * AvfEf * fyv, 1e-9);
}
{
  /* mucho cortante: estribos por la ec. 11-15 */
  const rv = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: sol(8000, 0, 40000, 1.4), zapata: ZAP }));
  const e = rv.estribos, dEf = 60 - dp;
  const Av = 2 * Math.PI * dt * dt / 4;
  const sVs = Av * fy * dEf / e.Vs;
  cierto("con Vu > φVc hace falta Vs y la separación sale de Av·fyt·d/s", e.Vs > 0 && e.porQue === "por el cortante (ec. 11-15)");
  comp("s = piso de Av·fyt·d/Vs", e.s_cm, Math.floor(sVs));
  cierto("y no pasa de 0,66·√f'c·bw·d (§11.5.7.9)", e.VsMax === 0.66 * Math.sqrt(fc / MPA) * MPA * 40 * dEf);
}
{
  /* el anclaje: ℓdg = 0,24·fy/√f'c·db, y el peralte que pide */
  const ldg = 0.24 * 420 / Math.sqrt(fc / MPA) * db;
  cerca("ℓdg = 0,24·fy/√f'c·db = 22,2·db con Grado 60 y 210 (§12.5.2)", r.anclaje.ldg_cm, ldg, 1e-9);
  cerca("ℓdc = máx(0,24·fy/√f'c, 0,043·fy)·db (§12.3.2)", r.anclaje.ldc_cm,
    Math.max(0.24 * 420 / Math.sqrt(fc / MPA), 0.043 * 420) * db, 1e-9);
  cerca("h mínimo de zapata = ℓ + recubrimiento + 2 barras de la parrilla", r.anclaje.hMin_cm,
    r.anclaje.l_cm + 7.5 + 2 * 1.5875, 1e-12);
  const corta = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: sol(8000, 3e5, 2000, 1.4),
    zapata: Object.assign({}, ZAP, { h_cm: 40 }) }));
  cierto("CON UNA ZAPATA DE 40 cm LAS BARRAS NO SE ANCLAN: falla y lo dice",
    corta.fallas.indexOf("anclaje en la zapata") >= 0 && corta.anclaje.hMin_cm > 45);
  comp("los dowels: el 1 % del pedestal cubre el 0,5 % de §15.8.2.1", r.anclaje.dowels.cumple, true);
  /* sin momento y en compresión, no traccionan */
  const rc = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: sol(30000, 0, 0, 1.4), zapata: ZAP }));
  comp("en compresión pura manda ℓdc", rc.anclaje.manda, "compresión");
}

/* ================================================================
   3 · LAS GUARDAS Y LOS LÍMITES
   ================================================================ */
{
  const S = sol(8000, 3e5, 2000, 1.4);
  const largo = PD.verifica(Object.assign({}, BASE, { n: 14, altura_cm: 150, solicitaciones: S, zapata: ZAP }));
  cierto("150 cm sobre 40: ya no es pedestal (3,75 > 3) y k·ℓu/r = 2·150/12 = 25 > 22",
    !largo.esbeltez.esPedestal && Math.abs(largo.esbeltez.kLr_fuera - 25) < 1e-12 && largo.fallas.indexOf("esbeltez") >= 0);
  const justo = PD.verifica(Object.assign({}, BASE, { n: 14, altura_cm: 120, solicitaciones: S, zapata: ZAP }));
  comp("120 sobre 40 = 3: todavía pedestal, no se mira la esbeltez", justo.esbeltez.esPedestal, true);
  const poca = PD.verifica(Object.assign({}, BASE, { n: 10, solicitaciones: S, zapata: ZAP }));
  cierto("10 barras de 5/8\" son el 0,82 %: no llega al 1 %", !poca.cuantia.cumple && poca.fallas.indexOf("cuantía") >= 0);
  const rec = PD.verifica(Object.assign({}, BASE, { n: 14, rec_cm: 3.5, solicitaciones: S, zapata: ZAP }));
  cierto("3,5 cm al estribo no llega a los 40 mm de §7.7.1(b)", rec.fallas.indexOf("recubrimiento") >= 0);
  const gruesa = PD.verifica(Object.assign({}, BASE, { barra: "3/4", n: 10, rec_cm: 4, estribo: "3/8",
    solicitaciones: S, zapata: ZAP }));
  cierto("con 3/4\" la barra pide 50 mm: 4 + 0,95 no llega", !gruesa.recubrimiento.cumple);
  const apretado = PD.verifica(Object.assign({}, BASE, { n: 40, solicitaciones: S, zapata: ZAP }));
  cierto("40 barras de 5/8\" en 40 × 60 no caben con 1,5·db libre (§7.6.3)", apretado.fallas.indexOf("las barras no caben") >= 0);
  const justas = PD.verifica(Object.assign({}, BASE, { n: 28, solicitaciones: S, zapata: ZAP }));
  const pasadas = PD.verifica(Object.assign({}, BASE, { n: 30, solicitaciones: S, zapata: ZAP }));
  cierto("28 barras dejan 3,8 cm libres: menos de 40 mm, no caben; con 26 (4,1 cm) sí",
    justas.fallas.indexOf("las barras no caben") >= 0 && justas.separacion.libre_cm > 2.5 &&
    PD.verifica(Object.assign({}, BASE, { n: 26, solicitaciones: S, zapata: ZAP })).separacion.cumple && !pasadas.separacion.cumple);
  const fino = PD.verifica(Object.assign({}, BASE, { barra: "3/4", estribo: "8mm", n: 10, rec_cm: 5, solicitaciones: S, zapata: ZAP }));
  cierto("con barras de 3/4\" el estribo de 8 mm no basta: 3/8\" (§7.10.5.1)", !fino.estribos.diametroCumple);
  comp("sin datos, dice cuáles faltan", PD.disena({ solicitaciones: S }).faltan.map((f) => f.campo).sort(),
    ["ci_fc", "ci_grado", "ci_junta", "ci_pbarra", "ci_pedb", "ci_pest", "ci_prec"]);
  lanza("una barra que no existe se rechaza", () => PD.seccion(Object.assign({}, BASE, { barra: "7/8", n: 4 })), ["la barra es"]);
  /* mucho momento: disena sube barras hasta que cumple */
  const fuerte = PD.disena(Object.assign({}, BASE, { solicitaciones: sol(5000, 3.5e6, 2000, 1.4), zapata: ZAP }));
  cierto("con mucho momento sube de 14 barras hasta que la flexocompresión cumple",
    fuerte.seccion.n > 14 && fuerte.flexocompresion.ratio <= 1);
  const menos = PD.verifica(Object.assign({}, BASE, { n: fuerte.seccion.n - 2, solicitaciones: sol(5000, 3.5e6, 2000, 1.4), zapata: ZAP }));
  cierto("y con dos barras menos ya no cumplía", menos.flexocompresion.ratio > 1);
  cierto("avisa del segundo orden y del Capítulo 21", r.avisos.some((x) => /B2/.test(x)) && r.avisos.some((x) => /21/.test(x)));
}
cierto("la fila PD.ldg deja escrito el conflicto del mínimo de la E.060", INV.fila("PD.ldg").estado === "conflicto" &&
  /el MENOR valor/.test(INV.fila("PD.ldg").nota));


/* ================================================================
   A LO LARGO: Hz y el momento en b · fila PD.biaxial
   ================================================================ */
{
  /* un pedestal CUADRADO con barras simétricas: girado es el mismo */
  const Q = Object.assign({}, BASE, { b_cm: 50, l_cm: 50, n: 12 });
  const sq = PD.seccion(Q), cvq = PD.curva(sq, fc, 420), cvg = PD.curva(PD.gira(sq), fc, 420);
  cerca("en un pedestal cuadrado y simétrico, la curva girada es la misma", PD.momentoA(cvg, 20000), PD.momentoA(cvq, 20000), 1e-9);
  /* φMn a una P: el de la curva, interpolado */
  const pt = cvq.puntos.filter((x) => x.phiPn > 0 && x.phiMn > 0)[40];
  cierto("φMn a la φPn de un punto de la curva es, al menos, el de ese punto", PD.momentoA(cvq, pt.phiPn) >= pt.phiMn - 1e-6);
  comp("más allá del tope de compresión no hay momento", PD.momentoA(cvq, cvq.phiPnMax * 1.01), 0);
  /* el pedestal real de 40 × 60: en b es más débil */
  const s4 = PD.seccion(Object.assign({}, BASE, { n: 14 }));
  const g4 = PD.gira(s4);
  cerca("girada, las barras quedan en ±(40 − 2·c)/2: la cara de 40 cm es ahora la que flexiona",
    Math.max.apply(null, g4.barras.map((x) => x.y)), (40 - 2 * s4.aEje_cm) / 2, 1e-12);
  comp("con las mismas barras", g4.barras.length, s4.barras.length);
  cierto("en el pedestal de 40 × 60, la capacidad en b es menor que en l",
    PD.momentoA(PD.curva(PD.gira(s4), fc, 420), 10000) < PD.momentoA(PD.curva(s4, fc, 420), 10000));
  /* la verificación: la recta entre las dos capacidades */
  const solz = (P, M, H, Hz) => [{ id: "c", base: "B0", P_kgf: P, M_kgfcm: M, H_kgf: H, Hz_kgf: Hz, factorCM: 1.25 }];
  const r = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: solz(8000, 2e5, 1000, 1500), zapata: ZAP }));
  const Pb = 8000 + 1.25 * r.peso_kgf, Mb = 2e5 - 1000 * 120, My = 1500 * 120;
  const cvx = PD.curva(s4, fc, 420), cvy = PD.curva(PD.gira(s4), fc, 420);
  cerca("con Hz: Mux/φMnx(P) + Muy/φMny(P), con Muy = Hz·altura en la junta", r.flexocompresion.ratio,
    Math.abs(Mb) / PD.momentoA(cvx, Pb) + My / PD.momentoA(cvy, Pb), 1e-9);
  comp("y dice que es en las dos direcciones", r.flexocompresion.donde, "junta, en las dos direcciones");
  /* el cortante a lo largo, con el ancho l y el peralte en b */
  const rz = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: solz(8000, 0, 0, 30000), zapata: ZAP }));
  cerca("el cortante a lo largo se mira con bw = l y d en b", rz.estribos.Vu, 30000, 1e-12);
  {
    const Pz = 8000 + 1.25 * rz.peso_kgf, NuMPa = Pz / (40 * 60) / UN.MPA_KGCM2;
    const dz = 40 - s4.aEje_cm;
    cerca("con φVc = 0,85·0,17·(1 + Nu/14Ag)·√f'c·l·(b − c)", rz.estribos.phiVc,
      0.85 * 0.17 * (1 + NuMPa / 14) * Math.sqrt(fc / UN.MPA_KGCM2) * UN.MPA_KGCM2 * 60 * dz, 1e-9);
  }
  cierto("(y pide estribos por cortante)", /cortante|d\/2|Av,min/.test(rz.estribos.porQue));
  const rf = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: solz(8000, 0, 3000, 4000), zapata: ZAP }));
  cerca("la junta resiste la resultante de los dos cortantes", rf.friccion.Vu, 5000, 1e-12);
  /* Hz que tracciona las barras de una cara: cambia su anclaje */
  const rt = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: solz(3000, 0, 0, 6000), zapata: ZAP }));
  comp("con Hz que dobla el pedestal en b, las barras de una cara traccionan: manda el gancho", rt.anclaje.manda,
    "gancho en tracción");
  const rc = PD.verifica(Object.assign({}, BASE, { n: 14, solicitaciones: solz(30000, 0, 0, 0), zapata: ZAP }));
  comp("(sin él, con compresión pura, no)", rc.anclaje.manda, "compresión");
}

fin();
