# -*- coding: utf-8 -*-
"""Hornea TODO lo publicable, en el orden que toca.

    python scripts/hornear.py

POR QUE EXISTE. Son tres generadores y la guarda alDiaOMuere() compara el
generado MAS VIEJO contra la fuente MAS NUEVA de directorios enteros. Esa
comparacion es gruesa a proposito -una lista a mano de dependencias se pudre
el dia que nadie acuerda de actualizarla-, y el precio es que tocar la
plantilla del complemento deja rancio tambien al visor, que no la usa.

El precio esta bien pagado: un falso positivo cuesta correr un comando, y un
falso negativo cuesta publicar una pagina que no corresponde al codigo. Pero
entonces el comando tiene que ser UNO, no tres que haya que recordar en
orden. Este.

EL ORDEN IMPORTA: gen_complemento.py COPIA el visor y la vista del inventario
dentro de complemento/, asi que tienen que estar hechos antes o copiaria los
de la corrida anterior.
"""
import os
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))

PASOS = [
    ("gen_inventario.py", "inventario/*.json  ->  inventario/inventario.html"),
    ("gen_visor.py", "el banco de cargas de E2"),
    ("gen_complemento.py", "el complemento de Excel, y copia los dos anteriores"),
]


def main():
    fallos = 0
    for script, que in PASOS:
        print("")
        print("=" * 68)
        print("  %s   %s" % (script, que))
        print("=" * 68)
        r = subprocess.run([sys.executable, os.path.join(AQUI, script)])
        if r.returncode != 0:
            fallos += 1
            print("  *** %s SALIO CON ERROR %d ***" % (script, r.returncode))
    print("")
    if fallos:
        sys.exit("hornear: %d de %d generadores fallaron." % (fallos, len(PASOS)))
    print("  todo horneado.  Ahora:  node pruebas/correr.js")


if __name__ == "__main__":
    main()
