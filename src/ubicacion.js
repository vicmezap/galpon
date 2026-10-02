/* =====================================================================
   ubicacion.js — el distrito, y la zona sísmica que le da la norma

   La zona sísmica no se elige: la da el Anexo II de la E.030-2026 por
   distrito (fila S.zona.distrito).  Elegirla a mano es la manera de
   perderla sin darse cuenta —hay CUATRO Miraflores, en Lima (zona 4),
   Arequipa, Huánuco y Yauyos (zona 3)—, así que aquí se elige el DISTRITO
   y la zona sale de la tabla, que es distritos.js, generada del PDF.

   La búsqueda es la de Retícula, que ya la pagó: por palabras sueltas
   —departamento, provincia, distrito o ciudad—, sin tildes ni mayúsculas,
   y con las ciudades que no se llaman como su distrito (Pucallpa es
   Callería, Yarinacocha y Manantay; Puerto Maldonado es Tambopata).

   La clave que se guarda lleva el departamento: «LIMA › LIMA · MIRAFLORES».
   Sin él, una provincia y un distrito pueden repetirse en dos departamentos.
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) {
    module.exports = definir(require("./inventario.js"), require("./distritos.js"));
  } else {
    raiz.UBICACION = definir(raiz.INVENTARIO, raiz.DISTRITOS);
  }
})(typeof self !== "undefined" ? self : this, function (INV, DISTRITOS) {
  "use strict";

  const ART = INV.declara("ubicacion.js", ["S.zona.distrito"]);

  /* las ciudades que no se llaman como su distrito · clave: la de la lista */
  const CIUDAD = {
    "UCAYALI › CORONEL PORTILLO · CALLERÍA": "Pucallpa",
    "UCAYALI › CORONEL PORTILLO · YARINACOCHA": "Pucallpa",
    "UCAYALI › CORONEL PORTILLO · MANANTAY": "Pucallpa",
    "MADRE DE DIOS › TAMBOPATA · TAMBOPATA": "Puerto Maldonado"
  };

  const clave = (f) => f[0] + " › " + f[1] + " · " + f[2];
  const POR_CLAVE = {};
  for (const f of DISTRITOS) POR_CLAVE[clave(f)] = f;

  /* sin tildes y en minúsculas: «Callería» y «CALLERIA» son lo mismo */
  function llano(t) {
    return String(t === null || t === undefined ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  /* el alias se busca sin tildes: la norma escribe «CALLERIA» */
  const CIUDAD_LLANO = {};
  for (const k of Object.keys(CIUDAD)) CIUDAD_LLANO[llano(k)] = CIUDAD[k];
  const ciudad = (k) => CIUDAD_LLANO[llano(k)] || "";
  const INDICE = DISTRITOS.map((f) => llano(clave(f) + " " + ciudad(clave(f))));

  /* lo que se enseña: «UCAYALI › CORONEL PORTILLO · CALLERÍA (Pucallpa) — zona 2» */
  function etiqueta(k) {
    const f = POR_CLAVE[k];
    if (!f) return k;
    return k + (ciudad(k) ? " (" + ciudad(k) + ")" : "") + " — zona " + f[3];
  }

  /* los distritos cuyo departamento, provincia, distrito o ciudad tienen TODAS las palabras, en el orden
     del Anexo; como mucho `max`. Sin texto, ninguno: 1892 opciones no son una lista que se pueda leer. */
  function buscar(texto, max) {
    const pal = llano(texto).split(/[\s·›,]+/).filter(Boolean);
    if (!pal.length) return [];
    const out = [];
    for (let i = 0; i < DISTRITOS.length && out.length < (max || 60); i++) {
      if (pal.every((p) => INDICE[i].indexOf(p) >= 0)) out.push(clave(DISTRITOS[i]));
    }
    return out;
  }

  /* la zona del distrito, o null si la clave no está en el Anexo */
  function zona(k) {
    const f = POR_CLAVE[k];
    return f ? "Z" + f[3] : null;
  }
  function existe(k) { return !!POR_CLAVE[k]; }
  function partes(k) {
    const f = POR_CLAVE[k];
    return f ? { departamento: f[0], provincia: f[1], distrito: f[2], zona: "Z" + f[3] } : null;
  }

  return { ART, CIUDAD, total: DISTRITOS.length, llano, clave, etiqueta, buscar, zona, existe, partes };
});
