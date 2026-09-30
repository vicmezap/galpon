# -*- coding: utf-8 -*-
"""Importa la serie de perfiles soldados VS / CS / CVS / VSM a catalogos/fam.json.

    python scripts/importa_fam.py

La serie es la ABNT NBR 5884 y es la que Zapata Baglietto usa en TODOS sus
ejemplos (VS600x99, CS400x204, CVS650x217).  Sin ella no se puede reproducir
ninguno, y son nuestra mejor fuente de verificacion.

EXTRACCION POR POSICION, no por texto plano.  El PDF entrega los caracteres
sueltos: "4 0 0 x 1 7 6" son siete palabras distintas.  Se reagrupan por el
hueco en x, que es bimodal y lo separa sin ambiguedad:

    2,5 pt  ->  dentro de un numero   (3185 casos medidos)
    >= 10 pt -> entre columnas
    umbral 6 ->  47 filas de 25 campos, todas consistentes

EL ORDEN REAL DE COLUMNAS NO ES EL DE LA PAGINA DE ABREVIATURAS.  Alli
figura bf antes que tf, y rx/Zx al reves.  El orden verdadero se dedujo
comprobando cada campo contra su relacion geometrica, y esta en la fila
CAT.soldados.cols del inventario.

UNIDADES DEL CATALOGO: masa kg/m · A cm2 · d,tw,h,tf,bf,ec mm · I cm4 ·
W,Z cm3 · r cm · It cm4 · Cw cm6 · u m2/m.  Los mm se pasan a cm aqui, que
es el sistema canonico del proyecto.
"""
import io
import json
import os
import re
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("importa_fam: falta PyMuPDF.  Instala con:  pip install pymupdf")

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
SALIDA = os.path.join(RAIZ, "catalogos", "fam.json")

CANDIDATOS = [
    os.path.join(RAIZ, "..", "CATALOGOS Y FICHAS", "PERFILES",
                 "FAM - Perfiles Soldados VS CS CVS (NBR 5884).pdf"),
]

# La serie VSM se queda FUERA, y no por descuido.
#   · tiene 29 columnas, no 25: es monosimetrica -dos espesores y dos anchos
#     de ala, y dos modulos Wxs y Wxi, superior e inferior-
#   · el orden de esas 29 no se ha verificado campo por campo contra las
#     relaciones geometricas, que es como se verifico el de las otras tres
#   · y una seccion monosimetrica no es lo que usa el portico de un galpon
# Importar datos cuyo orden no esta verificado seria justo lo que la regla
# del inventario prohibe. Si algun dia hacen falta, se mapean y se prueban.
SERIES = ["CS", "CVS", "VS"]

# Filas con el dato MAL EN EL PDF DE ORIGEN, excluidas por nombre.
# No se reconstruyen: recuperar un valor que la fuente perdio es la clase de
# ayuda que esconde el problema. Se anota como recuperarlo por si alguien
# decide hacerlo a conciencia.
EXCLUIDAS = {
    "CS300x76":
        "Ix = 18894 no cuadra con Wx = 1126 ni con rx = 13,2; los dos "
        "coinciden entre si en Ix = 16890, luego el Ix impreso esta mal",
    "CVS300x113":
        "rx = 1276 sin coma decimal; deberia ser 12,76, que es lo que da "
        "raiz(Ix/A) = raiz(23433/143,9)",
    "CVS600x339":
        "Wx = 8727 no cuadra con Ix = 267803 y d = 600, que dan 8927; "
        "rx si cuadra con Ix, asi que el error esta en Wx (parece un 9 por 7)",
    "CVS1000x464":
        "Ix impreso como 1E+06: el PDF perdio la precision de la celda. "
        "Recuperable como Wx*d/2 = 1144200, que coincide con rx^2*A",
    "CVS1000x486":
        "Ix impreso como 1E+06. Recuperable como Wx*d/2 = 1164750, que "
        "coincide con rx^2*A = 1164930",
}

HUECO = 6.0        # pt · separa columnas de caracteres dentro de un numero
Y_DATOS = 120      # pt · por encima esta la cabecera

# El orden verdadero, verificado campo por campo.  None = columna que no
# entra al catalogo (adimensionales de la propia tabla, que recalculamos).
COLUMNAS = [
    ("perfil",   None),
    ("peso_kgfm", 1.0),
    ("A_cm2",    1.0),
    ("d_cm",     0.1),      # mm -> cm
    ("tw_cm",    0.1),
    ("h_cm",     0.1),
    ("tf_cm",    0.1),
    ("bf_cm",    0.1),
    ("Ix_cm4",   1.0),
    ("Sx_cm3",   1.0),      # la tabla lo llama Wx
    ("rx_cm",    1.0),
    ("Zx_cm3",   1.0),
    ("Iy_cm4",   1.0),
    ("Sy_cm3",   1.0),      # Wy
    ("ry_cm",    1.0),
    ("Zy_cm3",   1.0),
    ("rt_cm",    1.0),
    ("J_cm4",    1.0),      # la tabla lo llama It
    ("Cw_cm6",   1.0),
    ("h_tw",     1.0),
    ("bf_2tf",   1.0),
    ("d_Af",     1.0),
    ("ec_cm",    0.1),
    ("u_m2m",    1.0),
    ("u_A",      1.0),
]


def busca_origen():
    for c in CANDIDATOS:
        if os.path.exists(c):
            return os.path.normpath(c)
    sys.exit(
        "importa_fam: no encuentro el PDF de FAM.\n"
        "  Lo busque en:\n" +
        "".join("    " + os.path.normpath(c) + "\n" for c in CANDIDATOS))


def num(t):
    """Un campo de la tabla a numero.  Coma decimal (Brasil)."""
    t = t.replace(",", ".").replace("--", "").strip()
    if not t:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def campos_de_fila(tokens):
    """Reagrupa los caracteres sueltos en campos, cortando por el hueco."""
    tokens = sorted(tokens)
    out, actual, xfin = [], tokens[0][2], tokens[0][1]
    for x0, x1, s in tokens[1:]:
        if x0 - xfin > HUECO:
            out.append(actual)
            actual = s
        else:
            actual += s
        xfin = x1
    out.append(actual)
    return out


def lee_pagina(pg, serie):
    filas = {}
    for w in pg.get_text("words"):
        filas.setdefault(round(w[1], 0), []).append((w[0], w[2], w[4]))

    perfiles, descartadas = [], 0
    for y in sorted(filas):
        if y <= Y_DATOS:
            continue
        c = campos_de_fila(filas[y])
        if len(c) != len(COLUMNAS):
            descartadas += 1
            continue

        p = {"familia": serie, "fabricacion": "soldado",
             "espec": "AISC360", "estado": "activo", "origen": "metrico"}
        ok = True
        for (clave, factor), valor in zip(COLUMNAS, c):
            if clave == "perfil":
                p["nombre"] = serie + valor.strip()
                continue
            v = num(valor)
            if v is None:
                ok = False
                break
            p[clave] = v * factor
        if not ok:
            descartadas += 1
            continue
        perfiles.append(p)
    return perfiles, descartadas


def verifica(p):
    """Las relaciones que validan el orden de columnas fila por fila.

    Si el orden estuviera mal, estas no cuadrarian: son la prueba de que la
    extraccion leyo cada campo donde debia.
    """
    f = []
    def cerca(nombre, a, b, tol):
        if not b:
            return
        if abs(a - b) / abs(b) > tol:
            f.append("%s %.4g vs %.4g (%.1f%%)" % (nombre, a, b, abs(a - b) / abs(b) * 100))

    cerca("rx", (p["Ix_cm4"] / p["A_cm2"]) ** 0.5, p["rx_cm"], 0.02)
    cerca("ry", (p["Iy_cm4"] / p["A_cm2"]) ** 0.5, p["ry_cm"], 0.02)
    cerca("Sx=2Ix/d", 2 * p["Ix_cm4"] / p["d_cm"], p["Sx_cm3"], 0.02)
    cerca("Sy=2Iy/bf", 2 * p["Iy_cm4"] / p["bf_cm"], p["Sy_cm3"], 0.02)
    ho = p["d_cm"] - p["tf_cm"]
    cerca("Cw=Iy*ho^2/4", p["Iy_cm4"] * ho * ho / 4, p["Cw_cm6"], 0.03)
    cerca("h/tw", p["h_cm"] / p["tw_cm"], p["h_tw"], 0.03)
    cerca("peso=A*g", p["A_cm2"] * 7.85e-3 * 100, p["peso_kgfm"], 0.03)
    return f


def main():
    origen = busca_origen()
    doc = fitz.open(origen)

    perfiles, descartadas, series = [], 0, {}
    fuera_serie, excluidas = {}, []
    for i in range(doc.page_count):
        t = doc[i].get_text()
        m = re.search(r"PERFIS SOLDADOS\s*[–-]\s*S[ÉE]RIE\s+([A-Z]+)", t)
        if not m:
            continue
        serie = m.group(1)
        if serie not in SERIES:
            fuera_serie[serie] = fuera_serie.get(serie, 0) + 1
            continue
        ps, d = lee_pagina(doc[i], serie)
        for x in ps:
            if x["nombre"] in EXCLUIDAS:
                excluidas.append(x["nombre"])
            else:
                perfiles.append(x)
        descartadas += d
        series[serie] = series.get(serie, 0) + len([x for x in ps if x["nombre"] not in EXCLUIDAS])
        print("  p%-2d  serie %-4s  %3d perfiles%s"
              % (i + 1, serie, len(ps), "  (%d filas descartadas)" % d if d else ""))

    if not perfiles:
        sys.exit("importa_fam: no se leyo ningun perfil")

    # Las relaciones, sobre todo lo leido.  Si el orden de columnas fuera
    # otro, esto se llenaria de fallos.
    malos = [(p["nombre"], verifica(p)) for p in perfiles]
    malos = [(n, f) for n, f in malos if f]

    print("")
    if fuera_serie:
        for k in sorted(fuera_serie):
            print("  serie %-5s  FUERA · 29 columnas sin verificar, y es monosimetrica" % k)
    if excluidas:
        print("  %d filas excluidas por dato malo en el PDF de origen:" % len(excluidas))
        for n_ in sorted(excluidas):
            print("    %-14s %s" % (n_, EXCLUIDAS[n_]))
        print("")
    for s, n in sorted(series.items()):
        print("  serie %-5s %3d perfiles" % (s, n))
    print("  total      %3d perfiles · %d filas descartadas" % (len(perfiles), descartadas))
    print("")
    if malos:
        print("  %d perfiles NO pasan las relaciones:" % len(malos))
        for n, f in malos[:12]:
            print("    %-16s %s" % (n, " | ".join(f)))
        if len(malos) > 12:
            print("    ... y %d mas" % (len(malos) - 12))
        sys.exit("\n  La extraccion no es fiable: revisa el orden de columnas "
                 "antes de escribir el catalogo.")
    print("  las 7 relaciones cuadran en los %d perfiles" % len(perfiles))

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    datos = {
        "catalogo": "FAM Perfis Soldados (ABNT NBR 5884)",
        "origen": "metrico",
        "unidades": "cm, cm2, cm3, cm4, cm6, kgf/m — ya en el sistema canonico",
        "archivo": os.path.basename(origen),
        "inventario": "CAT.soldados",
        "perfiles": perfiles,
    }
    with io.open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, indent=1)
    print("")
    print("  escrito: %s" % SALIDA)


if __name__ == "__main__":
    main()
