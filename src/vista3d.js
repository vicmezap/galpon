/* =====================================================================
   vista3d.js — la cuarta pestaña: ver el galpón entero

   LO QUE AQUÍ SE RESUELVE ES LA PROYECCIÓN, NO EL RASTERIZADO.  Un galpón
   es un alambre de 733 segmentos rectos: dibujarlo no tiene dificultad
   ninguna —lo hace el mismo SVG que las otras tres pestañas— y lo que sí
   la tiene es decidir CÓMO se mira, porque de eso depende si el dibujo se
   puede medir o no.  Así que este módulo son funciones puras: cámara,
   proyección, orden de profundidad.  Entra un punto en metros, sale un
   punto en pantalla, y se comprueba en Node.

   SOBRE EL WEBGL.  El diagrama dice «el renderizador 3D de Retícula es
   WebGL con shaders: se adapta, no se rehace».  No se ha podido: el código
   de Retícula no está en este repositorio y lo que hay de ella en el disco
   son carpetas de exportación de ETABS.  Y para 733 segmentos el WebGL no
   se gana el sueldo: lo que cuesta de un visor de alambre es la cámara, no
   el rasterizado.  Para que el día que aparezca sea un cambio de una línea
   y no un módulo nuevo, matriz() devuelve la MVP de 4×4 en orden de
   columnas —lo que WebGL espera— y la prueba comprueba que la matriz y
   proyecta() dan EL MISMO punto.  El camino está abierto y medido.

   ─────────────────────────────────────────────────────────────────────
   LO QUE JUSTIFICA EL MÓDULO: UNA VISTA QUE INVITA A MEDIR TIENE QUE SER
   MEDIBLE · fila V.isometrica.

   El diagrama llama a esta pestaña «3D (solo ver)», y ahí está el riesgo:
   nadie mira un galpón en perspectiva sin comparar dos cosas con la vista.
   En perspectiva eso es mentira — dos pórticos IDÉNTICOS, el primero y el
   último de la nave, no miden lo mismo en pantalla, y la diferencia no es
   sutil.  En isométrica miden exactamente lo mismo, porque la proyección
   es paralela.

   Por eso la cámara arranca en ISOMÉTRICA y la perspectiva hay que pedirla.
   No es gusto: es que la isométrica no miente sobre longitudes paralelas a
   los ejes, y esta es una pantalla de ingeniería.  distorsion() devuelve el
   número exacto para que la decisión no sea de opinión.

   EL ALAMBRE NO TIENE CARAS, así que no hay oclusión que calcular · fila
   V.profundidad.  La profundidad se transmite de dos maneras y las dos son
   orden, no geometría: se pinta de atrás hacia delante, y lo lejano se
   atenúa.  Decir que esto «quita líneas ocultas» sería falso y aquí no se
   dice: en un alambre no hay nada que ocultar, y por eso se ve el arriostre
   de la fachada de atrás a través de la nave, que para revisar es mejor.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"));
  } else {
    raiz.VISTA3D = definir(raiz.INVENTARIO);
  }
})(typeof self !== "undefined" ? self : this, function (INV) {
  "use strict";

  const ART = INV.declara("vista3d.js", [
    "V.isometrica", "V.profundidad", "MT.ejes"
  ]);

  const GR = Math.PI / 180;

  /* LA ISOMÉTRICA DE VERDAD, no «algo girado que parece 3D».  Para que los
     tres ejes se acorten igual, la elevación tiene que ser exactamente
     atan(1/√2): no es un número elegido, es el que hace que un metro en x,
     uno en y y uno en z midan lo mismo en pantalla.  La prueba lo comprueba
     midiéndolo, no citándolo. */
  const ISO_AZIMUT = 45;
  const ISO_ELEVACION = Math.atan(1 / Math.SQRT2) / GR;   /* ≈ 35,2644° */

  const TIPOS = ["isometrica", "ortografica", "perspectiva"];

  /* ---------- vectores, lo justo ---------------------------------------- */
  function resta(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function punto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cruz(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norma(a) {
    const n = Math.sqrt(punto(a, a));
    if (!(n > 0)) throw new Error("vista3d: vector nulo donde hacía falta una dirección");
    return [a[0] / n, a[1] / n, a[2] / n];
  }

  /* ---------- la cámara -------------------------------------------------
     Ejes del galpón · fila MT.ejes: x transversal, y vertical, z
     longitudinal.  El «arriba» de la cámara es y y no se discute: un galpón
     mirado con el eje vertical torcido no se entiende. */
  function camara(d) {
    const o = d || {};
    const tipo = o.tipo || "isometrica";
    if (TIPOS.indexOf(tipo) < 0) {
      throw new Error("vista3d: la proyección «" + tipo + "» no existe. Las que hay: " +
        TIPOS.join(" · "));
    }
    const iso = tipo === "isometrica";
    const c = {
      tipo: tipo,
      azimut: iso ? ISO_AZIMUT : (o.azimut === undefined ? 35 : o.azimut),
      elevacion: iso ? ISO_ELEVACION : (o.elevacion === undefined ? 25 : o.elevacion),
      objetivo: o.objetivo || [0, 0, 0],
      distancia_m: o.distancia_m === undefined ? 100 : o.distancia_m,
      anchoVista_m: o.anchoVista_m === undefined ? 80 : o.anchoVista_m,
      aspecto: o.aspecto === undefined ? 16 / 9 : o.aspecto
    };
    if (!(c.distancia_m > 0)) throw new Error("vista3d: distancia_m tiene que ser > 0");
    if (!(c.anchoVista_m > 0)) throw new Error("vista3d: anchoVista_m tiene que ser > 0");
    if (!(c.aspecto > 0)) throw new Error("vista3d: aspecto tiene que ser > 0");
    if (Math.abs(c.elevacion) >= 90) {
      throw new Error(
        "vista3d: elevación de " + c.elevacion + "°: mirando desde el cenit exacto la\n" +
        "  dirección de la cámara y el «arriba» se alinean y la base se vuelve\n" +
        "  indefinida. Hay que quedarse por debajo de 90°.");
    }

    /* base de la cámara */
    const a = c.azimut * GR, e = c.elevacion * GR;
    const haciaCamara = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
    c.ojo = [
      c.objetivo[0] + c.distancia_m * haciaCamara[0],
      c.objetivo[1] + c.distancia_m * haciaCamara[1],
      c.objetivo[2] + c.distancia_m * haciaCamara[2]
    ];
    const f = norma(resta(c.objetivo, c.ojo));      /* adelante */
    const r = norma(cruz(f, [0, 1, 0]));            /* derecha */
    const u = cruz(r, f);                           /* arriba de la cámara */
    c.base = { f: f, r: r, u: u };
    c.altoVista_m = c.anchoVista_m / c.aspecto;
    c.paralela = tipo !== "perspectiva";
    c.art = ART["V.isometrica"];
    c.esIsometricaExacta = iso;
    return c;
  }

  /* ---------- proyectar un punto ----------------------------------------
     Devuelve coordenadas normalizadas: −1 a +1 dentro del encuadre, y la
     profundidad en metros delante de la cámara.  Las dos proyecciones
     enseñan EL MISMO ancho en el plano del objetivo, que es lo que hace
     comparable la medida de distorsion(). */
  function proyecta(c, p) {
    const v = resta(p, c.ojo);
    const X = punto(v, c.base.r);
    const Y = punto(v, c.base.u);
    const Z = punto(v, c.base.f);          /* profundidad, positiva delante */
    let x, y;
    if (c.paralela) {
      x = X / (c.anchoVista_m / 2);
      y = Y / (c.altoVista_m / 2);
    } else {
      if (Z <= 1e-9) {
        throw new Error(
          "vista3d: hay un punto detrás de la cámara (profundidad " + Z.toFixed(3) +
          " m).\n  En perspectiva eso no se puede proyectar: lo que saldría es el punto\n" +
          "  espejado, dibujando una barra que no está donde parece. Aleja la cámara\n" +
          "  o usa una proyección paralela.");
      }
      const k = c.distancia_m / Z;
      x = (X * k) / (c.anchoVista_m / 2);
      y = (Y * k) / (c.altoVista_m / 2);
    }
    return { x: x, y: y, prof: Z };
  }

  /* ---------- LA MVP, por si algún día entra WebGL -----------------------
     Orden de COLUMNAS, que es lo que espera gl.uniformMatrix4fv con
     transpose = false.  No se usa para dibujar hoy; existe para que el
     cambio sea de una línea, y la prueba comprueba que coincide con
     proyecta() punto por punto. */
  function matriz(c, cerca, lejos) {
    const n = cerca === undefined ? 0.1 : cerca;
    const f = lejos === undefined ? Math.max(1000, c.distancia_m * 10) : lejos;
    const r = c.base.r, u = c.base.u, d = c.base.f, o = c.ojo;

    /* vista: filas r, u, −f (mirando por −z, convenio de OpenGL) */
    const V = [
      r[0], u[0], -d[0], 0,
      r[1], u[1], -d[1], 0,
      r[2], u[2], -d[2], 0,
      -punto(r, o), -punto(u, o), punto(d, o), 1
    ];

    let P;
    if (c.paralela) {
      const w = c.anchoVista_m / 2, h = c.altoVista_m / 2;
      P = [
        1 / w, 0, 0, 0,
        0, 1 / h, 0, 0,
        0, 0, -2 / (f - n), 0,
        0, 0, -(f + n) / (f - n), 1
      ];
    } else {
      /* el mismo ancho en el plano del objetivo que la paralela */
      const sx = c.distancia_m / (c.anchoVista_m / 2);
      const sy = c.distancia_m / (c.altoVista_m / 2);
      P = [
        sx, 0, 0, 0,
        0, sy, 0, 0,
        0, 0, -(f + n) / (f - n), -1,
        0, 0, -2 * f * n / (f - n), 0
      ];
    }
    return multiplica(P, V);
  }

  /* C = A·B, las dos en orden de columnas */
  function multiplica(A, B) {
    const C = new Array(16);
    for (let col = 0; col < 4; col++) {
      for (let fil = 0; fil < 4; fil++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += A[k * 4 + fil] * B[col * 4 + k];
        C[col * 4 + fil] = s;
      }
    }
    return C;
  }

  /* Aplica una matriz en orden de columnas a [x,y,z,1] y devuelve el punto
     en coordenadas normalizadas, ya dividido por w. */
  function aplica(M, p) {
    const o = [0, 0, 0, 0];
    for (let fil = 0; fil < 4; fil++) {
      o[fil] = M[0 * 4 + fil] * p[0] + M[1 * 4 + fil] * p[1] +
               M[2 * 4 + fil] * p[2] + M[3 * 4 + fil];
    }
    if (Math.abs(o[3]) < 1e-12) {
      throw new Error("vista3d: w = 0 al aplicar la matriz; el punto está en el plano de la cámara");
    }
    return { x: o[0] / o[3], y: o[1] / o[3], z: o[2] / o[3], w: o[3] };
  }

  /* ---------- ENCUADRAR -------------------------------------------------
     Dos cosas, y la segunda no es obvia.

     LA DISTANCIA sale cerrada: la profundidad de un punto es
     dist − (p−objetivo)·haciaCamara, así que basta con que dist supere el
     mayor de esos productos para que nada quede detrás.  Sin iterar.

     EL ANCHO HAY QUE ITERARLO EN PERSPECTIVA, y ahí me equivoqué primero:
     medí la extensión como si la proyección fuera paralela y se me salía
     un nudo del cuadro.  Claro: en perspectiva lo cercano proyecta MÁS
     GRANDE que su tamaño real, así que la extensión paralela se queda
     corta.  Se mide con proyecta() —que ya sabe de perspectiva— y se
     reajusta.  En paralela converge en una pasada y la segunda lo
     confirma; en perspectiva, en dos o tres.  Si no convergiera, PARA:
     un encuadre que se rinde en silencio deja medio galpón fuera. */
  const ENCUADRE_PASADAS = 10;

  function encuadra(m3, c, margen) {
    const mg = margen === undefined ? 1.08 : margen;
    if (!m3.nudos.length) throw new Error("vista3d: encuadra() necesita nudos");
    const ctro = centro(m3);

    /* 1 · la distancia, cerrada */
    const a = c.azimut * GR, e = c.elevacion * GR;
    const hc = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
    let masAtras = -Infinity, radio = 0;
    for (const n of m3.nudos) {
      const v = resta([n.x_m, n.y_m, n.z_m], ctro);
      masAtras = Math.max(masAtras, punto(v, hc));
      radio = Math.max(radio, Math.sqrt(punto(v, v)));
    }
    const dist = Math.max(c.distancia_m, masAtras + radio + 1);

    /* 2 · el ancho, iterado */
    let ancho = c.anchoVista_m, cam = null;
    for (let it = 0; it < ENCUADRE_PASADAS; it++) {
      cam = camara({
        tipo: c.tipo, azimut: c.azimut, elevacion: c.elevacion,
        objetivo: ctro, distancia_m: dist,
        anchoVista_m: ancho, aspecto: c.aspecto
      });
      let sobra = 0;
      for (const n of m3.nudos) {
        const q = proyecta(cam, [n.x_m, n.y_m, n.z_m]);
        sobra = Math.max(sobra, Math.abs(q.x), Math.abs(q.y));
      }
      if (sobra <= 1e-12) break;
      const ajuste = sobra * mg;
      ancho *= ajuste;
      if (Math.abs(ajuste - 1) < 1e-9) break;
      if (it === ENCUADRE_PASADAS - 1) {
        throw new Error(
          "vista3d: el encuadre no converge en " + ENCUADRE_PASADAS + " pasadas.\n" +
          "  Se queda fuera un factor de " + sobra.toFixed(4) + ". Rendirse aquí en\n" +
          "  silencio dejaría medio galpón fuera del cuadro sin que nadie lo note.");
      }
    }
    return cam;
  }

  function centro(m3) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity,
      z0 = Infinity, z1 = -Infinity;
    for (const n of m3.nudos) {
      if (n.x_m < x0) x0 = n.x_m; if (n.x_m > x1) x1 = n.x_m;
      if (n.y_m < y0) y0 = n.y_m; if (n.y_m > y1) y1 = n.y_m;
      if (n.z_m < z0) z0 = n.z_m; if (n.z_m > z1) z1 = n.z_m;
    }
    return [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  }

  /* ---------- LA ESCENA · fila V.profundidad -----------------------------
     Segmentos ya proyectados, ordenados de atrás hacia delante y con su
     atenuación.  Esto NO quita líneas ocultas: un alambre no tiene caras y
     no hay nada que ocultar. Lo lejano se ve a través de lo cercano, y para
     revisar un arriostre eso es mejor que peor. */
  const ATENUACION_MIN = 0.35;

  function escena(m3, c) {
    const pos = {};
    for (const n of m3.nudos) pos[n.id] = n;
    const seg = [];
    let pMin = Infinity, pMax = -Infinity;

    for (const b of m3.barras) {
      const a = pos[b.i], d = pos[b.j];
      if (!a || !d) continue;
      const pa = proyecta(c, [a.x_m, a.y_m, a.z_m]);
      const pb = proyecta(c, [d.x_m, d.y_m, d.z_m]);
      const prof = (pa.prof + pb.prof) / 2;
      if (prof < pMin) pMin = prof;
      if (prof > pMax) pMax = prof;
      seg.push({ id: b.id, clase: b.clase, plano: b.plano,
        a: pa, b: pb, prof: prof });
    }
    /* DE ATRÁS HACIA DELANTE: el pintor más tonto que existe, y el correcto
       para un alambre. */
    seg.sort((p, q) => q.prof - p.prof);

    const rango = pMax - pMin;
    for (const s of seg) {
      s.atenuacion = rango < 1e-9 ? 1
        : ATENUACION_MIN + (1 - ATENUACION_MIN) * (1 - (s.prof - pMin) / rango);
    }
    return {
      camara: c, segmentos: seg,
      profundidadMin_m: pMin, profundidadMax_m: pMax,
      art: ART["V.profundidad"],
      lineasOcultas: false,
      nota: "ordenado de atrás hacia delante y atenuado con la distancia. NO se " +
        "quitan líneas ocultas: un alambre no tiene caras y no hay nada que ocultar."
    };
  }

  /* ---------- LA MEDIDA QUE DECIDE LA PROYECCIÓN · fila V.isometrica -----
     Dos pórticos IDÉNTICOS, el primero y el último de la nave: ¿miden lo
     mismo en pantalla?  En paralela sí, por construcción.  En perspectiva
     no, y aquí se dice cuánto. */
  function distorsion(m3, c) {
    const pos = {};
    for (const n of m3.nudos) pos[n.id] = n;
    const columnas = m3.barras.filter((b) => b.clase === "columna");
    if (!columnas.length) {
      throw new Error("vista3d: distorsion() necesita columnas para comparar");
    }
    const medida = (b) => {
      const a = pos[b.i], d = pos[b.j];
      const pa = proyecta(c, [a.x_m, a.y_m, a.z_m]);
      const pb = proyecta(c, [d.x_m, d.y_m, d.z_m]);
      return { largo: Math.sqrt(Math.pow(pb.x - pa.x, 2) + Math.pow(pb.y - pa.y, 2)),
        prof: (pa.prof + pb.prof) / 2, id: b.id };
    };
    let cerca = null, lejos = null;
    for (const b of columnas) {
      const m = medida(b);
      if (!cerca || m.prof < cerca.prof) cerca = m;
      if (!lejos || m.prof > lejos.prof) lejos = m;
    }
    const razon = lejos.largo / cerca.largo;
    return {
      tipo: c.tipo,
      masCerca: cerca, masLejos: lejos,
      razon: razon,
      errorPorCiento: (1 - razon) * 100,
      medible: c.paralela,
      art: ART["V.isometrica"],
      nota: c.paralela
        ? "proyección paralela: dos columnas iguales miden lo mismo en pantalla " +
          "aunque estén a " + (lejos.prof - cerca.prof).toFixed(1) + " m una de otra. " +
          "El dibujo se puede medir."
        : "perspectiva: la columna más lejana mide el " + (razon * 100).toFixed(1) +
          " % de la más cercana, siendo IDÉNTICAS. El dibujo no se puede medir, y " +
          "nadie mira un galpón en perspectiva sin comparar dos cosas con la vista."
    };
  }

  /* ---------- órbita ---------------------------------------------------- */
  function gira(c, dAzimut, dElevacion) {
    const e = Math.max(-89, Math.min(89, c.elevacion + (dElevacion || 0)));
    return camara({
      tipo: c.tipo === "isometrica" ? "ortografica" : c.tipo,   /* al girar deja de serlo */
      azimut: c.azimut + (dAzimut || 0), elevacion: e,
      objetivo: c.objetivo, distancia_m: c.distancia_m,
      anchoVista_m: c.anchoVista_m, aspecto: c.aspecto
    });
  }

  return {
    ART, TIPOS, ISO_AZIMUT, ISO_ELEVACION, ATENUACION_MIN,
    camara, proyecta, matriz, aplica, multiplica, encuadra, centro,
    ENCUADRE_PASADAS,
    escena, distorsion, gira
  };
});
