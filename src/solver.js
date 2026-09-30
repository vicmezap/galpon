/* =====================================================================
   solver.js — rigidez directa, pórtico plano de primer orden

   Tres grados de libertad por nudo.  Matriz de rigidez ensamblada, sistema
   resuelto por eliminación con pivoteo parcial, y fuerzas de barra
   recuperadas en coordenadas locales.

   LA CONVERSIÓN DE UNIDADES OCURRE AQUÍ Y SOLO AQUÍ, al entrar.  El modelo
   guarda geometría en METROS y secciones en CENTÍMETROS, porque así vienen
   las dos fuentes.  Dentro de la matriz todo es centímetro, kgf y kgf·cm.
   Mezclar m y cm en una matriz de rigidez da números que parecen razonables
   y están ocho órdenes de magnitud mal.

   LA LIBERACIÓN DE EXTREMOS se hace por CONDENSACIÓN ESTÁTICA del grado de
   libertad liberado, sobre la matriz 6×6 y sobre el vector de fuerzas de
   empotramiento a la vez.  Eso es lo que hace que la armadura salga gratis
   (fila E.armadura) y, lo que importa más, que salga BIEN con carga
   transversal: una barra con los dos giros liberados y carga repartida se
   convierte en una viga simplemente apoyada, con sus reacciones de extremo
   correctas. Liberar el giro poniendo la inercia a cero no haría eso.

   EL EQUILIBRIO NO SE COMPRUEBA A MANO, LO COMPRUEBA EL SOLUCIONADOR.  Al
   terminar suma reacciones y cargas aplicadas y exige que se anulen, en
   fuerzas y en momentos respecto del origen.  Si no se anulan, LANZA.  Es el
   equivalente aquí de las siete relaciones de las propiedades de sección: un
   error de ensamblaje, de signo o de condensación se delata solo.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./modelo.js"));
  } else {
    raiz.SOLVER = definir(raiz.INVENTARIO, raiz.MODELO);
  }
})(typeof self !== "undefined" ? self : this, function (INV, MODELO) {
  "use strict";

  const ART = INV.declara("solver.js", ["E.armadura", "E.C1.nivel", "E.C2.k080"]);

  /* Tolerancia del control de equilibrio, RELATIVA a la mayor carga aplicada.
     1e-8 deja sitio al redondeo de la eliminación gaussiana en un pórtico de
     unos cientos de grados de libertad, y sigue siendo mil veces más estricta
     que cualquier error real de ensamblaje. */
  const TOL_EQUILIBRIO = 1e-8;

  /* Un grado de libertad cuya rigidez diagonal sea menor que esta fracción de
     la mayor de la matriz se considera SIN rigidez. Pasa de verdad y no es un
     error: el giro de un nudo donde solo concurren barras de armadura. */
  const TOL_RIGIDEZ = 1e-12;

  /* Pivote mínimo, relativo a la mayor rigidez diagonal de la matriz.
     Por debajo de esto la matriz es singular a efectos prácticos: hay un
     mecanismo. Ver la nota de resuelveSistema(). */
  const TOL_PIVOTE = 1e-11;

  /* ---------- álgebra mínima -------------------------------------------- */
  function ceros(n, m) {
    const a = new Array(n);
    for (let i = 0; i < n; i++) { a[i] = new Array(m).fill(0); }
    return a;
  }

  /* Eliminación de Gauss con pivoteo parcial.  Resuelve A·x = b y destruye A.

     EL PIVOTE SE COMPARA CONTRA LA ESCALA DE LA MATRIZ, no contra cero. Lo
     tuve contra cero y un mecanismo real NO lo disparaba: la condensación de
     las liberaciones deja un residuo de redondeo del orden de 1e-12 en la
     diagonal, así que el pivote no es exactamente nulo, la eliminación sigue,
     y salen desplazamientos enormes sin que nada avise.  Y el control de
     equilibrio TAMPOCO lo caza, porque K·U = F se cumple igual de bien con
     una solución absurda. Esta es la única guarda que lo ve. */
  function resuelveSistema(A, b, escala) {
    const n = b.length;
    const x = new Array(n).fill(0);
    let esc = escala;
    if (!(esc > 0)) {
      esc = 0;
      for (let i = 0; i < n; i++) esc = Math.max(esc, Math.abs(A[i][i]));
    }
    const minPivote = TOL_PIVOTE * (esc || 1);
    for (let k = 0; k < n; k++) {
      let p = k, mx = Math.abs(A[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(A[i][k]) > mx) { mx = Math.abs(A[i][k]); p = i; }
      }
      if (mx <= minPivote) {
        throw new Error(
          "solver: la matriz de rigidez es SINGULAR en la ecuación " + k + ".\n" +
          "  La estructura tiene un mecanismo: algún grado de libertad puede\n" +
          "  moverse sin que nada se oponga. Mira los apoyos y las liberaciones\n" +
          "  de extremo — una barra con los dos giros liberados no aporta rigidez\n" +
          "  de flexión a sus nudos.");
      }
      if (p !== k) { const t = A[p]; A[p] = A[k]; A[k] = t; const s = b[p]; b[p] = b[k]; b[k] = s; }
      for (let i = k + 1; i < n; i++) {
        const f = A[i][k] / A[k][k];
        if (f === 0) continue;
        for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
        b[i] -= f * b[k];
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  /* ---------- la barra --------------------------------------------------- */
  /* Rigidez local 6×6 en el orden [ui, vi, θi, uj, vj, θj], con EA/L para el
     axial y la viga de Euler-Bernoulli para la flexión. */
  function kLocal(b, fr) {
    const E = b.E_kgcm2 * fr, A = b.A_cm2, I = b.I_cm4, L = b.L_cm;
    const ea = E * A / L;
    const z = 12 * E * I / (L * L * L);
    const y = 6 * E * I / (L * L);
    const c = 4 * E * I / L, d = 2 * E * I / L;
    return [
      [ ea,  0,   0,  -ea,  0,   0 ],
      [ 0,   z,   y,   0,  -z,   y ],
      [ 0,   y,   c,   0,  -y,   d ],
      [-ea,  0,   0,   ea,  0,   0 ],
      [ 0,  -z,  -y,   0,   z,  -y ],
      [ 0,   y,   d,   0,  -y,   c ]
    ];
  }

  /* Fuerzas de empotramiento perfecto de una carga uniforme perpendicular w
     (kgf/cm en local +y), en el mismo orden de grados de libertad.

     SON LAS QUE HAY QUE APLICAR AL ELEMENTO PARA QUE NO SE MUEVA, o sea que
     se OPONEN a la carga: con w hacia abajo, los cortantes de empotramiento
     van hacia arriba.  De ahí los signos negativos.  Luego el ensamblaje hace
     F -= f, y la carga equivalente en el nudo vuelve a apuntar hacia donde
     apunta la carga, que es lo único que tiene sentido.

     Lo puse al revés en la primera versión y el control de equilibrio lo
     delató en la primera corrida: ΣFy salía el doble de la carga y con el
     signo cambiado, porque la carga equivalente empujaba hacia arriba. */
  function fEmpotramiento(w, L) {
    return [0, -w * L / 2, -w * L * L / 12, 0, -w * L / 2, w * L * L / 12];
  }

  /* CONDENSACIÓN ESTÁTICA del grado de libertad r: se impone que la fuerza
     asociada sea nula y se elimina la incógnita.  Se aplica a la matriz y al
     vector de fuerzas A LA VEZ, que es lo que hace correcta la liberación con
     carga repartida. */
  function condensa(k, f, r) {
    const krr = k[r][r];
    if (Math.abs(krr) < 1e-30) return;      /* ya no aporta nada */
    const col = k.map((fila) => fila[r]);
    const fil = k[r].slice();
    const fr = f[r];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) k[i][j] -= col[i] * fil[j] / krr;
      f[i] -= col[i] * fr / krr;
    }
    for (let i = 0; i < 6; i++) { k[i][r] = 0; k[r][i] = 0; }
    f[r] = 0;
  }

  /* Matriz de rotación local -> global, por bloques. */
  function seno_cos(b, nudos) {
    const ni = nudos[b.i], nj = nudos[b.j];
    const dx = (nj.x_m - ni.x_m) * 100, dy = (nj.y_m - ni.y_m) * 100;
    return { c: dx / b.L_cm, s: dy / b.L_cm };
  }

  function rota(b, nudos) {
    const { c, s } = seno_cos(b, nudos);
    const T = ceros(6, 6);
    for (const o of [0, 3]) {
      T[o][o] = c;   T[o][o + 1] = s;
      T[o + 1][o] = -s;  T[o + 1][o + 1] = c;
      T[o + 2][o + 2] = 1;
    }
    return T;   /* u_local = T · u_global */
  }

  function mulMV(M, v) {
    const n = M.length, out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < v.length; j++) s += M[i][j] * v[j]; out[i] = s; }
    return out;
  }

  /* ---------- el solucionador ------------------------------------------- */
  function resuelve(m, opciones) {
    MODELO.valida(m);
    const op = opciones || {};
    /* Factor sobre TODAS las rigideces · fila E.C2.k080.  Por omisión 1: el
       0,80 del Método Directo lo aplica estabilidad.js, que es quien sabe si
       estamos haciendo un análisis de estabilidad o una deflexión de servicio. */
    const fr = (op.factorRigidez === undefined) ? 1 : op.factorRigidez;
    if (!(fr > 0 && fr <= 1)) {
      throw new Error("solver: factorRigidez tiene que estar en (0, 1]; llegó " + fr);
    }

    const nudos = {};
    const indice = {};
    let ngdl = 0;
    for (const n of m.nudos) {
      nudos[n.id] = n;
      indice[n.id] = { ux: ngdl++, uy: ngdl++, rz: ngdl++ };
    }

    /* --- ensamblaje --- */
    const K = ceros(ngdl, ngdl);
    const F = new Array(ngdl).fill(0);
    const porBarra = {};

    for (const b of m.barras) {
      let k = kLocal(b, fr);
      let f = [0, 0, 0, 0, 0, 0];
      /* carga repartida de esta barra, kgf/m -> kgf/cm */
      let w = 0;
      for (const c of m.cargasBarra) if (c.barra === b.id) w += c.w_kgfm / 100;
      if (w !== 0) f = fEmpotramiento(w, b.L_cm);

      /* liberaciones: el giro es el gdl 2 en i y el 5 en j */
      if (b.liberaI) condensa(k, f, 2);
      if (b.liberaJ) condensa(k, f, 5);

      const T = rota(b, nudos);
      /* K_global = Tᵀ·k·T   ·   F_global = Tᵀ·f */
      const kg = ceros(6, 6);
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          let s = 0;
          for (let a = 0; a < 6; a++) {
            for (let d = 0; d < 6; d++) s += T[a][i] * k[a][d] * T[d][j];
          }
          kg[i][j] = s;
        }
      }
      const fg = new Array(6).fill(0);
      for (let i = 0; i < 6; i++) { let s = 0; for (let a = 0; a < 6; a++) s += T[a][i] * f[a]; fg[i] = s; }

      const gi = indice[b.i], gj = indice[b.j];
      const g = [gi.ux, gi.uy, gi.rz, gj.ux, gj.uy, gj.rz];
      for (let i = 0; i < 6; i++) {
        /* las fuerzas de empotramiento van al vector de cargas CON SIGNO
           MENOS: son las que la barra ejerce sobre el nudo */
        F[g[i]] -= fg[i];
        for (let j = 0; j < 6; j++) K[g[i]][g[j]] += kg[i][j];
      }
      porBarra[b.id] = { k: k, f: f, T: T, g: g, w_kgfcm: w };
    }

    /* cargas aplicadas en nudos */
    for (const c of m.cargasNudo) {
      const g = indice[c.nudo];
      F[g.ux] += c.Fx_kgf; F[g.uy] += c.Fy_kgf; F[g.rz] += c.Mz_kgfcm;
    }

    /* --- grados de libertad restringidos --- */
    const fijo = new Array(ngdl).fill(false);
    for (const n of m.nudos) {
      for (const gg of MODELO.GDL) if (n.apoyo[gg]) fijo[indice[n.id][gg]] = true;
    }

    /* UN GIRO SIN RIGIDEZ NO ES UN ERROR: es un nudo donde solo concurren
       barras de armadura.  Se restringe y se anota.  Pero si ahí hay un
       momento aplicado, el modelo es imposible y hay que decirlo. */
    let maxDiag = 0;
    for (let i = 0; i < ngdl; i++) maxDiag = Math.max(maxDiag, Math.abs(K[i][i]));
    const girosSinRigidez = [];
    for (const n of m.nudos) {
      const ir = indice[n.id].rz;
      if (fijo[ir]) continue;
      if (Math.abs(K[ir][ir]) > TOL_RIGIDEZ * maxDiag) continue;
      if (Math.abs(F[ir]) > 1e-9) {
        throw new Error(
          "solver: el nudo «" + n.id + "» tiene un momento aplicado pero su giro no\n" +
          "  tiene rigidez: solo concurren barras con el giro liberado.\n" +
          "  Un momento en una rótula no se puede equilibrar. O la barra no debe\n" +
          "  liberar su giro, o el momento va en otro sitio.");
      }
      fijo[ir] = true;
      girosSinRigidez.push(n.id);
    }

    const libres = [];
    for (let i = 0; i < ngdl; i++) if (!fijo[i]) libres.push(i);
    if (!libres.length) {
      throw new Error("solver: no hay ningún grado de libertad libre; todo está restringido");
    }

    /* --- sistema reducido --- */
    const Kr = ceros(libres.length, libres.length);
    const Fr = new Array(libres.length).fill(0);
    for (let a = 0; a < libres.length; a++) {
      Fr[a] = F[libres[a]];
      for (let b2 = 0; b2 < libres.length; b2++) Kr[a][b2] = K[libres[a]][libres[b2]];
    }
    /* La escala se toma de la diagonal ORIGINAL: después de eliminar ya
       está contaminada por los multiplicadores. */
    let escalaK = 0;
    for (let a = 0; a < libres.length; a++) escalaK = Math.max(escalaK, Math.abs(Kr[a][a]));
    const xr = resuelveSistema(Kr, Fr.slice(), escalaK);

    const U = new Array(ngdl).fill(0);
    for (let a = 0; a < libres.length; a++) U[libres[a]] = xr[a];

    /* --- reacciones: R = K·U − F, solo en los gdl restringidos --- */
    const R = new Array(ngdl).fill(0);
    for (let i = 0; i < ngdl; i++) {
      if (!fijo[i]) continue;
      let s = 0;
      for (let j = 0; j < ngdl; j++) s += K[i][j] * U[j];
      R[i] = s - F[i];
    }

    /* --- fuerzas de barra en LOCAL: q = k·(T·u) + f --- */
    const fuerzas = {};
    for (const b of m.barras) {
      const p = porBarra[b.id];
      const ug = p.g.map((i) => U[i]);
      const ul = mulMV(p.T, ug);
      const q = mulMV(p.k, ul);
      for (let i = 0; i < 6; i++) q[i] += p.f[i];
      fuerzas[b.id] = {
        /* Convenio de esfuerzos INTERNOS: axial positivo = TRACCIÓN. La fuerza
           local en i apunta hacia −x cuando la barra está en tracción, así que
           N = −q[0]. Es el signo que espera el diseño del Cap. D. */
        N_i_kgf: -q[0], V_i_kgf: q[1], M_i_kgfcm: q[2],
        N_j_kgf: q[3], V_j_kgf: q[4], M_j_kgfcm: q[5],
        N_kgf: (-q[0] + q[3]) / 2,
        traccion: (-q[0] + q[3]) / 2 > 0,
        L_cm: b.L_cm
      };
    }

    /* --- EL CONTROL DE EQUILIBRIO, que no es opcional --- */
    const eq = equilibrio(m, nudos, indice, R);

    return {
      nombre: m.nombre, nivel: m.nivel, combinacion: m.combinacion,
      factorRigidez: fr,
      ngdl: ngdl, gdlLibres: libres.length,
      girosSinRigidez: girosSinRigidez,
      desplaza: function (id, g) { return U[indice[id][g]]; },
      reaccion: function (id, g) { return R[indice[id][g]]; },
      U: U, R: R, indice: indice,
      barra: function (id) {
        if (!fuerzas[id]) throw new Error("solver: la barra «" + id + "» no está en el resultado");
        return fuerzas[id];
      },
      fuerzas: fuerzas,
      equilibrio: eq,
      art: ART["E.armadura"]
    };
  }

  /* Suma cargas aplicadas y reacciones. Tienen que anularse en ΣFx, ΣFy y ΣM
     respecto del origen.  Si no, hay un error de ensamblaje, de signo o de
     condensación, y es mejor que pare aquí que tres etapas más adelante. */
  function equilibrio(m, nudos, indice, R) {
    let Fx = 0, Fy = 0, Mo = 0, escala = 0;

    for (const c of m.cargasNudo) {
      const n = nudos[c.nudo];
      Fx += c.Fx_kgf; Fy += c.Fy_kgf;
      Mo += c.Mz_kgfcm + c.Fy_kgf * (n.x_m * 100) - c.Fx_kgf * (n.y_m * 100);
      escala = Math.max(escala, Math.abs(c.Fx_kgf), Math.abs(c.Fy_kgf));
    }
    for (const c of m.cargasBarra) {
      const b = MODELO.buscaBarra(m, c.barra);
      const ni = nudos[b.i], nj = nudos[b.j];
      const dx = (nj.x_m - ni.x_m) * 100, dy = (nj.y_m - ni.y_m) * 100;
      /* w es perpendicular al eje local: en global vale w·(−s, c)·L */
      const w = c.w_kgfm / 100, L = b.L_cm;
      const cs = dx / L, sn = dy / L;
      const Rx = -w * L * sn, Ry = w * L * cs;
      const xm = (ni.x_m + nj.x_m) / 2 * 100, ym = (ni.y_m + nj.y_m) / 2 * 100;
      Fx += Rx; Fy += Ry;
      Mo += Ry * xm - Rx * ym;
      escala = Math.max(escala, Math.abs(Rx), Math.abs(Ry));
    }
    for (const n of m.nudos) {
      const g = indice[n.id];
      const rx = R[g.ux], ry = R[g.uy], mz = R[g.rz];
      Fx += rx; Fy += ry;
      Mo += mz + ry * (n.x_m * 100) - rx * (n.y_m * 100);
      escala = Math.max(escala, Math.abs(rx), Math.abs(ry));
    }

    const ref = Math.max(escala, 1);
    const out = { Fx: Fx, Fy: Fy, Mo: Mo, escala: ref,
      relFx: Math.abs(Fx) / ref, relFy: Math.abs(Fy) / ref,
      relM: Math.abs(Mo) / (ref * 100) };
    out.cuadra = out.relFx < TOL_EQUILIBRIO && out.relFy < TOL_EQUILIBRIO &&
                 out.relM < TOL_EQUILIBRIO;
    if (!out.cuadra) {
      throw new Error(
        "solver: EL EQUILIBRIO NO CUADRA, así que el resultado no vale.\n" +
        "  ΣFx = " + Fx.toExponential(3) + " kgf   (relativo " + out.relFx.toExponential(2) + ")\n" +
        "  ΣFy = " + Fy.toExponential(3) + " kgf   (relativo " + out.relFy.toExponential(2) + ")\n" +
        "  ΣM  = " + Mo.toExponential(3) + " kgf·cm (relativo " + out.relM.toExponential(2) + ")\n" +
        "  Cargas aplicadas y reacciones tienen que anularse. Que no lo hagan\n" +
        "  señala un error de ensamblaje, de signo o de condensación de una\n" +
        "  liberación de extremo — no un problema de la estructura.");
    }
    return out;
  }

  return { ART, TOL_EQUILIBRIO, TOL_PIVOTE, resuelve, resuelveSistema, kLocal, fEmpotramiento, condensa };
});
