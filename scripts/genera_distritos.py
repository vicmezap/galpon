# -*- coding: utf-8 -*-
"""Genera src/distritos.js: la zona sísmica de cada distrito, del Anexo II de la
E.030-2026, leída del PDF de la norma con las posiciones de su tabla.

    python scripts/genera_distritos.py

El texto plano del Anexo sale desordenado (las celdas de zona están combinadas
y el número queda lejos de sus distritos), así que se lee la TABLA: PyMuPDF
devuelve None en las celdas combinadas, que valen lo mismo que la de arriba.

Y SE CUENTA: la columna ÁMBITO dice cuántos distritos tiene cada grupo de zona
(«ONCE DISTRITOS»), y aquí se exige que el conteo cuadre. Hay UNA excepción, y
es de la norma: en Yauyos el bloque de zona 3 lista 30 distritos y dice
«VEINTINUEVE». La zona de los 30 es la misma, así que no hay ambigüedad; se deja
escrita para que no se tome por un fallo de la lectura.
"""
import io, json, os, re, sys, unicodedata
import fitz

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
PDF = os.path.join(os.path.dirname(RAIZ), "NORMAS NACIONALES", "Norma E.030 Diseño sismorresistente-2026.pdf")
SALIDA = os.path.join(RAIZ, "src", "distritos.js")

NUM = {"UN": 1, "UNICO": 1, "DOS": 2, "TRES": 3, "CUATRO": 4, "CINCO": 5, "SEIS": 6, "SIETE": 7, "OCHO": 8,
       "NUEVE": 9, "DIEZ": 10, "ONCE": 11, "DOCE": 12, "TRECE": 13, "CATORCE": 14, "QUINCE": 15, "DIECISEIS": 16,
       "DIECISIETE": 17, "DIECIOCHO": 18, "DIECINUEVE": 19, "VEINTE": 20, "VEINTIUN": 21, "VEINTIDOS": 22,
       "VEINTITRES": 23, "VEINTICUATRO": 24, "VEINTICINCO": 25, "VEINTISEIS": 26, "VEINTISIETE": 27,
       "VEINTIOCHO": 28, "VEINTINUEVE": 29, "TREINTA": 30}
EXCEPCIONES = {("YAUYOS", 3): (29, 30)}      # (provincia, zona): (lo que dice ÁMBITO, lo que lista)


def llano(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def lee():
    d = fitz.open(PDF)
    ini = [i for i in range(len(d)) if "ZONIFICACIÓN SÍSMICA" in d[i].get_text() and "TODOS LOS" in d[i].get_text()][0]
    fin = [i for i in range(ini + 1, len(d)) if "ANEXO III" in d[i].get_text()][0]
    filas, grupos = [], []
    dep = prov = zona = None
    for i in range(ini, fin):
        for t in d[i].find_tables().tables:
            n = t.col_count
            for r in t.extract():
                r = [(c.replace("\n", " ").strip() if c is not None else None) for c in r]
                if r[0] and (r[0].startswith("DEPARTAMENTO") or r[0].startswith("PROVINCIA CONST")):
                    continue
                if r[2] and r[2].startswith("DISTRITO"):
                    continue
                if r[0]:
                    dep = r[0]
                if r[1]:
                    prov = r[1]
                z = [c for c in r[3:n - 1] if c and re.fullmatch(r"[1-4]", c)]
                if z:
                    zona = int(z[0])
                if r[n - 1]:
                    grupos.append({"amb": r[n - 1], "n": 0, "prov": prov, "zona": zona, "pag": i + 1})
                if not r[2]:
                    continue
                grupos[-1]["n"] += 1
                filas.append([dep, prov, re.sub(r"\s+", " ", r[2]), zona])
    return filas, grupos, (ini + 1, fin)


def comprueba(filas, grupos):
    for g in grupos:
        w = llano(g["amb"]).upper().replace(" ", "").replace("DISTRITOS", "").replace("DISTRITO", "")
        if w.startswith("TODOSLOS"):
            continue
        esperado = NUM.get(w)
        if esperado is None:
            sys.exit("genera_distritos: no entiendo el ámbito «%s» (página %d)" % (g["amb"], g["pag"]))
        if esperado != g["n"]:
            exc = EXCEPCIONES.get((g["prov"], g["zona"]))
            if exc != (esperado, g["n"]):
                sys.exit("genera_distritos: en %s la norma dice %d distritos de zona %d y se leyeron %d (página %d)"
                         % (g["prov"], esperado, g["zona"], g["n"], g["pag"]))
    claves = {}
    for f in filas:
        k = (f[0], f[1], f[2])
        if k in claves:
            sys.exit("genera_distritos: distrito repetido: %s" % " · ".join(k))
        claves[k] = True
    deps = set(f[0] for f in filas)
    provs = set((f[0], f[1]) for f in filas)
    if len(deps) != 25 or len(provs) != 196:
        sys.exit("genera_distritos: %d departamentos y %d provincias; el Perú tiene 25 (con el Callao) y 196"
                 % (len(deps), len(provs)))
    return len(deps), len(provs)


def main():
    filas, grupos, (p0, p1) = lee()
    nd, np = comprueba(filas, grupos)
    datos = json.dumps(filas, ensure_ascii=False, separators=(",", ":"))
    datos = datos.replace("],[", "],\n[")
    js = u'''/* =====================================================================
   distritos.js — GENERADO por scripts/genera_distritos.py · NO EDITAR A MANO

   La zona sísmica de cada distrito del Perú: E.030-2026, Anexo II
   («Zonificación sísmica»), páginas %d a %d del PDF, leída de la tabla.
   %d distritos, %d departamentos (con el Callao), %d provincias. Cada grupo
   de zona se contó contra su columna ÁMBITO; la única diferencia es de la
   norma (Yauyos, zona 3: lista 30, dice «VEINTINUEVE»). Fila S.zona.distrito.

   [departamento, provincia, distrito, zona]
   ===================================================================== */
(function (raiz, definir) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = definir();
  else raiz.DISTRITOS = definir();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return %s;
});
''' % (p0, p1 - 1, len(filas), nd, np, datos)
    io.open(SALIDA, "w", encoding="utf-8", newline="\n").write(js)
    print("distritos.js: %d distritos, %d departamentos, %d provincias, %d KB"
          % (len(filas), nd, np, len(js.encode("utf-8")) // 1024))


if __name__ == "__main__":
    main()
