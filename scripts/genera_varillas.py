# -*- coding: utf-8 -*-
"""Genera catalogos/varillas.json: barras redondas lisas para tirantes.

No hay tabla que leer: el dato es el diametro nominal, en fracciones de
pulgada, y todo lo demas sale de la geometria del circulo (fila
CAT.varillas).  El peso, con la densidad del acero de la E.020 (fila
D.acero.gamma).  Se trabajan como varilla roscada (filas T.varillas): el
area de calculo es la nominal SIN roscar, y la rosca entra por el 0,75.

    python scripts/genera_varillas.py
"""
import io
import json
import math
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PULGADA_CM = 2.54
GAMMA_ACERO = 7850.0          # kgf/m3 · E.020 Anexo 1 · fila D.acero.gamma

DIAMETROS = [("3/8", 3 / 8.0), ("1/2", 1 / 2.0), ("5/8", 5 / 8.0), ("3/4", 3 / 4.0), ("7/8", 7 / 8.0),
             ("1", 1.0), ("1-1/8", 9 / 8.0), ("1-1/4", 5 / 4.0)]


def fila(nombre, d_in):
    d = d_in * PULGADA_CM
    A = math.pi * d * d / 4
    I = math.pi * d ** 4 / 64
    return {
        "familia": "VAR", "fabricacion": "laminado", "espec": "AISC360", "estado": "activo",
        "origen": "metrico", "nombre": "VAR" + nombre,
        "d_cm": d, "A_cm2": A, "peso_kgfm": A / 1e4 * GAMMA_ACERO,
        "Ix_cm4": I, "Iy_cm4": I, "rx_cm": d / 4, "ry_cm": d / 4,
        "Sx_cm3": math.pi * d ** 3 / 32, "Sy_cm3": math.pi * d ** 3 / 32,
        "Zx_cm3": d ** 3 / 6, "Zy_cm3": d ** 3 / 6, "J_cm4": 2 * I
    }


def main():
    out = {
        "catalogo": "Varillas lisas (geometría del círculo)",
        "origen": "metrico",
        "unidades": "cm, cm2, cm3, cm4, kgf/m · ya en el sistema canonico",
        "archivo": "scripts/genera_varillas.py",
        "inventario": "CAT.varillas",
        "perfiles": [fila(n, d) for n, d in DIAMETROS]
    }
    p = os.path.join(RAIZ, "catalogos", "varillas.json")
    io.open(p, "w", encoding="utf-8", newline="\n").write(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print("varillas.json:", len(out["perfiles"]), "varillas")


if __name__ == "__main__":
    main()
