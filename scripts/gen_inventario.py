# -*- coding: utf-8 -*-
"""Genera inventario.html a partir de los .json de secciones.

La regla del proyecto: ningún número entra al código sin fila en el inventario.
El JSON es la fuente; el HTML es solo la vista.  Mañana el mismo JSON alimenta
los objetos ART y DEF de cada módulo, que es para lo que existe.

    python gen_inventario.py
"""
import io
import json
import os
import sys

AQUI = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "inventario"))
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
SECCIONES = ["cargas", "perfiles", "traccion", "compresion", "flexion", "corte-flexocompresion", "estabilidad", "conexiones", "sismo", "cimentacion"]          # se añaden las otras nueve conforme se cierren
SALIDA = os.path.join(AQUI, "inventario.html")

ORDEN = ["verificado", "adoptado", "conflicto", "sin_fuente", "pendiente"]
ETIQUETA = {"verificado": "verificado", "adoptado": "adoptado",
            "conflicto": "conflicto", "sin_fuente": "criterio propio",
            "pendiente": "pendiente"}


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def cargar():
    """Lee las secciones.  Si una no está, para: un inventario incompleto que
    no avisa es peor que no tenerlo."""
    out = []
    for s in SECCIONES:
        p = os.path.join(AQUI, s + ".json")
        if not os.path.exists(p):
            sys.exit("gen_inventario: falta la sección -> " + p)
        with io.open(p, encoding="utf-8") as f:
            out.append(json.load(f))
    return out


def resumen(mags):
    c = {k: 0 for k in ORDEN}
    for m in mags:
        c[m.get("estado", "pendiente")] = c.get(m.get("estado", "pendiente"), 0) + 1
    return c


def filas(mags):
    """Agrupadas por 'grupo', en el orden en que aparecen en el JSON."""
    html, visto = [], None
    for m in mags:
        g = m.get("grupo", "")
        if g != visto:
            html.append('<tr class="g"><td colspan="5">%s</td></tr>' % esc(g))
            visto = g
        est = m.get("estado", "pendiente")
        clave = " clave" if m.get("clave") else ""
        nota = ('<div class="nota">%s</div>' % esc(m["nota"])) if m.get("nota") else ""
        ed = "editable" if m.get("editable") else "fijo"
        html.append(
            '<tr class="%s%s">'
            '<td class="id">%s</td>'
            '<td class="mag">%s%s</td>'
            '<td class="val">%s<span class="u">%s</span></td>'
            '<td class="fte">%s</td>'
            '<td class="est"><span class="p %s">%s</span><span class="ed">%s</span></td>'
            "</tr>" % (
                est, clave, esc(m["id"]), esc(m["magnitud"]), nota,
                esc(m["valor"]),
                (" " + esc(m["unidad"])) if m.get("unidad") and m["unidad"] != "—" else "",
                esc(m.get("fuente", "—")), est, ETIQUETA[est], ed))
    return "\n".join(html)


CSS = """
:root{--paper:#EEF1F4;--sheet:#FFF;--panel:#F7F9FA;--line:#C9D2DA;--line-soft:#E1E7EC;
--ink:#1A2029;--ink-2:#4A5763;--ink-3:#6B7883;--acc:#0F6E8C;--acc-soft:#DCEBF1;--acc-ink:#0A4E64;
--ok:#2E7D32;--no:#C62828;--rev:#A15F00;--oro:#F2B705}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
--paper:#0B0C0D;--sheet:#15171A;--panel:#101214;--line:#2B2F33;--line-soft:#1F2326;
--ink:#EAECEE;--ink-2:#AEB3B8;--ink-3:#7F858B;--acc:#55BDB4;--acc-soft:#10302C;--acc-ink:#8FDDD4;
--ok:#7FC784;--no:#F08A86;--rev:#E0A64B;--oro:#F2C744}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);padding:0 16px 70px;
font:400 15px/1.5 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:1180px;margin:0 auto}
.lbl{font:600 10.5px/1 "Barlow Condensed","IBM Plex Sans",sans-serif;letter-spacing:.1em;
text-transform:uppercase;color:var(--ink-3)}
header{padding:40px 0 24px;border-bottom:2px solid var(--ink);margin-bottom:26px}
h1{font:600 38px/1.05 "Barlow Condensed",sans-serif;text-transform:uppercase;margin:0 0 4px}
h1 .sub{color:var(--acc)}
.regla{border-left:3px solid var(--oro);background:rgba(242,183,5,.11);
background:color-mix(in srgb,var(--oro) 11%,transparent);
padding:12px 16px;margin:16px 0 0;font-size:14.5px;color:var(--ink-2)}
.regla b{color:var(--ink)}
.marcador{display:flex;gap:9px;flex-wrap:wrap;margin:22px 0 18px}
.m{border:1px solid var(--line);background:var(--sheet);border-radius:3px;padding:9px 14px;min-width:132px}
.m .n{font:600 26px/1 "Barlow Condensed",sans-serif;font-variant-numeric:tabular-nums}
.m .t{font:600 9.5px/1 "Barlow Condensed",sans-serif;letter-spacing:.1em;text-transform:uppercase;
color:var(--ink-3);margin-top:5px}
.m.verificado .n{color:var(--ok)} .m.conflicto .n{color:var(--rev)}
.m.adoptado .n{color:var(--acc)}
.m.sin_fuente .n{color:var(--no)} .m.pendiente .n{color:var(--ink-3)}
table{width:100%;border-collapse:collapse;background:var(--sheet);
border:1px solid var(--line);border-radius:3px;overflow:hidden}
th{font:600 9.5px/1 "Barlow Condensed",sans-serif;letter-spacing:.11em;text-transform:uppercase;
color:var(--ink-3);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--panel)}
td{padding:10px 12px;border-bottom:1px solid var(--line-soft);vertical-align:top;font-size:13.5px}
tr.g td{background:var(--acc-soft);color:var(--acc-ink);font:600 10.5px/1 "Barlow Condensed",sans-serif;
letter-spacing:.11em;text-transform:uppercase;padding:9px 12px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) tr.g td{color:var(--acc)}}
td.id{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;color:var(--ink-3);white-space:nowrap}
td.mag{width:27%}
td.val{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12.5px;width:24%;font-variant-numeric:tabular-nums}
td.val .u{color:var(--ink-3)}
td.fte{font-size:12.5px;color:var(--ink-2);width:22%}
td.est{white-space:nowrap;width:120px}
.p{display:inline-block;font:600 9.5px/1 "Barlow Condensed",sans-serif;letter-spacing:.08em;
text-transform:uppercase;padding:4px 7px;border-radius:2px;border:1px solid}
.p.verificado{color:var(--ok);border-color:var(--ok)}
.p.adoptado{color:var(--acc);border-color:var(--acc)}
.p.conflicto{color:var(--rev);border-color:var(--rev)}
.p.sin_fuente{color:var(--no);border-color:var(--no)}
.p.pendiente{color:var(--ink-3);border-color:var(--ink-3)}
.ed{display:block;font-size:10.5px;color:var(--ink-3);margin-top:4px}
.nota{font-size:12.5px;color:var(--ink-2);margin-top:5px;line-height:1.45}
tr.clave td.mag{border-left:3px solid var(--oro);margin-left:-3px}
tr.clave td.mag{box-shadow:inset 3px 0 0 var(--oro)}
footer{border-top:1px solid var(--line);margin-top:34px;padding-top:16px;color:var(--ink-3);font-size:12.5px}
@media print{:root{--paper:#FFF;--sheet:#FFF;--panel:#FFF;--ink:#000;--ink-2:#333;--ink-3:#555;
--line:#999;--line-soft:#CCC} body{padding:0;font-size:10pt} tr{break-inside:avoid}}
"""


def main():
    secs = cargar()
    total = {k: 0 for k in ORDEN}
    cuerpo = []
    for s in secs:
        r = resumen(s["magnitudes"])
        for k in ORDEN:
            total[k] += r.get(k, 0)
        cuerpo.append(
            '<h2 class="lbl" style="margin:26px 0 10px">%s · %s magnitudes · módulos %s</h2>'
            '<table><thead><tr><th>id</th><th>Magnitud</th><th>Valor o fórmula</th>'
            '<th>Fuente primaria</th><th>Estado</th></tr></thead><tbody>%s</tbody></table>'
            % (esc(s["titulo"]), len(s["magnitudes"]), esc(", ".join(s["modulos"])),
               filas(s["magnitudes"])))

    n = sum(total.values())
    marc = "".join(
        '<div class="m %s"><div class="n">%d</div><div class="t">%s</div></div>'
        % (k, total[k], ETIQUETA[k]) for k in ORDEN)

    html = """<!doctype html>
<html lang="es-PE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Galpón · Inventario de magnitudes</title>
<meta name="description" content="Cada número que el complemento Galpón calcula, con su fuente primaria leída.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>%s</style></head><body><div class="wrap">
<header>
  <div class="lbl">MEZAP · Galpón</div>
  <h1>Inventario <span class="sub">de magnitudes</span></h1>
  <div class="regla"><b>La regla:</b> %s</div>
</header>
<div class="marcador">%s<div class="m"><div class="n">%d</div><div class="t">filas en total</div></div></div>
%s
<footer>Generado por <code>gen_inventario.py</code> desde %s. El JSON es la fuente; este HTML es la vista.<br>
Criterio de arranque: ninguna fila en <b>criterio propio</b> o <b>pendiente</b> sin decisión escrita.</footer>
</div></body></html>""" % (CSS, esc(secs[0]["regla"]), marc, n, "\n".join(cuerpo),
                           ", ".join(s + ".json" for s in SECCIONES))

    with io.open(SALIDA, "w", encoding="utf-8") as f:
        f.write(html)
    print("escrito: %s" % SALIDA)
    print("  %d filas -> " % n + " · ".join("%s %d" % (ETIQUETA[k], total[k]) for k in ORDEN))


if __name__ == "__main__":
    main()
