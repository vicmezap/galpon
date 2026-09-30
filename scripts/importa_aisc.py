# -*- coding: utf-8 -*-
"""Importa el AISC Shapes Database v13 a catalogos/aisc.json.

    python scripts/importa_aisc.py

El .xls viene en unidades IMPERIALES (in, in2, in4, lb/ft).  La conversion
NO se hace aqui: aqui solo se lee y se marca el origen.  Convertir es tarea
de src/unidades.js, que es el unico sitio del proyecto donde vive un factor
de conversion.  Si se convirtiera tambien aqui, habria dos.

Fila CAT.aisc del inventario:
    7 hojas · ~1250 perfiles · W/M/S/HP · C/MC · WT/MT/ST · Single Angles ·
    Double Angles · Rect. & Square HSS · Round HSS & Pipes

El origen del archivo esta FUERA del repositorio a proposito (pesa y no
cambia).  Si no esta, el script dice donde buscarlo y para.
"""
import io
import json
import os
import sys

try:
    import xlrd
except ImportError:
    sys.exit("importa_aisc: falta xlrd.  Instala con:  pip install xlrd")

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
SALIDA = os.path.join(RAIZ, "catalogos", "aisc.json")

# El .xls vive fuera del repositorio.  Rutas donde buscarlo, en orden.
CANDIDATOS = [
    os.path.join(RAIZ, "..", "PREDIMENSIONAMIENTO", "AISCProp13-1.0.xls"),
    os.path.join(RAIZ, "..", "..", "CLASES", "1ERA SEMANA", "AISCProp13-1.0.xls"),
]

# Que hoja es que familia, y con que fabricacion y especificacion entra.
# La fila MAT.admitidos del inventario recuerda que el A500 es conformado en
# frio pero el AISC 360 lo trata en su cuerpo normal: por eso los HSS entran
# como "laminado" a efectos de que especificacion los gobierna.
HOJAS = {
    "W, M, S & HP":        ("I", "laminado"),
    "C & MC":              ("C", "laminado"),
    "WT, MT, & ST":        ("T", "laminado"),
    "Single Angles":       ("L", "laminado"),
    "Double Angles":       ("2L", "laminado"),
    "Rect.  & Square HSS": ("HSS_rect", "laminado"),
    "Round HSS & Pipes":   ("HSS_red", "laminado"),
}


def busca_origen():
    for c in CANDIDATOS:
        if os.path.exists(c):
            return os.path.normpath(c)
    sys.exit(
        "importa_aisc: no encuentro AISCProp13-1.0.xls.\n"
        "  Lo busque en:\n" +
        "".join("    " + os.path.normpath(c) + "\n" for c in CANDIDATOS) +
        "  El catalogo vive FUERA del repositorio a proposito (pesa y no cambia).\n"
        "  Copialo a una de esas rutas o edita CANDIDATOS en este script.")


def limpia(v):
    """Una celda del .xls a numero, o None si no hay dato.

    El AISC usa el guion para «esta propiedad no aplica a esta seccion».
    Eso NO es un cero: un cero se propagaria a un calculo y daria una
    division por cero o, peor, un resultado plausible.
    """
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v) if v != "" else None
    s = str(v).strip()
    if s in ("", "-", "–", "—", "n/a", "N/A"):
        return None
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return None


def main():
    origen = busca_origen()
    wb = xlrd.open_workbook(origen)
    perfiles = []
    resumen = {}

    for hoja, (familia, fabricacion) in HOJAS.items():
        if hoja not in wb.sheet_names():
            print("  aviso: la hoja «%s» no esta en el archivo" % hoja)
            continue
        sh = wb.sheet_by_name(hoja)
        cabecera = [str(sh.cell_value(0, c)).strip() for c in range(sh.ncols)]
        n = 0
        for f in range(1, sh.nrows):
            nombre = str(sh.cell_value(f, 0)).strip()
            if not nombre:
                continue
            p = {
                "nombre": nombre,
                "familia": familia,
                "fabricacion": fabricacion,
                "espec": "AISC360",
                "estado": "activo",
                "origen": "imperial",
            }
            for c in range(1, sh.ncols):
                clave = cabecera[c]
                if not clave:
                    continue
                v = limpia(sh.cell_value(f, c))
                if v is not None:
                    p[clave] = v
            perfiles.append(p)
            n += 1
        resumen[hoja] = n
        print("  %-22s %4d perfiles  ->  familia %s" % (hoja, n, familia))

    if not perfiles:
        sys.exit("importa_aisc: no se leyo ningun perfil")

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    datos = {
        "catalogo": "AISC Shapes Database v13",
        "origen": "imperial",
        "unidades": "in, in2, in3, in4, in6, lb/ft — se convierten en src/unidades.js",
        "archivo": os.path.basename(origen),
        "inventario": "CAT.aisc",
        "perfiles": perfiles,
    }
    with io.open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(datos, fh, ensure_ascii=False, indent=1)

    print("")
    print("  escrito: %s" % SALIDA)
    print("  %d perfiles en %d familias" % (len(perfiles), len(resumen)))


if __name__ == "__main__":
    main()
