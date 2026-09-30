# -*- coding: utf-8 -*-
"""Hornea el visor de cargas: una pagina sola, sin dependencias.

    python scripts/gen_visor.py

QUE ES. La etapa E2 corriendo en el navegador. Los modulos son UMD: el mismo
archivo vale en Node -donde lee el inventario del disco- y en el navegador,
donde espera window.INVENTARIO_DATOS. Este script pone esa variable y pega los
modulos detras, en orden de dependencia.

NO ES EL COMPLEMENTO. El complemento de Excel necesita manifest.xml y Office.js,
y eso es la etapa E6. Esto es un banco de pruebas: sirve para VER los numeros y
contrastarlos contra un calculo a mano, que es lo que el diagrama pide de E2
-«se verifican contra ejemplos resueltos»-.

EL CATALOGO NO ENTRA, y no por descuido: e020, viento, e030 y combinaciones no
dependen de perfiles.js. Meter los 2408 perfiles engordaria la pagina dos megas
para nada, y sugeriria que aqui se eligen secciones. No se eligen: eso es E4.
"""
import io
import json
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
PLANTILLA = os.path.join(AQUI, "visor.plantilla.html")
SALIDA = os.path.join(RAIZ, "visor", "galpon-visor.html")

# EL ORDEN ES DE DEPENDENCIA, no alfabetico: inventario primero porque todos
# llaman a INV.declara(), y combinaciones al final porque lee E020.
MODULOS = [
    "inventario.js",
    "e020.js",
    "viento.js",
    "e030.js",
    "combinaciones.js",
]


def escapa(t):
    """Nada de lo que se pegue puede cerrar el <script> que lo contiene."""
    return t.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def main():
    if not os.path.exists(PLANTILLA):
        sys.exit("gen_visor: falta la plantilla -> " + PLANTILLA)

    inv_dir = os.path.join(RAIZ, "inventario")
    archivos = sorted(f for f in os.listdir(inv_dir) if f.endswith(".json"))
    if not archivos:
        sys.exit("gen_visor: no hay secciones de inventario en " + inv_dir)
    datos = [json.load(io.open(os.path.join(inv_dir, f), encoding="utf-8")) for f in archivos]
    filas = sum(len(d.get("magnitudes", [])) for d in datos)

    trozos = ["/* El inventario, horneado. Los MISMOS .json que lee Node y que",
              "   generan inventario.html: no pueden desincronizarse. */",
              "window.INVENTARIO_DATOS = " +
              escapa(json.dumps(datos, ensure_ascii=False, separators=(",", ":"))) + ";",
              ""]
    for m in MODULOS:
        ruta = os.path.join(RAIZ, "src", m)
        if not os.path.exists(ruta):
            sys.exit("gen_visor: falta el modulo " + ruta)
        trozos.append("/* ======== src/" + m + " ======== */")
        trozos.append(escapa(io.open(ruta, encoding="utf-8").read()))
        trozos.append("")

    html = io.open(PLANTILLA, encoding="utf-8").read()
    if "/*__MODULOS__*/" not in html:
        sys.exit("gen_visor: la plantilla no tiene la marca /*__MODULOS__*/")
    html = html.replace("/*__MODULOS__*/", "\n".join(trozos))

    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    io.open(SALIDA, "w", encoding="utf-8", newline="\n").write(html)

    print("  %d secciones de inventario  ·  %d filas" % (len(datos), filas))
    print("  %d modulos pegados: %s" % (len(MODULOS), " ".join(MODULOS)))
    print("  %.0f KB" % (len(html.encode("utf-8")) / 1024.0))
    print("")
    print("  escrito: %s" % SALIDA)


if __name__ == "__main__":
    main()
