# -*- coding: utf-8 -*-
"""Hornea el complemento publicable.

    python scripts/gen_complemento.py

QUE PRODUCE, en complemento/:

    taskpane.html   el complemento, una pagina sola con TODO dentro
    manifest.xml    el manifiesto de Office que Excel necesita para cargarlo
    index.html      la portada de GitHub Pages
    icono-*.png     los iconos del boton de la cinta
    galpon-visor.html / inventario.html   si estan generados, se copian

ESTE SCRIPT LLEVA DESDE EL COMMIT 1 CITADO EN bundle.js Y NO EXISTIA. La
guarda alDiaOMuere() vigilaba complemento/ desde el principio, no encontraba
nada, y por eso contestaba siempre «todavia no se ha generado el complemento»:
estuvo dormida hasta que aparecio el visor. Ahora vigila las dos salidas de
verdad.

TODO VA DENTRO DEL HTML, incluidos los 2408 perfiles. El visor los deja fuera
a proposito -alli no se eligen secciones- pero aqui si: un complemento que
pide secciones y no trae catalogo no sirve. Son unos 2 MB en claro que el
servidor comprime a una fraccion, y a cambio no hay una sola peticion que
pueda fallar ni un solo archivo que pueda quedarse viejo respecto del otro.
Esa es la misma razon por la que existe alDiaOMuere().

EL ORDEN DE LOS MODULOS ES DE DEPENDENCIA. En el navegador cada modulo UMD
se cuelga de window y lee los que ya estan: si uno llega antes que el suyo,
recibe undefined y revienta cien lineas mas tarde con un mensaje que no
menciona el orden. Por eso la lista esta escrita a mano y comprobada, y por
eso main() verifica que esten TODOS los de src/ o se niega.
"""
import io
import json
import os
import shutil
import struct
import sys
import zlib
from datetime import date

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, ".."))
PLANTILLA_PANEL = os.path.join(AQUI, "panel.plantilla.html")
PLANTILLA_MODELADOR = os.path.join(AQUI, "modelador.plantilla.html")
SALIDA = os.path.join(RAIZ, "complemento")

# La direccion publica. Si cambia, cambia en el manifiesto y hay que volver a
# instalar el complemento en Excel: por eso esta en UN solo sitio.
BASE_URL = "https://vicmezap.github.io/galpon"

# El identificador del complemento. Un GUID fijo: si cambia, Excel lo ve como
# otro complemento distinto y el usuario acaba con dos.
GUID = "7b3e1f42-9c6a-4d58-8e21-5a0f6b2c4d93"

# EL PANEL SOLO NECESITA TRES, y por eso pesa 262 KB en vez de 1 674: es un
# lanzador y no tiene que saber calcular nada. Que el catalogo de 2408 perfiles
# no viaje al panel no es una optimizacion, es la consecuencia de que el panel
# no elige secciones. Lo que queda son las filas del inventario, que si
# viajan porque libro.js y panel.js declaran filas como todos los demas.
MODULOS_PANEL = ["inventario.js", "libro.js", "panel.js"]

# ORDEN DE DEPENDENCIA, no alfabetico.
MODULOS = [
    "inventario.js",     # todos llaman a INV.declara()
    "unidades.js",
    "propiedades.js",
    "perfiles.js",       # necesita CATALOGOS_DATOS
    "e020.js",
    "viento.js",
    "e030.js",
    "combinaciones.js",  # lee E020
    "modelo.js",
    "solver.js",         # lee MODELO
    "estabilidad.js",    # lee SOLVER
    "riostras.js",       # lee SOLVER
    "acero.js",
    "elemento.js",       # lee ACERO
    "bucle.js",
    "correas.js",        # lee ELEMENTO y TR4_DATOS
    "tijeral.js",        # lee MODELO, SOLVER, ACERO, ELEMENTO
    "columnas.js",
    "arriostres.js",     # lee ACERO y RIOSTRAS
    "placabase.js",      # lee ACERO · E7
    "conexiones.js",     # lee ACERO y UNIDADES · E7, Cap. J
    "generador.js",      # lee MODELO y SOLVER
    "montaje.js",        # lee GENERADOR
    "analisis.js",       # lee MODELO, SOLVER, ESTABILIDAD, VIENTO, COMBINACIONES y MONTAJE
    "diseno.js",         # lee ELEMENTO, TIJERAL, COLUMNAS, ANALISIS, CONEXIONES y PERFILES
    "vista3d.js",       # funciones puras de camara y proyeccion
    "vistas.js",        # lee GENERADOR, MONTAJE y VISTA3D
    "libro.js",         # el modelo dentro del libro de Excel
    "resultados.js",    # lee VISTAS, E020, VIENTO, COMBINACIONES, ANALISIS y LIBRO
    "panel.js",         # lo que ensena el panel de tareas
    "proyecto.js",
]

# Lo que NO entra, y por que. Escrito para que la comprobacion de abajo no
# haya que desactivarla cuando aparezca un modulo que de verdad no toca.
FUERA = {
    "bundle.js": "es la guarda de Node; en el navegador no hay sistema de archivos",
}


def escapa(t):
    """Nada de lo que se pegue puede cerrar el <script> que lo contiene."""
    return t.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def png_cuadrado(lado, rgb, borde):
    """Un PNG solido con borde, escrito a mano.

    Los iconos del boton de la cinta tienen que ser PNG en URL absoluta: el
    manifiesto no admite SVG ni data URI. Son tres cuadrados y no merecen una
    dependencia, asi que se escriben con zlib y struct, que vienen con Python.
    """
    filas = []
    for y in range(lado):
        fila = bytearray([0])            # filtro 0 = sin filtro
        for x in range(lado):
            enBorde = x < 1 or y < 1 or x >= lado - 1 or y >= lado - 1
            fila += bytes(borde if enBorde else rgb)
        filas.append(bytes(fila))
    crudo = b"".join(filas)

    def trozo(tipo, datos):
        c = struct.pack(">I", len(datos)) + tipo + datos
        return c + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)

    cab = struct.pack(">IIBBBBB", lado, lado, 8, 2, 0, 0, 0)   # 8 bits, RGB
    return (b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", cab) +
            trozo(b"IDAT", zlib.compress(crudo, 9)) + trozo(b"IEND", b""))


MANIFIESTO = """<?xml version="1.0" encoding="UTF-8"?>
<!--
  Manifiesto de Office para Galpon.

  OJO CON EL Id: es el que usa Excel para saber si es el mismo complemento.
  Cambiarlo hace que aparezca duplicado. Vive en gen_complemento.py.

  Y OJO CON LAS URL: tienen que ser https y tienen que existir. Office no
  dice «404»; dice que el complemento no se pudo cargar, y uno se pasa la
  tarde buscandolo en el codigo.
-->
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
           xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
           xsi:type="TaskPaneApp">
  <Id>{guid}</Id>
  <Version>{version}</Version>
  <ProviderName>MEZAP</ProviderName>
  <DefaultLocale>es-PE</DefaultLocale>
  <DisplayName DefaultValue="Galpon"/>
  <Description DefaultValue="Prediseno, analisis y diseno de galpones de estructura metalica. AISC 360-22, E.020, E.030, E.090."/>
  <IconUrl DefaultValue="{base}/icono-32.png"/>
  <HighResolutionIconUrl DefaultValue="{base}/icono-80.png"/>
  <SupportUrl DefaultValue="{base}/"/>
  <AppDomains>
    <AppDomain>https://vicmezap.github.io</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Workbook"/>
  </Hosts>
  <Requirements>
    <Sets DefaultMinVersion="1.1">
      <Set Name="ExcelApi" MinVersion="1.1"/>
      <!-- DialogApi 1.2 hace falta para messageChild: sin el, el panel puede
           abrir la ventana pero no contestarle, y el modelador arrancaria
           siempre en blanco aunque el libro traiga un modelo. -->
      <Set Name="DialogApi" MinVersion="1.2"/>
    </Sets>
  </Requirements>
  <DefaultSettings>
    <SourceLocation DefaultValue="{base}/panel.html"/>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
                    xsi:type="VersionOverridesV1_0">
    <Hosts>
      <Host xsi:type="Workbook">
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="inicio.titulo"/>
            <Description resid="inicio.desc"/>
            <LearnMoreUrl resid="url.inicio"/>
          </GetStarted>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <CustomTab id="mezap.galpon.tab">
              <Group id="mezap.galpon.grupo">
                <Label resid="grupo.etiqueta"/>
                <Icon>
                  <bt:Image size="16" resid="icono16"/>
                  <bt:Image size="32" resid="icono32"/>
                  <bt:Image size="80" resid="icono80"/>
                </Icon>
                <Control xsi:type="Button" id="mezap.galpon.abrir">
                  <Label resid="boton.etiqueta"/>
                  <Supertip>
                    <Title resid="boton.etiqueta"/>
                    <Description resid="boton.desc"/>
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="icono16"/>
                    <bt:Image size="32" resid="icono32"/>
                    <bt:Image size="80" resid="icono80"/>
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>mezap.galpon.panel</TaskpaneId>
                    <SourceLocation resid="url.panel"/>
                  </Action>
                </Control>
              </Group>
              <Label resid="tab.etiqueta"/>
            </CustomTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="icono16" DefaultValue="{base}/icono-16.png"/>
        <bt:Image id="icono32" DefaultValue="{base}/icono-32.png"/>
        <bt:Image id="icono80" DefaultValue="{base}/icono-80.png"/>
      </bt:Images>
      <bt:Urls>
        <bt:Url id="url.panel" DefaultValue="{base}/panel.html"/>
        <bt:Url id="url.inicio" DefaultValue="{base}/"/>
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="tab.etiqueta" DefaultValue="Galpon"/>
        <bt:String id="grupo.etiqueta" DefaultValue="Galpon"/>
        <bt:String id="boton.etiqueta" DefaultValue="Abrir Galpon"/>
        <bt:String id="inicio.titulo" DefaultValue="Galpon esta instalado"/>
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="boton.desc" DefaultValue="Abre el panel de Galpon: geometria, cargas, analisis y diseno."/>
        <bt:String id="inicio.desc" DefaultValue="Busca la pestana Galpon en la cinta y pulsa Abrir Galpon."/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
"""

PORTADA = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Galpon - MEZAP</title>
<style>
:root {{ --tinta:#1b2430; --papel:#f2f1ec; --ficha:#fbfaf7; --linea:#cdcabd;
  --acero:#2f6f8f; --suave:#6b6f76; color-scheme:light; }}
@media (prefers-color-scheme:dark) {{ :root:not([data-theme="light"]) {{
  --tinta:#e8e6df; --papel:#14181d; --ficha:#1a1f26; --linea:#343b45;
  --acero:#79b8d4; --suave:#8b929c; color-scheme:dark; }} }}
* {{ box-sizing:border-box; }}
body {{ background:var(--papel); color:var(--tinta); margin:0; padding:0 16px 48px;
  font:15px/1.55 "IBM Plex Sans",system-ui,sans-serif; }}
.env {{ max-width:720px; margin:0 auto; }}
h1 {{ font:600 clamp(28px,6vw,42px)/1.05 "IBM Plex Sans Condensed","Arial Narrow",sans-serif;
  margin:36px 0 2px; }}
h1 small {{ display:block; font:400 11px/1 "IBM Plex Mono",ui-monospace,monospace;
  letter-spacing:.14em; text-transform:uppercase; color:var(--acero); margin-bottom:8px; }}
p.b {{ color:var(--suave); max-width:60ch; }}
ul {{ list-style:none; padding:0; margin:26px 0 0; display:grid; gap:10px; }}
li a {{ display:block; border:1px solid var(--linea); border-left:3px solid var(--acero);
  border-radius:3px; background:var(--ficha); padding:13px 15px; text-decoration:none;
  color:inherit; }}
li a:hover {{ border-left-width:6px; }}
li b {{ display:block; font-size:16px; }}
li span {{ color:var(--suave); font-size:13px; }}
code {{ font-family:"IBM Plex Mono",ui-monospace,monospace; font-size:.92em; }}
footer {{ margin-top:36px; color:var(--suave); font-size:12.5px; border-top:1px solid var(--linea);
  padding-top:14px; }}
</style></head><body><div class="env">
<h1><small>MEZAP - Estructuras metalicas</small>Galpon</h1>
<p class="b">Prediseno, analisis y diseno de galpones de estructura metalica.
AISC 360-22 manda, con doble referencia a la E.090-2020; cargas por E.020 y
sismo por E.030-2026. {filas} filas de inventario, {pruebas}.</p>
<ul>
  <li><a href="modelador.html"><b>Abrir el modelador</b>
    <span>La ventana grande. Funciona igual en el navegador que dentro de Excel.</span></a></li>
  <li><a href="manifest.xml"><b>manifest.xml</b>
    <span>Para instalarlo en Excel: Insertar &rsaquo; Mis complementos &rsaquo;
      Cargar mi complemento.</span></a></li>
  <li><a href="galpon-visor.html"><b>Banco de cargas</b>
    <span>E.020, viento, E.030 y combinaciones, para contrastar a mano.</span></a></li>
  <li><a href="inventario.html"><b>El inventario</b>
    <span>Cada numero del programa con su fuente primaria.</span></a></li>
</ul>
<footer>Horneado el {fecha} desde <code>vicmezap/galpon</code>.
  Ningun numero entra al codigo sin fila en el inventario.</footer>
</div></body></html>
"""


def hornea(plantilla, modulos, datos, salida):
    """Pega los datos y los modulos en una plantilla y la escribe."""
    if not os.path.exists(plantilla):
        sys.exit("gen_complemento: falta la plantilla -> " + plantilla)
    trozos = list(datos)
    for m in modulos:
        ruta = os.path.join(RAIZ, "src", m)
        trozos.append("/* ======== src/" + m + " ======== */")
        trozos.append(escapa(io.open(ruta, encoding="utf-8").read()))
        trozos.append("")
    html = io.open(plantilla, encoding="utf-8").read()
    if "/*__MODULOS__*/" not in html:
        sys.exit("gen_complemento: " + plantilla + " no tiene la marca /*__MODULOS__*/")
    html = html.replace("/*__MODULOS__*/", "\n".join(trozos))
    io.open(salida, "w", encoding="utf-8", newline="\n").write(html)
    return len(html.encode("utf-8")) / 1024.0


def main():
    for pl in (PLANTILLA_PANEL, PLANTILLA_MODELADOR):
        if not os.path.exists(pl):
            sys.exit("gen_complemento: falta la plantilla -> " + pl)

    # --- el inventario ---
    inv_dir = os.path.join(RAIZ, "inventario")
    secciones = sorted(f for f in os.listdir(inv_dir) if f.endswith(".json"))
    if not secciones:
        sys.exit("gen_complemento: no hay secciones de inventario en " + inv_dir)
    inv = [json.load(io.open(os.path.join(inv_dir, f), encoding="utf-8"))
           for f in secciones]
    filas = sum(len(d.get("magnitudes", [])) for d in inv)

    # --- los catalogos ---
    cat_dir = os.path.join(RAIZ, "catalogos")
    cat_files = sorted(f for f in os.listdir(cat_dir) if f.endswith(".json"))
    if not cat_files:
        sys.exit("gen_complemento: no hay catalogos en " + cat_dir)
    cats = [json.load(io.open(os.path.join(cat_dir, f), encoding="utf-8"))
            for f in cat_files]
    nperfiles = sum(len(c.get("perfiles", [])) for c in cats)

    tr4_ruta = os.path.join(cat_dir, "coberturas", "tr4.json")
    if not os.path.exists(tr4_ruta):
        sys.exit("gen_complemento: falta " + tr4_ruta)
    tr4 = json.load(io.open(tr4_ruta, encoding="utf-8"))

    # --- NINGUN MODULO SE QUEDA FUERA POR OLVIDO ---
    # Una lista a mano se pudre: el dia que se anada un modulo y nadie lo
    # apunte aqui, el complemento saldria sin el y la pantalla diria
    # «undefined is not an object» sin mencionar la causa.
    en_src = set(f for f in os.listdir(os.path.join(RAIZ, "src")) if f.endswith(".js"))
    declarados = set(MODULOS) | set(FUERA)
    faltan = sorted(en_src - declarados)
    if faltan:
        sys.exit(
            "gen_complemento: hay modulos en src/ que no estan ni en MODULOS ni en\n"
            "  FUERA, asi que no se sabe si deben entrar al complemento:\n"
            + "".join("    - " + m + "\n" for m in faltan) +
            "  Anadelos a la lista en su sitio por dependencia, o a FUERA con el motivo.")
    sobran = sorted(set(MODULOS) - en_src)
    if sobran:
        sys.exit("gen_complemento: MODULOS nombra archivos que no existen: " +
                 ", ".join(sobran))

    # --- el pegado ---
    hoy = date.today().isoformat()
    version = "1.0.0." + date.today().strftime("%j")
    build = "v%s \u00b7 %s" % (version.split(".")[-1], hoy)

    cab = [
        "/* Horneado por scripts/gen_complemento.py. No editar a mano:",
        "   la proxima corrida lo sobreescribe. */",
        'window.GALPON_FECHA = "%s";' % hoy,
        'window.GALPON_BUILD = "%s";' % build,
        "",
        "/* El inventario: los MISMOS .json que lee Node y que generan",
        "   inventario.html. No pueden desincronizarse. */",
        "window.INVENTARIO_DATOS = " +
        escapa(json.dumps(inv, ensure_ascii=False, separators=(",", ":"))) + ";",
        "",
    ]
    catalogos = [
        "window.CATALOGOS_DATOS = " +
        escapa(json.dumps(cats, ensure_ascii=False, separators=(",", ":"))) + ";",
        "",
        "window.TR4_DATOS = " +
        escapa(json.dumps(tr4, ensure_ascii=False, separators=(",", ":"))) + ";",
        "",
    ]

    if not os.path.isdir(SALIDA):
        os.makedirs(SALIDA)

    kb_panel = hornea(PLANTILLA_PANEL, MODULOS_PANEL, cab,
                      os.path.join(SALIDA, "panel.html"))
    kb = hornea(PLANTILLA_MODELADOR, MODULOS, cab + catalogos,
                os.path.join(SALIDA, "modelador.html"))

    io.open(os.path.join(SALIDA, "manifest.xml"), "w",
            encoding="utf-8", newline="\n").write(
        MANIFIESTO.format(guid=GUID, version=version, base=BASE_URL))

    # los iconos: azul de plano sobre borde tinta
    for lado in (16, 32, 80):
        with open(os.path.join(SALIDA, "icono-%d.png" % lado), "wb") as fh:
            fh.write(png_cuadrado(lado, (47, 111, 143), (27, 36, 48)))

    # lo que generan los otros dos scripts, si esta
    copiados = []
    for origen, destino in [
        (os.path.join(RAIZ, "visor", "galpon-visor.html"), "galpon-visor.html"),
        (os.path.join(RAIZ, "inventario", "inventario.html"), "inventario.html"),
    ]:
        if os.path.exists(origen):
            shutil.copyfile(origen, os.path.join(SALIDA, destino))
            copiados.append(destino)

    pruebas = "%d perfiles en el catalogo" % nperfiles
    io.open(os.path.join(SALIDA, "index.html"), "w",
            encoding="utf-8", newline="\n").write(
        PORTADA.format(filas=filas, pruebas=pruebas, fecha=hoy))

    print("  %d secciones de inventario  -  %d filas" % (len(inv), filas))
    print("  %d catalogos  -  %d perfiles" % (len(cats), nperfiles))
    print("  panel.html      %3d modulos  %5.0f KB" % (len(MODULOS_PANEL), kb_panel))
    print("  modelador.html  %3d modulos  %5.0f KB" % (len(MODULOS), kb))
    print("  manifest.xml   version %s  ->  %s" % (version, BASE_URL))
    print("  iconos 16, 32 y 80")
    if copiados:
        print("  copiado tambien: %s" % ", ".join(copiados))
    print("")
    print("  escrito en: %s" % SALIDA)


if __name__ == "__main__":
    main()
