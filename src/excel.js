/* =====================================================================
   excel.js — las fórmulas de las hojas, evaluadas aquí

   Las hojas que escribe Galpón llevan FÓRMULAS VIVAS de Excel, no números
   pegados: quien abre el libro ve =Lo*(0.25+4.6/SQRT(Ai)) y puede cambiar
   un dato y ver qué pasa (fila H.formulas).  Eso abre un hueco que con
   números pegados no existía: la fórmula de la hoja y la del motor son DOS
   escrituras de la misma cuenta, y pueden separarse sin que nadie lo vea.

   Este módulo lo cierra.  Evalúa cada fórmula de la hoja como lo haría
   Excel, y la hoja no se escribe si alguna no da el número del motor
   (fila H.coincide).  No es un Excel entero: es el subconjunto que usan
   las hojas, y una función que no conoce LANZA —así nadie escribe en la
   hoja una función que aquí no se ha comprobado—.

   Lo que imita de Excel, porque cambia resultados:
     · el menos unario va ANTES que la potencia: -2^2 = 4
     · la celda vacía vale 0 en una cuenta y "" en una comparación
     · IF solo evalúa la rama que toca
     · los errores (#N/A, #DIV/0!, #VALUE!, #NAME?) se propagan
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir();
  } else {
    raiz.EXCEL = definir();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function exige(c, msg) { if (!c) throw new Error("excel: " + msg); }

  /* ---------- direcciones ---------------------------------------------- */
  function colNum(letras) {
    let n = 0;
    for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  }
  function colLetras(n) {
    let s = "";
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function parte(dir) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(dir);
    exige(m, "«" + dir + "» no es una celda");
    return { c: colNum(m[1]), f: +m[2] };
  }
  function celda(c, f) { return colLetras(c) + f; }

  /* ---------- los errores de Excel ------------------------------------- */
  function Err(codigo) { this.err = codigo; }
  Err.prototype.toString = function () { return this.err; };
  const NA = new Err("#N/A"), DIV0 = new Err("#DIV/0!"), VALOR = new Err("#VALUE!"), NOMBRE = new Err("#NAME?"),
    NUM = new Err("#NUM!");
  const esErr = (x) => x instanceof Err;

  /* ---------- el lector de fórmulas ------------------------------------ */
  const RE_TOKEN = /\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|("(?:[^"]|"")*")|(\$?[A-Za-z]{1,3}\$?\d+(?::\$?[A-Za-z]{1,3}\$?\d+)?)(?![A-Za-z0-9_(])|([A-Za-z_][A-Za-z0-9_.]*)|(<>|<=|>=|[-+*/^&=<>(),%]))/y;
  function tokens(txt) {
    const out = [];
    RE_TOKEN.lastIndex = 0;
    let p = 0;
    while (p < txt.length) {
      if (/^\s*$/.test(txt.slice(p))) break;
      RE_TOKEN.lastIndex = p;
      const m = RE_TOKEN.exec(txt);
      exige(m, "no entiendo «" + txt.slice(p, p + 12) + "» en " + txt);
      p = RE_TOKEN.lastIndex;
      if (m[1] !== undefined) out.push({ t: "num", v: parseFloat(m[1]) });
      else if (m[2] !== undefined) out.push({ t: "str", v: m[2].slice(1, -1).replace(/""/g, '"') });
      else if (m[3] !== undefined) out.push({ t: "ref", v: m[3].replace(/\$/g, "").toUpperCase() });
      else if (m[4] !== undefined) out.push({ t: "id", v: m[4] });
      else out.push({ t: "op", v: m[5] });
    }
    return out;
  }

  /* precedencia de Excel, de menor a mayor: comparación, &, + −, * /, ^, %, unario */
  function analiza(txt) {
    const tk = tokens(txt);
    let i = 0;
    const ve = () => tk[i], es = (v) => tk[i] && tk[i].t === "op" && tk[i].v === v;
    const toma = (v) => { exige(es(v), "falta «" + v + "» en " + txt); i++; };
    function comp() {
      let a = conc();
      while (tk[i] && tk[i].t === "op" && ["=", "<>", "<", ">", "<=", ">="].indexOf(tk[i].v) >= 0) {
        const op = tk[i++].v; a = { op: op, a: a, b: conc() };
      }
      return a;
    }
    function conc() { let a = suma(); while (es("&")) { i++; a = { op: "&", a: a, b: suma() }; } return a; }
    function suma() {
      let a = prod();
      while (es("+") || es("-")) { const op = tk[i++].v; a = { op: op, a: a, b: prod() }; }
      return a;
    }
    function prod() {
      let a = pot();
      while (es("*") || es("/")) { const op = tk[i++].v; a = { op: op, a: a, b: pot() }; }
      return a;
    }
    function pot() { let a = pct(); while (es("^")) { i++; a = { op: "^", a: a, b: pct() }; } return a; }
    function pct() { let a = un(); while (es("%")) { i++; a = { op: "%", a: a }; } return a; }
    function un() {
      if (es("-")) { i++; return { op: "neg", a: un() }; }
      if (es("+")) { i++; return un(); }
      return prim();
    }
    function prim() {
      const t = ve();
      exige(t, "la fórmula se acaba antes de tiempo: " + txt);
      i++;
      if (t.t === "num") return { k: t.v };
      if (t.t === "str") return { k: t.v };
      if (t.t === "ref") return { ref: t.v };
      if (t.t === "op" && t.v === "(") { const e = comp(); toma(")"); return e; }
      if (t.t === "id") {
        if (es("(")) {
          i++;
          const args = [];
          if (!es(")")) { args.push(comp()); while (es(",")) { i++; args.push(comp()); } }
          toma(")");
          const fn = t.v.toUpperCase();
          exige(FUNCIONES[fn], "la función " + fn + " no está comprobada aquí, y no se escribe en la hoja");
          return { fn: fn, args: args };
        }
        if (/^(TRUE|FALSE)$/i.test(t.v)) return { k: /^TRUE$/i.test(t.v) };
        return { nombre: t.v };
      }
      exige(false, "no esperaba «" + t.v + "» en " + txt);
    }
    const arbol = comp();
    exige(i === tk.length, "sobra «" + (tk[i] && tk[i].v) + "» en " + txt);
    return arbol;
  }

  /* ---------- coerciones ---------------------------------------------- */
  function num(x) {
    if (esErr(x)) return x;
    if (x === null || x === undefined) return 0;
    if (typeof x === "boolean") return x ? 1 : 0;
    if (typeof x === "number") return x;
    if (typeof x === "string") {
      if (x.trim() === "") return VALOR;
      const n = Number(x);
      return isFinite(n) ? n : VALOR;
    }
    return VALOR;
  }
  function texto(x) {
    if (esErr(x)) return x;
    if (x === null || x === undefined) return "";
    if (typeof x === "boolean") return x ? "TRUE" : "FALSE";
    return String(x);
  }
  function bool(x) {
    if (esErr(x)) return x;
    if (x === null || x === undefined) return false;
    if (typeof x === "boolean") return x;
    if (typeof x === "number") return x !== 0;
    if (/^TRUE$/i.test(x)) return true;
    if (/^FALSE$/i.test(x)) return false;
    return VALOR;
  }
  /* comparación de Excel: número < texto < lógico; el vacío es 0, "" o FALSE según con quién */
  function compara(a, b) {
    if (a === null || a === undefined) a = typeof b === "string" ? "" : (typeof b === "boolean" ? false : 0);
    if (b === null || b === undefined) b = typeof a === "string" ? "" : (typeof a === "boolean" ? false : 0);
    const rango = (x) => (typeof x === "number" ? 0 : (typeof x === "string" ? 1 : 2));
    if (rango(a) !== rango(b)) return rango(a) - rango(b);
    if (typeof a === "string") { a = a.toLowerCase(); b = b.toLowerCase(); }
    if (typeof a === "boolean") { a = a ? 1 : 0; b = b ? 1 : 0; }
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  /* ---------- las funciones ------------------------------------------- */
  /* cada una recibe (args sin evaluar, ev) para que IF pueda ser perezosa */
  function aplanado(args, ev) {
    const out = [];
    for (const a of args) {
      const v = ev(a, true);
      if (v && v.rango) { for (const x of v.valores) if (typeof x === "number" || esErr(x)) out.push(x); }
      else out.push(num(v));
    }
    return out;
  }
  function numerica(f) {
    return (args, ev) => {
      exige(args.length === f.length, "número de argumentos");
      const xs = args.map((a) => num(ev(a)));
      const e = xs.filter(esErr)[0];
      return e || f.apply(null, xs);
    };
  }
  const FUNCIONES = {
    IF: (args, ev) => {
      exige(args.length >= 2 && args.length <= 3, "IF lleva 2 ó 3 argumentos");
      const c = bool(ev(args[0]));
      if (esErr(c)) return c;
      return c ? ev(args[1]) : (args.length === 3 ? ev(args[2]) : false);
    },
    AND: (args, ev) => {
      let r = true;
      for (const a of args) { const b = bool(ev(a)); if (esErr(b)) return b; r = r && b; }
      return r;
    },
    OR: (args, ev) => {
      let r = false;
      for (const a of args) { const b = bool(ev(a)); if (esErr(b)) return b; r = r || b; }
      return r;
    },
    NOT: (args, ev) => { const b = bool(ev(args[0])); return esErr(b) ? b : !b; },
    MAX: (args, ev) => {
      const xs = aplanado(args, ev); const e = xs.filter(esErr)[0];
      return e || (xs.length ? Math.max.apply(null, xs) : 0);
    },
    MIN: (args, ev) => {
      const xs = aplanado(args, ev); const e = xs.filter(esErr)[0];
      return e || (xs.length ? Math.min.apply(null, xs) : 0);
    },
    SUM: (args, ev) => {
      const xs = aplanado(args, ev); const e = xs.filter(esErr)[0];
      return e || xs.reduce((a, b) => a + b, 0);
    },
    SQRT: numerica((x) => (x < 0 ? NUM : Math.sqrt(x))),
    ABS: numerica(Math.abs),
    ATAN: numerica(Math.atan),
    DEGREES: numerica((x) => x * 180 / Math.PI),
    RADIANS: numerica((x) => x * Math.PI / 180),
    POWER: numerica((a, b) => Math.pow(a, b)),
    PI: () => Math.PI,
    NA: () => NA,
    ISNA: (args, ev) => ev(args[0]) === NA,
    INDEX: (args, ev) => {
      const r = ev(args[0], true);
      exige(r && r.rango, "INDEX necesita un rango");
      const f = num(ev(args[1])), c = args.length > 2 ? num(ev(args[2])) : 1;
      if (esErr(f)) return f;
      if (esErr(c)) return c;
      const ff = r.filas === 1 && args.length === 2 ? 1 : f, cc = r.filas === 1 && args.length === 2 ? f : c;
      if (ff < 1 || ff > r.filas || cc < 1 || cc > r.cols) return new Err("#REF!");
      const v = r.valores[(ff - 1) * r.cols + (cc - 1)];
      return v === null ? 0 : v;
    },
    MATCH: (args, ev) => {
      const x = ev(args[0]);
      if (esErr(x)) return x;
      const r = ev(args[1], true);
      exige(r && r.rango && (r.filas === 1 || r.cols === 1), "MATCH necesita una fila o una columna");
      const tipo = args.length > 2 ? num(ev(args[2])) : 1;
      if (tipo === 0) {
        for (let k = 0; k < r.valores.length; k++) if (r.valores[k] !== null && compara(r.valores[k], x) === 0) return k + 1;
        return NA;
      }
      exige(tipo === 1, "MATCH solo con 0 (exacto) ó 1 (el mayor que no pasa)");
      let pos = NA;
      for (let k = 0; k < r.valores.length; k++) {
        const v = r.valores[k];
        if (v === null || typeof v !== typeof x) continue;
        if (compara(v, x) <= 0) pos = k + 1; else break;
      }
      return pos;
    }
  };

  /* ---------- la hoja --------------------------------------------------
     hoja = { celdas: { "C5": { v } | { f: "=..." } }, nombres: { Vh: "C12" | "H4:H9" } } */
  function evaluador(hoja) {
    const cel = hoja.celdas || {}, nom = hoja.nombres || {};
    const memo = {}, enCurso = {};
    const arboles = {};
    function valorDe(dir) {
      if (memo[dir] !== undefined) return memo[dir];
      const c = cel[dir];
      if (!c) return null;
      if (c.f === undefined) return c.v === undefined || c.v === "" ? null : c.v;
      exige(!enCurso[dir], "referencia circular en " + dir);
      enCurso[dir] = true;
      let v;
      try {
        exige(typeof c.f === "string" && c.f[0] === "=", "la fórmula de " + dir + " no empieza por =");
        const a = arboles[dir] || (arboles[dir] = analiza(c.f.slice(1)));
        v = ev(a);
        if (v && v.rango) v = v.filas * v.cols === 1 ? v.valores[0] : VALOR;
        if (v === null) v = 0;
      } finally { enCurso[dir] = false; }
      memo[dir] = v;
      return v;
    }
    function rango(txt) {
      const [a, b] = txt.split(":");
      const p = parte(a), q = b ? parte(b) : p;
      const valores = [];
      for (let f = Math.min(p.f, q.f); f <= Math.max(p.f, q.f); f++) {
        for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) valores.push(valorDe(celda(c, f)));
      }
      return { rango: true, filas: Math.abs(q.f - p.f) + 1, cols: Math.abs(q.c - p.c) + 1, valores: valores };
    }
    function ev(n, quiereRango) {
      if (n.k !== undefined) return n.k;
      if (n.ref !== undefined || n.nombre !== undefined) {
        let ref = n.ref;
        if (n.nombre !== undefined) {
          ref = nom[n.nombre];
          if (ref === undefined) return NOMBRE;
        }
        if (ref.indexOf(":") >= 0) {
          const r = rango(ref);
          if (quiereRango) return r;
          return r.filas * r.cols === 1 ? r.valores[0] : VALOR;
        }
        const v = valorDe(ref);
        return quiereRango ? { rango: true, filas: 1, cols: 1, valores: [v] } : v;
      }
      if (n.fn) return FUNCIONES[n.fn](n.args, ev);
      if (n.op === "neg") { const x = num(ev(n.a)); return esErr(x) ? x : -x; }
      if (n.op === "%") { const x = num(ev(n.a)); return esErr(x) ? x : x / 100; }
      const a = ev(n.a), b = ev(n.b);
      if (esErr(a)) return a;
      if (esErr(b)) return b;
      if (n.op === "&") return texto(a) + texto(b);
      if (["=", "<>", "<", ">", "<=", ">="].indexOf(n.op) >= 0) {
        const c = compara(a, b);
        return { "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 }[n.op];
      }
      const x = num(a), y = num(b);
      if (esErr(x)) return x;
      if (esErr(y)) return y;
      if (n.op === "+") return x + y;
      if (n.op === "-") return x - y;
      if (n.op === "*") return x * y;
      if (n.op === "/") return y === 0 ? DIV0 : x / y;
      if (n.op === "^") { const r = Math.pow(x, y); return isFinite(r) ? r : NUM; }
      exige(false, "operador «" + n.op + "»");
    }
    return { valor: valorDe, analiza: analiza };
  }

  /* El valor de una celda, o de un nombre */
  function valor(hoja, dir) {
    const e = evaluador(hoja);
    const ref = (hoja.nombres || {})[dir] || dir;
    return e.valor(ref.toUpperCase());
  }

  /* ---------- LA GUARDA · fila H.coincide ------------------------------
     Toda celda con `debe` —el número del motor— se evalúa y se compara.
     Tolerancia relativa 1e-9: es la misma cuenta, no una aproximación. */
  function comprueba(hoja, tol) {
    const t = tol === undefined ? 1e-9 : tol;
    const e = evaluador(hoja);
    const malas = [];
    let n = 0;
    for (const dir of Object.keys(hoja.celdas)) {
      const c = hoja.celdas[dir];
      if (c.debe === undefined) continue;
      n++;
      let sale;
      try { sale = e.valor(dir); } catch (err) { sale = "lanza: " + err.message; }
      let ok;
      if (typeof c.debe === "number") {
        ok = typeof sale === "number" && Math.abs(sale - c.debe) <= t * Math.max(1, Math.abs(c.debe));
      } else {
        ok = String(sale) === String(c.debe);
      }
      if (!ok) malas.push({ celda: dir, que: c.que || "", formula: c.f, debe: c.debe, sale: String(sale) });
    }
    return { comprobadas: n, malas: malas, ok: !malas.length };
  }

  /* las funciones que usa una hoja: todas tienen que estar en FUNCIONES */
  function funciones(hoja) {
    const usadas = {};
    for (const dir of Object.keys(hoja.celdas)) {
      const f = hoja.celdas[dir].f;
      if (!f) continue;
      (function recorre(n) {
        if (!n || typeof n !== "object") return;
        if (n.fn) usadas[n.fn] = true;
        for (const k of ["a", "b"]) if (n[k]) recorre(n[k]);
        if (n.args) n.args.forEach(recorre);
      })(analiza(f.slice(1)));
    }
    return Object.keys(usadas).sort();
  }

  return {
    FUNCIONES, NA, DIV0, VALOR, NOMBRE,
    colNum, colLetras, parte, celda, analiza, evaluador, valor, comprueba, funciones, esErr
  };
});
