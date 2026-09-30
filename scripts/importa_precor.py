# -*- coding: utf-8 -*-
"""Importa las ocho familias conformadas en frio de Precor a catalogos/precor.json.

    python scripts/importa_precor.py

Las ocho son CONFORMADAS EN FRIO -espesores de 2,0 a 4,5 mm- y las gobierna
la AISI S100, que no esta implementada.  Entran al catalogo HOY marcadas
"espera": se ven en la interfaz, se pueden consultar, y no se pueden usar en
un calculo hasta que exista el motor.  Es lo que hace que la fase 2 sea un
modulo nuevo y no una refactorizacion (fila CAT.precor del inventario).

SEIS FORMATOS DE COLUMNA distintos, uno por tipo de seccion.  Un angulo trae
dos ejes principales mas el eje Z; una zeta trae Ixy; un canal trae el centro
de corte eo; los compuestos no traen ninguno de los tres.  Mapear todos con
el mismo molde habria metido valores en la columna equivocada sin que nada
avisara.

LA DESIGNACION SE ARRASTRA: la tabla la escribe una vez por grupo y despues
lista una fila por espesor.  Cada fila hereda la ultima designacion vista.

LAS FILAS SE ANCLAN POR LA DERECHA.  Contar campos para decidir si el primero
es una designacion no funciona, y fallo de dos formas a la vez:
  · la cabecera de las paginas de C, TC, IC, TU e IU trae len(cols)+1 campos,
    asi que "Designacion" paso por designacion y 52 perfiles se llamaron asi
  · una designacion se parte en uno, dos o tres campos segun cuanto hueco
    deje el PDF tras la letra, y las que se partian distinto no se detectaban:
    nueve grupos de IU heredaron el nombre del grupo anterior
Los datos son SIEMPRE los ultimos len(cols) campos y son SIEMPRE numeros.
Lo que sobra por la izquierda es la designacion, partida como sea.
"""
import io
import json
import os
import re
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("importa_precor: falta PyMuPDF.  Instala con:  pip install pymupdf")

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
SALIDA = os.path.join(RAIZ, "catalogos", "precor.json")

CANDIDATOS = [
    os.path.join(RAIZ, "..", "PREDIMENSIONAMIENTO", "TablaPrecorSections.pdf"),
]

HUECO = 4.0     # pt · esta tabla es mas apretada que la de FAM

# mm -> cm es 0,1 · lo demas ya viene en el sistema canonico
MM = 0.1

# Los seis formatos.  None = columna que no se guarda.
COLS_L = [("D_cm", MM), ("B_cm", MM), ("t_cm", MM), ("peso_kgfm", 1),
          ("A_cm2", 1), ("Ix_cm4", 1), ("Sx_cm3", 1), ("rx_cm", 1), ("ybar_cm", 1),
          ("Iy_cm4", 1), ("Sy_cm3", 1), ("ry_cm", 1), ("xbar_cm", 1),
          ("rz_cm", 1), ("alfa_grad", 1)]

COLS_U = [("D_cm", MM), ("B_cm", MM), ("t_cm", MM), ("peso_kgfm", 1),
          ("A_cm2", 1), ("Ix_cm4", 1), ("Sx_cm3", 1), ("rx_cm", 1),
          ("Iy_cm4", 1), ("Sy_cm3", 1), ("ry_cm", 1), ("xbar_cm", 1), ("eo_cm", 1)]

COLS_C = [("D_cm", MM), ("B_cm", MM), ("labio_cm", MM), ("t_cm", MM), ("peso_kgfm", 1),
          ("A_cm2", 1), ("Ix_cm4", 1), ("Sx_cm3", 1), ("rx_cm", 1),
          ("Iy_cm4", 1), ("Sy_cm3", 1), ("ry_cm", 1), ("xbar_cm", 1), ("eo_cm", 1)]

COLS_Z = [("D_cm", MM), ("B_cm", MM), ("labio_cm", MM), ("t_cm", MM), ("peso_kgfm", 1),
          ("A_cm2", 1), ("Ix_cm4", 1), ("Sx_cm3", 1), ("rx_cm", 1),
          ("Iy_cm4", 1), ("Sy_cm3", 1), ("ry_cm", 1), ("Ixy_cm4", 1), ("alfa_grad", 1)]

COLS_2C = [("D_cm", MM), ("B_cm", MM), ("labio_cm", MM), ("t_cm", MM), ("peso_kgfm", 1),
           ("A_cm2", 1), ("Ix_cm4", 1), ("Sx_cm3", 1), ("rx_cm", 1),
           ("Iy_cm4", 1), ("Sy_cm3", 1), ("ry_cm", 1)]

COLS_2U = [("D_cm", MM), ("B_cm", MM), ("t_cm", MM), ("peso_kgfm", 1),
           ("A_cm2", 1), ("Ix_cm4", 1), ("Sx_cm3", 1), ("rx_cm", 1),
           ("Iy_cm4", 1), ("Sy_cm3", 1), ("ry_cm", 1)]

# pagina (0-based) -> (familia, columnas, que es)
PAGINAS = {
    0:  ("L",  COLS_L,  "angulo de alas no atiesadas"),
    1:  ("U",  COLS_U,  "canal de alas no atiesadas"),
    2:  ("U",  COLS_U,  "canal de alas no atiesadas"),
    3:  ("C",  COLS_C,  "canal de alas atiesadas"),
    4:  ("C",  COLS_C,  "canal de alas atiesadas"),
    5:  ("Z",  COLS_Z,  "zeta de alas atiesadas"),
    6:  ("Z",  COLS_Z,  "zeta de alas atiesadas"),
    7:  ("TC", COLS_2C, "cajon de dos canales C"),
    8:  ("TC", COLS_2C, "cajon de dos canales C"),
    9:  ("IC", COLS_2C, "perfil I de dos canales C"),
    10: ("IC", COLS_2C, "perfil I de dos canales C"),
    11: ("TU", COLS_2U, "cajon de dos canales U"),
    12: ("TU", COLS_2U, "cajon de dos canales U"),
    13: ("IU", COLS_2U, "perfil I de dos canales U"),
    14: ("IU", COLS_2U, "perfil I de dos canales U"),
}

# Una designacion es algo como  L 4"x3"  ·  C 12"x3"  ·  IU 6"x6"
RE_DESIG = re.compile(r'^\s*(L|U|C|Z|TC|IC|TU|IU)\s+([\d\s"x½¼¾./-]+)$')


def busca_origen():
    for c in CANDIDATOS:
        if os.path.exists(c):
            return os.path.normpath(c)
    sys.exit("importa_precor: no encuentro TablaPrecorSections.pdf.\n"
             "  Lo busque en:\n" +
             "".join("    " + os.path.normpath(c) + "\n" for c in CANDIDATOS))


def campos_de_fila(tokens):
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


def num(t):
    t = t.replace(",", ".").strip()
    if not t or t in ("--", "-"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def limpia_desig(t):
    """Normaliza la designacion.

    Viene de formas distintas segun la fila: ' L  4"x3" ' con espacios de
    sobra, o 'L13/4"x13/4"' pegada.  Se deja siempre como 'L 4"x3"'.
    """
    t = re.sub(r"\s+", "", t.strip())
    m = re.match(r"^(TC|IC|TU|IU|L|U|C|Z)(.*)$", t)
    return (m.group(1) + " " + m.group(2)) if m else t


def main():
    origen = busca_origen()
    doc = fitz.open(origen)

    perfiles, descartadas, ignoradas, porFam = [], 0, 0, {}

    for pag, (familia, cols, descripcion) in sorted(PAGINAS.items()):
        if pag >= doc.page_count:
            continue
        filas = {}
        for w in doc[pag].get_text("words"):
            filas.setdefault(round(w[1], 0), []).append((w[0], w[2], w[4]))

        desig, n = None, 0
        for y in sorted(filas):
            c = campos_de_fila(filas[y])

            # TRES CLASES DE FILA, y se distinguen sin ambiguedad porque
            # una fila de datos son SIEMPRE los ultimos len(cols) campos y
            # SIEMPRE numeros:
            #   1 · fila de datos, con o sin designacion delante
            #   2 · fila que es SOLO la designacion.  La tabla la pone en su
            #       propia linea, uno o dos pt encima de la primera fila del
            #       grupo -'IC | 12"x6"' en y=239, los datos en y=240- y
            #       redondear la y no las junta.  En otras paginas la misma
            #       designacion viene en linea con los datos.  Las dos formas
            #       conviven en la misma tabla.
            #   3 · cabecera, unidades, titulo o nota: ni una ni otra.
            datos = c[-len(cols):] if len(c) >= len(cols) else []
            vals = [num(x) for x in datos]

            if datos and not any(v is None for v in vals):
                cab = c[:-len(cols)]
                if cab:
                    nueva = limpia_desig("".join(cab))
                    if not RE_DESIG.match(nueva):
                        descartadas += 1
                        continue
                    desig = nueva
            else:
                # no es fila de datos · ¿es la designacion sola?
                sola = limpia_desig("".join(c))
                if RE_DESIG.match(sola):
                    desig = sola
                else:
                    ignoradas += 1
                continue
            if desig is None:
                continue

            p = {"familia": familia, "descripcion": descripcion,
                 "fabricacion": "frio", "espec": "AISI", "estado": "espera",
                 "origen": "metrico"}
            for (clave, factor), v in zip(cols, vals):
                p[clave] = v * factor

            # el espesor distingue las filas de un mismo grupo
            p["nombre"] = "%s x%.1f" % (desig, p["t_cm"] * 10)
            perfiles.append(p)
            n += 1
        porFam[familia] = porFam.get(familia, 0) + n
        print("  p%-2d  %-4s %3d perfiles   %s" % (pag + 1, familia, n, descripcion))

    if not perfiles:
        sys.exit("importa_precor: no se leyo ningun perfil")

    # Las relaciones que se pueden comprobar aqui.  Un perfil conformado en
    # frio no es de doble simetria salvo los compuestos, asi que solo valen
    # las definiciones puras y el peso.
    malos = []
    for p in perfiles:
        f = []
        if p.get("Ix_cm4") and p.get("A_cm2") and p.get("rx_cm"):
            d = abs((p["Ix_cm4"] / p["A_cm2"]) ** 0.5 - p["rx_cm"]) / p["rx_cm"]
            if d > 0.02:
                f.append("rx %.1f%%" % (d * 100))
        if p.get("Iy_cm4") and p.get("A_cm2") and p.get("ry_cm"):
            d = abs((p["Iy_cm4"] / p["A_cm2"]) ** 0.5 - p["ry_cm"]) / p["ry_cm"]
            if d > 0.02:
                f.append("ry %.1f%%" % (d * 100))
        if p.get("A_cm2") and p.get("peso_kgfm"):
            d = abs(p["A_cm2"] * 7.85e-3 * 100 - p["peso_kgfm"]) / p["peso_kgfm"]
            if d > 0.03:
                f.append("peso %.1f%%" % (d * 100))
        if f:
            malos.append((p["nombre"], f))

    # UNA DESIGNACION REPETIDA ES UN FALLO DE EXTRACCION, no un dato.
    # Aqui el nombre ES clave unica -designacion mas espesor- al contrario que
    # en la serie soldada, donde dos geometrias comparten designacion de
    # verdad.  Si se repite, el arrastre heredo una designacion que no toca:
    # es exactamente el fallo que tuvo esta importacion -52 perfiles llamados
    # "Designacion x4.5" y nueve grupos de IU con el nombre del grupo de al
    # lado- y salio sin que nada avisara.  Ahora avisa.
    porNombre = {}
    for p in perfiles:
        porNombre.setdefault(p["nombre"], []).append(p)
    repetidos = {k: v for k, v in porNombre.items() if len(v) > 1}

    print("")
    for f in sorted(porFam):
        print("  familia %-3s %3d perfiles" % (f, porFam[f]))
    print("  total      %3d perfiles · %d filas descartadas · %d no son datos"
          % (len(perfiles), descartadas, ignoradas))
    print("")
    if repetidos:
        print("  %d designaciones repetidas · el arrastre heredo mal:" % len(repetidos))
        for k in sorted(repetidos)[:10]:
            print("    %-24s %d veces  (familias %s)"
                  % (k, len(repetidos[k]),
                     ", ".join(sorted({x["familia"] for x in repetidos[k]}))))
        sys.exit("\n  El nombre tiene que ser unico: designacion mas espesor.")
    if malos:
        print("  %d perfiles NO pasan las relaciones:" % len(malos))
        for n_, f in malos[:15]:
            print("    %-22s %s" % (n_, " | ".join(f)))
        if len(malos) > 15:
            print("    ... y %d mas" % (len(malos) - 15))
        sys.exit("\n  La extraccion no es fiable: revisa el orden de columnas.")
    print("  las relaciones cuadran en los %d perfiles" % len(perfiles))

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    datos = {
        "catalogo": "Precor · perfiles conformados en frio",
        "origen": "metrico",
        "unidades": "cm, cm2, cm3, cm4, kgf/m — ya en el sistema canonico",
        "archivo": os.path.basename(origen),
        "inventario": "CAT.precor",
        "nota": "Todas en estado «espera»: las gobierna la AISI S100, fase 2.",
        "perfiles": perfiles,
    }
    with io.open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, indent=1)
    print("")
    print("  escrito: %s" % SALIDA)


if __name__ == "__main__":
    main()
